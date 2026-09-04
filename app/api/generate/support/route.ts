import { createClient } from "@/lib/supabase/server";
import { appelerLlm, chargerConfigLlm, ErreurLlm } from "@/lib/llm";
import { dureeHeures } from "@/lib/creneaux";
import { verifierQuota, QUOTA_GENERATION } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import {
  ressourceHonoree,
  ressourcesDeLaFiche,
  type RessourceSupport,
  type SchemaSupport,
  type Support,
  type SupportPratique,
  type SupportTheorique,
} from "@/lib/support";
import { sourceContenu } from "@/app/actions/partage";

/**
 * Support remis au stagiaire.
 *
 * Deux documents de nature différente selon la séance : un cours pour une
 * séance théorique, un énoncé de travaux pratiques pour une séance pratique.
 * Les confondre produirait un cours sans exercice ou un TP sans notions.
 */



/**
 * Normalise une liste renvoyée par le modèle.
 *
 * La numérotation est retirée : le rendu numérote lui-même, et un « 1. » gardé
 * dans le texte produirait « 1. 1. En groupe de… ».
 */
function liste(v: unknown, max = 12): string[] {
  return (Array.isArray(v) ? v : [])
    .map((x) =>
      String(x ?? "")
        .trim()
        .replace(/^\s*(?:\d+[.)]|[-–•*])\s*/, ""),
    )
    .filter(Boolean)
    .slice(0, max);
}

/**
 * Normalise les ressources et vérifie que leurs liens mènent quelque part.
 *
 * Un modèle produit volontiers une URL plausible qui n'existe pas. Un lien
 * mort dans un support remis à une classe se découvre devant la classe : la
 * vérification coûte une requête et se fait ici, une fois.
 */
async function ressourcesVerifiees(
  brut: unknown,
  annoncees: string[],
): Promise<RessourceSupport[]> {
  const liste = (Array.isArray(brut) ? brut : [])
    .map((r) => {
      const o = (r ?? {}) as Record<string, unknown>;
      const url = String(o.url ?? "").trim();
      return {
        titre: String(o.titre ?? "").trim(),
        url: /^https?:\/\//.test(url) ? url : null,
        pourquoi: String(o.pourquoi ?? "").trim(),
        origine: annoncees.some(
          (a) => a === url || (a.length > 3 && String(o.titre ?? "").includes(a)),
        )
          ? ("fiche" as const)
          : ("proposee" as const),
        joignable: null as boolean | null,
      };
    })
    .filter((r) => r.titre)
    .slice(0, 8);

  await Promise.all(
    liste.map(async (r) => {
      if (!r.url) return;
      try {
        const ctrl = new AbortController();
        const minuteur = setTimeout(() => ctrl.abort(), 4000);
        // Certains serveurs refusent HEAD : un GET interrompu dit la même
        // chose sans télécharger la page entière.
        const rep = await fetch(r.url, {
          method: "GET",
          redirect: "follow",
          signal: ctrl.signal,
        });
        clearTimeout(minuteur);
        r.joignable = rep.ok;
      } catch {
        r.joignable = false;
      }
    }),
  );

  return liste;
}

function schema(v: unknown): SchemaSupport | null {
  const o = (v ?? {}) as Record<string, unknown>;
  const etapes = liste(o.etapes, 8);
  if (etapes.length < 2) return null;
  return {
    titre: String(o.titre ?? "").trim() || "Schéma",
    etapes,
    legende: o.legende ? String(o.legende).trim() : null,
  };
}

/**
 * Contrôle §4.4 : le support tient-il les promesses de la fiche ?
 *
 * La consigne ne suffit pas — c'est le principe retenu partout ici : ce que
 * le PRD déclare non négociable se vérifie après coup, on ne se contente pas
 * de le demander au modèle.
 */
