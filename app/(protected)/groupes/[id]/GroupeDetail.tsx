"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  addStagiaire,
  updateStagiaire,
  removeStagiaire,
  type Stagiaire,
} from "@/app/actions/stagiaires";
import StagiaireCsvImport from "./StagiaireCsvImport";
import KebabMenu from "@/components/KebabMenu";
import { useToast } from "@/components/ui/Toast";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { initials } from "@/lib/format";
import { Check, Mail, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import {
  inviterStagiaire,
  type ResultatInvitation,
} from "@/app/actions/invitations";
import Modal from "@/components/ui/Modal";
import { inputStyles as inputClass } from "@/components/ui/Input";

export default function GroupeDetail({
  groupeId,
  stagiaires,
}: {
  groupeId: string;
  stagiaires: Stagiaire[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  // Le type vient de l'action et n'est pas recopié : la forme locale avait
  // déjà divergé une fois, et rien ne l'avait signalé tant que personne
  // n'ajoutait de champ.
  const [invitation, setInvitation] = useState<ResultatInvitation | null>(null);

  async function inviter(stagiaireId: string) {
    try {
      setInvitation(await inviterStagiaire(stagiaireId));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Invitation impossible.", "error");
    }
  }
  const [editingId, setEditingId] = useState<string | null>(null);
  const [ajoutOuvert, setAjoutOuvert] = useState(false);
  const [form, setForm] = useState({ nom: "", prenom: "", email: "", cef: "" });
  const [editForm, setEditForm] = useState({
    nom: "",
    prenom: "",
    email: "",
    cef: "",
  });
  const toast = useToast();

  /** Une modale fermée ne retient rien de la saisie abandonnée. */
  function fermerAjout() {
    if (busy) return;
    setAjoutOuvert(false);
    setForm({ nom: "", prenom: "", email: "", cef: "" });
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await addStagiaire(groupeId, {
        nom: form.nom,
        prenom: form.prenom,
        email: form.email || undefined,
        cef: form.cef || undefined,
      });
      setForm({ nom: "", prenom: "", email: "", cef: "" });
      setAjoutOuvert(false);
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
      cef: s.cef ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function handleUpdate(id: string) {
    setBusy(true);
    try {
      await updateStagiaire(id, groupeId, {
        nom: editForm.nom,
        prenom: editForm.prenom,
        email: editForm.email || undefined,
        cef: editForm.cef || undefined,
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-display text-xl font-bold text-ink">Stagiaires</h2>
        <Button icon={Plus} onClick={() => setAjoutOuvert(true)}>
          Ajouter un stagiaire
        </Button>
      </div>

      {/* Ajouter un stagiaire est un geste ponctuel : le formulaire déplié en
          permanence poussait la liste — ce qu'on vient consulter — sous la
          ligne de flottaison. L'import CSV reste à part : il a son propre
          aperçu avant confirmation. */}
      <Modal
        open={ajoutOuvert}
        onClose={fermerAjout}
        title="Ajouter un stagiaire"
        description="Le CEF suffit à lui donner accès à son espace."
      >
        <form onSubmit={handleAdd} className="space-y-4">
          <Input
            id="cef"
            label="CEF"
            inputMode="numeric"
            autoFocus
            hint="Identifiant OFPPT, sert à se connecter"
            value={form.cef}
            onChange={(e) => setForm({ ...form, cef: e.target.value })}
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
          </div>
          <Input
            id="email"
            label="Email"
            type="email"
            hint="Facultatif — le CEF suffit pour se connecter."
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <div className="flex justify-end gap-3 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={fermerAjout}
              disabled={busy}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              icon={Plus}
              loading={busy}
              loadingLabel="Ajout…"
            >
              Ajouter
            </Button>
          </div>
        </form>
      </Modal>

      <StagiaireCsvImport groupeId={groupeId} />

        <div className="mt-4 overflow-hidden rounded-[14px] border border-border bg-surface shadow-repos">
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
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                          <Input
                            value={editForm.cef}
                            onChange={(e) =>
                              setEditForm({ ...editForm, cef: e.target.value })
                            }
                            placeholder="CEF"
                            inputMode="numeric"
                          />
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
                      className="border-t border-border transition-colors hover:bg-wash/50"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-wash text-xs font-semibold text-ink focus-visible:ring-2 focus-visible:ring-mint">
                            {initials(s.prenom, s.nom)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-ink">
                              {s.prenom} {s.nom}
                            </p>
                            <p className="truncate text-xs text-slate">
                              {/* Le CEF passe devant : c'est lui que le
                                  formateur retrouve dans ses listes. */}
                              {s.cef ? (
                                <span className="font-mono text-slate-2">
                                  {s.cef}
                                </span>
                              ) : null}
                              {s.cef && s.email ? " · " : ""}
                              {s.email ?? (s.cef ? "" : "—")}
                              {s.user_id ? (
                                <span className="ml-1.5 text-green-dark">
                                  · compte actif
                                </span>
                              ) : null}
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
                                label: s.user_id
                                  ? "Renvoyer le lien d'accès"
                                  : "Inviter",
                                onClick: () => inviter(s.id),
                                icon: Mail,
                              },
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

      <Modal
        open={invitation !== null}
        onClose={() => setInvitation(null)}
        title={
          invitation?.envoi.envoye
            ? invitation.existant
              ? "Nouveau lien envoyé"
              : "Stagiaire invité"
            : "Lien à transmettre vous-même"
        }
        description={
          invitation?.envoi.envoye
            ? `Le lien est parti à ${invitation.email}. Le stagiaire choisira lui-même son mot de passe — vous ne le connaîtrez jamais.`
            : `Le compte est bien créé, mais le courriel n'est pas parti. Transmettez ce lien à ${invitation?.email ?? ""} par un autre moyen.`
        }
      >
        {/* Ne jamais laisser croire qu'un courriel est parti quand il ne
            l'est pas : le formateur agirait sur une invitation fantôme. La
            raison est celle du service d'envoi, telle quelle. */}
        {invitation && !invitation.envoi.envoye ? (
          <p className="mb-3 rounded-xl border border-tint-alert-strong bg-alert-wash px-3 py-2 text-sm text-coral-dark">
            Envoi impossible : {invitation.envoi.raison}
          </p>
        ) : null}
        <div className="flex gap-2">
          <input
            readOnly
            value={invitation?.lien ?? ""}
            aria-label="Lien d'invitation"
            onFocus={(e) => e.currentTarget.select()}
            className={inputClass}
          />
          <Button
            variant="secondary"
            onClick={() => {
              navigator.clipboard.writeText(invitation?.lien ?? "");
              toast("Lien copié");
            }}
          >
            Copier
          </Button>
        </div>
        <p className="mt-2 text-xs text-slate">
          Ce lien ouvre une session : ne le publiez pas, transmettez-le
          directement au stagiaire concerné.
          {invitation?.envoi.envoye
            ? " Il est conservé ici au cas où le courriel n'arriverait pas."
            : ""}
        </p>
      </Modal>
        </div>
    </section>
  );
}
