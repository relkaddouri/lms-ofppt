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
import Button from "@/components/ui/Button";
import Input, { Textarea } from "@/components/ui/Input";
import Modal, { ConfirmModal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { Pencil, Plus, Save, Trash2, X } from "lucide-react";

export default function ModulesManager({ modules }: { modules: Module[] }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Module | null>(null);
  const [aSupprimer, setASupprimer] = useState<Module | null>(null);
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
        toast("Module modifié");
      } else {
        await createModule(input);
        toast("Module ajouté");
      }
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur inattendue", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!aSupprimer) return;
    setBusy(true);
    try {
      await deleteModule(aSupprimer.id);
      setASupprimer(null);
      toast("Module supprimé");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur inattendue", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-end">
        <Button icon={Plus} onClick={openCreate}>
          Ajouter un module
        </Button>
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
                          onClick: () => setASupprimer(m),
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

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Modifier le module" : "Ajouter un module"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="nom"
            label="Nom"
            required
            value={form.nom}
            onChange={(e) => setForm({ ...form, nom: e.target.value })}
          />
          <Textarea
            id="description"
            label="Description"
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <Input
            id="duree"
            label="Durée (heures)"
            type="number"
            min={0}
            required
            value={form.duree_heures}
            onChange={(e) => setForm({ ...form, duree_heures: e.target.value })}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" size="md" icon={X} onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button
              type="submit"
              icon={Save}
              loading={busy}
              loadingLabel="Enregistrement…"
            >
              Enregistrer
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={aSupprimer !== null}
        onClose={() => setASupprimer(null)}
        onConfirm={handleDelete}
        busy={busy}
        title="Supprimer ce module ?"
        message={
          <>
            Supprimer définitivement «&nbsp;{aSupprimer?.nom}&nbsp;» ? Les fiches,
            contrôles et séances rattachés seront également supprimés.
          </>
        }
      />
    </div>
  );
}
