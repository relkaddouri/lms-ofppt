"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  ClipboardCheck,
  FileCheck2,
  Heart,
  MessageCircle,
  MessageCircleQuestion,
  X,
} from "lucide-react";
import Avatar from "./ui/Avatar";
import {
  getNotifications,
  type GenreNotification,
  type Notification,
} from "@/app/actions/notifications";

/** Tuile d'icône par genre, aux teintes de statut du système. */
const GENRES: Record<
  GenreNotification,
  { Icone: typeof FileCheck2; fond: string; encre: string }
> = {
  controle: {
    Icone: FileCheck2,
    fond: "bg-alert-wash",
    encre: "text-coral",
  },
  question: {
    Icone: MessageCircleQuestion,
    fond: "bg-tint-teal",
    encre: "text-teal-dark",
  },
  // Le fil : une bulle pour ce qui appelle une réponse, un cœur pour ce qui
  // n'en appelle pas. La distinction se voit avant d'être lue.
  commentaire: {
    Icone: MessageCircle,
    fond: "bg-tint-teal",
    encre: "text-teal-dark",
  },
  jaime: { Icone: Heart, fond: "bg-success-wash", encre: "text-green-dark" },
  copie: { Icone: ClipboardCheck, fond: "bg-wash", encre: "text-slate-2" },
  devoir: { Icone: ClipboardCheck, fond: "bg-wash", encre: "text-slate-2" },
  stage: { Icone: CalendarClock, fond: "bg-wash", encre: "text-slate-2" },
};

function quand(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const heures = Math.round(minutes / 60);
  if (heures < 24) return `il y a ${heures} h`;
  const jours = Math.round(heures / 24);
  return jours === 1 ? "hier" : `il y a ${jours} j`;
}

/** Aujourd'hui / Hier / Plus tôt — le découpage de la maquette. */
function tranche(iso: string): string {
  const jours = Math.floor(
    (Date.now() - new Date(iso).getTime()) / 86400000,
  );
  if (jours < 1) return "AUJOURD'HUI";
  if (jours < 2) return "HIER";
  return "PLUS TÔT";
}

/**
 * Chez le formateur, une notification est une tâche : le résumé le dit.
 * Chez le stagiaire elle n'appelle aucune action, d'où le prop `resume`.
 */
function resumeFormateur(nombre: number): string {
  if (nombre === 0) return "Rien n'attend votre intervention.";
  return `${nombre} élément${nombre > 1 ? "s" : ""} en attente de votre intervention`;
}

/**
 * Panneau latéral des notifications.
 *
 * Le projet n'a pas de journal d'événements : chaque entrée est déduite de
 * l'état courant — un contrôle resté en brouillon, une question sans réponse,
 * une copie dont une question n'est pas notée. D'où l'écart assumé avec
 * `Panneau de notifications.dc.html` : pas de « tout marquer comme lu », car
 * il n'y a rien à marquer. Une ligne disparaît quand la tâche est faite, ce
 * qui vaut mieux qu'un accusé de lecture sans effet.
 */
