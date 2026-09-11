"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/Toast";
import { formatDateTime } from "@/lib/format";
import Avatar from "@/components/ui/Avatar";
import TexteMentions from "@/components/TexteMentions";
import FilCommentaires from "@/components/FilCommentaires";
import CarteDistinction from "@/components/CarteDistinction";
import {
  basculerJaime,
  type AnnonceFil,
  type Camarade,
} from "@/app/actions/fil";
import { Heart, MessageCircle } from "lucide-react";

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
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [aime, setAime] = useState(annonce.jaimePersonnel);
  const [total, setTotal] = useState(annonce.jaime);
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

  const compteCommentaires = annonce.commentaires.length;

  return (
    <article className="flex flex-col gap-3.5 border-t border-separator px-5 py-[22px] first:border-t-0">
      <div className="flex items-center gap-[11px]">
        <Avatar prenom="Formateur" texte="F" taille="xs" />
        <span className="flex min-w-0 flex-col gap-px">
          <span className="text-[14.5px] font-semibold text-ink">
            Votre formateur
          </span>
          <span className="font-mono text-xs text-muted">
            {formatDateTime(annonce.date ?? annonce.created_at)}
          </span>
        </span>
      </div>

      {/* Une distinction est une annonce comme une autre — on l'aime, on la
          commente, elle vieillit dans le fil — mais son texte seul ne fête
          rien. La carte prend la place du titre et du corps ; le reste de
          l'article, en-tête et actions, ne bouge pas. */}
      {annonce.distinction ? (
        <CarteDistinction
          distinction={annonce.distinction}
          contenu={annonce.contenu}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {annonce.titre ? (
            <h2 className="font-display text-[19px] font-semibold leading-snug text-ink">
              {annonce.titre}
            </h2>
          ) : null}
          {annonce.contenu ? (
            <p className="whitespace-pre-line text-base leading-relaxed text-body">
              <TexteMentions texte={annonce.contenu} camarades={camarades} />
            </p>
          ) : null}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={jaimer}
          aria-pressed={aime}
          aria-label={aime ? "Retirer j'aime" : "J'aime"}
          className={`flex min-h-[44px] items-center gap-2 rounded-[11px] border px-[15px] py-[11px] text-sm font-semibold transition-colors duration-150 ease-out ${
            aime
              ? "border-ink bg-ink text-white"
              : "border-border-strong bg-surface text-body hover:border-ink hover:bg-paper"
          }`}
        >
          <Heart
            size={17}
            className={`shrink-0 ${aime ? "fill-white" : ""}`}
            aria-hidden
          />
          J&apos;aime <span className="font-mono font-medium">{total}</span>
        </button>

        <button
          type="button"
          onClick={() => setCommentairesOuverts((o) => !o)}
          aria-expanded={commentairesOuverts}
          className="flex min-h-[44px] items-center gap-2 rounded-[11px] border border-border-strong bg-surface px-[15px] py-[11px] text-sm font-semibold text-body transition-colors duration-150 ease-out hover:border-ink hover:bg-paper"
        >
          <MessageCircle size={17} className="shrink-0" aria-hidden />
          Commenter{" "}
          <span className="font-mono font-medium">{compteCommentaires}</span>
        </button>
      </div>

      {commentairesOuverts ? (
        <FilCommentaires
          annonceId={annonce.id}
          commentaires={annonce.commentaires}
          camarades={camarades}
        />
      ) : null}
    </article>
  );
}
