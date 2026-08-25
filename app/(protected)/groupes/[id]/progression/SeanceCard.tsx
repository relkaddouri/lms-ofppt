"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateSeance, type Seance } from "@/app/actions/seances";
import { Save } from "lucide-react";

const inputClass =
  "w-full rounded-lg border border-border px-3 py-2 text-sm text-ink focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest";

function formatDate(d: string | null) {
  if (!d) return "Date non fixée";
  return new Date(d).toLocaleDateString("fr-FR");
}

export default function SeanceCard({ seance }: { seance: Seance }) {
  const router = useRouter();
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
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveContenu() {
    setBusy(true);
    try {
      await updateSeance(seance.id, { contenu_realise: realise });
      setDirty(false);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          {seance.date ? (
            <p className="font-mono text-xs text-slate">
              {formatDate(seance.date)}
            </p>
          ) : (
            <p className="font-mono text-xs italic text-slate/60">
              Date non fixée
            </p>
          )}
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
        <label className="block text-xs font-medium text-slate">
          Contenu réalisé
        </label>
        <textarea
          rows={2}
          value={realise}
          onChange={handleChange}
          className={`${inputClass} mt-1`}
          placeholder="Ce qui a réellement été couvert…"
        />
        <div className="mt-2 flex justify-end">
          <button
            onClick={handleSaveContenu}
            disabled={busy || !dirty}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink hover:bg-paper focus:outline-none focus:ring-2 focus:ring-forest disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save size={16} />
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
