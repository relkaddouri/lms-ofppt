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

/** Onglet correspondant à un chemin. Retombe sur « stagiaires », la racine. */
export function ongletGroupeActif(pathname: string): OngletGroupe {
  const trouve = ONGLETS_GROUPE.find(
    (o) => o.segment !== "" && pathname.endsWith(`/${o.segment}`),
  );
  return trouve ?? ONGLETS_GROUPE[0];
}

export function hrefOngletGroupe(groupeId: string, onglet: OngletGroupe) {
  return onglet.segment
    ? `/groupes/${groupeId}/${onglet.segment}`
    : `/groupes/${groupeId}`;
}
