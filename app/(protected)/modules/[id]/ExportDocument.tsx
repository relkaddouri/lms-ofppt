"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { getCompilationModule } from "@/app/actions/modules";
import { getEtablissement } from "@/app/actions/etablissement";
import { marqueDe } from "@/lib/pdf-marque";
import { formatDate, maintenant, slugify } from "@/lib/format";
import { Download } from "lucide-react";

/**
 * Téléchargement d'un des deux documents d'un module (PRD §4.4).
 *
 * La compilation se charge au clic et non au rendu de la page : elle tire
 * tous les supports du module, ce qui n'a aucune raison de peser sur
 * l'affichage d'un écran qu'on ouvre surtout pour autre chose.
 */
export default function ExportDocument({
  moduleId,
  moduleNom,
  genre,
  groupeNom,
  anneeScolaire,
  formateur,
  redigees,
}: {
  moduleId: string;
  moduleNom: string;
  genre: "cours" | "pratique";
  groupeNom: string;
  anneeScolaire: string | null;
  formateur: string | null;
  /** Nombre de séances effectivement rédigées, pour désactiver à vide. */
  redigees: number;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function exporter() {
    setBusy(true);
    try {
      const [pieces, etablissement, { telechargerCompilationPdf }] =
        await Promise.all([
          getCompilationModule(moduleId, genre),
          getEtablissement(),
          import("@/lib/pdf-module"),
        ]);

      if (pieces.length === 0) {
        toast("Aucun support rédigé à compiler pour l'instant.");
        return;
      }

      await telechargerCompilationPdf(
        {
          genre,
          moduleNom,
          groupeNom,
          anneeScolaire,
          formateur,
          edite: formatDate(maintenant()),
          pieces,
        },
        `${slugify(
          `${genre === "pratique" ? "pratique" : "cours"} ${moduleNom}`,
          "module",
        )}.pdf`,
        marqueDe(etablissement),
      );
      toast(
        `${pieces.length} séance${pieces.length > 1 ? "s" : ""} compilée${pieces.length > 1 ? "s" : ""}`,
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : "Export impossible.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      icon={Download}
      onClick={exporter}
      loading={busy}
      loadingLabel="Compilation…"
      disabled={redigees === 0}
    >
      {redigees === 0 ? "Rien à compiler" : "Télécharger le document complet"}
    </Button>
  );
}
