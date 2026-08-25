"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createGroupe, type Groupe } from "@/app/actions/groupes";
import type { Module } from "@/app/actions/modules";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/format";
import { Plus, X } from "lucide-react";

export default function GroupesManager({
  groupes,
  modules,
}: {
  groupes: Groupe[];
  modules: Module[];
}) {
  const router = useRouter();
  const toast = useToast();
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
      toast("Groupe créé");
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
        <Button icon={Plus} onClick={() => setOpen(true)}>
          Créer un groupe
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groupes.length === 0 ? (
          <p className="col-span-full text-center text-sm text-slate">
            Aucun groupe. Cliquez sur « Créer un groupe ».
          </p>
        ) : (
          groupes.map((g) => (
            <Card key={g.id} padded={false} className="transition-colors hover:border-forest/50">
              <Link
                href={`/groupes/${g.id}`}
                className="block rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-forest"
              >
                <h2 className="font-display text-xl font-bold text-ink">
                  {g.nom}
                </h2>
                <dl className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-slate">Début</dt>
                    <dd className="font-mono text-ink">{formatDate(g.date_debut)}</dd>
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
            </Card>
          ))
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Créer un groupe">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="nom"
            label="Nom"
            required
            value={form.nom}
            onChange={(e) => setForm({ ...form, nom: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="date_debut"
              label="Date de début"
              type="date"
              value={form.date_debut}
              onChange={(e) => setForm({ ...form, date_debut: e.target.value })}
            />
            <Input
              id="date_fin"
              label="Date de fin"
              type="date"
              value={form.date_fin}
              onChange={(e) => setForm({ ...form, date_fin: e.target.value })}
            />
          </div>

          <div>
            <span className="block text-sm font-medium text-ink">
              Modules suivis
            </span>
            {modules.length === 0 ? (
              <p className="mt-1 text-xs text-slate">
                Aucun module disponible. Créez d&apos;abord des modules dans la
                page Modules.
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
                      {m.duree_reference}h
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" icon={X} onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button
              type="submit"
              icon={Plus}
              loading={busy}
              loadingLabel="Création…"
            >
              Créer
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
