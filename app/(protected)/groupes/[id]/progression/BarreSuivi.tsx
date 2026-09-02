"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LayoutGrid, List, Search } from "lucide-react";
import type { Seance } from "@/app/actions/seances";
import { formatDate } from "@/lib/format";
import { libelleModule } from "@/lib/modules";

export type Vue = "liste" | "tableau";

/**
 * Barre d'outils du suivi des séances, et vue tableau par statut.
 *
 * Reprend `Suivi des séances.dc.html` : recherche, bascule liste/tableau
 * (design_system.md §5.1) et trois colonnes — À faire, Fait, Sans date —
 * chacune avec son point de statut et son compte.
 *
 * La recherche filtre les deux vues. Elle répond au défaut n°3 de la revue :
 * cette page peut afficher soixante séances sans le moindre moyen d'en
 * retrouver une.
 */
const COLONNES = [
  { cle: "todo", label: "À faire", point: "bg-teal", encre: "text-ink" },
  { cle: "done", label: "Fait", point: "bg-green", encre: "text-ink" },
  { cle: "nodate", label: "Sans date", point: "bg-slate-light", encre: "text-slate-2" },
] as const;

function statutDe(s: Seance): "todo" | "done" | "nodate" {
  if (s.statut === "fait") return "done";
  return s.date ? "todo" : "nodate";
}

export default function BarreSuivi({
  groupeId,
  seances,
  vue,
  onVueChange,
  filtre,
  onFiltreChange,
}: {
  groupeId: string;
  seances: Seance[];
  vue: Vue;
  onVueChange: (v: Vue) => void;
  filtre: string;
  onFiltreChange: (v: string) => void;
}) {
  const recherche = filtre.trim().toLowerCase();

  const colonnes = useMemo(() => {
    const retenues = recherche
      ? seances.filter((s) =>
          [s.objectif_operationnel, s.modules?.nom, s.contenu_realise]
            .filter(Boolean)
            .some((v) => v!.toLowerCase().includes(recherche)),
        )
      : seances;

    return COLONNES.map((c) => ({
      ...c,
      items: retenues.filter((s) => statutDe(s) === c.cle),
    }));
  }, [seances, recherche]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative block min-w-[260px] flex-1 md:max-w-[420px]">
          <span className="sr-only">Rechercher une séance</span>
          <Search
            size={17}
            strokeWidth={2}
            aria-hidden
            className="pointer-events-none absolute left-[13px] top-1/2 -translate-y-1/2 text-slate-light"
          />
          <input
            type="search"
            value={filtre}
            onChange={(e) => onFiltreChange(e.target.value)}
            placeholder="Rechercher une séance, un module…"
            className="w-full rounded-[9px] border border-border-strong bg-surface py-[11px] pl-10 pr-[13px] text-[15px] text-ink outline-none transition-colors duration-150 ease-out placeholder:text-slate-light focus:border-teal focus:shadow-[0_0_0_3px_rgba(46,125,158,0.15)]"
          />
        </label>

        <div className="flex gap-1 rounded-[10px] border border-border bg-wash-strong p-[3px]">
          {(
            [
              { v: "liste" as const, Icone: List, titre: "Vue liste" },
              { v: "tableau" as const, Icone: LayoutGrid, titre: "Vue tableau" },
            ]
          ).map(({ v, Icone, titre }) => (
            <button
              key={v}
              type="button"
              aria-label={titre}
              aria-pressed={vue === v}
              onClick={() => onVueChange(v)}
              className={`flex h-8 w-9 items-center justify-center rounded-[7px] transition-colors duration-150 ease-out ${
                vue === v
                  ? "bg-surface text-ink shadow-[0_1px_2px_rgba(46,59,78,0.12)]"
                  : "text-slate-2 hover:text-ink"
              }`}
            >
              <Icone size={17} strokeWidth={2} aria-hidden />
            </button>
          ))}
        </div>
      </div>

      {vue === "tableau" ? (
        <div className="grid gap-5 lg:grid-cols-3">
          {colonnes.map((c) => (
            <section
              key={c.cle}
              className="flex flex-col rounded-[14px] border border-border bg-surface shadow-repos"
            >
              <div className="flex items-center gap-2.5 border-b border-separator px-[18px] py-4">
                <span
                  aria-hidden
                  className={`h-2 w-2 shrink-0 rounded-full ${c.point}`}
                />
                <h3
                  className={`font-display text-[15.5px] font-semibold ${c.encre}`}
                >
                  {c.label}
                </h3>
                <span className="ml-auto rounded-full bg-wash px-2 py-px font-mono text-xs font-medium text-slate-2">
                  {c.items.length}
                </span>
              </div>

              <div className="flex flex-col gap-3 p-3.5">
                {c.items.length === 0 ? (
                  <p className="px-1 py-4 text-center text-[13.5px] text-slate-light">
                    Aucune séance
                  </p>
                ) : (
                  c.items.map((s) => (
                    <Link
                      key={s.id}
                      href={`/groupes/${groupeId}/seances/${s.id}`}
                      className="flex min-w-0 flex-col gap-3 rounded-[11px] border border-border bg-surface p-3.5 no-underline transition-colors duration-150 ease-out hover:border-border-strong hover:no-underline"
                    >
                      <div className="flex min-w-0 flex-col gap-[3px]">
                        <span className="truncate text-[14.5px] font-semibold text-ink">
                          {s.objectif_operationnel ?? "Séance sans objectif"}
                        </span>
                        <span className="truncate text-[13px] text-slate-light">
                          {libelleModule(
                            s.modules?.competences?.code_operationnel,
                            s.modules?.nom,
                          )}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 border-t border-separator pt-2.5">
                        <span className="font-mono text-[12.5px] text-slate-2">
                          {s.date ? formatDate(s.date) : "date à poser"}
                        </span>
                        {s.duree_prevue ? (
                          <span className="font-mono text-[12.5px] text-slate-light">
                            {s.duree_prevue} h
                          </span>
                        ) : null}
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
