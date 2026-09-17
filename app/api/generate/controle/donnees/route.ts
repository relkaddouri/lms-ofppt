import { createClient } from "@/lib/supabase/server";
import { appelerLlm, chargerConfigLlm, ErreurLlm } from "@/lib/llm";
import { verifierQuota, QUOTA_GENERATION } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { alertesQuestion } from "@/lib/verification-questions";

/**
 * Les données d'une seule question, écrites par le modèle (PRD §4.7bis).
 *
 * Le formateur relit une question — souvent un exercice ajouté à la main, ou
 * signalé « renvoie à une annexe » — et demande le matériau qui lui manque.
 * On ne régénère pas tout le contrôle pour cela : on envoie la question, le
 * module, et l'on reçoit des données prêtes à l'emploi, plus un énoncé retouché
 * seulement s'il renvoyait à une pièce absente.
 */
export async function POST(request: Request) {
  const { moduleId, type, enonce, donnees, corrige, consigne } = await request
    .json()
    .catch(() => ({}));

  if (!moduleId || typeof enonce !== "string" || !enonce.trim()) {
    return NextResponse.json(
      { error: "Écrivez d'abord l'énoncé : les données en dépendent." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Authentification requise" },
      { status: 401 },
    );
  }

  const quota = verifierQuota(`generate-controle:${user.id}`, QUOTA_GENERATION);
  if (quota) return quota;

  const { data: module } = await supabase
    .from("modules")
    .select("nom, description")
    .eq("id", moduleId)
    .single();
  if (!module) {
    return NextResponse.json({ error: "Module introuvable" }, { status: 404 });
  }

  const prompt = [
    `Module : ${module.nom}`,
    module.description ? `Description du module : ${module.description}` : null,
    "",
    `Type de question : ${type ?? "exercice"}`,
    "Énoncé actuel :",
    enonce.trim(),
    typeof donnees === "string" && donnees.trim()
      ? `\nDonnées actuelles, à remplacer :\n${donnees.trim()}`
      : null,
    typeof corrige === "string" && corrige.trim()
      ? `\nRéponse attendue par le formateur (les données doivent permettre d'y arriver) :\n${corrige.trim()}`
      : null,
    typeof consigne === "string" && consigne.trim()
      ? `\nDemande du formateur : ${consigne.trim()}`
      : null,
    "",
    "Écris les DONNÉES dont le stagiaire a besoin pour traiter cette question :",
    "observations d'utilisateurs, verbatims, tableau de relevés, extrait de cahier",
    "des charges ou cas d'entreprise — ce qui convient à l'énoncé.",
    "- Réalistes, situées au Maroc quand un contexte s'y prête, en quantité",
    "  suffisante pour que la question soit faisable (six à dix observations, ou un",
    "  tableau de plusieurs lignes), sans rendre la réponse évidente.",
    "- En Markdown : listes numérotées, tableaux (| … |), titres courts en gras.",
    "- Les données seulement : aucune consigne, aucune question, aucune solution.",
    "- Jamais de renvoi à une annexe, un document ou un fichier.",
    "",
    "Si l'énoncé renvoie à une pièce absente (annexe, document fourni, corpus",
    "joint…), réécris-le pour qu'il s'appuie sur « les données ci-dessous », sans",
    "rien changer d'autre. Sinon, laisse `enonce` vide.",
    "",
    'Réponds uniquement en JSON : { "donnees": "…", "enonce": "" }',
  ]
    .filter((l): l is string => l !== null)
    .join("\n");

  let texte: string;
  try {
    const config = await chargerConfigLlm(user.id);
    texte = await appelerLlm(config, {
      systeme:
        "Tu es un formateur expert du référentiel OFPPT. Tu prépares le matériau d'une évaluation, en français.",
      prompt,
      temperature: 0.7,
      json: true,
    });
  } catch (e) {
    const err = e instanceof ErreurLlm ? e : null;
    return NextResponse.json(
      { error: err?.message ?? "Échec de génération" },
      { status: err?.statut ?? 502 },
    );
  }

  let lu: { donnees?: unknown; enonce?: unknown };
  try {
    lu = JSON.parse(texte);
  } catch {
    return NextResponse.json(
      { error: "Le modèle n'a pas retourné un JSON valide." },
      { status: 502 },
    );
  }

  const nouvellesDonnees = String(lu.donnees ?? "").trim();
  if (!nouvellesDonnees) {
    return NextResponse.json(
      { error: "Le modèle n'a pas produit de données. Réessayez." },
      { status: 502 },
    );
  }
  const nouvelEnonce = String(lu.enonce ?? "").trim() || null;

  return NextResponse.json({
    donnees: nouvellesDonnees.slice(0, 20000),
    enonce: nouvelEnonce,
    alertes: alertesQuestion({
      type: String(type ?? "exercice"),
      enonce: nouvelEnonce ?? enonce,
      donnees: nouvellesDonnees,
    }),
  });
}
