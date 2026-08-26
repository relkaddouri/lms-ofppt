"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateSeance, type Seance } from "@/app/actions/seances";
import { Textarea } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/format";
import { formatHeure } from "@/lib/creneaux";
import { Save } from "lucide-react";

export default function SeanceCard({ seance }: { seance: Seance }) {
  const router = useRouter();
  const toast = useToast();
  const [realise, setRealise] = useState(seance.contenu_realise ?? "");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);

  const isFait = seance.statut === "fait";

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setRealise(e.target.value);
    setDirty(true);
  }

  async function handleToggle() {
    setBusy(true);
    try {
      await updateSeance(seance.id, {
        statut: isFait ? "a_faire" : "fait",
      });
      toast(isFait ? "Séance remise à faire" : "Séance marquée faite");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur inattendue", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveContenu() {
    setBusy(true);
    try {
      await updateSeance(seance.id, { contenu_realise: realise });
      setDirty(false);
      toast("Contenu réalisé enregistré");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur inattendue", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-slate">
            {seance.date ? (
              formatDate(seance.date, "Date non fixée")
            ) : (
              <span className="italic text-slate/60">Date non fixée</span>
            )}
            {seance.heure_debut && seance.heure_fin ? (
              <>
                {" · "}
                {formatHeure(seance.heure_debut)} – {formatHeure(seance.heure_fin)}
                {seance.duree_realisee !== null
                  ? ` · ${seance.duree_realisee} h`
                  : null}
              </>
            ) : null}
          </p>
          {seance.mode ? (
            <p className="mt-0.5 text-xs text-slate">
              {seance.mode === "distance" ? "À distance" : "Présentiel"}
            </p>
          ) : null}
          {seance.objectif_operationnel ? (
            <p className="mt-1 text-sm text-ink">
              {seance.objectif_operationnel}
            </p>
          ) : null}
          {seance.contenu_prevu ? (
            <p className="mt-1 text-sm text-ink">{seance.contenu_prevu}</p>
          ) : (
            <p className="mt-1 text-sm italic text-slate/60">
              Contenu prévu non renseigné
            </p>
          )}
        </div>
        <button
          onClick={handleToggle}
          disabled={busy}
          className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium focus:outline-none focus:ring-2 disabled:opacity-50 ${
            isFait
              ? "bg-success/10 text-success hover:bg-success/20 focus:ring-success"
              : "bg-info/10 text-info hover:bg-info/20 focus:ring-info"
          }`}
          title={isFait ? "Revenir à « à faire »" : "Marquer la séance comme faite"}
        >
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${
              isFait ? "bg-success" : "bg-info"
            }`}
          />
          {isFait ? "Fait" : "Marquer faite"}
        </button>
      </div>

      <div className="mt-3">
        <Textarea
          label={<span className="text-xs text-slate">Contenu réalisé</span>}
          rows={2}
          value={realise}
          onChange={handleChange}
          placeholder="Ce qui a réellement été couvert…"
        />
        <div className="mt-2 flex justify-end">
          <Button
            variant="secondary"
            size="sm"
            icon={Save}
            onClick={handleSaveContenu}
            disabled={busy || !dirty}
          >
            Enregistrer
          </Button>
        </div>
      </div>
    </div>
  );
}
