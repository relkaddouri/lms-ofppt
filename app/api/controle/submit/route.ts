import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

type QuestionPourNotation = {
  id: string;
  enonce: string;
  bareme: number;
  corrige: string;
};

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

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "DEEPSEEK_API_KEY non configurée" },
      { status: 500 },
    );
  }

  const prompt = [
    "Tu es un correcteur expert OFPPT. Corrige le contrôle d'un stagiaire.",
    "",
    `Stagiaire : ${nom}`,
    "Pour chaque question, attribue des points sur le barème indiqué, en comparant la réponse du stagiaire au corrigé. Sois strict mais juste.",
    "",
    "Questions :",
    ...questions.map((q, i) => {
      const label = `q${i + 1}`;
      const reponse = (reponses as Record<string, string>)[q.id] ?? "";
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

  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    }),
  });

  const data = await res.json().catch(() => null);
  const text = data?.choices?.[0]?.message?.content;

  if (!text) {
    return NextResponse.json(
      { error: data?.error?.message ?? "Échec de correction" },
      { status: 502 },
    );
  }

  let scores: ScoreEntry[];
  try {
    const parsed = JSON.parse(text) as { scores: ScoreEntry[] };
    scores = parsed.scores;
  } catch {
    return NextResponse.json(
      { error: "Le modèle n'a pas retourné un JSON valide." },
      { status: 502 },
    );
  }

  const scoreMap = new Map(scores.map((s) => [s.question, s]));

  // Points proposés par l'IA. Ils ne font pas foi : `submit_passation` les rogne
  // sur le barème réel lu en base et recalcule la note elle-même.
  const details = questions.map((q, i) => {
    const label = `q${i + 1}`;
    const score = scoreMap.get(label) ?? scoreMap.get(String(i + 1));
    const bareme = Number(q.bareme) || 0;
    const reponse = (reponses as Record<string, string>)[q.id] ?? "";
    const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
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
