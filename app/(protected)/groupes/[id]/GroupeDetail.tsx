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
import PhotoStagiaire from "@/components/PhotoStagiaire";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Check, Mail, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import {
  inviterStagiaire,
  inviterGroupe,
  type ResultatInvitation,
  type ResultatInvitationGroupe,
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
  const [envoiGroupe, setEnvoiGroupe] =
    useState<ResultatInvitationGroupe | null>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  async function inviterTous() {
    setEnvoiEnCours(true);
    try {
      setEnvoiGroupe(await inviterGroupe(groupeId));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Envoi impossible.", "error");
    } finally {
      setEnvoiEnCours(false);
    }
  }

  async function inviter(stagiaireId: string) {
    try {
      setInvitation(await inviterStagiaire(stagiaireId));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Invitation impossible.", "error");
    }
  }
  const [editingId, setEditingId] = useState<string | null>(null);
  const [ajoutOuvert, setAjoutOuvert] = useState(false);
  const [form, setForm] = useState({ nom: "", prenom: "", email: "", cef: "", cne: "" });
  const [editForm, setEditForm] = useState({
    nom: "",
    prenom: "",
    email: "",
    cef: "",
    cne: "",
  });
  const toast = useToast();

  /** Une modale fermée ne retient rien de la saisie abandonnée. */
  function fermerAjout() {
    if (busy) return;
    setAjoutOuvert(false);
    setForm({ nom: "", prenom: "", email: "", cef: "", cne: "" });
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
        cne: form.cne || undefined,
      });
      setForm({ nom: "", prenom: "", email: "", cef: "", cne: "" });
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
      cne: s.cne ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function handleUpdate(id: string) {
    setBusy(true);
    try {
      const { avertissement } = await updateStagiaire(id, groupeId, {
        nom: editForm.nom,
        prenom: editForm.prenom,
        email: editForm.email || undefined,
        cef: editForm.cef || undefined,
        cne: editForm.cne || undefined,
      });
      setEditingId(null);
      // Le renommage du compte peut échouer là où la fiche passe : le dire,
      // sinon la divergence ne se découvrirait qu'au prochain envoi de lien.
      if (avertissement) toast(avertissement, "error");
      else toast("Modification enregistrée");
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
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Les envois sont étalés à deux par seconde côté serveur : sur un
              groupe entier l'action dure plusieurs secondes, d'où le libellé
              d'attente plutôt qu'un bouton qui semble ne rien faire. */}
          <Button
            variant="secondary"
            icon={Mail}
            onClick={inviterTous}
            loading={envoiEnCours}
            loadingLabel="Envoi en cours…"
            disabled={stagiaires.length === 0}
          >
            Envoyer le lien à tout le monde
          </Button>
          <Button icon={Plus} onClick={() => setAjoutOuvert(true)}>
            Ajouter un stagiaire
          </Button>
        </div>
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
          {/* Les deux identifiants côte à côte : ils se recopient d'un même
              document et se vérifient l'un contre l'autre. */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              id="cef"
              label="CEF"
              inputMode="numeric"
              autoFocus
              hint="Identifiant OFPPT, sert à se connecter"
              value={form.cef}
              onChange={(e) => setForm({ ...form, cef: e.target.value })}
            />
            <Input
              id="cne"
              label="CNE"
              inputMode="numeric"
              hint="Code national, pour les pièces officielles"
              value={form.cne}
              onChange={(e) => setForm({ ...form, cne: e.target.value })}
            />
          </div>
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
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                          <Input
                            value={editForm.cef}
                            onChange={(e) =>
                              setEditForm({ ...editForm, cef: e.target.value })
                            }
                            placeholder="CEF"
                            inputMode="numeric"
                          />
                          <Input
                            value={editForm.cne}
                            onChange={(e) =>
                              setEditForm({ ...editForm, cne: e.target.value })
                            }
                            placeholder="CNE"
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
                          {/* La photo est cliquable : le formateur la dépose
                              pour un stagiaire qui n'a pas de compte, ou pas
                              de téléphone sous la main. C'est le même dépôt
                              que le sien, borné par la même policy. */}
                          <PhotoStagiaire
                            stagiaireId={s.id}
                            prenom={s.prenom}
                            nom={s.nom}
                            photo={s.photo}
                            taille="md"
                            compact
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-ink">
                              {s.prenom} {s.nom}
                            </p>
                            <p className="truncate text-xs text-slate">
                              {/* Le CEF passe devant : c'est lui que le
                                  formateur retrouve dans ses listes. Le CNE
                                  suit, en retrait, parce qu'il ne sert qu'aux
                                  pièces qui sortent de l'établissement. */}
                              {s.cef ? (
                                <span className="font-mono text-slate-2">
                                  {s.cef}
                                </span>
                              ) : null}
                              {s.cne ? (
                                <span className="font-mono text-slate-light">
                                  {s.cef ? " · " : ""}
                                  CNE {s.cne}
                                </span>
                              ) : null}
                              {(s.cef || s.cne) && s.email ? " · " : ""}
                              {s.email ?? (s.cef || s.cne ? "" : "—")}
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

      {/* Le compte rendu d'un envoi groupé n'est pas « c'est parti » : sur
          quinze stagiaires, il y aura des adresses fausses et des comptes déjà
          actifs. Chaque catégorie est nommée, et chaque échec porte sa
          raison — la même que la modale unitaire affiche. */}
      <Modal
        open={envoiGroupe !== null}
        onClose={() => setEnvoiGroupe(null)}
        title="Envoi des liens d'accès"
        description={
          envoiGroupe
            ? `${envoiGroupe.envoyes.length} lien${envoiGroupe.envoyes.length > 1 ? "s" : ""} envoyé${envoiGroupe.envoyes.length > 1 ? "s" : ""}` +
              (envoiGroupe.ignores.length
                ? ` · ${envoiGroupe.ignores.length} déjà connecté${envoiGroupe.ignores.length > 1 ? "s" : ""}`
                : "") +
              (envoiGroupe.echecs.length
                ? ` · ${envoiGroupe.echecs.length} en échec`
                : "")
            : ""
        }
      >
        {envoiGroupe ? (
          <div className="flex flex-col gap-4">
            {envoiGroupe.echecs.length > 0 ? (
              <div className="rounded-xl border border-tint-alert-strong bg-alert-wash px-3.5 py-3">
                <p className="text-sm font-semibold text-coral-dark">
                  Ces stagiaires n&apos;ont rien reçu
                </p>
                <ul className="mt-2 flex list-none flex-col gap-2 p-0">
                  {envoiGroupe.echecs.map((e) => (
                    <li key={e.qui} className="text-sm text-coral-dark">
                      <span className="font-medium">{e.qui}</span>
                      {e.email ? (
                        <span className="font-mono text-[12.5px]">
                          {" "}
                          · {e.email}
                        </span>
                      ) : null}
                      <span className="block text-[13px]">{e.raison}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {envoiGroupe.envoyes.length > 0 ? (
              <div>
                <p className="text-sm font-semibold text-body">
                  Liens envoyés
                </p>
                <p className="mt-1 text-[13.5px] text-slate-2">
                  {envoiGroupe.envoyes.join(", ")}
                </p>
              </div>
            ) : null}

            {envoiGroupe.ignores.length > 0 ? (
              <div>
                <p className="text-sm font-semibold text-body">
                  Déjà connectés, non relancés
                </p>
                <p className="mt-1 text-[13.5px] text-slate-2">
                  {envoiGroupe.ignores.join(", ")}
                </p>
                <p className="mt-1 text-xs text-slate-light">
                  Leur lien d&apos;invitation a déjà servi. Pour un mot de
                  passe oublié, invitez-les individuellement.
                </p>
              </div>
            ) : null}

            {envoiGroupe.envoyes.length === 0 &&
            envoiGroupe.echecs.length === 0 ? (
              <p className="text-sm text-slate">
                Tout le monde s&apos;est déjà connecté — personne à relancer.
              </p>
            ) : null}
          </div>
        ) : null}
      </Modal>

      {/* Trois états, et non deux : le lien est parti, le compte est ouvert
          mais le courriel n'est pas parti, ou l'invitation n'a pas abouti du
          tout. Le troisième passait auparavant par une exception, que Next
          masque en production — le formateur lisait « Minified React error
          #441 » au lieu du nom du problème. */}
      <Modal
        open={invitation !== null}
        onClose={() => setInvitation(null)}
        title={
          !invitation
            ? ""
            : !invitation.ok
              ? "Invitation impossible"
              : invitation.envoi.envoye
                ? invitation.existant
                  ? "Nouveau lien envoyé"
                  : "Stagiaire invité"
                : "Lien à transmettre vous-même"
        }
        description={
          !invitation
            ? ""
            : !invitation.ok
              ? `Rien n'a changé pour ${invitation.qui} : aucun courriel n'est parti, et son compte est resté tel quel.`
              : invitation.envoi.envoye
                ? `Le lien est parti à ${invitation.email}. Le stagiaire choisira lui-même son mot de passe — vous ne le connaîtrez jamais.`
                : `Le compte est bien créé, mais le courriel n'est pas parti. Transmettez ce lien à ${invitation.email} par un autre moyen.`
        }
      >
        {invitation && !invitation.ok ? (
          <div className="rounded-xl border border-tint-alert-strong bg-alert-wash px-3.5 py-3">
            {invitation.email ? (
              <p className="font-mono text-[12.5px] text-coral-dark">
                {invitation.email}
              </p>
            ) : null}
            <p className="mt-1 text-sm text-coral-dark">{invitation.raison}</p>
          </div>
        ) : invitation ? (
          <>
            {/* Ne jamais laisser croire qu'un courriel est parti quand il ne
                l'est pas : le formateur agirait sur une invitation fantôme.
                La raison est celle du service d'envoi, telle quelle. */}
            {!invitation.envoi.envoye ? (
              <p className="mb-3 rounded-xl border border-tint-alert-strong bg-alert-wash px-3 py-2 text-sm text-coral-dark">
                Envoi impossible : {invitation.envoi.raison}
              </p>
            ) : null}
            <div className="flex gap-2">
              <input
                readOnly
                value={invitation.lien}
                aria-label="Lien d'invitation"
                onFocus={(e) => e.currentTarget.select()}
                className={inputClass}
              />
              <Button
                variant="secondary"
                onClick={() => {
                  navigator.clipboard.writeText(invitation.lien);
                  toast("Lien copié");
                }}
              >
                Copier
              </Button>
            </div>
            <p className="mt-2 text-xs text-slate">
              Ce lien ouvre une session : ne le publiez pas, transmettez-le
              directement au stagiaire concerné.
              {invitation.envoi.envoye
                ? " Il est conservé ici au cas où le courriel n'arriverait pas."
                : ""}
            </p>
          </>
        ) : null}
      </Modal>
        </div>
    </section>
  );
}
