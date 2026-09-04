"use client";

import { Pencil, Trash2 } from "lucide-react";
import type { MotifHebdomadaire } from "@/app/actions/motifs";
import { JOURS } from "@/lib/motifs";
import { CRENEAUX_JOUR, formatHeure, positionSeance } from "@/lib/creneaux";
import { couleurGroupe } from "@/lib/couleurs-groupe";


/**
 * Le motif en grille : jours en colonnes, créneaux en lignes.
 *
 * C'est la forme du document officiel — section I.B du cahier du formateur —
 * et c'est aussi la seule qui rende lisible d'un coup d'œil ce que le motif
 * réserve à chaque groupe.
 */
export default function GrilleMotif({
  motif,
  modifiable = false,
  onSupprimer,
  onModifier,
}: {
  motif: MotifHebdomadaire;
  modifiable?: boolean;
  onSupprimer?: (id: string) => void;
  onModifier?: (creneau: MotifHebdomadaire["creneaux"][number]) => void;
}) {
  // Quatre créneaux fixes de 2 h 30, comme le calendrier (design_system.md
  // §5.5). Prendre les créneaux déclarés comme lignes donnait à un créneau de
  // 5 h sa propre rangée, à côté d'une rangée de 2 h 30 : deux durées
  // différentes occupaient la même hauteur, et la grille ne se lisait plus.
  const places = new Map<string, { creneau: (typeof motif.creneaux)[number]; span: number }[]>();
  const horsGrille: typeof motif.creneaux = [];
  for (const c of motif.creneaux) {
    const pos = positionSeance(c.heure_debut, c.heure_fin);
    if (!pos) {
      horsGrille.push(c);
      continue;
    }
    const cle = `${c.jour_semaine}|${pos.index}`;
    places.set(cle, [...(places.get(cle) ?? []), { creneau: c, span: pos.span }]);
  }

  const groupesVus = [
    ...new Map(motif.creneaux.map((c) => [c.groupe_id, c.groupeNom])).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1], "fr"));

  if (motif.creneaux.length === 0) {
    return (
      <p className="px-6 py-10 text-center text-[14.5px] text-slate-light">
        Ce motif ne contient encore aucun créneau.
      </p>
    );
  }

  return (
    <div>
      {groupesVus.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 pb-3 pt-1">
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

      <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse">
        <thead>
          <tr>
            <th className="w-[120px] border-b border-separator px-4 py-3 text-left font-mono text-[10.5px] uppercase tracking-[0.12em] text-slate-light">
              Créneau
            </th>
            {JOURS.map((j) => (
              <th
                key={j.valeur}
                className="border-b border-l border-separator px-3 py-3 text-left font-display text-[13.5px] font-semibold text-ink"
              >
                {j.long}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CRENEAUX_JOUR.map((creneau, ligne) => (
            <tr key={creneau.debut}>
              <th className="border-b border-separator px-4 py-3 text-left align-top font-mono text-[12.5px] font-medium text-body">
                {formatHeure(creneau.debut)}
                <span className="block text-slate-light">
                  {formatHeure(creneau.fin)}
                </span>
              </th>
              {JOURS.map((j) => {
                // Un créneau de 5 h occupe la cellule de sa première ligne et
                // déborde sur la suivante : celle-ci ne se dessine pas.
                const couverte = [1, 2, 3].some((recul) =>
                  (places.get(`${j.valeur}|${ligne - recul}`) ?? []).some(
                    (x) => x.span > recul,
                  ),
                );
                if (couverte) return null;

                const ici = places.get(`${j.valeur}|${ligne}`) ?? [];
                const span = ici.reduce((m, x) => Math.max(m, x.span), 1);

                return (
                  <td
                    key={j.valeur}
                    rowSpan={span}
                    className="border-b border-l border-separator p-1.5 align-top"
                  >
                    <div className="flex h-full flex-col gap-1.5">
                      {ici.map(({ creneau: c, span: n }) => {
                        const couleur = couleurGroupe(c.groupe_id);
                        return (
                          <div
                            key={c.id}
                            style={{
                              background: couleur.fond,
                              borderColor: couleur.trait,
                            }}
                            className="flex flex-1 items-start gap-2 rounded-[9px] border border-l-[3px] px-2.5 py-2"
                          >
                            <span className="flex min-w-0 flex-col">
                              <span
                                className="truncate text-[13px] font-semibold"
                                style={{ color: couleur.trait }}
                              >
                                {c.groupeNom}
                              </span>
                              <span
                                className="font-mono text-[10.5px]"
                                style={{ color: couleur.trait, opacity: 0.75 }}
                              >
                                {formatHeure(c.heure_debut)}–
                                {formatHeure(c.heure_fin)}
                                {n > 1 ? ` · ${n * 2.5} h` : ""}
                              </span>
                            </span>
                            {modifiable && (onModifier || onSupprimer) ? (
                              <span className="ml-auto flex shrink-0 items-center gap-0.5">
                                {onModifier ? (
                                  <button
                                    type="button"
                                    aria-label={`Déplacer ${c.groupeNom} du ${j.long} ${formatHeure(c.heure_debut)}`}
                                    onClick={() => onModifier(c)}
                                    className="rounded-md p-0.5 text-slate transition-colors duration-150 ease-out hover:bg-paper hover:text-ink"
                                  >
                                    <Pencil size={13} aria-hidden />
                                  </button>
                                ) : null}
                                {onSupprimer ? (
                                  <button
                                    type="button"
                                    aria-label={`Retirer ${c.groupeNom} du ${j.long} ${formatHeure(c.heure_debut)}`}
                                    onClick={() => onSupprimer(c.id)}
                                    className="rounded-md p-0.5 text-coral-dark transition-colors duration-150 ease-out hover:bg-alert-wash"
                                  >
                                    <Trash2 size={13} aria-hidden />
                                  </button>
                                ) : null}
                              </span>
                            ) : null}
                          </div>
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
        <p className="mx-4 mb-3 rounded-[10px] border border-border-strong bg-paper px-4 py-3 text-[13.5px] text-slate-2">
          {horsGrille.length} créneau{horsGrille.length > 1 ? "x" : ""} ne
          tombe{horsGrille.length > 1 ? "nt" : ""} sur aucun bloc de 2 h 30 et
          n&apos;apparaî{horsGrille.length > 1 ? "ssent" : "t"} pas dans la
          grille :{" "}
          {horsGrille
            .map(
              (c) =>
                `${c.groupeNom} ${formatHeure(c.heure_debut)}–${formatHeure(c.heure_fin)}`,
            )
            .join(", ")}
          .
        </p>
      ) : null}
    </div>
  );
}
