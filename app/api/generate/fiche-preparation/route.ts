import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { moduleId } = await request.json().catch(() => ({}));

  if (!moduleId) {
    return NextResponse.json({ error: "moduleId requis" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: module, error } = await supabase
    .from("modules")
    .select("*")
    .eq("id", moduleId)
    .single();

  if (error || !module) {
    return NextResponse.json({ error: "Module introuvable" }, { status: 404 });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "DEEPSEEK_API_KEY non configurée" },
      { status: 500 },
    );
  }

  const prompt = [
    "Tu es un formateur expert du référentiel OFPPT. Rédige une fiche de préparation pédagogique complète et détaillée pour le module suivant.",
    "",
    `Nom du module : ${module.nom}`,
    `Description : ${module.description ?? "Non renseignée"}`,
    `Durée prévue : ${module.duree_reference} heures`,
    "",
    "Structure obligatoire de la réponse (en Markdown) :",
    "# Fiche de préparation — " + module.nom,
    "## Objectifs pédagogiques",
    "- (listes les objectifs mesurables)",
    "## Prérequis",
    "- (savoirs et compétences nécessaires avant la formation)",
    "## Déroulé horaire détaillé",
    "| Plage horaire | Contenu | Activité | Méthode pédagogique |",
    "|---------------|---------|----------|---------------------|",
    "| (remplir sur la durée totale) | ... | ... | ... |",
    "## Activités",
    "- (activités concrètes liées au métier)",
    "## Méthode d'évaluation",
    "- (critères et modalités d'évaluation)",
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
      temperature: 0.7,
      max_tokens: 4000,
    }),
  });

  const data = await res.json().catch(() => null);

  const text =
    data?.choices?.[0]?.message?.content ??
    data?.error?.message ??
    "Échec de génération";

  if (!data?.choices?.[0]?.message?.content) {
    return NextResponse.json({ error: text }, { status: 502 });
  }

  return NextResponse.json({ contenu: text });
}
