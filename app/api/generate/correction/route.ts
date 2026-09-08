import { createClient } from "@/lib/supabase/server";
import { appelerLlm, chargerConfigLlm, ErreurLlm } from "@/lib/llm";
import { verifierQuota, QUOTA_GENERATION } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { sourceContenu } from "@/app/actions/partage";
import { lireCorrection } from "@/lib/correction";
import type { SupportPratique } from "@/lib/support";

/**
 * Proposition de correction d'un travail pratique (PRD §4.4).
 *
 * Elle se génère à partir de l'énoncé réellement remis aux stagiaires, jamais
 * du référentiel seul : corriger, c'est comparer une production à ce qui a été
 * demandé, et ce qui a été demandé est dans le support.
 *
 * Le PRD la veut disponible « au moment où il marque la séance correspondante
 * comme terminée — pas générée à l'avance ». La base le refuse déjà à
 * l'écriture ; on le refuse aussi ici, pour ne pas facturer un appel qui
 * échouera à l'enregistrement.
 */
export async function POST(request: Request) {
  const { seanceId } = await request.json().catch(() => ({}));
  if (!seanceId) {
    return NextResponse.json({ error: "seanceId requis" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }

  const quota = verifierQuota(`generate-correction:${user.id}`, QUOTA_GENERATION);
  if (quota) return quota;

  const { data: seance } = await supabase
    .from("seances")
    .select(
      "id, statut, nature, objectif_operationnel, modules(nom), seance_groupes!inner(groupes(nom))",
    )
    .eq("id", seanceId)
    .maybeSingle();

  if (!seance) {
    return NextResponse.json({ error: "Séance introuvable" }, { status: 404 });
  }

  const s = seance as unknown as {
    statut: string;
    nature: "theorique" | "pratique" | null;
    objectif_operationnel: string | null;
    modules: { nom: string } | null;
    seance_groupes: { groupes: { nom: string } | null }[];
  };

  if (s.nature !== "pratique") {
    return NextResponse.json(
      { error: "Cette séance n'est pas un travail pratique." },
      { status: 409 },
    );
  }
  if (s.statut !== "fait") {
    return NextResponse.json(
      {
        error:
          "La correction ne se prépare qu'une fois la séance faite : les stagiaires doivent avoir cherché avant qu'un corrigé existe.",
      },
      { status: 409 },
    );
  }

  // L'énoncé, tel qu'il a été remis — celui de la séance source quand la
  // séance est un miroir (§4.3bis).
  const source = await sourceContenu(seanceId);
  const { data: supportRow } = await supabase
    .from("supports_seance")
    .select("contenu")
    .eq("seance_id", source)
    .eq("type", "pratique")
    .eq("destinataire", "stagiaire")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const enonce = supportRow?.contenu as SupportPratique | undefined;
  if (!enonce || !Array.isArray(enonce.consignes) || enonce.consignes.length === 0) {
    return NextResponse.json(
      {
        error:
          "Aucun énoncé de TP n'est enregistré pour cette séance : il n'y a rien à corriger.",
      },
      { status: 409 },
    );
  }

  const prompt = [
    `Module : ${s.modules?.nom ?? "—"}`,
    `Groupe : ${s.seance_groupes[0]?.groupes?.nom ?? "—"}`,
    "",
    "ÉNONCÉ REMIS AUX STAGIAIRES — c'est à cela qu'on compare leurs rendus,",
    "et à rien d'autre :",
    `  Titre : ${enonce.titre}`,
    `  Contexte : ${enonce.contexte}`,
    `  Objectif : ${enonce.objectif}`,
    "  Consignes :",
    ...enonce.consignes.map((c, i) => `    ${i + 1}. ${c}`),
    `  Livrable : ${enonce.livrable}`,
    "  Critères annoncés et leurs points :",
    ...(enonce.criteres ?? []).map((c) => `    — ${c.critere} : ${c.points} pts`),
    "",
    "─────",
    "",
    "Rédige la PROPOSITION DE CORRECTION de ce TP, pour le formateur.",
    "",
    "Ce n'est pas un corrigé unique : un travail de conception admet",
    "plusieurs bonnes réponses. Décris ce qu'une production correcte montre,",
    "pas la seule production que tu écrirais.",
    "",
    "Reprends les critères de l'énoncé tels quels, avec leurs points — ne les",
    "renomme pas, n'en ajoute pas, n'en retire pas : le stagiaire a été noté",
    "sur ceux-là. Pour chacun, dis ce qui vaut le total et ce qui coûte des",
    "points.",
    "",
    "Les erreurs que tu annonces sont celles qu'un formateur voit vraiment",
    "revenir sur ce genre de travail, avec la façon de les reprendre — pas",
    "une liste de fautes théoriques.",
    "",
    "Réponds UNIQUEMENT en JSON, sans markdown :",
    `{
  "proposition": "une production complète décrite en quelques phrases : la référence à laquelle comparer",
  "etapes": [
    {
      "consigne": "la consigne de l'énoncé, recopiée",
      "attendu": ["ce qu'une production correcte montre à cette étape"],
      "erreurs": ["l'erreur fréquente — et comment la reprendre"]
    }
  ],
  "criteres": [
    { "critere": "le critère de l'énoncé, tel quel", "points": 5, "bareme": "ce qui vaut 5, ce qui coûte des points" }
  ],
  "aReprendre": ["ce qu'il faut revoir avec le groupe entier après la correction"]
}`,
    "",
    "Une entrée d'`etapes` par consigne de l'énoncé, dans le même ordre.",
  ].join("\n");

  let texte: string;
  try {
    const config = await chargerConfigLlm(user.id);
    texte = await appelerLlm(config, {
      systeme:
        "Tu es un formateur expert du référentiel OFPPT qui corrige des travaux pratiques de Digital Design. Tu écris en français, pour toi-même : dense, utilisable copie en main.",
      prompt,
      temperature: 0.4,
      maxTokens: 3500,
      json: true,
    });
  } catch (e) {
    const err = e instanceof ErreurLlm ? e : null;
    return NextResponse.json(
      { error: err?.message ?? "Échec de génération" },
      { status: err?.statut ?? 502 },
    );
  }

  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch {
    return NextResponse.json(
      { error: "Le modèle n'a pas retourné un JSON valide." },
      { status: 502 },
    );
  }

  const correction = lireCorrection(brut);
  const avertissements: string[] = [];

  // Le barème de la correction doit être celui de l'énoncé : c'est sur
  // celui-là que les stagiaires ont travaillé. Une divergence se voit à la
  // remise des notes, trop tard.
  const attendus = enonce.criteres ?? [];
  if (correction.criteres.length !== attendus.length) {
    avertissements.push(
      `L'énoncé annonce ${attendus.length} critère${attendus.length > 1 ? "s" : ""}, la correction en propose ${correction.criteres.length}. Alignez-les avant de corriger.`,
    );
  }
  const totalEnonce = attendus.reduce((t, c) => t + c.points, 0);
  const totalCorrection = correction.criteres.reduce((t, c) => t + c.points, 0);
  if (totalEnonce > 0 && totalCorrection !== totalEnonce) {
    avertissements.push(
      `Le barème de la correction totalise ${totalCorrection} points au lieu des ${totalEnonce} de l'énoncé.`,
    );
  }
  if (correction.etapes.length !== enonce.consignes.length) {
    avertissements.push(
      `L'énoncé compte ${enonce.consignes.length} consignes, la correction en traite ${correction.etapes.length}.`,
    );
  }

  return NextResponse.json({ correction, avertissements });
}