export default function PanneauNotifications({
  ouvert,
  onFermer,
  charger = getNotifications,
  titre = "Notifications",
  resume = resumeFormateur,
  vide = "Aucun contrôle en brouillon, aucune question sans réponse, aucune copie à corriger.",
  actions,
}: {
  ouvert: boolean;
  onFermer: () => void;
  /**
   * D'où viennent les entrées.
   *
   * Le panneau sert les deux espaces : au formateur ce qui attend une action,
   * au stagiaire ce qui vient de se passer. Seule la source change — les
   * tuiles, le découpage par période et le clavier sont les mêmes, et un
   * second panneau aurait divergé au premier correctif.
   */
  charger?: () => Promise<Notification[]>;
  titre?: string;
  /** La ligne sous le titre : « 3 éléments… » chez le formateur, « 3 nouveautés » chez le stagiaire. */
  resume?: (nombre: number) => string;
  /** Ce qui s'affiche quand il n'y a rien : le sens diffère d'un espace à l'autre. */
  vide?: string;
  /**
   * Réglages propres à l'espace, posés à gauche de la fermeture.
   *
   * Le son des nouveautés se coupe ici et nulle part ailleurs : lui inventer
   * un écran de préférences pour une case aurait éloigné le réglage de ce
   * qu'il règle.
   */
  actions?: React.ReactNode;
}) {
  const [entrees, setEntrees] = useState<Notification[] | null>(null);

  useEffect(() => {
    if (!ouvert) return;
    let annule = false;
    charger()
      .then((n) => {
        if (!annule) setEntrees(n);
      })
      .catch(() => {
        if (!annule) setEntrees([]);
      });
    return () => {
      annule = true;
    };
  }, [ouvert, charger]);

  useEffect(() => {
    if (!ouvert) return;
    function auClavier(e: KeyboardEvent) {
      if (e.key === "Escape") onFermer();
    }
    document.addEventListener("keydown", auClavier);
    return () => document.removeEventListener("keydown", auClavier);
  }, [ouvert, onFermer]);

  if (!ouvert) return null;

  let trancheCourante = "";

  return (
    <>
      <div
        aria-hidden
        onClick={onFermer}
        className="fixed inset-0 z-40 bg-[rgba(46,59,78,0.32)] backdrop-blur-[1px]"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={titre}
        className="fixed inset-y-0 right-0 z-50 flex w-[424px] max-w-[92vw] flex-col border-l border-border bg-surface shadow-panneau"
      >
        <div className="flex flex-none flex-col gap-3.5 border-b border-separator px-6 pb-[18px] pt-[22px]">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-xl font-semibold text-ink">
              {titre}
            </h2>
            {entrees && entrees.length > 0 ? (
              <span className="rounded-full bg-coral px-2.5 py-0.5 font-mono text-[12.5px] font-semibold text-white">
                {String(entrees.length).padStart(2, "0")}
              </span>
            ) : null}
            <span className="ml-auto flex items-center gap-1.5">
              {actions}
            <button
              type="button"
              aria-label="Fermer"
              onClick={onFermer}
              className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border border-border bg-surface text-slate-2 transition-colors duration-150 ease-out hover:bg-paper"
            >
              <X size={15} strokeWidth={2.2} aria-hidden />
            </button>
            </span>
          </div>
          <span className="text-[13.5px] text-slate-light">
            {entrees === null ? "Chargement…" : resume(entrees.length)}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto pb-6 pt-2">
          {entrees?.map((n) => {
            const { Icone, fond, encre } = GENRES[n.genre];
            const t = tranche(n.date);
            const nouvelleTranche = t !== trancheCourante;
            if (nouvelleTranche) trancheCourante = t;
            const recente = t === "AUJOURD'HUI";
            return (
              <div key={n.id}>
                {nouvelleTranche ? (
                  <span className="block px-6 pb-2 pt-3.5 font-mono text-[10.5px] tracking-[0.14em] text-muted">
                    {t}
                  </span>
                ) : null}

                <Link
                  href={n.href}
                  onClick={onFermer}
                  className={`flex gap-3 border-l-2 px-6 py-3.5 no-underline transition-colors duration-150 ease-out hover:no-underline ${
                    recente
                      ? "border-l-coral bg-paper-alt hover:bg-paper"
                      : "border-l-transparent hover:bg-paper-alt"
                  }`}
                >
                  {n.auteur ? (
                    <Avatar prenom={n.auteur} taille="xs" className="h-9 w-9" />
                  ) : (
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] ${fond}`}
                    >
                      <Icone size={17} aria-hidden className={encre} />
                    </span>
                  )}

                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="text-[14.5px] leading-snug text-ink">
                      {n.texte}
                      {n.reference ? (
                        <>
                          {" — "}
                          <span className="font-mono font-medium">
                            {n.reference}
                          </span>
                        </>
                      ) : null}
                    </p>
                    {n.extrait ? (
                      <span className="rounded-r-md border-l-2 border-border bg-paper px-2.5 py-[7px] text-[13px] leading-snug text-slate-2">
                        «&nbsp;{n.extrait}&nbsp;»
                      </span>
                    ) : null}
                    <span className="font-mono text-xs text-slate-light">
                      {quand(n.date)}
                    </span>
                  </div>

                  {recente ? (
                    <span
                      aria-hidden
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-coral"
                    />
                  ) : null}
                </Link>
              </div>
            );
          })}

          {entrees !== null && entrees.length === 0 ? (
            <p className="px-6 py-12 text-center text-[14.5px] text-slate-light">
              {vide}
            </p>
          ) : null}
        </div>
      </aside>
    </>
  );
}
