import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type GeneratedQuestion = {
  enonce: string;
  bareme: number;
  corrige: string;
};

type GeneratedControle = {
  titre: string;
  consignes: string;
  questions: GeneratedQuestion[];
};

export async function POST(request: Request) {
  const { moduleId, dureeHeures, groupeId } = await request
    .json()
    .catch(() => ({}));

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

  let seancesQuery = supabase
    .from("seances")
    .select("contenu_realise, modules(nom)")
    .eq("module_id", moduleId)
    .eq("statut", "fait");
  if (groupeId) {
    seancesQuery = seancesQuery.eq("groupe_id", groupeId);
  }

  const { data: seances } = await seancesQuery;

  const contenuCouvert =
    (seances ?? [])
      .map((s) => s.contenu_realise)
      .filter(Boolean)
      .join("\n- ") || "Non renseigné (aucune séance marquée comme faite)";

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "DEEPSEEK_API_KEY non configurée" },
      { status: 500 },
    );
  }

  const prompt = [
    "Tu es un formateur expert du référentiel OFPPT. Rédige un contrôle de connaissances en français pour le module suivant, en te basant UNIQUEMENT sur le contenu réellement couvert en séance pour le groupe concerné.",
    "",
    `Module : ${module.nom}`,
    groupeNom ? `Groupe concerné : ${groupeNom}` : null,
    `Durée de l'évaluation : ${duree} heures.`,
    `Contenu couvert en séances (groupe ${groupeNom ?? "tous groupes confondus"}) :`,
    `- ${contenuCouvert}`,
    "",
    "Exigences :",
    "- 6 à 10 questions variées (QCM, questions courtes, exercice d'application).",
    "- Le barème des questions DOIT totaliser exactement 20 points.",
    "- Chaque question inclut un corrigé détaillé.",
    "- Inclure des consignes claires pour le stagiaire.",
    "",
    "Réponds UNIQUEMENT en JSON avec la structure suivante (sans commentaire, sans markdown) :",
    `{
      "titre": "Contrôle — {nom du module}",
      "consignes": "texte des consignes",
      "questions": [
        { "enonce": "texte de la question", "bareme": 4, "corrige": "corrigé détaillé" }
      ]
    }`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

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
      response_format: { type: "json_object" },
    }),
  });

  const data = await res.json().catch(() => null);
  const text = data?.choices?.[0]?.message?.content;

  if (!text) {
    return NextResponse.json(
      { error: data?.error?.message ?? "Échec de génération" },
      { status: 502 },
    );
  }

  let generated: GeneratedControle;
  try {
    generated = JSON.parse(text) as GeneratedControle;
    if (!Array.isArray(generated.questions)) throw new Error("mauvaise structure");
  } catch {
    return NextResponse.json(
      { error: "Le modèle n'a pas retourné un JSON valide." },
      { status: 502 },
    );
  }

  const total = generated.questions.reduce((sum, q) => sum + (Number(q.bareme) || 0), 0);

  return NextResponse.json({ ...generated, totalBareme: total });
}
