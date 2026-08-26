"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setDureeReference, type CompetenceLiee } from "@/app/actions/modules";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { Check, Pencil, X } from "lucide-react";

/**
 * Durée de référence d'un module : un repère de guidage, ajustable par le
 * formateur. La durée officielle du programme reste portée par la compétence.
 */
export default function DureeReferenceEditor({
  moduleId,
  dureeReference,
  competence,
}: {
  moduleId: string;
  dureeReference: number;
  competence: CompetenceLiee | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [edition, setEdition] = useState(false);
  const [valeur, setValeur] = useState(String(dureeReference));
  const [busy, setBusy] = useState(false);

  const nombre = Number(valeur);
  const erreur =
    valeur.trim() === ""
      ? "Saisissez un nombre d'heures."
      : !Number.isFinite(nombre) || nombre < 0
        ? "La durée doit être un nombre positif."
        : null;

  const nationale = competence?.duree_nationale_heures ?? null;
  const ajustee = nationale !== null && nationale !== dureeReference;

  async function enregistrer() {
    if (erreur) return;
    setBusy(true);
    try {
      await setDureeReference(moduleId, nombre);
      setEdition(false);
      toast("Durée de référence enregistrée");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur inattendue", "error");
    } finally {
      setBusy(false);
    }
  }

  if (edition) {
    return (
      <div className="mt-3 max-w-[640px]">
        <div className="flex items-start gap-2">
          <div className="w-40">
            <Input
              type="number"
              min={0}
              step={1}
              autoFocus
              value={valeur}
              onChange={(e) => setValeur(e.target.value)}
              error={erreur}
              label={
                <span className="text-xs text-slate">
                  Durée de référence (heures)
                </span>
              }
            />
          </div>
          <div className="mt-6 flex shrink-0 gap-2">
            <Button
              size="sm"
              icon={Check}
              onClick={enregistrer}
              disabled={busy || erreur !== null}
            >
              Enregistrer
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={X}
              onClick={() => {
                setValeur(String(dureeReference));
                setEdition(false);
              }}
              disabled={busy}
            >
              Annuler
            </Button>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate">
          Repère de guidage, ajustable à votre réalité. Il ne modifie pas la
          masse horaire allouée à chaque groupe, qui reste indépendante.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-border bg-surface px-3 py-1 font-mono text-xs text-slate">
          {dureeReference} h
        </span>
        <Button
          variant="ghost"
          size="sm"
          icon={Pencil}
          onClick={() => setEdition(true)}
        >
          Ajuster
        </Button>
      </div>
      <p className="mt-1 max-w-[640px] text-xs text-slate">
        Durée de référence : un repère de guidage, pas une valeur figée — vous
        pouvez l&apos;ajuster à votre réalité sans toucher aux masses horaires
        allouées par groupe.
        {nationale !== null ? (
          <>
            {" "}
            Programme national :{" "}
            <span className="font-mono">{nationale} h</span>
            {ajustee ? " (ajustée localement)" : null}.
          </>
        ) : null}
      </p>
    </div>
  );
}
