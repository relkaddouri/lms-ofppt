"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import {
  ONGLETS_GROUPE,
  hrefOngletGroupe,
  ongletGroupeActif,
} from "@/lib/navigation";
import type { CompteursGroupe } from "@/app/actions/groupes";

/**
 * Onglets d'un groupe, avec débordement dans un menu « Plus ».
 *
 * C'est la réponse de la maquette au problème relevé à la revue : neuf onglets
 * sur une ligne scrollable, dont les deux derniers sortaient de l'écran sans
 * que rien ne le signale. Les sept premiers restent visibles, les suivants
 * passent dans un menu aligné à droite qui affiche leur nombre — on voit donc
 * qu'il existe autre chose, ce que le défilement horizontal ne disait pas.
 */
const VISIBLES = 7;

export default function GroupeTabs({
  compteurs = {},
}: {
  compteurs?: CompteursGroupe;
}) {
  const pathname = usePathname();
  const id = pathname.split("/")[2] ?? "";
  const actif = ongletGroupeActif(pathname).key;

  const [ouvert, setOuvert] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const principaux = ONGLETS_GROUPE.slice(0, VISIBLES);
  const debordement = ONGLETS_GROUPE.slice(VISIBLES);
  const debordementActif = debordement.some((o) => o.key === actif);

  // Un menu ouvert se ferme au clic ailleurs et à Échap, sinon il reste
  // accroché pendant qu'on navigue.
  useEffect(() => {
    if (!ouvert) return;
    function auClic(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setOuvert(false);
    }
    function auClavier(e: KeyboardEvent) {
      if (e.key === "Escape") setOuvert(false);
    }
    document.addEventListener("mousedown", auClic);
    document.addEventListener("keydown", auClavier);
    return () => {
      document.removeEventListener("mousedown", auClic);
      document.removeEventListener("keydown", auClavier);
    };
  }, [ouvert]);

  const pastille = (cle: string, estActif: boolean) => {
    const n = compteurs[cle];
    if (!n) return null;
    return (
      <span
        className={`rounded-full px-1.5 py-px font-mono text-xs font-medium ${
          estActif ? "bg-wash text-ink" : "bg-paper text-slate-2"
        }`}
      >
        {n}
      </span>
    );
  };

  return (
    <div
      // Six onglets ne tiennent pas dans 375px et poussaient toute la page à
      // 799px. La barre défile pour elle-même, en débordant jusqu'aux bords de
      // l'écran pour que le geste soit naturel — un défilement voulu et borné,
      // pas celui que le §3bis interdit.
      className="relative -mx-4 flex items-stretch gap-1 overflow-x-auto border-t border-separator px-4 [scrollbar-width:none] md:mx-0 md:overflow-visible md:px-1"
    >
      {principaux.map((o) => {
        const estActif = actif === o.key;
        return (
          <Link
            key={o.key}
            href={hrefOngletGroupe(id, o)}
            aria-current={estActif ? "page" : undefined}
            className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-2.5 py-3.5 text-sm no-underline transition-colors duration-150 ease-out hover:text-ink hover:no-underline ${
              estActif
                ? "border-b-ink font-semibold text-ink"
                : "border-b-transparent text-slate-2"
            }`}
          >
            {o.label}
            {pastille(o.key, estActif)}
          </Link>
        );
      })}

      {debordement.length > 0 ? (
        <div ref={menuRef} className="relative ml-auto flex shrink-0 items-center">
          <button
            type="button"
            onClick={() => setOuvert((v) => !v)}
            aria-expanded={ouvert}
            aria-haspopup="menu"
            className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-2.5 py-3.5 text-sm transition-colors duration-150 ease-out hover:text-ink ${
              debordementActif
                ? "border-b-ink font-semibold text-ink"
                : `border-b-transparent ${ouvert ? "text-ink" : "text-slate-2"}`
            }`}
          >
            Plus
            <span className="rounded-full bg-wash-strong px-1.5 py-px font-mono text-xs font-medium text-slate-2">
              {String(debordement.length).padStart(2, "0")}
            </span>
            <ChevronDown
              size={12}
              strokeWidth={2.4}
              aria-hidden
              className={`transition-transform duration-150 ease-out ${
                ouvert ? "rotate-180" : ""
              }`}
            />
          </button>

          {ouvert ? (
            <div
              role="menu"
              className="absolute right-0 top-full z-20 mt-1.5 flex min-w-[210px] flex-col gap-0.5 rounded-[11px] border border-border bg-surface p-1.5 shadow-flottant"
            >
              {debordement.map((o) => {
                const estActif = actif === o.key;
                const n = compteurs[o.key];
                return (
                  <Link
                    key={o.key}
                    href={hrefOngletGroupe(id, o)}
                    role="menuitem"
                    onClick={() => setOuvert(false)}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm no-underline transition-colors duration-150 ease-out hover:bg-paper hover:no-underline ${
                      estActif
                        ? "bg-wash-strong font-semibold text-ink"
                        : "text-body"
                    }`}
                  >
                    {o.label}
                    {n ? (
                      <span className="ml-auto font-mono text-[12.5px] text-muted">
                        {n}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
