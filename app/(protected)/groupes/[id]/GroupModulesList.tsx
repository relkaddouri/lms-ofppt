import Link from "next/link";
import { FileText, ListChecks } from "lucide-react";
import Badge from "@/components/ui/Badge";
import type { GroupeModuleInfo } from "@/app/actions/groupes";
import { libelleModule } from "@/lib/modules";

export default function GroupModulesList({
  modules,
  kind,
  groupeId,
}: {
  modules: GroupeModuleInfo[];
  kind: "fiches" | "controles";
  groupeId: string;
}) {
  if (modules.length === 0) {
    return (
      <div className="mt-6 rounded-[14px] border border-dashed border-border bg-surface shadow-repos p-10 text-center">
        <p className="text-sm text-slate">
          Aucun module assigné à ce groupe.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-3">
      {modules.map((m) => {
        const href =
          kind === "fiches"
            ? `/modules/${m.module_id}/fiche-preparation`
            : `/modules/${m.module_id}/controle?groupe=${groupeId}`;

        const status =
          kind === "fiches" ? (
            m.hasFiche ? (
              <Badge tone="success">Fiche disponible</Badge>
            ) : (
              <Badge tone="neutral">Aucune fiche</Badge>
            )
          ) : m.controleStatut === "valide" ? (
            <Badge tone="success">Validé</Badge>
          ) : m.controleStatut === "brouillon" ? (
            <Badge tone="info">Brouillon</Badge>
          ) : (
            <Badge tone="neutral">Aucun contrôle</Badge>
          );

        return (
          <div
            key={m.module_id}
            // Sous 768px le bouton « Ouvrir » et le badge écrasaient
            // l'intitulé du module : la ligne s'empile (§3bis).
            className="flex flex-col gap-3 rounded-[14px] border border-border bg-surface p-4 shadow-repos md:flex-row md:items-center md:justify-between md:gap-4"
          >
            <div className="flex min-w-0 items-center gap-3">
              {m.code_operationnel ? (
                <span className="shrink-0 rounded-[9px] bg-wash px-2.5 py-1 font-mono text-xs font-semibold text-slate-2">
                  {m.code_operationnel}
                </span>
              ) : null}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink md:truncate">
                  {m.nom}
                </p>
                <p className="mt-0.5 text-xs text-slate">
                  {m.duree_reference} h
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-3">
              {status}
              <Link
                href={href}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink hover:bg-paper focus:outline-none focus:ring-2 focus:ring-ink max-md:min-h-11 max-md:flex-1 max-md:justify-center"
              >
                {kind === "fiches" ? (
                  <FileText size={16} />
                ) : (
                  <ListChecks size={16} />
                )}
                {kind === "fiches" ? "Ouvrir la fiche" : "Ouvrir le contrôle"}
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
