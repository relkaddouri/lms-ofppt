"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { enregistrerPhoto } from "@/app/actions/stagiaires";
import { useToast } from "@/components/ui/Toast";
import Avatar, { type AvatarTaille } from "@/components/ui/Avatar";
import { Camera, Trash2 } from "lucide-react";
import { BUCKET_PHOTOS } from "@/lib/photos";
import { preparerPhoto } from "@/lib/photo-navigateur";

/**
 * Déposer ou retirer la photo d'un stagiaire (PRD §4.5).
 *
 * Le même composant sert les deux côtés : le stagiaire pour lui-même, le
 * formateur pour les siens. C'est la policy de stockage qui tranche, pas
 * l'écran — dupliquer le dépôt aurait laissé les deux versions diverger, et
 * l'une des deux finir sans la vérification de taille.
 *
 * Le fichier part directement du navigateur vers le stockage. Le faire
 * transiter par une Server Action reviendrait à téléverser deux mégaoctets
 * pour les réémettre aussitôt, sans rien vérifier de plus.
 *
 * Il est d'abord réduit et réencodé en JPEG sur place. La version précédente
 * refusait tout ce qui n'était ni JPEG, ni PNG, ni WebP de moins de deux
 * mégaoctets — et le sélecteur n'affichait même pas le reste. C'est
 * exactement ce qu'un stagiaire a dans la main : un iPhone produit du HEIC,
 * un Android du JPEG de quatre mégaoctets. Le trombinoscope est resté vide.
 *
 * Le dépôt s'annonce dans une modale. Sur un téléphone, entre la conversion
 * et l'envoi, quelques secondes passent sans que rien ne bouge à l'écran :
 * l'avatar qui pâlit ne suffit pas à dire qu'il se passe quelque chose, et on
 * réappuie.
 */

/** Les trois moments du dépôt, tels que la modale les annonce. */
type Etape = "preparation" | "envoi" | "enregistrement";

const ETAPES: Record<Etape, string> = {
  preparation: "Préparation de la photo…",
  envoi: "Envoi en cours…",
  enregistrement: "Enregistrement sur la fiche…",
};

const ORDRE: Etape[] = ["preparation", "envoi", "enregistrement"];

/**
 * L'attente, montrée.
 *
 * Sans bouton de fermeture : il n'y a rien à décider, et une croix laisserait
 * croire qu'on peut annuler un envoi déjà parti. Elle disparaît d'elle-même.
 * Portée dans `body` : le dépôt se déclenche aussi depuis une cellule de
 * tableau, dont le contexte d'empilement retiendrait le voile.
 */
