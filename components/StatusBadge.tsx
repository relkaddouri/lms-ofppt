import type { ReactNode } from "react";

type Tone = "success" | "danger" | "info" | "neutral";

const badgeClass: Record<Tone, string> = {
  success: "bg-success/10 text-success",
  danger: "bg-danger/10 text-danger",
  info: "bg-info/10 text-info",
  neutral: "bg-neutral/10 text-neutral",
};

const dotClass: Record<Tone, string> = {
  success: "bg-success",
  danger: "bg-danger",
  info: "bg-info",
  neutral: "bg-neutral",
};

export default function StatusBadge({
  tone = "neutral",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass[tone]}`}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass[tone]}`} />
      {children}
    </span>
  );
}
