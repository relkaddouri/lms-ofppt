import { createClient } from "@/lib/supabase/server";
import { appelerLlm, chargerConfigLlm, ErreurLlm } from "@/lib/llm";
import { dureeHeures, formatHeure } from "@/lib/creneaux";
import { getElementsDeSeance } from "@/app/actions/couverture";
import { verifierQuota, QUOTA_GENERATION } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import {
  PHASES,
  definitionPhase,
  quatrePhases,
  type PhaseFiche,
} from "@/lib/phases";
import {
  METHODES_ACTIVES,
  VERBES_PASSIFS,
  memeMethode,
  methodesDeLaFiche,
} from "@/lib/pedagogie";

/**
 * Aide-mémoire de séance.
 *
 * Ce que le formateur emporte en salle n'est pas un document administratif :
 * c'est un pense-bête qu'il parcourt du regard entre deux explications. Un
 * déroulé minuté ne sert personne — il ne survit pas aux dix premières minutes
 * réelles d'une séance — et sa longueur le rend inconsultable.
 */
export type FicheGeneree = {
  objectifs: string;
  /** La méthode active dominante de la séance (PRD §4.3, variété imposée). */
  methodeActive: string;
  modalite: string;
  fichiers: string;
  /** Les quatre phases, dans l'ordre — PRD §4.3ter. */
  phases: PhaseFiche[];
};

type SuggestionRef = {
  apprentissage_base: string;
  elements_contenu: string | null;
  activites_apprentissage: string | null;
  duree_suggeree_pourcent: number | null;
};

