"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { formatDateTime } from "@/lib/format";
import Avatar from "@/components/ui/Avatar";
import TexteMentions from "@/components/TexteMentions";
import ChampMention from "@/components/ChampMention";
import {
  commenter,
  supprimerCommentaire,
  type Commentaire,
  type Camarade,
} from "@/app/actions/fil";
import { Trash2 } from "lucide-react";

/**
 * Le fil de commentaires d'une annonce, des deux côtés.
 *
 * Il vivait dans `CarteAnnonce`, une page de l'espace stagiaire : le formateur
 * publiait donc des annonces sans jamais voir ce qu'on lui répondait. Le fil
 * est le même des deux côtés — mêmes commentaires, mêmes mentions, même
 * suppression — seul le contexte qui l'entoure diffère. D'où l'extraction
 * plutôt qu'un second fil côté formateur, qui aurait divergé au premier
 * correctif.
 *
 * Le rôle de l'auteur n'est pas un paramètre : `commenter()` laisse Postgres
 * poser `auth.uid()`, et `getFil` déduit « formateur » de l'absence de fiche
 * stagiaire. Le même composant sert donc les deux sans rien savoir de qui
 * l'utilise.
 */
export default function FilCommentaires({
  annonceId,
  commentaires,
  camarades,
  cheminARevalider,
  placeholder,
}: {
  annonceId: string;
  commentaires: Commentaire[];
  camarades: Camarade[];
  /** Page à rafraîchir côté serveur, en plus du fil stagiaire. */
  cheminARevalider?: string;
  placeholder?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [enCours, startTransition] = useTransition();
  // Identifiant du commentaire dont la suppression attend confirmation.
  const [aSupprimer, setASupprimer] = useState<string | null>(null);

  function supprimer(id: string) {
    startTransition(async () => {
      try {
        await supprimerCommentaire(id, cheminARevalider);
        toast("Commentaire supprimé");
        setASupprimer(null);
        router.refresh();
      } catch (e) {
        toast(
          e instanceof Error ? e.message : "Suppression impossible.",
          "error",
        );
      }
    });
  }

  function envoyer(texte: string) {
    startTransition(async () => {
      try {
        await commenter(annonceId, texte, cheminARevalider);
        router.refresh();
      } catch (e) {
        toast(
          e instanceof Error ? e.message : "Commentaire non publié.",
          "error",
        );
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 pt-1.5">
      {commentaires.map((c) => (
        <div key={c.id} className="flex gap-[11px]">
          <Avatar
            prenom={c.auteurNom}
            taille="xs"
            className="h-8 w-8 text-[11px]"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
            <div className="flex items-baseline gap-[9px]">
              <span className="text-sm font-semibold text-ink">
                {c.auteurNom}
              </span>
              {c.auteurFormateur ? (
                <span className="rounded-full border border-tint-teal-strong bg-tint-teal px-2 py-px text-[11px] font-semibold text-teal-dark">
                  formateur
                </span>
              ) : null}
              <span className="font-mono text-[11.5px] text-muted">
                {formatDateTime(c.created_at)}
              </span>
              {c.estMien && aSupprimer !== c.id ? (
                <button
                  type="button"
                  aria-label="Supprimer mon commentaire"
                  onClick={() => setASupprimer(c.id)}
                  className="ml-auto flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg border border-transparent text-coral-dark transition-colors duration-150 ease-out hover:border-tint-alert-strong hover:bg-alert-wash max-md:h-11 max-md:w-11"
                >
                  <Trash2 size={14} aria-hidden />
                </button>
              ) : null}
            </div>

            <p className="whitespace-pre-line text-[15px] leading-relaxed text-body">
              <TexteMentions texte={c.texte} camarades={camarades} />
            </p>

            {c.estMien && aSupprimer === c.id ? (
              // Confirmation en ligne plutôt qu'en modale : sur un téléphone,
              // une boîte de dialogue pour effacer une ligne de texte est
              // disproportionnée.
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => supprimer(c.id)}
                  disabled={enCours}
                  className="flex min-h-[44px] items-center rounded-lg px-2 text-sm font-semibold text-coral-dark disabled:opacity-50"
                >
                  Supprimer
                </button>
                <button
                  type="button"
                  onClick={() => setASupprimer(null)}
                  className="flex min-h-[44px] items-center rounded-lg px-2 text-sm text-slate-2"
                >
                  Annuler
                </button>
              </span>
            ) : null}
          </div>
        </div>
      ))}

      <ChampMention
        camarades={camarades}
        onEnvoyer={envoyer}
        busy={enCours}
        {...(placeholder ? { placeholder } : {})}
      />
    </div>
  );
}
