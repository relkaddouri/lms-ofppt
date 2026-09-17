"use client";

import { Plus } from "lucide-react";
import { formatDateJour } from "@/lib/format";
import type { Controle } from "@/app/actions/controles";

function nature(c: Controle): string {
  if (c.type === "TEST") return "Test";
  if (c.type === "EFM") return c.type_efm === "regional" ? "EFM régional" : "EFM local";
  return "CC";
}

const points = (n: number) =>
  `${String(n).replace(".", ",")} pt${n > 1 ? "s" : ""}`;

/**
 * Les contrôles du groupe sur ce module, côte à côte (PRD §4.7bis).
 *
 * Remplace la liste déroulante « — Nouveau contrôle — » : un menu ne montrait
 * qu'un titre — souvent le même pour tous —, rien de l'état du contrôle, et
 * ouvrir un brouillon ressemblait à en créer un nouveau. Ici chaque contrôle
 * dit ce qu'il est avant qu'on l'ouvre, et celui qu'on édite se voit.
 */
export default function ListeControles({
  controles,
  activeId,
  nouveau,
  onOuvrir,
  onNouveau,
}: {
  controles: Controle[];
  activeId: string | null;
  /** Un contrôle pas encore enregistré est en cours d'édition. */
  nouveau: boolean;
  onOuvrir: (id: string) => void;
  onNouveau: () => void;
}) {
  return (
    <section aria-label="Contrôles du groupe sur ce module" className="mt-6">
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(230px,1fr))]">
        {controles.map((c) => {
          const actif = c.id === activeId;
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={actif}
              onClick={() => (actif ? null : onOuvrir(c.id))}
              className={`flex min-h-[112px] flex-col gap-2 rounded-[12px] border bg-surface px-4 py-3.5 text-left transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                actif
                  ? "border-ink shadow-[0_0_0_1px_var(--color-ink)]"
                  : "border-border hover:border-border-strong"
              }`}
            >
              <span className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-px font-mono text-[11.5px] font-semibold ${
                    c.type === "TEST"
                      ? "bg-wash-strong text-slate-2"
                      : c.type === "EFM"
                        ? "bg-alert-wash text-coral-dark"
                        : "bg-tint-teal text-teal-dark"
                  }`}
                >
                  {nature(c)}
                </span>
                <span
                  className={`ml-auto text-[12px] font-semibold ${
                    c.statut === "valide" ? "text-green-dark" : "text-slate"
                  }`}
                >
                  {c.statut === "valide" ? "Validé" : "Brouillon"}
                </span>
              </span>
              <span className="line-clamp-2 text-[14.5px] font-semibold leading-snug text-ink">
                {c.titre?.trim() || "Sans titre"}
              </span>
              <span className="mt-auto font-mono text-[12px] text-slate-light">
                {[
                  c.nb_questions
                    ? `${c.nb_questions} question${c.nb_questions > 1 ? "s" : ""} · ${points(c.total_questions ?? 0)}`
                    : "aucune question",
                  c.date_prevue
                    ? formatDateJour(c.date_prevue, { court: true })
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          aria-pressed={nouveau}
          onClick={onNouveau}
          className={`flex min-h-[112px] flex-col items-center justify-center gap-1.5 rounded-[12px] border border-dashed px-4 py-3.5 text-center transition-colors duration-150 ease-out ${
            nouveau
              ? "border-ink bg-surface text-ink"
              : "border-border-strong text-slate-2 hover:border-ink hover:text-ink"
          }`}
        >
          <Plus className="h-5 w-5" aria-hidden />
          <span className="text-[14px] font-semibold">
            {nouveau ? "Nouveau contrôle en cours" : "Nouveau contrôle"}
          </span>
        </button>
      </div>
    </section>
  );
}
