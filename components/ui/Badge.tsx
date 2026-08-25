import type { ReactNode } from "react";

export type BadgeTone = "success" | "danger" | "info" | "neutral";
/** `statut` = fond pastel 10 %. `type` = fond transparent + bordure fine. */
export type BadgeVariant = "statut" | "type";

const fond: Record<BadgeTone, string> = {
  success: "bg-success/10 text-success",
  danger: "bg-danger/10 text-danger",
  info: "bg-info/10 text-info",
  neutral: "bg-neutral/10 text-neutral",
};

const texte: Record<BadgeTone, string> = {
  success: "text-success",
  danger: "text-danger",
  info: "text-info",
  neutral: "text-neutral",
};

const point: Record<BadgeTone, string> = {
  success: "bg-success",
  danger: "bg-danger",
  info: "bg-info",
  neutral: "bg-neutral",
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
    variant === "statut"
      ? fond[tone]
      : `border border-border bg-transparent ${texte[tone]}`;

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${apparence}`}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${point[tone]}`} />
      {children}
    </span>
  );
}
