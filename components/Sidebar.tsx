"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { signOutAction } from "@/app/actions/auth";
import MarquePedago from "./MarquePedago";
import Avatar from "./ui/Avatar";

/**
 * Barre latérale du système visuel v3.
 *
 * Les icônes ont disparu au profit d'un losange, repris du logo : dans les
 * écrans livrés, chaque entrée porte un petit losange plein quand elle est
 * active, en contour sinon. C'est aussi ce qui corrige un défaut de la v2 —
 * la fonction d'icône contenait un `return` inconditionnel avant les cas
 * `calendrier` et `parametres`, si bien que Groupes, Calendrier et Paramètres
 * affichaient tous les trois la même icône « personnes ».
 */
const GROUPES_NAV = [
  {
    label: "GESTION",
    items: [
      { href: "/dashboard", label: "Tableau de bord" },
      { href: "/modules", label: "Modules" },
      { href: "/groupes", label: "Groupes" },
      { href: "/calendrier", label: "Calendrier" },
      { href: "/emploi-du-temps", label: "Emploi du temps" },
      { href: "/classeur", label: "Classeur" },
    ],
  },
  {
    label: "CONFIGURATION",
    items: [{ href: "/parametres", label: "Paramètres" }],
  },
];

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

  const estActif = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex w-[264px] shrink-0 flex-col justify-between border-r border-border bg-surface py-[22px] transition-transform duration-200 ease-out md:static md:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex flex-col gap-8">
        <div className="flex items-center gap-[11px] px-6">
          <MarquePedago taille={12} ecart={3} />
          <span className="flex flex-col gap-px">
            <span className="font-display text-base font-bold tracking-[-0.01em] text-ink">
              Pédago
            </span>
            <span className="text-xs text-slate-light">Espace formateur</span>
          </span>
        </div>

        <nav className="flex flex-col gap-[26px]">
          {GROUPES_NAV.map((groupe) => (
            <div key={groupe.label} className="flex flex-col gap-1">
              <span className="px-6 pb-1.5 font-mono text-[10.5px] tracking-[0.14em] text-muted">
                {groupe.label}
              </span>
              {groupe.items.map((item) => {
                const actif = estActif(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    aria-current={actif ? "page" : undefined}
                    className={`mx-3 flex items-center gap-3 rounded-[9px] px-3 py-2.5 text-[15px] transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(46,125,158,0.15)] ${
                      actif
                        ? "bg-wash font-semibold text-ink"
                        : "text-slate-2 hover:bg-paper hover:text-ink"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`h-2 w-2 shrink-0 rotate-45 ${
                        actif ? "bg-ink" : "border-[1.5px] border-muted"
                      }`}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      <div className="mx-3 border-t border-separator px-3 pt-3.5">
        <div className="flex items-center gap-3">
          <Avatar prenom={email ?? "F"} taille="sm" />
          <span className="flex min-w-0 flex-col gap-px">
            <span className="truncate text-[14.5px] font-semibold text-ink">
              {email ?? "Formateur"}
            </span>
            {role ? (
              <span className="text-[12.5px] capitalize text-slate-light">
                {role}
              </span>
            ) : null}
          </span>
        </div>
        <form action={signOutAction} className="mt-3">
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-[9px] px-3 py-2 text-sm font-semibold text-slate-2 transition-colors duration-150 ease-out hover:bg-paper hover:text-ink focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(46,125,158,0.15)]"
          >
            <LogOut size={16} aria-hidden />
            Déconnexion
          </button>
        </form>
      </div>
    </aside>
  );
}
