"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { estRedige, type Support } from "@/lib/support";
import { slugify } from "@/lib/format";
import { FileDown, FileText } from "lucide-react";

/**
 * Le cours à emporter, dans les deux formats (PRD §4.4).
 *
 * Côté stagiaire on ne projette pas : on récupère. Les deux formats sont donc
 * *dessinés* en PDF et téléchargés directement — pas d'aperçu, pas de boîte
 * d'impression, et les polices embarquées plutôt que dépendantes de ce que le
 * navigateur avait chargé.
 */
export default function TelechargerDiapos({
  support,
  pied,
}: {
  support: Support;
  pied: string;
}) {
  const [enExport, setEnExport] = useState<"diapo" | "doc" | null>(null);

  if (support.type !== "theorique" || !estRedige(support)) return null;

  async function telecharger(format: "diapo" | "doc") {
    if (support.type !== "theorique" || !support.markdown) return;
    setEnExport(format);
    try {
      if (format === "diapo") {
        const { telechargerDiapositivesPdf } = await import("@/lib/pdf-diapos");
        await telechargerDiapositivesPdf(
          support.markdown,
          { surtitre: pied, pied },
          `${slugify(support.titre, "diaporama")}-16-9.pdf`,
        );
      } else {
        const { telechargerDocumentPdf } = await import("@/lib/pdf-document");
        await telechargerDocumentPdf(
          support.markdown,
          { surtitre: pied, pied },
          `${slugify(support.titre, "document")}-a4.pdf`,
        );
      }
    } finally {
      setEnExport(null);
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          icon={FileDown}
          onClick={() => telecharger("diapo")}
          loading={enExport === "diapo"}
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
          onClick={() => telecharger("doc")}
          loading={enExport === "doc"}
          loadingLabel="Préparation…"
        >
          Document (PDF A4)
        </Button>
      </div>

    </>
  );
}
