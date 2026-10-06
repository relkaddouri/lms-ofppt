"use client";

import Link from "next/link";
import { useState } from "react";
import { FileText } from "lucide-react";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { getCahierDonnees } from "@/app/actions/cahier";
import type { Etablissement } from "@/app/actions/etablissement";

/**
 * Le cahier du formateur, au format Word.
 *
 * Il voisine avec l'export des fiches sans s'y mêler : ce sont deux documents
 * différents, et le formateur remet l'un ou l'autre selon ce qu'on lui demande.
 *
 * L'assemblage se fait entièrement dans le navigateur, et la bibliothèque
 * `docx` n'est chargée qu'au clic — elle pèse, et la page du classeur s'ouvre
 * aussi pour exporter les fiches.
 */
export default function CahierExport({
  etablissement,
}: {
  etablissement: Etablissement;
}) {
  const toast = useToast();
  const [enCours, setEnCours] = useState(false);

  // Rien n'est bloquant : un cahier sort avec des cases vides, ce qui vaut
  // mieux qu'un bouton qui refuse. Mais autant prévenir avant l'impression.
  const manquants = [
    !etablissement.nomFormateur && "votre nom",
    !etablissement.directionRegionale && "la direction régionale",
    !etablissement.nom && "l'établissement",
    !etablissement.anneeScolaire && "l'année de formation",
    !etablissement.grade && "le grade",
    !etablissement.diplome && "le diplôme",
    !etablissement.specialiteAffectation && "la spécialité d'affectation",
  ].filter(Boolean) as string[];

  async function telecharger() {
    setEnCours(true);
    try {
      /*
        La bibliothèque et les données partent ensemble : l'une pèse, l'autre
        attend la base, et les enchaîner doublerait l'attente avant que le
        fichier descende.
      */
      const [{ cahierDuFormateur, nomFichierCahier }, data] = await Promise.all([
        import("@/lib/docx-cahier"),
        getCahierDonnees(),
      ]);
      const fichier = await cahierDuFormateur(etablissement, data);
      const lien = document.createElement("a");
      lien.href = URL.createObjectURL(fichier);
      lien.download = nomFichierCahier(etablissement);
      lien.click();
      URL.revokeObjectURL(lien.href);
      toast("Cahier du formateur téléchargé");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Édition impossible.", "error");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <section
      aria-label="Cahier du formateur"
      className="max-w-[860px] rounded-[14px] border border-border bg-surface p-[26px] shadow-repos"
    >
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="flex max-w-[520px] flex-col gap-1.5">
          <span className="font-mono text-[11.5px] uppercase tracking-[0.12em] text-slate-light">
            Document officiel
          </span>
          <h2 className="font-display text-[17px] font-semibold text-ink">
            Cahier du formateur
          </h2>
          <p className="text-[13.5px] text-slate-light">
            Le cahier entier : couverture, fiche d&apos;identité, procédures,
            suivi de vos modules séance par séance, logigramme, planification
            des contrôles et notes de vos stagiaires. Un fichier Word que vous
            complétez et faites émarger.
            {manquants.length ? (
              <>
                {" "}
                La fiche d&apos;identité attend encore {manquants.join(", ")} —{" "}
                <Link href="/parametres" className="font-semibold">
                  à renseigner dans Paramètres
                </Link>
                .
              </>
            ) : null}
          </p>
        </div>

        <Button
          variant="secondary"
          icon={FileText}
          onClick={telecharger}
          disabled={enCours}
          loading={enCours}
          loadingLabel="Édition…"
        >
          Télécharger en .docx
        </Button>
      </div>
    </section>
  );
}
