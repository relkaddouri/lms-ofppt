"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input, { inputStyles } from "@/components/ui/Input";
import { ConfirmModal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/format";
import {
  declarerIndisponibilite,
  supprimerIndisponibilite,
} from "@/app/actions/indisponibilites";
import {
  TYPES_INDISPONIBILITE,
  type Indisponibilite,
  type TypeIndisponibilite,
} from "@/lib/indisponibilites";
import { CalendarOff, Plus, Trash2 } from "lucide-react";
import BandeauRecalcul from "@/components/BandeauRecalcul";
import { messageReplanification } from "@/lib/motifs";

const LABEL = new Map(TYPES_INDISPONIBILITE.map((t) => [t.valeur, t.label]));

export default function IndisponibilitesPanel({
  indisponibilites,
  semaine,
}: {
  indisponibilites: Indisponibilite[];
  /** Bornes de la semaine affichée : celles qui la touchent sont mises en avant. */
  semaine: { debut: string; fin: string };
}) {
  const router = useRouter();
  const toast = useToast();
  const [enCours, startTransition] = useTransition();
  const [ouvert, setOuvert] = useState(false);
  const [aSupprimer, setASupprimer] = useState<Indisponibilite | null>(null);

  const [type, setType] = useState<TypeIndisponibilite>("ferie");
  const [debut, setDebut] = useState("");
  const [fin, setFin] = useState("");
  const [demiJournee, setDemiJournee] = useState<"" | "matin" | "soir">("");
  const [libelle, setLibelle] = useState("");
  const [motif, setMotif] = useState("");

  // Une demi-journée ne se déclare que sur un jour isolé : la base le refuse,
  // autant le dire avant plutôt que renvoyer une erreur après coup.
  const surUnSeulJour = debut !== "" && debut === fin;

  function reinitialiser() {
    setType("ferie");
    setDebut("");
    setFin("");
    setDemiJournee("");
    setLibelle("");
    setMotif("");
  }

  function enregistrer() {
    startTransition(async () => {
      try {
        const recalcul = await declarerIndisponibilite({
          type,
          date_debut: debut,
          date_fin: fin || debut,
          demi_journee: demiJournee === "" ? null : demiJournee,
          libelle: libelle || null,
          motif: motif || null,
        });
        // Le recalcul suit la déclaration (§4.9) : le dire, sinon le calendrier
        // change sous les yeux du formateur sans qu'il sache pourquoi.
        const suite = messageReplanification(recalcul);
        toast(
          suite ? `Indisponibilité déclarée — ${suite}` : "Indisponibilité déclarée",
        );
        reinitialiser();
        setOuvert(false);
        router.refresh();
      } catch (e) {
        toast(
          e instanceof Error ? e.message : "Déclaration impossible.",
          "error",
        );
      }
    });
  }

  function supprimer() {
    const cible = aSupprimer;
    if (!cible) return;
    startTransition(async () => {
      try {
        const recalcul = await supprimerIndisponibilite(cible.id);
        const suite = messageReplanification(recalcul);
        toast(suite ? `Indisponibilité retirée — ${suite}` : "Indisponibilité retirée");
        setASupprimer(null);
        router.refresh();
      } catch (e) {
        toast(
          e instanceof Error ? e.message : "Suppression impossible.",
          "error",
        );
      }
    });
  }

  return (
    <section className="rounded-[14px] border border-border bg-surface p-4">
      <BandeauRecalcul actif={enCours} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-medium text-ink">
          <CalendarOff className="h-4 w-4 text-slate" aria-hidden />
          Jours non travaillés
          {indisponibilites.length > 0 ? (
            <span className="font-mono text-xs font-normal text-slate-light">
              {indisponibilites.length} à venir
            </span>
          ) : null}
        </h2>
        <Button
          variant="secondary"
          size="sm"
          icon={Plus}
          onClick={() => setOuvert((o) => !o)}
        >
          Déclarer
        </Button>
      </div>

      {ouvert ? (
        <div className="mt-3 space-y-3 rounded-lg border border-border bg-paper p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs text-slate">Nature</span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as TypeIndisponibilite)}
                className={inputStyles}
              >
                {TYPES_INDISPONIBILITE.map((t) => (
                  <option key={t.valeur} value={t.valeur}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs text-slate">
                Demi-journée (facultatif)
              </span>
              <select
                value={demiJournee}
                onChange={(e) =>
                  setDemiJournee(e.target.value as "" | "matin" | "soir")
                }
                disabled={!surUnSeulJour}
                className={inputStyles}
              >
                <option value="">Journée entière</option>
                <option value="matin">Matin seulement</option>
                <option value="soir">Après-midi seulement</option>
              </select>
              {!surUnSeulJour ? (
                <span className="mt-1 block text-xs text-slate">
                  Possible seulement si début et fin tombent le même jour.
                </span>
              ) : null}
            </label>

            <label className="block">
              <span className="mb-1 block text-xs text-slate">Du</span>
              <Input
                type="date"
                value={debut}
                onChange={(e) => {
                  setDebut(e.target.value);
                  // Le cas courant est le jour isolé : on aligne la fin, quitte
                  // à ce qu'elle soit repoussée ensuite.
                  if (!fin || fin < e.target.value) setFin(e.target.value);
                }}
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs text-slate">Au</span>
              <Input
                type="date"
                value={fin}
                min={debut || undefined}
                onChange={(e) => {
                  setFin(e.target.value);
                  if (e.target.value !== debut) setDemiJournee("");
                }}
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs text-slate">
                Libellé (facultatif)
              </span>
              <Input
                value={libelle}
                onChange={(e) => setLibelle(e.target.value)}
                placeholder="Aïd al-Fitr, réunion pédagogique…"
              />
            </label>

            {type === "absence" ? (
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs text-slate">
                  Motif (facultatif)
                </span>
                <Input
                  value={motif}
                  onChange={(e) => setMotif(e.target.value)}
                  placeholder="Arrêt maladie"
                />
              </label>
            ) : null}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOuvert(false)}>
              Annuler
            </Button>
            <Button
              size="sm"
              onClick={enregistrer}
              disabled={enCours || !debut}
              loading={enCours}
              loadingLabel="Enregistrement…"
            >
              Enregistrer
            </Button>
          </div>
        </div>
      ) : null}

      {indisponibilites.length === 0 ? (
        <p className="mt-3 text-xs text-slate">
          Aucun jour non travaillé déclaré. Ajoutez les fériés, les vacances
          ou une absence : ils grisent la grille, et le générateur de
          l&apos;emploi du temps les saute.
        </p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {indisponibilites.map((i) => (
            <li
              key={i.id}
              className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 ${
                i.date_debut <= semaine.fin && i.date_fin >= semaine.debut
                  ? "border-border-strong bg-paper-alt"
                  : "border-border"
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm text-ink">
                  {i.libelle ?? LABEL.get(i.type)}
                  {i.motif ? (
                    <span className="text-slate"> — {i.motif}</span>
                  ) : null}
                </span>
                <span className="block text-xs text-slate">
                  {/* La nature ne se répète pas : elle sert déjà de titre
                      quand aucun libellé n'a été saisi. */}
                  {i.libelle ? `${LABEL.get(i.type)} · ` : ""}
                  {i.date_debut === i.date_fin
                    ? formatDate(i.date_debut)
                    : `${formatDate(i.date_debut)} → ${formatDate(i.date_fin)}`}
                  {i.demi_journee
                    ? i.demi_journee === "matin"
                      ? " · matin"
                      : " · après-midi"
                    : ""}
                </span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                icon={Trash2}
                aria-label="Retirer cette indisponibilité"
                onClick={() => setASupprimer(i)}
              >
                {""}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmModal
        open={aSupprimer !== null}
        onClose={() => setASupprimer(null)}
        onConfirm={supprimer}
        busy={enCours}
        title="Retirer ce jour non travaillé ?"
        confirmLabel="Retirer"
        message={
          aSupprimer
            ? `${aSupprimer.libelle ?? LABEL.get(aSupprimer.type)} — ${
                aSupprimer.date_debut === aSupprimer.date_fin
                  ? formatDate(aSupprimer.date_debut)
                  : `${formatDate(aSupprimer.date_debut)} → ${formatDate(aSupprimer.date_fin)}`
              }`
            : ""
        }
      />
    </section>
  );
}
