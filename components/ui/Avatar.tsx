import { initials } from "@/lib/format";
import { urlPhoto } from "@/lib/photos";

export type AvatarTaille = "xs" | "sm" | "md" | "lg";

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
  xs: "h-[34px] w-[34px] text-[11.5px]",
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
  /** Chemin de la photo dans le bucket ; les initiales restent le défaut. */
  photo,
  className = "",
}: {
  nom?: string | null;
  prenom?: string | null;
  taille?: AvatarTaille;
  texte?: string;
  neutre?: boolean;
  empile?: boolean;
  photo?: string | null;
  className?: string;
}) {
  const libelle = `${prenom ?? ""} ${nom ?? ""}`.trim();
  const apparence = neutre
    ? "bg-wash text-slate-2"
    : `${fondDe(libelle || "?")} text-white`;

  const cadre = [
    "flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold",
    texte ? "font-mono" : "font-display",
    tailles[taille],
    empile ? "border-2 border-surface -ml-[9px] first:ml-0" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  // La photo remplace les initiales quand elle existe, jamais l'inverse : un
  // chemin cassé ou un bucket injoignable laisserait sinon un trou gris à la
  // place d'une personne. Le fond coloré reste dessous et réapparaît si
  // l'image ne charge pas.
  const source = urlPhoto(photo);
  if (source && !texte) {
    return (
      <span aria-hidden className={`${cadre} ${apparence}`}>
        {/* `img` et non `next/image` : la source est une URL de stockage
            externe, et l'optimiseur exigerait de déclarer le domaine pour un
            gain nul sur une vignette de quarante pixels. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={source}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
        />
      </span>
    );
  }

  return (
    <span aria-hidden className={`${cadre} ${apparence}`}>
      {texte ?? initials(prenom, nom)}
    </span>
  );
}
