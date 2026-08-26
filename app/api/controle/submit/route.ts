import { createServiceClient } from "@/lib/supabase/service";
import { appelerLlm, chargerConfigLlm, ErreurLlm } from "@/lib/llm";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

const FENETRE_MS = 60_000;
// Volontairement large : en fin d'épreuve, toute une classe soumet sa copie
// depuis le même réseau, donc derrière une seule IP publique (NAT). Une limite
// serrée par IP bloquerait des copies légitimes. 20/min reste très au-dessus du
// rythme réel d'une classe tout en coupant net une boucle d'abus.
const LIMITE_PAR_IP = 20;
// Un même stagiaire n'a aucune raison de relancer la correction plus de
// quelques fois : c'est le garde-fou qui protège réellement le crédit IA.
const LIMITE_PAR_CANDIDAT = 3;

type OptionNotation = { texte: string; correcte?: boolean };

type QuestionPourNotation = {
  id: string;
  type: "qcm" | "ouverte" | "exercice" | null;
  enonce: string;
  bareme: number;
  options: OptionNotation[] | null;
  corrige: string;
};

const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * Note un QCM sans appeler de modèle : les bonnes réponses sont connues, la
 * comparaison est exacte. Tout ou rien — cocher une mauvaise proposition ou en
 * oublier une bonne annule les points, ce qui est la règle usuelle d'un QCM à
 * réponses multiples.
 */
function noterQcm(q: QuestionPourNotation, reponse: string, bareme: number) {
  const attendues = new Set(
    (q.options ?? []).filter((o) => o.correcte).map((o) => norm(o.texte)),
  );
  const cochees = new Set(
    reponse
      .split("\n")
      .map(norm)
      .filter((s) => s !== ""),
  );

  if (attendues.size === 0) {
    return { points: 0, commentaire: "Aucune bonne réponse définie pour ce QCM." };
  }

  const exact =
    cochees.size === attendues.size && [...attendues].every((a) => cochees.has(a));
  const nbBonnes = [...cochees].filter((c) => attendues.has(c)).length;
  const nbFausses = cochees.size - nbBonnes;

  return {
    points: exact ? bareme : 0,
    commentaire: exact
      ? "Toutes les bonnes propositions sont cochées."
      : cochees.size === 0
        ? "Aucune proposition cochée."
        : `${nbBonnes} bonne(s) proposition(s) sur ${attendues.size}` +
          (nbFausses > 0 ? `, ${nbFausses} proposition(s) erronée(s).` : "."),
  };
}

type ControlePublic = {
  id: string;
  titre: string | null;
};

type ScoreEntry = {
  question: string;
  points: number;
  commentaire: string;
};

