"use client";

import { useState } from "react";
import { AlertTriangle, Table2 } from "lucide-react";
import DonneesQuestion from "@/components/DonneesQuestion";
import { alertesQuestion } from "@/lib/verification-questions";

/**
 * Les données d'une question, dans l'éditeur du formateur (PRD §4.7bis).
 *
 * Fermé tant qu'une question n'en a pas : la plupart des QCM et des questions
 * de cours n'en ont pas besoin, et un champ vide sous chacune alourdirait la
 * relecture. L'aperçu montre exactement ce que le stagiaire verra en ligne —
 * un tableau Markdown mal aligné se voit ici, pas le jour du contrôle.
 */
export function ChampDonnees({
  id,
  numero,
  valeur,
  onChange,
}: {
  id: string;
  numero: number;
  valeur: string;
  onChange: (v: string) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [apercu, setApercu] = useState(false);

  if (!valeur.trim() && !ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="flex items-center gap-1.5 self-start text-[13px] font-semibold text-teal hover:underline"
      >
        <Table2 className="h-3.5 w-3.5" aria-hidden />
        Ajouter des données (observations, tableau, extrait…)
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <label
          htmlFor={`donnees-${id}`}
          className="font-mono text-[11px] uppercase tracking-[0.1em] text-slate-light"
        >
          Données — affichées au stagiaire sous l&apos;énoncé
        </label>
        <span className="ml-auto flex gap-1 text-[12px]">
          {(["Écrire", "Aperçu"] as const).map((libelle) => {
            const actif = (libelle === "Aperçu") === apercu;
            return (
              <button
                key={libelle}
                type="button"
                aria-pressed={actif}
                onClick={() => setApercu(libelle === "Aperçu")}
                className={`rounded-md px-2 py-0.5 font-semibold ${
                  actif ? "bg-wash-strong text-ink" : "text-slate-2 hover:text-ink"
                }`}
              >
                {libelle}
              </button>
            );
          })}
        </span>
      </div>
      {apercu ? (
        valeur.trim() ? (
          <DonneesQuestion texte={valeur} />
        ) : (
          <p className="text-[13px] text-slate">Rien à afficher pour l&apos;instant.</p>
        )
      ) : (
        <textarea
          id={`donnees-${id}`}
          rows={5}
          aria-label={`Données de la question ${numero}`}
          value={valeur}
          placeholder={
            "Observations, verbatims, tableau en Markdown :\n| Utilisateur | Fréquence | Point bloquant |\n|---|---|---|\n| Karim | 3 fois / semaine | Aucun |"
          }
          onChange={(e) => onChange(e.target.value)}
          className="w-full resize-y rounded-[10px] border border-border-strong bg-surface px-[13px] py-[11px] font-mono text-[13px] leading-snug text-body outline-none placeholder:text-slate-light focus:border-teal"
        />
      )}
    </div>
  );
}

/** Ce qui rendrait la question impossible ou hors sujet, recalculé à la frappe. */
export function AlertesQuestion({
  type,
  enonce,
  donnees,
}: {
  type: string;
  enonce: string;
  donnees: string;
}) {
  const alertes = alertesQuestion({ type, enonce, donnees });
  if (alertes.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1 rounded-[10px] border border-tint-teal-strong bg-tint-teal px-3 py-2 text-[13px] text-ink">
      {alertes.map((a) => (
        <li key={a} className="flex items-start gap-1.5">
          <AlertTriangle
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-coral-dark"
            aria-hidden
          />
          {a}
        </li>
      ))}
    </ul>
  );
}
