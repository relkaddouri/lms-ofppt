import { createClient } from "@/lib/supabase/server";
import { appelerLlm, chargerConfigLlm, ErreurLlm } from "@/lib/llm";
import { dureeHeures } from "@/lib/creneaux";
import { NextResponse } from "next/server";

/**
 * Support remis au stagiaire.
 *
 * Deux documents de nature différente selon la séance : un cours pour une
 * séance théorique, un énoncé de travaux pratiques pour une séance pratique.
 * Les confondre produirait un cours sans exercice ou un TP sans notions.
 */

export type SectionCours = {
  titre: string;
  notions: string[];
  exemple: string | null;
};

export type SupportTheorique = {
  type: "theorique";
  titre: string;
  introduction: string;
  sections: SectionCours[];
  aRetenir: string[];
};

export type CritereTp = { critere: string; points: number };

export type SupportPratique = {
  type: "pratique";
  titre: string;
  contexte: string;
  objectif: string;
  consignes: string[];
  livrable: string;
  criteres: CritereTp[];
};

export type Support = SupportTheorique | SupportPratique;

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

  const { data: seance, error } = await supabase
    .from("seances")
    .select(
      "id, groupe_id, module_id, heure_debut, heure_fin, duree_prevue, nature, objectif_operationnel, groupes(nom), modules(nom), suggestions_pedagogiques(code, apprentissage_base, elements_contenu, activites_apprentissage)",
    )
    .eq("id", seanceId)
    .maybeSingle();

  if (error || !seance) {
    return NextResponse.json({ error: "Séance introuvable" }, { status: 404 });
  }

  const s = seance as unknown as {
    groupe_id: string;
    module_id: string;
    heure_debut: string | null;
    heure_fin: string | null;
    duree_prevue: number | null;
    nature: "theorique" | "pratique" | null;
    objectif_operationnel: string | null;
    groupes: { nom: string } | null;
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
  const { data: precedentes } = await supabase
    .from("seances")
    .select("contenu_realise")
    .eq("groupe_id", s.groupe_id)
    .eq("module_id", s.module_id)
    .eq("statut", "fait")
    .not("contenu_realise", "is", null);

  const dejaVu =
    (precedentes ?? [])
      .map((p) => p.contenu_realise)
      .filter(Boolean)
      .join(" ; ") || null;

  const obj = s.suggestions_pedagogiques;

  const contexte = [
    `Module : ${s.modules?.nom ?? "—"}`,
    `Groupe : ${s.groupes?.nom ?? "—"}`,
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
  ]
    .filter((l): l is string => l !== null)
    .join("\n");

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
      "exemple": "un exemple concret tiré du métier, ou null"
    }
  ],
  "aRetenir": ["l'essentiel en une ligne", "…"]
}`,
    "",
    "Entre 3 et 5 sections, 2 à 4 notions chacune, 3 à 5 points à retenir.",
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
  "criteres": [{ "critere": "ce qui est évalué", "points": 5 }]
}`,
    "",
    "Entre 4 et 7 consignes. Les points des critères doivent totaliser 20.",
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
      type: "pratique",
      titre: String(brut.titre ?? "Travaux pratiques").trim(),
      contexte: String(brut.contexte ?? "").trim(),
      objectif: String(brut.objectif ?? "").trim(),
      consignes: liste(brut.consignes),
      livrable: String(brut.livrable ?? "").trim(),
      criteres,
    };
    return NextResponse.json({ support, avertissements });
  }

  const sections = (Array.isArray(brut.sections) ? brut.sections : [])
    .map((sec) => {
      const o = (sec ?? {}) as {
        titre?: unknown;
        notions?: unknown;
        exemple?: unknown;
      };
      return {
        titre: String(o.titre ?? "").trim(),
        notions: liste(o.notions, 6),
        exemple: o.exemple ? String(o.exemple).trim() : null,
      };
    })
    .filter((sec) => sec.titre && sec.notions.length > 0);

  if (sections.length === 0) avertissements.push("Le cours ne contient aucune section.");

  const support: SupportTheorique = {
    type: "theorique",
    titre: String(brut.titre ?? "Support de cours").trim(),
    introduction: String(brut.introduction ?? "").trim(),
    sections,
    aRetenir: liste(brut.aRetenir, 8),
  };
  return NextResponse.json({ support, avertissements });
}
