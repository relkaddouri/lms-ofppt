"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  createModule,
  updateModule,
  deleteModule,
  type Module,
} from "@/app/actions/modules";
import KebabMenu from "@/components/KebabMenu";
import { Pencil, Plus, Save, Trash2, X } from "lucide-react";

const inputClass =
  "mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-ink focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest";
const btnPrimary =
  "inline-flex items-center gap-1.5 rounded-lg bg-forest px-4 py-2 text-sm font-medium text-white hover:bg-forest/90 focus:outline-none focus:ring-2 focus:ring-forest";

export default function ModulesManager({ modules }: { modules: Module[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Module | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    nom: "",
    description: "",
    duree_heures: "",
  });

  function openCreate() {
    setEditing(null);
    setForm({ nom: "", description: "", duree_heures: "" });
    setOpen(true);
  }

  function openEdit(m: Module) {
    setEditing(m);
    setForm({
      nom: m.nom,
      description: m.description ?? "",
      duree_heures: String(m.duree_heures),
    });
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const input = {
      nom: form.nom,
      description: form.description || null,
      duree_heures: Number(form.duree_heures) || 0,
    };
    try {
      if (editing) {
        await updateModule(editing.id, input);
      } else {
        await createModule(input);
      }
      setOpen(false);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(m: Module) {
    if (!confirm(`Supprimer le module « ${m.nom} » ?`)) return;
    try {
      await deleteModule(m.id);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur inattendue");
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-end">
        <button onClick={openCreate} className={btnPrimary}>
          <Plus size={16} />
          Ajouter un module
        </button>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-slate">
              <th className="px-4 py-3 font-medium">Nom</th>
              <th className="px-4 py-3 font-medium">Description</th>
              <th className="px-4 py-3 font-medium">Durée (h)</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {modules.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-6 text-center text-sm text-slate"
                >
                  Aucun module. Cliquez sur « Ajouter un module ».
                </td>
              </tr>
            ) : (
              modules.map((m) => (
                <tr key={m.id} className="border-t border-border transition-colors hover:bg-mint/50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/modules/${m.id}`}
                      className="font-medium text-ink hover:text-forest focus:outline-none focus:ring-2 focus:ring-forest"
                    >
                      {m.nom}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate">{m.description ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-slate">
                    {m.duree_heures}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <KebabMenu
                      items={[
                        { label: "Modifier", onClick: () => openEdit(m), icon: Pencil },
                        {
                          label: "Supprimer",
                          onClick: () => handleDelete(m),
                          danger: true,
                          icon: Trash2,
                        },
                      ]}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-xl font-bold text-ink">
              {editing ? "Modifier le module" : "Ajouter un module"}
            </h2>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label htmlFor="nom" className="block text-sm font-medium text-ink">
                  Nom
                </label>
                <input
                  id="nom"
                  required
                  value={form.nom}
                  onChange={(e) => setForm({ ...form, nom: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-ink"
                >
                  Description
                </label>
                <textarea
                  id="description"
                  rows={3}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label
                  htmlFor="duree"
                  className="block text-sm font-medium text-ink"
                >
                  Durée (heures)
                </label>
                <input
                  id="duree"
                  type="number"
                  min={0}
                  required
                  value={form.duree_heures}
                  onChange={(e) =>
                    setForm({ ...form, duree_heures: e.target.value })
                  }
                  className={inputClass}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm text-slate hover:bg-slate/10 focus:outline-none focus:ring-2 focus:ring-forest"
                >
                  <X size={16} />
                  Annuler
                </button>
                <button type="submit" disabled={busy} className={btnPrimary}>
                  {busy ? (
                    "Enregistrement…"
                  ) : (
                    <>
                      <Save size={16} />
                      Enregistrer
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
