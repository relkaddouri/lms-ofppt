"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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
import { ChevronUp, Trash2 } from "lucide-react";

/**
 * Combien de commentaires restent visibles sans rien déplier.
 *
 * Quatre : assez pour saisir le fil d'une conversation et savoir si l'on a
 * déjà répondu, trop peu pour enterrer l'annonce suivante.
 */
const DERNIERS = 4;

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
  const [toutAfficher, setToutAfficher] = useState(false);
  // Le commentaire désigné par l'ancre de l'adresse, mis en évidence à
  // l'arrivée puis relâché.
  const [vise, setVise] = useState<string | null>(null);
  const conteneur = useRef<HTMLDivElement>(null);

  /**
   * Amène le commentaire désigné par l'adresse, et le déplie s'il le faut.
   *
   * Une notification pointe un commentaire précis. Sans ce déplié, un
   * commentaire ancien — donc replié derrière « voir les précédents » —
   * n'existerait tout simplement pas dans la page, et le lien tomberait dans
   * le vide sans rien dire.
   */
  useEffect(() => {
    const ancre = window.location.hash.replace("#", "");
    if (!ancre.startsWith("commentaire-")) return;
    const id = ancre.slice("commentaire-".length);
    if (!commentaires.some((c) => c.id === id)) return;

    setToutAfficher(true);
    setVise(id);
    // Après le rendu du déplié, pas avant : l'élément n'existe pas encore.
    const t = window.setTimeout(() => {
      conteneur.current
        ?.querySelector(`#${CSS.escape(ancre)}`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 60);
    // La mise en évidence s'efface d'elle-même : elle sert à retrouver, pas à
    // marquer durablement.
    const fin = window.setTimeout(() => setVise(null), 3200);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(fin);
    };
  }, [commentaires]);

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

  // Seuls les derniers commentaires s'affichent. Un fil de dix-sept réponses
  // repoussait l'annonce suivante hors de l'écran, et le champ de saisie avec
  // elle : pour répondre, il fallait traverser toute la conversation.
  //
  // Les derniers, et non les premiers : une discussion se rattrape par la fin.
  const caches = Math.max(0, commentaires.length - DERNIERS);
  const visibles =
    toutAfficher || caches === 0 ? commentaires : commentaires.slice(-DERNIERS);

  return (
    <div ref={conteneur} className="flex flex-col gap-3 pt-1.5">
      {caches > 0 && !toutAfficher ? (
        <button
          type="button"
          onClick={() => setToutAfficher(true)}
          className="flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-slate-2 transition-colors duration-150 ease-out hover:text-ink"
        >
          <ChevronUp size={15} aria-hidden />
          Voir {caches === 1
            ? "le commentaire précédent"
            : `les ${caches} commentaires précédents`}
        </button>
      ) : null}

      {visibles.map((c) => (
        <div
          key={c.id}
          id={`commentaire-${c.id}`}
          className={`flex gap-[11px] rounded-xl transition-colors duration-500 ease-out ${
            vise === c.id ? "bg-tint-teal px-2.5 py-2 -mx-2.5" : ""
          }`}
        >
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
