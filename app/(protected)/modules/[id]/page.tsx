import { getModuleDetail } from "@/app/actions/modules";
import { getManuel } from "@/app/actions/manuel";
import ReferentielCompetence from "@/components/ReferentielCompetence";
import { redirect } from "next/navigation";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumb";
import Badge from "@/components/ui/Badge";
import DureeReferenceEditor from "./DureeReferenceEditor";
import { FileText, FolderKanban, ListChecks, Plus, Users } from "lucide-react";

const linkBtn =
  "inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink hover:bg-paper focus:outline-none focus:ring-2 focus:ring-ink";

export default async function ModuleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [detail, referentiel] = await Promise.all([
    getModuleDetail(id),
    getManuel(id),
  ]);
  if (!detail) redirect("/modules");

  const { module, competence, controles, hasFiche, groupes } = detail;

  return (
    <div className="flex flex-col gap-6 px-6 py-10 md:px-10 md:pb-14">
      <Breadcrumb
        items={[
          { label: "Modules", href: "/modules" },
          { label: competence?.code_operationnel ?? module.nom },
        ]}
      />

      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex min-w-0 flex-col gap-2">
          {competence?.code_operationnel ? (
            <span className="w-fit rounded-[9px] bg-wash px-2.5 py-1 font-mono text-xs font-semibold text-slate-2">
              {competence.code_operationnel}
            </span>
          ) : null}
          <h1 className="font-display text-[34px] font-bold leading-tight tracking-[-0.02em] text-ink">
            {module.nom}
          </h1>
          <p className="flex flex-wrap items-center gap-2 text-base text-slate-2">
            <span className="font-mono text-body">
              {module.duree_reference} h
            </span>
            {module.description ? (
              <>
                <span className="text-border-strong" aria-hidden>
                  ·
                </span>
                <span>{module.description}</span>
              </>
            ) : null}
          </p>
        </div>

        <DureeReferenceEditor
          moduleId={id}
          dureeReference={module.duree_reference}
          competence={competence}
        />
      </header>

      {referentiel ? <ReferentielCompetence referentiel={referentiel} /> : null}

      <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
        <section className="flex flex-col gap-4 rounded-[14px] border border-border bg-surface p-6 shadow-repos">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-wash text-slate-2">
              <FileText size={16} />
            </div>
            <div>
              <h2 className="font-display text-[17px] font-semibold text-ink">
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

        <section className="flex flex-col gap-4 rounded-[14px] border border-border bg-surface p-6 shadow-repos">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-wash text-slate-2">
              <ListChecks size={16} />
            </div>
            <div>
              <h2 className="font-display text-[17px] font-semibold text-ink">
                Contrôles
              </h2>
              <p className="text-xs text-slate">
                {controles.length} contrôle{controles.length > 1 ? "s" : ""}
              </p>
            </div>
          </div>
          {groupes.length === 0 ? (
            <p className="mt-4 text-sm text-slate">
              Assignez ce module à un groupe pour préparer un contrôle : un
              contrôle porte toujours sur ce qu&apos;un groupe précis a couvert.
            </p>
          ) : (
            <ul className="mt-4 space-y-1">
              {groupes.map((g) => (
                <li key={g.id}>
                  <Link
                    href={`/modules/${id}/controle?groupe=${g.id}`}
                    className={linkBtn}
                  >
                    <Plus size={16} aria-hidden />
                    Contrôles de {g.nom}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-4 rounded-[14px] border border-border bg-surface p-6 shadow-repos">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-wash text-slate-2">
              <Users size={16} />
            </div>
            <div>
              <h2 className="font-display text-[17px] font-semibold text-ink">Groupes</h2>
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
                    className="inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-sm text-ink hover:text-ink focus:outline-none focus:ring-2 focus:ring-ink"
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
          <h2 className="font-display text-[17px] font-semibold text-ink">Contrôles du module</h2>
          <div className="mt-4 overflow-hidden rounded-[14px] border border-border bg-surface shadow-repos">
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
                    className="border-t border-border transition-colors hover:bg-wash/50"
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
