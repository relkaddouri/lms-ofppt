"use client";

import { Trash2 } from "lucide-react";
import type { MotifHebdomadaire } from "@/app/actions/motifs";
import { JOURS } from "@/lib/motifs";

/** Teinte stable par groupe : deux rendus ne permutent pas les couleurs. */
const TEINTES = [
  "border-tint-teal-strong bg-tint-teal text-teal-dark",
  "border-tint-green bg-success-wash text-green-dark",
  "border-border bg-wash-strong text-slate-2",
] as const;

export function teinteGroupe(id: string): string {
  let somme = 0;
  for (const c of id) somme += c.charCodeAt(0);
  return TEINTES[somme % TEINTES.length]!;
}

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
}: {
  motif: MotifHebdomadaire;
  modifiable?: boolean;
  onSupprimer?: (id: string) => void;
}) {
  // Les lignes sont les créneaux distincts du motif, dans l'ordre horaire :
  // une grille d'heures fixes laisserait des rangées vides.
  const lignes = [
    ...new Set(motif.creneaux.map((c) => `${c.heure_debut}-${c.heure_fin}`)),
  ].sort();

  if (motif.creneaux.length === 0) {
    return (
      <p className="px-6 py-10 text-center text-[14.5px] text-slate-light">
        Ce motif ne contient encore aucun créneau.
      </p>
    );
  }

  return (
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
          {lignes.map((ligne) => {
            const [debut, fin] = ligne.split("-");
            return (
              <tr key={ligne}>
                <th className="border-b border-separator px-4 py-3 text-left align-top font-mono text-[12.5px] font-medium text-body">
                  {debut}
                  <span className="block text-slate-light">{fin}</span>
                </th>
                {JOURS.map((j) => {
                  const dedans = motif.creneaux.filter(
                    (c) =>
                      c.jour_semaine === j.valeur &&
                      `${c.heure_debut}-${c.heure_fin}` === ligne,
                  );
                  return (
                    <td
                      key={j.valeur}
                      className="border-b border-l border-separator p-1.5 align-top"
                    >
                      {dedans.map((c) => (
                        <div
                          key={c.id}
                          className={`flex items-center gap-2 rounded-[9px] border px-2.5 py-2 ${teinteGroupe(c.groupe_id)}`}
                        >
                          <span className="truncate text-[13px] font-semibold">
                            {c.groupeNom}
                          </span>
                          {modifiable && onSupprimer ? (
                            <button
                              type="button"
                              aria-label={`Retirer ${c.groupeNom} du ${j.long} ${debut}`}
                              onClick={() => onSupprimer(c.id)}
                              className="ml-auto shrink-0 rounded-md p-0.5 text-coral-dark transition-colors duration-150 ease-out hover:bg-alert-wash"
                            >
                              <Trash2 size={13} aria-hidden />
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
