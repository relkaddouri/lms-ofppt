import { createClient } from "@/lib/supabase/server";
import { appelerLlm, chargerConfigLlm, ErreurLlm } from "@/lib/llm";
import { dureeHeures, formatHeure } from "@/lib/creneaux";
import { NextResponse } from "next/server";

/**
 * Aide-mémoire de séance.
 *
 * Ce que le formateur emporte en salle n'est pas un document administratif :
 * c'est un pense-bête qu'il parcourt du regard entre deux explications. Un
 * déroulé minuté ne sert personne — il ne survit pas aux dix premières minutes
 * réelles d'une séance — et sa longueur le rend inconsultable.
 */
const MOTS_MAX = 400;

function compterMots(texte: string): number {
  return texte.trim().split(/\s+/).filter(Boolean).length;
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

  // La séance porte tout le contexte utile : sa durée réelle, son objectif, le
  // groupe concerné et le module dont elle relève.
  const { data: seance, error: errSeance } = await supabase
    .from("seances")
    .select(
      "id, date, heure_debut, heure_fin, duree_realisee, objectif_operationnel, contenu_prevu, groupe_id, module_id, groupes(nom), modules(nom, description, duree_reference, competence_id)",
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
    groupe_id: string;
    module_id: string;
    groupes: { nom: string } | null;
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
    .select("date, contenu_realise")
    .eq("groupe_id", s.groupe_id)
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

  const prompt = [
    `Séance à préparer : ${s.date ?? "date à définir"}`,
    s.heure_debut && s.heure_fin
      ? `Créneau : ${formatHeure(s.heure_debut)} – ${formatHeure(s.heure_fin)} (${duree} h)`
      : duree
        ? `Durée : ${duree} h`
        : "Durée non renseignée.",
    `Groupe : ${s.groupes?.nom ?? "—"}`,
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
    referentiel.length
      ? ["Référentiel officiel de la compétence :", ...referentiel].join("\n")
      : "Le référentiel de cette compétence n'est pas encore saisi.",
    contexte ? `\nContexte de réalisation : ${contexte}` : null,
    criteresGeneraux ? `Critères généraux : ${criteresGeneraux}` : null,
    "",
    "─────",
    "",
    "Rédige un AIDE-MÉMOIRE que le formateur parcourt du regard pendant la",
    "séance. Ce n'est pas un document administratif.",
    "",
    "INTERDIT — ne produis jamais :",
    "- un déroulé minuté ou un tableau horaire, sous quelque forme que ce soit ;",
    "- des phrases développées ou des paragraphes rédigés ;",
    "- une section « Objectifs pédagogiques » recopiant l'objectif ci-dessus ;",
    "- du remplissage : mieux vaut trois lignes justes que dix approximatives.",
    "",
    `LONGUEUR : ${MOTS_MAX} mots maximum, tout compris. C'est une contrainte`,
    "stricte : un aide-mémoire trop long ne se consulte pas.",
    "",
    "Appuie-toi sur le référentiel ci-dessus et enchaîne sur ce qui a déjà été",
    "traité — ne le répète pas.",
    "",
    "Structure exacte, en Markdown, sans rien ajouter autour :",
    "",
    "## Idées clés",
    "- (3 à 5 puces, une idée par puce, formulées comme on les dirait à voix haute)",
    "",
    "## Mots-clés",
    "- (le vocabulaire à faire passer, en une seule ligne séparée par des virgules)",
    "",
    "## Exemples concrets",
    "- (2 à 3 exemples du métier visé, nommés, pas décrits)",
    "",
    "## Points de vigilance",
    "- (2 à 3 erreurs ou confusions fréquentes des stagiaires sur ce sujet)",
    "",
    "## Pour la prochaine fois",
    "- (une ligne : ce qu'il restera à couvrir)",
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
      // Une enveloppe serrée : 400 mots tiennent largement dedans, et le
      // modèle ne peut pas déborder vers un texte développé.
      maxTokens: 1200,
    });

    // conventions.md L.34 : une limite annoncée dans le prompt reste une
    // suggestion. On la mesure côté serveur et on le dit au formateur.
    const mots = compterMots(contenu);
    return NextResponse.json({
      contenu,
      mots,
      avertissement:
        mots > MOTS_MAX
          ? `L'aide-mémoire fait ${mots} mots au lieu des ${MOTS_MAX} visés. Élaguez avant d'enregistrer.`
          : null,
    });
  } catch (e) {
    const err = e instanceof ErreurLlm ? e : null;
    return NextResponse.json(
      { error: err?.message ?? "Échec de génération" },
      { status: err?.statut ?? 502 },
    );
  }
}