function coherence(
  support: Support,
  annoncees: string[],
  sansFiche: boolean,
): string[] {
  const dits: string[] = [];

  if (sansFiche) {
    dits.push(
      "Aucune fiche de préparation n'existe pour cette séance : le support n'a rien pu honorer. Générez la fiche d'abord.",
    );
    return dits;
  }

  const orphelines = annoncees.filter((a) => !ressourceHonoree(a, support));
  if (orphelines.length > 0) {
    dits.push(
      `La fiche annonce ${orphelines.length} ressource${orphelines.length > 1 ? "s" : ""} que le support ne reprend pas : ${orphelines.join(" · ")}.`,
    );
  }

  const mortes = support.ressources.filter((r) => r.joignable === false);
  if (mortes.length > 0) {
    dits.push(
      `${mortes.length} lien${mortes.length > 1 ? "s" : ""} ne répond${mortes.length > 1 ? "ent" : ""} pas : ${mortes.map((r) => r.titre).join(" · ")}. Corrigez ou retirez avant de remettre le document.`,
    );
  }

  const aVerifier = support.ressources.filter(
    (r) => r.origine === "proposee" && r.url && r.joignable !== false,
  );
  if (aVerifier.length > 0) {
    dits.push(
      `${aVerifier.length} ressource${aVerifier.length > 1 ? "s" : ""} proposée${aVerifier.length > 1 ? "s" : ""} par le modèle : le lien répond, son contenu reste à vérifier.`,
    );
  }

  return dits;
}

