"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { FileDown, Sheet } from "lucide-react";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { maintenant, slugify } from "@/lib/format";
import { libelleAnnee } from "@/lib/modules";
import { marqueDe } from "@/lib/pdf-marque";
import { heuresPortees, type LigneService } from "@/lib/tableau-service";
import type { Etablissement } from "@/app/actions/etablissement";

/**
 * Tableau de service (PRD §4.13bis), sur la structure d'un exemplaire signé.
 *
 * Chaque ligne porte quatre valeurs — présentiel et distance, croisés avec le
 * semestre — et non un total unique. La part à distance d'un module partagé
 * entre deux groupes n'est portée que par une seule des deux lignes : les
 * cellules de l'autre restent vides, comme sur le document officiel. C'est ce
 * qui sépare la charge réelle du formateur de la progression cumulée de ses
 * groupes, deux totaux qui n'ont jamais été censés être égaux.
 */

const COLONNES = [
  { cle: "filiere", titre: "Filière" },
  { cle: "groupe", titre: "Groupe" },
  { cle: "annee", titre: "Année de formation" },
  { cle: "code", titre: "Code module" },
  { cle: "module", titre: "Module" },
  { cle: "pS1", titre: "MHT AFF P S1", nombre: true },
  { cle: "sS1", titre: "MHT AFF S S1", nombre: true },
  { cle: "pS2", titre: "MHT AFF P S2", nombre: true },
  { cle: "sS2", titre: "MHT AFF S S2", nombre: true },
] as const;

const GRILLE =
  "grid grid-cols-[150px_90px_80px_74px_minmax(180px,1fr)_76px_76px_76px_76px] items-center gap-3";

