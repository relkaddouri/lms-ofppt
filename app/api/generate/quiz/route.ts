import { createClient, getUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { appelerLlm, chargerConfigLlm, ErreurLlm } from "@/lib/llm";
import { verifierQuota, QUOTA_GENERATION } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import {
  NB_QUESTIONS_QUIZ,
  questionsValides,
  texteDuSupport,
  type QuestionQuiz,
} from "@/lib/quiz";
import type { Support } from "@/lib/support";

/**
 * Le quiz d'auto-évaluation d'un chapitre (PRD §4.5bis).
 *
 * Écrit une fois à partir du support, puis servi tel quel : deux stagiaires du
 * même groupe doivent réviser sur les mêmes questions, et une génération par
 * ouverture coûterait un appel de modèle à chaque lecture.
 *
 * L'appel est facturé au formateur propriétaire du module — comme la
 * correction d'une copie (§4.7) : c'est son cours, sa clé. Le stagiaire ne
 * fournit rien, et n'écrit pas le quiz lui-même : l'insertion passe par la clé
 * de service, après vérification de son accès au chapitre.
 */

type Reponse = { questions: QuestionQuiz[]; modele: string | null; genereLe: string };

export async function POST(request: Request) {
  const { supportId, regenerer } = await request.json().catch(() => ({}));
  if (!supportId) {
    return NextResponse.json({ error: "supportId requis" }, { status: 400 });
  }

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }

  // Lecture sous l'identité de l'appelant : les politiques décident s'il a
  // accès à ce chapitre — stagiaire du groupe, ou formateur de la séance.
  const supabase = await createClient();
  const { data: support, error } = await supabase
    .from("supports_seance")
    .select("id, seance_id, contenu, seances(module_id, seance_groupes(groupe_id))")
    .eq("id", supportId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!support) {
    return NextResponse.json({ error: "Chapitre introuvable" }, { status: 404 });
  }

  const { data: existant } = await supabase
    .from("quiz_chapitre")
    .select("questions, modele, genere_le")
    .eq("support_id", supportId)
    .maybeSingle();

  if (existant && !regenerer) {
    return NextResponse.json({
      questions: existant.questions as unknown as QuestionQuiz[],
      modele: existant.modele,
      genereLe: existant.genere_le,
    } satisfies Reponse);
  }

  // Un quiz par chapitre, donc une génération rare : le quota protège surtout
  // d'un clic répété sur « Régénérer ».
  const quota = verifierQuota(`quiz:${user.id}`, QUOTA_GENERATION);
  if (quota) return quota;

  const service = createServiceClient();
  const groupes = (
    (support.seances as { seance_groupes: { groupe_id: string }[] } | null)
      ?.seance_groupes ?? []
  ).map((g) => g.groupe_id);

  const { data: groupe } = await service
    .from("groupes")
    .select("formateur_id")
    .in("id", groupes.length ? groupes : ["00000000-0000-0000-0000-000000000000"])
    .not("formateur_id", "is", null)
    .limit(1)
    .maybeSingle();

  const proprietaire = (groupe?.formateur_id as string | null) ?? null;
  if (!proprietaire) {
    return NextResponse.json(
      { error: "Quiz indisponible : ce cours n'est rattaché à aucun formateur." },
      { status: 500 },
    );
  }

  const contenu = support.contenu as unknown as Support;
  const prompt = [
    "Tu prépares un quiz d'auto-évaluation pour des stagiaires de l'OFPPT, à partir",
    "de leur cours. Ils l'utilisent pour réviser : il n'est pas noté.",
    "",
    "## Le cours",
    texteDuSupport(contenu).slice(0, 20_000),
    "",
    "## Ce que tu produis",
    `- ${NB_QUESTIONS_QUIZ} questions à choix multiple, en français, dans l'ordre du cours.`,
    "- Chaque question porte sur une notion RÉELLEMENT présente dans le cours",
    "  ci-dessus : jamais de culture générale, jamais une notion d'un autre chapitre.",
    "- Trois ou quatre propositions, une seule juste, les autres plausibles —",
    "  des erreurs qu'un stagiaire ferait vraiment, pas des absurdités.",
    "- `bonne` est l'index de la proposition juste, à partir de 0.",
    "- `explication` dit pourquoi elle est juste, en une ou deux phrases, en",
    "  s'appuyant sur le cours ; elle se lit après coup, même quand on a bon.",
    "- Varie : définition, application, distinction entre deux notions proches.",
    "- Pas de question sur l'organisation de la séance, la date ou le formateur.",
    "",
    "Réponds uniquement en JSON, exactement sous cette forme :",
    JSON.stringify(
      {
        questions: [
          {
            question: "…",
            propositions: ["…", "…", "…"],
            bonne: 0,
            explication: "…",
          },
        ],
      },
      null,
      1,
    ),
  ].join("\n");

  let brut: string;
  let modele: string | null = null;
  try {
    const config = await chargerConfigLlm(proprietaire);
    modele = config.modele;
    brut = await appelerLlm(config, {
      systeme:
        "Tu es un formateur du référentiel OFPPT. Tu écris des quiz de révision en français, fidèles au cours donné. Tu réponds en JSON valide.",
      prompt,
      temperature: 0.4,
      json: true,
    });
  } catch (e) {
    const err = e instanceof ErreurLlm ? e : null;
    return NextResponse.json(
      { error: err?.message ?? "Quiz indisponible pour l'instant." },
      { status: err?.statut ?? 502 },
    );
  }

  let questions: QuestionQuiz[];
  try {
    const lu = JSON.parse(brut) as { questions?: unknown };
    questions = questionsValides(lu.questions);
  } catch {
    return NextResponse.json(
      { error: "Le modèle n'a pas retourné un JSON valide. Réessayez." },
      { status: 502 },
    );
  }

  if (questions.length < 3) {
    return NextResponse.json(
      { error: "Le quiz n'a pas pu être écrit à partir de ce chapitre. Réessayez." },
      { status: 502 },
    );
  }

  const genereLe = new Date().toISOString();
  const { error: errEcriture } = await service.from("quiz_chapitre").upsert(
    {
      support_id: supportId,
      questions: questions as never,
      modele,
      genere_le: genereLe,
    },
    { onConflict: "support_id" },
  );
  if (errEcriture) {
    return NextResponse.json({ error: errEcriture.message }, { status: 500 });
  }

  return NextResponse.json({ questions, modele, genereLe } satisfies Reponse);
}
