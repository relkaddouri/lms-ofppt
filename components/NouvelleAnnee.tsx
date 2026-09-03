"use client";

import { useEffect, useState, useTransition } from "react";
import { CalendarPlus, Check } from "lucide-react";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import Input, { inputStyles } from "./ui/Input";
import { useToast } from "./ui/Toast";
import {
  dupliquerAnnee,
  getGroupesADupliquer,
  type GroupeADupliquer,
} from "@/app/actions/annees";
import type { AnneeScolaire } from "@/lib/annees";

/**
 * Créer une année à partir d'une précédente (PRD §4.15.5).
 *
 * Le formateur choisit les groupes qu'il reconduit, tous cochés par défaut :
 * décocher avant est réversible, supprimer après ne l'est pas. La granularité
 * s'arrête au groupe — retirer un module se fait ensuite en deux clics sur
 * l'écran d'assignation, une arborescence ici dupliquerait cette fonction.
 */

/** 2026/2027 devient 2027/2028 : la proposition la plus probable. */
function anneeSuivante(libelle: string): string {
  const debut = Number(libelle.split("/")[0]);
  return Number.isFinite(debut) ? `${debut + 1}/${debut + 2}` : "";
}

export default function NouvelleAnnee({
  annees,
  sourceParDefaut,
  open,
  onClose,
}: {
  annees: AnneeScolaire[];
  sourceParDefaut: string;
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const [enCours, startTransition] = useTransition();
  const [sourceId, setSourceId] = useState(sourceParDefaut);
  const [libelle, setLibelle] = useState("");
  const [groupes, setGroupes] = useState<GroupeADupliquer[] | null>(null);
  const [retenus, setRetenus] = useState<Set<string>>(new Set());

  // Les groupes de l'année source, rechargés quand elle change.
  useEffect(() => {
    if (!open) return;
    let vivant = true;
    setGroupes(null);
    getGroupesADupliquer(sourceId)
      .then((liste) => {
        if (!vivant) return;
        setGroupes(liste);
        setRetenus(new Set(liste.map((g) => g.id)));
      })
      .catch(() => vivant && setGroupes([]));
    return () => {
      vivant = false;
    };
  }, [open, sourceId]);

  useEffect(() => {
    if (!open) return;
    setSourceId(sourceParDefaut);
    const source = annees.find((a) => a.id === sourceParDefaut);
    setLibelle(source ? anneeSuivante(source.libelle) : "");
  }, [open, sourceParDefaut, annees]);

  function basculer(id: string) {
    setRetenus((prev) => {
      const suite = new Set(prev);
      if (suite.has(id)) suite.delete(id);
      else suite.add(id);
      return suite;
    });
  }

  const formatValide = /^[0-9]{4}\/[0-9]{4}$/.test(libelle.trim());
  const dejaPrise = annees.some((a) => a.libelle === libelle.trim());
  const erreur = !libelle.trim()
    ? null
    : !formatValide
      ? "L'année scolaire s'écrit au format 2027/2028."
      : dejaPrise
        ? "Cette année existe déjà."
        : null;

  function creer() {
    startTransition(async () => {
      try {
        await dupliquerAnnee(sourceId, libelle.trim(), [...retenus]);
        // La nouvelle année devient la portée de tout l'écran : on repart
        // dessus plutôt que de rafraîchir par morceaux.
        window.location.reload();
      } catch (e) {
        toast(e instanceof Error ? e.message : "Duplication impossible.", "error");
      }
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Créer une nouvelle année"
      description="Vos groupes, leurs assignations, vos séances déjà réparties, vos fiches et vos contrôles sont repris. Les stagiaires et leurs copies repartent de zéro."
      footer={
        <div className="flex flex-wrap justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose} disabled={enCours}>
            Annuler
          </Button>
          <Button
            icon={CalendarPlus}
            onClick={creer}
            disabled={
              enCours || !formatValide || dejaPrise || retenus.size === 0
            }
            loading={enCours}
            loadingLabel="Duplication…"
          >
            Créer l&apos;année
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-[7px]">
            <span className="text-sm font-semibold text-body">
              À partir de l&apos;année
            </span>
            <select
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              disabled={enCours}
              className={inputStyles}
            >
              {annees.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.libelle}
                </option>
              ))}
            </select>
          </label>

          <Input
            label="Nouvelle année"
            value={libelle}
            onChange={(e) => setLibelle(e.target.value)}
            placeholder="2027/2028"
            error={erreur}
            disabled={enCours}
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-body">
            Groupes à reconduire
          </span>

          {groupes === null ? (
            <p className="text-[13.5px] text-slate-light">Chargement…</p>
          ) : groupes.length === 0 ? (
            <p className="text-[13.5px] text-slate-light">
              Cette année ne contient aucun groupe à reconduire.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {groupes.map((g) => {
                const coche = retenus.has(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    role="checkbox"
                    aria-checked={coche}
                    onClick={() => basculer(g.id)}
                    disabled={enCours}
                    className={`flex items-center gap-3 rounded-[10px] border px-3.5 py-2.5 text-left transition-colors duration-150 ease-out ${
                      coche
                        ? "border-border-strong bg-surface"
                        : "border-border bg-paper"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors duration-150 ease-out ${
                        coche
                          ? "border-ink bg-ink text-white"
                          : "border-border-strong bg-surface"
                      }`}
                    >
                      {coche ? <Check size={12} strokeWidth={3} /> : null}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span
                        className={`text-[14.5px] font-semibold ${
                          coche ? "text-ink" : "text-slate-light"
                        }`}
                      >
                        {g.nom}
                      </span>
                      <span className="font-mono text-[12px] text-slate-light">
                        {g.nbModules} module{g.nbModules > 1 ? "s" : ""} ·{" "}
                        {g.nbSeances} séance{g.nbSeances > 1 ? "s" : ""} ·{" "}
                        {g.nbControles} contrôle{g.nbControles > 1 ? "s" : ""}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <p className="text-[12.5px] leading-snug text-slate-light">
            Tous cochés par défaut. Décochez un groupe qui n&apos;existera plus :
            le retirer avant est réversible, le supprimer après ne l&apos;est pas.
          </p>
        </div>

        <div className="flex flex-col gap-1.5 rounded-[10px] border border-border bg-paper px-4 py-3.5">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted">
            Ce qui ne suit pas
          </span>
          <p className="text-[13.5px] leading-relaxed text-slate-2">
            Les stagiaires, leurs copies, notes et présences — ce sont de
            nouvelles personnes. Les annonces, devoirs et dossiers de stage, liés
            aux dates de l&apos;année. Et le rythme hebdomadaire, qui se
            redéclare : ce sont vos nouveaux créneaux qui dateront les séances
            reprises, elles arrivent sans date.
          </p>
        </div>
      </div>
    </Modal>
  );
}
