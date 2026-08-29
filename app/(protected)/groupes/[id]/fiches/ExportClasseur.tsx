"use client";

import { useState, useTransition } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { inputStyles } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { formatDate, slugify } from "@/lib/format";
import { lireFiche } from "@/components/FicheSeance";
import { getFichesPeriode, type ContexteClasseur } from "@/app/actions/classeur";
import { FolderDown } from "lucide-react";

/** Premier et dernier jour du mois en cours, la période qu'on exporte le plus. */
function moisCourant(): { debut: string; fin: string } {
  const maintenant = new Date();
  const premier = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1);
  const dernier = new Date(maintenant.getFullYear(), maintenant.getMonth() + 1, 0);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
  return { debut: iso(premier), fin: iso(dernier) };
}

export default function ExportClasseur({
  groupeId,
  contexte,
}: {
  groupeId: string;
  contexte: ContexteClasseur;
}) {
  const toast = useToast();
  const [enCours, startTransition] = useTransition();
  const defaut = moisCourant();
  const [moduleId, setModuleId] = useState("tous");
  const [debut, setDebut] = useState(defaut.debut);
  const [fin, setFin] = useState(defaut.fin);

  function exporter() {
    startTransition(async () => {
      try {
        const { fiches, sansFiche } = await getFichesPeriode(
          groupeId,
          moduleId === "tous" ? null : moduleId,
          debut,
          fin,
        );

        if (fiches.length === 0) {
          toast(
            "Aucune fiche enregistrée sur cette période.",
            "error",
          );
          return;
        }

        const moduleChoisi = contexte.modules.find((m) => m.id === moduleId);
        const { telechargerClasseurPdf } = await import("@/lib/pdf-classeur");

        await telechargerClasseurPdf(
          {
            etablissement: "OFPPT",
            filiere: contexte.filiere,
            groupe: contexte.groupeNom,
            module: moduleChoisi
              ? `${moduleChoisi.code ? `${moduleChoisi.code} — ` : ""}${moduleChoisi.nom}`
              : "Tous les modules",
            debut: formatDate(debut),
            fin: formatDate(fin),
          },
          fiches.map((s) => {
            const f = lireFiche(s.contenu);
            return {
              date: s.date ? formatDate(s.date) : null,
              fiche: {
                nature: f.nature,
                date: s.date ? formatDate(s.date) : null,
                dureeHeures: s.dureeMinutes ? s.dureeMinutes / 60 : null,
                filiere: contexte.filiere,
                annee: contexte.annee,
                groupe: contexte.groupeNom,
                module: s.moduleNom,
                objectifs: f.objectifs || s.objectif || "",
                modalite: f.modalite,
                fichiers: f.fichiers,
                motivation: f.motivation,
                plan: f.plan,
                developpement: f.developpement,
                evaluation: f.evaluation,
                prochaine: f.prochaine,
              },
            };
          }),
          `classeur-${slugify(
            `${contexte.groupeNom} ${debut} ${fin}`,
            "classeur",
          )}.pdf`,
        );

        toast(
          sansFiche > 0
            ? `Classeur de ${fiches.length} fiches — ${sansFiche} séance${
                sansFiche > 1 ? "s" : ""
              } sans fiche écartée${sansFiche > 1 ? "s" : ""}.`
            : `Classeur de ${fiches.length} fiches téléchargé`,
        );
      } catch (e) {
        toast(e instanceof Error ? e.message : "Export impossible.", "error");
      }
    });
  }

  return (
    <section className="mt-6 rounded-xl border border-border bg-surface p-4">
      <h3 className="flex items-center gap-1.5 text-sm font-medium text-ink">
        <FolderDown className="h-4 w-4 text-slate" aria-hidden />
        Classeur pédagogique
      </h3>
      <p className="mt-1 text-xs text-slate">
        Les fiches d&apos;une période reliées en un seul document, dans la forme
        attendue du cahier du formateur.
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-xs text-slate">Module</span>
          <select
            value={moduleId}
            onChange={(e) => setModuleId(e.target.value)}
            className={inputStyles}
          >
            <option value="tous">Tous les modules</option>
            {contexte.modules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.code ? `${m.code} — ${m.nom}` : m.nom}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-slate">Du</span>
          <Input
            type="date"
            value={debut}
            onChange={(e) => setDebut(e.target.value)}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-slate">Au</span>
          <Input
            type="date"
            value={fin}
            min={debut || undefined}
            onChange={(e) => setFin(e.target.value)}
          />
        </label>

        <Button
          icon={FolderDown}
          onClick={exporter}
          disabled={enCours || !debut || !fin}
          loading={enCours}
          loadingLabel="Assemblage…"
        >
          Exporter le classeur
        </Button>
      </div>
    </section>
  );
}