export async function POST(request: Request) {
  const { seanceId } = await request.json().catch(() => ({}));
  if (!seanceId) {
    return NextResponse.json({ error: "seanceId requis" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }

  // Chaque appel est facturé sur la clé du formateur : on borne le rythme.
  const quota = verifierQuota(`generate-support:${user.id}`, QUOTA_GENERATION);
  if (quota) return quota;

  const { data: seance, error } = await supabase
    .from("seances")
    .select(
      "id, module_id, heure_debut, heure_fin, duree_prevue, nature, objectif_operationnel, seance_groupes!inner(groupe_id, groupes(nom)), modules(nom), suggestions_pedagogiques(code, apprentissage_base, elements_contenu, activites_apprentissage)",
    )
    .eq("id", seanceId)
    .maybeSingle();

  if (error || !seance) {
    return NextResponse.json({ error: "Séance introuvable" }, { status: 404 });
  }

  const s = seance as unknown as {
    module_id: string;
    heure_debut: string | null;
    heure_fin: string | null;
    duree_prevue: number | null;
    nature: "theorique" | "pratique" | null;
    objectif_operationnel: string | null;
    seance_groupes: { groupe_id: string; groupes: { nom: string } | null }[];
    modules: { nom: string } | null;
    suggestions_pedagogiques: {
      code: string | null;
      apprentissage_base: string;
      elements_contenu: string | null;
      activites_apprentissage: string | null;
    } | null;
  };

  const pratique = s.nature === "pratique";
  const duree =
    s.heure_debut && s.heure_fin
      ? dureeHeures(s.heure_debut, s.heure_fin)
      : (s.duree_prevue ?? null);

  // Ce qui a déjà été traité avec ce groupe : le support enchaîne, il ne
  // recommence pas.
  //
  // Le filtre portait ici le même nom de colonne fautif que la génération de
  // fiche — une expression TypeScript recopiée dans une chaîne PostgREST. La
  // requête échouait à chaque appel et « déjà traité » était toujours vide.
  const { data: precedentes } = await supabase
    .from("seances")
    .select("contenu_realise, seance_groupes!inner(groupe_id)")
    .eq("seance_groupes.groupe_id", s.seance_groupes[0]!.groupe_id)
    .eq("module_id", s.module_id)
    .eq("statut", "fait")
    .not("contenu_realise", "is", null);

  const dejaVu =
    (precedentes ?? [])
      .map((p) => p.contenu_realise)
      .filter(Boolean)
      .join(" ; ") || null;

  // §4.4 : le support doit honorer ce que la fiche annonce. Il faut donc
  // commencer par la lire — celle de la séance source quand la séance est un
  // miroir (§4.3bis), sans quoi deux groupes parallèles auraient une fiche
  // commune et des supports qui ne la suivent pas.
  const idFiche = await sourceContenu(seanceId);
  const { data: ficheRow } = await supabase
    .from("fiches_preparation")
    .select("contenu")
    .eq("seance_id", idFiche)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  let fiche: {
    objectifs?: string;
    methodeActive?: string;
    fichiers?: string;
    phases?: { cle: string; instructions: string[]; questions: string[]; points: string[] }[];
  } | null = null;
  try {
    fiche = ficheRow?.contenu ? JSON.parse(ficheRow.contenu) : null;
  } catch {
    fiche = null;
  }

  const annoncees = fiche ? ressourcesDeLaFiche(fiche) : [];

  const obj = s.suggestions_pedagogiques;

  const contexte = [
    `Module : ${s.modules?.nom ?? "—"}`,
    `Groupe : ${s.seance_groupes[0]?.groupes?.nom ?? "—"}`,
    duree ? `Durée de la séance : ${duree} heures.` : null,
    obj
      ? `Objectif d'apprentissage du référentiel : ${obj.code ?? ""} ${obj.apprentissage_base}`
      : `Objectif de la séance : ${s.objectif_operationnel ?? "non renseigné"}`,
    obj?.elements_contenu ? `Éléments de contenu : ${obj.elements_contenu}` : null,
    obj?.activites_apprentissage
      ? `Activités prévues par le référentiel : ${obj.activites_apprentissage}`
      : null,
    "",
    dejaVu ? `Déjà traité avec ce groupe : ${dejaVu}` : "Première séance du module.",
    "",
    fiche
      ? [
          "FICHE DE PRÉPARATION DE CETTE SÉANCE — le support la sert, il ne",
          "raconte pas autre chose :",
          fiche.objectifs ? `  Objectif : ${fiche.objectifs}` : null,
          fiche.methodeActive ? `  Méthode active : ${fiche.methodeActive}` : null,
          ...(fiche.phases ?? []).flatMap((ph) => [
            `  [${ph.cle}] ${ph.instructions.join(" · ")}`,
            ph.points.length ? `    points : ${ph.points.join(" · ")}` : null,
          ]),
        ]
          .filter(Boolean)
          .join("\n")
      : "Aucune fiche de préparation n'est encore enregistrée pour cette séance.",
    "",
    annoncees.length
      ? [
          "RESSOURCES ANNONCÉES PAR LA FICHE — chacune doit se retrouver dans",
          "le support, nommée et accessible. Une référence que le stagiaire ne",
          "peut pas atteindre est une promesse non tenue :",
          ...annoncees.map((r) => `  — ${r}`),
        ].join("\n")
      : null,
    annoncees.length ? "" : null,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");

  const consignesRiches = [
    "",
    "RESSOURCES — le support n'est pas un texte nu. Cite dans `ressources`",
    "les documents, vidéos et articles de référence qui approfondissent la",
    "notion. Deux règles :",
    "  · toute ressource annoncée par la fiche ci-dessus y figure, avec son",
    "    URL quand elle en a une — c'est la raison d'être de cette liste ;",
    "  · une ressource que tu ajoutes de toi-même vient d'une source stable",
    "    et connue (documentation officielle, organisme de référence,",
    "    ouvrage). Si tu n'es pas certain de l'URL exacte, laisse `url` à",
    "    null et nomme la source dans le titre — un lien inventé fait perdre",
    "    plus de temps qu'une référence sans lien.",
    "",
    "SCHÉMAS — quand une notion se comprend mieux en figure (un processus, une",
    "structure, une comparaison), donne-lui un `schema` : des étapes nommées,",
    "dans l'ordre de lecture. Pas de schéma décoratif : seulement là où la",
    "figure dit ce que le paragraphe dirait mal.",
  ];

  const promptTheorique = [
    contexte,
    "Rédige le SUPPORT DE COURS remis aux stagiaires pour cette séance.",
    "",
    "C'est un document que le stagiaire lit et conserve, pas les notes du",
    "formateur. Écris pour lui : des phrases courtes, du vocabulaire défini",
    "quand il apparaît, et un exemple concret du métier par section.",
    "",
    "N'écris pas d'exercice à rendre : c'est un cours, pas un TP.",
    "N'invente pas de notions absentes des éléments de contenu ci-dessus.",
    "",
    "Réponds UNIQUEMENT en JSON, sans markdown :",
    `{
  "titre": "titre du cours",
  "introduction": "deux ou trois phrases situant le sujet et son utilité métier",
  "sections": [
    {
      "titre": "titre de la section",
      "notions": ["notion expliquée en une ou deux phrases", "…"],
      "exemple": "un exemple concret tiré du métier, ou null",
      "schema": { "titre": "…", "etapes": ["…", "…"], "legende": "…" }
    }
  ],
  "aRetenir": ["l'essentiel en une ligne", "…"],
  "ressources": [
    { "titre": "…", "url": "https://… ou null", "pourquoi": "ce que le stagiaire y trouve" }
  ]
}`,
    "",
    "Entre 3 et 5 sections, 2 à 4 notions chacune, 3 à 5 points à retenir.",
    "`schema` vaut null sur les sections où une figure n'apporterait rien.",
    ...consignesRiches,
  ].join("\n");

  const promptPratique = [
    contexte,
    "Rédige l'ÉNONCÉ DE TRAVAUX PRATIQUES remis aux stagiaires pour cette séance.",
    "",
    "Le stagiaire doit pouvoir travailler seul à partir de ce document. Pose",
    "une situation professionnelle concrète — un client, un produit, un besoin —",
    "puis ce qu'il doit produire et comment il sera évalué.",
    "",
    "N'écris pas de cours : les notions sont supposées vues.",
    duree
      ? `Le travail doit tenir en ${duree} heures.`
      : "Calibre le travail sur une séance.",
    "",
    "Réponds UNIQUEMENT en JSON, sans markdown :",
    `{
  "titre": "titre du TP",
  "contexte": "la situation professionnelle, avec des détails concrets",
  "objectif": "ce que le stagiaire doit être capable de faire à la fin, en une phrase",
  "consignes": ["étape ou consigne numérotée", "…"],
  "livrable": "ce qui est rendu, sous quelle forme",
  "criteres": [{ "critere": "ce qui est évalué", "points": 5 }],
  "ressources": [
    { "titre": "…", "url": "https://… ou null", "pourquoi": "ce que le stagiaire y trouve" }
  ]
}`,
    "",
    "Entre 4 et 7 consignes. Les points des critères doivent totaliser 20.",
    ...consignesRiches,
  ].join("\n");

  let texte: string;
  try {
    const config = await chargerConfigLlm(user.id);
    texte = await appelerLlm(config, {
      systeme:
        "Tu es un formateur expert du référentiel OFPPT. Tu rédiges en français, pour des stagiaires de niveau technicien spécialisé.",
      prompt: pratique ? promptPratique : promptTheorique,
      temperature: 0.6,
      maxTokens: 4000,
      json: true,
    });
  } catch (e) {
    const err = e instanceof ErreurLlm ? e : null;
    return NextResponse.json(
      { error: err?.message ?? "Échec de génération" },
      { status: err?.statut ?? 502 },
    );
  }

  let brut: Record<string, unknown>;
  try {
    brut = JSON.parse(texte) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "Le modèle n'a pas retourné un JSON valide." },
      { status: 502 },
    );
  }

  const avertissements: string[] = [];

  if (pratique) {
    const criteres = (Array.isArray(brut.criteres) ? brut.criteres : [])
      .map((c) => {
        const o = (c ?? {}) as { critere?: unknown; points?: unknown };
        return {
          critere: String(o.critere ?? "").trim(),
          points: Math.max(0, Number(o.points) || 0),
        };
      })
      .filter((c) => c.critere);

    // Un barème qui ne tombe pas sur 20 se remarque à la correction, pas
    // avant : autant le dire ici.
    const total = criteres.reduce((t, c) => t + c.points, 0);
    if (criteres.length > 0 && total !== 20) {
      avertissements.push(
        `Les critères totalisent ${total} points au lieu de 20. Ajustez avant d'enregistrer.`,
      );
    }
    if (criteres.length === 0) avertissements.push("Aucun critère d'évaluation.");

    const support: SupportPratique = {
      ressources: await ressourcesVerifiees(brut.ressources, annoncees),
      type: "pratique",
      titre: String(brut.titre ?? "Travaux pratiques").trim(),
      contexte: String(brut.contexte ?? "").trim(),
      objectif: String(brut.objectif ?? "").trim(),
      consignes: liste(brut.consignes),
      livrable: String(brut.livrable ?? "").trim(),
      criteres,
    };
    avertissements.push(...coherence(support, annoncees, !fiche));
    return NextResponse.json({ support, avertissements });
  }

  const sections = (Array.isArray(brut.sections) ? brut.sections : [])
    .map((sec) => {
      const o = (sec ?? {}) as {
        titre?: unknown;
        notions?: unknown;
        exemple?: unknown;
        schema?: unknown;
      };
      return {
        titre: String(o.titre ?? "").trim(),
        notions: liste(o.notions, 6),
        exemple: o.exemple ? String(o.exemple).trim() : null,
        schema: schema(o.schema),
      };
    })
    .filter((sec) => sec.titre && sec.notions.length > 0);

  if (sections.length === 0) avertissements.push("Le cours ne contient aucune section.");

  const support: SupportTheorique = {
    ressources: await ressourcesVerifiees(brut.ressources, annoncees),
    type: "theorique",
    titre: String(brut.titre ?? "Support de cours").trim(),
    introduction: String(brut.introduction ?? "").trim(),
    sections,
    aRetenir: liste(brut.aRetenir, 8),
  };
  avertissements.push(...coherence(support, annoncees, !fiche));
  return NextResponse.json({ support, avertissements });
}
