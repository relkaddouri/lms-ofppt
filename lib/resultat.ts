/**
 * Ce que porte un résultat d'évaluation publié (PRD §4.7).
 *
 * Hors du module PDF, qui embarque jsPDF : l'action serveur qui assemble ces
 * données n'a pas à charger un moteur de rendu pour en connaître la forme, et
 * deux écrans doivent pouvoir la manipuler sans dépendre l'un de l'autre.
 */

export type LigneResultat = {
  enonce: string;
  bareme: number;
  points: number;
  /** Ce que le stagiaire a écrit. Absent des documents produits avant §4.7. */
  reponse?: string | null;
  /** La réponse attendue, telle que le formateur l'a préparée. */
  corrige?: string | null;
  /** Ce que le formateur a écrit sur cette question en particulier. */
  commentaire?: string | null;
};

/**
 * Le cartouche d'identification, en tête du document.
 *
 * Un résultat signé est une pièce administrative : il doit dire de lui-même
 * d'où il vient, sans qu'on ait à ouvrir l'application. Établissement,
 * filière, groupe, module, formateur, épreuve, date et horaire — c'est ce que
 * la Direction cherche en le prenant en main, et ce qu'aucune ligne de
 * contexte en petits caractères ne remplaçait.
 *
 * Chaque champ est facultatif : une ligne sans valeur ne s'imprime pas plutôt
 * que d'afficher une étiquette sur du vide.
 */
export type Identification = {
  etablissement?: string | null;
  /** Le Code d'Enregistrement du Formé — l'identifiant OFPPT du stagiaire. */
  cef?: string | null;
  /** Le Code National de l'Étudiant, réclamé par les pièces officielles. */
  cne?: string | null;
  /** « Théorique », « Pratique » ou « Mixte » — la forme de l'épreuve. */
  forme?: string | null;
  filiere?: string | null;
  groupe?: string | null;
  anneeScolaire?: string | null;
  module?: string | null;
  formateur?: string | null;
  matricule?: string | null;
  /** « Lundi 07/09/2026 ». */
  dateEpreuve?: string | null;
  /** « de 8 h 30 à 11 h · 2 h 30 », déduit de l'emploi du temps. */
  horaire?: string | null;
};

export type ResultatControle = {
  titre: string;
  stagiaire: string;
  /** « Contrôle continu » ou « Épreuve de fin de module ». */
  nature: string;
  datePublication: string;
  note: number;
  total: number;
  /** L'identifiant de la copie, porté par le QR code au bas du document. */
  reference: string;
  /**
   * De quoi nommer le fichier téléchargé, selon la convention arrêtée :
   * NOM-STAGIAIRE_MODULE_CEF_ÉPREUVE_DATE.
   *
   * Ces trois champs vivent hors de `identification` parce qu'ils ne
   * s'impriment pas : ils servent au nom du fichier, pas au cartouche.
   */
  codeEpreuve: string;
  codeModule: string | null;
  cef: string | null;
  /** La date de l'épreuve en ISO, pour que les fichiers se trient. */
  dateFichier: string | null;
  identification: Identification;
  lignes: LigneResultat[];
};
