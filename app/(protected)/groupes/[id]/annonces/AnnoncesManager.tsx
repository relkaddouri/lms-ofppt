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
import Modal, { ConfirmModal } from "@/components/ui/Modal";
import { formatDate } from "@/lib/format";
import { Megaphone, Plus, Send, Trash2 } from "lucide-react";

const VIDE = { titre: "", contenu: "", date: "" };

/**
 * Annonces d'un groupe.
 *
 * Le formulaire est passé en modale : publier une annonce est un geste
 * occasionnel, et le laisser déplié en permanence poussait la liste — la seule
 * chose qu'on vient consulter la plupart du temps — sous la ligne de flottaison.
 */
export default function AnnoncesManager({
  groupeId,
  annonces,
}: {
  groupeId: string;
  annonces: Annonce[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [ouvert, setOuvert] = useState(false);
  const [form, setForm] = useState(VIDE);
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
      setForm(VIDE);
      setOuvert(false);
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

  // Une modale fermée ne doit rien retenir de la saisie abandonnée.
  function fermer() {
    if (busy) return;
    setOuvert(false);
    setForm(VIDE);
  }

  return (
    <div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-xl font-bold text-ink">Annonces</h2>
          <p className="text-[14.5px] text-slate-light">
            Ce que le groupe voit apparaître dans son fil.
          </p>
        </div>
        <Button icon={Plus} onClick={() => setOuvert(true)}>
          Nouvelle annonce
        </Button>
      </div>

      <div className="mt-5 flex flex-col gap-3.5">
        {annonces.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-[14px] border border-border bg-surface px-6 py-12 text-center shadow-repos">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-wash">
              <Megaphone size={20} className="text-slate-light" aria-hidden />
            </span>
            <p className="text-[15px] font-semibold text-ink">
              Aucune annonce publiée
            </p>
            <p className="max-w-[380px] text-[14px] text-slate-light">
              Une annonce apparaît dans le fil du groupe et reste consultable
              par les stagiaires.
            </p>
            <Button variant="secondary" icon={Plus} onClick={() => setOuvert(true)}>
              Publier la première
            </Button>
          </div>
        ) : (
          annonces.map((a) => (
            <article
              key={a.id}
              className="rounded-[14px] border border-border bg-surface p-[22px] shadow-repos"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-[3px]">
                  <h3 className="font-display text-[17px] font-semibold text-ink">
                    {a.titre}
                  </h3>
                  {/* La date est facultative à la saisie : sans elle, celle
                      de publication reste le repère juste. */}
                  <p className="font-mono text-[12.5px] text-slate-light">
                    {a.date
                      ? formatDate(a.date)
                      : `publiée le ${formatDate(a.created_at)}`}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Supprimer l'annonce « ${a.titre} »`}
                  onClick={() => setASupprimer(a)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-transparent text-coral-dark transition-colors duration-150 ease-out hover:border-tint-alert-strong hover:bg-alert-wash"
                >
                  <Trash2 size={15} aria-hidden />
                </button>
              </div>
              {a.contenu ? (
                <p className="mt-3 whitespace-pre-line text-[14.5px] leading-relaxed text-body">
                  {a.contenu}
                </p>
              ) : null}
            </article>
          ))
        )}
      </div>

      <Modal
        open={ouvert}
        onClose={fermer}
        title="Publier une annonce"
        description="Elle apparaîtra dans le fil du groupe."
      >
        <form id="form-annonce" onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="titre"
            label="Titre"
            required
            autoFocus
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
            hint="Facultative — la date de publication fait foi sans elle."
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={fermer} disabled={busy}>
              Annuler
            </Button>
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
      </Modal>

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
