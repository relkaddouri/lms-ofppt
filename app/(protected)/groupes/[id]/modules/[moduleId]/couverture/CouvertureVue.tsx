"use client";

import Link from "next/link";
import { Check, CircleDashed, Clock } from "lucide-react";
import { formatDate } from "@/lib/format";
import type { CouvertureModule } from "@/app/actions/couverture";

/**
 * Couverture du référentiel national, élément de contenu par élément.
 *
 * L'écran de progression dit combien d'heures ont été dispensées. Celui-ci
 * dit ce qui a été *traité* — la question à laquelle il faut pouvoir répondre
 * avant la fin d'un module, puisque l'EFF porte sur ce référentiel-là.
 */
export default function CouvertureVue({
  couverture,
  groupeId,
}: {
  couverture: CouvertureModule;
  groupeId: string;
}) {
  const { apprentissages, total, assignes, traites } = couverture;
  const nonAssignes = total - assignes;
  const pourcentage = total ? Math.round((traites / total) * 100) : 0;

  return (
    <div className="mt-6 flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[11.5px] uppercase tracking-[0.12em] text-slate-light">
          Référentiel national
        </span>
        <h1 className="font-display text-[29px] font-bold leading-tight tracking-[-0.02em] text-ink">
          Couverture du contenu
        </h1>
        <p className="text-base text-slate-2">
          Ce sur quoi l&apos;examen de fin de formation portera. Les heures
          dispensées ne suffisent pas : il faut que chaque élément ait été
          traité.
        </p>
      </div>

      {total === 0 ? (
        <p className="rounded-[14px] border border-border bg-surface px-6 py-10 text-center text-[14.5px] text-slate-light shadow-repos">
          Le référentiel de ce module ne porte aucun élément de contenu saisi.
        </p>
      ) : (
        <>
          <section className="flex flex-col gap-4 rounded-[14px] border border-border bg-surface p-6 shadow-repos">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-slate-light">
                  Éléments traités
                </span>
                <span className="font-display text-[40px] font-bold leading-none tracking-[-0.03em] text-ink">
                  {traites}
                  <span className="text-[20px] text-slate-light">
                    {" "}
                    / {total}
                  </span>
                </span>
              </div>
              <div className="flex flex-wrap gap-2.5">
                <span className="rounded-full border border-tint-green bg-success-wash px-3 py-1 text-[12.5px] font-semibold text-green-dark">
                  {traites} traités
                </span>
                <span className="rounded-full border border-tint-teal-strong bg-tint-teal px-3 py-1 text-[12.5px] font-semibold text-teal-dark">
                  {assignes - traites} planifiés
                </span>
                <span
                  className={`rounded-full border px-3 py-1 text-[12.5px] font-semibold ${
                    nonAssignes > 0
                      ? "border-tint-alert-strong bg-alert-wash text-coral-dark"
                      : "border-border bg-wash-strong text-slate-2"
                  }`}
                >
                  {nonAssignes} sans séance
                </span>
              </div>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-wash">
              <div
                className="h-full rounded-full bg-green transition-[width] duration-200 ease-out"
                style={{ width: `${pourcentage}%` }}
              />
            </div>

            {nonAssignes > 0 ? (
              <p className="text-[13.5px] text-coral-dark">
                {nonAssignes} élément{nonAssignes > 1 ? "s" : ""} n&apos;
                {nonAssignes > 1 ? "ont" : "a"} été assigné à aucune séance —
                {nonAssignes > 1 ? " ils ne seront" : " il ne sera"} traité
                {nonAssignes > 1 ? "s" : ""} par personne en l&apos;état.
              </p>
            ) : null}
          </section>

          {apprentissages
            .filter((a) => a.elements.length > 0)
            .map((a) => {
              const faits = a.elements.filter((e) => e.traite).length;
              return (
                <section
                  key={a.suggestionId}
                  className="overflow-hidden rounded-[14px] border border-border bg-surface shadow-repos"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-separator bg-paper-alt px-6 py-4">
                    <h2 className="flex min-w-0 items-center gap-2.5">
                      {a.code ? (
                        <span className="shrink-0 rounded-[7px] bg-wash px-2 py-0.5 font-mono text-xs font-semibold text-slate-2">
                          {a.code}
                        </span>
                      ) : null}
                      <span className="truncate font-display text-[15.5px] font-semibold text-ink">
                        {a.intitule}
                      </span>
                    </h2>
                    <span
                      className={`whitespace-nowrap font-mono text-[12.5px] ${
                        faits === a.elements.length
                          ? "text-green-dark"
                          : "text-slate-light"
                      }`}
                    >
                      {faits} / {a.elements.length}
                    </span>
                  </div>

                  {a.elements.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-start gap-3 border-b border-separator px-6 py-3.5 last:border-b-0"
                    >
                      <span className="mt-0.5 shrink-0">
                        {e.traite ? (
                          <Check
                            size={16}
                            strokeWidth={2.6}
                            aria-label="Traité"
                            className="text-green-dark"
                          />
                        ) : e.seanceId ? (
                          <Clock
                            size={16}
                            aria-label="Planifié"
                            className="text-teal-dark"
                          />
                        ) : (
                          <CircleDashed
                            size={16}
                            aria-label="Sans séance"
                            className="text-coral"
                          />
                        )}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span
                          className={`text-[14.5px] leading-snug ${
                            e.traite ? "text-body" : "text-ink"
                          }`}
                        >
                          {e.intitule}
                        </span>
                        {e.seanceId ? (
                          <Link
                            href={`/groupes/${groupeId}/seances/${e.seanceId}`}
                            className="self-start font-mono text-[12.5px] text-teal no-underline hover:underline"
                          >
                            {e.seanceDate
                              ? formatDate(e.seanceDate)
                              : "séance sans date"}
                          </Link>
                        ) : (
                          <span className="font-mono text-[12.5px] text-coral-dark">
                            aucune séance
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </section>
              );
            })}
        </>
      )}
    </div>
  );
}
