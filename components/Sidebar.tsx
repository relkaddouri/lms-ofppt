"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { signOutAction } from "@/app/actions/auth";
import { initials } from "@/lib/format";

const navGroups = [
  {
    label: "GESTION",
    items: [
      { href: "/dashboard", label: "Tableau de bord" },
      { href: "/modules", label: "Modules" },
      { href: "/groupes", label: "Groupes" },
      { href: "/calendrier", label: "Calendrier" },
    ],
  },
  {
    label: "CONFIGURATION",
    items: [{ href: "/parametres", label: "Paramètres" }],
  },
];

function Icon({ name }: { name: string }) {
  const className = "h-4 w-4";
  if (name === "dashboard")
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </svg>
    );
  if (name === "modules")
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    );
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
  if (name === "calendrier")
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M3 10h18M8 2v4M16 2v4" />
      </svg>
    );
  if (name === "parametres")
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    );
  return null;
}

export default function Sidebar({
  email,
  role,
  open,
  onClose,
}: {
  email: string | null;
  role: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex w-[250px] shrink-0 flex-col border-r border-border bg-surface transition-transform duration-200 md:static md:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex items-center gap-2 px-6 py-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-forest font-display text-sm font-bold text-white">
          O
        </div>
        <div className="font-display text-lg font-bold text-ink">LMS OFPPT</div>
      </div>

      <nav className="mt-2 flex-1 px-3">
        {navGroups.map((group) => (
          <div key={group.label} className="mt-5">
            <p className="px-3 text-[11px] font-medium uppercase tracking-wider text-slate">
              {group.label}
            </p>
            <ul className="mt-2 space-y-1">
              {group.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      className={`flex items-center gap-3 rounded-[8px] px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-forest ${
                        active
                          ? "bg-mint text-forest"
                          : "text-slate hover:bg-mint/50 hover:text-forest"
                      }`}
                    >
                      <span className="shrink-0 text-forest">
                        <Icon name={item.href.replace("/", "")} />
                      </span>
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-border px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-mint text-xs font-semibold text-forest focus-visible:ring-2 focus-visible:ring-mint">
            {initials(email ?? "F")}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">
              {email ?? "Formateur"}
            </p>
            {role ? (
              <p className="truncate text-xs capitalize text-slate">{role}</p>
            ) : null}
          </div>
        </div>
        <form action={signOutAction} className="mt-3">
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-slate hover:bg-mint/50 hover:text-ink focus:outline-none focus:ring-2 focus:ring-forest"
          >
            <LogOut size={16} />
            Déconnexion
          </button>
        </form>
      </div>
    </aside>
  );
}
