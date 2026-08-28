"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { BLOCS, formatHeure } from "@/lib/creneaux";
import { formatDate } from "@/lib/format";
import type {
  SeanceCalendrier,
  ControleCalendrier,
} from "@/app/actions/calendrier";
import EfmRegionalForm from "./EfmRegionalForm";
import { ChevronLeft, ChevronRight } from "lucide-react";

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

const iso = (d: Date) => d.toISOString().slice(0, 10);

function decale(lundi: string, jours: number): string {
  const d = new Date(`${lundi}T12:00:00`);
  d.setDate(d.getDate() + jours);
  return iso(d);
}

/** Une séance appartient au bloc dans lequel son heure de début tombe. */
function blocDe(s: SeanceCalendrier): "matin" | "soir" {
  if (!s.heure_debut) return "matin";
  return s.heure_debut < BLOCS.soir.debut ? "matin" : "soir";
}

export default function CalendrierSemaine({
  lundi,
  seances,
  controles,
}: {
  lundi: string;
  seances: SeanceCalendrier[];
  controles: ControleCalendrier[];
}) {
  const router = useRouter();
  const jours = JOURS.map((nom, i) => ({ nom, date: decale(lundi, i) }));

  const parJourBloc = new Map<string, SeanceCalendrier[]>();
  for (const s of seances) {
    const cle = `${s.date}|${blocDe(s)}`;
    parJourBloc.set(cle, [...(parJourBloc.get(cle) ?? []), s]);
  }

  const controlesDuJour = (date: string) =>
    controles.filter(
      (c) => (c.date_administration ?? c.date_prevue) === date,
    );

  // Les épreuves régionales se saisissent, elles ne se déduisent pas : elles
  // ont leur propre bloc, hors de la grille hebdomadaire.
  const regionales = controles.filter(
    (c) => c.type === "EFM" && c.type_efm === "regional",
  );
  const sansDate = controles.filter(
    (c) => !c.date_prevue && !c.date_administration,
  );

  return (
    <div className="p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Calendrier</h1>
          <p className="mt-0.5 text-sm text-slate">
            Semaine du {formatDate(lundi)} au {formatDate(decale(lundi, 5))}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            icon={ChevronLeft}
            onClick={() => router.push(`/calendrier?semaine=${decale(lundi, -7)}`)}
          >
            Semaine précédente
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.push("/calendrier")}
          >
            Cette semaine
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={ChevronRight}
            onClick={() => router.push(`/calendrier?semaine=${decale(lundi, 7)}`)}
          >
            Semaine suivante
          </Button>
        </div>
      </header>

      {/* Légende : la distinction pointillé / plein porte tout le sens. */}
      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-6 rounded border border-dashed border-slate" />
          date estimée, ajustable
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-6 rounded border-2 border-solid border-forest" />
          date arrêtée
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-6 border-y border-dashed border-slate/60" />
          pause de 15 min
        </span>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse">
          <thead>
            <tr>
              <th className="w-24 border border-border bg-mist px-2 py-2 text-left text-xs font-medium text-slate">
                Bloc
              </th>
              {jours.map((j) => (
                <th
                  key={j.date}
                  className="border border-border bg-mist px-2 py-2 text-left text-xs font-medium text-slate"
                >
                  {j.nom}
                  <span className="ml-1 font-mono text-slate/70">
                    {formatDate(j.date)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(["matin", "soir"] as const).map((bloc) => {
              const b = BLOCS[bloc];
              return (
                <tr key={bloc}>
                  <th className="border border-border bg-mist px-2 py-2 text-left align-top">
                    <span className="block text-xs font-medium text-ink">
                      {b.label}
                    </span>
                    <span className="mt-0.5 block font-mono text-[11px] text-slate">
                      {formatHeure(b.debut)} – {formatHeure(b.fin)}
                    </span>
                    <span className="mt-1 block border-y border-dashed border-slate/60 py-0.5 font-mono text-[10px] text-slate">
                      pause {formatHeure(b.pause.debut)}
                    </span>
                  </th>

                  {jours.map((j) => {
                    const liste = parJourBloc.get(`${j.date}|${bloc}`) ?? [];
                    const ctrls =
                      bloc === "matin" ? controlesDuJour(j.date) : [];
                    return (
                      <td
                        key={j.date}
                        className="min-w-[140px] border border-border p-1.5 align-top"
                      >
                        <div className="space-y-1.5">
                          {ctrls.map((c) => (
                            <Link
                              key={c.id}
                              href={`/modules/${c.module_id}/controle`}
                              className={`block rounded-lg px-2 py-1.5 ${
                                c.confirmee
                                  ? "border-2 border-solid border-forest bg-mint"
                                  : "border border-dashed border-slate/60 bg-surface"
                              }`}
                            >
                              <span className="flex items-center gap-1">
                                <Badge
                                  tone={c.type === "EFM" ? "danger" : "info"}
                                >
                                  {c.type === "EFM"
                                    ? c.type_efm === "regional"
                                      ? "EFM régional"
                                      : "EFM local"
                                    : "CC"}
                                </Badge>
                              </span>
                              <span className="mt-0.5 block truncate text-xs text-ink">
                                {c.groupeNom} · {c.moduleNom}
                              </span>
                            </Link>
                          ))}

                          {liste.map((s) => (
                            <Link
                              key={s.id}
                              href={`/groupes/${s.groupe_id}/seances/${s.id}`}
                              className={`block rounded-lg border px-2 py-1.5 ${
                                s.statut === "fait"
                                  ? "border-border bg-mist text-slate"
                                  : "border-border bg-surface hover:border-forest/50"
                              }`}
                            >
                              <span className="flex items-baseline gap-1 font-mono text-[11px] text-slate">
                                {s.heure_debut ? formatHeure(s.heure_debut) : "—"}
                                {s.heure_fin ? `–${formatHeure(s.heure_fin)}` : ""}
                                <span
                                  className={
                                    s.nature === "pratique"
                                      ? "text-info"
                                      : "text-slate/70"
                                  }
                                >
                                  {s.nature === "pratique" ? "TP" : "cours"}
                                </span>
                              </span>
                              <span className="mt-0.5 block truncate text-xs font-medium text-ink">
                                {s.groupeNom}
                                {s.codeOperationnel
                                  ? ` · ${s.codeOperationnel}`
                                  : ""}
                              </span>
                              <span className="block truncate text-[11px] text-slate">
                                {s.objectif ?? s.moduleNom}
                              </span>
                            </Link>
                          ))}

                          {liste.length === 0 && ctrls.length === 0 ? (
                            <span className="block py-2 text-center text-[11px] text-slate/40">
                              —
                            </span>
                          ) : null}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {regionales.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-display text-lg font-bold text-ink">
            Épreuves de fin de module régionales
          </h2>
          <p className="mt-0.5 text-sm text-slate">
            Ces dates sont arrêtées par la région : elles se saisissent, elles ne
            s&apos;estiment pas.
          </p>
          <div className="mt-3 space-y-3">
            {regionales.map((c) => (
              <EfmRegionalForm key={c.id} controle={c} />
            ))}
          </div>
        </section>
      ) : null}

      {sansDate.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-sm font-medium text-ink">
            Contrôles sans date ({sansDate.length})
          </h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {sansDate.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/modules/${c.module_id}/controle`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate/60 px-2.5 py-1.5 text-xs text-ink hover:border-forest"
                >
                  <Badge tone={c.type === "EFM" ? "danger" : "info"}>
                    {c.type}
                  </Badge>
                  {c.groupeNom} · {c.titre ?? c.moduleNom}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
