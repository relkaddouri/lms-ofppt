"use client";

import { useEffect, useState } from "react";
import { FlaskConical, Mail, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import { inputStyles } from "@/components/ui/Input";
import { ConfirmModal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import {
  creerCompteDeTest,
  getCompteDeTest,
  inviterStagiaire,
  supprimerCompteDeTest,
  type CompteDeTest as Compte,
  type ResultatInvitation,
} from "@/app/actions/invitations";

/**
 * Le compte de test du formateur pour ce groupe (migration 093).
 *
 * Il sert à passer un contrôle exactement comme un stagiaire, avant de
 * l'ouvrir au groupe : il voit les brouillons et les tests non ouverts, et
 * n'apparaît dans aucune liste. Le lien pour choisir le mot de passe part à
 * l'adresse donnée ici — celle du formateur, avec un suffixe — : personne
 * d'autre ne le voit.
 */
export default function CompteDeTest({ groupeId }: { groupeId: string }) {
  const toast = useToast();
  const [compte, setCompte] = useState<Compte | null | undefined>(undefined);
  const [email, setEmail] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState<ResultatInvitation | null>(null);
  const [confirmeSuppression, setConfirmeSuppression] = useState(false);

  async function charger() {
    const r = await getCompteDeTest(groupeId);
    setCompte(r.compte);
    if (!r.compte && r.suggestion) setEmail((e) => e || r.suggestion!);
  }

  useEffect(() => {
    charger().catch((e) =>
      toast(e instanceof Error ? e.message : "Chargement impossible", "error"),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupeId]);

  async function creer() {
    setEnCours(true);
    try {
      const r = await creerCompteDeTest(groupeId, email);
      setResultat(r);
      if (r.ok) await charger();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Création impossible", "error");
    } finally {
      setEnCours(false);
    }
  }

  async function renvoyer() {
    if (!compte) return;
    setEnCours(true);
    try {
      setResultat(await inviterStagiaire(compte.id));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Envoi impossible", "error");
    } finally {
      setEnCours(false);
    }
  }

  async function supprimer() {
    setEnCours(true);
    try {
      await supprimerCompteDeTest(groupeId);
      setConfirmeSuppression(false);
      setResultat(null);
      setCompte(null);
      await charger();
      toast("Compte de test supprimé.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Suppression impossible", "error");
    } finally {
      setEnCours(false);
    }
  }

  if (compte === undefined) return null;

  return (
    <section className="mt-8 flex flex-col gap-3 rounded-[14px] border border-dashed border-border-strong bg-paper-alt px-5 py-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-wash-strong text-slate-2">
          <FlaskConical className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="font-display text-[16px] font-semibold text-ink">
            Compte de test
          </h2>
          <p className="text-[13.5px] leading-relaxed text-slate-2">
            Pour passer vous-même un contrôle comme un stagiaire avant de le
            lancer. Il ne figure dans aucune liste, aucun appel, aucune
            statistique ; il voit les contrôles en brouillon et les tests non
            ouverts. Connectez-vous-y dans une fenêtre de navigation privée,
            pour garder votre session de formateur.
          </p>
        </div>
      </div>

      {compte ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pl-12">
          <span className="text-[14px] text-body">
            <span className="font-mono">{compte.email}</span>
            <span className="ml-2 text-slate">
              {compte.dejaConnecte
                ? "· mot de passe choisi, prêt à servir"
                : "· en attente : ouvrez le lien reçu pour choisir le mot de passe"}
            </span>
          </span>
          <span className="ml-auto flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              icon={Mail}
              onClick={renvoyer}
              disabled={enCours}
            >
              {compte.dejaConnecte ? "Recevoir un lien de connexion" : "Renvoyer le lien"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={Trash2}
              onClick={() => setConfirmeSuppression(true)}
              disabled={enCours}
            >
              Supprimer
            </Button>
          </span>
        </div>
      ) : (
        <form
          className="flex flex-wrap items-end gap-2 pl-12"
          onSubmit={(e) => {
            e.preventDefault();
            void creer();
          }}
        >
          <label className="flex min-w-[260px] flex-1 flex-col gap-1">
            <span className="text-[12.5px] text-slate">
              Adresse du compte — le lien y sera envoyé
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputStyles}
            />
          </label>
          <Button type="submit" icon={FlaskConical} loading={enCours} disabled={enCours || !email.trim()}>
            Créer le compte de test
          </Button>
        </form>
      )}

      {resultat ? (
        <p
          className={`ml-12 rounded-[10px] border px-3 py-2 text-[13.5px] ${
            resultat.ok
              ? "border-tint-green bg-success-wash text-green-dark"
              : "border-tint-alert-strong bg-alert-wash text-coral-dark"
          }`}
        >
          {resultat.ok
            ? resultat.envoi.envoye
              ? `Lien envoyé à ${resultat.email}. Ouvrez-le dans une fenêtre privée et choisissez le mot de passe du compte de test.`
              : `Le compte est prêt, mais le courriel n'est pas parti (${resultat.envoi.raison}). Réessayez avec « Renvoyer le lien ».`
            : resultat.raison}
        </p>
      ) : null}

      <ConfirmModal
        open={confirmeSuppression}
        onClose={() => setConfirmeSuppression(false)}
        onConfirm={() => void supprimer()}
        busy={enCours}
        title="Supprimer le compte de test ?"
        message="Le compte, ses copies de test et son accès sont supprimés. Vous pourrez en recréer un."
      />
    </section>
  );
}
