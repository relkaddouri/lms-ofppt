"use client";

import { useState, useTransition } from "react";
import Card from "@/components/ui/Card";
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
  const [supActives, setSupActives] = useState(initial.heures_sup_actives);
  const [supMensuel, setSupMensuel] = useState(String(initial.plafond_sup_mensuel));
  const [supAnnuel, setSupAnnuel] = useState(String(initial.plafond_sup_annuel));

  function enregistrer() {
    startTransition(async () => {
      try {
        await saveParametresFormateur({
          heures_annuelles: Number(annuelles) || 0,
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

  return (
    <Card>
      <h2 className="text-base font-semibold text-ink">Ma charge horaire</h2>
      <p className="mt-1 text-sm text-slate">
        Sert au suivi cumulatif affiché sur le calendrier.
      </p>

      <div className="mt-4 max-w-[280px]">
        <Input
          label="Volume horaire de l'année"
          type="number"
          min={1}
          max={2000}
          step={0.5}
          value={annuelles}
          onChange={(e) => setAnnuelles(e.target.value)}
          hint="910 h par défaut, conformément au cadre légal."
        />
      </div>

      <div className="mt-5 rounded-lg border border-border p-3">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            role="switch"
            checked={supActives}
            onChange={(e) => setSupActives(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-forest"
          />
          <span>
            <span className="block text-sm font-medium text-ink">
              J&apos;effectue des heures supplémentaires
            </span>
            <span className="mt-0.5 block text-xs text-slate">
              Tant que c&apos;est décoché, le suivi n&apos;affiche ni le plafond
              mensuel ni l&apos;annuel — ils n&apos;auraient rien à dire.
            </span>
          </span>
        </label>

        {supActives ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
        ) : null}
      </div>

      <Button icon={Save} className="mt-4" onClick={enregistrer} disabled={enCours}>
        {enCours ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </Card>
  );
}
