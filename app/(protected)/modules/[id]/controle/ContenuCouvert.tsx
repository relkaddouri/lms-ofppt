"use client";

import { useEffect, useState } from "react";
import Badge from "@/components/ui/Badge";
import { formatDate, formatHeures } from "@/lib/format";
import {
  getContenuCouvert,
  type ContenuCouvert as Donnees,
  type TypeControle,
} from "@/app/actions/controles";

/**
 * Contenu de référence d'un contrôle, première étape de sa préparation.
 *
 * Un contrôle continu porte sur ce qui a été fait à ce jour ; une épreuve de
 * fin de module porte sur le module entier. Le formateur doit voir cette
 * différence avant de générer quoi que ce soit — c'est elle qui détermine sur
 * quoi les stagiaires seront interrogés.
 */
export default function ContenuCouvert({
  groupeId,
  moduleId,
  type,
}: {
  groupeId: string | null;
  moduleId: string;
  type: TypeControle;
}) {
  const [donnees, setDonnees] = useState<Donnees | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!groupeId) return;
    let annule = false;
    setChargement(true);
    setErreur(null);
    getContenuCouvert(groupeId, moduleId, type)
      .then((d) => {
        if (!annule) setDonnees(d);
      })
      .catch((e: unknown) => {
        if (!annule) {
          setErreur(e instanceof Error ? e.message : "Chargement impossible.");
        }
      })
      .finally(() => {
        if (!annule) setChargement(false);
      });
    return () => {
      annule = true;
    };
  }, [groupeId, moduleId, type]);

  if (!groupeId) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <p className="text-sm text-slate">
          Choisissez d&apos;abord un groupe : le contenu couvert dépend de ce que
          ce groupe-là a réellement traité.
        </p>
      </div>
    );
  }

  const efm = type === "EFM";

  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium text-ink">
          {efm ? "Contenu du module entier" : "Contenu couvert à ce jour"}
        </h2>
        <Badge tone={efm ? "info" : "neutral"}>
          {efm ? "EFM — programme complet" : "CC — séances faites"}
        </Badge>
      </div>

      <p className="mt-1 text-xs text-slate">
        {efm
          ? "L'épreuve de fin de module porte sur tout le module, y compris les séances à venir."
          : "Un contrôle continu n'interroge que sur ce qui a déjà été traité avec ce groupe."}
      </p>

      {erreur ? (
        <p className="mt-3 text-sm text-danger">{erreur}</p>
      ) : chargement || !donnees ? (
        <p className="mt-3 text-sm text-slate">Chargement…</p>
      ) : donnees.seances.length === 0 ? (
        <p className="mt-3 rounded-lg bg-info/10 px-3 py-2 text-sm text-ink">
          {efm
            ? "Aucune séance planifiée sur ce module. Générez le plan de déroulement avant de préparer l'épreuve."
            : "Aucune séance n'est encore marquée comme faite. Un contrôle continu n'aurait rien sur quoi porter."}
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm text-ink">
            <span className="font-medium">
              {donnees.seances.length} séance
              {donnees.seances.length > 1 ? "s" : ""}
            </span>{" "}
            · {formatHeures(donnees.heures)}
            {!efm && donnees.heuresModule > 0 ? (
              <span className="text-slate">
                {" "}
                sur {formatHeures(donnees.heuresModule)} au module, soit{" "}
                {Math.round((donnees.heures / donnees.heuresModule) * 100)} %
              </span>
            ) : null}
          </p>

          <ul className="mt-3 max-h-72 space-y-1.5 overflow-y-auto pr-1">
            {donnees.seances.map((s) => (
              <li
                key={s.id}
                className="flex gap-2 border-b border-border pb-1.5 last:border-0"
              >
                <span className="w-20 shrink-0 font-mono text-xs text-slate">
                  {s.date ? formatDate(s.date) : "—"}
                </span>
                <span
                  className={`w-16 shrink-0 text-xs ${
                    s.nature === "pratique" ? "text-info" : "text-slate"
                  }`}
                >
                  {s.nature === "pratique"
                    ? "pratique"
                    : s.nature === "theorique"
                      ? "théorie"
                      : "—"}
                </span>
                <span className="min-w-0 flex-1 text-sm text-ink">
                  {s.contenu?.trim() || s.objectif || (
                    <span className="italic text-slate/60">
                      contenu non renseigné
                    </span>
                  )}
                  {s.statut !== "fait" ? (
                    <span className="ml-1.5 text-xs text-slate">(à venir)</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
