import { createPublicClient } from "@/lib/supabase/public";
import ControlePublic from "./ControlePublic";

export const dynamic = "force-dynamic";

type QuestionPublic = {
  id: string;
  controle_id: string;
  enonce: string;
  bareme: number;
  position: number;
};

type ControlePublicData = {
  id: string;
  titre: string | null;
  consignes: string | null;
  duree_heures: number;
};

export default async function PublicControlePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const supabase = createPublicClient();

  const { data: controle } = await supabase
    .rpc("get_controle_by_token", { p_token: token })
    .single();

  if (!controle) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper p-8">
        <div className="w-full max-w-md rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-8 text-center">
          <h1 className="font-display text-2xl font-bold text-ink">
            Lien invalide
          </h1>
          <p className="mt-2 text-sm text-slate">
            Ce lien de contrôle n&apos;existe pas ou n&apos;est plus actif.
          </p>
        </div>
      </main>
    );
  }

  const { data: questionsRes } = await supabase.rpc(
    "get_questions_by_controle_token",
    { p_token: token },
  );

  return (
    <ControlePublic
      token={token}
      controle={controle as ControlePublicData}
      questions={(questionsRes ?? []) as QuestionPublic[]}
    />
  );
}
