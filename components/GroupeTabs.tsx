"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ONGLETS_GROUPE,
  hrefOngletGroupe,
  ongletGroupeActif,
} from "@/lib/navigation";

export default function GroupeTabs() {
  const pathname = usePathname();
  const id = pathname.split("/")[2] ?? "";
  const active = ongletGroupeActif(pathname).key;

  return (
    <nav className="mt-6 flex gap-6 overflow-x-auto border-b border-border">
      {ONGLETS_GROUPE.map((t) => {
        const isActive = active === t.key;
        return (
          <Link
            key={t.key}
            href={hrefOngletGroupe(id, t)}
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