export async function POST(request: Request) {
  const { token, nom, email, reponses } = await request.json().catch(() => ({}));

  if (!token || !nom || !reponses) {
    return NextResponse.json(
      { error: "token, nom et reponses requis" },
      { status: 400 },
    );
  }

  // Avant toute requête base ou appel IA : la route est publique et chaque
  // passage coûte un appel DeepSeek facturé.
  const ip = clientIp(request);

  const parIp = rateLimit(`submit:ip:${ip}`, LIMITE_PAR_IP, FENETRE_MS);
  if (!parIp.allowed) return tooManyRequests(parIp.retryAfterSeconds);

  const parCandidat = rateLimit(
    `submit:candidat:${token}:${String(nom).trim().toLowerCase()}`,
    LIMITE_PAR_CANDIDAT,
    FENETRE_MS,
  );
  if (!parCandidat.allowed) return tooManyRequests(parCandidat.retryAfterSeconds);

  let supabase;
  try {
    supabase = createServiceClient();
  } catch {
    return NextResponse.json(
      { error: "Correction indisponible : configuration serveur incomplète." },
      { status: 500 },
    );
  }

  const { data: controleRaw, error: errControle } = await supabase
    .rpc("get_controle_by_token", { p_token: token })
    .single();

  const controle = (controleRaw ?? null) as ControlePublic | null;

  if (errControle || !controle) {
    return NextResponse.json({ error: "Contrôle introuvable" }, { status: 404 });
  }

  const { data: questionsRes, error: errQuestions } = await supabase.rpc(
    "get_questions_with_corrige_for_scoring",
    { p_token: token },
  );

  if (errQuestions) {
    console.error("get_questions_with_corrige_for_scoring:", errQuestions.message);
    return NextResponse.json(
      { error: "Impossible de charger le contrôle." },
      { status: 500 },
    );
  }

  const questions = (questionsRes ?? []) as QuestionPourNotation[];
  if (!questions.length) {
    return NextResponse.json({ error: "Aucune question" }, { status: 400 });
  }

  const reponsesRecues = (reponses ?? {}) as Record<string, string>;

  // Les QCM sont notés ici, sans appel payant. Seul ce qui demande un jugement
  // part au modèle — un contrôle entièrement en QCM se corrige donc hors ligne,
  // sans clé API et sans coût.
  const aJuger = questions.filter((q) => q.type !== "qcm");

  const prompt = [
    "Tu es un correcteur expert OFPPT. Corrige le contrôle d'un stagiaire.",
    "",
    `Stagiaire : ${nom}`,
    "Pour chaque question, attribue des points sur le barème indiqué, en comparant la réponse du stagiaire au corrigé. Sois strict mais juste.",
    "",
    "Questions :",
    ...aJuger.map((q) => {
      const label = `q${questions.indexOf(q) + 1}`;
      const reponse = reponsesRecues[q.id] ?? "";
      return [
        `${label}. Énoncé : ${q.enonce}`,
        `   Barème : ${q.bareme} pts`,
        `   Corrigé : ${q.corrige}`,
        `   Réponse du stagiaire : ${reponse || "(vide)"}`,
      ].join("\n");
    }),
    "",
    "Réponds UNIQUEMENT en JSON (sans markdown) avec la structure :",
    `{"scores":[{"question":"q1","points":X,"commentaire":"courte justification"}]}`,
    "",
    "Règles :",
    '- La clé "question" doit être exactement le libellé de la question (q1, q2, ...).',
    "- Si la réponse du stagiaire correspond au corrigé (identique ou très proche), attribue la totalité des points.",
    "- Points entre 0 et le barème de la question, arrondi au demi-point près.",
  ].join("\n");

  let scores: ScoreEntry[] = [];
  if (aJuger.length > 0) {
    const { data: formateurId } = await supabase.rpc(
      "get_formateur_by_controle_token",
      { p_token: token },
    );
    if (!formateurId) {
      return NextResponse.json(
        { error: "Correction indisponible : contrôle sans formateur rattaché." },
        { status: 500 },
      );
    }

    let text: string;
    try {
      const config = await chargerConfigLlm(formateurId as unknown as string);
      text = await appelerLlm(config, {
        systeme: "Tu es un correcteur expert du référentiel OFPPT.",
        prompt,
        // Une note doit être reproductible d'une copie à l'autre.
        temperature: 0,
        maxTokens: 4000,
        json: true,
      });
    } catch (e) {
      const err = e instanceof ErreurLlm ? e : null;
      return NextResponse.json(
        { error: err?.message ?? "Échec de correction" },
        { status: err?.statut ?? 502 },
      );
    }

    try {
      const parsed = JSON.parse(text) as { scores: ScoreEntry[] };
      scores = parsed.scores ?? [];
    } catch {
      return NextResponse.json(
        { error: "Le modèle n'a pas retourné un JSON valide." },
        { status: 502 },
      );
    }
  }

  const scoreMap = new Map(scores.map((s) => [s.question, s]));

  // Points proposés par l'IA. Ils ne font pas foi : `submit_passation` les rogne
  // sur le barème réel lu en base et recalcule la note elle-même.
  const details = questions.map((q, i) => {
    const bareme = Number(q.bareme) || 0;
    const reponse = reponsesRecues[q.id] ?? "";

    if (q.type === "qcm") {
      const { points, commentaire } = noterQcm(q, reponse, bareme);
      return { question_id: q.id, points, commentaire, reponse };
    }

    const label = `q${i + 1}`;
    const score = scoreMap.get(label) ?? scoreMap.get(String(i + 1));
    const identique =
      reponse.trim() !== "" &&
      q.corrige != null &&
      norm(reponse) === norm(q.corrige);
    const points = identique
      ? bareme
      : Math.min(Math.max(Number(score?.points) || 0, 0), bareme);
    return {
      question_id: q.id,
      points,
      commentaire: identique
        ? "Réponse conforme au corrigé."
        : score?.commentaire ?? "",
      reponse,
    };
  });

  const { data: passation, error: errSubmit } = await supabase.rpc(
    "submit_passation",
    {
      p_token: token,
      p_responses: { nom, email: email ?? null, details },
    },
  );

  if (errSubmit || !passation) {
    console.error("submit_passation:", errSubmit?.message);
    return NextResponse.json(
      { error: "Enregistrement de la copie impossible." },
      { status: 500 },
    );
  }

  return NextResponse.json(passation);
}
