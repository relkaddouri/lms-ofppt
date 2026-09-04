import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getIdentiteStagiaire } from "@/app/actions/stagiaire";
import { getCamarades } from "@/app/actions/fil";
import { getSupportDetail } from "@/app/actions/questions-support";
import { formatDateJour } from "@/lib/format";
import SupportLecture from "./SupportLecture";
import QuestionsSupport from "@/components/QuestionsSupport";

export default async function CoursDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const identite = await getIdentiteStagiaire();
  if (!identite) return null;

  const [support, camarades] = await Promise.all([
    getSupportDetail(id),
    getCamarades(identite.groupeId),
  ]);
  if (!support) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/espace-stagiaire/cours"
        className="inline-flex min-h-[44px] items-center gap-1.5 text-sm text-slate hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Tous les cours
      </Link>

      <article className="rounded-[14px] border border-border bg-surface p-4 md:p-6">
        <h1 className="text-lg font-semibold leading-snug text-ink">
          {support.contenu.titre}
        </h1>
        <p className="mt-1 text-xs text-slate">
          {[support.date ? formatDateJour(support.date) : null, support.moduleNom]
            .filter(Boolean)
            .join(" · ")}
        </p>

        <div className="mt-5">
          <SupportLecture support={support.contenu} />
        </div>
      </article>

      <QuestionsSupport
        supportId={support.id}
        questions={support.questions}
        camarades={camarades}
      />
    </div>
  );
}
