"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  FolderClosed,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import { signOutAction } from "@/app/actions/auth";
import MarquePedago from "./MarquePedago";
import Avatar from "./ui/Avatar";

/**
 * Barre latérale du système visuel v3.
 *
 * Chaque entrée porte son icône. La v3 les avait remplacées par un losange
 * repris du logo, faute de pouvoir en garantir une par entrée : la fonction
 * d'icône de la v2 contenait un `return` inconditionnel avant les cas
 * `calendrier` et `parametres`, si bien que Groupes, Calendrier et Paramètres
 * affichaient tous les trois la même icône « personnes ».
 *
 * L'icône est donc attachée à l'entrée elle-même, dans la table ci-dessous,
 * et non calculée par une fonction que l'on peut interrompre trop tôt : une
 * entrée sans icône ne compile pas.
 */
type Entree = { href: string; label: string; Icone: LucideIcon };

const GROUPES_NAV: { label: string; items: Entree[] }[] = [
  {
    label: "GESTION",
    items: [
      { href: "/dashboard", label: "Tableau de bord", Icone: LayoutDashboard },
      { href: "/modules", label: "Modules", Icone: BookOpen },
      { href: "/groupes", label: "Groupes", Icone: Users },
      { href: "/calendrier", label: "Calendrier", Icone: CalendarDays },
      { href: "/emploi-du-temps", label: "Emploi du temps", Icone: CalendarClock },
      { href: "/classeur", label: "Classeur", Icone: FolderClosed },
      { href: "/tableau-service", label: "Tableau de service", Icone: ClipboardList },
    ],
  },
  {
    label: "CONFIGURATION",
    items: [{ href: "/parametres", label: "Paramètres", Icone: Settings }],
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
    /* Elle occupe la hauteur de la fenêtre, et pas celle de la page : en
       `md:static`, l'aside s'étirait sur toute la colonne, et le bloc du
       compte avec « Déconnexion » descendait au pied d'un tableau de service
       de trois écrans. `sticky` la laisse dans le flux — la grille à deux
       colonnes tient donc toujours — tout en la fixant au bord haut. */
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex w-[264px] shrink-0 flex-col justify-between border-r border-border bg-surface py-[22px] transition-transform duration-200 ease-out md:sticky md:top-0 md:h-screen md:self-start md:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex min-h-0 flex-col gap-8 overflow-y-auto">
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
                    <item.Icone
                      size={18}
                      strokeWidth={actif ? 2.2 : 1.8}
                      aria-hidden
                      className={`shrink-0 ${actif ? "text-ink" : "text-slate-light"}`}
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
