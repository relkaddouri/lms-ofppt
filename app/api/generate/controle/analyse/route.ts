import { createClient } from "@/lib/supabase/server";
import { appelerLlm, chargerConfigLlm, ErreurLlm } from "@/lib/llm";
import { verifierQuota, QUOTA_GENERATION } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { instantEtablissement } from "@/lib/format";
import { normaliserIntitule } from "@/lib/remplissage";
import {
  reponsesAnonymes,
  statistiquesCopies,
  type CopiePourAnalyse,
  type EtatComprehension,
  type LectureAnalyse,
  type QuestionPourAnalyse,
} from "@/lib/analyse-comprehension";

/**
 * L'analyse de compréhension d'un contrôle (PRD §4.7bis, atome 10.6).
 *
 * Trois temps. Les chiffres se calculent sur les copies corrigées. Le modèle
 * lit ensuite les réponses — sous pseudonyme, les noms retirés même des
 * commentaires — avec les notions des séances évaluées et les séances à venir,
 * et dit ce qu'il comprend de la classe. Tout est enregistré : l'écran du
 * formateur relit une analyse, il ne la recalcule pas.
 */

const ETATS: EtatComprehension[] = ["acquis", "fragile", "non_acquis"];
const etat = (v: unknown, defaut: EtatComprehension): EtatComprehension =>
  ETATS.includes(v as EtatComprehension) ? (v as EtatComprehension) : defaut;
const texte = (v: unknown, max = 1200) => String(v ?? "").trim().slice(0, max);

