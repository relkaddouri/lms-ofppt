import { getModuleDetail } from "@/app/actions/modules";
import { redirect } from "next/navigation";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumb";
import Badge from "@/components/ui/Badge";
import DureeReferenceEditor from "./DureeReferenceEditor";
import { FileText, FolderKanban, ListChecks, Plus, Users } from "lucide-react";

const linkBtn =
  "inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink hover:bg-paper focus:outline-none focus:ring-2 focus:ring-forest";

export default async function ModuleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const detail = await getModuleDetail(id);
  if (!detail) redirect("/modules");

  const { module, competence, controles, hasFiche, groupes } = detail;

  return (
    <div className="p-8">
      <Breadcrumb
        items={[{ label: "Modules", href: "/modules" }, { label: module.nom }]}
      />

      <div className="mt-2 flex flex-wrap items-baseline gap-2">
        {competence?.code_operationnel ? (
          <span className="font-mono text-lg font-medium text-forest">
            {competence.code_operationnel}
          </span>
        ) : null}
        <h1 className="font-display text-[24px] font-bold text-ink">
          {module.nom}
        </h1>
      </div>

      <DureeReferenceEditor
        moduleId={id}
        dureeReference={module.duree_reference}
        competence={competence}
      />
      {module.description ? (
        <p className="mt-1 max-w-[640px] text-sm text-slate">
          {module.description}
        </p>
      ) : null}

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mint text-forest">
              <FileText size={16} />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-ink">
                Fiche de préparation
              </h2>
              {hasFiche ? (
                <Badge tone="success">Fiche disponible</Badge>
              ) : (
                <Badge tone="neutral">Aucune fiche</Badge>
              )}
            </div>
          </div>
          <Link
            href={`/modules/${id}/fiche-preparation`}
            className={`${linkBtn} mt-4`}
          >
            <FileText size={16} />
            Ouvrir la fiche
          </Link>
        </section>

        <section className="rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mint text-forest">
              <ListChecks size={16} />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-ink">
                Contrôles
              </h2>
              <p className="text-xs text-slate">
                {controles.length} contrôle{controles.length > 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <Link href={`/modules/${id}/controle`} className={`${linkBtn} mt-4`}>
            <Plus size={16} />
            Gérer les contrôles
          </Link>
        </section>

        <section className="rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mint text-forest">
              <Users size={16} />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-ink">Groupes</h2>
              <p className="text-xs text-slate">
                {groupes.length} groupe{groupes.length > 1 ? "s" : ""}
              </p>
            </div>
          </div>
          {groupes.length === 0 ? (
            <p className="mt-4 text-sm text-slate">
              Aucun groupe ne suit ce module pour l&apos;instant.
            </p>
          ) : (
            <ul className="mt-4 space-y-1">
              {groupes.map((g) => (
                <li key={g.id}>
                  <Link
                    href={`/groupes/${g.id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-sm text-ink hover:text-forest focus:outline-none focus:ring-2 focus:ring-forest"
                  >
                    <FolderKanban size={16} />
                    {g.nom}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {controles.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-display text-xl font-bold text-ink">Contrôles du module</h2>
          <div className="mt-4 overflow-hidden rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-paper text-xs uppercase tracking-wide text-slate">
                  <th className="px-4 py-3 font-medium">Titre</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 text-right font-medium">Accès</th>
                </tr>
              </thead>
              <tbody>
                {controles.map((c) => (
                  <tr
                    key={c.id}
                    className="border-t border-border transition-colors hover:bg-mint/50"
                  >
                    <td className="px-4 py-3 font-medium text-ink">
                      {c.titre ?? "Sans titre"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={c.statut === "valide" ? "success" : "info"}>
                        {c.statut === "valide" ? "Validé" : "Brouillon"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/modules/${id}/controle`}
                        className={linkBtn}
                      >
                        Ouvrir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
