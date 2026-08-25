import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "touch";

const base =
  "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium " +
  "transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

// Design system : primaire = fond --forest plein, texte blanc, coins 8px, PAS d'ombre.
const variants: Record<ButtonVariant, string> = {
  primary: "bg-forest text-white hover:bg-forest/90 focus:ring-forest",
  secondary:
    "bg-surface border border-border text-ink hover:bg-paper focus:ring-forest",
  ghost:
    "border border-border text-slate hover:bg-mint/50 hover:text-ink focus:ring-forest",
  danger:
    "border border-danger/50 text-danger hover:bg-danger/10 focus:ring-danger",
};

const sizes: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  // Espace stagiaire : cible tactile de 44×44px minimum.
  touch: "min-h-11 min-w-11 px-4 py-2.5 text-sm",
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
  /** Libellé de substitution pendant une action en cours. */
  loadingLabel?: string;
  loading?: boolean;
  children?: ReactNode;
};

export default function Button({
  variant = "primary",
  size = "md",
  icon: Icon,
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
        </>
      )}
    </button>
  );
}
