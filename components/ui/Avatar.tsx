import { initials } from "@/lib/format";

export type AvatarTaille = "sm" | "md" | "lg";

/**
 * Pastille d'initiales — l'élément signature des listes de personnes.
 *
 * La v3 renverse le motif de la v2 : fond plein coloré et initiales blanches
 * en Sora, au lieu d'initiales colorées sur fond pâle. Relevé dans les écrans
 * livrés (`docs/new_design/`), où l'avatar est toujours `background` plein +
 * `color:#FFFFFF` + `font-family:Sora;font-weight:600`.
 *
 * Le corail est volontairement exclu de la palette de fonds : un groupe de
 * sept stagiaires afficherait plusieurs avatars corail sur le même écran, ce
 * que la règle du corail interdit (design_system.md §1).
 */
const FONDS = ["bg-ink", "bg-green", "bg-teal"] as const;

const tailles: Record<AvatarTaille, string> = {
  sm: "h-[38px] w-[38px] text-[13px]",
  md: "h-10 w-10 text-[13px]",
  lg: "h-11 w-11 text-[15px]",
};

/**
 * Couleur stable pour une même personne : deux rendus de la même liste ne
 * doivent pas permuter les couleurs.
 */
function fondDe(graine: string): string {
  let somme = 0;
  for (let i = 0; i < graine.length; i++) somme += graine.charCodeAt(i);
  return FONDS[somme % FONDS.length]!;
}

export default function Avatar({
  nom,
  prenom,
  taille = "md",
  /** Contenu littéral, pour les cas qui ne sont pas des initiales (« +12 »). */
  texte,
  /** Variante neutre : compteur de reste, personne inconnue. */
  neutre = false,
  /** Anneau blanc pour les avatars empilés qui se chevauchent. */
  empile = false,
  className = "",
}: {
  nom?: string | null;
  prenom?: string | null;
  taille?: AvatarTaille;
  texte?: string;
  neutre?: boolean;
  empile?: boolean;
  className?: string;
}) {
  const libelle = `${prenom ?? ""} ${nom ?? ""}`.trim();
  const apparence = neutre
    ? "bg-wash text-slate-2"
    : `${fondDe(libelle || "?")} text-white`;

  return (
    <span
      aria-hidden
      className={[
        "flex shrink-0 items-center justify-center rounded-full font-semibold",
        texte ? "font-mono" : "font-display",
        tailles[taille],
        apparence,
        empile ? "border-2 border-surface -ml-[9px] first:ml-0" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {texte ?? initials(prenom, nom)}
    </span>
  );
}
