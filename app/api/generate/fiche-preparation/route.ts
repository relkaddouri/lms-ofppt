import { createClient } from "@/lib/supabase/server";
import { appelerLlm, chargerConfigLlm, ErreurLlm } from "@/lib/llm";
import { dureeHeures, formatHeure } from "@/lib/creneaux";
import { getElementsDeSeance } from "@/app/actions/couverture";
import { verifierQuota, QUOTA_GENERATION } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

/**
 * Aide-mémoire de séance.
 *
 * Ce que le formateur emporte en salle n'est pas un document administratif :
 * c'est un pense-bête qu'il parcourt du regard entre deux explications. Un
 * déroulé minuté ne sert personne — il ne survit pas aux dix premières minutes
 * réelles d'une séance — et sa longueur le rend inconsultable.
 */
export type BlocFiche = { contenu: string; minutes: number };
export type LigneDeveloppement = {
  strategie: string;
  contenu: string;
  minutes: number;
};

export type FicheGeneree = {
  objectifs: string;
  modalite: string;
  fichiers: string;
  motivation: BlocFiche;
  plan: BlocFiche;
  developpement: LigneDeveloppement[];
  evaluation: BlocFiche;
  prochaine: BlocFiche;
};

function bloc(v: unknown, defaut = ""): BlocFiche {
  const o = (v ?? {}) as Partial<BlocFiche>;
  return {
    contenu: String(o.contenu ?? defaut).trim(),
    minutes: Math.max(0, Math.round(Number(o.minutes) || 0)),
  };
}

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

  // Ce qui a déjà été fait avec CE groupe sur CE module : l'aide-mémoire doit
  // enchaîner, pas répéter.
  const { data: precedentes } = await supabase
    .from("seances")
    .select("date, contenu_realise, seance_groupes!inner(groupe_id)")
    .eq("seance_groupes.seance_groupes[0]!.groupe_id", s.seance_groupes[0]!.groupe_id)
    .eq("module_id", s.module_id)
    .eq("statut", "fait")
    .not("contenu_realise", "is", null)
    .order("date", { ascending: true });

  const dejaCouvert =
    (precedentes ?? [])
      .map((p) => p.contenu_realise)
      .filter(Boolean)
      .join(" ; ") || null;

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
    "Réponds UNIQUEMENT en JSON, sans markdown, avec exactement cette structure :",
    `{
  "objectifs": "ce que le stagiaire doit savoir faire à la fin, en une phrase",
  "modalite": "Synchrone présentiel",
  "fichiers": "supports nécessaires, ou -",
  "motivation": { "contenu": "l'accroche : question, situation, vidéo…", "minutes": 10 },
  "plan": { "contenu": "les points annoncés, un par ligne", "minutes": 5 },
  "developpement": [
    { "strategie": "Méthode active (learning by doing)", "contenu": "notion traitée et activité", "minutes": 50 }
  ],
  "evaluation": { "contenu": "questions de synthèse posées aux stagiaires", "minutes": 10 },
  "prochaine": { "contenu": "notions à aborder la fois suivante", "minutes": 5 }
}`,
    "",
    "Le tableau `developpement` compte 3 à 6 entrées, dans l'ordre de la séance.",
  ]
    .filter((l): l is string => l !== null)
    .join("\n");

  try {
    const config = await chargerConfigLlm(user.id);
    const contenu = await appelerLlm(config, {
      systeme:
        "Tu es un formateur expert du référentiel OFPPT. Tu écris en français, en Markdown, de façon télégraphique : des puces courtes, jamais de paragraphes.",
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

    const developpement: LigneDeveloppement[] = (
      Array.isArray(brut.developpement) ? brut.developpement : []
    )
      .map((l) => ({
        strategie: String(l?.strategie ?? "").trim(),
        contenu: String(l?.contenu ?? "").trim(),
        minutes: Math.max(0, Math.round(Number(l?.minutes) || 0)),
      }))
      .filter((l) => l.contenu);

    const fiche: FicheGeneree = {
      objectifs: String(brut.objectifs ?? s.objectif_operationnel ?? "").trim(),
      modalite: String(brut.modalite ?? "Synchrone présentiel").trim(),
      fichiers: String(brut.fichiers ?? "-").trim(),
      motivation: bloc(brut.motivation),
      plan: bloc(brut.plan),
      developpement,
      evaluation: bloc(brut.evaluation),
      prochaine: bloc(brut.prochaine),
    };

    // conventions.md L.34 : la durée annoncée dans le prompt reste une
    // suggestion. On la vérifie ici — une fiche dont les durées ne tombent pas
    // sur le créneau sera refusée en commission.
    const total =
      fiche.motivation.minutes +
      fiche.plan.minutes +
      developpement.reduce((s, l) => s + l.minutes, 0) +
      fiche.evaluation.minutes +
      fiche.prochaine.minutes;

    const avertissements: string[] = [];
    if (minutes && total !== minutes) {
      avertissements.push(
        `Les durées totalisent ${total} minutes au lieu des ${minutes} de la séance. Ajustez avant d'enregistrer.`,
      );
    }
    if (developpement.length === 0) {
      avertissements.push("Le développement est vide.");
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
