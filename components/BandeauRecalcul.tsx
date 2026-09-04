"use client";

import { Loader2 } from "lucide-react";

/**
 * Recalcul du placement des séances en cours (PRD §4.9).
 *
 * Le formateur ne doit jamais se retrouver devant un calendrier
 * silencieusement obsolète — ni devant un écran qui semble ne rien faire
 * pendant qu'on redéplace ses séances. Le bandeau dit aussi ce qui ne bouge
 * pas : c'est la question qu'on se pose en le voyant.
 */
export default function BandeauRecalcul({ actif }: { actif: boolean }) {
  if (!actif) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 top-5 z-50 flex -translate-x-1/2 items-center gap-2.5 rounded-full border border-tint-teal-strong bg-tint-teal px-4 py-2.5 shadow-repos"
    >
      <Loader2
        size={16}
        className="animate-spin text-teal motion-reduce:animate-none"
        aria-hidden
      />
      <span className="text-[13.5px] font-semibold text-ink">
        Recalcul du calendrier — les séances déjà faites ne bougent pas.
      </span>
    </div>
  );
}
