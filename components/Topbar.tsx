"use client";

import { usePathname } from "next/navigation";
import { ONGLETS_GROUPE, ongletGroupeActif } from "@/lib/navigation";

const TITLES: Record<string, string> = {
  "/dashboard": "Tableau de bord",
  "/modules": "Modules",
  "/groupes": "Groupes",
};

function titleFor(pathname: string) {
  if (TITLES[pathname]) return TITLES[pathname];
  if (pathname.startsWith("/modules/")) {
    if (pathname.endsWith("/correction")) return "Assistant de correction";
    if (pathname.endsWith("/historique")) return "Historique des modifications";
    if (pathname.includes("/controle")) return "Contrôle";
    if (pathname.includes("/fiche")) return "Fiche de préparation";
    return "Module";
  }
  if (pathname.startsWith("/groupes/")) {
    const onglet = ongletGroupeActif(pathname);
    return onglet.key === ONGLETS_GROUPE[0].key ? "Groupe" : onglet.label;
  }
  return "LMS OFPPT";
}

export default function Topbar({
  email,
  onMenuClick,
}: {
  email: string | null;
  onMenuClick: () => void;
}) {
  const pathname = usePathname();

  return (
    <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-4 md:px-8">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-[8px] p-1.5 text-slate hover:bg-mint/50 hover:text-forest focus:outline-none focus:ring-2 focus:ring-forest md:hidden"
          aria-label="Ouvrir le menu"
        >
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M3 12h18M3 6h18M3 18h18" />
          </svg>
        </button>
        <h1 className="font-display text-[24px] font-bold text-ink">
          {titleFor(pathname)}
        </h1>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden text-xs text-slate sm:block">
          {email}
        </span>
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-mint text-xs font-semibold text-forest focus-visible:ring-2 focus-visible:ring-mint">
          {(email ?? "F").slice(0, 1).toUpperCase()}
        </div>
      </div>
    </header>
  );
}
