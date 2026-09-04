"use client";

import { useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import ListeCartes from "@/components/ui/ListeCartes";
import Badge from "@/components/ui/Badge";
import { formatDateJour, initials } from "@/lib/format";
import type { BilanPresences } from "@/app/actions/presences";
import { ChevronRight, UserCheck } from "lucide-react";

/** Le taux se lit d'un coup d'œil : sous 80 %, l'assiduité pose question. */
function tonTaux(taux: number): "success" | "info" | "danger" {
  if (taux >= 90) return "success";
  if (taux >= 80) return "info";
  return "danger";
}

export default function PresencesTableau({ bilan }: { bilan: BilanPresences }) {
  const [moduleId, setModuleId] = useState<string>("tous");
  const [ouvert, setOuvert] = useState<string | null>(null);

  // Une ligne par stagiaire : soit le module choisi, soit le cumul de tous.
  const lignes = useMemo(() => {
    const parStagiaire = new Map<
      string,
      {
        stagiaireId: string;
        nom: string;
        prenom: string;
        pointees: number;
        presences: number;
        absences: number;
        detailAbsences: BilanPresences["lignes"][number]["detailAbsences"];
      }
    >();

    for (const l of bilan.lignes) {
      if (moduleId !== "tous" && l.moduleId !== moduleId) continue;
      const courant = parStagiaire.get(l.stagiaireId) ?? {
        stagiaireId: l.stagiaireId,
        nom: l.nom,
        prenom: l.prenom,
        pointees: 0,
        presences: 0,
        absences: 0,
        detailAbsences: [],
      };
      courant.pointees += l.pointees;
      courant.presences += l.presences;
      courant.absences += l.absences;
      courant.detailAbsences = [...courant.detailAbsences, ...l.detailAbsences];
      parStagiaire.set(l.stagiaireId, courant);
    }

    return [...parStagiaire.values()]
      .map((s) => ({
        ...s,
        taux:
          s.pointees > 0 ? Math.round((s.presences / s.pointees) * 100) : null,
        detailAbsences: [...s.detailAbsences].sort((a, b) =>
          (b.date ?? "").localeCompare(a.date ?? ""),
        ),
      }))
      .sort((a, b) => a.nom.localeCompare(b.nom));
  }, [bilan.lignes, moduleId]);

  const totalPointees = lignes.reduce((n, l) => n + l.pointees, 0);

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="module" className="text-sm text-slate">
          Module
        </label>
        <select
          id="module"
          value={moduleId}
          onChange={(e) => setModuleId(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/20 max-md:min-h-11 max-md:w-full"
        >
          <option value="tous">Tous les modules</option>
          {bilan.modules.map((m) => (
            <option key={m.id} value={m.id}>
              {m.code ? `${m.code} — ${m.nom}` : m.nom}
            </option>
          ))}
        </select>

        {bilan.seancesNonPointees > 0 ? (
          <p className="text-xs text-slate">
            {bilan.seancesNonPointees} séance
            {bilan.seancesNonPointees > 1 ? "s" : ""} faite
            {bilan.seancesNonPointees > 1 ? "s" : ""} sans appel : elle
            {bilan.seancesNonPointees > 1 ? "s n'entrent" : " n'entre"} pas dans
            le calcul.
          </p>
        ) : null}
      </div>

      {totalPointees === 0 ? (
        <Card className="px-4 py-10 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-wash">
            <UserCheck className="h-6 w-6 text-ink" aria-hidden />
          </span>
          <p className="mt-4 text-base font-semibold text-ink">
            Aucun appel pointé
          </p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-slate">
            Le taux de présence se calcule à partir des appels faits en séance.
            Ouvrez une séance, onglet Déroulement, pour pointer le premier.
          </p>
        </Card>
      ) : (
        <ListeCartes
          lignes={lignes}
          cle={(l) => l.stagiaireId}
          vide="Aucun stagiaire."
          colonnes={[
            {
              cle: "stagiaire",
              entete: "Stagiaire",
              role: "titre",
              cellule: (l) => (
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-wash text-xs font-medium text-ink">
                    {initials(l.prenom, l.nom)}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-ink">
                      {l.prenom} {l.nom}
                    </p>
                    {l.absences > 0 ? (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setOuvert(
                              ouvert === l.stagiaireId ? null : l.stagiaireId,
                            )
                          }
                          aria-expanded={ouvert === l.stagiaireId}
                          className="mt-1 flex items-center gap-1 text-xs font-normal text-slate hover:text-ink max-md:min-h-11"
                        >
                          <ChevronRight
                            className={`h-3.5 w-3.5 transition-transform ${
                              ouvert === l.stagiaireId ? "rotate-90" : ""
                            }`}
                            aria-hidden
                          />
                          {ouvert === l.stagiaireId
                            ? "Masquer le détail"
                            : "Voir les absences"}
                        </button>

                        {ouvert === l.stagiaireId ? (
                          <ul className="mt-2 space-y-1.5 border-l-2 border-border pl-3">
                            {l.detailAbsences.map((a) => (
                              <li
                                key={a.seanceId}
                                className="text-xs font-normal text-slate"
                              >
                                <span className="font-mono text-ink">
                                  {formatDateJour(a.date, { court: true })}
                                </span>
                                {" — "}
                                {a.objectif ?? a.moduleNom}
                                {a.motif ? <span> ({a.motif})</span> : null}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </div>
              ),
            },
            {
              cle: "pointees",
              entete: "Pointées",
              aligne: "droite",
              cellule: (l) => (
                <span className="font-mono tabular-nums text-slate">
                  {l.pointees}
                </span>
              ),
            },
            {
              cle: "absences",
              entete: "Absences",
              aligne: "droite",
              cellule: (l) => (
                <span className="font-mono tabular-nums text-slate">
                  {l.absences}
                </span>
              ),
            },
            {
              cle: "taux",
              entete: "Présence",
              aligne: "droite",
              cellule: (l) =>
                l.taux === null ? (
                  <span className="text-slate">—</span>
                ) : (
                  <Badge tone={tonTaux(l.taux)}>{l.taux} %</Badge>
                ),
            },
          ]}
        />
      )}
    </div>
  );
}
