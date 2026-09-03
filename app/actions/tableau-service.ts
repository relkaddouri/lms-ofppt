"use server";

import { createClient } from "@/lib/supabase/server";
import type { LigneService, TableauService } from "@/lib/tableau-service";
import { getPortee } from "@/app/actions/annees";

/**
 * Toutes les affectations horaires du formateur, dans l'ordre du document.
 *
 * Un module enseigné à deux groupes produit deux lignes, chacune avec la
 * masse horaire propre à son groupe : le total ne passe jamais par la durée de
 * référence nationale, qui ne compterait qu'une fois.
 */
export async function getTableauService(): Promise<TableauService> {
  const supabase = await createClient();

  // Le tableau porte l'année scolaire en en-tête : il ne peut pas additionner
  // les affectations de plusieurs années sous ce titre-là (PRD §4.15).
  const { groupeIds } = await getPortee();

  const { data, error } = await supabase
    .from("groupe_modules")
    .select(
      "groupe_id, module_id, presentiel_s1, fad_s1, presentiel_s2, fad_s2, fad_mutualisee, groupes!inner(nom, annee, specialites(nom)), modules!inner(nom, competences(code_operationnel))",
    )
    .in("groupe_id", groupeIds);
  if (error) throw new Error(error.message);

  const specialites = new Set<string>();

  const lignes = (data ?? []).map((row) => {
    const r = row as unknown as {
      groupe_id: string;
      module_id: string;
      presentiel_s1: number | string | null;
      fad_s1: number | string | null;
      presentiel_s2: number | string | null;
      fad_s2: number | string | null;
      fad_mutualisee: boolean | null;
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

    if (r.groupes?.specialites?.nom) specialites.add(r.groupes.specialites.nom);

    return {
      id: `${r.groupe_id}:${r.module_id}`,
      // Les groupes de 1ʳᵉ année n'ont pas de spécialité : le tronc commun
      // relève quand même de la filière du formateur sur le document officiel.
      filiere: r.groupes?.specialites?.nom ?? "Digital Design",
      groupe: r.groupes?.nom ?? "—",
      annee: r.groupes?.annee ?? null,
      codeModule: r.modules?.competences?.code_operationnel ?? null,
      module: r.modules?.nom ?? "Module",
      presentielS1: Number(r.presentiel_s1) || 0,
      fadS1: Number(r.fad_s1) || 0,
      presentielS2: Number(r.presentiel_s2) || 0,
      fadS2: Number(r.fad_s2) || 0,
      fadMutualisee: r.fad_mutualisee === true,
    };
  });

  lignes.sort(
    (a, b) =>
      (a.annee ?? 0) - (b.annee ?? 0) ||
      a.groupe.localeCompare(b.groupe, "fr") ||
      (a.codeModule ?? "").localeCompare(b.codeModule ?? "", "fr") ||
      a.module.localeCompare(b.module, "fr"),
  );

  return {
    lignes,
    // Plusieurs spécialités se lisent côte à côte plutôt que d'en élire une :
    // l'en-tête décrit ce que le formateur enseigne, pas un seul groupe.
    specialite: specialites.size ? [...specialites].sort().join(" · ") : null,
  };
}
