import { createClient } from "@/lib/supabase/server";
import { appelerLlm, chargerConfigLlm, ErreurLlm } from "@/lib/llm";
import { verifierQuota, QUOTA_GENERATION } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { baremeAttendu, socleAccessible } from "@/lib/controles";
import {
  alertesQuestion,
  sansNotesOrganisation,
} from "@/lib/verification-questions";
import { normaliserIntitule } from "@/lib/remplissage";

type OptionGeneree = { texte: string; correcte: boolean };

type QuestionGeneree = {
  type: "qcm" | "ouverte" | "exercice";
  enonce: string;
  /** Le matériau de la question — observations, tableau —, en Markdown. */
  donnees?: string;
  bareme: number;
  options?: OptionGeneree[];
  corrige?: string;
  /** Place dans la courbe de difficulté (PRD §4.7). */
  difficulte?: "accessible" | "discriminant";
  /** Pourquoi ce barème correspond à cette difficulté. */
  justification_bareme?: string;
};

type ControleGenere = {
  titre: string;
  consignes: string;
  questions: QuestionGeneree[];
};

/** Repère un énoncé qui contient encore plusieurs sous-questions. */
function contientSousQuestions(enonce: string) {
  const marqueurs = enonce.match(/\b[a-d]\)\s/gi) ?? [];
  return marqueurs.length >= 2;
}

/** Repère un énoncé de QCM qui embarque encore ses propositions. */
function contientPropositions(enonce: string) {
  return (enonce.match(/\b[1-4][.)]\s/g) ?? []).length >= 3;
}

/**
 * Ce que le format attendu impose à la génération.
 *
 * Le formateur choisit « théorique », « pratique » ou « mixte » dans l'éditeur :
 * cette nature doit gouverner les questions produites, pas rester une étiquette
 * décorative posée à côté d'un contrôle qui l'ignore.
 */
const CONSIGNES_FORMAT = {
  theorique: {
    libelle: "théorique",
    types: ["qcm", "ouverte"] as const,
    consigne: [
      "Ce contrôle est THÉORIQUE : il évalue des connaissances et de la",
      'compréhension. N\'utilise que les types "qcm" et "ouverte".',
      "N'écris aucune mise en situation ni exercice de production : pas de",
      "livrable à produire, pas de cas pratique à traiter.",
    ],
  },
  pratique: {
    libelle: "pratique",
    types: ["exercice"] as const,
    consigne: [
      "Ce contrôle est PRATIQUE : il évalue un savoir-faire. N'utilise que le",
      'type "exercice". Chaque question est une mise en situation',
      "professionnelle concrète demandant de produire quelque chose (un",
      "livrable, une analyse appliquée, une démarche à dérouler) à partir d'un",
      "contexte que tu fournis dans l'énoncé.",
      "N'écris aucune question de restitution de cours ni aucun QCM.",
    ],
  },
  mixte: {
    libelle: "théorique et pratique",
    types: ["qcm", "ouverte", "exercice"] as const,
    consigne: [
      "Ce contrôle est THÉORIQUE ET PRATIQUE : il combine les deux. Commence",
      'par les questions de connaissances ("qcm" et "ouverte"), puis termine',
      'par au moins deux mises en situation de type "exercice".',
      "Environ la moitié du barème doit porter sur la partie pratique.",
    ],
  },
} as const;

type FormatControle = keyof typeof CONSIGNES_FORMAT;

function formatValide(v: unknown): FormatControle {
  return typeof v === "string" && v in CONSIGNES_FORMAT
    ? (v as FormatControle)
    : "theorique";
}

