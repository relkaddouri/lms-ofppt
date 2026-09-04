"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { CRENEAUX_JOUR, formatHeure, positionSeance } from "@/lib/creneaux";
import { couleurGroupe } from "@/lib/couleurs-groupe";
import { dateLocale, formatDate, formatHeures } from "@/lib/format";
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
import { libelleModule } from "@/lib/modules";

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

const iso = dateLocale;

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


/** Une séance appartient au bloc dans lequel son heure de début tombe. */

export default function CalendrierSemaine({
  lundi,
  seances,
  controles,
  aPlanifier,
  seancesSansDate,
  bilan,
  echeances,
  indisponibilites,
  indisponibilitesAVenir,
}: {
  lundi: string;
  seances: SeanceCalendrier[];
  controles: ControleCalendrier[];
  aPlanifier: APlanifier[];
  seancesSansDate: number;
  bilan: BilanHeures;
  echeances: Echeance[];
  indisponibilites: Indisponibilite[];
  /** Toutes celles à venir : le panneau doit rester utilisable hors semaine. */
  indisponibilitesAVenir: Indisponibilite[];
}) {
  const router = useRouter();
  const aujourdhui = iso(new Date());
  const jours = JOURS.map((nom, i) => {
    const date = decale(lundi, i);
    return { nom, date, estAujourdhui: date === aujourdhui };
  });

  // Chaque séance est placée sur la grille des quatre créneaux, et occupe
  // autant de lignes que sa durée — une séance de 5 h en couvre deux
  // (design_system.md §5.5). Celles qui ne s'alignent sur aucun créneau sont
  // mises de côté et listées sous la grille plutôt que forcées dedans.
  const placees = new Map<string, { seance: SeanceCalendrier; span: number }[]>();
  const horsGrille: SeanceCalendrier[] = [];
  for (const s of seances) {
    const pos = positionSeance(s.heure_debut, s.heure_fin);
    if (!pos) {
      horsGrille.push(s);
      continue;
    }
    const cle = `${s.date}|${pos.index}`;
    placees.set(cle, [...(placees.get(cle) ?? []), { seance: s, span: pos.span }]);
  }

  const groupesVus = [
    ...new Map(seances.map((s) => [s.groupe_id, s.groupeNom])).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1], "fr"));

  /**
   * Indisponibilités couvrant un jour, éventuellement restreintes à un bloc.
   * Une déclaration « journée entière » vaut pour les deux blocs.
   */
  const indispoDuJour = (date: string, creneau?: number) =>
    indisponibilites.filter(
      (i) =>
        i.date_debut <= date &&
        date <= i.date_fin &&
        (creneau === undefined ||
          i.demi_journee === null ||
          // Les deux premiers créneaux sont le matin, les deux suivants
          // l'après-midi : une demi-journée déclarée en couvre deux.
          i.demi_journee === (creneau < 2 ? "matin" : "soir")),
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

  const modulesSemaine = [
    ...new Set(
      seances.map((s) => libelleModule(s.codeOperationnel, s.moduleNom)),
    ),
  ];

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

      {groupesVus.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-slate-light">
            Groupes
          </span>
          {groupesVus.map(([id, nom]) => {
            const c = couleurGroupe(id);
            return (
              <span key={id} className="flex items-center gap-2 text-[13.5px] text-body">
                <span
                  aria-hidden
                  className="h-3.5 w-3.5 shrink-0 rounded-[4px] border border-l-[3px]"
                  style={{ background: c.fond, borderColor: c.trait }}
                />
                {nom}
              </span>
            );
          })}
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
              {CRENEAUX_JOUR.map((creneau, ligne) => (
                <tr key={creneau.debut} className="border-t border-border first:border-t-0">
                  <th scope="row" className="bg-paper px-3 py-3 text-left align-top">
                    <span className="block whitespace-nowrap font-mono text-[13px] text-ink">
                      {formatHeure(creneau.debut)}
                    </span>
                    <span className="mt-0.5 block whitespace-nowrap font-mono text-[12px] text-slate-light">
                      {formatHeure(creneau.fin)}
                    </span>
                  </th>

                  {jours.map((j) => {
                    // Une séance longue occupe la cellule de son premier
                    // créneau et déborde sur les suivantes : celles-ci ne
                    // doivent alors pas être dessinées (`rowSpan`).
                    const couverte = [1, 2, 3].some((recul) => {
                      const amont = placees.get(`${j.date}|${ligne - recul}`) ?? [];
                      return amont.some((x) => x.span > recul);
                    });
                    if (couverte) return null;

                    const ici = placees.get(`${j.date}|${ligne}`) ?? [];
                    const span = ici.reduce((m, x) => Math.max(m, x.span), 1);
                    const ctrls = ligne === 0 ? controlesDuJour(j.date) : [];
                    const indispos = indispoDuJour(j.date, ligne);

                    return (
                      <td
                        key={j.date}
                        rowSpan={span}
                        className={`border-l border-border p-1.5 align-top ${
                          span > 1 ? "" : "h-[92px]"
                        } ${
                          indispos.length > 0
                            ? "bg-[repeating-linear-gradient(135deg,var(--paper)_0px,var(--paper)_7px,var(--surface)_7px,var(--surface)_14px)]"
                            : j.estAujourdhui
                              ? "bg-wash/20"
                              : ""
                        }`}
                      >
                        <div className="flex h-full flex-col gap-1.5">
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

                          {ici.map(({ seance: s, span: n }) => {
                            const fait = s.statut === "fait";
                            const couleur = couleurGroupe(s.groupe_id);
                            return (
                              <Link
                                key={s.id}
                                href={`/groupes/${s.groupe_id}/seances/${s.id}`}
                                title={[
                                  s.groupeNom,
                                  libelleModule(s.codeOperationnel, s.moduleNom),
                                  s.objectif,
                                ]
                                  .filter(Boolean)
                                  .join(" — ")}
                                style={{
                                  background: couleur.fond,
                                  borderColor: couleur.trait,
                                }}
                                className={`flex flex-1 flex-col rounded-[9px] border border-l-[3px] px-2.5 py-2 no-underline transition-opacity duration-150 ease-out hover:opacity-90 hover:no-underline ${
                                  fait ? "opacity-60" : ""
                                }`}
                              >
                                <span className="flex items-center gap-1.5">
                                  <span
                                    className="truncate font-mono text-[10.5px]"
                                    style={{ color: couleur.trait, opacity: 0.85 }}
                                  >
                                    {s.heure_debut ? formatHeure(s.heure_debut) : "—"}
                                    {s.heure_fin ? `–${formatHeure(s.heure_fin)}` : ""}
                                  </span>
                                  {n > 1 ? (
                                    <span
                                      className="ml-auto shrink-0 font-mono text-[10px]"
                                      style={{ color: couleur.trait, opacity: 0.7 }}
                                    >
                                      {n * 2.5} h
                                    </span>
                                  ) : null}
                                </span>
                                <span
                                  className="mt-1 block truncate text-xs font-semibold"
                                  style={{ color: couleur.trait }}
                                >
                                  {s.groupeNom}
                                  {s.codeOperationnel ? ` · ${s.codeOperationnel}` : ""}
                                </span>
                                <span className="mt-0.5 line-clamp-3 text-[11px] leading-snug text-slate-2">
                                  {s.objectif ??
                                    libelleModule(s.codeOperationnel, s.moduleNom)}
                                </span>
                              </Link>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {horsGrille.length > 0 ? (
          <p className="mt-3 rounded-[10px] border border-border-strong bg-paper px-4 py-3 text-[13.5px] text-slate-2">
            {horsGrille.length} séance{horsGrille.length > 1 ? "s" : ""} ne
            tombe{horsGrille.length > 1 ? "nt" : ""} sur aucun créneau de 2 h 30
            et n&apos;apparaî{horsGrille.length > 1 ? "ssent" : "t"} pas dans la
            grille :{" "}
            {horsGrille
              .map(
                (s) =>
                  `${s.groupeNom} ${formatHeure(s.heure_debut ?? "")}${
                    s.heure_fin ? `–${formatHeure(s.heure_fin)}` : ""
                  }`,
              )
              .join(", ")}
            . Ajustez leurs horaires depuis la séance pour les y faire entrer.
          </p>
        ) : null}

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
                        className="h-3 w-3 shrink-0 rounded-[3px] border border-l-[3px]"
                        style={(() => {
                          const c = couleurGroupe(
                            groupesVus.find(([, n]) => n === nom)?.[0] ?? nom,
                          );
                          return { background: c.fond, borderColor: c.trait };
                        })()}
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
          <IndisponibilitesPanel
            indisponibilites={indisponibilitesAVenir}
            semaine={{ debut: lundi, fin: decale(lundi, 6) }}
          />

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
