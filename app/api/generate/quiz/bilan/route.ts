import { createClient, getUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { appelerLlm, chargerConfigLlm, ErreurLlm } from "@/lib/llm";
import { verifierQuota, QUOTA_GENERATION } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import {
  NB_QUESTIONS_BILAN,
  questionsValides,
  texteDuSupport,
  type QuestionQuiz,
} from "@/lib/quiz";
import { getJalon } from "@/app/actions/cours-stagiaire";
import type { Support } from "@/lib/support";

/**
 * Le quiz de bilan d'un jalon — trois chapitres (PRD §4.5bis).
 *
 * Il porte sur les trois à la fois : c'est ce qui le distingue des quiz de
 * chapitre, dont chacun ne voit que son cours. On demande donc au modèle des
 * questions qui relient, comparent et appliquent, pas trois quiz mis bout à
 * bout.
 *
 * Écrit une fois par groupe — deux groupes n'ont pas les mêmes supports —,
 * puis servi tel quel. L'appel est facturé au formateur du module.
 */

export async function POST(request: Request) {
  const { moduleId, rang, regenerer } = await request.json().catch(() => ({}));
  const n = Number(rang);
  if (!moduleId || !Number.isInteger(n) || n < 1) {
    return NextResponse.json({ error: "moduleId et rang requis" }, { status: 400 });
  }

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }

  // Le jalon est relu depuis les chapitres auxquels l'appelant a accès : un
  // stagiaire ne peut pas demander le bilan d'un module qui n'est pas le sien.
  const jalon = await getJalon(moduleId, n);
  if (!jalon) {
    return NextResponse.json({ error: "Bilan introuvable" }, { status: 404 });
  }

  const supabase = await createClient();
  const { data: existant } = await supabase
    .from("quiz_bilan")
    .select("questions, modele, genere_le, support_ids")
    .eq("module_id", moduleId)
    .eq("rang", n)
    .maybeSingle();

  const memesChapitres =
    existant &&
    (existant.support_ids as string[] | null)?.join(",") ===
      jalon.chapitres.map((c) => c.id).join(",");

  // Un support republié change le jalon : le bilan se réécrit alors, sans
  // quoi il interrogerait sur un cours que personne n'a lu.
  if (existant && memesChapitres && !regenerer) {
    return NextResponse.json({
      questions: existant.questions as unknown as QuestionQuiz[],
      modele: existant.modele,
      genereLe: existant.genere_le,
    });
  }

  const quota = verifierQuota(`quiz-bilan:${user.id}`, QUOTA_GENERATION);
  if (quota) return quota;

  const service = createServiceClient();
  const { data: supports, error: errSupports } = await service
    .from("supports_seance")
    .select("id, contenu")
    .in(
      "id",
      jalon.chapitres.map((c) => c.id),
    );
  if (errSupports) {
    return NextResponse.json({ error: errSupports.message }, { status: 500 });
  }

  const { data: groupe } = await service
    .from("groupes")
    .select("formateur_id")
    .eq("id", jalon.groupeId)
    .maybeSingle();
  const proprietaire = (groupe?.formateur_id as string | null) ?? null;
  if (!proprietaire) {
    return NextResponse.json(
      { error: "Bilan indisponible : ce module n'est rattaché à aucun formateur." },
      { status: 500 },
    );
  }

  // Chaque chapitre garde sa part du budget : sans cela, un cours très long
  // occuperait toute la place et le bilan ne porterait que sur lui.
  const parChapitre = Math.floor(24_000 / jalon.chapitres.length);
  const cours = jalon.chapitres
    .map((c, i) => {
      const s = supports?.find((x) => x.id === c.id);
      const texte = s ? texteDuSupport(s.contenu as unknown as Support) : "";
      return `## Chapitre ${c.numero} — ${c.titre}\n${texte.slice(0, parChapitre)}`;
    })
    .join("\n\n");

  const prompt = [
    `Tu prépares le quiz de bilan d'un module de l'OFPPT : ${jalon.moduleNom}.`,
    "Il vient après trois chapitres et sert à réviser ; il n'est pas noté.",
    "",
    "## Les chapitres",
    cours,
    "",
    "## Ce que tu produis",
    `- ${NB_QUESTIONS_BILAN} questions à choix multiple, en français.`,
    "- Elles couvrent les TROIS chapitres, à peu près également, dans leur ordre.",
    "- Au moins deux questions RELIENT deux chapitres : comparer deux notions",
    "  voisines, appliquer une notion du premier à une situation du troisième,",
    "  remettre une démarche dans l'ordre. C'est ce qu'un bilan ajoute.",
    "- Chaque question porte sur ce qui est écrit ci-dessus, jamais ailleurs.",
    "- Trois ou quatre propositions, une seule juste, les autres plausibles.",
    "- `bonne` est l'index de la proposition juste, à partir de 0.",
    "- `explication` dit pourquoi, en une ou deux phrases appuyées sur le cours.",
    "",
    "Réponds uniquement en JSON :",
    JSON.stringify(
      {
        questions: [
          { question: "…", propositions: ["…", "…", "…"], bonne: 0, explication: "…" },
        ],
      },
      null,
      1,
    ),
  ].join("\n");

  let brut: string;
  let modele: string | null = null;
  try {
    const config = await chargerConfigLlm(proprietaire);
    modele = config.modele;
    brut = await appelerLlm(config, {
      systeme:
        "Tu es un formateur du référentiel OFPPT. Tu écris des quiz de révision en français, fidèles aux cours donnés. Tu réponds en JSON valide.",
      prompt,
      temperature: 0.4,
      json: true,
    });
  } catch (e) {
    const err = e instanceof ErreurLlm ? e : null;
    return NextResponse.json(
      { error: err?.message ?? "Bilan indisponible pour l'instant." },
      { status: err?.statut ?? 502 },
    );
  }

  let questions: QuestionQuiz[];
  try {
    const lu = JSON.parse(brut) as { questions?: unknown };
    questions = questionsValides(lu.questions, NB_QUESTIONS_BILAN);
  } catch {
    return NextResponse.json(
      { error: "Le modèle n'a pas retourné un JSON valide. Réessayez." },
      { status: 502 },
    );
  }

  if (questions.length < 4) {
    return NextResponse.json(
      { error: "Le bilan n'a pas pu être écrit à partir de ces chapitres. Réessayez." },
      { status: 502 },
    );
  }

  const genereLe = new Date().toISOString();
  const { error: errEcriture } = await service.from("quiz_bilan").upsert(
    {
      module_id: moduleId,
      groupe_id: jalon.groupeId,
      rang: n,
      support_ids: jalon.chapitres.map((c) => c.id),
      questions: questions as never,
      modele,
      genere_le: genereLe,
    },
    { onConflict: "module_id,groupe_id,rang" },
  );
  if (errEcriture) {
    return NextResponse.json({ error: errEcriture.message }, { status: 500 });
  }

  return NextResponse.json({ questions, modele, genereLe });
}
