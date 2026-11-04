"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import LigneSeance from "./LigneSeance";
import LigneControle, { type ControleAffiche } from "./LigneControle";
import Badge from "@/components/ui/Badge";
import RappelControle from "@/components/RappelControle";
import { calculerRappel } from "@/lib/rappels";
import { formatHeures } from "@/lib/format";
import type { Seance } from "@/app/actions/seances";
import { ChevronDown, ChevronRight } from "lucide-react";

export type ObjectifBloc = {
  code: string;
  intitule: string;
  seances: Seance[];
  /** Sa part dans la répartition du module ; nulle pour des séances hors plan. */
  repartition: { theorique: number; pratique: number } | null;
};

/** Heures d'une liste de séances, par nature. */
function parNature(seances: Seance[]) {
  const h = (s: Seance) => Number(s.duree_realisee ?? s.duree_prevue ?? 0);
  const pratique = seances
    .filter((s) => s.nature === "pratique")
    .reduce((t, s) => t + h(s), 0);
  const total = seances.reduce((t, s) => t + h(s), 0);
  return { total, theorique: total - pratique, pratique };
}

const egal = (a: number, b: number) => Math.abs(a - b) < 0.01;

/**
 * Un module dans la progression, replié par défaut.
 *
 * Un groupe suit quatre modules de trente séances : tout dérouler donnait cent
 * vingt lignes d'un bloc. L'en-tête porte donc ce qu'on vient chercher —
 * l'avancement et la prochaine séance — et le détail s'ouvre à la demande.
 */
