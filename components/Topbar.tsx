"use client";

import { Menu } from "lucide-react";
import Avatar from "./ui/Avatar";

export default function Topbar({
  email,
  onMenuClick,
}: {
  email: string | null;
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
        <span className="hidden text-[13px] text-slate sm:block">{email}</span>
        <span className="mx-1 hidden h-6 w-0.5 bg-separator sm:block" />
        <Avatar prenom={email ?? "F"} />
      </div>
    </header>
  );
}
