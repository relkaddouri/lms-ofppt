import { createClient } from "@/lib/supabase/server";
import { appelerLlm, chargerConfigLlm, ErreurLlm } from "@/lib/llm";
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
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

  try {
    const config = await chargerConfigLlm(user.id);
    const contenu = await appelerLlm(config, {
      systeme:
        "Tu es un formateur expert du référentiel OFPPT. Tu rédiges en français, en Markdown.",
      prompt,
      temperature: 0.7,
      maxTokens: 4000,
    });
    return NextResponse.json({ contenu });
  } catch (e) {
    const err = e instanceof ErreurLlm ? e : null;
    return NextResponse.json(
      { error: err?.message ?? "Échec de génération" },
      { status: err?.statut ?? 502 },
    );
  }
}
