import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "destructive";
export type ButtonSize = "sm" | "md" | "lg" | "touch";

/**
 * Bouton du système visuel v3.
 *
 * Géométrie relevée dans les 21 écrans de `docs/new_design/` : rayon 9 px et
 * padding 10×16 pour la taille courante (11 occurrences), rayon 8 px et
 * padding 8×14 pour la petite, 11×20 pour la grande de la planche de style.
 * Graisse 600, jamais d'ombre.
 */
const base =
  "inline-flex items-center justify-center gap-1.5 font-semibold " +
  "transition-colors duration-150 ease-out " +
  "focus-visible:outline-none focus-visible:border-teal " +
  "focus-visible:shadow-[0_0_0_3px_rgba(46,125,158,0.15)] " +
  "disabled:cursor-not-allowed disabled:bg-wash-strong " +
  "disabled:border-border disabled:text-muted";

const variants: Record<ButtonVariant, string> = {
  // Fond plein bleu-ardoise, bordure de la même couleur pour que la hauteur
  // soit identique à celle des variantes bordées.
  primary: "bg-ink border border-ink text-white hover:bg-ofppt-ink-dark hover:border-ofppt-ink-dark",
  secondary:
    "bg-surface border border-border-strong text-ink hover:bg-paper hover:border-ink",
  // Sans bordure : dans les écrans livrés, les actions d'icône ne portent
  // aucun contour au repos.
  ghost: "border border-transparent text-slate hover:bg-paper hover:text-ink",
  // Signal, pas destruction : le corail reste au texte et au contour.
  danger:
    "bg-surface border border-coral-soft text-coral hover:bg-alert-wash hover:border-tint-alert-strong",
  // La seule surface corail autorisée : l'action irréversible d'un écran, et
  // elle en est alors l'unique élément corail (design_system.md §1). Les
  // écrans livrés ne l'emploient que pour confirmer une remise ou appliquer
  // une suggestion, jamais deux fois sur le même écran.
  destructive:
    "bg-coral border border-coral text-white hover:bg-coral-dark hover:border-coral-dark",
};

const sizes: Record<ButtonSize, string> = {
  sm: "rounded-lg px-3.5 py-2 text-[13.5px]",
  md: "rounded-[9px] px-4 py-2.5 text-sm",
  lg: "rounded-[9px] px-5 py-[11px] text-[15px]",
  // Espace stagiaire : cible tactile de 44×44 px minimum.
  touch: "rounded-[9px] min-h-11 min-w-11 px-4 py-2.5 text-sm",
};

/** Classes du bouton, à réutiliser sur un `<Link>` qui doit ressembler à un bouton. */
export function buttonStyles(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  extra = "",
) {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`.trim();
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Icône lucide affichée avant le libellé, 16px, espacement 6px. */
  icon?: LucideIcon;
  /** Même chose après le libellé, pour les boutons qui font avancer. */
  iconRight?: LucideIcon;
  /** Libellé de substitution pendant une action en cours. */
  loadingLabel?: string;
  loading?: boolean;
  children?: ReactNode;
};

export default function Button({
  variant = "primary",
  size = "md",
  icon: Icon,
  iconRight: IconRight,
  loading = false,
  loadingLabel,
  className = "",
  disabled,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={buttonStyles(variant, size, className)}
      {...rest}
    >
      {loading ? (
        (loadingLabel ?? "…")
      ) : (
        <>
          {Icon ? <Icon size={16} aria-hidden /> : null}
          {children}
          {IconRight ? <IconRight size={16} aria-hidden /> : null}
        </>
      )}
    </button>
  );
}
