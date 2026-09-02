"use client";

import Button from "@/components/ui/Button";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";

export const ETAPES = [
  { numero: 1, libelle: "Contenu couvert" },
  { numero: 2, libelle: "Nature et format" },
  { numero: 3, libelle: "Questions" },
  { numero: 4, libelle: "Relecture" },
] as const;

/**
 * Indicateur d'avancement du parcours de préparation.
 *
 * `Préparer un contrôle.dc.html` remplace la rangée de pastilles de la v2 par
 * une frise : un rond par étape, relié au suivant par une barre qui verdit une
 * fois l'étape franchie, et une jauge sous l'ensemble. On lit d'un coup où
 * l'on en est, ce que quatre boutons alignés ne disaient pas.
 *
 * Toutes les étapes restent cliquables : préparer un contrôle n'est pas
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
    <div className="flex flex-col gap-3.5 rounded-[14px] border border-border bg-surface px-[22px] py-[18px] shadow-repos">
      <ol className="flex items-center">
        {ETAPES.map((e, i) => {
          const faite = e.numero < etape;
          const courante = e.numero === etape;
          const derniere = i === ETAPES.length - 1;
          return (
            <li
              key={e.numero}
              className={`flex min-w-0 items-center gap-2.5 ${
                derniere ? "flex-none" : "flex-1"
              }`}
            >
              <button
                type="button"
                onClick={() => onAller(e.numero)}
                aria-current={courante ? "step" : undefined}
                className="flex min-w-0 items-center gap-2.5 text-left"
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-[1.5px] font-mono text-[12.5px] font-semibold ${
                    courante
                      ? "border-ink bg-ink text-white"
                      : faite
                        ? "border-tint-success-strong bg-success-wash text-green-dark"
                        : "border-border-strong bg-surface text-muted"
                  }`}
                >
                  {faite ? (
                    <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
                  ) : (
                    e.numero
                  )}
                </span>
                <span
                  className={`truncate text-sm font-semibold ${
                    courante
                      ? "text-ink"
                      : faite
                        ? "text-body"
                        : "text-muted"
                  }`}
                >
                  {e.libelle}
                </span>
              </button>
              {derniere ? null : (
                <span
                  aria-hidden
                  className={`h-0.5 min-w-3 flex-1 rounded-sm ${
                    faite ? "bg-tint-success-strong" : "bg-wash"
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>
      <div className="h-[5px] overflow-hidden rounded-full bg-wash">
        <div
          className="h-full rounded-full bg-ink transition-[width] duration-200 ease-out"
          style={{ width: `${(etape / ETAPES.length) * 100}%` }}
        />
      </div>
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
    <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
      <Button
        variant="secondary"
        icon={ChevronLeft}
        onClick={() => onAller(etape - 1)}
        disabled={etape <= 1}
      >
        Précédent
      </Button>
      <span className="font-mono text-[13px] text-muted">
        {etape < ETAPES.length
          ? "Enregistrez avant de quitter la page."
          : "Dernière étape — enregistrez ou validez le contrôle."}
      </span>
      {etape < ETAPES.length ? (
        <Button
          iconRight={ChevronRight}
          onClick={() => onAller(etape + 1)}
          disabled={!peutAvancer}
        >
          {etape === 3 ? "Relire" : "Continuer"}
        </Button>
      ) : (
        <span />
      )}
    </div>
  );
}
