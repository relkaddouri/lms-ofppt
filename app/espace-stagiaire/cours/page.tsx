import Link from "next/link";
import { BookOpen, ChevronRight, FlaskConical, MessageCircle } from "lucide-react";
import { getMesSupports } from "@/app/actions/questions-support";
import { formatDateJour } from "@/lib/format";
import EnConstruction from "../EnConstruction";

export const metadata = { title: "Cours" };

export default async function CoursPage() {
  const supports = await getMesSupports();

  if (supports.length === 0) {
    return (
      <EnConstruction
        titre="Aucun cours"
        description="Les supports de cours et les énoncés de TP remis par votre formateur apparaîtront ici."
        Icone={BookOpen}
      />
    );
  }

  return (
    <div className="bg-surface md:overflow-hidden md:rounded-[14px] md:border md:border-border">
      <div className="flex flex-col gap-1.5 px-5 pb-3.5 pt-[22px]">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
          Mes documents
        </span>
        <h1 className="font-display text-[26px] font-bold leading-tight tracking-[-0.02em] text-ink">
          Supports de cours
        </h1>
        <span className="text-[14.5px] text-slate-light">
          <span className="font-mono text-body">{supports.length}</span> support
          {supports.length > 1 ? "s" : ""} · du plus récent au plus ancien
        </span>
      </div>

      {supports.map((s) => {
        const tp = s.type === "pratique";
        const Icone = tp ? FlaskConical : BookOpen;
        return (
          <Link
            key={s.id}
            href={`/espace-stagiaire/cours/${s.id}`}
            className="flex items-center gap-[13px] border-t border-separator bg-surface px-5 py-4 no-underline transition-colors duration-150 ease-out hover:bg-paper-alt hover:no-underline"
          >
            <span
              className={`flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[11px] ${
                tp ? "bg-success-wash" : "bg-tint-teal"
              }`}
            >
              <Icone
                size={19}
                strokeWidth={1.9}
                aria-hidden
                className={tp ? "text-green-dark" : "text-teal-dark"}
              />
            </span>

            <span className="flex min-w-0 flex-1 flex-col gap-[5px]">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate text-[15.5px] font-semibold text-ink">
                  {s.titre}
                </span>
                <span
                  className={`shrink-0 whitespace-nowrap rounded-full border px-2 py-px text-[11px] font-semibold ${
                    tp
                      ? "border-tint-green bg-success-wash text-green-dark"
                      : "border-tint-teal-strong bg-tint-teal text-teal-dark"
                  }`}
                >
                  {tp ? "TP" : "Cours"}
                </span>
              </span>
              <span className="flex items-center gap-3">
                <span className="truncate font-mono text-[12.5px] text-slate-light">
                  {[s.moduleNom, s.date ? formatDateJour(s.date) : null]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                {s.questions > 0 ? (
                  <span className="inline-flex shrink-0 items-center gap-[5px] font-mono text-[12.5px] text-teal-dark">
                    <MessageCircle size={12} aria-hidden />
                    {s.questions}
                  </span>
                ) : null}
              </span>
            </span>

            <ChevronRight
              size={15}
              strokeWidth={2.2}
              aria-hidden
              className="shrink-0 text-border-strong"
            />
          </Link>
        );
      })}

      <div className="flex justify-center border-t border-separator px-5 pb-2 pt-6">
        <span className="font-mono text-xs text-border-strong">
          Supports antérieurs archivés
        </span>
      </div>
    </div>
  );
}
