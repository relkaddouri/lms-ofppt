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

      {/* §4.4 : la correction n'apparaît que si le formateur l'a ouverte à ce
          groupe. Elle est absente le reste du temps — pas grisée, pas
          annoncée : un corrigé qu'on sait exister se cherche. */}
      {support.correction ? (
        <article className="rounded-[14px] border border-tint-teal-strong bg-tint-teal p-4 md:p-6">
          <h2 className="text-base font-semibold text-ink">
            Correction proposée
          </h2>
          <p className="mt-1 text-xs text-slate-2">
            Partagée par votre formateur.
          </p>

          {support.correction.proposition ? (
            <p className="mt-4 text-sm leading-relaxed text-ink">
              {support.correction.proposition}
            </p>
          ) : null}

          {support.correction.etapes.length > 0 ? (
            <ol className="mt-4 flex flex-col gap-3">
              {support.correction.etapes.map((e, i) => (
                <li
                  key={i}
                  className="rounded-[10px] border border-border bg-surface p-3.5"
                >
                  <p className="text-sm font-semibold text-ink">
                    {i + 1}. {e.consigne}
                  </p>
                  {e.attendu.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-sm leading-relaxed text-ink">
                      {e.attendu.map((a, k) => (
                        <li key={k} className="flex gap-2">
                          <span
                            className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ink"
                            aria-hidden
                          />
                          <span>{a}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {e.erreurs.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-sm leading-relaxed text-slate-2">
                      {e.erreurs.map((x, k) => (
                        <li key={k} className="flex gap-2">
                          <span
                            className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-light"
                            aria-hidden
                          />
                          <span>{x}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : null}

          {support.correction.aReprendre.length > 0 ? (
            <section className="mt-4">
              <h3 className="text-sm font-semibold text-ink">À revoir</h3>
              <ul className="mt-2 space-y-1 text-sm leading-relaxed text-ink">
                {support.correction.aReprendre.map((r, i) => (
                  <li key={i} className="flex gap-2">
                    <span
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ink"
                      aria-hidden
                    />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </article>
      ) : null}

      <QuestionsSupport
        supportId={support.id}
        questions={support.questions}
        camarades={camarades}
      />
    </div>
  );
}
