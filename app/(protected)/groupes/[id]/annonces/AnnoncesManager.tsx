"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createAnnonce,
  deleteAnnonce,
  type Annonce,
} from "@/app/actions/annonces";
import { useToast } from "@/components/ui/Toast";
import Button from "@/components/ui/Button";
import Input, { Textarea } from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import { ConfirmModal } from "@/components/ui/Modal";
import { formatDate } from "@/lib/format";
import { Send, Trash2 } from "lucide-react";

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
  const [aSupprimer, setASupprimer] = useState<Annonce | null>(null);
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
      toast(err instanceof Error ? err.message : "Erreur inattendue", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!aSupprimer) return;
    setBusy(true);
    try {
      await deleteAnnonce(aSupprimer.id, groupeId);
      setASupprimer(null);
      toast("Annonce supprimée");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur inattendue", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Card className="mt-6 max-w-[640px]">
        <h2 className="text-sm font-medium text-ink">Publier une annonce</h2>
        <form onSubmit={handleSubmit} className="mt-3 space-y-4">
          <Input
            id="titre"
            label="Titre"
            required
            value={form.titre}
            onChange={(e) => setForm({ ...form, titre: e.target.value })}
          />
          <Textarea
            id="contenu"
            label="Contenu"
            rows={4}
            value={form.contenu}
            onChange={(e) => setForm({ ...form, contenu: e.target.value })}
          />
          <Input
            id="date"
            label="Date"
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
          <div className="flex justify-end">
            <Button
              type="submit"
              icon={Send}
              loading={busy}
              loadingLabel="Publication…"
            >
              Publier
            </Button>
          </div>
        </form>
      </Card>

      <div className="mt-6 space-y-4">
        {annonces.length === 0 ? (
          <Card className="p-6 text-center text-sm text-slate" padded={false}>
            Aucune annonce publiée.
          </Card>
        ) : (
          annonces.map((a) => (
            <Card key={a.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-display text-lg font-bold text-ink">
                    {a.titre}
                  </h3>
                  <p className="mt-0.5 font-mono text-xs text-slate">
                    {formatDate(a.date)}
                  </p>
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  icon={Trash2}
                  onClick={() => setASupprimer(a)}
                >
                  Supprimer
                </Button>
              </div>
              {a.contenu ? (
                <p className="mt-2 whitespace-pre-line text-sm text-ink">
                  {a.contenu}
                </p>
              ) : null}
            </Card>
          ))
        )}
      </div>

      <ConfirmModal
        open={aSupprimer !== null}
        onClose={() => setASupprimer(null)}
        onConfirm={handleDelete}
        busy={busy}
        title="Supprimer cette annonce ?"
        message={
          <>Supprimer définitivement «&nbsp;{aSupprimer?.titre}&nbsp;» ?</>
        }
      />
    </div>
  );
}
