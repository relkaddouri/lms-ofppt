"use client";

import { useEffect, useState } from "react";
import { DoorClosed, DoorOpen, Timer } from "lucide-react";
import Button from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/Modal";
import { inputStyles } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { formatHeure } from "@/lib/creneaux";
import { instantEtablissement } from "@/lib/format";
import { testOuvert } from "@/lib/controles";
import { fermerTest, ouvrirTest } from "@/app/actions/controles";

const DUREES = [15, 30, 45, 60, 90, 120] as const;

const heure = (iso: string) => formatHeure(instantEtablissement(new Date(iso)).heure);

function restant(ms: number): string {
  const min = Math.max(0, Math.ceil(ms / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

/**
 * Ouvrir et fermer un contrôle de test au groupe (PRD §4.7bis).
 *
 * Le formateur décide du moment : ouvert en fin de séance, pour une durée
 * fixée — il se ferme alors tout seul — ou jusqu'à ce qu'il le ferme. Les
 * stagiaires le voient apparaître dans leurs contrôles et leur cloche.
 *
 * Aucune note ne leur parvient à la remise : le formateur relit la correction
 * de l'IA dans l'onglet Copies, puis publie — décision du porteur de projet.
 */
export default function PassationTest({
  controleId,
  moduleId,
  statut,
  modifie,
  ouvertLe,
  fermeLe,
  onChange,
  onVoirCopies,
}: {
  controleId: string;
  moduleId: string;
  statut: "brouillon" | "valide";
  modifie: boolean;
  ouvertLe: string | null;
  fermeLe: string | null;
  onChange: (ouvertLe: string | null, fermeLe: string | null) => void;
  onVoirCopies: () => void;
}) {
  const toast = useToast();
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const [duree, setDuree] = useState<"libre" | `${number}`>("30");
  const [enCours, setEnCours] = useState(false);
  const [confirmeFermeture, setConfirmeFermeture] = useState(false);

  const ouvert = testOuvert({ type: "TEST", ouvert_le: ouvertLe, ferme_le: fermeLe }, maintenant);

  // L'état change de lui-même quand un test chronométré arrive à sa fin : on
  // relit l'heure, pas la base.
  useEffect(() => {
    if (!ouvert) return;
    const minuterie = window.setInterval(() => setMaintenant(Date.now()), 15_000);
    return () => window.clearInterval(minuterie);
  }, [ouvert]);

  async function ouvrir() {
    setEnCours(true);
    try {
      const r = await ouvrirTest(
        controleId,
        moduleId,
        duree === "libre" ? null : Number(duree),
      );
      setMaintenant(Date.now());
      onChange(r.ouvert_le, r.ferme_le);
      toast(
        r.ferme_le
          ? `Test ouvert au groupe jusqu'à ${heure(r.ferme_le)}.`
          : "Test ouvert au groupe, jusqu'à ce que vous le fermiez.",
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
      const r = await fermerTest(controleId, moduleId);
      setMaintenant(Date.now());
      onChange(ouvertLe, r.ferme_le);
      setConfirmeFermeture(false);
      toast("Test fermé : plus aucune copie n'est acceptée.");
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
      : "Jamais ouvert : les stagiaires ne le voient pas";

  const bloque =
    statut !== "valide"
      ? "Validez le test pour pouvoir l'ouvrir."
      : modifie
        ? "Enregistrez vos modifications avant d'ouvrir le test."
        : null;

  return (
    <section
      aria-label="Passation en ligne du test"
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
          <span className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor={`duree-test-${controleId}`}>
              Durée d&apos;ouverture
            </label>
            <span className="relative flex items-center">
              <Timer
                className="pointer-events-none absolute left-3 h-4 w-4 text-slate"
                aria-hidden
              />
              <select
                id={`duree-test-${controleId}`}
                value={duree}
                onChange={(e) => setDuree(e.target.value as typeof duree)}
                className={`${inputStyles} !w-auto pl-9`}
              >
                {DUREES.map((d) => (
                  <option key={d} value={String(d)}>
                    Pendant {d < 60 ? `${d} min` : restant(d * 60_000)}
                  </option>
                ))}
                <option value="libre">Sans limite de temps</option>
              </select>
            </span>
            <Button
              icon={DoorOpen}
              onClick={ouvrir}
              loading={enCours}
              disabled={enCours || bloque !== null}
              title={bloque ?? undefined}
            >
              {ouvertLe ? "Rouvrir au groupe" : "Ouvrir au groupe"}
            </Button>
          </span>
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
        , puis publiez. Le test ne compte pas dans la moyenne.
      </p>

      <ConfirmModal
        open={confirmeFermeture}
        onClose={() => setConfirmeFermeture(false)}
        onConfirm={() => void fermer()}
        busy={enCours}
        title="Fermer le test ?"
        message="Les stagiaires qui n'ont pas rendu leur copie ne pourront plus le faire. Vous pourrez le rouvrir."
        confirmLabel="Fermer le test"
      />
    </section>
  );
}
