"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { formatDateTime } from "@/lib/format";
import Avatar from "@/components/ui/Avatar";
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

      <div className="flex flex-col gap-2">
        {annonce.titre ? (
          <h2 className="font-display text-[19px] font-semibold leading-snug text-ink">
            {annonce.titre}
          </h2>
        ) : null}
        <p className="whitespace-pre-line text-base leading-relaxed text-body">
          <TexteMentions texte={annonce.contenu} camarades={camarades} />
        </p>
      </div>

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
        <div className="flex flex-col gap-3 pt-1.5">
          {annonce.commentaires.map((c) => (
            <div key={c.id} className="flex gap-[11px]">
              <Avatar prenom={c.auteurNom} taille="xs" className="h-8 w-8 text-[11px]" />
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
                      className="ml-auto flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg border border-transparent text-coral-dark transition-colors duration-150 ease-out hover:border-tint-alert-strong hover:bg-alert-wash"
                    >
                      <Trash2 size={14} aria-hidden />
                    </button>
                  ) : null}
                </div>

                <p className="whitespace-pre-line text-[15px] leading-relaxed text-body">
                  <TexteMentions texte={c.texte} camarades={camarades} />
                </p>

                {c.estMien && aSupprimer === c.id ? (
                  // Confirmation en ligne plutôt qu'en modale : sur un
                  // téléphone, une boîte de dialogue pour effacer une ligne
                  // de texte est disproportionnée.
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
          />
        </div>
      ) : null}
    </article>
  );
}
