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

/** Ce qu'il faut savoir d'une séance pour y situer un contrôle. */
type SeanceSituee = {
  id: string;
  module_id: string;
  date: string | null;
  statut: string;
  duree_prevue: number | null;
  duree_realisee: number | null;
};

/** Ce qu'il faut savoir d'un contrôle pour le compter. */
type ControleACompter = {
  id: string;
  module_id: string;
  type: "CC" | "EFM" | "TEST";
  statut: string;
  date_prevue: string | null;
  duree_heures: number | null;
};

export type ControleCompte = {
  /** Heures d'épreuve : la durée saisie sur le contrôle. */
  heures: number;
  /** Pour un EFM, le reste du créneau, consacré à la correction. */
  correction: number;
  /** La séance d'un autre module sur le créneau de laquelle il a été passé. */
  creneau: { seanceId: string; moduleId: string } | null;
};

/**
 * Les heures des contrôles, rangées dans leur module.
 *
 * Demande du formateur (04/11/2026) : un contrôle de M202 passé sur un
 * créneau de M203 compte pour M202, pas pour M203. La séance M203 du jour,
 * marquée faite, comptait jusqu'ici ses 5 h en M203, et le contrôle rien
 * nulle part.
 *
 * Règles validées par le formateur :
 * - seuls les CC et les EFM validés et dont le jour est passé comptent ; un
 *   TEST n'est pas une évaluation officielle ;
 * - un contrôle compte sa durée saisie ; un EFM compte en plus le reste du
 *   créneau, consacré à la correction (4 h d'épreuve sur un créneau de 5 h
 *   donnent 4 h + 1 h) ;
 * - passé sur une séance de son propre module, il est déjà dans ses heures :
 *   rien ne bouge ;
 * - passé sur la séance faite d'un autre module, ses heures quittent ce
 *   module pour le sien ;
 * - un jour sans séance, ses heures s'ajoutent simplement à son module.
 */
export function compterControles(
  seances: SeanceSituee[],
  controles: ControleACompter[],
  aujourdhui: string,
) {
  const parControle = new Map<string, ControleCompte>();
  const ajout = new Map<string, number>();
  const retrait = new Map<string, number>();
  // Par séance faite d'un autre module : les heures que le contrôle lui a
  // prises. Ce sont des heures de cours à refaire (demande du 04/11/2026).
  const cedees = new Map<string, number>();
  const ajoute = (m: Map<string, number>, cle: string, h: number) =>
    m.set(cle, (m.get(cle) ?? 0) + h);

  for (const c of controles) {
    const jour = c.date_prevue;
    if (c.type === "TEST" || c.statut !== "valide" || !jour || jour > aujourdhui) {
      continue;
    }
    const heures = Number(c.duree_heures) || 0;
    const duJour = seances.filter((s) => s.date === jour);

    if (duJour.some((s) => s.module_id === c.module_id)) {
      parControle.set(c.id, { heures, correction: 0, creneau: null });
      continue;
    }

    // Les séances arrivent triées par heure : la première du jour d'un autre
    // module est celle qui a cédé son créneau.
    const hote = duJour[0];
    if (!hote) {
      parControle.set(c.id, { heures, correction: 0, creneau: null });
      ajoute(ajout, c.module_id, heures);
      continue;
    }

    const dureeCreneau = Number(hote.duree_realisee ?? hote.duree_prevue ?? 0);
    const epreuve = dureeCreneau > 0 ? Math.min(heures, dureeCreneau) : heures;
    const correction =
      c.type === "EFM" ? Math.max(0, dureeCreneau - epreuve) : 0;
    parControle.set(c.id, {
      heures: epreuve,
      correction,
      creneau: { seanceId: hote.id, moduleId: hote.module_id },
    });
    ajoute(ajout, c.module_id, epreuve + correction);
    // Une séance encore à faire ne compte rien : il n'y a rien à lui retirer.
    if (hote.statut === "fait") {
      ajoute(retrait, hote.module_id, epreuve + correction);
      ajoute(cedees, hote.id, epreuve + correction);
    }
  }

  return { parControle, ajout, retrait, cedees };
}