export default function ModuleProgression({
  groupeId,
  moduleId,
  nom,
  code,
  masseHoraire,
  controlesCouverts,
  heuresControles,
  heuresCedees,
  objectifs,
  seances,
  controlesApres,
  controlesSansAncrage,
  cessions,
  ouvertParDefaut = false,
}: {
  groupeId: string;
  moduleId: string;
  nom: string;
  code: string | null;
  masseHoraire: number | null;
  /** Contrôles déjà validés sur ce couple : un brouillon ne couvre rien. */
  controlesCouverts: number;
  /** Heures de contrôles de ce module passés hors de ses propres séances. */
  heuresControles: number;
  /** Heures de ses séances prises par les contrôles d'autres modules. */
  heuresCedees: number;
  objectifs: ObjectifBloc[];
  seances: Seance[];
  /** Les contrôles à poser sous la séance qui les précède, par identifiant. */
  controlesApres: Record<string, ControleAffiche[]>;
  /** Ceux qu'aucune séance ne précède : sans date, ou avant la première. */
  controlesSansAncrage: ControleAffiche[];
  /** Séances dont le créneau a servi au contrôle d'un autre module. */
  cessions: Record<
    string,
    { libelle: string; module: string; heures: number }[]
  >;
  ouvertParDefaut?: boolean;
}) {
  const [ouvert, setOuvert] = useState(ouvertParDefaut);

  const faites = seances.filter((s) => s.statut === "fait");
  const heuresFaites =
    faites.reduce(
      (t, s) => t + Number(s.duree_realisee ?? s.duree_prevue ?? 0),
      0,
    ) +
    heuresControles -
    heuresCedees;
  const heuresTotales = seances.reduce(
    (t, s) => t + Number(s.duree_prevue ?? s.duree_realisee ?? 0),
    0,
  );
  // L'avancement se mesure à la masse horaire du module, pas aux séances du
  // plan : le plan laisse de côté les 10 h d'évaluation, et un module dont
  // toutes les séances étaient faites s'affichait « terminé » alors qu'il
  // lui restait ses contrôles (M202 : 80 h de séances sur 90 h allouées).
  const base = masseHoraire || heuresTotales;
  const pct =
    base > 0 ? Math.min(100, Math.round((heuresFaites / base) * 100)) : 0;
  const prochaine = seances.find((s) => s.statut !== "fait");
  const rappel = calculerRappel(
    base,
    heuresFaites,
    controlesCouverts,
  );

  let numero = 0;

  return (
    <section className="overflow-hidden rounded-[14px] border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-wash"
      >
        {ouvert ? (
          <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-slate" aria-hidden />
        ) : (
          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate" aria-hidden />
        )}

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-2">
            {code ? (
              <span className="font-mono text-sm font-medium text-ink">
                {code}
              </span>
            ) : null}
            <span className="font-display text-lg font-bold text-ink">{nom}</span>
            {pct === 100 ? <Badge tone="success">terminé</Badge> : null}
            <RappelControle
              rappel={rappel}
              href={`/modules/${moduleId}/controle?groupe=${groupeId}`}
              compact
            />
          </span>

          <span className="mt-1.5 flex flex-wrap items-center gap-3">
            {/* Vert, comme partout ailleurs où l'application montre un
                avancement — la fiche d'un stagiaire, la couverture d'un
                module, le sommaire du stagiaire. Cette barre-ci était la
                seule en encre : une inconsistance qui ne se voyait pas en
                clair, et qui la rendait illisible en sombre. Le vert n'est
                pas ici un statut ; c'est la couleur de ce qui est fait. */}
            <span
              className="h-1.5 w-40 overflow-hidden rounded-full bg-wash-strong"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Avancement de ${nom}`}
            >
              <span
                className="block h-full rounded-full bg-green transition-[width] duration-300"
                style={{ width: `${pct}%` }}
              />
            </span>
            <span className="text-xs text-slate">
              {formatHeures(heuresFaites)} sur {formatHeures(base)}
              {masseHoraire && heuresTotales !== masseHoraire
                ? ` · séances du plan ${formatHeures(heuresTotales)}`
                : ""}
              {heuresControles > 0
                ? ` · contrôles passés ailleurs +${formatHeures(heuresControles)}`
                : ""}
              {heuresCedees > 0
                ? ` · créneaux cédés −${formatHeures(heuresCedees)}`
                : ""}
              {" · "}
              {faites.length}/{seances.length} séances
            </span>
          </span>

          {/* Refermé, l'en-tête doit encore dire où on en est. */}
          {!ouvert && prochaine ? (
            <span className="mt-1 block truncate text-xs text-slate">
              Prochaine :{" "}
              {prochaine.suggestions_pedagogiques?.code
                ? `${prochaine.suggestions_pedagogiques.code} — ${prochaine.suggestions_pedagogiques.apprentissage_base}`
                : (prochaine.objectif_operationnel ?? "séance à faire")}
            </span>
          ) : null}
        </span>

        <Link
          href={`/groupes/${groupeId}/modules/${moduleId}`}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 text-xs font-medium text-ink underline"
        >
          plan de déroulement
        </Link>
      </button>

      {ouvert ? (
        <div className="space-y-3 border-t border-border bg-paper p-3">
          {/* Un contrôle qu'aucune séance ne précède — sans date, ou posé
              avant la première séance — ouvre le module plutôt que de
              disparaître. */}
          {controlesSansAncrage.length > 0 ? (
            <ul className="overflow-hidden rounded-lg border border-border bg-surface">
              {controlesSansAncrage.map((c) => (
                <LigneControle key={c.id} controle={c} groupeId={groupeId} />
              ))}
            </ul>
          ) : null}
          {objectifs.map((o) => {
            // Ce que le plan de séances donne à l'objectif, ce qui en est fait,
            // et ce que la répartition lui accordait : les trois doivent
            // finir par se rejoindre, module terminé compris.
            const plan = parNature(o.seances);
            const fait = parNature(o.seances.filter((s) => s.statut === "fait"));
            const rep = o.repartition;
            const heuresRep = rep ? rep.theorique + rep.pratique : null;
            const ecart =
              rep !== null &&
              (!egal(plan.theorique, rep.theorique) ||
                !egal(plan.pratique, rep.pratique));
            const toutFait =
              o.seances.length > 0 &&
              o.seances.every((s) => s.statut === "fait") &&
              (heuresRep === null || fait.total >= heuresRep - 0.01);
            return (
              <div
                key={o.code}
                className="overflow-hidden rounded-lg border border-border bg-surface"
              >
                <div className="flex flex-wrap items-center gap-2 border-b border-border bg-paper px-3 py-2">
                  <span className="font-mono text-xs font-medium text-ink">
                    {o.code}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                    {o.intitule}
                  </span>
                  <span className="font-mono text-xs text-slate">
                    {formatHeures(fait.total)} faites sur{" "}
                    {formatHeures(heuresRep ?? plan.total)}
                  </span>
                  {toutFait ? <Badge tone="success">terminé</Badge> : null}
                  {ecart && rep ? (
                    <span className="basis-full font-mono text-xs text-coral-dark">
                      {o.seances.length === 0
                        ? `Aucune séance : les ${formatHeures(heuresRep)} de la répartition ne sont pas planifiées`
                        : `Écart avec la répartition : séances ${formatHeures(plan.total)} (T ${formatHeures(plan.theorique)} · P ${formatHeures(plan.pratique)}) pour ${formatHeures(heuresRep)} (T ${formatHeures(rep.theorique)} · P ${formatHeures(rep.pratique)})`}
                    </span>
                  ) : null}
                </div>
                <ul>
                  {o.seances.map((s) => {
                    numero += 1;
                    return (
                      <Fragment key={s.id}>
                        <LigneSeance
                          seance={s}
                          groupeId={groupeId}
                          numero={numero}
                          prochaine={s.id === prochaine?.id}
                          cessions={cessions[s.id]}
                        />
                        {/* Le contrôle se pose sous la dernière séance qui
                            l'a précédé : c'est là qu'il a eu lieu. */}
                        {(controlesApres[s.id] ?? []).map((c) => (
                          <LigneControle
                            key={c.id}
                            controle={c}
                            groupeId={groupeId}
                          />
                        ))}
                      </Fragment>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
