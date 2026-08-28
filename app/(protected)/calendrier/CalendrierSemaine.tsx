"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { BLOCS, formatHeure } from "@/lib/creneaux";
import { formatDate, formatHeures } from "@/lib/format";
import type {
  SeanceCalendrier,
  ControleCalendrier,
  APlanifier,
} from "@/app/actions/calendrier";
import EfmRegionalForm from "./EfmRegionalForm";
import SuiviHeures from "@/components/SuiviHeures";
import type { BilanHeures } from "@/lib/heures-formateur";
import { CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

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
  aPlanifier,
  seancesSansDate,
  bilan,
}: {
  lundi: string;
  seances: SeanceCalendrier[];
  controles: ControleCalendrier[];
  aPlanifier: APlanifier[];
  seancesSansDate: number;
  bilan: BilanHeures;
}) {
  const router = useRouter();
  const aujourdhui = iso(new Date());
  const jours = JOURS.map((nom, i) => {
    const date = decale(lundi, i);
    return { nom, date, estAujourdhui: date === aujourdhui };
  });

  const parJourBloc = new Map<string, SeanceCalendrier[]>();
  for (const s of seances) {
    const cle = `${s.date}|${blocDe(s)}`;
    parJourBloc.set(cle, [...(parJourBloc.get(cle) ?? []), s]);
  }

  const controlesDuJour = (date: string) =>
    controles.filter((c) => (c.date_administration ?? c.date_prevue) === date);

  const heuresSemaine = seances.reduce((t, s) => {
    if (!s.heure_debut || !s.heure_fin) return t;
    const min = (h: string) => {
      const [a, b] = h.split(":").map(Number);
      return a * 60 + b;
    };
    return t + (min(s.heure_fin) - min(s.heure_debut)) / 60;
  }, 0);

  const groupesSemaine = [...new Set(seances.map((s) => s.groupeNom))];
  const controlesSemaine = jours.flatMap((j) => controlesDuJour(j.date)).length;

  const regionales = controles.filter(
    (c) => c.type === "EFM" && c.type_efm === "regional",
  );
  const controlesSansDate = controles.filter(
    (c) => !c.date_prevue && !c.date_administration,
  );

  // La légende n'a de sens que si la distinction est visible dans la grille.
  const afficherLegende = controlesSemaine > 0 || regionales.length > 0;

  return (
    <div className="p-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Calendrier</h1>
          <p className="mt-0.5 text-sm text-slate">
            Semaine du {formatDate(lundi)} au {formatDate(decale(lundi, 5))}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            icon={ChevronLeft}
            aria-label="Semaine précédente"
            onClick={() => router.push(`/calendrier?semaine=${decale(lundi, -7)}`)}
          >
            {""}
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
            aria-label="Semaine suivante"
            onClick={() => router.push(`/calendrier?semaine=${decale(lundi, 7)}`)}
          >
            {""}
          </Button>
        </div>
      </header>

      {/* Ce que la semaine représente, avant de la détailler. */}
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
        <span className="text-ink">
          <span className="font-semibold">{seances.length}</span> séance
          {seances.length > 1 ? "s" : ""}
        </span>
        <span className="text-ink">
          <span className="font-semibold">{formatHeures(heuresSemaine)}</span> de
          cours
        </span>
        {controlesSemaine > 0 ? (
          <span className="text-ink">
            <span className="font-semibold">{controlesSemaine}</span> contrôle
            {controlesSemaine > 1 ? "s" : ""}
          </span>
        ) : null}
        {groupesSemaine.length > 0 ? (
          <span className="text-slate">{groupesSemaine.join(", ")}</span>
        ) : null}
      </div>

      {afficherLegende ? (
        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-6 rounded border border-dashed border-slate" />
            date estimée
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-6 rounded border-2 border-solid border-forest" />
            date arrêtée
          </span>
        </div>
      ) : null}

      <div className="mt-4 grid gap-6 2xl:grid-cols-[1fr_320px]">
        <div className="overflow-x-auto">
          {/* `table-fixed` donne aux six jours la même largeur : sans lui, le
              seul jour occupé écrasait les cinq autres. */}
          <table className="w-full min-w-[680px] table-fixed border-collapse overflow-hidden rounded-xl border border-border bg-surface">
            <colgroup>
              <col className="w-[124px]" />
              {jours.map((j) => (
                <col key={j.date} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th className="border-b border-border bg-mist px-3 py-2.5" />
                {jours.map((j) => (
                  <th
                    key={j.date}
                    scope="col"
                    className={`border-b border-l border-border px-3 py-2.5 text-left ${
                      j.estAujourdhui ? "bg-mint" : "bg-mist"
                    }`}
                  >
                    <span className="flex items-baseline gap-1.5">
                      <span
                        className={`text-sm font-semibold ${
                          j.estAujourdhui ? "text-forest" : "text-ink"
                        }`}
                      >
                        {j.nom}
                      </span>
                      <span
                        className={`text-xs ${
                          j.estAujourdhui ? "text-forest/70" : "text-slate"
                        }`}
                      >
                        {j.date.slice(8, 10)}/{j.date.slice(5, 7)}
                      </span>
                      {j.estAujourdhui ? (
                        <span
                          className="ml-auto h-1.5 w-1.5 rounded-full bg-forest"
                          aria-label="aujourd'hui"
                        />
                      ) : null}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(["matin", "soir"] as const).map((bloc) => {
                const b = BLOCS[bloc];
                return (
                  <tr key={bloc} className="border-t border-border first:border-t-0">
                    <th scope="row" className="bg-mist px-3 py-3 text-left align-top">
                      <span className="block text-sm font-medium text-ink">
                        {b.label}
                      </span>
                      <span className="mt-0.5 block whitespace-nowrap text-xs text-slate">
                        {formatHeure(b.debut)} – {formatHeure(b.fin)}
                      </span>
                      <span className="mt-2 flex items-center gap-1.5 text-[11px] text-slate/70">
                        <span className="h-px w-3 border-t border-dashed border-slate/50" />
                        pause {formatHeure(b.pause.debut)}
                      </span>
                    </th>

                    {jours.map((j) => {
                      const liste = parJourBloc.get(`${j.date}|${bloc}`) ?? [];
                      const ctrls = bloc === "matin" ? controlesDuJour(j.date) : [];
                      const vide = liste.length === 0 && ctrls.length === 0;
                      return (
                        <td
                          key={j.date}
                          className={`h-28 border-l border-border p-1.5 align-top ${
                            j.estAujourdhui ? "bg-mint/20" : ""
                          }`}
                        >
                          <div className="space-y-1.5">
                            {ctrls.map((c) => (
                              <Link
                                key={c.id}
                                href={`/modules/${c.module_id}/controle`}
                                title={`${c.groupeNom} — ${c.titre ?? c.moduleNom}`}
                                className={`block rounded-lg px-2 py-1.5 transition-colors ${
                                  c.confirmee
                                    ? "border-2 border-solid border-forest bg-mint hover:bg-mint/70"
                                    : "border border-dashed border-slate/60 bg-surface hover:border-forest/60"
                                }`}
                              >
                                <span className="block text-[10px] font-semibold uppercase tracking-wide text-forest">
                                  {c.type === "EFM"
                                    ? c.type_efm === "regional"
                                      ? "EFM régional"
                                      : "EFM local"
                                    : "Contrôle continu"}
                                </span>
                                <span className="mt-0.5 block truncate text-xs text-ink">
                                  {c.groupeNom}
                                </span>
                              </Link>
                            ))}

                            {liste.map((s) => {
                              const fait = s.statut === "fait";
                              const tp = s.nature === "pratique";
                              return (
                                <Link
                                  key={s.id}
                                  href={`/groupes/${s.groupe_id}/seances/${s.id}`}
                                  title={[
                                    s.groupeNom,
                                    s.moduleNom,
                                    s.objectif,
                                  ]
                                    .filter(Boolean)
                                    .join(" — ")}
                                  className={`block rounded-lg px-2.5 py-2 transition-colors ${
                                    fait
                                      ? "bg-mist text-slate hover:bg-border/60"
                                      : tp
                                        ? "bg-info/10 hover:bg-info/15"
                                        : "bg-mint hover:bg-mint/70"
                                  }`}
                                >
                                  <span className="flex items-center gap-1.5">
                                    <span
                                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                                        fait
                                          ? "bg-slate/50"
                                          : tp
                                            ? "bg-info"
                                            : "bg-forest"
                                      }`}
                                      aria-hidden
                                    />
                                    <span className="truncate text-[11px] text-slate">
                                      {s.heure_debut
                                        ? formatHeure(s.heure_debut)
                                        : "—"}
                                      {s.heure_fin
                                        ? `–${formatHeure(s.heure_fin)}`
                                        : ""}
                                    </span>
                                  </span>
                                  <span className="mt-1 block truncate text-xs font-semibold text-ink">
                                    {s.groupeNom}
                                    {s.codeOperationnel
                                      ? ` · ${s.codeOperationnel}`
                                      : ""}
                                  </span>
                                  <span className="mt-0.5 block truncate text-[11px] text-slate">
                                    {s.objectif ?? s.moduleNom}
                                  </span>
                                </Link>
                              );
                            })}
                          </div>
                          {vide ? <span className="sr-only">libre</span> : null}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Ce qui n'est pas encore posé : c'est là que se trouve le travail. */}
        <aside className="space-y-4">
          <SuiviHeures bilan={bilan} />

          {seancesSansDate > 0 ? (
            <section className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-start gap-2">
                <CalendarPlus
                  className="mt-0.5 h-4 w-4 shrink-0 text-slate"
                  aria-hidden
                />
                <div className="min-w-0">
                  <h2 className="text-sm font-medium text-ink">
                    {seancesSansDate} séance{seancesSansDate > 1 ? "s" : ""} sans
                    date
                  </h2>
                  <p className="mt-0.5 text-xs text-slate">
                    Le plan de déroulement les a créées ; il reste à les poser
                    dans la semaine.
                  </p>
                </div>
              </div>
              <ul className="mt-3 space-y-1.5">
                {aPlanifier.map((p) => (
                  <li key={`${p.groupe_id}|${p.module_id}`}>
                    <Link
                      href={`/groupes/${p.groupe_id}/progression`}
                      className="flex items-baseline justify-between gap-2 rounded-lg border border-border px-2.5 py-1.5 hover:border-forest/50"
                    >
                      <span className="min-w-0">
                        <span className="text-sm text-ink">{p.groupeNom}</span>
                        {p.codeOperationnel ? (
                          <span className="ml-1 font-mono text-xs text-forest">
                            {p.codeOperationnel}
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 font-mono text-xs text-slate">
                        {p.seances} · {formatHeures(p.heures)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {controlesSansDate.length > 0 ? (
            <section className="rounded-xl border border-border bg-surface p-4">
              <h2 className="text-sm font-medium text-ink">
                {controlesSansDate.length} contrôle
                {controlesSansDate.length > 1 ? "s" : ""} sans date
              </h2>
              <ul className="mt-2 space-y-1.5">
                {controlesSansDate.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/modules/${c.module_id}/controle`}
                      className="flex items-baseline gap-2 rounded-lg border border-dashed border-slate/50 px-2.5 py-1.5 hover:border-forest"
                    >
                      <Badge tone={c.type === "EFM" ? "danger" : "info"}>
                        {c.type}
                      </Badge>
                      <span className="min-w-0 truncate text-xs text-ink">
                        {c.groupeNom} · {c.titre ?? c.moduleNom}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {regionales.length > 0 ? (
            <section>
              <h2 className="text-sm font-medium text-ink">
                Épreuves régionales
              </h2>
              <p className="mt-0.5 text-xs text-slate">
                Dates arrêtées par la région : elles se saisissent.
              </p>
              <div className="mt-2 space-y-3">
                {regionales.map((c) => (
                  <EfmRegionalForm key={c.id} controle={c} />
                ))}
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
