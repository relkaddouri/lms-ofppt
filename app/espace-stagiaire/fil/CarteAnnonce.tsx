"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/Toast";
import { formatDateTime } from "@/lib/format";
import Avatar from "@/components/ui/Avatar";
import TexteMentions from "@/components/TexteMentions";
import FilCommentaires from "@/components/FilCommentaires";
import CarteDistinction from "@/components/CarteDistinction";
import PodiumClassement from "@/components/PodiumClassement";
import {
  basculerJaime,
  type AnnonceFil,
  type Camarade,
  type QuiAime,
} from "@/app/actions/fil";
import QuiAAime from "@/components/QuiAAime";
import type { IdentiteFormateur } from "@/app/actions/profil";
import { MessageCircle } from "lucide-react";
import BoutonJaime from "@/components/BoutonJaime";

/**
 * Une annonce dans le fil.
 *
 * Une carte détachée, posée sur le fond de la page. Le système visuel
 * recommandait l'inverse — pleine largeur, séparée par un simple filet, pour
 * éviter l'effet de liste de courses sur un téléphone. Il avait raison tant
 * qu'une annonce tenait en trois lignes ; depuis qu'elle porte son podium, ses
 * réactions et son fil de commentaires, deux annonces à la suite se
 * confondaient — on ne voyait plus où l'une finissait.
 *
 * « J'aime » et commentaires restent visibles en bas, ce sont les deux actions
 * principales.
 */
export default function CarteAnnonce({
  annonce,
  camarades,
  formateur,
  moi,
}: {
  annonce: AnnonceFil;
  camarades: Camarade[];
  formateur: IdentiteFormateur;
  /** Le lecteur, pour s'ajouter à la liste sans attendre le serveur. */
  moi: QuiAime;
}) {
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [aime, setAime] = useState(annonce.jaimePersonnel);
  const [total, setTotal] = useState(annonce.jaime);
  const [qui, setQui] = useState(annonce.qui);
  const [commentairesOuverts, setCommentairesOuverts] = useState(
    annonce.commentaires.length > 0,
  );

  function jaimer() {
    const cible = !aime;
    // L'état part en premier : un « j'aime » doit répondre au doigt.
    setAime(cible);
    setTotal((t) => t + (cible ? 1 : -1));
    // La liste suit le compte : sans cela, « Vous et 6 autres » resterait
    // « 6 autres » jusqu'au prochain chargement, et le geste n'aurait pas eu
    // lieu pour celui qui vient de le faire.
    setQui((l) =>
      cible ? [moi, ...l.filter((p) => !p.cestMoi)] : l.filter((p) => !p.cestMoi),
    );
    startTransition(async () => {
      try {
        await basculerJaime(annonce.id, cible);
      } catch {
        setAime(!cible);
        setTotal((t) => t + (cible ? -1 : 1));
        setQui(annonce.qui);
        toast("Réaction non enregistrée.", "error");
      }
    });
  }

  const compteCommentaires = annonce.commentaires.length;

  return (
    <article className="mx-5 flex flex-col gap-3.5 rounded-[14px] border border-border bg-surface px-5 py-[22px] shadow-detachee md:mx-0 md:px-6">
      {/* Qui parle. L'anneau d'or et l'étiquette disent, dans un fil où tout
          le monde porte la même pastille, que celui-ci vient du formateur —
          sans quoi il faudrait lire le nom et savoir qui il désigne. */}
      <div className="flex items-center gap-[11px]">
        <Avatar
          prenom={formateur.nom || "Formateur"}
          {...(formateur.nom ? {} : { texte: "F" })}
          photoUrl={formateur.photoUrl}
          taille="xs"
          anneauOr
        />
        <span className="flex min-w-0 flex-col gap-px">
          <span className="flex items-center gap-2">
            <span className="truncate text-[14.5px] font-semibold text-ink">
              {formateur.nom || "Votre formateur"}
            </span>
            <span className="shrink-0 rounded-full border border-or bg-or-clair px-2 py-px text-[11px] font-semibold text-or">
              Formateur
            </span>
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
        <div className="flex flex-col gap-3">
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
          {/* Le classement d'une épreuve : le podium sous le texte, et non à
              sa place — le formateur y ajoute souvent un mot. */}
          {annonce.classement ? (
            <PodiumClassement
              lignes={annonce.classement.lignes}
              total={annonce.classement.total}
              moyenne={annonce.classement.moyenne}
              moiId={annonce.classement.moiId}
            />
          ) : null}
        </div>
      )}

      {/* Qui aime, avant les boutons : c'est une information sur l'annonce,
          pas une commande. Rien ne s'affiche tant que personne n'a aimé. */}
      <QuiAAime qui={qui} />

      {/* Deux icônes et deux nombres. Les mots « J'aime » et « Commenter »
          prenaient la moitié de la largeur d'un téléphone pour répéter ce que
          le cœur et la bulle montrent ; le compte, lui, est la seule chose
          que l'icône ne peut pas dire. */}
      <div className="flex items-center gap-2">
        <BoutonJaime
          aime={aime}
          total={total}
          onBasculer={jaimer}
          libelle="cette annonce"
        />

        <button
          type="button"
          onClick={() => setCommentairesOuverts((o) => !o)}
          aria-expanded={commentairesOuverts}
          aria-label={
            commentairesOuverts
              ? "Masquer les commentaires"
              : "Afficher les commentaires et commenter"
          }
          className="flex min-h-[44px] items-center gap-1.5 rounded-[11px] border border-border-strong bg-surface px-[15px] py-[11px] text-sm font-semibold text-body transition-colors duration-150 ease-out hover:border-encre hover:bg-paper"
        >
          <MessageCircle size={17} className="shrink-0" aria-hidden />
          {compteCommentaires > 0 ? (
            <span className="font-mono font-medium tabular-nums">
              {compteCommentaires}
            </span>
          ) : null}
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
