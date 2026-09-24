import Link from "next/link";
import { ArrowLeft, BookOpen, Check, ChevronRight, FlaskConical, Milestone, Play } from "lucide-react";
import { formatDateJour } from "@/lib/format";
import type { Jalon, SommaireModule } from "@/app/actions/cours-stagiaire";

/** Le sommaire d'un module (PRD §4.5bis), séparé pour se relire seul. */
export default function SommaireVue({
  module,
  jalons = [],
}: {
  module: SommaireModule;
  jalons?: Jalon[];
}) {
  // Le bilan s'annonce après le dernier chapitre de son jalon : c'est là qu'il
  // tombe dans la lecture (PRD §4.5bis).
  const bilanApres = new Map(jalons.map((j) => [j.chapitres.at(-1)!.id, j]));
  // Reprendre, c'est ouvrir le premier chapitre non terminé — et, quand tout
  // l'est, revenir au premier pour réviser.
  const suite = module.parties.flatMap((p) => p.chapitres);
  const reprendre = suite.find((c) => !c.lu) ?? suite[0];
  const fini = module.lus >= module.chapitres && module.chapitres > 0;
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <Link
        href="/espace-stagiaire/cours"
        className="mx-5 inline-flex min-h-[44px] items-center gap-1.5 self-start text-sm text-slate hover:text-ink md:mx-0"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Mes modules
      </Link>

      <header className="mx-5 flex flex-col gap-2 rounded-[14px] bg-ink px-5 py-6 text-white md:mx-0 md:px-8 md:py-7">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/50">
          {[module.code, `${module.chapitres} chapitre${module.chapitres > 1 ? "s" : ""}`]
            .filter(Boolean)
            .join(" · ")}
        </span>
        <h1 className="text-balance font-display text-[23px] font-bold leading-[1.15] tracking-[-0.02em] md:text-[28px]">
          {module.nom}
        </h1>
        <p className="text-[14.5px] leading-relaxed text-white/70">
          {module.parties.length} partie{module.parties.length > 1 ? "s" : ""} —
          reprenez un chapitre où vous voulez, l&apos;ordre est celui du
          référentiel.
        </p>

        <div className="mt-2 flex flex-col gap-2">
          <span className="flex items-center gap-3">
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/15">
              <span
                className="block h-full rounded-full bg-green transition-[width] duration-300"
                style={{ width: `${module.progression}%` }}
              />
            </span>
            <span className="shrink-0 font-mono text-[13px] font-semibold text-white/90">
              {module.progression} %
            </span>
          </span>
          <span className="font-mono text-[12px] text-white/55">
            {module.lus} / {module.chapitres} chapitres terminés
          </span>
        </div>

        {reprendre ? (
          <Link
            href={`/espace-stagiaire/cours/${reprendre.id}`}
            className="mt-3 inline-flex min-h-[44px] items-center gap-2 self-start rounded-[10px] bg-white px-4 text-[14.5px] font-semibold text-ink no-underline hover:no-underline"
          >
            <Play className="h-4 w-4" aria-hidden />
            {fini
              ? `Revoir le chapitre 1 : ${reprendre.titre}`
              : module.lus === 0
                ? `Commencer : ${reprendre.titre}`
                : `Reprendre au chapitre ${reprendre.numero}`}
          </Link>
        ) : null}
      </header>

      <ol className="flex flex-col gap-4 px-5 md:px-0">
        {module.parties.map((partie, i) => (
          <li
            key={partie.lettre}
            className="overflow-hidden rounded-[14px] border border-border bg-surface"
          >
            <div className="flex flex-col gap-0.5 bg-wash px-5 py-3.5">
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-teal-dark">
                Partie {i + 1} · {partie.lettre}
              </span>
              <h2 className="font-display text-[16.5px] font-semibold leading-snug text-ink">
                {partie.intitule}
              </h2>
            </div>

            <ul className="flex flex-col">
              {partie.chapitres.map((c) => {
                const tp = c.type === "pratique";
                const Icone = tp ? FlaskConical : BookOpen;
                return (
                  <li key={c.id} className="border-t border-separator">
                    <Link
                      href={`/espace-stagiaire/cours/${c.id}`}
                      className="flex items-center gap-3.5 px-5 py-3.5 no-underline transition-colors duration-150 ease-out hover:bg-paper-alt hover:no-underline"
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${
                          c.lu
                            ? "bg-green text-white"
                            : tp
                              ? "bg-success-wash text-green-dark"
                              : "bg-tint-teal text-teal-dark"
                        }`}
                      >
                        {c.lu ? (
                          <Check size={17} strokeWidth={2.6} aria-hidden />
                        ) : (
                          <Icone size={17} strokeWidth={1.9} aria-hidden />
                        )}
                      </span>

                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-[15.5px] font-semibold text-ink">
                            {c.titre}
                          </span>
                          {tp ? (
                            <span className="shrink-0 whitespace-nowrap rounded-full border border-tint-green bg-success-wash px-2 py-px text-[11px] font-semibold text-green-dark">
                              TP
                            </span>
                          ) : null}
                        </span>
                        <span className="font-mono text-[12px] text-slate-light">
                          {[
                            `Chapitre ${c.numero}`,
                            c.lu ? "terminé" : null,
                            c.date ? formatDateJour(c.date, { court: true }) : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>

                      <ChevronRight
                        size={16}
                        strokeWidth={2.2}
                        aria-hidden
                        className="shrink-0 text-border-strong"
                      />
                    </Link>
                    {bilanApres.has(c.id) ? (
                      <Link
                        href={`/espace-stagiaire/cours/module/${module.id}/bilan/${bilanApres.get(c.id)!.rang}`}
                        className="flex items-center gap-3.5 border-t border-separator bg-wash px-5 py-3.5 no-underline transition-colors duration-150 ease-out hover:bg-paper-alt hover:no-underline"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-ink text-white">
                          <Milestone size={17} strokeWidth={1.9} aria-hidden />
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="text-[15px] font-semibold text-ink">
                            Bilan {bilanApres.get(c.id)!.rang} — chapitres{" "}
                            {bilanApres.get(c.id)!.chapitres[0]!.numero} à{" "}
                            {bilanApres.get(c.id)!.chapitres.at(-1)!.numero}
                          </span>
                          <span className="font-mono text-[12px] text-slate-light">
                            {bilanApres.get(c.id)!.pret
                              ? "les trois chapitres sont terminés"
                              : "révision des trois chapitres"}
                          </span>
                        </span>
                        <ChevronRight size={16} strokeWidth={2.2} aria-hidden className="shrink-0 text-border-strong" />
                      </Link>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
