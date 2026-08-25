"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createAnnonce,
  deleteAnnonce,
  type Annonce,
} from "@/app/actions/annonces";
import { useToast } from "@/components/Toast";
import { Send, Trash2 } from "lucide-react";

const inputClass =
  "mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-ink focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest";
const btnPrimary =
  "inline-flex items-center gap-1.5 rounded-lg bg-forest px-4 py-2 text-sm font-medium text-white hover:bg-forest/90 focus:outline-none focus:ring-2 focus:ring-forest";
const btnDangerGhost =
  "inline-flex items-center gap-1.5 rounded-lg border border-danger/50 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/10 focus:outline-none focus:ring-2 focus:ring-danger";

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR");
}

export default function AnnoncesManager({
  groupeId,
  annonces,
}: {
  groupeId: string;
  annonces: Annonce[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ titre: "", contenu: "", date: "" });
  const toast = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await createAnnonce(groupeId, {
        titre: form.titre,
        contenu: form.contenu || undefined,
        date: form.date || undefined,
      });
      setForm({ titre: "", contenu: "", date: "" });
      toast("Annonce publiée");
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(a: Annonce) {
    if (!confirm(`Supprimer l'annonce « ${a.titre} » ?`)) return;
    try {
      await deleteAnnonce(a.id, groupeId);
      toast("Annonce supprimée");
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur inattendue");
    }
  }

  return (
    <div>
      <div className="mt-6 max-w-[640px] rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4">
        <h2 className="text-sm font-medium text-ink">Publier une annonce</h2>
        <form onSubmit={handleSubmit} className="mt-3 space-y-4">
          <div>
            <label htmlFor="titre" className="block text-sm font-medium text-ink">
              Titre
            </label>
            <input
              id="titre"
              required
              value={form.titre}
              onChange={(e) => setForm({ ...form, titre: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label
              htmlFor="contenu"
              className="block text-sm font-medium text-ink"
            >
              Contenu
            </label>
            <textarea
              id="contenu"
              rows={4}
              value={form.contenu}
              onChange={(e) => setForm({ ...form, contenu: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="date" className="block text-sm font-medium text-ink">
              Date
            </label>
            <input
              id="date"
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className={inputClass}
            />
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={busy} className={btnPrimary}>
              {busy ? (
                "Publication…"
              ) : (
                <>
                  <Send size={16} />
                  Publier
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      <div className="mt-6 space-y-4">
        {annonces.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-6 text-center text-sm text-slate">
            Aucune annonce publiée.
          </p>
        ) : (
          annonces.map((a) => (
            <div
              key={a.id}
              className="rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-display text-lg font-bold text-ink">
                    {a.titre}
                  </h3>
                  <p className="mt-0.5 font-mono text-xs text-slate">
                    {formatDate(a.date)}
                  </p>
                </div>
                <button onClick={() => handleDelete(a)} className={btnDangerGhost}>
                  <Trash2 size={16} />
                  Supprimer
                </button>
              </div>
              {a.contenu ? (
                <p className="mt-2 whitespace-pre-line text-sm text-ink">
                  {a.contenu}
                </p>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
