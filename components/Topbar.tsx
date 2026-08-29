"use client";

import { Bell, Menu, Search } from "lucide-react";
import Avatar from "./ui/Avatar";

export default function Topbar({
  email,
  notifications = 0,
  onMenuClick,
}: {
  email: string | null;
  /** Compteur du badge de la cloche. Zéro tant qu'aucune source ne l'alimente. */
  notifications?: number;
  onMenuClick: () => void;
}) {
  return (
    <header className="flex h-[68px] flex-none items-center justify-between gap-6 border-b border-border bg-surface px-5 md:px-10">
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-[9px] p-1.5 text-slate-2 transition-colors duration-150 ease-out hover:bg-paper hover:text-ink focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(46,125,158,0.15)] md:hidden"
          aria-label="Ouvrir le menu"
        >
          <Menu size={20} aria-hidden />
        </button>
        {/* Le titre de l'application, pas celui de la page : la page porte son
            propre titre dans son en-tête, comme dans les écrans livrés. */}
        <span className="truncate font-display text-[15px] font-semibold tracking-[0.02em] text-ink">
          LMS OFPPT — Gestion pédagogique
        </span>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Recherche et notifications sont dans la maquette : elles restent
            visibles. Leur fonction viendra avec son propre atome — la
            recherche au lot 3 de la revue, le panneau de notifications avec
            son écran dédié. En attendant elles sont inertes, pas absentes. */}
        <button
          type="button"
          disabled
          aria-label="Rechercher"
          title="Recherche — disponible prochainement"
          className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-border bg-surface text-slate-2 disabled:cursor-not-allowed disabled:text-muted"
        >
          <Search size={18} strokeWidth={2} aria-hidden />
        </button>

        <button
          type="button"
          disabled
          aria-label={`Notifications (${notifications})`}
          title="Notifications — disponible prochainement"
          className="relative flex h-10 w-10 items-center justify-center rounded-[10px] border border-border bg-surface text-slate-2 disabled:cursor-not-allowed disabled:text-muted"
        >
          <Bell size={18} strokeWidth={2} aria-hidden />
          {notifications > 0 ? (
            <span className="absolute -right-[5px] -top-[5px] flex h-[19px] min-w-[19px] items-center justify-center rounded-full border-2 border-surface bg-coral px-1 font-mono text-[11px] font-semibold text-white">
              {notifications}
            </span>
          ) : null}
        </button>

        <span className="mx-1 hidden h-6 w-0.5 bg-separator sm:block" />
        <span className="hidden text-[13px] text-slate sm:block">{email}</span>
        <Avatar prenom={email ?? "F"} />
      </div>
    </header>
  );
}
