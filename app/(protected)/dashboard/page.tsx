import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  ClipboardCheck,
  User,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getDashboardData } from "@/app/actions/dashboard";
import DashboardCharts from "./DashboardCharts";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Tableau de bord" };

/** Année de formation : septembre ouvre l'année suivante, comme en base. */
function anneeDeFormation(): string {
  const maintenant = new Date();
  const debut =
    maintenant.getMonth() >= 8
      ? maintenant.getFullYear()
      : maintenant.getFullYear() - 1;
  return `${debut} — ${debut + 1}`;
}

/** Jours restants avant une date, ou null si elle n'est pas fixée. */
function joursAvant(date: string | null): number | null {
  if (!date) return null;
  const jour = 86_400_000;
  const aujourdhui = new Date().toISOString().slice(0, 10);
  return Math.round(
    (new Date(`${date}T12:00:00Z`).getTime() -
      new Date(`${aujourdhui}T12:00:00Z`).getTime()) /
      jour,
  );
}

type Indicateur = {
  cle: "groupesActifs" | "totalStagiaires" | "modulesCount" | "controlesEnAttente";
  label: string;
  Icone: LucideIcon;
  href?: string;
  libelleLien?: string;
  /** L'unique élément corail de l'écran (design_system.md §1). */
  alerte?: boolean;
};

const INDICATEURS: Indicateur[] = [
  {
    cle: "groupesActifs",
    label: "Groupes actifs",
    Icone: Users,
    href: "/groupes",
    libelleLien: "Voir détails",
  },
  {
    cle: "totalStagiaires",
    label: "Stagiaires suivis",
    Icone: User,
    href: "/groupes",
    libelleLien: "Voir détails",
  },
  {
    cle: "modulesCount",
    label: "Modules en cours",
    Icone: BookOpen,
    href: "/modules",
    libelleLien: "Voir détails",
  },
  {
    cle: "controlesEnAttente",
    label: "Contrôles à valider",
    Icone: ClipboardCheck,
    alerte: true,
  },
];

export default async function DashboardPage() {
  const { stats, groupes, evolution } = await getDashboardData();
  const enAttente = stats.controlesEnAttente;

  return (
    <div className="flex flex-col gap-8 px-6 py-10 md:px-10 md:pb-14">
      <header className="flex flex-wrap items-end justify-between gap-8">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[11.5px] uppercase tracking-[0.12em] text-slate-light">
            Année de formation {anneeDeFormation()}
          </span>
          <h1 className="font-display text-[34px] font-bold leading-tight tracking-[-0.02em] text-ink">
            Tableau de bord
          </h1>
          <p className="text-base text-slate-2">
            {enAttente === 0
              ? "Aucun contrôle n’attend votre validation."
              : `${enAttente} contrôle${enAttente > 1 ? "s" : ""} attend${
                  enAttente > 1 ? "ent" : ""
                } votre validation.`}
          </p>
        </div>
      </header>

      <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(210px,1fr))]">
        {INDICATEURS.map(({ cle, label, Icone, href, libelleLien, alerte }) => (
          <div
            key={cle}
            className="flex flex-col gap-4 rounded-[14px] border border-border bg-surface px-5 pb-4 pt-[18px] shadow-repos"
          >
            <div className="flex items-center gap-[9px]">
              <Icone
                size={17}
                strokeWidth={1.9}
                aria-hidden
                className={alerte && enAttente > 0 ? "text-coral" : "text-slate"}
              />
              <span className="text-[14.5px] text-slate-2">{label}</span>
            </div>
            <div className="flex items-end justify-between gap-3">
              <span className="font-display text-[38px] font-bold leading-none tracking-[-0.03em] text-ink">
                {stats[cle]}
              </span>
              {href ? (
                <Link
                  href={href}
                  className="flex items-center gap-[5px] whitespace-nowrap pb-1 text-[13.5px] font-semibold text-slate-2 no-underline transition-colors duration-150 ease-out hover:text-ink hover:no-underline"
                >
                  {libelleLien}
                  <ArrowUpRight size={12} strokeWidth={2.4} aria-hidden />
                </Link>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <section className="flex flex-col gap-5 rounded-[14px] border border-border bg-surface p-6 shadow-repos">
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-[17px] font-semibold text-ink">
              Évolution de la progression
            </h2>
            <span className="text-[13.5px] text-slate-light">
              Séances faites, cumulées
            </span>
          </div>
          <DashboardCharts evolution={evolution} />
        </section>

        <section className="flex flex-col rounded-[14px] border border-border bg-surface shadow-repos">
          <div className="flex items-start justify-between gap-4 border-b border-separator p-6 pb-4">
            <div className="flex flex-col gap-1">
              <h2 className="font-display text-[17px] font-semibold text-ink">
                Groupes par urgence
              </h2>
              <span className="text-[13.5px] text-slate-light">
                Date de fin la plus proche en premier
              </span>
            </div>
            <Link
              href="/groupes"
              className="whitespace-nowrap pt-1 text-[13.5px] font-semibold text-slate-2 no-underline transition-colors duration-150 ease-out hover:text-ink hover:no-underline"
            >
              Tous les groupes
            </Link>
          </div>

          {groupes.length === 0 ? (
            <p className="p-6 text-[14.5px] text-slate-light">
              Aucun groupe pour l’instant.
            </p>
          ) : (
            <ul className="flex flex-col">
              {groupes.map((g) => {
                const jours = joursAvant(g.date_fin);
                return (
                  <li key={g.id} className="border-b border-separator last:border-0">
                    <Link
                      href={`/groupes/${g.id}/progression`}
                      className="flex items-center gap-4 px-6 py-4 no-underline transition-colors duration-150 ease-out hover:bg-paper hover:no-underline"
                    >
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-[15px] font-semibold text-ink">
                          {g.nom}
                        </span>
                        <span className="font-mono text-[12.5px] text-slate-light">
                          {formatDate(g.date_fin, "sans date de fin")}
                          {jours !== null && jours >= 0 ? ` · J-${jours}` : ""}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-[17px] font-medium tabular-nums text-ink">
                        {g.pourcentage} %
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
