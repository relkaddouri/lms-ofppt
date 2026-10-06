/**
 * Lire une fiche de préparation enregistrée.
 *
 * Séparé de l'écran qui l'édite pour deux raisons : le cahier du formateur a
 * besoin de relire les fiches sans rien afficher, et trois formats cohabitent
 * en base — cette relecture mérite d'être vérifiée sans React.
 */

import {
  phasesDepuisAncienneFiche,
  quatrePhases,
  type PhaseFiche,
} from "@/lib/phases";

export type { PhaseFiche };

export type Fiche = {
  nature: string;
  objectifs: string;
  methodeActive: string;
  modalite: string;
  fichiers: string;
  /** Les quatre phases, dans l'ordre — PRD §4.3ter. */
  phases: PhaseFiche[];
};

export function ficheVide(minutesSeance: number | null = null): Fiche {
  return {
    nature: "cours théorique",
    objectifs: "",
    methodeActive: "",
    modalite: "Synchrone présentiel",
    fichiers: "-",
    phases: quatrePhases([], minutesSeance),
  };
}

/**
 * Relit une fiche enregistrée, quel que soit son âge.
 *
 * Trois formats se sont succédé et cohabitent en base : du Markdown libre
 * d'avant la mise au format officiel, la structure minutée
 * (motivation/plan/développement/évaluation/prochaine), et les quatre phases.
 * Aucun n'est perdu : le premier atterrit dans l'activité, le deuxième est
 * converti phase par phase (§4.3ter, « remplace, ne s'ajoute pas »).
 */
export function lireFiche(
  contenu: string | null,
  minutesSeance: number | null = null,
): Fiche {
  const vide = ficheVide(minutesSeance);
  if (!contenu?.trim()) return vide;

  let brut: Record<string, unknown>;
  try {
    brut = JSON.parse(contenu) as Record<string, unknown>;
    if (!brut || typeof brut !== "object") throw new Error("format inconnu");
  } catch {
    const v = ficheVide(minutesSeance);
    const act = v.phases.find((p) => p.cle === "activite")!;
    act.instructions = contenu.trim().split("\n").filter(Boolean).slice(0, 20);
    return v;
  }

  const base: Fiche = {
    nature: String(brut.nature ?? vide.nature),
    objectifs: String(brut.objectifs ?? ""),
    methodeActive: String(brut.methodeActive ?? ""),
    modalite: String(brut.modalite ?? vide.modalite),
    fichiers: String(brut.fichiers ?? vide.fichiers),
    phases: vide.phases,
  };

  if (Array.isArray(brut.phases)) {
    return { ...base, phases: quatrePhases(brut.phases, minutesSeance) };
  }
  const reprises = phasesDepuisAncienneFiche(brut, minutesSeance);
  return reprises ? { ...base, phases: reprises } : base;
}