/** La première valeur non vide parmi plusieurs clés : les modèles varient leurs noms de champs. */
const champ = (o: Record<string, unknown>, ...cles: string[]) => {
  for (const c of cles) {
    const v = o[c];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return undefined;
};

/**
 * « D », « stagiaire d », « Stagiaire D (25 %) » → « Stagiaire D ».
 *
 * Le modèle abrège parfois le pseudonyme ; le rejeter vidait la liste des
 * stagiaires à accompagner alors que l'analyse les avait bien lus.
 */
function pseudoNormalise(v: unknown): string {
  const t = String(v ?? "").trim();
  const m = t.match(/^(?:stagiaire\s+)?([A-Z]{1,2})(?![A-Za-z])/i);
  return m ? `Stagiaire ${m[1]!.toUpperCase()}` : t;
}

export async function POST(request: Request) {
  const { controleId } = await request.json().catch(() => ({}));
  if (!controleId) {
    return NextResponse.json({ error: "controleId requis" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }

  const quota = verifierQuota(`analyse-controle:${user.id}`, QUOTA_GENERATION);
  if (quota) return quota;

  // Tout se lit avec le client de l'utilisateur : la politique du contrôle
  // décide, un stagiaire ne lit ni les copies des autres ni les corrigés.
  const { data: controle } = await supabase
    .from("controles")
    .select("id, titre, type, groupe_id, module_id, seance_ids, modules(nom)")
    .eq("id", controleId)
    .maybeSingle();
  if (!controle) {
    return NextResponse.json({ error: "Contrôle introuvable" }, { status: 404 });
  }

  const [questionsRes, copiesRes] = await Promise.all([
    supabase
      .from("questions_controle")
      .select("id, type, enonce, bareme, corrige, position")
      .eq("controle_id", controleId)
      .order("position"),
    supabase
      .from("passations_controle")
      .select("nom_complet, note, responses, stagiaires(est_test)")
      .eq("controle_id", controleId)
      .not("note", "is", null),
  ]);
  if (questionsRes.error || copiesRes.error) {
    return NextResponse.json(
      { error: questionsRes.error?.message ?? copiesRes.error?.message },
      { status: 500 },
    );
  }

  const questions: QuestionPourAnalyse[] = (questionsRes.data ?? []).map((q) => ({
    id: q.id,
    type: q.type ?? "ouverte",
    enonce: q.enonce ?? "",
    bareme: Number(q.bareme) || 0,
    corrige: q.corrige,
  }));
  // La copie du compte de test du formateur n'est pas celle d'un stagiaire :
  // elle fausserait les chiffres de la classe (migration 093).
  const copies: CopiePourAnalyse[] = (copiesRes.data ?? [])
    .filter((p) => !(p.stagiaires as { est_test: boolean } | null)?.est_test)
    .map((p) => ({
    nom: p.nom_complet,
    details: (Array.isArray(p.responses) ? p.responses : []) as CopiePourAnalyse["details"],
  }));

  if (questions.length === 0) {
    return NextResponse.json({ error: "Ce contrôle n'a aucune question." }, { status: 400 });
  }
  if (copies.length === 0) {
    return NextResponse.json(
      { error: "Aucune copie corrigée : l'analyse porte sur des réponses réelles." },
      { status: 400 },
    );
  }

  const { statistiques, pseudonymes } = statistiquesCopies(questions, copies);

  // ── Les notions des séances évaluées, et les séances où reprendre ───────
  const aujourdhui = instantEtablissement().date;
  const seanceIds = (controle.seance_ids ?? []) as string[];
  const [evalueesRes, aVenirRes] = await Promise.all([
    seanceIds.length
      ? supabase
          .from("seances")
          .select("id, date, objectif_operationnel, seance_elements_contenu(elements_contenu(intitule))")
          .in("id", seanceIds)
          .order("date")
      : Promise.resolve({ data: [] as never[] }),
    supabase
      .from("seances")
      .select("id, date, heure_debut, statut, nature, objectif_operationnel, contenu_prevu, seance_groupes!inner(groupe_id)")
      .eq("module_id", controle.module_id)
      .eq("seance_groupes.groupe_id", controle.groupe_id)
      .gte("date", aujourdhui)
      .neq("statut", "fait")
      .order("date")
      .limit(8),
  ]);

  type SeanceNotions = {
    date: string | null;
    objectif_operationnel: string | null;
    seance_elements_contenu: { elements_contenu: { intitule: string | null } | null }[];
  };
  const notions = [
    ...new Set(
      ((evalueesRes.data ?? []) as unknown as SeanceNotions[]).flatMap((s) =>
        (s.seance_elements_contenu ?? [])
          .map((l) => l.elements_contenu?.intitule?.trim())
          .filter((t): t is string => Boolean(t)),
      ),
    ),
  ];
  const aVenir = ((aVenirRes.data ?? []) as {
    date: string | null;
    nature: string | null;
    objectif_operationnel: string | null;
    contenu_prevu: string | null;
  }[]).filter((s) => s.date);

  const faits = [
    `Copies corrigées : ${statistiques.nbCopies}. Barème : ${statistiques.total} points.`,
    `Moyenne : ${statistiques.moyenne} / ${statistiques.total} ; médiane : ${statistiques.mediane}.`,
    `Répartition : ${statistiques.repartition.moins40} sous 40 %, ${statistiques.repartition.de40a60} entre 40 et 60 %, ${statistiques.repartition.de60a80} entre 60 et 80 %, ${statistiques.repartition.plus80} au-dessus de 80 %.`,
    "Par question (taux = points obtenus / points possibles ; réussite = copies à la moitié des points ou plus) :",
    ...statistiques.questions.map(
      (q) =>
        `- Question ${q.numero} (${q.type}, ${q.bareme} pts) : taux ${q.taux} %, réussite ${q.reussite} %, ${q.vides} sans réponse → ${q.etat}.`,
    ),
    "Par stagiaire :",
    ...statistiques.stagiaires.map(
      (s) =>
        `- ${s.pseudo} : ${s.taux} %${s.echecs.length ? `, sous la moitié aux questions ${s.echecs.join(", ")}` : ""}.`,
    ),
  ].join("\n");

  const prompt = [
    `Module : ${(controle.modules as { nom: string } | null)?.nom ?? "—"}`,
    `Contrôle : ${controle.titre ?? "—"}${controle.type === "TEST" ? " (contrôle de test formatif)" : ""}`,
    "",
    "## Faits calculés sur les copies (exacts, ne les recalcule pas)",
    faits,
    "",
    notions.length
      ? `## Notions du référentiel traitées dans les séances évaluées\n- ${notions.join("\n- ")}`
      : "## Notions\nNon renseignées : déduis les notions des énoncés.",
    "",
    aVenir.length
      ? `## Séances à venir de ce groupe sur ce module\n${aVenir
          .map(
            (s) =>
              `- ${s.date} (${s.nature ?? "séance"}) : ${
                s.objectif_operationnel
                  ? normaliserIntitule(s.objectif_operationnel)
                  : (s.contenu_prevu ?? "contenu non renseigné").slice(0, 160)
              }`,
          )
          .join("\n")}`
      : "## Séances à venir\nAucune séance planifiée : propose les ajustements sans date (seance = null).",
    "",
    "## Réponses des stagiaires (pseudonymes ; points et commentaire de correction)",
    reponsesAnonymes(questions, copies, pseudonymes),
    "",
    "## Ce que tu produis",
    "Tu es un formateur expérimenté de l'OFPPT qui lit les copies de sa classe pour",
    "savoir ce qu'elle a compris. Tu écris en français, pour le formateur, concrètement.",
    "",
    "- `niveau` : `appreciation` en quelques mots (ex. « Bases acquises, application",
    "  fragile ») et `resume` en 3 à 4 phrases fondées sur les faits.",
    "- `questions` : une entrée par question. `etat` reprend l'état calculé sauf si",
    "  les réponses montrent clairement autre chose. `erreurs_frequentes` : les",
    "  erreurs ou confusions qui REVIENNENT dans plusieurs copies, formulées",
    "  précisément (« confond persona et utilisateur réel »), jamais une paraphrase",
    "  de l'énoncé ; liste vide si rien ne revient. `lecture` : ce que cela révèle",
    "  de la compréhension, en une ou deux phrases.",
    "- `notions` : l'état de chaque notion évaluée, avec les numéros des questions",
    "  qui la mesurent. Utilise l'intitulé exact de la liste quand il existe.",
    "- `stagiaires` : UNIQUEMENT les pseudonymes suivants, ceux sous 50 % :",
    `  ${statistiques.aAccompagner.length ? statistiques.aAccompagner.join(", ") : "aucun — tableau vide"}.`,
    "  Pour chacun : `constat` (ce qui bloque, d'après ses réponses) et",
    "  `accompagnement` (ce que le formateur peut faire, précisément). Dans",
    "  `constat`, ne répète ni pourcentage ni liste de numéros de questions : ils",
    "  sont affichés à côté, calculés ; décris ce que ses réponses montrent.",
    "- `ajustements` : 2 à 5 actions pour la classe, les plus utiles d'abord :",
    "  `action` (quoi faire en séance), `pourquoi` (quel constat), `seance` (la date",
    "  YYYY-MM-DD d'une séance à venir de la liste, la plus pertinente, ou null),",
    "  `duree_minutes` (temps réaliste).",
    "",
    "N'invente aucun chiffre, aucun nom, aucune réponse. Ne cite jamais un",
    "stagiaire par autre chose que son pseudonyme.",
    "",
    "Réponds uniquement en JSON, exactement sous cette forme :",
    JSON.stringify(
      {
        niveau: { appreciation: "…", resume: "…" },
        questions: [
          { numero: 1, etat: "fragile", erreurs_frequentes: ["…"], lecture: "…" },
        ],
        notions: [
          { notion: notions[0] ?? "intitulé de la notion", etat: "non_acquis", questions: [1, 2], constat: "…" },
        ],
        stagiaires: [
          { pseudo: statistiques.aAccompagner[0] ?? "Stagiaire C", constat: "…", accompagnement: "…" },
        ],
        ajustements: [
          { action: "…", pourquoi: "…", seance: aVenir[0]?.date ?? null, duree_minutes: 30 },
        ],
      },
      null,
      1,
    ),
    "`etat` vaut toujours \"acquis\", \"fragile\" ou \"non_acquis\". `notions` et `stagiaires` ne",
    "sont vides que s'il n'y a vraiment rien à dire.",
  ].join("\n");

  let brut: string;
  let modele: string | null = null;
  try {
    const config = await chargerConfigLlm(user.id);
    modele = config.modele;
    brut = await appelerLlm(config, {
      systeme:
        "Tu es un formateur expert du référentiel OFPPT. Tu analyses les copies d'une classe pour ajuster ton enseignement. Tu réponds en JSON valide.",
      prompt,
      temperature: 0.3,
      json: true,
    });
  } catch (e) {
    const err = e instanceof ErreurLlm ? e : null;
    return NextResponse.json(
      { error: err?.message ?? "Échec de l'analyse" },
      { status: err?.statut ?? 502 },
    );
  }

  let lu: Partial<Record<keyof LectureAnalyse, unknown>>;
  try {
    lu = JSON.parse(brut);
  } catch {
    return NextResponse.json(
      { error: "Le modèle n'a pas retourné un JSON valide. Relancez l'analyse." },
      { status: 502 },
    );
  }

  // ── Validation : on ne garde que ce qui tient ────────────────────────────
  const numeros = new Set(statistiques.questions.map((q) => q.numero));
  const autorises = new Set(statistiques.aAccompagner);
  const datesAVenir = new Set(aVenir.map((s) => s.date));
  const tableau = (v: unknown) => (Array.isArray(v) ? v : []) as Record<string, unknown>[];
  const niveau = (lu.niveau ?? {}) as Record<string, unknown>;

  const lecture: LectureAnalyse = {
    niveau: {
      appreciation: texte(niveau.appreciation, 120),
      resume: texte(niveau.resume, 1500),
    },
    questions: statistiques.questions.map((q) => {
      const l = tableau(lu.questions).find((x) => Number(x.numero) === q.numero) ?? {};
      return {
        numero: q.numero,
        etat: etat(l.etat, q.etat),
        erreurs_frequentes: (Array.isArray(l.erreurs_frequentes) ? l.erreurs_frequentes : [])
          .map((e) => texte(e, 300))
          .filter(Boolean)
          .slice(0, 6),
        lecture: texte(l.lecture, 600),
      };
    }),
    notions: (Array.isArray(lu.notions) ? lu.notions : [])
      .map((brut) => {
        const n = (typeof brut === "string" ? { notion: brut } : brut ?? {}) as Record<string, unknown>;
        const qs = champ(n, "questions", "numeros", "questions_liees");
        return {
          notion: texte(champ(n, "notion", "intitule", "nom", "titre"), 300),
          etat: etat(champ(n, "etat", "état", "statut"), "fragile"),
          questions: (Array.isArray(qs) ? qs : [])
            .map((x) => Number(String(x).replace(/\D/g, "")))
            .filter((x) => numeros.has(x)),
          constat: texte(champ(n, "constat", "commentaire", "lecture", "analyse"), 600),
        };
      })
      .filter((n) => n.notion)
      .slice(0, 20),
    // Un pseudonyme inventé, ou un stagiaire qui n'est pas en difficulté,
    // n'entre pas : le formateur ne doit pas chercher un « Stagiaire Q » qui
    // n'existe pas.
    stagiaires: tableau(lu.stagiaires)
      .map((s) => ({
        pseudo: pseudoNormalise(champ(s, "pseudo", "pseudonyme", "stagiaire", "nom")),
        constat: texte(champ(s, "constat", "difficultes", "analyse"), 600),
        accompagnement: texte(champ(s, "accompagnement", "action", "remediation"), 600),
      }))
      .filter((s) => autorises.has(s.pseudo)),
    ajustements: tableau(lu.ajustements)
      .map((a) => {
        const seance = texte(a.seance, 10);
        const duree = Math.round(Number(a.duree_minutes));
        return {
          action: texte(a.action, 400),
          pourquoi: texte(a.pourquoi, 500),
          seance: datesAVenir.has(seance) ? seance : null,
          duree_minutes: duree > 0 && duree <= 600 ? duree : null,
        };
      })
      .filter((a) => a.action)
      .slice(0, 6),
  };

  const { data: enregistree, error: errIns } = await supabase
    .from("analyses_controle")
    .insert({
      controle_id: controleId,
      nb_copies: statistiques.nbCopies,
      statistiques: statistiques as never,
      lecture: lecture as never,
      pseudonymes: pseudonymes as never,
      modele,
    })
    .select("id, created_at")
    .single();
  if (errIns) {
    return NextResponse.json({ error: errIns.message }, { status: 500 });
  }

  return NextResponse.json({ id: enregistree.id });
}
