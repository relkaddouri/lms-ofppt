import { GraduationCap } from "lucide-react";
import { getStagesGroupe } from "@/app/actions/stages";
import CarteStage from "./CarteStage";

export const metadata = { title: "Stage" };

export default async function StagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const stages = await getStagesGroupe(id);

  if (stages.length === 0) {
    return (
      <section className="mt-6 rounded-[14px] border border-border bg-surface px-4 py-10 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-wash">
          <GraduationCap className="h-6 w-6 text-ink" aria-hidden />
        </span>
        <p className="mt-4 text-base font-semibold text-ink">
          Aucun stagiaire dans ce groupe
        </p>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-slate">
          Le suivi de stage se fait stagiaire par stagiaire. Ajoutez-les depuis
          l&apos;onglet Stagiaires pour ouvrir leur dossier.
        </p>
      </section>
    );
  }

  return (
    <div className="mt-6 overflow-hidden rounded-[14px] border border-border bg-surface">
      {stages.map((s) => (
        <CarteStage key={s.stagiaireId} stage={s} />
      ))}
    </div>
  );
}
