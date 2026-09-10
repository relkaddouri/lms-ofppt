/**
 * Source unique du mapping onglet → libellé pour un groupe.
 * Ne jamais réécrire cette liste localement (conventions.md : « une seule
 * source de vérité pour tout mapping »).
 */
export const ONGLETS_GROUPE = [
  { key: "stagiaires", label: "Stagiaires", segment: "" },
  { key: "modules", label: "Modules", segment: "modules" },
  { key: "progression", label: "Progression", segment: "progression" },
  { key: "presences", label: "Présences", segment: "presences" },
  { key: "annonces", label: "Annonces", segment: "annonces" },
  { key: "fiches", label: "Fiches", segment: "fiches" },
  { key: "controles", label: "Contrôles", segment: "controles" },
  { key: "devoirs", label: "Devoirs", segment: "devoirs" },
  { key: "stage", label: "Stage", segment: "stage" },
] as const;

export type OngletGroupe = (typeof ONGLETS_GROUPE)[number];

/**
 * Les sections qui n'ont pas d'onglet à elles, et celui qui les représente.
 *
 * On entre dans une séance depuis la progression : c'est donc elle qui reste
 * allumée pendant qu'on la consulte, plutôt que de laisser la barre désigner
 * un onglet où l'on n'est pas.
 */
const RATTACHEMENTS: Record<string, string> = {
  seances: "progression",
};

/**
 * Onglet correspondant à un chemin, lu sur le segment qui suit l'identifiant
 * du groupe.
 *
 * La version précédente testait la fin du chemin. Sur une page de détail —
 * `/groupes/<id>/seances/<seanceId>` — aucun segment ne correspondait, et la
 * barre retombait sur son premier onglet : on ouvrait une séance et
 * « Stagiaires » s'allumait. Quatre écrans en souffraient, tous ceux dont
 * l'adresse ne finit pas par un nom d'onglet.
 */
export function ongletGroupeActif(pathname: string): OngletGroupe {
  // ["groupes", "<id>", "<section>", …]
  const segment = pathname.split("/").filter(Boolean)[2] ?? "";
  const cible = RATTACHEMENTS[segment] ?? segment;
  return (
    ONGLETS_GROUPE.find((o) => o.segment === cible) ?? ONGLETS_GROUPE[0]
  );
}

export function hrefOngletGroupe(groupeId: string, onglet: OngletGroupe) {
  return onglet.segment
    ? `/groupes/${groupeId}/${onglet.segment}`
    : `/groupes/${groupeId}`;
}
