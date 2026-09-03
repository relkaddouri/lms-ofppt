"use client";

import { useRef, useState, useTransition } from "react";
import { Save, Trash2, Upload } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { saveEtablissement, type Etablissement } from "@/app/actions/etablissement";
import { LOGO_TAILLE_MAX, LOGO_TYPES } from "@/lib/etablissement";

/**
 * Identité du centre de formation.
 *
 * Elle sert deux fois : en tête de chaque document produit (classeur, fiches,
 * contrôles, tableau de service) et dans la colonne EFP du tableau de service,
 * qui restait vide faute de donnée. Le logo est déposé ici plutôt que livré
 * avec le code — un autre centre en a un autre, et le formateur n'a pas à
 * demander une mise en production pour changer une image.
 */
export default function ParametresEtablissementForm({
  initial,
}: {
  initial: Etablissement;
}) {
  const toast = useToast();
  const [enCours, startTransition] = useTransition();
  const [nom, setNom] = useState(initial.nom ?? "");
  const [logo, setLogo] = useState<string | null>(initial.logo);
  const fichierRef = useRef<HTMLInputElement>(null);

  function choisirLogo(fichier: File | undefined) {
    if (!fichier) return;
    if (!(LOGO_TYPES as readonly string[]).includes(fichier.type)) {
      toast("Le logo doit être une image PNG ou JPEG.", "error");
      return;
    }
    if (fichier.size > LOGO_TAILLE_MAX) {
      toast("Le logo est trop lourd : 300 Ko au maximum.", "error");
      return;
    }
    const lecteur = new FileReader();
    lecteur.onload = () => setLogo(String(lecteur.result));
    lecteur.onerror = () => toast("Lecture du fichier impossible.", "error");
    lecteur.readAsDataURL(fichier);
  }

  function enregistrer() {
    startTransition(async () => {
      try {
        await saveEtablissement({ nom: nom.trim() || null, logo });
        toast("Établissement enregistré.");
      } catch (e) {
        toast(e instanceof Error ? e.message : "Enregistrement impossible.", "error");
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-[17px] font-semibold text-ink">
            Établissement
          </h2>
          <span className="text-[13.5px] text-slate-light">
            Imprimé en tête de vos documents et dans la colonne EFP du tableau
            de service.
          </span>
        </div>

        <Input
          label="Nom du centre"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          placeholder="Cité des Métiers et des Compétences…"
          hint="Tel qu'il doit apparaître sur les documents remis à la Direction."
        />
      </Card>

      <Card className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-[17px] font-semibold text-ink">
            Logo
          </h2>
          <span className="text-[13.5px] text-slate-light">
            PNG ou JPEG, 300 Ko au maximum. Placé en haut de chaque document
            exporté.
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-5">
          <span className="flex h-[84px] w-[220px] shrink-0 items-center justify-center overflow-hidden rounded-[11px] border border-border-strong bg-paper px-3">
            {logo ? (
              // Une image déposée par le formateur : ni dimensions ni format
              // connus d'avance, d'où le composant natif plutôt que next/image.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo}
                alt="Logo de l'établissement"
                className="max-h-[68px] max-w-full object-contain"
              />
            ) : (
              <span className="text-[13px] text-slate-light">Aucun logo</span>
            )}
          </span>

          <div className="flex flex-wrap items-center gap-2.5">
            <input
              ref={fichierRef}
              type="file"
              accept="image/png,image/jpeg"
              className="sr-only"
              onChange={(e) => {
                choisirLogo(e.target.files?.[0]);
                // Sans cela, redéposer le même fichier après un retrait
                // n'émettrait aucun évènement.
                e.target.value = "";
              }}
            />
            <Button
              variant="secondary"
              icon={Upload}
              onClick={() => fichierRef.current?.click()}
              disabled={enCours}
            >
              {logo ? "Remplacer" : "Déposer un logo"}
            </Button>
            {logo ? (
              <Button
                variant="danger"
                icon={Trash2}
                onClick={() => setLogo(null)}
                disabled={enCours}
              >
                Retirer
              </Button>
            ) : null}
          </div>
        </div>
      </Card>

      <div className="flex justify-end gap-2.5">
        <Button
          variant="secondary"
          onClick={() => {
            setNom(initial.nom ?? "");
            setLogo(initial.logo);
          }}
          disabled={enCours}
        >
          Annuler
        </Button>
        <Button
          icon={Save}
          onClick={enregistrer}
          disabled={enCours}
          loading={enCours}
          loadingLabel="Enregistrement…"
        >
          Enregistrer
        </Button>
      </div>
    </div>
  );
}