export async function POST(request: Request) {
  const {
    moduleId,
    dureeHeures,
    groupeId,
    instruction,
    controleExistant,
    format: formatRecu,
    type: typeRecu,
    seanceIds,
    baremeTotal,
  } = await request.json().catch(() => ({}));

  const format = formatValide(formatRecu);
  const regles = CONSIGNES_FORMAT[format];
  const estEfm = typeRecu === "EFM";
  // Un contrôle de test (PRD §4.7bis) : formatif, sur des séances choisies,
  // barème libre.
  const estTest = typeRecu === "TEST";
  const typeBareme = estEfm ? "EFM" : estTest ? "TEST" : "CC";
  // PRD §4.7 : un CC se barème sur 20, un EFM sur 40. Le total n'est pas une
  // constante — demander 20 au modèle pour un EFM produisait un barème faux,
  // que le rattrapage ci-dessous ramenait ensuite vers la mauvaise valeur.
  const totalAttendu = baremeAttendu(typeBareme, Number(baremeTotal) || null);
  // §4.7 : le socle que toute la classe doit pouvoir atteindre — 60 % du
  // total, soit 12/20 ou 24/40 — porté par des questions accessibles ; le
  // reste distingue les meilleurs.
  const socle = socleAccessible(typeBareme, Number(baremeTotal) || null);

  if (!moduleId) {
    return NextResponse.json({ error: "moduleId requis" }, { status: 400 });
  }

  const supabase = await createClient();

  // La configuration du modèle est propre à chaque formateur : il faut savoir
  // qui appelle avant de pouvoir déchiffrer sa clé.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Authentification requise" },
      { status: 401 },
    );
  }

  // Chaque appel est facturé sur la clé du formateur : on borne le rythme.
  const quota = verifierQuota(`generate-controle:${user.id}`, QUOTA_GENERATION);
  if (quota) return quota;

  const { data: module, error } = await supabase
    .from("modules")
    .select("nom, description, duree_reference")
    .eq("id", moduleId)
    .single();

  if (error || !module) {
    return NextResponse.json({ error: "Module introuvable" }, { status: 404 });
  }

  let groupeNom: string | null = null;
  if (groupeId) {
    const { data: groupe } = await supabase
      .from("groupes")
      .select("nom")
      .eq("id", groupeId)
      .single();
    if (groupe) groupeNom = groupe.nom;
  }

  const duree = Number(dureeHeures) || 2;

  // Un contrôle continu porte sur ce qui a été fait à ce jour ; une épreuve de
  // fin de module porte sur le module entier, y compris ce qui reste à faire.
  let seancesQuery = supabase
    .from("seances")
    .select(
      "id, date, contenu_realise, contenu_prevu, objectif_operationnel, statut, seance_groupes!inner(groupe_id), seance_elements_contenu(elements_contenu(intitule))",
    )
    .eq("module_id", moduleId)
    .order("date");
  // Un test porte sur les séances choisies, faites ou non ; un CC, sur ce qui
  // a été fait.
  if (!estEfm && !estTest) seancesQuery = seancesQuery.eq("statut", "fait");
  if (estTest && !(Array.isArray(seanceIds) && seanceIds.length > 0)) {
    return NextResponse.json(
      { error: "Un contrôle de test porte sur des séances choisies : cochez-en au moins une." },
      { status: 400 },
    );
  }
  if (groupeId) {
    seancesQuery = seancesQuery.eq("seance_groupes.groupe_id", groupeId);
  }
  // Le formateur peut avoir écarté des séances à l'étape « Contenu couvert » :
  // une séance décochée ne doit pas ressortir dans les questions.
  if (Array.isArray(seanceIds) && seanceIds.length > 0) {
    seancesQuery = seancesQuery.in("id", seanceIds);
  }

  const { data: seances } = await seancesQuery;

  // ── Ce que le contrôle évalue ─────────────────────────────────────────────
  //
  // D'abord les notions du référentiel rattachées aux séances : c'est ce qui a
  // été enseigné, écrit par l'OFPPT et non par le formateur au fil de l'eau.
  // Ensuite ce que le formateur a noté de la séance, comme complément — filtré
  // des notes d'organisation qu'il y glisse parfois. Un sujet de M202 portait
  // une question tirée mot pour mot de l'une d'elles.
  type SeanceLue = {
    statut: string;
    contenu_realise: string | null;
    contenu_prevu: string | null;
    objectif_operationnel: string | null;
    seance_elements_contenu: {
      elements_contenu: { intitule: string | null } | null;
    }[];
  };
  const lues = (seances ?? []) as unknown as SeanceLue[];

  const notions = [
    ...new Set(
      lues.flatMap((s) =>
        (s.seance_elements_contenu ?? [])
          .map((l) => l.elements_contenu?.intitule?.trim())
          .filter((t): t is string => Boolean(t)),
      ),
    ),
  ];
  const objectifs = [
    ...new Set(
      lues
        .map((s) => s.objectif_operationnel)
        .filter((t): t is string => Boolean(t))
        .flatMap((t) => normaliserIntitule(t).split(" · "))
        .map((t) => t.replace(/ — (th[ée]orique|pratique)$/, "")),
    ),
  ];
  const travaille = lues
    .map((s) =>
      sansNotesOrganisation(
        (s.statut === "fait" ? s.contenu_realise : s.contenu_prevu) ?? "",
      ),
    )
    .filter(Boolean);

  const contenuCouvert =
    [
      objectifs.length > 0
        ? `Objectifs du référentiel traités :\n- ${objectifs.join("\n- ")}`
        : null,
      notions.length > 0
        ? `Notions du référentiel à évaluer (base du contrôle) :\n- ${notions.join("\n- ")}`
        : null,
      travaille.length > 0
        ? `Ce qui a été travaillé en séance (complément, formulé par le formateur) :\n- ${travaille.join("\n- ")}`
        : null,
    ]
      .filter(Boolean)
      .join("\n\n") ||
    (estEfm
      ? "Non renseigné (aucune séance planifiée sur ce module)"
      : "Non renseigné (aucune séance marquée comme faite)");

  // Raffinage : on repart du contrôle existant plutôt que d'en générer un neuf.
  const raffinage = Boolean(instruction && controleExistant);

  const prompt = [
    "Tu es un formateur expert du référentiel OFPPT. Tu rédiges un contrôle de connaissances en français.",
    "",
    `Module : ${module.nom}`,
    groupeNom ? `Groupe concerné : ${groupeNom}` : null,
    `Durée de l'évaluation : ${duree} heures.`,
    `Nature de l'épreuve : ${
      estEfm
        ? "épreuve de fin de module (EFM)"
        : estTest
          ? "contrôle de test formatif, qui ne compte pas dans la note : il sert à vérifier ce que la classe a compris des séances choisies"
          : "contrôle continu (CC)"
    }, ${regles.libelle}.`,
    "Contenu réellement couvert :",
    contenuCouvert,
    "",
    raffinage
      ? [
          "Voici le contrôle actuel, au format JSON :",
          JSON.stringify(controleExistant),
          "",
          "Applique la demande suivante en conservant tout le reste à l'identique :",
          instruction,
        ].join("\n")
      : "Rédige le contrôle en te basant UNIQUEMENT sur le contenu couvert ci-dessus.",
    "",
    "RÈGLE ABSOLUE — un sujet se suffit à lui-même.",
    "Le stagiaire passe ce contrôle en ligne et ne dispose de RIEN d'autre que ce",
    "que tu écris. Un énoncé ne renvoie JAMAIS à une annexe, un document fourni,",
    "un corpus joint, un fichier, un support distribué ou une séance.",
    "Quand une question a besoin de matériau — observations d'utilisateurs,",
    "verbatims, tableau de données, extrait de cahier des charges, cas d'entreprise —",
    "tu l'ÉCRIS toi-même dans le champ `donnees`, complet et exploitable : des",
    "données réalistes, en quantité suffisante pour que l'exercice soit faisable",
    "(par exemple six à dix observations, ou un tableau de plusieurs lignes). Mets",
    "en forme en Markdown : listes numérotées ou tableaux. L'énoncé dit ce qu'il",
    "faut faire de ces données ; `donnees` contient les données, sans consigne.",
    "Tout \"exercice\" a des `donnees`, sauf s'il s'appuie uniquement sur une",
    "situation déjà entièrement décrite dans son énoncé.",
    "",
    "RÈGLE ABSOLUE — on évalue des notions, pas l'organisation.",
    "Les questions portent sur les notions et savoir-faire du module. Il est",
    "interdit de poser une question sur le déroulement des séances, le programme",
    "de l'année, les objectifs d'une heure de cours, un rattrapage ou tout autre",
    "propos d'organisation, même s'il apparaît dans le contenu fourni.",
    "",
    "RÈGLE ABSOLUE — une question = une seule interrogation.",
    "Il est interdit de regrouper plusieurs sous-questions dans un même énoncé.",
    "Un énoncé ne doit JAMAIS contenir « a) ... b) ... c) ». Si tu veux poser",
    "quatre questions à choix multiple, produis QUATRE entrées distinctes dans",
    "le tableau `questions`, chacune avec son propre barème.",
    "",
    ...regles.consigne,
    "",
    "Types de questions :",
    '- "qcm" : l\'énoncé pose UNE question. Les propositions vont dans `options`,',
    "  jamais dans l'énoncé. Entre 3 et 4 propositions, dont au moins une correcte.",
    "  Plusieurs propositions correctes sont autorisées.",
    '- "ouverte" : réponse rédigée courte. Fournis `corrige`.',
    '- "exercice" : mise en application, réponse longue. Fournis `corrige` et `donnees`.',
    "",
    "Exigences :",
    format === "pratique"
      ? "- Entre 3 et 6 mises en situation, de difficulté croissante."
      : "- Entre 8 et 14 questions, en variant les types autorisés.",
    `- N'utilise que ces types : ${regles.types.map((t) => `"${t}"`).join(", ")}.`,
    `- Le barème DOIT totaliser exactement ${totalAttendu} points.`,
    "",
    "Calibration du barème — deux règles non négociables :",
    "1. Le nombre de points d'une question suit sa difficulté réelle. Une",
    "   restitution directe vaut peu (1 à 2 points) ; une question de",
    "   raisonnement à plusieurs étapes, mobilisant plusieurs notions, vaut",
    "   nettement plus (5 à 8 points). Un barème ne se choisit jamais pour",
    "   tomber sur le total : il se choisit pour la question, et c'est la",
    "   répartition d'ensemble qui tombe juste.",
    "   Pour CHAQUE question, renseigne `justification_bareme` : une phrase",
    "   qui dit pourquoi ce nombre de points correspond à cette difficulté.",
    "2. Répartis les questions sur deux niveaux, dans le champ `difficulte` :",
    `   - "accessible" : le socle. Ces questions doivent totaliser environ`,
    `     ${socle} points sur ${totalAttendu}, soit 60 % — c'est ce que toute la`,
    "     classe doit pouvoir obtenir en ayant suivi le module. Questions",
    "     fondamentales, sans piège.",
    `   - "discriminant" : les ${totalAttendu - socle} points restants, soit 40 %.`,
    "     Ces questions distinguent les meilleurs stagiaires. Elles ne servent",
    "     PAS à faire échouer la majorité de la classe.",
    "   Un contrôle de difficulté homogène, ou dont la répartition est",
    "   aléatoire, est un contrôle raté.",
    "- Des consignes claires et brèves pour le stagiaire.",
    "",
    "Réponds UNIQUEMENT en JSON, sans markdown, avec exactement cette structure :",
    `{
  "titre": "Contrôle — {nom du module}",
  "consignes": "texte des consignes",
  "questions": [
    {
      "type": "qcm",
      "enonce": "Qu'est-ce que l'UX Design ?",
      "bareme": 1,
      "difficulte": "accessible",
      "justification_bareme": "Restitution directe d'une définition vue en cours : 1 point.",
      "options": [
        { "texte": "La conception de l'interface graphique", "correcte": false },
        { "texte": "La qualité de l'interaction entre l'utilisateur et le produit", "correcte": true },
        { "texte": "La programmation d'un site web", "correcte": false }
      ]
    },
    {
      "type": "ouverte",
      "enonce": "Définissez ce qu'est un persona et à quoi il sert.",
      "bareme": 3,
      "difficulte": "accessible",
      "justification_bareme": "Définition plus une mise en contexte : deux éléments attendus, 3 points.",
      "corrige": "corrigé détaillé"
    },
    {
      "type": "exercice",
      "enonce": "À partir des observations ci-dessous, regroupez les utilisateurs en types convergents et nommez les critères retenus.",
      "donnees": "1. Karim, 34 ans, réserve chaque lundi à 7 h depuis son téléphone…\n2. …",
      "bareme": 6,
      "difficulte": "discriminant",
      "justification_bareme": "Analyse de données, regroupement et justification : plusieurs étapes, 6 points.",
      "corrige": "corrigé détaillé"
    }
  ]
}`,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");

  let text: string;
  try {
    const config = await chargerConfigLlm(user.id);
    text = await appelerLlm(config, {
      systeme:
        "Tu es un formateur expert du référentiel OFPPT. Tu rédiges des évaluations en français.",
      prompt,
      temperature: 0.7,
      json: true,
    });
  } catch (e) {
    const err = e instanceof ErreurLlm ? e : null;
    return NextResponse.json(
      { error: err?.message ?? "Échec de génération" },
      { status: err?.statut ?? 502 },
    );
  }

  let genere: ControleGenere;
  try {
    genere = JSON.parse(text) as ControleGenere;
    if (!Array.isArray(genere.questions)) throw new Error("mauvaise structure");
  } catch {
    return NextResponse.json(
      { error: "Le modèle n'a pas retourné un JSON valide." },
      { status: 502 },
    );
  }

  // Normalisation et contrôle qualité : le formateur doit pouvoir se contenter
  // de relire, pas de réparer la structure à la main.
  const avertissements: string[] = [];

  const questions = genere.questions.map((q, i) => {
    const enonce = String(q.enonce ?? "").trim();
    const donnees = String(q.donnees ?? "").trim() || null;
    let type: QuestionGeneree["type"] =
      q.type === "qcm" || q.type === "exercice" ? q.type : "ouverte";

    let options = Array.isArray(q.options)
      ? q.options
          .filter((o) => o && String(o.texte ?? "").trim())
          .map((o) => ({
            texte: String(o.texte).trim(),
            correcte: Boolean(o.correcte),
          }))
      : [];

    if (type === "qcm" && options.length < 2) {
      type = "ouverte";
      options = [];
      avertissements.push(
        `Question ${i + 1} : annoncée en QCM mais sans propositions exploitables, convertie en question ouverte.`,
      );
    }
    if (type === "qcm" && !options.some((o) => o.correcte)) {
      avertissements.push(
        `Question ${i + 1} : aucune proposition n'est marquée correcte, à vérifier.`,
      );
    }
    if (contientSousQuestions(enonce)) {
      avertissements.push(
        `Question ${i + 1} : l'énoncé semble contenir plusieurs sous-questions (a, b, c). À scinder.`,
      );
    }
    if (type === "qcm" && contientPropositions(enonce)) {
      avertissements.push(
        `Question ${i + 1} : les propositions semblent encore écrites dans l'énoncé.`,
      );
    }
    // Le type produit est signalé, jamais réécrit d'office : convertir un
    // exercice en question ouverte changerait le sens de l'énoncé, ce qui n'est
    // pas à la main de la validation.
    if (!(regles.types as readonly string[]).includes(type)) {
      avertissements.push(
        `Question ${i + 1} : de type « ${type} », inattendu pour un contrôle ${regles.libelle}.`,
      );
    }

    const difficulte =
      q.difficulte === "accessible" || q.difficulte === "discriminant"
        ? q.difficulte
        : null;
    if (!difficulte) {
      avertissements.push(
        `Question ${i + 1} : le niveau de difficulté n'est pas renseigné, à classer à la relecture.`,
      );
    }

    // Les alertes vivent avec la question : le formateur les lit sous
    // l'énoncé concerné, pas dans une liste en tête d'écran à rapprocher.
    // L'éditeur les recalcule à la frappe ; une copie ici dans les
    // avertissements resterait affichée après la correction.
    const alertes = alertesQuestion({ type, enonce, donnees });

    return {
      type,
      enonce,
      donnees,
      alertes,
      bareme: Number(q.bareme) || 0,
      difficulte,
      justification_bareme: String(q.justification_bareme ?? "").trim() || null,
      options: type === "qcm" ? options : [],
      corrige:
        type === "qcm"
          ? options
              .filter((o) => o.correcte)
              .map((o) => o.texte)
              .join(" ; ")
          : String(q.corrige ?? "").trim(),
    };
  });

  // Le modèle se trompe régulièrement de quelques points sur le total. Plutôt
  // que de laisser le formateur rééquilibrer douze barèmes à la main, on répartit
  // l'écart sur les questions les plus lourdes, par demi-points, et on le dit.
  const totalBrut = questions.reduce((s, q) => s + q.bareme, 0);
  if (totalBrut !== totalAttendu && totalBrut > 0) {
    const ordre = questions
      .map((q, i) => ({ i, bareme: q.bareme }))
      .sort((a, b) => b.bareme - a.bareme);

    let ecart = Math.round((totalAttendu - totalBrut) * 2) / 2;
    const pas = ecart > 0 ? 0.5 : -0.5;
    const retouchees = new Set<number>();
    let garde = 0;
    while (Math.abs(ecart) >= 0.5 && garde < 400) {
      for (const { i } of ordre) {
        if (Math.abs(ecart) < 0.5) break;
        const suivant = questions[i].bareme + pas;
        if (suivant < 0.5) continue;
        questions[i].bareme = suivant;
        retouchees.add(i);
        ecart -= pas;
      }
      garde += 1;
    }
    // Une justification qui annonce « 1 point » sous une question qui en vaut
    // maintenant 1,5 est pire qu'une absence de justification : elle se retire
    // avec le barème qu'elle expliquait.
    for (const i of retouchees) questions[i].justification_bareme = null;
    avertissements.push(
      `Barème rééquilibré de ${totalBrut} à ${questions.reduce((s, q) => s + q.bareme, 0)} points. Vérifiez la répartition.`,
    );
  }

  const totalBareme = questions.reduce((s, q) => s + q.bareme, 0);

  // §4.7 : le socle doit peser environ 60 % du total. On ne corrige pas la
  // répartition — la difficulté d'une question ne se réécrit pas depuis un
  // calcul — mais on la signale quand elle s'en écarte nettement.
  const pointsAccessibles = questions
    .filter((q) => q.difficulte === "accessible")
    .reduce((s, q) => s + q.bareme, 0);
  if (
    totalBareme > 0 &&
    Math.abs(pointsAccessibles - socle) > totalAttendu * 0.1
  ) {
    avertissements.push(
      `Socle accessible : ${pointsAccessibles} points sur ${totalBareme}, attendu autour de ${socle}. Rééquilibrez la difficulté avant de valider.`,
    );
  }

  return NextResponse.json({
    titre: genere.titre,
    consignes: genere.consignes,
    questions,
    totalBareme,
    pointsAccessibles,
    socleAttendu: socle,
    avertissements,
  });
}
