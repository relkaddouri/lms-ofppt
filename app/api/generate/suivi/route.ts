import { createClient, getUser } from "@/lib/supabase/server";
import { appelerLlm, chargerConfigLlm, ErreurLlm } from "@/lib/llm";
import { verifierQuota, QUOTA_GENERATION } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { getSuiviStagiaire } from "@/app/actions/suivi";
import {
  assiseDe,
  lectureValide,
  promptLecture,
  type LectureSuivi,
} from "@/lib/lecture-suivi";

/**
 * La lecture du suivi d'un stagiaire (atome 13.3).
 *
 * Demandée par le formateur, écrite une fois, conservée : une lecture
 * recalculée à chaque ouverture coûterait un appel par coup d'œil et
 * changerait de mots sans que rien n'ait bougé dans le travail du stagiaire.
 * `regenerer` la relance quand le formateur veut la rafraîchir.
 *
 * Le suivi est relu sous l'identité de l'appelant : les politiques décident
 * s'il a accès à ce stagiaire. Le modèle, lui, ne reçoit ni nom ni prénom.
 */

export async function POST(request: Request) {
  const { stagiaireId, regenerer } = await request.json().catch(() => ({}));
  if (!stagiaireId) {
    return NextResponse.json({ error: "stagiaireId requis" }, { status: 400 });
  }

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }

  const supabase = await createClient();
  const { data: existant } = await supabase
    .from("lectures_suivi")
    .select("contenu, assise, modele, genere_le")
    .eq("stagiaire_id", stagiaireId)
    .maybeSingle();

  if (existant && !regenerer) {
    return NextResponse.json({
      lecture: existant.contenu as unknown as LectureSuivi,
      assise: existant.assise,
      modele: existant.modele,
      genereLe: existant.genere_le,
    });
  }

  // Le suivi est relu ici, sous l'identité du formateur : c'est la politique
  // qui dit s'il a le droit de lire ce stagiaire, pas cette route.
  const suivi = await getSuiviStagiaire(stagiaireId);
  if (!suivi) {
    return NextResponse.json({ error: "Stagiaire introuvable" }, { status: 404 });
  }

  const quota = verifierQuota(`suivi:${user.id}`, QUOTA_GENERATION);
  if (quota) return quota;

  let brut: string;
  let modele: string | null = null;
  try {
    const config = await chargerConfigLlm(user.id);
    modele = config.modele;
    brut = await appelerLlm(config, {
      systeme:
        "Tu es un formateur expérimenté du référentiel OFPPT. Tu lis des données de suivi et tu écris, en français, ce qu'elles disent du travail d'un stagiaire — sans inventer, sans flatter, sans juger la personne. Tu réponds en JSON valide.",
      prompt: promptLecture(suivi),
      temperature: 0.3,
      json: true,
    });
  } catch (e) {
    const err = e instanceof ErreurLlm ? e : null;
    return NextResponse.json(
      { error: err?.message ?? "Lecture indisponible pour l'instant." },
      { status: err?.statut ?? 502 },
    );
  }

  let lecture: LectureSuivi | null;
  try {
    lecture = lectureValide(JSON.parse(brut));
  } catch {
    return NextResponse.json(
      { error: "Le modèle n'a pas retourné un JSON valide. Réessayez." },
      { status: 502 },
    );
  }
  if (!lecture) {
    return NextResponse.json(
      { error: "La lecture n'a pas pu être écrite. Réessayez." },
      { status: 502 },
    );
  }

  const assise = assiseDe(suivi);
  const genereLe = new Date().toISOString();
  // L'écriture passe par la session du formateur : la politique de la
  // migration 102 la borne à ses propres stagiaires.
  const { error } = await supabase.from("lectures_suivi").upsert(
    {
      stagiaire_id: stagiaireId,
      contenu: lecture as never,
      assise,
      modele,
      genere_le: genereLe,
    },
    { onConflict: "stagiaire_id" },
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ lecture, assise, modele, genereLe });
}
