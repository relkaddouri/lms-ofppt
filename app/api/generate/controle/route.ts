import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type OptionGeneree = { texte: string; correcte: boolean };

type QuestionGeneree = {
  type: "qcm" | "ouverte" | "exercice";
  enonce: string;
  bareme: number;
  options?: OptionGeneree[];
  corrige?: string;
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

export async function POST(request: Request) {
  const { moduleId, dureeHeures, groupeId, instruction, controleExistant } =
    await request.json().catch(() => ({}));

  if (!moduleId) {
    return NextResponse.json({ error: "moduleId requis" }, { status: 400 });
  }

  const supabase = await createClient();

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

  let seancesQuery = supabase
    .from("seances")
    .select("contenu_realise")
    .eq("module_id", moduleId)
    .eq("statut", "fait");
  if (groupeId) seancesQuery = seancesQuery.eq("groupe_id", groupeId);

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

  // Raffinage : on repart du contrôle existant plutôt que d'en générer un neuf.
  const raffinage = Boolean(instruction && controleExistant);

  const prompt = [
    "Tu es un formateur expert du référentiel OFPPT. Tu rédiges un contrôle de connaissances en français.",
    "",
    `Module : ${module.nom}`,
    groupeNom ? `Groupe concerné : ${groupeNom}` : null,
    `Durée de l'évaluation : ${duree} heures.`,
    `Contenu réellement couvert en séance :`,
    `- ${contenuCouvert}`,
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
    "RÈGLE ABSOLUE — une question = une seule interrogation.",
    "Il est interdit de regrouper plusieurs sous-questions dans un même énoncé.",
    "Un énoncé ne doit JAMAIS contenir « a) ... b) ... c) ». Si tu veux poser",
    "quatre questions à choix multiple, produis QUATRE entrées distinctes dans",
    "le tableau `questions`, chacune avec son propre barème.",
    "",
    "Trois types de questions sont possibles :",
    '- "qcm" : l\'énoncé pose UNE question. Les propositions vont dans `options`,',
    "  jamais dans l'énoncé. Entre 3 et 4 propositions, dont au moins une correcte.",
    "  Plusieurs propositions correctes sont autorisées.",
    '- "ouverte" : réponse rédigée courte. Fournis `corrige`.',
    '- "exercice" : mise en application, réponse longue. Fournis `corrige`.',
    "",
    "Exigences :",
    "- Entre 8 et 14 questions, en variant les trois types.",
    "- Le barème DOIT totaliser exactement 20 points.",
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
      "corrige": "corrigé détaillé"
    }
  ]
}`,
  ]
    .filter((l): l is string => l !== null)
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
      max_tokens: 8000,
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
    let type: QuestionGeneree["type"] =
      q.type === "qcm" || q.type === "exercice" ? q.type : "ouverte";

    let options = Array.isArray(q.options)
      ? q.options
          .filter((o) => o && String(o.texte ?? "").trim())
          .map((o) => ({ texte: String(o.texte).trim(), correcte: Boolean(o.correcte) }))
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

    return {
      type,
      enonce,
      bareme: Number(q.bareme) || 0,
      options: type === "qcm" ? options : [],
      corrige:
        type === "qcm"
          ? options.filter((o) => o.correcte).map((o) => o.texte).join(" ; ")
          : String(q.corrige ?? "").trim(),
    };
  });

  // Le modèle se trompe régulièrement de quelques points sur le total. Plutôt
  // que de laisser le formateur rééquilibrer douze barèmes à la main, on répartit
  // l'écart sur les questions les plus lourdes, par demi-points, et on le dit.
  const totalBrut = questions.reduce((s, q) => s + q.bareme, 0);
  if (totalBrut !== 20 && totalBrut > 0) {
    const ordre = questions
      .map((q, i) => ({ i, bareme: q.bareme }))
      .sort((a, b) => b.bareme - a.bareme);

    let ecart = Math.round((20 - totalBrut) * 2) / 2;
    const pas = ecart > 0 ? 0.5 : -0.5;
    let garde = 0;
    while (Math.abs(ecart) >= 0.5 && garde < 400) {
      for (const { i } of ordre) {
        if (Math.abs(ecart) < 0.5) break;
        const suivant = questions[i].bareme + pas;
        if (suivant < 0.5) continue;
        questions[i].bareme = suivant;
        ecart -= pas;
      }
      garde += 1;
    }
    avertissements.push(
      `Barème rééquilibré de ${totalBrut} à ${questions.reduce((s, q) => s + q.bareme, 0)} points. Vérifiez la répartition.`,
    );
  }

  const totalBareme = questions.reduce((s, q) => s + q.bareme, 0);

  return NextResponse.json({
    titre: genere.titre,
    consignes: genere.consignes,
    questions,
    totalBareme,
    avertissements,
  });
}
