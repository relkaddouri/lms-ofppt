import type { ProgressionModule } from "@/app/actions/progression";

/** Somme des heures réalisées et allouées sur un ensemble de modules. */
export function cumule(lignes: ProgressionModule[]) {
  const heuresRealisees = lignes.reduce((s, l) => s + l.heures_realisees, 0);
  const masseHoraire = lignes.reduce((s, l) => s + l.masse_horaire_allouee, 0);
  return {
    heuresRealisees,
    masseHoraire,
    pourcentage: masseHoraire > 0
      ? Math.round((heuresRealisees / masseHoraire) * 100)
      : 0,
    seancesSansDuree: lignes.reduce((s, l) => s + l.nb_seances_sans_duree, 0),
  };
}
