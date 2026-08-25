"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  addStagiaire,
  updateStagiaire,
  removeStagiaire,
  type Stagiaire,
} from "@/app/actions/stagiaires";
import type { Groupe } from "@/app/actions/groupes";
import StagiaireCsvImport from "./StagiaireCsvImport";
import KebabMenu from "@/components/KebabMenu";
import { useToast } from "@/components/ui/Toast";
import { Check, Pencil, Plus, Save, Trash2, X } from "lucide-react";

const inputClass =
  "mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-ink focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest";
const btnPrimary =
  "inline-flex items-center gap-1.5 rounded-lg bg-forest px-4 py-2 text-sm font-medium text-white hover:bg-forest/90 focus:outline-none focus:ring-2 focus:ring-forest";
const btnDangerSolid =
  "inline-flex items-center gap-1.5 rounded-lg bg-danger px-3 py-1.5 text-xs font-medium text-white hover:bg-danger/90 focus:outline-none focus:ring-2 focus:ring-danger";
const btnGhost =
  "inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-slate hover:bg-slate/10 focus:outline-none focus:ring-2 focus:ring-forest";

function initials(prenom: string, nom: string) {
  const a = prenom.trim().charAt(0);
  const b = nom.trim().charAt(0);
  const out = `${a}${b}`.toUpperCase();
  return out || "?";
}

export default function GroupeDetail({
  groupe,
  stagiaires,
}: {
  groupe: Groupe;
  stagiaires: Stagiaire[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ nom: "", prenom: "", email: "" });
  const [editForm, setEditForm] = useState({ nom: "", prenom: "", email: "" });
  const toast = useToast();

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await addStagiaire(groupe.id, {
        nom: form.nom,
        prenom: form.prenom,
        email: form.email || undefined,
      });
      setForm({ nom: "", prenom: "", email: "" });
      toast("Stagiaire ajouté");
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(id: string) {
    try {
      await removeStagiaire(id);
      setConfirmId(null);
      toast("Stagiaire supprimé");
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur inattendue");
    }
  }

  function startEdit(s: Stagiaire) {
    setEditingId(s.id);
    setConfirmId(null);
    setEditForm({
      nom: s.nom,
      prenom: s.prenom,
      email: s.email ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function handleUpdate(id: string) {
    setBusy(true);
    try {
      await updateStagiaire(id, groupe.id, {
        nom: editForm.nom,
        prenom: editForm.prenom,
        email: editForm.email || undefined,
      });
      setEditingId(null);
      toast("Modification enregistrée");
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6">
      <h2 className="font-display text-xl font-bold text-ink">
        Stagiaires
      </h2>

      <div className="mt-4 max-w-[640px] rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4">
        <h3 className="text-sm font-medium text-ink">Ajout rapide</h3>
        <form
          onSubmit={handleAdd}
          className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr_1.5fr_auto]"
        >
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
                htmlFor="prenom"
                className="block text-sm font-medium text-ink"
              >
                Prénom
              </label>
              <input
                id="prenom"
                required
                value={form.prenom}
                onChange={(e) => setForm({ ...form, prenom: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-ink"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={inputClass}
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={busy}
                className={`${btnPrimary} w-full md:w-auto`}
              >
                {busy ? (
                  "Ajout…"
                ) : (
                  <>
                    <Plus size={16} />
                    Ajouter
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        <StagiaireCsvImport groupeId={groupe.id} />

        <div className="mt-4 overflow-hidden rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-paper text-xs uppercase tracking-wide text-slate">
                <th className="px-4 py-3 font-medium">Stagiaire</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {stagiaires.length === 0 ? (
                <tr>
                  <td
                    colSpan={2}
                    className="px-4 py-10 text-center text-sm text-slate"
                  >
                    Aucun stagiaire dans ce groupe. Ajoutez-le manuellement ou
                    importez un CSV.
                  </td>
                </tr>
              ) : (
                stagiaires.map((s) =>
                  editingId === s.id ? (
                    <tr key={s.id} className="border-t border-border bg-paper">
                      <td className="px-4 py-3">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <input
                            value={editForm.nom}
                            onChange={(e) =>
                              setEditForm({ ...editForm, nom: e.target.value })
                            }
                            placeholder="Nom"
                            className={inputClass}
                          />
                          <input
                            value={editForm.prenom}
                            onChange={(e) =>
                              setEditForm({ ...editForm, prenom: e.target.value })
                            }
                            placeholder="Prénom"
                            className={inputClass}
                          />
                          <input
                            type="email"
                            value={editForm.email}
                            onChange={(e) =>
                              setEditForm({ ...editForm, email: e.target.value })
                            }
                            placeholder="Email"
                            className={inputClass}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleUpdate(s.id)}
                          disabled={busy}
                          className={`${btnPrimary} mr-2`}
                        >
                          <Save size={16} />
                          Enregistrer
                        </button>
                        <button onClick={cancelEdit} className={btnGhost}>
                          <X size={16} />
                          Annuler
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr
                      key={s.id}
                      className="border-t border-border transition-colors hover:bg-mint/50"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-mint text-xs font-semibold text-forest focus-visible:ring-2 focus-visible:ring-mint">
                            {initials(s.prenom, s.nom)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-ink">
                              {s.prenom} {s.nom}
                            </p>
                            <p className="truncate text-xs text-slate">
                              {s.email ?? "—"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {confirmId === s.id ? (
                          <span className="inline-flex items-center gap-2">
                            <span className="text-xs text-slate">
                              Supprimer ?
                            </span>
                            <button
                              onClick={() => handleRemove(s.id)}
                              className={btnDangerSolid}
                            >
                              <Check size={16} />
                              Confirmer
                            </button>
                            <button
                              onClick={() => setConfirmId(null)}
                              className={btnGhost}
                            >
                              <X size={16} />
                              Annuler
                            </button>
                          </span>
                        ) : (
                          <KebabMenu
                            items={[
                              {
                                label: "Modifier",
                                onClick: () => startEdit(s),
                                icon: Pencil,
                              },
                              {
                                label: "Supprimer",
                                onClick: () => setConfirmId(s.id),
                                danger: true,
                                icon: Trash2,
                              },
                            ]}
                          />
                        )}
                      </td>
                    </tr>
                  ),
                )
              )}
            </tbody>
          </table>
        </div>
    </section>
  );
}
