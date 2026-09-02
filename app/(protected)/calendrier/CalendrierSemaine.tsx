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
import IndisponibilitesPanel from "./IndisponibilitesPanel";
import EcheancesReglementaires from "@/components/EcheancesReglementaires";
import type { Echeance } from "@/lib/echeances";
import type { BilanHeures } from "@/lib/heures-formateur";
import {
  TYPES_INDISPONIBILITE,
  type Indisponibilite,
} from "@/lib/indisponibilites";
import { CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

const iso = (d: Date) => d.toISOString().slice(0, 10);

function decale(lundi: string, jours: number): string {
  const d = new Date(`${lundi}T12:00:00`);
  d.setDate(d.getDate() + jours);
  return iso(d);
}

/** Numéro de semaine ISO, affiché en exergue de l'écran. */
function numeroSemaine(lundi: string): number {
  const d = new Date(`${lundi}T12:00:00Z`);
  const jeudi = new Date(d);
  jeudi.setUTCDate(d.getUTCDate() + 3);
  const premier = new Date(Date.UTC(jeudi.getUTCFullYear(), 0, 4));
  return (
    1 +
    Math.round(
      ((jeudi.getTime() - premier.getTime()) / 86400000 -
        3 +
        ((premier.getUTCDay() + 6) % 7)) /
        7,
    )
  );
}

/**
 * Liseré gauche d'une séance, stable pour un même groupe.
 * Quatre teintes, comme dans la maquette — le corail en est exclu : une
 * semaine chargée afficherait plusieurs séances corail à la fois.
 */
const LISERES = [
  "border-l-ink",
  "border-l-teal",
  "border-l-green",
  "border-l-wash",
] as const;

function lisereDe(groupe: string): string {
  let somme = 0;
  for (let i = 0; i < groupe.length; i++) somme += groupe.charCodeAt(i);
  return LISERES[somme % LISERES.length]!;
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
  echeances,
  indisponibilites,
}: {
  lundi: string;
  seances: SeanceCalendrier[];
  controles: ControleCalendrier[];
  aPlanifier: APlanifier[];
  seancesSansDate: number;
  bilan: BilanHeures;
  echeances: Echeance[];
  indisponibilites: Indisponibilite[];
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

  /**
   * Indisponibilités couvrant un jour, éventuellement restreintes à un bloc.
   * Une déclaration « journée entière » vaut pour les deux blocs.
   */
  const indispoDuJour = (date: string, bloc?: "matin" | "soir") =>
    indisponibilites.filter(
      (i) =>
        i.date_debut <= date &&
        date <= i.date_fin &&
        (bloc === undefined || i.demi_journee === null || i.demi_journee === bloc),
    );

  const libelleIndispo = (i: Indisponibilite) =>
    i.libelle ??
    TYPES_INDISPONIBILITE.find((t) => t.valeur === i.type)?.defaut ??
    "Indisponible";

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

  const modulesSemaine = [...new Set(seances.map((s) => s.moduleNom))];

  const dureeDe = (s: SeanceCalendrier) => {
    if (!s.heure_debut || !s.heure_fin) return 0;
    const min = (h: string) => {
      const [a, b] = h.split(":").map(Number);
      return (a ?? 0) * 60 + (b ?? 0);
    };
    return (min(s.heure_fin) - min(s.heure_debut)) / 60;
  };

  // Une semaine appartient au mois de son lundi, même règle que le bilan.
  const moisCourant = lundi.slice(0, 7);
  const heuresDuMois = bilan.semaines
    .filter((s) => s.lundi.slice(0, 7) === moisCourant)
    .reduce((t, s) => t + s.heures, 0);

  const plafondAnnuel = bilan.plafonds[0] ?? null;

  const heuresParGroupe = [
    ...seances
      .reduce((acc, s) => {
        acc.set(s.groupeNom, (acc.get(s.groupeNom) ?? 0) + dureeDe(s));
        return acc;
      }, new Map<string, number>())
      .entries(),
  ].sort((a, b) => b[1] - a[1]);

  return (
    <div className="flex flex-col gap-8 px-6 py-10 md:px-10 md:pb-14">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[11.5px] uppercase tracking-[0.12em] text-slate-light">
            Semaine {numeroSemaine(lundi)} · {new Date(`${lundi}T12:00:00`).getFullYear()}
          </span>
          <h1 className="font-display text-[34px] font-bold leading-tight tracking-[-0.02em] text-ink">
            Emploi du temps
          </h1>
          <p className="text-base text-slate-2">
            <span className="font-mono text-body">
              {formatDate(lundi)} — {formatDate(decale(lundi, 5))}
            </span>
            {groupesSemaine.length > 0
              ? ` · ${groupesSemaine.length} groupe${groupesSemaine.length > 1 ? "s" : ""}, ${modulesSemaine.length} module${modulesSemaine.length > 1 ? "s" : ""}`
              : " · aucune séance"}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex overflow-hidden rounded-[9px] border border-border-strong bg-surface">
            <button
              type="button"
              aria-label="Semaine précédente"
              onClick={() => router.push(`/calendrier?semaine=${decale(lundi, -7)}`)}
              className="flex h-10 w-10 items-center justify-center border-r border-border transition-colors duration-150 ease-out hover:bg-paper"
            >
              <ChevronLeft size={15} strokeWidth={2.2} className="text-slate-2" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => router.push("/calendrier")}
              className="whitespace-nowrap px-[18px] text-sm font-semibold text-ink transition-colors duration-150 ease-out hover:bg-paper"
            >
              Aujourd&apos;hui
            </button>
            <button
              type="button"
              aria-label="Semaine suivante"
              onClick={() => router.push(`/calendrier?semaine=${decale(lundi, 7)}`)}
              className="flex h-10 w-10 items-center justify-center border-l border-border transition-colors duration-150 ease-out hover:bg-paper"
            >
              <ChevronRight size={15} strokeWidth={2.2} className="text-slate-2" aria-hidden />
            </button>
          </div>

          {/* Présent parce que la maquette le montre. La planification se fait
              par couple groupe + module ; ce raccourci global attend son atome. */}
          <button
            type="button"
            disabled
            title="Planification — passez par un module d'un groupe"
            className="rounded-[9px] border border-ink bg-ink px-[18px] py-2.5 text-[14.5px] font-semibold text-white disabled:cursor-not-allowed disabled:border-border disabled:bg-wash-strong disabled:text-muted"
          >
            Planifier une séance
          </button>
        </div>
      </header>

      {afficherLegende ? (
        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-6 rounded border border-dashed border-slate" />
            date estimée
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-6 rounded border-2 border-solid border-ink" />
            date arrêtée
          </span>
        </div>
      ) : null}

      <div className="mt-4">
        <div className="overflow-x-auto">
          {/* `table-fixed` donne aux six jours la même largeur : sans lui, le
              seul jour occupé écrasait les cinq autres. */}
          <table className="w-full min-w-[680px] table-fixed border-collapse overflow-hidden rounded-[14px] border border-border bg-surface">
            <colgroup>
              <col className="w-[124px]" />
              {jours.map((j) => (
                <col key={j.date} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th className="border-b border-border bg-paper px-3 py-2.5" />
                {jours.map((j) => {
                  const indispoJour = indispoDuJour(j.date).filter(
                    (i) => i.demi_journee === null,
                  );
                  return (
                  <th
                    key={j.date}
                    scope="col"
                    className={`border-b border-l border-border px-3 py-2.5 text-left ${
                      indispoJour.length > 0
                        ? "bg-paper"
                        : j.estAujourdhui
                          ? "bg-wash"
                          : "bg-paper"
                    }`}
                  >
                    <span className="flex items-baseline gap-1.5">
                      <span
                        className={`text-sm font-semibold ${
                          j.estAujourdhui ? "text-ink" : "text-ink"
                        }`}
                      >
                        {j.nom}
                      </span>
                      <span
                        className={`text-xs ${
                          j.estAujourdhui ? "text-ink/70" : "text-slate"
                        }`}
                      >
                        {j.date.slice(8, 10)}/{j.date.slice(5, 7)}
                      </span>
                      {j.estAujourdhui ? (
                        <span
                          className="ml-auto h-1.5 w-1.5 rounded-full bg-ink"
                          aria-label="aujourd'hui"
                        />
                      ) : null}
                    </span>
                    {indispoJour.length > 0 ? (
                      <span className="mt-1 inline-block self-start whitespace-nowrap rounded-[7px] border border-border bg-wash px-[7px] py-px text-[11.5px] font-semibold text-slate-2">
                        {indispoJour.map(libelleIndispo).join(" · ")}
                      </span>
                    ) : null}
                  </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {(["matin", "soir"] as const).map((bloc) => {
                const b = BLOCS[bloc];
                return (
                  <tr key={bloc} className="border-t border-border first:border-t-0">
                    <th scope="row" className="bg-paper px-3 py-3 text-left align-top">
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
                      const indispos = indispoDuJour(j.date, bloc);
                      const vide =
                        liste.length === 0 &&
                        ctrls.length === 0 &&
                        indispos.length === 0;
                      return (
                        <td
                          key={j.date}
                          className={`h-28 border-l border-border p-1.5 align-top ${
                            indispos.length > 0
                              ? "bg-[repeating-linear-gradient(135deg,var(--paper)_0px,var(--paper)_7px,var(--surface)_7px,var(--surface)_14px)]"
                              : j.estAujourdhui
                                ? "bg-wash/20"
                                : ""
                          }`}
                        >
                          <div className="space-y-1.5">
                            {/* Le motif hachuré porte l'indisponibilité ; le
                                libellé la nomme, la couleur seule ne suffit
                                jamais (design_system.md). */}
                            {indispos
                              .filter((i) => i.demi_journee !== null)
                              .map((i) => (
                                <p
                                  key={i.id}
                                  className="rounded-[7px] border border-border bg-wash px-[7px] py-px text-[11.5px] font-semibold text-slate-2"
                                >
                                  {libelleIndispo(i)} (
                                  {i.demi_journee === "matin" ? "matin" : "après-midi"})
                                </p>
                              ))}

                            {ctrls.map((c) => (
                              <Link
                                key={c.id}
                                href={`/modules/${c.module_id}/controle`}
                                title={`${c.groupeNom} — ${c.titre ?? c.moduleNom}`}
                                className={`block rounded-lg px-2 py-1.5 transition-colors ${
                                  c.confirmee
                                    ? "border-2 border-solid border-ink bg-wash hover:bg-wash-strong"
                                    : "border border-dashed border-slate/60 bg-surface hover:border-ink/60"
                                }`}
                              >
                                <span className="block text-[10px] font-semibold uppercase tracking-wide text-ink">
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
                                  className={`block rounded-[9px] border border-border border-l-[3px] bg-surface px-2.5 py-2.5 no-underline transition-colors duration-150 ease-out hover:bg-paper hover:no-underline ${lisereDe(s.groupeNom)} ${
                                    fait ? "opacity-70" : ""
                                  }`}
                                >
                                  <span className="flex items-center gap-1.5">
                                    <span
                                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                                        fait
                                          ? "bg-muted"
                                          : tp
                                            ? "bg-teal"
                                            : "bg-green"
                                      }`}
                                      aria-hidden
                                    />
                                    <span className="truncate font-mono text-[10.5px] text-slate-light">
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
                                  <span className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate">
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

        {/* Deux cartes de synthèse, comme dans la maquette : le volume dispensé
            et sa répartition par groupe sur la semaine affichée. */}
        <div className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
          <section className="flex flex-col gap-5 rounded-[14px] border border-border bg-surface p-6 shadow-repos">
            <div className="flex flex-col gap-1">
              <h2 className="font-display text-[17px] font-semibold text-ink">
                Heures cumulées
              </h2>
              <span className="text-[13.5px] text-slate-light">
                Volume de formation dispensé
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                ["Cette semaine", bilan.semaineCourante?.heures ?? 0],
                ["Ce mois", heuresDuMois],
                ["Depuis septembre", bilan.totalAnnuel],
              ].map(([libelle, valeur]) => (
                <div key={String(libelle)} className="flex flex-col gap-1">
                  <span className="text-[13px] text-slate-light">{libelle}</span>
                  <span className="font-mono text-[19px] font-medium text-ink">
                    {formatHeures(Number(valeur))}
                  </span>
                </div>
              ))}
            </div>

            {plafondAnnuel ? (
              <div className="flex flex-col gap-2 border-t border-separator pt-[18px]">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13.5px] text-slate-2">
                    {plafondAnnuel.libelle}
                  </span>
                  <span className="font-mono text-sm font-medium text-ink">
                    {formatHeures(plafondAnnuel.valeur)} /{" "}
                    {formatHeures(plafondAnnuel.plafond)}
                  </span>
                </div>
                <span className="h-2 overflow-hidden rounded-full bg-wash">
                  <span
                    className={`block h-full rounded-full ${
                      plafondAnnuel.taux >= 100 ? "bg-coral" : "bg-teal"
                    }`}
                    style={{ width: `${Math.min(100, plafondAnnuel.taux)}%` }}
                  />
                </span>
                <div className="flex items-baseline justify-between gap-3 text-[13px] text-slate-light">
                  <span>{Math.round(plafondAnnuel.taux)} % du plafond</span>
                  <span className="font-mono">
                    {formatHeures(
                      Math.max(0, plafondAnnuel.plafond - plafondAnnuel.valeur),
                    )}{" "}
                    restantes
                  </span>
                </div>
              </div>
            ) : null}
          </section>

          <section className="flex flex-col gap-4 rounded-[14px] border border-border bg-surface p-6 shadow-repos">
            <h2 className="font-display text-[17px] font-semibold text-ink">
              Répartition par groupe
            </h2>
            {heuresParGroupe.length === 0 ? (
              <p className="text-[14.5px] text-slate-light">
                Aucune séance planifiée cette semaine.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {heuresParGroupe.map(([nom, heures]) => (
                  <li
                    key={nom}
                    className="flex items-center justify-between gap-3 border-b border-separator pb-3 last:border-0 last:pb-0"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span
                        aria-hidden
                        className={`h-2 w-2 shrink-0 rotate-45 border-l-[3px] ${lisereDe(nom)}`}
                      />
                      <span className="truncate text-[14.5px] text-body">{nom}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[15px] font-medium text-ink">
                      {formatHeures(heures)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <IndisponibilitesPanel indisponibilites={indisponibilites} />

          <EcheancesReglementaires
            echeances={echeances}
            controleHref={(id) =>
              `/modules/${controles.find((c) => c.id === id)?.module_id ?? ""}/controle`
            }
          />

          {/* « Sans date » est une seule idée : séances et contrôles la
              partagent, ils tiennent dans le même bloc. */}
          {seancesSansDate > 0 || controlesSansDate.length > 0 ? (
            <section className="rounded-[14px] border border-border bg-surface p-4">
              <h2 className="flex items-center gap-1.5 text-sm font-medium text-ink">
                <CalendarPlus className="h-4 w-4 text-slate" aria-hidden />
                Reste à poser dans le calendrier
              </h2>

              {seancesSansDate > 0 ? (
                <>
                  <p className="mt-2 text-xs text-slate">
                    {seancesSansDate} séance{seancesSansDate > 1 ? "s" : ""} créée
                    {seancesSansDate > 1 ? "s" : ""} par le plan de déroulement
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {aPlanifier.map((p) => (
                      <li key={`${p.groupe_id}|${p.module_id}`}>
                        <Link
                          href={`/groupes/${p.groupe_id}/progression`}
                          className="flex items-baseline justify-between gap-2 rounded-lg border border-border px-2.5 py-1.5 hover:border-ink/50"
                        >
                          <span className="min-w-0 truncate text-sm text-ink">
                            {p.groupeNom}
                            {p.codeOperationnel ? (
                              <span className="ml-1 text-xs text-ink">
                                {p.codeOperationnel}
                              </span>
                            ) : null}
                          </span>
                          <span className="shrink-0 whitespace-nowrap text-xs text-slate">
                            {p.seances} séances · {formatHeures(p.heures)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              {controlesSansDate.length > 0 ? (
                <>
                  <p className="mt-3 text-xs text-slate">
                    {controlesSansDate.length} contrôle
                    {controlesSansDate.length > 1 ? "s" : ""} sans date
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {controlesSansDate.map((c) => (
                      <li key={c.id}>
                        <Link
                          href={`/modules/${c.module_id}/controle`}
                          title={`${c.groupeNom} — ${c.titre ?? c.moduleNom}`}
                          className="flex max-w-[220px] items-center gap-1.5 rounded-lg border border-dashed border-slate/50 px-2 py-1 hover:border-ink"
                        >
                          <Badge tone={c.type === "EFM" ? "danger" : "info"}>
                            {c.type}
                          </Badge>
                          <span className="truncate text-xs text-ink">
                            {c.groupeNom} · {c.titre ?? c.moduleNom}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </section>
          ) : null}
        </div>

        {regionales.length > 0 ? (
          <section className="mt-4">
            <h2 className="text-sm font-medium text-ink">Épreuves régionales</h2>
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

      </div>
    </div>
  );
}
