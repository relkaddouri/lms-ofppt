"use client";

import { useRouter } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import Button from "@/components/ui/Button";
import { inputStyles as inputClass } from "@/components/ui/Input";
import FicheSeance from "@/components/FicheSeance";
import { formatDate } from "@/lib/format";
import { dureeHeures } from "@/lib/creneaux";
import { type FichePreparation, type SeanceAPreparer } from "@/app/actions/fiches";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { libelleModule } from "@/lib/modules";

/**
 * Préparation d'une fiche depuis la page module.
 *
 * L'éditeur lui-même est partagé avec la page de séance : c'est le même
 * document officiel, il n'existe qu'en un seul exemplaire dans le code.
 */
export default function FichePreparationManager({
  moduleId,
  moduleNom,
  moduleCode,
  seances,
  seanceId,
  versions,
}: {
  moduleId: string;
  moduleNom: string;
  moduleCode: string | null;
  moduleDuree: number;
  seances: SeanceAPreparer[];
  seanceId: string | null;
  versions: FichePreparation[];
}) {
  const router = useRouter();
  const seance = seances.find((s) => s.id === seanceId) ?? null;

  const minutesSeance =
    seance?.heure_debut && seance.heure_fin
      ? Math.round(dureeHeures(seance.heure_debut, seance.heure_fin) * 60)
      : null;

  return (
    <div className="p-8">
      <Breadcrumb
        items={[
          { label: "Modules", href: "/modules" },
          { label: libelleModule(moduleCode, moduleNom), href: `/modules/${moduleId}` },
          { label: "Fiche de préparation" },
        ]}
      />

      <div className="mt-6 rounded-[14px] border border-border bg-surface p-4 shadow-repos">
        <label className="block text-sm font-medium text-ink" htmlFor="seance">
          Séance préparée
        </label>
        {seances.length === 0 ? (
          <p className="mt-2 rounded-lg bg-tint-teal px-3 py-2 text-sm text-ink">
            Aucune séance n&apos;est encore planifiée pour ce module. Créez le plan
            de déroulement depuis un groupe pour générer ses séances.
          </p>
        ) : (
          <>
            <select
              id="seance"
              value={seanceId ?? ""}
              onChange={(e) => router.push(`?seance=${e.target.value}`)}
              className={`${inputClass} mt-2`}
            >
              {seances.map((s) => (
                <option key={s.id} value={s.id}>
                  {[
                    s.groupe_nom,
                    s.date ? formatDate(s.date) : "date à définir",
                    s.heure_debut ? s.heure_debut.slice(0, 5) : null,
                    s.statut === "fait" ? "faite" : "à faire",
                    s.nb_versions > 0
                      ? `${s.nb_versions} version(s)`
                      : "aucune fiche",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </option>
              ))}
            </select>
            {seance ? (
              <Link
                href={`/groupes/${seance.groupe_id}/seances/${seance.id}`}
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-ink underline"
              >
                Ouvrir la page de cette séance — présences, remarques
                <ArrowRight className="h-3 w-3" />
              </Link>
            ) : null}
          </>
        )}
        {seance?.objectif_operationnel ? (
          <p className="mt-2 text-sm text-ink">
            <span className="text-slate">Objectif : </span>
            {seance.objectif_operationnel}
          </p>
        ) : null}
      </div>

      {seance ? (
        <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_220px]">
          <section className="rounded-[14px] border border-border bg-surface p-4">
            <FicheSeance
              contexte={{
                seanceId: seance.id,
                date: seance.date,
                dateFormatee: seance.date ? formatDate(seance.date) : null,
                groupeNom: seance.groupe_nom,
                filiere: seance.filiere,
                annee: seance.groupe_annee,
                moduleNom,
                minutesSeance,
              }}
              initial={versions[0]?.contenu ?? null}
            />
          </section>

          <aside className="rounded-[14px] border border-border bg-surface p-4">
            <h2 className="text-sm font-medium text-ink">Versions</h2>
            {versions.length === 0 ? (
              <p className="mt-2 text-sm text-slate">
                Aucune version enregistrée.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {versions.map((v) => (
                  <li
                    key={v.id}
                    className="rounded-lg border border-border px-3 py-2 text-sm text-slate"
                  >
                    <span className="font-mono">v{v.version}</span>
                    <span className="mt-0.5 block text-xs">
                      {new Date(v.created_at).toLocaleString("fr-FR")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      ) : null}
    </div>
  );
}
