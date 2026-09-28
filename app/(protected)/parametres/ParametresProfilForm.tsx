"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Trash2 } from "lucide-react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Avatar from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";
import { preparerPhoto } from "@/lib/photo-navigateur";
import {
  BUCKET_PHOTO_FORMATEUR,
  cheminPhotoFormateur,
  urlPhotoFormateur,
} from "@/lib/profil-formateur";
import { saveMonProfil, type MonProfil } from "@/app/actions/profil";

/**
 * Le nom et le visage sous lesquels le formateur se présente.
 *
 * Ce n'est pas un réglage de plus : c'est ce que le stagiaire lit en tête de
 * chaque annonce et sous chaque réponse. D'où l'aperçu à droite du champ —
 * on voit ce qu'on écrit tel que le groupe le verra, anneau d'or compris.
 *
 * `nom_formateur` existe déjà dans l'onglet Établissement, mais il sert à
 * signer un document officiel : il peut porter un grade, un matricule, une
 * majuscule d'état civil. Les deux ne se confondent pas, et le texte de
 * l'écran le dit plutôt que de les synchroniser en douce.
 */
export default function ParametresProfilForm({
  initial,
}: {
  initial: MonProfil;
}) {
  const router = useRouter();
  const toast = useToast();
  const supabase = createClient();
  const fichierRef = useRef<HTMLInputElement>(null);

  const [nom, setNom] = useState(initial.nom ?? "");
  const [photo, setPhoto] = useState(initial.photo);
  const [apercu, setApercu] = useState(initial.photoUrl);
  const [enCours, startTransition] = useTransition();
  const [envoi, setEnvoi] = useState(false);

  const modifie = (nom.trim() || null) !== (initial.nom ?? null);

  /**
   * La photo s'enregistre seule, à la volée.
   *
   * Le fichier est déjà parti vers le stockage quand on rend la main : lui
   * demander en plus d'appuyer sur « Enregistrer » laisserait, si la page se
   * ferme entre-temps, un fichier dans le bucket que plus rien ne désigne.
   */
  async function deposer(fichier: File) {
    setEnvoi(true);
    try {
      const { fichier: pret, apercu: local } = await preparerPhoto(fichier);
      const chemin = cheminPhotoFormateur(initial.id, pret.name);

      const { error } = await supabase.storage
        .from(BUCKET_PHOTO_FORMATEUR)
        .upload(chemin, pret, { upsert: true, contentType: pret.type });
      if (error) throw new Error(error.message);

      await saveMonProfil({ nom: nom.trim() || null, photo: chemin });
      setPhoto(chemin);
      // L'aperçu local d'abord : l'adresse publique porte le même chemin
      // qu'avant, et le navigateur servirait l'ancienne image depuis son cache.
      setApercu(local || urlPhotoFormateur(chemin));
      toast("Photo enregistrée");
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Dépôt impossible.", "error");
    } finally {
      setEnvoi(false);
      if (fichierRef.current) fichierRef.current.value = "";
    }
  }

  function retirer() {
    startTransition(async () => {
      try {
        await saveMonProfil({ nom: nom.trim() || null, photo: null });
        setPhoto(null);
        setApercu(null);
        toast("Photo retirée");
        router.refresh();
      } catch (e) {
        toast(e instanceof Error ? e.message : "Retrait impossible.", "error");
      }
    });
  }

  function enregistrer() {
    startTransition(async () => {
      try {
        await saveMonProfil({ nom: nom.trim() || null, photo });
        toast("Profil enregistré");
        router.refresh();
      } catch (e) {
        toast(
          e instanceof Error ? e.message : "Enregistrement impossible.",
          "error",
        );
      }
    });
  }

  return (
    <section className="flex flex-col gap-5 rounded-[14px] border border-border bg-surface p-6 shadow-repos">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-lg font-semibold text-ink">
          Mon profil
        </h2>
        <p className="text-[14px] leading-snug text-slate-light">
          Le nom et le visage que vos stagiaires voient en tête de vos annonces
          et sous vos réponses. Sans eux, ils lisent « Votre formateur ».
        </p>
      </div>

      <div className="flex flex-col gap-6 border-t border-separator pt-5 md:flex-row md:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <Input
            label="Nom affiché"
            value={nom}
            maxLength={120}
            placeholder="Rachid EL KADDOURI"
            onChange={(e) => setNom(e.target.value)}
            hint="Tel que vos stagiaires le liront. Différent du nom porté sur les documents officiels, réglé dans l'onglet Établissement."
          />

          <div className="flex flex-wrap items-center gap-2.5">
            <input
              ref={fichierRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void deposer(f);
              }}
            />
            <Button
              variant="secondary"
              onClick={() => fichierRef.current?.click()}
              loading={envoi}
              loadingLabel="Envoi…"
            >
              <Camera size={16} aria-hidden />
              {photo ? "Changer la photo" : "Ajouter une photo"}
            </Button>
            {photo ? (
              <Button variant="ghost" onClick={retirer} disabled={enCours}>
                <Trash2 size={16} aria-hidden />
                Retirer
              </Button>
            ) : null}
          </div>
        </div>

        {/* L'aperçu tel que le fil l'affiche : même pastille, même anneau,
            même étiquette. */}
        <div className="flex items-center gap-3 self-start rounded-[12px] border border-border bg-paper-alt px-4 py-3.5">
          <Avatar
            prenom={nom || "Formateur"}
            photoUrl={apercu}
            taille="lg"
            anneauOr
          />
          <span className="flex min-w-0 flex-col gap-1">
            <span className="truncate text-[14.5px] font-semibold text-ink">
              {nom.trim() || "Votre formateur"}
            </span>
            <span className="w-fit rounded-full border border-or bg-or-clair px-2 py-px text-[11px] font-semibold text-or">
              Formateur
            </span>
          </span>
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t border-separator pt-5">
        <Button
          variant="ghost"
          onClick={() => setNom(initial.nom ?? "")}
          disabled={!modifie || enCours}
        >
          Annuler
        </Button>
        <Button
          onClick={enregistrer}
          disabled={!modifie}
          loading={enCours}
          loadingLabel="Enregistrement…"
        >
          Enregistrer
        </Button>
      </div>
    </section>
  );
}
