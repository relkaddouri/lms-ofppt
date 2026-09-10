"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { enregistrerPhoto } from "@/app/actions/stagiaires";
import { useToast } from "@/components/ui/Toast";
import Avatar, { type AvatarTaille } from "@/components/ui/Avatar";
import { Camera, Trash2 } from "lucide-react";
import {
  BUCKET_PHOTOS,
  cheminPhoto,
  TAILLE_MAX_PHOTO,
  TYPES_PHOTO,
} from "@/lib/photos";

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
 */
export default function PhotoStagiaire({
  stagiaireId,
  nom,
  prenom,
  photo,
  taille = "lg",
  libelle,
  compact = false,
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
   * la déconnexion : trois contrôles de plus y auraient été de trop. Le
   * retrait n'y figure donc pas — on remplace une photo en en déposant une
   * autre, et le retrait complet reste sur l'écran du formateur.
   */
  compact?: boolean;
}) {
  const toast = useToast();
  const champ = useRef<HTMLInputElement>(null);
  const [enCours, setEnCours] = useState(false);
  // L'aperçu local évite d'attendre un aller-retour serveur pour voir sa
  // propre photo : le chemin ne change pas d'un dépôt à l'autre, donc rien
  // dans les données ne signalerait le changement.
  const [apercu, setApercu] = useState<string | null>(null);

  async function deposer(fichier: File) {
    if (!TYPES_PHOTO.includes(fichier.type)) {
      toast("Format accepté : JPEG, PNG ou WebP.", "error");
      return;
    }
    if (fichier.size > TAILLE_MAX_PHOTO) {
      toast("La photo dépasse 2 Mo. Réduisez-la avant de la déposer.", "error");
      return;
    }

    setEnCours(true);
    try {
      const chemin = cheminPhoto(stagiaireId, fichier.name);
      const supabase = createClient();
      const { error } = await supabase.storage
        .from(BUCKET_PHOTOS)
        // `upsert` : le chemin est stable, un remplacement écrase au lieu
        // d'accumuler des fichiers que rien ne viendrait nettoyer.
        .upload(chemin, fichier, { upsert: true, contentType: fichier.type });
      if (error) throw new Error(error.message);

      await enregistrerPhoto(stagiaireId, chemin);
      setApercu(URL.createObjectURL(fichier));
      toast("Photo enregistrée.");
    } catch (e) {
      toast(
        e instanceof Error ? e.message : "Le dépôt de la photo a échoué.",
        "error",
      );
    } finally {
      setEnCours(false);
      if (champ.current) champ.current.value = "";
    }
  }

  async function retirer() {
    setEnCours(true);
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
      accept={TYPES_PHOTO.join(",")}
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
        {champFichier}
        <button
          type="button"
          onClick={() => champ.current?.click()}
          disabled={enCours}
          aria-label={photo || apercu ? "Changer ma photo" : "Ajouter ma photo"}
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
      </>
    );
  }

  return (
    <div className="flex items-center gap-3">
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
