"use client";

import { useMemo, useState, useTransition } from "react";
import Button from "@/components/ui/Button";
import Input, { inputStyles } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { formatDate, formatDateJour, slugify } from "@/lib/format";
import { lireFiche } from "@/components/FicheSeance";
import { getFichesPeriode, type GroupeClasseur } from "@/app/actions/classeur";
import { getEtablissement } from "@/app/actions/etablissement";
import { marqueDe } from "@/lib/pdf-marque";
import { FolderDown } from "lucide-react";

/** Premier et dernier jour du mois en cours, la période qu'on exporte le plus. */
function moisCourant(): { debut: string; fin: string } {
  const maintenant = new Date();
  const premier = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1);
  const dernier = new Date(
    maintenant.getFullYear(),
    maintenant.getMonth() + 1,
    0,
  );
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
  return { debut: iso(premier), fin: iso(dernier) };
}

/**
 * Export du classeur pédagogique.
 *
 * Il vivait dans l'onglet Fiches d'un groupe, ce qui le limitait à ce groupe
 * alors que le document remis couvre toute la charge du formateur. Il est donc
 * remonté au niveau du compte, avec deux filtres facultatifs — un groupe, un
 * module — au lieu d'un périmètre imposé par la page où l'on se trouve.
 */
export default function ClasseurExport({
  groupes,
}: {
  groupes: GroupeClasseur[];
}) {
  const toast = useToast();
  const [enCours, startTransition] = useTransition();
  const defaut = moisCourant();
  const [groupeId, setGroupeId] = useState("tous");
  const [moduleId, setModuleId] = useState("tous");
  const [debut, setDebut] = useState(defaut.debut);
  const [fin, setFin] = useState(defaut.fin);

  const groupe = groupes.find((g) => g.id === groupeId) ?? null;

  // Sans groupe choisi, on propose l'union des modules — dédoublonnée, un même
  // module étant souvent enseigné à plusieurs groupes.
  const modules = useMemo(() => {
    const source = groupe ? groupe.modules : groupes.flatMap((g) => g.modules);
    const vus = new Map<string, { id: string; nom: string; code: string | null }>();
    for (const m of source) if (!vus.has(m.id)) vus.set(m.id, m);
    return [...vus.values()].sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  }, [groupe, groupes]);

  function changerGroupe(id: string) {
    setGroupeId(id);
    setModuleId("tous");
  }

  function exporter() {
    startTransition(async () => {
      try {
        const { fiches, sansFiche } = await getFichesPeriode(
          groupeId === "tous" ? null : groupeId,
          moduleId === "tous" ? null : moduleId,
          debut,
          fin,
        );

        if (fiches.length === 0) {
          toast("Aucune fiche enregistrée sur cette période.", "error");
          return;
        }

        const moduleChoisi = modules.find((m) => m.id === moduleId);
        const [{ telechargerClasseurPdf }, marque] = await Promise.all([
          import("@/lib/pdf-classeur"),
          getEtablissement(),
        ]);

        await telechargerClasseurPdf(
          {
            filiere: groupe ? groupe.filiere : "Toutes les filières",
            groupe: groupe ? groupe.nom : "Tous les groupes",
            module: moduleChoisi
              ? `${moduleChoisi.code ? `${moduleChoisi.code} — ` : ""}${moduleChoisi.nom}`
              : "Tous les modules",
            debut: formatDate(debut),
            fin: formatDate(fin),
          },
          fiches.map((s) => {
            const f = lireFiche(s.contenu);
            return {
              date: s.date ? formatDateJour(s.date) : null,
              fiche: {
                nature: f.nature,
                date: s.date ? formatDateJour(s.date) : null,
                dureeHeures: s.dureeMinutes ? s.dureeMinutes / 60 : null,
                filiere: s.filiere,
                annee: s.annee,
                groupe: s.groupeNom,
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
            `${groupe ? groupe.nom : "tous-groupes"} ${debut} ${fin}`,
            "classeur",
          )}.pdf`,
          marqueDe(marque),
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
    <section
      aria-label="Paramètres de l'export"
      className="mt-6 max-w-[860px] rounded-[14px] border border-border bg-surface p-[26px] shadow-repos"
    >
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
        <label className="flex flex-col gap-[7px]">
          <span className="text-sm font-semibold text-body">Groupe</span>
          <select
            value={groupeId}
            onChange={(e) => changerGroupe(e.target.value)}
            className={inputStyles}
          >
            <option value="tous">Tous les groupes</option>
            {groupes.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nom}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-[7px]">
          <span className="text-sm font-semibold text-body">Module</span>
          <select
            value={moduleId}
            onChange={(e) => setModuleId(e.target.value)}
            className={inputStyles}
          >
            <option value="tous">Tous les modules</option>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.code ? `${m.code} — ${m.nom}` : m.nom}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-[7px]">
          <span className="text-sm font-semibold text-body">Du</span>
          <Input
            type="date"
            value={debut}
            onChange={(e) => setDebut(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-[7px]">
          <span className="text-sm font-semibold text-body">Au</span>
          <Input
            type="date"
            value={fin}
            min={debut || undefined}
            onChange={(e) => setFin(e.target.value)}
          />
        </label>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-separator pt-5">
        <span className="text-[13.5px] text-slate-light">
          Les séances sans fiche enregistrée sont écartées ; leur nombre vous
          est indiqué après l&apos;export.
        </span>
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
