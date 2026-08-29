/**
 * Natures de jours non travaillés : source unique du mapping valeur → libellé,
 * partagée par le formulaire et par le calendrier (conventions.md).
 *
 * Ce tableau vit dans `lib/` et non dans l'action serveur : un fichier
 * « use server » ne peut exporter que des fonctions asynchrones.
 */

export type TypeIndisponibilite = "ferie" | "vacances" | "absence" | "personnel";

export const TYPES_INDISPONIBILITE: {
  valeur: TypeIndisponibilite;
  label: string;
  /** Ce qu'on écrit dans la case du calendrier quand aucun libellé n'est saisi. */
  defaut: string;
}[] = [
  { valeur: "ferie", label: "Jour férié", defaut: "Férié" },
  { valeur: "vacances", label: "Vacances", defaut: "Vacances" },
  { valeur: "absence", label: "Absence (maladie…)", defaut: "Absence" },
  { valeur: "personnel", label: "Engagement personnel", defaut: "Indisponible" },
];

export type Indisponibilite = {
  id: string;
  type: TypeIndisponibilite;
  date_debut: string;
  date_fin: string;
  demi_journee: "matin" | "soir" | null;
  libelle: string | null;
  motif: string | null;
};
