/**
 * Le vocabulaire de la surveillance d'un contrôle, partagé par les deux côtés.
 *
 * Le stagiaire écrit les événements, le formateur les lit : sans source
 * unique, les deux écrans auraient fini par ne plus désigner la même chose.
 * Rien ici ne touche au réseau — que des noms, des libellés et une déduction.
 */

export const BUCKET_SURVEILLANCE = "surveillance-controles";

/**
 * Vingt-cinq secondes entre deux captures.
 *
 * Assez court pour qu'on voie ce qui se passe, assez long pour que le
 * navigateur n'y laisse pas de batterie. Le chemin du fichier étant stable,
 * chaque capture remplace la précédente : l'intervalle ne fait pas grossir
 * le stockage, il ne fait que rafraîchir une image.
 *
 * À noter, et c'est voulu : cette minuterie n'appelle jamais le serveur de
 * l'application. Elle dépose dans le Storage, en direct. Les règles de ce
 * dépôt interdisent les vérifications régulières parce qu'elles réveillent
 * Vercel à chaque tour ; celle-ci ne le réveille pas une fois.
 */
export const INTERVALLE_CAPTURE_MS = 25_000;

/** Largeur des captures. On surveille des vignettes, pas des documents. */
export const LARGEUR_CAPTURE = 640;

/** Qualité JPEG : au-delà, on paie des pixels qu'aucun œil ne lira. */
export const QUALITE_CAPTURE = 0.5;

export const TYPES_EVENEMENT = [
  "partage_accepte",
  "partage_refuse",
  "partage_arrete",
  "ecran_quitte",
  "ecran_revenu",
  "collage",
  "appareil_incompatible",
] as const;

export type TypeEvenement = (typeof TYPES_EVENEMENT)[number];

export type EvenementSurveillance = {
  id: string;
  stagiaireId: string;
  type: TypeEvenement;
  creeLe: string;
};

/**
 * Le chemin d'une capture : `<compte>/<contrôle>.jpg`.
 *
 * L'identifiant du compte en premier segment, parce que c'est lui que la
 * policy d'écriture compare à `auth.uid()` sans jointure (migration 111). Et
 * le chemin ne dépend pas de l'instant : la capture suivante écrase la
 * précédente.
 */
export function cheminCapture(userId: string, controleId: string): string {
  return `${userId}/${controleId}.jpg`;
}

/**
 * Ce que la carte d'un stagiaire raconte.
 *
 * `en_attente` n'est pas une anomalie : c'est l'état d'un stagiaire qui n'a
 * pas encore ouvert l'épreuve. Un contrôle qui vient d'être ouvert n'affiche
 * que cela, et c'est normal.
 */
export type EtatSurveillance =
  | "en_attente"
  | "actif"
  | "ecran_quitte"
  | "partage_arrete"
  | "partage_refuse"
  | "appareil_incompatible";

export const LIBELLES_ETAT: Record<EtatSurveillance, string> = {
  en_attente: "Pas encore commencé",
  actif: "Écran partagé",
  ecran_quitte: "A quitté la page",
  partage_arrete: "Partage arrêté",
  partage_refuse: "Partage refusé",
  appareil_incompatible: "Appareil incompatible",
};

/**
 * Les états qui demandent un regard, et ceux qui ne demandent rien.
 *
 * « A quitté la page » n'est pas une fraude : on change d'onglet pour mille
 * raisons. C'est une chose à voir, pas une accusation — d'où l'ambre, et le
 * rouge réservé à ce qui empêche la surveillance de fonctionner.
 */
export const GRAVITE_ETAT: Record<EtatSurveillance, "neutre" | "attention" | "alerte"> = {
  en_attente: "neutre",
  actif: "neutre",
  ecran_quitte: "attention",
  partage_arrete: "alerte",
  partage_refuse: "alerte",
  appareil_incompatible: "alerte",
};

/**
 * L'état d'un stagiaire, déduit de ses événements.
 *
 * Aucune ligne d'état n'est tenue à jour en base : la table n'enregistre que
 * ce qui arrive, et l'état se relit du dernier événement qui en dit quelque
 * chose. Un collage n'en dit rien — il se compte à part, parce qu'il ne
 * remplace pas l'état mais s'y ajoute.
 *
 * Les événements peuvent arriver dans n'importe quel ordre : on trie, on ne
 * suppose pas.
 */
export function etatDuStagiaire(evenements: EvenementSurveillance[]): {
  etat: EtatSurveillance;
  collages: number;
  depuis: string | null;
} {
  if (evenements.length === 0) {
    return { etat: "en_attente", collages: 0, depuis: null };
  }

  const tries = [...evenements].sort((a, b) => a.creeLe.localeCompare(b.creeLe));
  const collages = tries.filter((e) => e.type === "collage").length;

  const PARLANTS: Partial<Record<TypeEvenement, EtatSurveillance>> = {
    partage_accepte: "actif",
    ecran_revenu: "actif",
    ecran_quitte: "ecran_quitte",
    partage_arrete: "partage_arrete",
    partage_refuse: "partage_refuse",
    appareil_incompatible: "appareil_incompatible",
  };

  for (let i = tries.length - 1; i >= 0; i -= 1) {
    const etat = PARLANTS[tries[i]!.type];
    if (etat) return { etat, collages, depuis: tries[i]!.creeLe };
  }

  return { etat: "en_attente", collages, depuis: null };
}

/** Regroupe les événements par stagiaire, pour la mosaïque. */
export function parStagiaire(
  evenements: EvenementSurveillance[],
): Map<string, EvenementSurveillance[]> {
  const par = new Map<string, EvenementSurveillance[]>();
  for (const e of evenements) {
    const liste = par.get(e.stagiaireId) ?? [];
    liste.push(e);
    par.set(e.stagiaireId, liste);
  }
  return par;
}
