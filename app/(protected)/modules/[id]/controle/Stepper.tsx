"use client";

import Button from "@/components/ui/Button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const ETAPES = [
  { numero: 1, libelle: "Contenu couvert" },
  { numero: 2, libelle: "Nature et format" },
  { numero: 3, libelle: "Questions" },
  { numero: 4, libelle: "Relecture" },
] as const;

/**
 * Indicateur d'avancement du parcours de préparation.
 *
 * Les étapes déjà atteintes restent cliquables : préparer un contrôle n'est pas
 * linéaire, on revient volontiers sur le format après avoir vu les questions.
 */
export function Stepper({
  etape,
  onAller,
}: {
  etape: number;
  onAller: (n: number) => void;
}) {
  return (
    <div className="mb-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate">
        Étape {etape} sur {ETAPES.length}
      </p>
      <ol className="mt-2 flex flex-wrap gap-1">
        {ETAPES.map((e) => {
          const atteinte = e.numero <= etape;
          const courante = e.numero === etape;
          return (
            <li key={e.numero}>
              <button
                type="button"
                onClick={() => onAller(e.numero)}
                aria-current={courante ? "step" : undefined}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  courante
                    ? "bg-forest text-white"
                    : atteinte
                      ? "bg-mint text-forest hover:bg-mint/70"
                      : "text-slate hover:text-ink"
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full font-mono text-xs ${
                    courante
                      ? "bg-white/20"
                      : atteinte
                        ? "bg-forest/10"
                        : "bg-border"
                  }`}
                >
                  {e.numero}
                </span>
                {e.libelle}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function NavigationEtapes({
  etape,
  onAller,
  peutAvancer,
}: {
  etape: number;
  onAller: (n: number) => void;
  peutAvancer: boolean;
}) {
  return (
    <div className="mt-6 flex items-center gap-2 border-t border-border pt-4">
      <Button
        variant="ghost"
        icon={ChevronLeft}
        onClick={() => onAller(etape - 1)}
        disabled={etape <= 1}
      >
        Précédent
      </Button>
      {etape < ETAPES.length ? (
        <Button
          variant="secondary"
          icon={ChevronRight}
          onClick={() => onAller(etape + 1)}
          disabled={!peutAvancer}
          className="ml-auto"
        >
          {ETAPES[etape].libelle}
        </Button>
      ) : (
        <span className="ml-auto text-xs text-slate">
          Dernière étape — enregistrez ou validez le contrôle.
        </span>
      )}
    </div>
  );
}
