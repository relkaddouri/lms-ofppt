"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import Badge from "@/components/ui/Badge";
import { formatDateJour, formatHeures } from "@/lib/format";
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
 *
 * `Préparer un contrôle.dc.html` rend la liste décochable : « décochez ce qui
 * ne doit pas être évalué ». Les séances retenues sont remontées au parent,
 * qui les transmet au générateur — une case qui ne changerait rien serait pire
 * qu'absente.
 *
 * Un contrôle de test (PRD §4.7bis) porte sur des séances choisies une à une,
 * pas forcément à la suite : toutes les séances du module sont proposées, et
 * seule la dernière séance faite est cochée d'emblée. Un contrôle déjà
 * enregistré retrouve les séances qu'il avait retenues.
 */
export default function ContenuCouvert({
  groupeId,
  moduleId,
  type,
  initiales,
  onSelection,
}: {
  groupeId: string | null;
  moduleId: string;
  type: TypeControle;
  /** Les séances enregistrées avec le contrôle, à recocher. */
  initiales?: string[] | null;
  onSelection?: (ids: string[]) => void;
}) {
  const [donnees, setDonnees] = useState<Donnees | null>(null);
  const [retenuesIds, setRetenuesIds] = useState<Set<string>>(new Set());
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!groupeId) return;
    let annule = false;
    setChargement(true);
    setErreur(null);
    getContenuCouvert(groupeId, moduleId, type)
      .then((d) => {
        if (annule) return;
        setDonnees(d);
        const ids = d.seances.map((s) => s.id);
        const enregistrees = (initiales ?? []).filter((id) => ids.includes(id));
        // Un contrôle enregistré retrouve son périmètre. Sinon : tout pour un
        // CC ou un EFM, et pour un test la dernière séance faite seulement —
        // un test se construit en cochant, pas en décochant.
        const depart =
          enregistrees.length > 0
            ? enregistrees
            : type === "TEST"
              ? d.seances
                  .filter((s) => s.statut === "fait")
                  .slice(-1)
                  .map((s) => s.id)
              : ids;
        setRetenuesIds(new Set(depart));
        onSelection?.(depart);
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
    // `onSelection` est recréée à chaque rendu du parent : la faire entrer ici
    // relancerait la requête en boucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupeId, moduleId, type]);

  function basculer(id: string) {
    setRetenuesIds((precedent) => {
      const suivant = new Set(precedent);
      if (suivant.has(id)) suivant.delete(id);
      else suivant.add(id);
      onSelection?.(
        (donnees?.seances ?? []).map((s) => s.id).filter((x) => suivant.has(x)),
      );
      return suivant;
    });
  }

  if (!groupeId) {
    return (
      <div className="rounded-[14px] border border-border bg-surface p-6 shadow-repos">
        <p className="text-[14.5px] text-slate-2">
          Choisissez d&apos;abord un groupe : le contenu couvert dépend de ce
          que ce groupe-là a réellement traité.
        </p>
      </div>
    );
  }

  const efm = type === "EFM";
  const test = type === "TEST";
  const retenues = (donnees?.seances ?? []).filter((s) => retenuesIds.has(s.id));
  const heuresRetenues = retenues.reduce(
    (somme, s) => somme + (s.duree ?? 0),
    0,
  );

  return (
    <section className="overflow-hidden rounded-[14px] border border-border bg-surface shadow-repos">
      <div className="flex flex-col gap-1 border-b border-separator px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-[18px] font-semibold text-ink">
            {efm
              ? "Contenu du module entier"
              : test
                ? "Séances évaluées"
                : "Contenu couvert"}
          </h2>
          <Badge tone={efm ? "info" : "neutral"}>
            {efm
              ? "EFM — programme complet"
              : test
                ? "Test — séances choisies"
                : "CC — séances faites"}
          </Badge>
        </div>
        <p className="text-sm text-slate-light">
          {efm
            ? "L'épreuve de fin de module porte sur tout le module, y compris les séances à venir. Décochez ce qui ne doit pas être évalué."
            : test
              ? "Cochez la ou les séances sur lesquelles porte le test — pas forcément à la suite. Le test ne compte ni dans la moyenne ni dans les contrôles réglementaires."
              : "Séances réalisées depuis le dernier contrôle. Décochez ce qui ne doit pas être évalué."}
        </p>
      </div>

      {erreur ? (
        <p className="px-6 py-5 text-sm text-coral-dark">{erreur}</p>
      ) : chargement || !donnees ? (
        <p className="px-6 py-5 text-sm text-slate-light">Chargement…</p>
      ) : donnees.seances.length === 0 ? (
        <p className="px-6 py-6 text-[14.5px] text-body">
          {efm
            ? "Aucune séance planifiée sur ce module. Générez le plan de déroulement avant de préparer l'épreuve."
            : "Aucune séance n'est encore marquée comme faite. Un contrôle continu n'aurait rien sur quoi porter."}
        </p>
      ) : (
        <>
          <div className="max-h-[420px] overflow-y-auto">
            {donnees.seances.map((s) => {
              const retenue = retenuesIds.has(s.id);
              const intitule =
                s.contenu?.trim() || s.objectif || "Contenu non renseigné";
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={retenue}
                  onClick={() => basculer(s.id)}
                  className={`flex w-full items-center gap-3.5 border-b border-separator px-6 py-[15px] text-left transition-colors duration-150 ease-out ${
                    retenue ? "bg-paper-alt" : "bg-surface hover:bg-paper"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border-[1.5px] ${
                      retenue
                        ? "border-ink bg-ink"
                        : "border-border-strong bg-surface"
                    }`}
                  >
                    {retenue ? (
                      <Check className="h-3 w-3 text-white" strokeWidth={3} />
                    ) : null}
                  </span>
                  <span className="flex min-w-0 flex-col gap-[2px]">
                    <span
                      className={`truncate text-[15px] font-semibold ${
                        retenue ? "text-ink" : "text-slate-light"
                      }`}
                    >
                      {intitule}
                    </span>
                    <span className="text-[13px] text-slate-light">
                      {[
                        s.nature === "pratique"
                          ? "pratique"
                          : s.nature === "theorique"
                            ? "théorie"
                            : null,
                        s.duree ? formatHeures(s.duree) : null,
                        s.statut !== "fait" ? "à venir" : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className="ml-auto whitespace-nowrap font-mono text-[13.5px] text-slate-2">
                    {s.date ? formatDateJour(s.date, { court: true }) : "—"}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 bg-paper-alt px-6 py-4">
            <span className="text-sm text-slate-2">
              <span className="font-mono font-medium text-body">
                {retenues.length}
              </span>{" "}
              séance{retenues.length > 1 ? "s" : ""} retenue
              {retenues.length > 1 ? "s" : ""} ·{" "}
              <span className="font-mono font-medium text-body">
                {formatHeures(heuresRetenues)}
              </span>{" "}
              de contenu
            </span>
            {test && retenues.length === 0 ? (
              <span className="text-[13px] font-semibold text-coral-dark">
                Cochez au moins une séance.
              </span>
            ) : !efm && donnees.heuresModule > 0 ? (
              <span className="font-mono text-[13px] text-muted">
                {Math.round((heuresRetenues / donnees.heuresModule) * 100)} % de
                la masse horaire du module
              </span>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}
