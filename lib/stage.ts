/**
 * Barème officiel de la compétence 16, source unique du projet.
 *
 * Les deux grilles totalisent 20 chacune. Les sous-totaux se calculent, ils ne
 * se stockent jamais : une somme recopiée se désynchronise au premier
 * ajustement d'une sous-note.
 */

export const BAREME = {
  rapport: { presentation: 8, contenu: 12 },
  expose: { fond: 14, forme: 6 },
} as const;

export type NotesStage = {
  note_rapport_presentation: number | null;
  note_rapport_contenu: number | null;
  note_expose_fond: number | null;
  note_expose_forme: number | null;
};

/**
 * Somme d'une grille, ou null tant qu'aucune de ses deux cases n'est saisie.
 *
 * Une case vide vaut zéro dans le total dès que l'autre est remplie : un
 * rapport noté 10/12 sur le contenu et rien sur la présentation vaut 10, pas
 * « pas de note ». C'est ce que fait un correcteur sur une copie.
 */
function total(a: number | null, b: number | null): number | null {
  if (a === null && b === null) return null;
  return (a ?? 0) + (b ?? 0);
}

export function totalRapport(n: NotesStage): number | null {
  return total(n.note_rapport_presentation, n.note_rapport_contenu);
}

export function totalExpose(n: NotesStage): number | null {
  return total(n.note_expose_fond, n.note_expose_forme);
}

/** Moyenne des deux grilles, seulement si les deux sont commencées. */
export function noteFinale(n: NotesStage): number | null {
  const r = totalRapport(n);
  const e = totalExpose(n);
  if (r === null || e === null) return null;
  return Math.round(((r + e) / 2) * 100) / 100;
}

/** Les trois pièces attendues, dans l'ordre où elles arrivent. */
export const DOCUMENTS_STAGE = [
  { type: "contrat", label: "Convention de stage" },
  { type: "attestation", label: "Attestation de stage" },
  { type: "note_tuteur", label: "Note du tuteur" },
] as const;

export type TypeDocumentStage = (typeof DOCUMENTS_STAGE)[number]["type"];
