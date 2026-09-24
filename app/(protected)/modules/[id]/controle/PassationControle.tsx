"use client";

import { useEffect, useState } from "react";
import { DoorClosed, DoorOpen } from "lucide-react";
import Button from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { dureeEnTexte, formatHeure } from "@/lib/creneaux";
import { instantEtablissement } from "@/lib/format";
import { testOuvert } from "@/lib/controles";
import { fermerControle, ouvrirControle } from "@/app/actions/controles";

const heure = (iso: string) => formatHeure(instantEtablissement(new Date(iso)).heure);

function restant(ms: number): string {
  const min = Math.max(0, Math.ceil(ms / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

/**
 * Ouvrir et fermer un contrôle au groupe (PRD §4.7bis, migration 096).
 *
 * Valider prépare, ouvrir donne accès. Aucun contrôle — contrôle continu,
 * épreuve de fin de module ou test — n'est lisible du groupe avant ce geste :
 * un sujet validé une semaine à l'avance était jusqu'ici sous les yeux des
 * stagiaires dès sa validation.
 *
 * Deux gestes, et pas un réglage de plus : ouvrir, et fermer plus tôt s'il le
 * faut. L'heure de fermeture se calcule sur la durée du contrôle — deux
 * heures pour un contrôle de 2 h —, celle-là même qui sert au sujet imprimé et
 * au chronomètre du stagiaire.
 *
 * Aucune note ne parvient au stagiaire à la remise : le formateur relit la
 * correction de l'IA dans l'onglet Copies, puis publie.
 */
export default function PassationControle({
  controleId,
  moduleId,
  type,
  statut,
  dureeHeures,
  modifie,
  ouvertLe,
  fermeLe,
  onChange,
  onVoirCopies,
}: {
  controleId: string;
  moduleId: string;
  type: "CC" | "EFM" | "TEST";
  statut: "brouillon" | "valide";
  /** La durée du contrôle : elle fixe l'heure de fermeture à l'ouverture. */
  dureeHeures: number;
  modifie: boolean;
  ouvertLe: string | null;
  fermeLe: string | null;
  onChange: (ouvertLe: string | null, fermeLe: string | null) => void;
  onVoirCopies: () => void;
}) {
  const toast = useToast();
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const [enCours, setEnCours] = useState(false);
  const [confirmeFermeture, setConfirmeFermeture] = useState(false);

  const ouvert = testOuvert({ ouvert_le: ouvertLe, ferme_le: fermeLe }, maintenant);

  // L'état change de lui-même quand le temps s'achève : on relit l'heure, pas
  // la base.
  useEffect(() => {
    if (!ouvert) return;
    const minuterie = window.setInterval(() => setMaintenant(Date.now()), 15_000);
    return () => window.clearInterval(minuterie);
  }, [ouvert]);

  async function ouvrir() {
    setEnCours(true);
    try {
      const r = await ouvrirControle(controleId, moduleId);
      setMaintenant(Date.now());
      onChange(r.ouvert_le, r.ferme_le);
      toast(
        r.ferme_le
          ? `Contrôle ouvert au groupe jusqu'à ${heure(r.ferme_le)}.`
          : "Contrôle ouvert au groupe, jusqu'à ce que vous le fermiez.",
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur inattendue", "error");
    } finally {
      setEnCours(false);
    }
  }

  async function fermer() {
    setEnCours(true);
    try {
      const r = await fermerControle(controleId, moduleId);
      setMaintenant(Date.now());
      onChange(ouvertLe, r.ferme_le);
      setConfirmeFermeture(false);
      toast("Contrôle fermé : plus aucune copie n'est acceptée.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur inattendue", "error");
    } finally {
      setEnCours(false);
    }
  }

  const etat = ouvert
    ? fermeLe
      ? `Ouvert au groupe — se ferme à ${heure(fermeLe)}, dans ${restant(new Date(fermeLe).getTime() - maintenant)}`
      : `Ouvert au groupe depuis ${heure(ouvertLe!)}, sans limite`
    : ouvertLe
      ? `Fermé${fermeLe ? ` à ${heure(fermeLe)}` : ""} — les stagiaires voient leur copie, pas le sujet`
      : `Jamais ouvert : les stagiaires ne le voient pas, même validé — il se fermera seul ${dureeHeures > 0 ? `au bout de ${dureeEnTexte(dureeHeures)}` : "à votre demande"}`;

  const bloque =
    statut !== "valide"
      ? "Validez le contrôle pour pouvoir l'ouvrir."
      : modifie
        ? "Enregistrez vos modifications avant d'ouvrir le contrôle."
        : null;

  return (
    <section
      aria-label="Passation en ligne du contrôle"
      className={`mt-5 flex flex-col gap-3 rounded-[14px] border px-5 py-4 shadow-repos ${
        ouvert ? "border-tint-green bg-success-wash" : "border-border bg-surface"
      }`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] ${
            ouvert ? "bg-green text-white" : "bg-wash-strong text-slate-2"
          }`}
        >
          {ouvert ? (
            <DoorOpen className="h-[18px] w-[18px]" aria-hidden />
          ) : (
            <DoorClosed className="h-[18px] w-[18px]" aria-hidden />
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-display text-[16px] font-semibold text-ink">
            Passation en ligne
          </span>
          <span
            aria-live="polite"
            className={`text-[14px] ${ouvert ? "text-green-dark" : "text-slate-2"}`}
          >
            {etat}
          </span>
        </span>

        {ouvert ? (
          <Button
            variant="secondary"
            icon={DoorClosed}
            onClick={() => setConfirmeFermeture(true)}
            disabled={enCours}
          >
            Fermer maintenant
          </Button>
        ) : (
          <Button
            icon={DoorOpen}
            onClick={ouvrir}
            loading={enCours}
            disabled={enCours || bloque !== null}
            title={bloque ?? undefined}
          >
            {ouvertLe ? "Rouvrir au groupe" : "Ouvrir au groupe"}
          </Button>
        )}
      </div>

      <p className="text-[13px] leading-relaxed text-slate">
        {bloque && !ouvert ? `${bloque} ` : ""}
        La note n&apos;est pas montrée à la remise : relisez la correction de
        l&apos;IA dans{" "}
        <button
          type="button"
          onClick={onVoirCopies}
          className="font-semibold text-teal hover:underline"
        >
          Copies
        </button>
        , puis publiez.
        {type === "TEST" ? " Le test ne compte pas dans la moyenne." : ""}
      </p>

      <ConfirmModal
        open={confirmeFermeture}
        onClose={() => setConfirmeFermeture(false)}
        onConfirm={() => void fermer()}
        busy={enCours}
        title="Fermer le contrôle ?"
        message="Les stagiaires qui n'ont pas rendu leur copie ne pourront plus le faire. Vous pourrez le rouvrir."
        confirmLabel="Fermer le contrôle"
      />
    </section>
  );
}