function VoileDepot({ etape }: { etape: Etape }) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Dépôt de la photo"
      aria-busy="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
    >
      <div className="w-full max-w-xs rounded-[14px] border border-border bg-surface p-6 shadow-flottant">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-border border-t-ink"
          />
          <p
            aria-live="polite"
            className="font-display text-[15px] font-semibold text-ink"
          >
            {ETAPES[etape]}
          </p>
        </div>

        {/* Trois traits plutôt qu'une barre qui progresse au hasard : on sait
            où on en est, on ne sait pas combien de temps il reste. */}
        <div className="mt-4 flex gap-1.5">
          {ORDRE.map((e, i) => (
            <span
              key={e}
              aria-hidden
              className={`h-1 flex-1 rounded-full ${
                i <= ORDRE.indexOf(etape) ? "bg-ink" : "bg-wash"
              }`}
            />
          ))}
        </div>

        <p className="mt-3 text-[13px] leading-relaxed text-slate-2">
          Quelques secondes selon la connexion. Ne fermez pas cette page.
        </p>
      </div>
    </div>,
    document.body,
  );
}
export default function PhotoStagiaire({
  stagiaireId,
  nom,
  prenom,
  photo,
  taille = "lg",
  libelle,
  compact = false,
  retrait = false,
}: {
  stagiaireId: string;
  nom: string;
  prenom: string;
  photo: string | null;
  taille?: AvatarTaille;
  /** Texte du bouton ; sans lui, seule l'icône s'affiche. */
  libelle?: string;
  /**
   * L'avatar seul, cliquable, avec une pastille d'appareil photo.
   *
   * Pour l'en-tête du stagiaire, qui porte déjà la navigation, la cloche et
   * la déconnexion : trois contrôles de plus y auraient été de trop. On y
   * remplace une photo en en déposant une autre.
   */
  compact?: boolean;
  /**
   * Ajoute le retrait à la forme compacte.
   *
   * Le formateur en a besoin : une photo floue ou un stagiaire qui quitte le
   * groupe doivent pouvoir disparaître. Le commentaire disait déjà que le
   * retrait « reste sur l'écran du formateur » — mais cet écran passait lui
   * aussi en forme compacte, et le bouton n'existait donc nulle part.
   */
  retrait?: boolean;
}) {
  const toast = useToast();
  const champ = useRef<HTMLInputElement>(null);
  const [enCours, setEnCours] = useState(false);
  const [etape, setEtape] = useState<Etape | null>(null);
  // L'aperçu local évite d'attendre un aller-retour serveur pour voir sa
  // propre photo : le chemin ne change pas d'un dépôt à l'autre, donc rien
  // dans les données ne signalerait le changement.
  const [apercu, setApercu] = useState<string | null>(null);

  async function deposer(fichier: File) {
    setEnCours(true);
    setEtape("preparation");
    try {
      // Réduite et réencodée ici : ce qui part est toujours un JPEG de
      // quelques dizaines de kilooctets, quel que soit le téléphone.
      const { fichier: prete, apercu: vignetteLocale } =
        await preparerPhoto(fichier);

      setEtape("envoi");
      // Le chemin est stable — `<id>/photo.jpg` — et `upsert` écrase au lieu
      // d'accumuler des fichiers que rien ne viendrait nettoyer.
      const chemin = `${stagiaireId}/photo.jpg`;
      const supabase = createClient();
      const { error } = await supabase.storage
        .from(BUCKET_PHOTOS)
        .upload(chemin, prete, { upsert: true, contentType: "image/jpeg" });
      if (error) throw new Error(error.message);

      setEtape("enregistrement");
      await enregistrerPhoto(stagiaireId, chemin);
      setApercu(vignetteLocale);
      toast("Photo enregistrée.");
    } catch (e) {
      toast(
        e instanceof Error ? e.message : "Le dépôt de la photo a échoué.",
        "error",
      );
    } finally {
      setEnCours(false);
      setEtape(null);
      if (champ.current) champ.current.value = "";
    }
  }

  async function retirer() {
    setEnCours(true);
    setEtape("enregistrement");
    try {
      const supabase = createClient();
      // Le fichier part avant la fiche : l'inverse laisserait une image
      // orpheline que plus rien ne désigne.
      if (photo) await supabase.storage.from(BUCKET_PHOTOS).remove([photo]);
      await enregistrerPhoto(stagiaireId, null);
      setApercu(null);
      toast("Photo retirée.");
    } catch (e) {
      toast(
        e instanceof Error ? e.message : "Le retrait de la photo a échoué.",
        "error",
      );
    } finally {
      setEnCours(false);
      setEtape(null);
    }
  }

  const vignette = apercu ? (
    <span
      aria-hidden
      className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={apercu} alt="" className="h-full w-full object-cover" />
    </span>
  ) : (
    <Avatar nom={nom} prenom={prenom} photo={photo} taille={taille} />
  );

  const champFichier = (
    <input
      ref={champ}
      type="file"
      // Toute image : sur iPhone, restreindre aux trois types grisait les
      // photos de la pellicule, qui sont en HEIC. La conversion s'occupe du
      // reste, et ce qui n'est pas décodable est refusé avec un message.
      accept="image/*"
      className="hidden"
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) void deposer(f);
      }}
    />
  );

  if (compact) {
    return (
      <>
        {etape ? <VoileDepot etape={etape} /> : null}
        {champFichier}
        <span className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => champ.current?.click()}
            disabled={enCours}
            aria-label={
              photo || apercu ? "Changer la photo" : "Ajouter une photo"
            }
            className="relative shrink-0 rounded-full disabled:opacity-60"
          >
            {vignette}
            <span
              aria-hidden
              className="absolute -bottom-0.5 -right-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-surface bg-ink text-white"
            >
              <Camera size={9} aria-hidden />
            </span>
          </button>

          {retrait && (photo || apercu) ? (
            <button
              type="button"
              onClick={retirer}
              disabled={enCours}
              aria-label="Retirer la photo"
              title="Retirer la photo"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border border-transparent text-slate-light transition-colors duration-150 ease-out hover:border-tint-alert-strong hover:bg-alert-wash hover:text-coral-dark disabled:opacity-60"
            >
              <Trash2 size={13} aria-hidden />
            </button>
          ) : null}
        </span>
      </>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {etape ? <VoileDepot etape={etape} /> : null}
      <span className="relative">{vignette}</span>
      {champFichier}

      <button
        type="button"
        onClick={() => champ.current?.click()}
        disabled={enCours}
        className="flex min-h-11 items-center gap-2 rounded-[11px] border border-border-strong bg-surface px-3.5 text-sm font-semibold text-body transition-colors duration-150 ease-out hover:border-ink hover:bg-paper disabled:opacity-60"
      >
        <Camera size={16} aria-hidden />
        {libelle ?? (photo || apercu ? "Changer" : "Ajouter une photo")}
      </button>

      {photo || apercu ? (
        <button
          type="button"
          onClick={retirer}
          disabled={enCours}
          aria-label="Retirer la photo"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[11px] border border-border bg-surface text-slate-2 transition-colors duration-150 ease-out hover:border-coral hover:text-coral disabled:opacity-60"
        >
          <Trash2 size={16} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
