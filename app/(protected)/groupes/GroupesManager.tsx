"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createGroupe, type Groupe } from "@/app/actions/groupes";
import type { Module } from "@/app/actions/modules";
import { Plus, X } from "lucide-react";

const inputClass =
  "mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-ink focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest";
const btnPrimary =
  "inline-flex items-center gap-1.5 rounded-lg bg-forest px-4 py-2 text-sm font-medium text-white hover:bg-forest/90 focus:outline-none focus:ring-2 focus:ring-forest";

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR");
}

export default function GroupesManager({
  groupes,
  modules,
}: {
  groupes: Groupe[];
  modules: Module[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    nom: "",
    date_debut: "",
    date_fin: "",
  });
  const [selectedModules, setSelectedModules] = useState<string[]>([]);

  function toggleModule(id: string) {
    setSelectedModules((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await createGroupe({
        nom: form.nom,
        date_debut: form.date_debut || undefined,
        date_fin: form.date_fin || undefined,
        module_ids: selectedModules,
      });
      setOpen(false);
      setForm({ nom: "", date_debut: "", date_fin: "" });
      setSelectedModules([]);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-end">
        <button onClick={() => setOpen(true)} className={btnPrimary}>
          <Plus size={16} />
          Créer un groupe
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groupes.length === 0 ? (
          <p className="col-span-full text-center text-sm text-slate">
            Aucun groupe. Cliquez sur « Créer un groupe ».
          </p>
        ) : (
          groupes.map((g) => (
            <Link
              key={g.id}
              href={`/groupes/${g.id}`}
              className="rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4 transition-colors hover:border-forest/50 focus:outline-none focus:ring-2 focus:ring-forest"
            >
              <h2 className="font-display text-xl font-bold text-ink">
                {g.nom}
              </h2>
              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate">Début</dt>
                  <dd className="font-mono text-ink">
                    {formatDate(g.date_debut)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate">Fin</dt>
                  <dd className="font-mono text-ink">{formatDate(g.date_fin)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate">Stagiaires</dt>
                  <dd className="font-mono text-ink">
                    {g.stagiaires?.[0]?.count ?? 0}
                  </dd>
                </div>
              </dl>
            </Link>
          ))
        )}
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-xl font-bold text-ink">
              Créer un groupe
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="date_debut"
                    className="block text-sm font-medium text-ink"
                  >
                    Date de début
                  </label>
                  <input
                    id="date_debut"
                    type="date"
                    value={form.date_debut}
                    onChange={(e) =>
                      setForm({ ...form, date_debut: e.target.value })
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label
                    htmlFor="date_fin"
                    className="block text-sm font-medium text-ink"
                  >
                    Date de fin
                  </label>
                  <input
                    id="date_fin"
                    type="date"
                    value={form.date_fin}
                    onChange={(e) =>
                      setForm({ ...form, date_fin: e.target.value })
                    }
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <span className="block text-sm font-medium text-ink">
                  Modules suivis
                </span>
                {modules.length === 0 ? (
                  <p className="mt-1 text-xs text-slate">
                    Aucun module disponible. Créez d&apos;abord des modules dans
                    la page Modules.
                  </p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {modules.map((m) => (
                      <label
                        key={m.id}
                        className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm hover:border-forest/50"
                      >
                        <input
                          type="checkbox"
                          checked={selectedModules.includes(m.id)}
                          onChange={() => toggleModule(m.id)}
                          className="h-4 w-4 accent-forest"
                        />
                        <span className="text-ink">{m.nom}</span>
                        <span className="ml-auto font-mono text-xs text-slate">
                          {m.duree_heures}h
                        </span>
                      </label>
                    ))}
                  </div>
                )}
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
                    "Création…"
                  ) : (
                    <>
                      <Plus size={16} />
                      Créer
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
