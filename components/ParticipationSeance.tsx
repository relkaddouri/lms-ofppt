"use client";

import { useEffect, useState } from "react";
import { Crown } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import {
  getParticipationSeance,
  type ParticipationSeance as Participation,
} from "@/app/actions/distinction";

/**
 * Ce que le formateur a donné sur cette séance (PRD §4.5).
 *
 * La notation se fait dans une modale, un visage à la fois, puis disparaît :
 * rien ne permettait de revenir voir ce qu'on avait mis, ni pourquoi c'est
 * celui-là qui a été couronné. Cet onglet est cette mémoire.
 *
 * Une liste et non un tableau : seize lignes de deux valeurs n'ont pas besoin
 * de colonnes, et une liste tient d'elle-même sur un téléphone — ce que le
 * §3bis demande à tout ce qui se consulte en salle.
 *
 * Les notes sont classées par ordre décroissant et non alphabétique : la
 * question qu'on se pose en ouvrant cet onglet est « qui a participé
 * aujourd'hui », pas « où est Untel ». Le distingué est donc en tête, à sa
 * place.
 */
export default function ParticipationSeance({
  seanceId,
  /** Rouvre la modale de notation — le seul geste d'écriture depuis ici. */
  onNoter,
}: {
  seanceId: string;
  onNoter: () => void;
}) {
  const [donnees, setDonnees] = useState<Participation | null>(null);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    let annule = false;
    getParticipationSeance(seanceId)
      .then((d) => {
        if (!annule) setDonnees(d);
      })
      .catch(() => {
        if (!annule) setErreur(true);
      });
    return () => {
      annule = true;
    };
  }, [seanceId]);

  if (erreur) {
    return (
      <p className="rounded-[14px] border border-border bg-surface px-6 py-8 text-center text-sm text-slate">
        Participation indisponible pour le moment.
      </p>
    );
  }

  if (!donnees) {
    return (
      <p className="rounded-[14px] border border-border bg-surface px-6 py-8 text-center text-sm text-slate">
        Chargement de la participation…
      </p>
    );
  }

  const notes = donnees.lignes.filter((l) => l.note !== null);
  const classees = [...donnees.lignes].sort((a, b) => {
    // Le distingué d'abord, quoi qu'il arrive : c'est lui qu'on vient voir.
    if (a.id === donnees.gagnantId) return -1;
    if (b.id === donnees.gagnantId) return 1;
    if (a.note === null && b.note === null) return a.nom.localeCompare(b.nom);
    if (a.note === null) return 1;
    if (b.note === null) return -1;
    return b.note - a.note || a.nom.localeCompare(b.nom);
  });

  return (
    <section className="overflow-hidden rounded-[14px] border border-border bg-surface shadow-repos">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-separator bg-paper-alt px-6 py-[18px]">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-display text-base font-semibold text-ink">
            Participation de la journée
          </h2>
          <p className="text-[13px] text-slate-2">
            {notes.length === 0
              ? "Aucune note saisie sur cette séance."
              : `${notes.length} note${notes.length > 1 ? "s" : ""}${
                  donnees.moyenne !== null
                    ? ` · moyenne ${donnees.moyenne.toFixed(1)} / 10`
                    : ""
                }`}
          </p>
        </div>
        <button
          type="button"
          onClick={onNoter}
          className="flex min-h-11 items-center rounded-[9px] border border-border-strong bg-surface px-3.5 text-sm font-semibold text-body transition-colors duration-150 ease-out hover:border-ink hover:bg-paper"
        >
          {notes.length === 0
            ? "Noter la participation"
            : "Reprendre la notation"}
        </button>
      </div>

      <ul className="divide-y divide-separator">
        {classees.map((l) => {
          const gagnant = l.id === donnees.gagnantId;
          return (
            <li
              key={l.id}
              className={`flex items-center gap-3.5 px-6 py-3.5 ${
                gagnant ? "bg-success-wash" : ""
              }`}
            >
              <span className="relative shrink-0">
                <Avatar
                  nom={l.nom}
                  prenom={l.prenom}
                  photo={l.photo}
                  taille="xs"
                  className="h-10 w-10"
                />
                {gagnant ? (
                  <span
                    aria-hidden
                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-surface bg-[#F4C542] text-ink"
                  >
                    <Crown size={10} aria-hidden />
                  </span>
                ) : null}
              </span>

              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[14.5px] font-semibold text-ink">
                  {l.prenom} {l.nom}
                </span>
                <span className="text-[12.5px] text-slate-light">
                  {gagnant
                    ? donnees.serie > 1
                      ? `Stagiaire de la journée · ${donnees.serie} jours d'affilée`
                      : "Stagiaire de la journée"
                    : l.present
                      ? "Présent"
                      : "Absent — non noté"}
                </span>
              </span>

              {/* La barre dit d'un coup d'œil ce que le chiffre dit
                  exactement : sur seize lignes, c'est elle qu'on lit. */}
              {l.note !== null ? (
                <span className="flex shrink-0 items-center gap-2.5">
                  <span
                    aria-hidden
                    className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-wash sm:block"
                  >
                    <span
                      className={`block h-full rounded-full ${
                        gagnant ? "bg-green-dark" : "bg-teal"
                      }`}
                      style={{ width: `${(l.note / 10) * 100}%` }}
                    />
                  </span>
                  <span className="w-[54px] text-right font-mono text-[15px] font-medium text-ink">
                    {l.note.toFixed(1)}
                    <span className="text-[12px] text-muted"> /10</span>
                  </span>
                </span>
              ) : (
                <span className="w-[54px] shrink-0 text-right font-mono text-[13px] text-muted">
                  —
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {classees.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-slate">
          Aucun stagiaire rattaché à cette séance.
        </p>
      ) : null}
    </section>
  );
}
