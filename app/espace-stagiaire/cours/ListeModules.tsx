import Link from "next/link";
import { ChevronRight, Layers } from "lucide-react";
import { formatDateJour } from "@/lib/format";
import type { ModuleCours } from "@/app/actions/cours-stagiaire";
import EnTete from "../EnTete";

/** La liste des modules du stagiaire (PRD §4.5bis), séparée pour se relire seule. */
export default function ListeModules({ modules }: { modules: ModuleCours[] }) {
  const total = modules.reduce((t, m) => t + m.chapitres, 0);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <EnTete
        surtitre="Mes cours"
        titre="Modules"
        dansCarte={false}
        resume={
          <>
            <span className="font-mono text-body">{modules.length}</span> module
            {modules.length > 1 ? "s" : ""} ·{" "}
            <span className="font-mono text-body">{total}</span> chapitre
            {total > 1 ? "s" : ""} à réviser
          </>
        }
      />

      <ul className="flex flex-col gap-3 px-5 md:px-0">
        {modules.map((m) => (
          <li key={m.id}>
            <Link
              href={`/espace-stagiaire/cours/module/${m.id}`}
              className="flex items-center gap-4 rounded-[14px] border border-border bg-surface px-4 py-4 no-underline transition-colors duration-150 ease-out hover:border-border-strong hover:no-underline md:px-5"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] bg-tint-teal font-mono text-[13px] font-semibold text-teal-dark">
                {m.code ?? <Layers className="h-5 w-5" aria-hidden />}
              </span>

              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="text-[16px] font-semibold leading-snug text-ink">
                  {m.nom}
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-1.5 w-full max-w-[200px] overflow-hidden rounded-full bg-wash-strong">
                    <span
                      className="block h-full rounded-full bg-green"
                      style={{ width: `${m.progression}%` }}
                    />
                  </span>
                  <span className="shrink-0 font-mono text-[12px] text-slate">
                    {m.progression} %
                  </span>
                </span>
                <span className="font-mono text-[12.5px] text-slate-light">
                  {[
                    `${m.lus} / ${m.chapitres} chapitre${m.chapitres > 1 ? "s" : ""}`,
                    m.dernier
                      ? `dernier le ${formatDateJour(m.dernier, { court: true })}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>

              <ChevronRight
                size={18}
                strokeWidth={2.2}
                aria-hidden
                className="shrink-0 text-border-strong"
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
