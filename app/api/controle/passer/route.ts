import { createClient, getUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { chargerConfigLlm, ErreurLlm } from "@/lib/llm";
import { noterCopie, questionsAJuger, type QuestionPourNotation } from "@/lib/notation";
import { NextResponse } from "next/server";

/**
 * Remise d'une copie par un stagiaire connecté.
 *
 * Remplace la passation par lien public : l'identité vient du compte, pas d'un
 * nom saisi au clavier, et la base refuse une seconde copie. La limite de débit
 * qui protégeait le lien public n'a plus lieu d'être — un compte ne peut rendre
 * qu'une fois.
 */
export async function POST(request: Request) {
  const { controleId, reponses } = await request.json().catch(() => ({}));

  if (!controleId || typeof reponses !== "object" || reponses === null) {
    return NextResponse.json(
      { error: "controleId et reponses requis" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }

  // Les corrigés ne sont lisibles par personne côté navigateur : la correction
  // les relit avec la clé de service, après avoir vérifié l'appartenance.
  const { data: moi } = await supabase
    .from("stagiaires")
    .select("id, prenom, nom, groupe_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!moi) {
    return NextResponse.json(
      { error: "Aucune fiche stagiaire pour ce compte." },
      { status: 403 },
    );
  }

  const service = createServiceClient();

  const { data: controle } = await service
    .from("controles")
    .select("id, groupe_id, module_id, statut")
    .eq("id", controleId)
    .maybeSingle();

  if (!controle || controle.groupe_id !== moi.groupe_id || controle.statut !== "valide") {
    return NextResponse.json(
      { error: "Contrôle introuvable ou hors de votre groupe." },
      { status: 404 },
    );
  }

  const { data: dejaRendu } = await service
    .from("passations_controle")
    .select("id")
    .eq("controle_id", controleId)
    .eq("stagiaire_id", moi.id)
    .maybeSingle();

  if (dejaRendu) {
    return NextResponse.json(
      { error: "Vous avez déjà rendu cette copie." },
      { status: 409 },
    );
  }

  const { data: questionsBrutes, error: errQ } = await service
    .from("questions_controle")
    .select("id, type, enonce, bareme, options, corrige, position")
    .eq("controle_id", controleId)
    .order("position");

  if (errQ) {
    console.error("[passation] lecture des questions", errQ.message);
    return NextResponse.json(
      { error: "Impossible de charger le contrôle." },
      { status: 500 },
    );
  }

  const questions = (questionsBrutes ?? []) as unknown as QuestionPourNotation[];
  if (questions.length === 0) {
    return NextResponse.json({ error: "Aucune question" }, { status: 400 });
  }

  // Le modèle du formateur propriétaire, pas celui du stagiaire : c'est lui qui
  // paie et qui a choisi. Inutile de le charger si tout est en QCM.
  let config = null;
  if (questionsAJuger(questions).length > 0) {
    const { data: groupe } = await service
      .from("groupes")
      .select("formateur_id")
      .eq("id", controle.groupe_id)
      .maybeSingle();

    const proprietaire = groupe?.formateur_id as string | null;
    if (!proprietaire) {
      return NextResponse.json(
        { error: "Correction indisponible : contrôle sans formateur rattaché." },
        { status: 500 },
      );
    }
    try {
      config = await chargerConfigLlm(proprietaire);
    } catch (e) {
      const err = e instanceof ErreurLlm ? e : null;
      return NextResponse.json(
        { error: err?.message ?? "Correction indisponible." },
        { status: err?.statut ?? 502 },
      );
    }
  }

  let details;
  try {
    details = await noterCopie(
      questions,
      reponses as Record<string, string>,
      `${moi.prenom} ${moi.nom}`,
      config,
    );
  } catch (e) {
    const err = e instanceof ErreurLlm ? e : null;
    return NextResponse.json(
      { error: err?.message ?? (e instanceof Error ? e.message : "Échec de correction") },
      { status: err?.statut ?? 502 },
    );
  }

  // La note est recalculée en base sur les questions réelles : les points
  // proposés ici ne font pas foi.
  const { data: passation, error: errSubmit } = await supabase.rpc(
    "enregistrer_passation",
    { p_controle_id: controleId, p_details: details },
  );

  if (errSubmit || !passation) {
    console.error("[passation] enregistrement", errSubmit?.message);
    return NextResponse.json(
      { error: errSubmit?.message ?? "Enregistrement impossible." },
      { status: 500 },
    );
  }

  return NextResponse.json(passation);
}
