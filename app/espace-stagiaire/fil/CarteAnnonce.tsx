"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { formatDateTime } from "@/lib/format";
import TexteMentions from "@/components/TexteMentions";
import ChampMention from "@/components/ChampMention";
import {
  basculerJaime,
  commenter,
  supprimerCommentaire,
  type AnnonceFil,
  type Camarade,
} from "@/app/actions/fil";
import { Heart, MessageCircle, Trash2 } from "lucide-react";

/**
 * Une annonce dans le fil.
 *
 * Carte pleine largeur séparée par un filet, pas une carte flottante à ombre :
 * empilées sur un téléphone, celles-ci donnent un effet de liste de courses
 * (design_system.md). « J'aime » et commentaires restent visibles en bas, ce
 * sont les deux actions principales.
 */
export default function CarteAnnonce({
  annonce,
  camarades,
}: {
  annonce: AnnonceFil;
  camarades: Camarade[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [enCours, startTransition] = useTransition();
  const [aime, setAime] = useState(annonce.jaimePersonnel);
  const [total, setTotal] = useState(annonce.jaime);
  // Identifiant du commentaire dont la suppression attend confirmation.
  const [aSupprimer, setASupprimer] = useState<string | null>(null);
  const [commentairesOuverts, setCommentairesOuverts] = useState(
    annonce.commentaires.length > 0,
  );

  function jaimer() {
    const cible = !aime;
    // L'état part en premier : un « j'aime » doit répondre au doigt.
    setAime(cible);
    setTotal((t) => t + (cible ? 1 : -1));
    startTransition(async () => {
      try {
        await basculerJaime(annonce.id, cible);
      } catch {
        setAime(!cible);
        setTotal((t) => t + (cible ? -1 : 1));
        toast("Réaction non enregistrée.", "error");
      }
    });
  }

  function supprimer(id: string) {
    startTransition(async () => {
      try {
        await supprimerCommentaire(id);
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
        await commenter(annonce.id, texte);
        router.refresh();
      } catch (e) {
        toast(e instanceof Error ? e.message : "Commentaire non publié.", "error");
      }
    });
  }

  return (
    <article className="border-b border-border bg-surface p-4 last:border-0">
      {annonce.titre ? (
        <h2 className="text-base font-semibold text-ink">{annonce.titre}</h2>
      ) : null}
      <p className="mt-0.5 text-xs text-slate">
        {formatDateTime(annonce.date ?? annonce.created_at)}
      </p>

      <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink">
        <TexteMentions texte={annonce.contenu} camarades={camarades} />
      </p>

      <div className="mt-4 flex items-center gap-1">
        <button
          type="button"
          onClick={jaimer}
          aria-pressed={aime}
          aria-label={aime ? "Retirer j'aime" : "J'aime"}
          className={`flex min-h-[44px] min-w-[44px] items-center gap-1.5 rounded-lg px-3 text-sm transition-colors ${
            aime ? "text-ink" : "text-slate hover:text-ink"
          }`}
        >
          <Heart
            className={`h-5 w-5 ${aime ? "fill-ink" : ""}`}
            aria-hidden
          />
          {total > 0 ? total : null}
        </button>

        <button
          type="button"
          onClick={() => setCommentairesOuverts((o) => !o)}
          aria-expanded={commentairesOuverts}
          className="flex min-h-[44px] min-w-[44px] items-center gap-1.5 rounded-lg px-3 text-sm text-slate transition-colors hover:text-ink"
        >
          <MessageCircle className="h-5 w-5" aria-hidden />
          {annonce.commentaires.length > 0 ? annonce.commentaires.length : null}
        </button>
      </div>

      {commentairesOuverts ? (
        <div className="mt-2 space-y-3">
          {annonce.commentaires.map((c) => (
            <div key={c.id} className="flex gap-2">
              <div className="min-w-0 flex-1 rounded-lg bg-paper px-3 py-2">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-medium text-ink">
                    {c.auteurNom}
                  </span>
                  {c.auteurFormateur ? (
                    <span className="text-[11px] text-ink">formateur</span>
                  ) : null}
                  <span className="text-[11px] text-slate">
                    {formatDateTime(c.created_at)}
                  </span>
                </p>
                <p className="mt-0.5 whitespace-pre-line text-sm text-ink">
                  <TexteMentions texte={c.texte} camarades={camarades} />
                </p>
              </div>

              {c.estMien ? (
                aSupprimer === c.id ? (
                  // Confirmation en ligne plutôt qu'en modale : sur un
                  // téléphone, une boîte de dialogue pour effacer une ligne de
                  // texte est disproportionnée (design_system.md, espace
                  // stagiaire).
                  <span className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => supprimer(c.id)}
                      disabled={enCours}
                      className="flex min-h-[44px] items-center rounded-lg px-2 text-sm font-medium text-coral-dark disabled:opacity-50"
                    >
                      Supprimer
                    </button>
                    <button
                      type="button"
                      onClick={() => setASupprimer(null)}
                      className="flex min-h-[44px] items-center rounded-lg px-2 text-sm text-slate"
                    >
                      Annuler
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    aria-label="Supprimer mon commentaire"
                    onClick={() => setASupprimer(c.id)}
                    className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-slate hover:text-coral-dark"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                )
              ) : null}
            </div>
          ))}

          <ChampMention
            camarades={camarades}
            onEnvoyer={envoyer}
            busy={enCours}
          />
        </div>
      ) : null}
    </article>
  );
}
