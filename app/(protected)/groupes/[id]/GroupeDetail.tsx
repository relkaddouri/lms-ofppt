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
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import { initials } from "@/lib/format";
import { Check, Pencil, Plus, Save, Trash2, X } from "lucide-react";

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
      toast(err instanceof Error ? err.message : "Erreur inattendue", "error");
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
      toast(err instanceof Error ? err.message : "Erreur inattendue", "error");
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
      toast(err instanceof Error ? err.message : "Erreur inattendue", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6">
      <h2 className="font-display text-xl font-bold text-ink">
        Stagiaires
      </h2>

      <Card className="mt-4 max-w-[640px]">
        <h3 className="text-sm font-medium text-ink">Ajout rapide</h3>
        <form
          onSubmit={handleAdd}
          className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr_1.5fr_auto]"
        >
            <Input
              id="nom"
              label="Nom"
              required
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
            />
            <Input
              id="prenom"
              label="Prénom"
              required
              value={form.prenom}
              onChange={(e) => setForm({ ...form, prenom: e.target.value })}
            />
            <Input
              id="email"
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <div className="flex items-end">
              <Button
                type="submit"
                icon={Plus}
                loading={busy}
                loadingLabel="Ajout…"
                className="w-full md:w-auto"
              >
                Ajouter
              </Button>
            </div>
          </form>
        </Card>

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
                          <Input
                            value={editForm.nom}
                            onChange={(e) =>
                              setEditForm({ ...editForm, nom: e.target.value })
                            }
                            placeholder="Nom"
                          />
                          <Input
                            value={editForm.prenom}
                            onChange={(e) =>
                              setEditForm({ ...editForm, prenom: e.target.value })
                            }
                            placeholder="Prénom"
                          />
                          <Input
                            type="email"
                            value={editForm.email}
                            onChange={(e) =>
                              setEditForm({ ...editForm, email: e.target.value })
                            }
                            placeholder="Email"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          icon={Save}
                          onClick={() => handleUpdate(s.id)}
                          disabled={busy}
                          className="mr-2"
                        >
                          Enregistrer
                        </Button>
                        <Button variant="ghost" size="sm" icon={X} onClick={cancelEdit}>
                          Annuler
                        </Button>
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
                            <Button
                              variant="danger"
                              size="sm"
                              icon={Check}
                              onClick={() => handleRemove(s.id)}
                            >
                              Confirmer
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={X}
                              onClick={() => setConfirmId(null)}
                            >
                              Annuler
                            </Button>
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
