import type { ReactNode } from "react";

export type BadgeTone = "success" | "danger" | "info" | "neutral";
/**
 * `statut` = pilule teintée pleine. `type` = même pilule sur fond blanc.
 *
 * La v3 n'a plus de pilule à fond transparent : sur les 21 écrans livrés,
 * aucune pastille arrondie n'est sans fond. La variante `type` conserve donc
 * la distinction sémantique en posant la teinte sur `--surface` plutôt que sur
 * le fond de statut.
 */
export type BadgeVariant = "statut" | "type";

/** Texte, fond et bordure relevés dans la planche de style (DS-OFPPT-01). */
const texte: Record<BadgeTone, string> = {
  success: "text-green-dark",
  danger: "text-coral-dark",
  info: "text-teal-dark",
  neutral: "text-slate-2",
};

const fond: Record<BadgeTone, string> = {
  success: "bg-success-wash border-tint-green",
  danger: "bg-alert-wash border-tint-alert-strong",
  info: "bg-tint-teal border-tint-teal-strong",
  neutral: "bg-wash-strong border-border",
};

const point: Record<BadgeTone, string> = {
  success: "bg-green",
  danger: "bg-coral",
  info: "bg-teal",
  neutral: "bg-slate-light",
};

/**
 * Le statut n'est jamais porté par la couleur seule : le point coloré est
 * toujours accompagné du mot explicite passé en `children`.
 */
export default function Badge({
  tone = "neutral",
  variant = "statut",
  children,
}: {
  tone?: BadgeTone;
  variant?: BadgeVariant;
  children: ReactNode;
}) {
  const apparence =
    variant === "statut" ? fond[tone] : "bg-surface border-border";

  return (
    <span
      className={`inline-flex items-center gap-[7px] whitespace-nowrap rounded-full border px-3 py-[5px] text-[13.5px] font-semibold ${apparence} ${texte[tone]}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${point[tone]}`} />
      {children}
    </span>
  );
}
