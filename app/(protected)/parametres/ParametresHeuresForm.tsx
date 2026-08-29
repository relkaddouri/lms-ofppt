"use client";

import { useState, useTransition } from "react";
import Card from "@/components/ui/Card";
import Interrupteur from "@/components/ui/Interrupteur";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import {
  saveParametresFormateur,
  type ParametresFormateur,
} from "@/app/actions/heures";
import { Save } from "lucide-react";

/**
 * Charge horaire contractuelle.
 *
 * Les 910 heures et les plafonds d'heures supplémentaires relèvent du contrat,
 * pas du produit : un temps partiel, ou un établissement appliquant un autre
 * volume, doit pouvoir les saisir.
 */
export default function ParametresHeuresForm({
  initial,
}: {
  initial: ParametresFormateur;
}) {
  const toast = useToast();
  const [enCours, startTransition] = useTransition();
  const [annuelles, setAnnuelles] = useState(String(initial.heures_annuelles));
  const [hebdo, setHebdo] = useState(String(initial.heures_hebdomadaires));
  const [supActives, setSupActives] = useState(initial.heures_sup_actives);
  const [supMensuel, setSupMensuel] = useState(String(initial.plafond_sup_mensuel));
  const [supAnnuel, setSupAnnuel] = useState(String(initial.plafond_sup_annuel));

  function enregistrer() {
    startTransition(async () => {
      try {
        await saveParametresFormateur({
          heures_annuelles: Number(annuelles) || 0,
          heures_hebdomadaires: Number(hebdo) || 0,
          heures_sup_actives: supActives,
          plafond_sup_mensuel: Number(supMensuel) || 0,
          plafond_sup_annuel: Number(supAnnuel) || 0,
        });
        toast("Paramètres enregistrés.");
      } catch (e) {
        toast(e instanceof Error ? e.message : "Enregistrement impossible.", "error");
      }
    });
  }

  /** Remet les champs à la dernière valeur enregistrée. */
  function reinitialiser() {
    setAnnuelles(String(initial.heures_annuelles));
    setHebdo(String(initial.heures_hebdomadaires));
    setSupActives(initial.heures_sup_actives);
    setSupMensuel(String(initial.plafond_sup_mensuel));
    setSupAnnuel(String(initial.plafond_sup_annuel));
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-[17px] font-semibold text-ink">
            Volume horaire
          </h2>
          <span className="text-[13.5px] text-slate-light">
            Référence utilisée pour le suivi du plafond annuel.
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Heures annuelles dues"
            type="number"
            min={1}
            max={2000}
            step={0.5}
            value={annuelles}
            onChange={(e) => setAnnuelles(e.target.value)}
            hint="910 h par défaut, conformément au cadre légal."
          />
          <Input
            label="Masse horaire de la semaine"
            type="number"
            min={1}
            max={60}
            step={0.5}
            value={hebdo}
            onChange={(e) => setHebdo(e.target.value)}
            hint="Au-delà, les heures sont comptées supplémentaires."
          />
        </div>

        <div className="flex items-start justify-between gap-6 border-t border-separator pt-5">
          <div className="flex flex-col gap-1">
            <span className="text-[15px] font-semibold text-ink">
              Heures supplémentaires
            </span>
            <span className="max-w-[46ch] text-[13.5px] leading-snug text-slate-light">
              Autoriser la planification de séances au-delà du plafond annuel.
              Tant que c&apos;est inactif, le suivi n&apos;affiche ni le plafond
              mensuel ni l&apos;annuel — ils n&apos;auraient rien à dire.
            </span>
          </div>
          <Interrupteur
            actif={supActives}
            onChange={setSupActives}
            label="Activer le suivi des heures supplémentaires"
          />
        </div>

        {supActives ? (
          <>
            {/* Unique élément corail de l'écran : le dépassement de plafond. */}
            <p className="flex items-center gap-2.5 rounded-[10px] border border-coral-soft bg-coral-wash px-3.5 py-3 text-[13.5px] text-coral-dark">
              <span className="h-2 w-2 shrink-0 rounded-full bg-coral" aria-hidden />
              Les heures au-delà de{" "}
              <span className="font-mono font-medium">{annuelles} h</span> sont
              comptées comme supplémentaires.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Plafond mensuel"
                type="number"
                min={0}
                max={200}
                step={0.5}
                value={supMensuel}
                onChange={(e) => setSupMensuel(e.target.value)}
                hint="30 h par défaut."
              />
              <Input
                label="Plafond annuel"
                type="number"
                min={0}
                max={1000}
                step={0.5}
                value={supAnnuel}
                onChange={(e) => setSupAnnuel(e.target.value)}
                hint="260 h par défaut."
              />
            </div>
          </>
        ) : null}
      </Card>

      <div className="flex justify-end gap-2.5">
        <Button variant="secondary" onClick={reinitialiser} disabled={enCours}>
          Annuler
        </Button>
        <Button icon={Save} onClick={enregistrer} disabled={enCours} loading={enCours} loadingLabel="Enregistrement…">
          Enregistrer
        </Button>
      </div>
    </div>
  );
}
