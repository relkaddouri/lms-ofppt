import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { questionId, reponse } = await request.json().catch(() => ({}));

  if (!questionId || typeof reponse !== "string") {
    return NextResponse.json(
      { error: "questionId et reponse requis" },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  const { data: q, error } = await supabase
    .from("questions_controle")
    .select("enonce, bareme, corrige")
    .eq("id", questionId)
    .single();

  if (error || !q) {
    return NextResponse.json({ error: "Question introuvable" }, { status: 404 });
  }

  const bareme = Number(q.bareme) || 0;

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "DEEPSEEK_API_KEY non configurée" },
      { status: 500 },
    );
  }

  const prompt = [
    "Tu es un correcteur expert OFPPT. Évalue la réponse d'un stagiaire à une question d'un contrôle.",
    "",
    `Énoncé : ${q.enonce}`,
    `Barème : ${bareme} pts`,
    `Corrigé de référence : ${q.corrige ?? "Non renseigné"}`,
    `Réponse du stagiaire : ${reponse.trim() || "(vide)"}`,
    "",
    "Attribue des points entre 0 et le barème, arrondis au demi-point près.",
    "Si la réponse correspond au corrigé (identique ou très proche), attribue la totalité des points.",
    "Réponds UNIQUEMENT en JSON (sans markdown) avec la structure :",
    `{"points": X, "commentaire": "justification courte en français"}`,
  ].join("\n");

  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-reasoner",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
    }),
  });

  const data = await res.json().catch(() => null);
  const text = data?.choices?.[0]?.message?.content;

  if (!text) {
    return NextResponse.json(
      { error: data?.error?.message ?? "Échec de la correction" },
      { status: 502 },
    );
  }

  let parsed: { points?: number; commentaire?: string };
  try {
    parsed = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { error: "Le modèle n'a pas retourné un JSON valide." },
      { status: 502 },
    );
  }

  const points = Math.min(Math.max(Number(parsed.points) || 0, 0), bareme);

  return NextResponse.json({
    points,
    bareme,
    commentaire: parsed.commentaire ?? "",
  });
}
