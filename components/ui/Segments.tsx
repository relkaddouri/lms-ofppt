"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Bascule segmentée, pour choisir entre deux ou trois vues d'un même écran.
 *
 * Relevée dans `Paramètres.dc.html` et `Connexion.dc.html` : gouttière
 * `--wash-strong` bordée, coins 11 px, et le segment actif remonte en blanc
 * avec une ombre discrète. C'est le seul endroit du système où une ombre sert
 * à exprimer une sélection plutôt qu'une élévation.
 */
export default function Segments<T extends string>({
  valeur,
  options,
  onChange,
  ariaLabel,
}: {
  valeur: T;
  options: { valeur: T; libelle: ReactNode }[];
  onChange: (valeur: T) => void;
  ariaLabel: string;
}) {
  const gouttiere = useRef<HTMLDivElement>(null);

  // Quand la gouttière défile, le segment actif peut être hors de vue — par
  // exemple en arrivant par un lien qui ouvre directement le quatrième
  // onglet sur un téléphone. On le ramène à l'écran, sans animer : c'est un
  // placement, pas un mouvement.
  useEffect(() => {
    const actif = gouttiere.current?.querySelector<HTMLElement>(
      '[aria-selected="true"]',
    );
    actif?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [valeur]);

  return (
    <div
      ref={gouttiere}
      role="tablist"
      aria-label={ariaLabel}
      // Les libellés ne se coupent pas en deux ; quand ils ne tiennent pas,
      // c'est la gouttière qui défile. Sans ça, trois onglets poussaient
      // toute la page à 436px sur un écran de 390 (§3bis).
      className="flex gap-1 overflow-x-auto rounded-[11px] border border-border bg-wash-strong p-1 [scrollbar-width:none]"
    >
      {options.map((o) => {
        const actif = o.valeur === valeur;
        return (
          <button
            key={o.valeur}
            type="button"
            role="tab"
            aria-selected={actif}
            onClick={() => onChange(o.valeur)}
            className={`shrink-0 grow basis-0 whitespace-nowrap rounded-lg px-3.5 py-2.5 text-[14.5px] font-semibold max-md:min-h-11 transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(46,125,158,0.15)] ${
              actif
                ? "bg-surface text-ink shadow-[0_1px_2px_rgba(46,59,78,0.12)]"
                : "text-slate hover:text-ink"
            }`}
          >
            {o.libelle}
          </button>
        );
      })}
    </div>
  );
}
