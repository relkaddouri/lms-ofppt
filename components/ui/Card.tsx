import type { ReactNode } from "react";

/**
 * Carte du design system : bordure 1px --border, ombre légère, coins 12px.
 * `highlight` ajoute la bordure gauche --forest 3px réservée à l'élément
 * le plus important d'un groupe de cartes.
 */
export default function Card({
  highlight = false,
  padded = true,
  className = "",
  children,
}: {
  highlight?: boolean;
  padded?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={[
        "rounded-xl border border-border bg-surface",
        "shadow-[0_1px_3px_rgba(0,0,0,0.06)]",
        padded ? "p-4" : "",
        highlight ? "border-l-[3px] border-l-forest" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}
