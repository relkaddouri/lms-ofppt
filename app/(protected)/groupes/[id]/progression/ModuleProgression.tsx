"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import LigneSeance from "./LigneSeance";
import LigneControle from "./LigneControle";
import Badge from "@/components/ui/Badge";
import RappelControle from "@/components/RappelControle";
import { calculerRappel } from "@/lib/rappels";
import { formatHeures } from "@/lib/format";
import type { Seance } from "@/app/actions/seances";
import type { ControleProgression } from "@/app/actions/controles";
import { ChevronDown, ChevronRight } from "lucide-react";

export type ObjectifBloc = {
  code: string;
  intitule: string;
  seances: Seance[];
};

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
  objectifs,
  seances,
  controlesApres,
  controlesSansAncrage,
  ouvertParDefaut = false,
}: {
  groupeId: string;
  moduleId: string;
  nom: string;
  code: string | null;
  masseHoraire: number | null;
  /** Contrôles déjà validés sur ce couple : un brouillon ne couvre rien. */
  controlesCouverts: number;
  objectifs: ObjectifBloc[];
  seances: Seance[];
  /** Les contrôles à poser sous la séance qui les précède, par identifiant. */
  controlesApres: Record<string, ControleProgression[]>;
  /** Ceux qu'aucune séance ne précède : sans date, ou avant la première. */
  controlesSansAncrage: ControleProgression[];
  ouvertParDefaut?: boolean;
}) {
  const [ouvert, setOuvert] = useState(ouvertParDefaut);

  const faites = seances.filter((s) => s.statut === "fait");
  const heuresFaites = faites.reduce(
    (t, s) => t + Number(s.duree_realisee ?? s.duree_prevue ?? 0),
    0,
  );
  const heuresTotales = seances.reduce(
    (t, s) => t + Number(s.duree_prevue ?? s.duree_realisee ?? 0),
    0,
  );
  const pct =
    heuresTotales > 0 ? Math.round((heuresFaites / heuresTotales) * 100) : 0;
  const prochaine = seances.find((s) => s.statut !== "fait");
  const rappel = calculerRappel(
    masseHoraire ?? heuresTotales,
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
            <span
              className="h-1.5 w-40 overflow-hidden rounded-full bg-wash"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Avancement de ${nom}`}
            >
              <span
                className="block h-full rounded-full bg-ink"
                style={{ width: `${pct}%` }}
              />
            </span>
            <span className="text-xs text-slate">
              {formatHeures(heuresFaites)} sur {formatHeures(heuresTotales)}
              {masseHoraire ? ` · alloué ${formatHeures(masseHoraire)}` : ""}
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
            const heuresObjectif = o.seances.reduce(
              (t, s) => t + Number(s.duree_prevue ?? 0),
              0,
            );
            const toutFait = o.seances.every((s) => s.statut === "fait");
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
                  {heuresObjectif > 0 ? (
                    <span className="font-mono text-xs text-slate">
                      {formatHeures(heuresObjectif)}
                    </span>
                  ) : null}
                  {toutFait ? <Badge tone="success">terminé</Badge> : null}
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
