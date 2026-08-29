import type { ReactNode } from "react";

/**
 * Carte du système visuel v3 : bordure 1px `--border`, ombre de repos, coins
 * 14 px (valeur dominante des écrans livrés : 70 occurrences contre 10 pour
 * 12 px), padding 24 px.
 *
 * `highlight` ajoute la bordure gauche `--ofppt-ink` 3px réservée à l'élément
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
        "rounded-[14px] border border-border bg-surface shadow-repos",
        padded ? "p-6" : "",
        highlight ? "border-l-[3px] border-l-ink" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}
