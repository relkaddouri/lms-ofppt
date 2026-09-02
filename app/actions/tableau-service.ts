"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Une ligne du tableau de service : une affectation groupe + module.
 *
 * Les colonnes reprennent le document officiel de la Direction Régionale
 * (PRD §4.13bis) dans son ordre, plus la décomposition présentiel / FAD que
 * le papier ne montre pas mais que le formateur suit pour lui-même.
 */
export type LigneService = {
  id: string;
  /** Date à laquelle le module a été affecté au groupe dans l'application. */
  dateAffectation: string | null;
  filiere: string;
  annee: number | null;
  groupe: string;
  codeModule: string | null;
  module: string;
  /** Masse horaire affectée — la colonne MH AFF du document officiel. */
  mhAffectee: number;
  heuresFad: number;
  heuresPresentiel: number;
};

/**
 * Toutes les affectations horaires du formateur, dans l'ordre du document.
 *
 * Le total se lit ligne à ligne : un module enseigné à deux groupes produit
 * deux lignes, chacune avec la masse horaire propre à son groupe. C'est la
 * règle de calcul du PRD §4.13bis — ne jamais passer par la durée de
 * référence nationale d'un module, qui ne compterait qu'une fois.
 */
export async function getTableauService(): Promise<LigneService[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("groupe_modules")
    .select(
      "groupe_id, module_id, created_at, masse_horaire_allouee, heures_fad, groupes!inner(nom, annee, specialites(nom)), modules!inner(nom, competences(code_operationnel))",
    );
  if (error) throw new Error(error.message);

  const lignes = (data ?? []).map((row) => {
    const r = row as unknown as {
      groupe_id: string;
      module_id: string;
      created_at: string | null;
      masse_horaire_allouee: number | string | null;
      heures_fad: number | string | null;
      groupes: {
        nom: string;
        annee: number | null;
        specialites: { nom: string } | null;
      } | null;
      modules: {
        nom: string;
        competences: { code_operationnel: string | null } | null;
      } | null;
    };

    const mhAffectee = Number(r.masse_horaire_allouee) || 0;
    // La FAD est un sous-ensemble de la masse affectée, pas un supplément :
    // le présentiel est ce qui reste, jamais négatif si la saisie dérape.
    const heuresFad = Math.min(Number(r.heures_fad) || 0, mhAffectee);

    return {
      id: `${r.groupe_id}:${r.module_id}`,
      dateAffectation: r.created_at ? r.created_at.slice(0, 10) : null,
      // Les groupes de 1ʳᵉ année n'ont pas de spécialité : le tronc commun
      // relève quand même de la filière du formateur sur le document officiel.
      filiere: r.groupes?.specialites?.nom ?? "Digital Design",
      annee: r.groupes?.annee ?? null,
      groupe: r.groupes?.nom ?? "—",
      codeModule: r.modules?.competences?.code_operationnel ?? null,
      module: r.modules?.nom ?? "Module",
      mhAffectee,
      heuresFad,
      heuresPresentiel: mhAffectee - heuresFad,
    };
  });

  return lignes.sort(
    (a, b) =>
      (a.annee ?? 0) - (b.annee ?? 0) ||
      a.groupe.localeCompare(b.groupe, "fr") ||
      (a.codeModule ?? "").localeCompare(b.codeModule ?? "", "fr") ||
      a.module.localeCompare(b.module, "fr"),
  );
}
