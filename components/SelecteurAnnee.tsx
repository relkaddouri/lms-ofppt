"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CalendarRange, Check, ChevronDown } from "lucide-react";
import { useToast } from "./ui/Toast";
import { choisirAnneeScolaire } from "@/app/actions/annees";
import { estEnCours, type AnneeScolaire } from "@/lib/annees";

/**
 * Sélecteur d'année scolaire — global (PRD §4.15.2).
 *
 * Changer d'année change la portée de tout ce qui est affiché, comme on change
 * de dossier de travail : tableau de bord, groupes, calendrier, contrôles. Les
 * données d'une année passée ne sont jamais supprimées en changeant de
 * sélection, elles restent consultables.
 *
 * Le choix est persisté en base et non dans un cookie : il doit survivre au
 * passage d'un poste à un autre.
 *
 * Avec une seule année, le bouton n'ouvre rien mais reste affiché : savoir sur
 * quelle année on travaille vaut autant que pouvoir en changer.
 */
export default function SelecteurAnnee({
  annees,
  couranteId,
}: {
  annees: AnneeScolaire[];
  couranteId: string | null;
}) {
  const toast = useToast();
  const [ouvert, setOuvert] = useState(false);
  const [enCours, startTransition] = useTransition();
  // Le libellé change avant le rechargement : sans cela, le bouton garde
  // l'ancienne année pendant une seconde et le clic semble sans effet.
  const [choisiId, setChoisiId] = useState<string | null>(null);
  const boiteRef = useRef<HTMLDivElement>(null);

  const actifId = choisiId ?? couranteId;
  const courante = annees.find((a) => a.id === actifId) ?? annees[0] ?? null;
  const plusieurs = annees.length > 1;

  // Un clic ailleurs referme la liste, comme n'importe quel menu.
  useEffect(() => {
    if (!ouvert) return;
    const ailleurs = (e: MouseEvent) => {
      if (!boiteRef.current?.contains(e.target as Node)) setOuvert(false);
    };
    const echap = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOuvert(false);
    };
    document.addEventListener("mousedown", ailleurs);
    document.addEventListener("keydown", echap);
    return () => {
      document.removeEventListener("mousedown", ailleurs);
      document.removeEventListener("keydown", echap);
    };
  }, [ouvert]);

  if (!courante) return null;

  function choisir(annee: AnneeScolaire) {
    setOuvert(false);
    if (annee.id === courante!.id) return;
    startTransition(async () => {
      try {
        await choisirAnneeScolaire(annee.id);
        setChoisiId(annee.id);
        // Rechargement franc plutôt qu'un `router.refresh()`. L'année est la
        // portée de tout l'écran, pas une donnée de plus : `revalidatePath` ne
        // faisait pas relire les props du gabarit, et le formateur changeait
        // d'année sans rien voir bouger. Un rechargement complet garantit que
        // chaque écran reparte de la nouvelle portée.
        window.location.reload();
      } catch (e) {
        setChoisiId(null);
        toast(e instanceof Error ? e.message : "Changement impossible.", "error");
      }
    });
  }

  return (
    <div ref={boiteRef} className="relative">
      <button
        type="button"
        onClick={() => plusieurs && setOuvert((v) => !v)}
        disabled={!plusieurs || enCours}
        aria-haspopup={plusieurs ? "listbox" : undefined}
        aria-expanded={plusieurs ? ouvert : undefined}
        aria-label={`Année scolaire ${courante.libelle}`}
        title={
          plusieurs
            ? "Changer d'année scolaire"
            : "Votre seule année scolaire pour l'instant"
        }
        className={`flex h-10 items-center gap-2 rounded-[10px] border border-border bg-surface px-3 text-[14px] transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(46,125,158,0.15)] ${
          plusieurs
            ? "text-ink hover:border-border-strong hover:bg-paper"
            : "cursor-default text-slate-2"
        }`}
      >
        <CalendarRange size={16} className="shrink-0 text-slate-2" aria-hidden />
        <span className="font-mono tracking-[-0.01em]">{courante.libelle}</span>
        {plusieurs ? (
          <ChevronDown
            size={15}
            aria-hidden
            className={`shrink-0 text-slate-light transition-transform duration-150 ease-out ${
              ouvert ? "rotate-180" : ""
            }`}
          />
        ) : null}
      </button>

      {ouvert ? (
        <div
          role="listbox"
          aria-label="Années scolaires"
          className="absolute right-0 top-[calc(100%+6px)] z-40 flex w-[264px] flex-col gap-0.5 rounded-[12px] border border-border bg-surface p-1.5 shadow-flottant"
        >
          <span className="px-2.5 pb-1 pt-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted">
            Année scolaire
          </span>
          {annees.map((a) => {
            const active = a.id === courante.id;
            return (
              <button
                key={a.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => choisir(a)}
                className={`flex items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-left transition-colors duration-150 ease-out ${
                  active ? "bg-wash" : "hover:bg-paper"
                }`}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-mono text-[14px] text-ink">
                    {a.libelle}
                  </span>
                  {estEnCours(a) ? (
                    <span className="text-[12px] text-green-dark">
                      année en cours
                    </span>
                  ) : null}
                </span>
                {active ? (
                  <Check size={15} className="shrink-0 text-ink" aria-hidden />
                ) : null}
              </button>
            );
          })}
          <p className="px-2.5 pb-1 pt-1.5 text-[12.5px] leading-snug text-slate-light">
            Changer d&apos;année change ce qui est affiché partout. Rien
            n&apos;est supprimé : une année passée reste consultable.
          </p>
        </div>
      ) : null}
    </div>
  );
}
