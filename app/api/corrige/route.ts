import { createClient } from "@/lib/supabase/server";
import { appelerLlm, chargerConfigLlm, ErreurLlm } from "@/lib/llm";
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
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

  let text: string;
  try {
    const config = await chargerConfigLlm(user.id);
    text = await appelerLlm(config, {
      systeme: "Tu es un correcteur expert du référentiel OFPPT.",
      prompt,
      // Une note doit être reproductible : la correction impose sa propre
      // température basse, quel que soit le réglage du formateur.
      temperature: 0,
      maxTokens: 2000,
      json: true,
    });
  } catch (e) {
    const err = e instanceof ErreurLlm ? e : null;
    return NextResponse.json(
      { error: err?.message ?? "Échec de la correction" },
      { status: err?.statut ?? 502 },
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
