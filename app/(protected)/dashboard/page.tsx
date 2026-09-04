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
import { getUser } from "@/lib/supabase/server";
import { getAnneeCourante } from "@/app/actions/annees";
import DashboardCharts from "./DashboardCharts";
import { formatDateJour, maintenant } from "@/lib/format";

export const metadata = { title: "Tableau de bord" };


/**
 * Numéro court d'un groupe : les chiffres de fin de son nom.
 * « DDOUX201 » → « 201 ». Sans chiffres, on retombe sur les deux premières
 * lettres pour que la pastille ne reste jamais vide.
 */
function numeroDe(nom: string): string {
  return nom.match(/(\d{2,4})$/)?.[1] ?? nom.slice(0, 2).toUpperCase();
}

/** Couleur de la barre : verte au-dessus de 80 %, sarcelle au-dessus de 50 %. */
function tonProgression(pourcentage: number): string {
  if (pourcentage >= 80) return "bg-green";
  if (pourcentage >= 50) return "bg-teal";
  return "bg-slate-light";
}

/** Jours restants avant une date, ou null si elle n'est pas fixée. */
function joursAvant(date: string | null): number | null {
  if (!date) return null;
  const jour = 86_400_000;
  const aujourdhui = maintenant();
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

/** Prénom déduit de l'adresse : « rachid.elkaddouri1@… » → « Rachid ». */
function prenomDe(email: string | null): string | null {
  const local = email?.split("@")[0];
  if (!local) return null;
  const brut = local.split(/[._-]/)[0]?.replace(/\d+$/, "");
  if (!brut) return null;
  return brut.charAt(0).toUpperCase() + brut.slice(1).toLowerCase();
}

export default async function DashboardPage() {
  const [{ stats, groupes, evolution }, user, annee] = await Promise.all([
    getDashboardData(),
    getUser(),
    getAnneeCourante(),
  ]);
  const enAttente = stats.controlesEnAttente;
  const prenom = prenomDe(user?.email ?? null);

  // PRD §4.15 : le bandeau annonce l'année sélectionnée. Le déduire de la date
  // du jour le faisait contredire le sélecteur — on consultait 2025/2026 sous
  // un titre « 2026 — 2027 ».
  const libelleBandeau = annee
    ? annee.libelle.replace("/", " — ")
    : "non déclarée";

  return (
    <div className="flex flex-col gap-8 px-6 py-10 md:px-10 md:pb-14">
      <header className="flex flex-wrap items-end justify-between gap-8">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[11.5px] uppercase tracking-[0.12em] text-slate-light">
            Année de formation {libelleBandeau}
          </span>
          <h1 className="font-display text-[34px] font-bold leading-tight tracking-[-0.02em] text-ink">
            Tableau de bord
          </h1>
          <p className="text-base text-slate-2">
            {prenom ? `Bonjour ${prenom} — ` : ""}
            {enAttente === 0
              ? "aucun contrôle n’attend votre validation cette semaine."
              : `${enAttente} contrôle${enAttente > 1 ? "s" : ""} attend${
                  enAttente > 1 ? "ent" : ""
                } votre validation cette semaine.`}
          </p>
        </div>
        <div className="flex gap-2.5">
          {/* Présents parce que la maquette les montre ; inertes jusqu'à leur
              propre atome, et signalés comme tels par le curseur et l'attribut
              disabled — un bouton sans fonction ne doit pas se laisser cliquer. */}
          <button
            type="button"
            disabled
            title="Disponible prochainement"
            className="rounded-[9px] border border-border-strong bg-surface px-[18px] py-2.5 text-[14.5px] font-semibold text-ink disabled:cursor-not-allowed disabled:border-border disabled:bg-wash-strong disabled:text-muted"
          >
            Exporter
          </button>
          <button
            type="button"
            disabled
            title="Disponible prochainement"
            className="rounded-[9px] border border-ink bg-ink px-[18px] py-2.5 text-[14.5px] font-semibold text-white disabled:cursor-not-allowed disabled:border-border disabled:bg-wash-strong disabled:text-muted"
          >
            Nouvelle séance
          </button>
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
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="font-display text-[17px] font-semibold text-ink">
                Évolution de la progression
              </h2>
              <span className="text-[13.5px] text-slate-light">
                Moyenne des {groupes.length} groupe
                {groupes.length > 1 ? "s" : ""} · 30 derniers jours travaillés
              </span>
            </div>
            {evolution.gain !== 0 ? (
              <span
                className={`shrink-0 rounded-full border px-3 py-1 font-mono text-sm font-medium ${
                  evolution.gain > 0
                    ? "border-tint-green bg-success-wash text-green-dark"
                    : "border-tint-alert-strong bg-alert-wash text-coral-dark"
                }`}
              >
                {evolution.gain > 0 ? "+" : ""}
                {evolution.gain} pts
              </span>
            ) : null}
          </div>

          <DashboardCharts points={evolution.points} />

          <div className="flex items-center gap-5 border-t border-separator pt-[18px]">
            <span className="flex items-center gap-2 text-[13.5px] text-body">
              <span className="h-[2.5px] w-3.5 rounded-sm bg-ink" aria-hidden />
              Réalisé
            </span>
            <span className="flex items-center gap-2 text-[13.5px] text-slate">
              <span className="h-0.5 w-3.5 rounded-sm bg-muted" aria-hidden />
              Prévisionnel
            </span>
            <span className="ml-auto font-mono text-[15px] font-medium text-ink">
              {evolution.actuel} %
            </span>
          </div>
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
              {groupes.map((g, rang) => {
                const jours = joursAvant(g.date_fin);
                // Un seul J-n corail par écran : celui du groupe le plus
                // pressé, et seulement s'il l'est vraiment. La maquette n'en
                // montre qu'un, et la règle du corail l'impose.
                const urgent =
                  rang === 0 && jours !== null && jours >= 0 && jours <= 30;
                // La pastille suit le rang d'urgence, comme dans la maquette :
                // le plus pressé en bleu-ardoise, le suivant en sarcelle, les
                // autres en neutre.
                const pastille =
                  rang === 0
                    ? "bg-ink text-white"
                    : rang === 1
                      ? "bg-teal text-white"
                      : "bg-wash text-slate-2";
                return (
                  <li key={g.id} className="border-b border-separator last:border-0">
                    <Link
                      href={`/groupes/${g.id}/progression`}
                      className="grid grid-cols-[minmax(0,1.4fr)_minmax(72px,0.7fr)_minmax(110px,1fr)] items-center gap-4 px-6 py-[18px] no-underline transition-colors duration-150 ease-out hover:bg-paper hover:no-underline"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] font-mono text-xs font-semibold ${pastille}`}
                        >
                          {numeroDe(g.nom)}
                        </span>
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="truncate text-[15.5px] font-semibold text-ink">
                            {g.nom}
                          </span>
                          <span className="truncate text-[13px] text-slate-light">
                            {g.masseHoraire > 0
                              ? `${g.heuresRealisees} h / ${g.masseHoraire} h`
                              : "Masse horaire non allouée"}
                          </span>
                        </span>
                      </span>

                      <span className="flex flex-col gap-0.5">
                        <span className="font-mono text-[13px] text-slate-2">
                          {formatDateJour(g.date_fin, { court: true }, "—")}
                        </span>
                        {jours !== null && jours >= 0 ? (
                          <span
                            className={`font-mono text-[12.5px] ${
                              urgent ? "text-coral-dark" : "text-slate-light"
                            }`}
                          >
                            J-{jours}
                          </span>
                        ) : null}
                      </span>

                      <span className="flex items-center gap-3">
                        <span className="h-2 min-w-[80px] flex-1 overflow-hidden rounded-full bg-wash">
                          <span
                            className={`block h-full rounded-full ${tonProgression(g.pourcentage)}`}
                            style={{ width: `${Math.min(100, g.pourcentage)}%` }}
                          />
                        </span>
                        <span className="shrink-0 font-mono text-sm font-medium tabular-nums text-ink">
                          {g.pourcentage} %
                        </span>
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