export default function TableauService({
  lignes,
  specialite,
  etablissement,
  emailCompte,
}: {
  lignes: LigneService[];
  specialite: string | null;
  etablissement: Etablissement;
  emailCompte: string;
}) {
  const toast = useToast();
  const [enCours, startTransition] = useTransition();
  const [annee, setAnnee] = useState("tous");

  // À défaut de nom réglé, l'adresse du compte : un document sans formateur
  // identifié ne se signe pas.
  const formateur = etablissement.nomFormateur ?? emailCompte;

  const annees = useMemo(
    () =>
      [...new Set(lignes.map((l) => l.annee).filter((a): a is number => a !== null))].sort(),
    [lignes],
  );

  const visibles = useMemo(
    () => (annee === "tous" ? lignes : lignes.filter((l) => String(l.annee) === annee)),
    [lignes, annee],
  );

  const total = useMemo(
    () =>
      visibles.reduce(
        (t, l) => {
          const h = heuresPortees(l);
          return {
            pS1: t.pS1 + h.pS1,
            sS1: t.sS1 + h.sS1,
            pS2: t.pS2 + h.pS2,
            sS2: t.sS2 + h.sS2,
          };
        },
        { pS1: 0, sS1: 0, pS2: 0, sS2: 0 },
      ),
    [visibles],
  );

  const general = total.pS1 + total.sS1 + total.pS2 + total.sS2;

  const entete = {
    marque: marqueDe(etablissement),
    codeSecteur: etablissement.codeSecteur,
    formateur,
    specialite,
    niveauFormation: etablissement.niveauFormation,
    anneeScolaire: etablissement.anneeScolaire,
    matricule: etablissement.matricule,
  };

  const pourExport = () =>
    visibles.map((l) => ({
      filiere: l.filiere,
      groupe: l.groupe,
      annee: l.annee ? String(l.annee) : "",
      codeModule: l.codeModule ?? "",
      module: l.module,
      pS1: l.presentielS1,
      sS1: l.fadS1,
      pS2: l.presentielS2,
      sS2: l.fadS2,
      fadMutualisee: l.fadMutualisee,
    }));

  const nomFichier = (ext: string) =>
    `tableau-de-service-${slugify(
      `${etablissement.anneeScolaire ?? maintenant()} ${
        annee === "tous" ? "" : libelleAnnee(Number(annee))
      }`,
      "tableau-de-service",
    )}.${ext}`;

  function exporterPdf() {
    startTransition(async () => {
      try {
        const { telechargerTableauServicePdf } = await import(
          "@/lib/pdf-tableau-service"
        );
        await telechargerTableauServicePdf(entete, pourExport(), nomFichier("pdf"));
        toast(`Tableau de service de ${visibles.length} lignes téléchargé`);
      } catch (e) {
        toast(e instanceof Error ? e.message : "Export impossible.", "error");
      }
    });
  }

  function exporterCsv() {
    // Point-virgule et BOM : c'est ce qu'attend un tableur configuré en
    // français, où la virgule est le séparateur décimal.
    const cel = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`;
    // Une cellule FAD vide, jamais un zéro : le document distingue « aucune
    // heure » de « portée par l'autre groupe ».
    const corps: (string | number)[][] = visibles.map((l) => [
      l.filiere,
      l.groupe,
      l.annee ?? "",
      l.codeModule ?? "",
      l.module,
      l.presentielS1,
      l.fadMutualisee ? "" : l.fadS1,
      l.presentielS2,
      l.fadMutualisee ? "" : l.fadS2,
    ]);

    const pied = ["Total", "", "", "", "", total.pS1, total.sS1, total.pS2, total.sS2];
    const general2 = ["MHT AFF S1+S2 (P+S)", "", "", "", "", "", "", "", general];

    const csv = [COLONNES.map((c) => c.titre), ...corps, pied, general2]
      .map((r) => r.map(cel).join(";"))
      .join("\r\n");

    const lien = document.createElement("a");
    lien.href = URL.createObjectURL(
      new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }),
    );
    lien.download = nomFichier("csv");
    lien.click();
    URL.revokeObjectURL(lien.href);
    toast(`${visibles.length} lignes exportées`);
  }

  const manquants = [
    !etablissement.codeSecteur && "le code secteur",
    !etablissement.niveauFormation && "le niveau de formation",
    !etablissement.anneeScolaire && "l'année scolaire",
    !etablissement.matricule && "le matricule",
    !etablissement.nomFormateur && "votre nom",
  ].filter(Boolean) as string[];

  return (
    <div className="flex flex-col gap-6 px-6 py-10 md:px-10 md:pb-14">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[11.5px] uppercase tracking-[0.12em] text-slate-light">
            Document officiel
          </span>
          <h1 className="font-display text-[34px] font-bold leading-tight tracking-[-0.02em] text-ink">
            Tableau de service
            {etablissement.anneeScolaire ? (
              <span className="text-slate-light">
                {" "}
                {etablissement.anneeScolaire}
              </span>
            ) : null}
          </h1>
          <p className="text-base text-slate-2">
            Vos affectations horaires de l&apos;année, dans la forme que fait
            signer la Direction Régionale.{" "}
            <span className="font-mono text-body">
              {visibles.length} ligne{visibles.length > 1 ? "s" : ""}
            </span>{" "}
            · <span className="font-mono text-body">{general} h</span> de charge.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            icon={Sheet}
            onClick={exporterCsv}
            disabled={visibles.length === 0}
          >
            Exporter en CSV
          </Button>
          <Button
            icon={FileDown}
            onClick={exporterPdf}
            disabled={enCours || visibles.length === 0}
            loading={enCours}
            loadingLabel="Mise en page…"
          >
            Exporter le tableau
          </Button>
        </div>
      </header>

      {/* Le bloc d'identité du document officiel, tel qu'il sera imprimé. */}
      <section
        aria-label="En-tête du document"
        className="flex flex-wrap gap-x-10 gap-y-3 rounded-[14px] border border-border bg-surface px-6 py-4 shadow-repos"
      >
        {[
          ["Code secteur", etablissement.codeSecteur],
          ["Formateur", formateur],
          ["Spécialité", specialite],
          ["Niveau de formation", etablissement.niveauFormation],
          ["Matricule", etablissement.matricule],
        ].map(([libelle, valeur]) => (
          <span key={libelle} className="flex flex-col gap-0.5">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-slate-light">
              {libelle}
            </span>
            <span className="text-[14.5px] text-ink">
              {valeur || <span className="text-muted">à renseigner</span>}
            </span>
          </span>
        ))}
      </section>

      {annees.length > 1 ? (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 rounded-[11px] border border-border bg-wash-strong p-1">
            {[
              { valeur: "tous", libelle: "Toutes" },
              ...annees.map((a) => ({ valeur: String(a), libelle: libelleAnnee(a) })),
            ].map((o) => (
              <button
                key={o.valeur}
                type="button"
                onClick={() => setAnnee(o.valeur)}
                aria-pressed={annee === o.valeur}
                className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors duration-150 ease-out ${
                  annee === o.valeur
                    ? "bg-surface text-ink shadow-[0_1px_2px_rgba(46,59,78,0.12)]"
                    : "text-slate-2 hover:text-ink"
                }`}
              >
                {o.libelle}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[14px] border border-border bg-surface shadow-repos">
        <div className="overflow-x-auto">
          <div className="min-w-[960px]">
            <div className={`${GRILLE} border-b border-border bg-paper-alt px-6 py-3`}>
              {COLONNES.map((c) => (
                <span
                  key={c.cle}
                  className={`font-mono text-[10.5px] uppercase leading-tight tracking-[0.08em] text-slate-light ${
                    "nombre" in c ? "text-right" : ""
                  }`}
                >
                  {c.titre}
                </span>
              ))}
            </div>

            {visibles.length === 0 ? (
              <div className="flex flex-col items-center gap-1 px-6 py-14 text-center">
                <span className="text-[15px] font-semibold text-ink">
                  Aucune affectation
                </span>
                <span className="text-[13.5px] text-slate-light">
                  Le tableau se remplit dès qu&apos;un module est affecté à un
                  groupe.
                </span>
              </div>
            ) : (
              <>
                {visibles.map((l, i) => {
                  // Le document sépare les années : sans ce filet, le passage
                  // du tronc commun à la spécialisation ne se voit pas.
                  const rupture = i > 0 && visibles[i - 1].annee !== l.annee;
                  return (
                    <div
                      key={l.id}
                      className={`${GRILLE} border-b border-separator px-6 py-3 transition-colors duration-150 ease-out last:border-0 hover:bg-paper ${
                        rupture ? "border-t-2 border-t-border-strong" : ""
                      }`}
                    >
                      <span className="truncate text-[13.5px] text-slate-2" title={l.filiere}>
                        {l.filiere}
                      </span>
                      <span className="text-[14.5px] font-semibold text-ink">
                        {l.groupe}
                      </span>
                      <span className="text-[14px] text-slate-2">
                        {l.annee ?? "—"}
                      </span>
                      <span className="font-mono text-[12.5px] font-semibold text-slate-2">
                        {l.codeModule ?? "—"}
                      </span>
                      <span className="truncate text-[14px] text-body" title={l.module}>
                        {l.module}
                      </span>
                      <span className="text-right font-mono text-[14.5px] text-ink">
                        {l.presentielS1}
                      </span>
                      <span
                        className="text-right font-mono text-[14.5px] text-ink"
                        title={
                          l.fadMutualisee
                            ? `${l.fadS1} h portées par l'autre groupe`
                            : undefined
                        }
                      >
                        {l.fadMutualisee ? (
                          <span className="text-muted">—</span>
                        ) : (
                          l.fadS1
                        )}
                      </span>
                      <span className="text-right font-mono text-[14.5px] text-ink">
                        {l.presentielS2}
                      </span>
                      <span
                        className="text-right font-mono text-[14.5px] text-ink"
                        title={
                          l.fadMutualisee
                            ? `${l.fadS2} h portées par l'autre groupe`
                            : undefined
                        }
                      >
                        {l.fadMutualisee ? (
                          <span className="text-muted">—</span>
                        ) : (
                          l.fadS2
                        )}
                      </span>
                    </div>
                  );
                })}

                <div className={`${GRILLE} border-t border-border bg-paper-alt px-6 py-3`}>
                  <span className="col-span-5 text-right text-[14.5px] font-semibold text-ink">
                    Total
                  </span>
                  {[total.pS1, total.sS1, total.pS2, total.sS2].map((v, i) => (
                    <span
                      key={i}
                      className="text-right font-mono text-[15px] font-bold text-ink"
                    >
                      {v}
                    </span>
                  ))}
                </div>

                <div className={`${GRILLE} border-t border-border bg-wash px-6 py-3.5`}>
                  <span className="col-span-8 text-right font-mono text-[12px] uppercase tracking-[0.08em] text-slate-2">
                    MHT AFF S1+S2 (P+S)
                  </span>
                  <span className="text-right font-display text-[18px] font-bold text-ink">
                    {general}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <p className="max-w-[820px] text-[13.5px] text-slate-light">
        Un tiret dans une colonne <span className="font-semibold text-slate-2">S</span>{" "}
        signale une part à distance <span className="font-semibold text-slate-2">partagée</span>{" "}
        avec un autre groupe : le groupe en est bien crédité pour sa progression,
        mais vous ne la dispensez qu&apos;une fois, donc elle ne compte qu&apos;une
        fois ici.
        {manquants.length ? (
          <>
            {" "}
            L&apos;en-tête du document imprimé attend encore{" "}
            {manquants.join(", ")} —{" "}
            <Link href="/parametres" className="font-semibold">
              à renseigner dans Paramètres
            </Link>
            .
          </>
        ) : null}
      </p>
    </div>
  );
}
