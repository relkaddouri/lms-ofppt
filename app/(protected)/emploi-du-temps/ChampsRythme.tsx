"use client";

import { useEffect } from "react";
import { inputStyles } from "@/components/ui/Input";
import { formatDateJour } from "@/lib/format";
import { RECURRENCES, prochaineDate, type Recurrence } from "@/lib/recurrence";

export type Rythme = { recurrence: Recurrence; premiereDate: string | null };

/**
 * Le rythme d'un créneau : chaque semaine, une semaine sur deux, une fois par
 * mois (PRD §4.9).
 *
 * Partagé entre l'ajout et le déplacement d'un créneau : deux formulaires qui
 * divergeraient laisseraient créer un rythme qu'on ne pourrait plus modifier.
 *
 * « Première fois le » n'apparaît que pour un rythme alterné, et part d'une
 * date déjà juste — le prochain jour choisi. Un formateur qui alterne veut
 * d'abord dire *quelle* semaine commence ; lui faire saisir une date de zéro,
 * et risquer un lundi pour un créneau du mardi, ne lui apprendrait rien.
 */
export default function ChampsRythme({
  jour,
  valeur,
  onChange,
  aujourdhui,
  compact = false,
}: {
  /** Le jour du créneau, pour proposer et vérifier la première date. */
  jour: number;
  valeur: Rythme;
  onChange: (r: Rythme) => void;
  aujourdhui: string;
  /** Libellés en petit, pour la barre d'ajout ; en grand, pour la modale. */
  compact?: boolean;
}) {
  const etiquette = compact
    ? "text-xs text-slate"
    : "text-sm font-semibold text-ink";

  const alterne = valeur.recurrence !== "hebdomadaire";
  const dateJuste = (d: string | null) => {
    if (!d) return false;
    const x = new Date(`${d}T12:00:00Z`);
    return (x.getUTCDay() === 0 ? 7 : x.getUTCDay()) === jour;
  };

  // Le jour du créneau vient de changer : une première date qui ne tombe plus
  // ce jour-là est remplacée par la prochaine date juste, dans l'état même du
  // formulaire — pas seulement à l'affichage, sans quoi c'est l'ancienne qui
  // partirait. On ne réagit qu'au jour : une date mal saisie à la main reste
  // telle quelle, signalée ci-dessous.
  useEffect(() => {
    if (alterne && !dateJuste(valeur.premiereDate)) {
      onChange({ ...valeur, premiereDate: prochaineDate(jour, aujourdhui) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jour]);

  return (
    <>
      <label className="flex flex-col gap-[7px]">
        <span className={etiquette}>Répétition</span>
        <select
          value={valeur.recurrence}
          onChange={(e) => {
            const recurrence = e.target.value as Recurrence;
            onChange({
              recurrence,
              premiereDate:
                recurrence === "hebdomadaire"
                  ? null
                  : dateJuste(valeur.premiereDate)
                    ? valeur.premiereDate
                    : prochaineDate(jour, aujourdhui),
            });
          }}
          className={inputStyles}
        >
          {RECURRENCES.map((r) => (
            <option key={r.valeur} value={r.valeur}>
              {r.libelle}
            </option>
          ))}
        </select>
      </label>

      {alterne ? (
        <label
          className={`flex flex-col gap-[7px] ${compact ? "w-[170px]" : ""}`}
        >
          <span className={etiquette}>Première fois le</span>
          <input
            type="date"
            required
            value={valeur.premiereDate ?? ""}
            onChange={(e) =>
              onChange({ ...valeur, premiereDate: e.target.value || null })
            }
            className={inputStyles}
          />
          {valeur.premiereDate && !dateJuste(valeur.premiereDate) ? (
            <span className="text-[12px] text-coral-dark">
              Ce n&apos;est pas le bon jour — par exemple le{" "}
              {formatDateJour(prochaineDate(jour, aujourdhui), { court: true })}
            </span>
          ) : null}
        </label>
      ) : null}
    </>
  );
}
