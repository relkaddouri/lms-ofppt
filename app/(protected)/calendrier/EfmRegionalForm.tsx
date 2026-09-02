"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { inputStyles as inputClass } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { setDatesEfmRegional, type ControleCalendrier } from "@/app/actions/calendrier";
import { Save } from "lucide-react";

/**
 * Saisie des deux dates d'une épreuve régionale.
 *
 * Le formateur ne fixe pas ces dates, il les reçoit. Une fois saisies, elles
 * font foi — d'où la bordure pleine dans la grille, là où ses propres
 * estimations restent en pointillés.
 */
export default function EfmRegionalForm({
  controle,
}: {
  controle: ControleCalendrier;
}) {
  const router = useRouter();
  const toast = useToast();
  const [enCours, startTransition] = useTransition();
  const [envoi, setEnvoi] = useState(controle.date_envoi_propositions ?? "");
  const [epreuve, setEpreuve] = useState(controle.date_prevue ?? "");

  function enregistrer() {
    startTransition(async () => {
      try {
        await setDatesEfmRegional(controle.id, envoi || null, epreuve || null);
        toast("Dates enregistrées.");
        router.refresh();
      } catch (e) {
        toast(e instanceof Error ? e.message : "Enregistrement impossible.", "error");
      }
    });
  }

  const arretee = Boolean(controle.date_prevue);

  return (
    <div
      className={`rounded-xl bg-surface p-4 ${
        arretee
          ? "border-2 border-solid border-ink"
          : "border border-dashed border-slate/60"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="danger">EFM régional</Badge>
        <span className="text-sm font-medium text-ink">
          {controle.groupeNom} · {controle.moduleNom}
        </span>
        <span className="ml-auto text-xs text-slate">
          {arretee ? "date arrêtée" : "date non communiquée"}
        </span>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <div>
          <label
            className="block text-xs text-slate"
            htmlFor={`envoi-${controle.id}`}
          >
            Envoi des propositions de sujets
          </label>
          <input
            id={`envoi-${controle.id}`}
            type="date"
            value={envoi}
            onChange={(e) => setEnvoi(e.target.value)}
            className={`${inputClass} mt-1`}
          />
        </div>
        <div>
          <label
            className="block text-xs text-slate"
            htmlFor={`epreuve-${controle.id}`}
          >
            Date de l&apos;épreuve
          </label>
          <input
            id={`epreuve-${controle.id}`}
            type="date"
            value={epreuve}
            onChange={(e) => setEpreuve(e.target.value)}
            className={`${inputClass} mt-1`}
          />
        </div>
        <Button
          icon={Save}
          className="self-end"
          onClick={enregistrer}
          disabled={enCours}
        >
          {enCours ? "…" : "Enregistrer"}
        </Button>
      </div>
    </div>
  );
}
