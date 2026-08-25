"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { key: "stagiaires", label: "Stagiaires" },
  { key: "progression", label: "Progression" },
  { key: "annonces", label: "Annonces" },
  { key: "fiches", label: "Fiches" },
  { key: "controles", label: "Contrôles" },
] as const;

export default function GroupeTabs() {
  const pathname = usePathname();
  const id = pathname.split("/")[2] ?? "";

  let active: string = "stagiaires";
  if (pathname.endsWith("/progression")) active = "progression";
  else if (pathname.endsWith("/annonces")) active = "annonces";
  else if (pathname.endsWith("/fiches")) active = "fiches";
  else if (pathname.endsWith("/controles")) active = "controles";

  const href = (key: string) =>
    key === "stagiaires" ? `/groupes/${id}` : `/groupes/${id}/${key}`;

  return (
    <nav className="mt-6 flex gap-6 overflow-x-auto border-b border-border">
      {TABS.map((t) => {
        const isActive = active === t.key;
        return (
          <Link
            key={t.key}
            href={href(t.key)}
            className={`-mb-px whitespace-nowrap border-b-2 px-1 pb-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest ${
              isActive
                ? "border-forest font-semibold text-ink"
                : "border-transparent text-slate hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
