"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { imprimer } from "@/lib/impression";
import { estRedige, type Support } from "@/lib/support";
import { slugify } from "@/lib/format";
import { FileDown, FileText } from "lucide-react";

/**
 * Le cours à emporter, dans les deux formats (PRD §4.4).
 *
 * Côté stagiaire on ne projette pas : on récupère. Le diaporama est donc
 * *dessiné* en PDF et téléchargé directement — pas d'aperçu, pas de boîte
 * d'impression, et les polices embarquées plutôt que dépendantes de ce que le
 * navigateur avait chargé.
 *
 * Le document A4, lui, passe encore par l'impression : il coule sur plusieurs
 * pages, avec des tableaux et une couverture, ce qu'un dessin PDF à la main
 * reproduirait mal.
 */
export default function TelechargerDiapos({
  support,
  pied,
}: {
  support: Support;
  pied: string;
}) {
  const [enExport, setEnExport] = useState(false);

  if (support.type !== "theorique" || !estRedige(support)) return null;

  async function telecharger() {
    if (support.type !== "theorique" || !support.markdown) return;
    setEnExport(true);
    try {
      const { telechargerDiapositivesPdf } = await import("@/lib/pdf-diapos");
      await telechargerDiapositivesPdf(
        support.markdown,
        { surtitre: pied, pied },
        `${slugify(support.titre, "diaporama")}-16-9.pdf`,
      );
    } finally {
      setEnExport(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          icon={FileDown}
          onClick={telecharger}
          loading={enExport}
          loadingLabel="Préparation…"
        >
          Diaporama (PDF 16:9)
        </Button>
        {/* Les deux formats servent deux usages : on projette l'un, on relit
            et on annote l'autre. Le stagiaire choisit. */}
        <Button
          variant="secondary"
          size="sm"
          icon={FileText}
          onClick={() => imprimer("document")}
        >
          Document (PDF A4)
        </Button>
      </div>

    </>
  );
}
