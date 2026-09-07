"use client";

import Button from "@/components/ui/Button";
import DiapoRedigee from "@/components/DiapoRedigee";
import { decouperEnDiapositives } from "@/lib/diapos";
import { estRedige, type Support } from "@/lib/support";
import { FileDown } from "lucide-react";

/**
 * Le diaporama 16:9 d'un cours, à emporter (PRD §4.4).
 *
 * Côté stagiaire on ne projette pas : on récupère. Le bouton produit donc le
 * PDF sans afficher la navigation du diaporama — les diapositives sont
 * rendues hors écran, et l'impression du navigateur fait le reste.
 *
 * Même voie que le support de référence du porteur de projet, qui est un PDF
 * imprimé depuis Chromium : le rendu garde les tableaux, les encadrés et les
 * fonds encre, qu'un moteur PDF écrit à la main perdrait.
 */
export default function TelechargerDiapos({
  support,
  pied,
}: {
  support: Support;
  pied: string;
}) {
  if (support.type !== "theorique" || !estRedige(support)) return null;

  const diapos = decouperEnDiapositives(support.markdown!, {
    surtitre: pied,
    pied,
  });

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        icon={FileDown}
        onClick={() => window.print()}
      >
        Télécharger le diaporama (PDF 16:9)
      </Button>

      <div className="diapo-impression" aria-hidden>
        {diapos.map((d, i) => (
          <div key={i} className="diapo-page">
            <DiapoRedigee diapo={d} numero={i + 1} pied={pied} />
          </div>
        ))}
      </div>
    </>
  );
}