type ElementRef = {
  lettre: string;
  intitule: string;
  criteres_particuliers_performance: { texte: string }[] | null;
  suggestions_pedagogiques: SuggestionRef[] | null;
};

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
  const quota = verifierQuota(`generate-fiche:${user.id}`, QUOTA_GENERATION);
  if (quota) return quota;

  // La séance porte tout le contexte utile : sa durée réelle, son objectif, le
  // groupe concerné et le module dont elle relève.
  const { data: seance, error: errSeance } = await supabase
    .from("seances")
    .select(
      "id, date, heure_debut, heure_fin, duree_realisee, objectif_operationnel, contenu_prevu, module_id, seance_groupes!inner(groupe_id, groupes(nom)), modules(nom, description, duree_reference, competence_id)",
    )
    .eq("id", seanceId)
    .single();

  if (errSeance || !seance) {
    return NextResponse.json({ error: "Séance introuvable" }, { status: 404 });
  }

  const s = seance as unknown as {
    date: string | null;
    heure_debut: string | null;
    heure_fin: string | null;
    duree_realisee: number | null;
    objectif_operationnel: string | null;
    contenu_prevu: string | null;
    module_id: string;
    seance_groupes: { groupe_id: string; groupes: { nom: string } | null }[];
    modules: {
      nom: string;
      description: string | null;
      duree_reference: number;
      competence_id: string | null;
    } | null;
  };

  const duree =
    s.heure_debut && s.heure_fin
      ? dureeHeures(s.heure_debut, s.heure_fin)
      : (s.duree_realisee ?? null);

  // Le référentiel officiel : fiche prescrite et suggestions pédagogiques de la
  // compétence. C'est la matière première prescrite, pas une invention du
  // modèle.
  let elements: ElementRef[] = [];
  let contexte: string | null = null;
  let criteresGeneraux: string | null = null;
  let competenceNom: string | null = null;

  if (s.modules?.competence_id) {
    const { data: comp } = await supabase
      .from("competences")
      .select(
        "nom, fiches_prescrites(contexte_realisation, criteres_generaux_performance, elements_competence(lettre, intitule, ordre, criteres_particuliers_performance(texte, ordre), suggestions_pedagogiques(apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)))",
      )
      .eq("id", s.modules.competence_id)
      .maybeSingle();

    const c = comp as unknown as {
      nom: string;
      fiches_prescrites: {
        contexte_realisation: string | null;
        criteres_generaux_performance: string | null;
        elements_competence: ElementRef[] | null;
      } | null;
    } | null;

    competenceNom = c?.nom ?? null;
    contexte = c?.fiches_prescrites?.contexte_realisation ?? null;
    criteresGeneraux = c?.fiches_prescrites?.criteres_generaux_performance ?? null;
    elements = c?.fiches_prescrites?.elements_competence ?? [];
  }

  // Ce qui a déjà été fait avec CE groupe sur CE module.
  //
  // Le nom de colonne du filtre était `seance_groupes.seance_groupes[0]!.
  // groupe_id` — un copier-coller d'expression TypeScript dans une chaîne
  // PostgREST. La requête échouait donc à chaque appel, et comme seul `data`
  // était lu, l'échec passait pour « aucune séance précédente » : le contexte
  // de continuité n'a jamais atteint le modèle.
  const groupeId = s.seance_groupes[0]!.groupe_id;

  const { data: precedentes, error: errPrecedentes } = await supabase
    .from("seances")
    .select(
      "id, date, statut, contenu_source_id, objectif_operationnel, contenu_realise, seance_groupes!inner(groupe_id)",
    )
    .eq("seance_groupes.groupe_id", groupeId)
    .eq("module_id", s.module_id)
    .neq("id", seanceId)
    .not("date", "is", null)
    .lt("date", s.date ?? "9999-12-31")
    .order("date", { ascending: true });
  if (errPrecedentes) throw new Error(errPrecedentes.message);

  const anterieures = (precedentes ?? []) as unknown as {
    id: string;
    date: string | null;
    statut: string;
    contenu_source_id: string | null;
    objectif_operationnel: string | null;
    contenu_realise: string | null;
  }[];

  // PRD §4.3, continuité : ce sur quoi la séance prend appui, ce sont les
  // séances réellement faites — une séance planifiée n'a rien construit chez
  // personne.
  const faites = anterieures.filter((p) => p.statut === "fait");

  const acquis =
    faites
      .map((p, i) =>
        [
          `  ${i + 1}. ${p.date ?? "sans date"}`,
          p.objectif_operationnel ? ` — visait : ${p.objectif_operationnel}` : "",
          p.contenu_realise ? ` — a réellement couvert : ${p.contenu_realise}` : "",
        ].join(""),
      )
      .join("\n") || null;

  const dejaCouvert =
    faites
      .map((p) => p.contenu_realise)
      .filter(Boolean)
      .join(" ; ") || null;

  // PRD §4.3, variété : les méthodes des dernières fiches du couple
  // groupe+module. Elles vivent dans la fiche, pas sur la séance — et une
  // séance miroir tire la sienne de sa source (§4.3bis), d'où la résolution
  // par `contenu_source_id`.
  const recentes = anterieures.slice(-6);
  const methodesRecentes: string[] = [];

  if (recentes.length > 0) {
    const sources = [...new Set(recentes.map((p) => p.contenu_source_id ?? p.id))];
    const { data: fiches } = await supabase
      .from("fiches_preparation")
      .select("seance_id, contenu, version")
      .in("seance_id", sources)
      .order("version", { ascending: false });

    const derniere = new Map<string, string>();
    for (const f of fiches ?? []) {
      if (f.contenu && !derniere.has(f.seance_id)) derniere.set(f.seance_id, f.contenu);
    }

    for (const p of recentes) {
      const brut = derniere.get(p.contenu_source_id ?? p.id);
      if (!brut) continue;
      for (const m of methodesDeLaFiche(brut)) {
        if (!methodesRecentes.some((v) => memeMethode(v, m))) {
          methodesRecentes.push(m);
        }
      }
    }
  }

  // PRD §4.3ter : la structuration se nourrit des critères particuliers de
  // performance, qui sont la définition officielle de « bien fait » — pas de
  // notions que le modèle jugerait pertinentes.
  const criteresParticuliers = elements.flatMap((el) =>
    (el.criteres_particuliers_performance ?? []).map(
      (c) => `${el.lettre}. ${c.texte}`,
    ),
  );

  const referentiel = elements.flatMap((el) => {
    const criteres = (el.criteres_particuliers_performance ?? [])
      .map((c) => c.texte)
      .join(" ; ");
    const suggestions = (el.suggestions_pedagogiques ?? [])
      .map((sg) =>
        [
          sg.apprentissage_base,
          sg.elements_contenu,
          sg.activites_apprentissage,
        ]
          .filter(Boolean)
          .join(" — "),
      )
      .join(" | ");
    return [
      `${el.lettre}. ${el.intitule}`,
      criteres ? `   Critères : ${criteres}` : null,
      suggestions ? `   Suggestions du programme : ${suggestions}` : null,
    ].filter((l): l is string => l !== null);
  });

  // PRD §4.2bis : la fiche porte sur les éléments de contenu assignés à CETTE
  // séance, pas sur l'apprentissage entier dont elle ne couvre qu'une part.
  // C'est ce qui garantit qu'aucun élément du référentiel national ne passe
  // à la trappe entre deux séances.
  const elementsAssignes = await getElementsDeSeance(seanceId);

  const minutes = duree ? Math.round(duree * 60) : null;

  const prompt = [
    `Séance à préparer : ${s.date ?? "date à définir"}`,
    s.heure_debut && s.heure_fin
      ? `Créneau : ${formatHeure(s.heure_debut)} – ${formatHeure(s.heure_fin)} (${duree} h)`
      : duree
        ? `Durée : ${duree} h`
        : "Durée non renseignée.",
    `Groupe : ${s.seance_groupes[0]?.groupes?.nom ?? "—"}`,
    `Module : ${s.modules?.nom ?? "—"}`,
    competenceNom ? `Compétence du référentiel : ${competenceNom}` : null,
    s.objectif_operationnel
      ? `Objectif opérationnel de la séance : ${s.objectif_operationnel}`
      : null,
    s.contenu_prevu ? `Contenu prévu : ${s.contenu_prevu}` : null,
    "",
    dejaCouvert
      ? `Déjà traité avec ce groupe sur ce module : ${dejaCouvert}`
      : "Aucune séance de ce module n'a encore été faite avec ce groupe.",
    "",
    acquis
      ? [
          `Ce que les ${faites.length} séance${faites.length > 1 ? "s" : ""} déjà faite${faites.length > 1 ? "s" : ""} ont construit chez ces stagiaires :`,
          acquis,
          "",
          "Cette séance en est la suite : prends explicitement appui sur ces",
          "acquis — désigne-les, fais-les rejouer, construis dessus. Ne repars",
          "pas d'une base neutre comme si c'était la première séance du module.",
        ].join("\n")
      : null,
    acquis ? "" : null,
    methodesRecentes.length
      ? [
          "Méthodes actives déjà mobilisées lors des dernières séances de ce",
          "groupe sur ce module :",
          ...methodesRecentes.map((m) => `  — ${m}`),
          "",
          "Choisis-en une AUTRE. Répéter la même méthode séance après séance",
          "est explicitement proscrit.",
        ].join("\n")
      : null,
    methodesRecentes.length ? "" : null,
    elementsAssignes.length
      ? [
          "Éléments de contenu du référentiel assignés à CETTE séance —",
          "la fiche doit les traiter tous, et ne pas déborder sur les autres :",
          ...elementsAssignes.map((e: string, i: number) => `  ${i + 1}. ${e}`),
        ].join("\n")
      : null,
    elementsAssignes.length ? "" : null,
    referentiel.length
      ? ["Référentiel officiel de la compétence :", ...referentiel].join("\n")
      : "Le référentiel de cette compétence n'est pas encore saisi.",
    contexte ? `\nContexte de réalisation : ${contexte}` : null,
    criteresGeneraux ? `Critères généraux : ${criteresGeneraux}` : null,
    "",
    "─────",
    "",
    "Remplis la fiche de préparation officielle OFPPT. Elle se compose d'une",
    "introduction, d'un développement et d'une conclusion, chaque bloc portant",
    "sa durée.",
    "",
    minutes
      ? `La séance dure ${minutes} minutes. La somme de toutes les durées doit valoir exactement ${minutes}.`
      : "La durée de la séance n'est pas connue : reste cohérent d'un bloc à l'autre.",
    "Compte environ 15 minutes pour l'introduction et 15 pour la conclusion,",
    "le reste au développement.",
    "",
    "Écris de façon télégraphique : des lignes courtes, jamais de paragraphes.",
    "Chaque contenu tient en quelques lignes séparées par des retours à la",
    "ligne — c'est une fiche que le formateur parcourt du regard, pas un",
    "rapport. Ne recopie pas l'objectif de la séance dans les contenus.",
    "",
    "Appuie-toi sur le référentiel ci-dessus et enchaîne sur ce qui a déjà été",
    "traité — ne le répète pas.",
    "",
    "OBJECTIF — Approche Par Compétences, exigence non négociable :",
    "l'objectif décrit ce que le stagiaire sera capable de FAIRE, dans une",
    "situation professionnelle précise, à des conditions observables. Jamais",
    `un état mental : les verbes ${VERBES_PASSIFS.slice(0, 5).join(", ")} sont`,
    "interdits en tête d'objectif. Formule « À partir de … le stagiaire",
    "produit / analyse / arbitre / justifie … en respectant … ».",
    "Tout le reste de la fiche sert cet objectif : le contenu, la méthode et",
    "le déroulement lui sont subordonnés, ce ne sont pas des rubriques",
    "juxtaposées.",
    "",
    "MÉTHODE ACTIVE — le champ `methodeActive` nomme la méthode dominante de",
    "la séance, choisie pour ce contenu précis. Répertoire de référence :",
    ...METHODES_ACTIVES.map((m) => `  — ${m.nom} : ${m.description}`),
    "Une méthode hors liste est acceptable si elle convient mieux ; garde",
    "alors une formulation aussi courte. Le stagiaire produit, cherche,",
    "confronte — il n'écoute pas.",
    "",
    "`methodeActive` nomme UNE seule méthode, jamais une énumération : c'est",
    "elle qu'on compare aux séances passées pour garantir la variété, et une",
    "liste de trois méthodes rendrait cette comparaison inopérante. Chaque",
    "phase a par ailleurs sa propre `methode`, qui peut différer.",
    "",
    "DÉROULEMENT — quatre phases, dans cet ordre, jamais d'autres :",
    ...PHASES.map(
      (ph) =>
        `  ${ph.titre} (${Math.round(ph.part * 100)} % du temps) — ${ph.intention}. ` +
        `Sa liste \`points\` porte : ${ph.libellePoints.toLowerCase()}.`,
    ),
    "",
    "Le savoir arrive en structuration, jamais avant : la mise en situation",
    "pose un problème que les stagiaires ne savent pas encore résoudre, et",
    "l'activité les laisse chercher. Une phase qui commence par exposer la",
    "notion est une erreur, quelle que soit sa qualité.",
    "",
    criteresParticuliers.length
      ? [
          "La phase de STRUCTURATION se nourrit des critères particuliers de",
          "performance du référentiel officiel ci-dessous, pas de notions",
          "inventées. Sa liste `points` les reprend, reformulés pour la classe :",
          ...criteresParticuliers.map((c) => `  — ${c}`),
        ].join("\n")
      : "La phase de STRUCTURATION nomme les notions issues du référentiel ci-dessus, jamais des notions inventées.",
    "",
    "Chaque phase porte sa propre méthode active dans `methode`, ses",
    "`instructions` — ce que le formateur fait et dit, une action par ligne,",
    "prête à exécuter sans rien reconstruire — et ses `questions`, posées",
    "telles quelles aux stagiaires, jamais des thèmes de questions.",
    "",
    minutes
      ? `Les minutes des quatre phases totalisent exactement ${minutes}.`
      : "Reste cohérent d'une phase à l'autre sur les minutes.",
    "",
    "Réponds UNIQUEMENT en JSON, sans markdown, avec exactement cette structure :",
    `{
  "objectifs": "ce que le stagiaire sera capable de FAIRE, en situation, en une phrase",
  "methodeActive": "la méthode active dominante de la séance",
  "modalite": "Synchrone présentiel",
  "fichiers": "supports nécessaires, ou -",
  "phases": [
    {
      "cle": "mise_en_situation",
      "methode": "la méthode de cette phase",
      "minutes": 15,
      "instructions": ["ce que fait le formateur, une action par ligne"],
      "questions": ["la question exacte à poser"],
      "points": ["le déclencheur"]
    },
    { "cle": "activite", "methode": "…", "minutes": 75, "instructions": [], "questions": [], "points": [] },
    { "cle": "structuration", "methode": "…", "minutes": 40, "instructions": [], "questions": [], "points": [] },
    { "cle": "reinvestissement", "methode": "…", "minutes": 20, "instructions": [], "questions": [], "points": [] }
  ]
}`,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");

  try {
    const config = await chargerConfigLlm(user.id);
    const contenu = await appelerLlm(config, {
      systeme: [
        "Tu es un formateur expert du référentiel OFPPT, qui enseigne selon",
        "l'Approche Par Compétences et la pédagogie active.",
        "",
        "Deux principes gouvernent tout ce que tu écris :",
        "1. Une compétence est un agir en situation. Le stagiaire construit son",
        "   savoir en faisant ; il ne le reçoit pas. Une séance où le formateur",
        "   expose et le stagiaire écoute est un échec, quelle qu'en soit la",
        "   qualité d'exposition.",
        "2. L'objectif commande. Le contenu, la méthode et le déroulement",
        "   n'existent que pour le servir — jamais l'inverse.",
        "",
        "Tu écris en français, de façon télégraphique : des lignes courtes,",
        "jamais de paragraphes.",
      ].join("\n"),
      prompt,
      temperature: 0.6,
      // Enveloppe serrée : la fiche tient largement dedans, et le modèle ne
      // peut pas déborder vers des paragraphes rédigés.
      maxTokens: 2500,
      json: true,
    });

    let brut: Partial<FicheGeneree>;
    try {
      brut = JSON.parse(contenu) as Partial<FicheGeneree>;
    } catch {
      return NextResponse.json(
        { error: "Le modèle n'a pas retourné un JSON valide." },
        { status: 502 },
      );
    }

    const phases = quatrePhases(brut.phases, minutes);

    const fiche: FicheGeneree = {
      objectifs: String(brut.objectifs ?? s.objectif_operationnel ?? "").trim(),
      methodeActive: String(brut.methodeActive ?? "").trim(),
      modalite: String(brut.modalite ?? "Synchrone présentiel").trim(),
      fichiers: String(brut.fichiers ?? "-").trim(),
      phases,
    };

    // conventions.md L.34 : la durée annoncée dans le prompt reste une
    // suggestion. On la vérifie ici — une fiche dont les durées ne tombent pas
    // sur le créneau sera refusée en commission.
    const total = phases.reduce((t, ph) => t + ph.minutes, 0);

    const avertissements: string[] = [];
    if (minutes && total !== minutes) {
      avertissements.push(
        `Les durées totalisent ${total} minutes au lieu des ${minutes} de la séance. Ajustez avant d'enregistrer.`,
      );
    }
    for (const ph of phases) {
      if (ph.instructions.length === 0) {
        avertissements.push(
          `La phase « ${definitionPhase(ph.cle).titre} » n'a aucune instruction.`,
        );
      }
    }

    // Les deux exigences du PRD §4.3 se vérifient ici plutôt que de faire
    // confiance à la consigne : un modèle qui retombe sur « comprendre les
    // principes de… » ou sur la méthode de la semaine dernière doit être vu.
    const passif = VERBES_PASSIFS.find((v) =>
      fiche.objectifs.toLowerCase().includes(v),
    );
    if (passif) {
      avertissements.push(
        `L'objectif contient « ${passif} » : formulez un agir observable en situation, pas un état mental (APC).`,
      );
    }
    if (!fiche.methodeActive) {
      avertissements.push("Aucune méthode active n'est nommée.");
    } else {
      const repetee = methodesRecentes.find((m) =>
        memeMethode(m, fiche.methodeActive),
      );
      if (repetee) {
        avertissements.push(
          `« ${fiche.methodeActive} » a déjà servi lors d'une séance récente de ce module. Variez la méthode ou régénérez.`,
        );
      }
    }

    return NextResponse.json({
      fiche,
      totalMinutes: total,
      minutesSeance: minutes,
      avertissements,
    });
  } catch (e) {
    const err = e instanceof ErreurLlm ? e : null;
    return NextResponse.json(
      { error: err?.message ?? "Échec de génération" },
      { status: err?.statut ?? 502 },
    );
  }
}
