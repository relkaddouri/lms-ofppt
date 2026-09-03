"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { FileDown, Sheet } from "lucide-react";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formatDate, maintenant, slugify } from "@/lib/format";
import { libelleAnnee } from "@/lib/modules";
import type { LigneService } from "@/app/actions/tableau-service";
import type { Etablissement } from "@/app/actions/etablissement";
import { marqueDe, nomEtablissement } from "@/lib/pdf-marque";

/**
 * Tableau de service (PRD §4.13bis).
 *
 * Reproduction à l'écran du document que la Direction Régionale fait signer,
 * dans l'ordre de ses colonnes. Deux colonnes s'y ajoutent — Présentiel et
 * FAD — parce que le formateur suit cette décomposition pour lui-même ; deux
 * EFP porte le nom du centre réglé dans Paramètres. MUT reste vide faute de
 * donnée dans l'application, mais demeure visible pour que le tableau se
 * superpose au papier et se complète à la main.
 */

const COLONNES = [
  { cle: "date", titre: "Date d'affectation" },
  { cle: "filiere", titre: "Filière" },
  { cle: "annee", titre: "Année" },
  { cle: "groupe", titre: "Groupe" },
  { cle: "module", titre: "Module" },
  { cle: "mh", titre: "MH AFF", nombre: true },
  { cle: "presentiel", titre: "Présentiel", nombre: true, ajout: true },
  { cle: "fad", titre: "FAD", nombre: true, ajout: true },
  { cle: "mut", titre: "MUT", vide: true },
  { cle: "efp", titre: "EFP" },
] as const;

const GRILLE =
  "grid grid-cols-[100px_110px_70px_90px_minmax(170px,1fr)_76px_78px_64px_60px_140px] items-center gap-3";

export default function TableauService({
  lignes,
  formateur,
  etablissement,
}: {
  lignes: LigneService[];
  formateur: string;
  etablissement: Etablissement;
}) {
  const toast = useToast();
  const [enCours, startTransition] = useTransition();
  const [annee, setAnnee] = useState("tous");
  // Le même centre sur toutes les lignes, comme sur le document officiel où la
  // colonne EFP se répète.
  const centre = nomEtablissement(marqueDe(etablissement));

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
        (t, l) => ({
          mh: t.mh + l.mhAffectee,
          presentiel: t.presentiel + l.heuresPresentiel,
          fad: t.fad + l.heuresFad,
        }),
        { mh: 0, presentiel: 0, fad: 0 },
      ),
    [visibles],
  );

  const nomFichier = (ext: string) =>
    `tableau-de-service-${slugify(
      annee === "tous" ? maintenant() : `${libelleAnnee(Number(annee))} ${maintenant()}`,
      "tableau-de-service",
    )}.${ext}`;

  function exporterPdf() {
    startTransition(async () => {
      try {
        const { telechargerTableauServicePdf } = await import("@/lib/pdf-tableau-service");
        await telechargerTableauServicePdf(
          {
            marque: marqueDe(etablissement),
            formateur,
            edite: formatDate(maintenant()),
          },
          visibles.map((l) => ({
            dateAffectation: l.dateAffectation ? formatDate(l.dateAffectation) : "",
            filiere: l.filiere,
            annee: l.annee ? String(l.annee) : "",
            groupe: l.groupe,
            codeModule: l.codeModule ?? "",
            module: l.module,
            mhAffectee: l.mhAffectee,
            heuresPresentiel: l.heuresPresentiel,
            heuresFad: l.heuresFad,
          })),
          nomFichier("pdf"),
        );
        toast(`Tableau de service de ${visibles.length} lignes téléchargé`);
      } catch (e) {
        toast(e instanceof Error ? e.message : "Export impossible.", "error");
      }
    });
  }

  function exporterCsv() {
    // Point-virgule et BOM : c'est ce qu'attend un tableur configuré en
    // français, où la virgule est le séparateur décimal.
    const cellule = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`;
    const entete = COLONNES.map((c) => c.titre);
    const corps = visibles.map((l) => [
      l.dateAffectation ? formatDate(l.dateAffectation) : "",
      l.filiere,
      l.annee ?? "",
      l.groupe,
      l.codeModule ? `${l.codeModule} — ${l.module}` : l.module,
      l.mhAffectee,
      l.heuresPresentiel,
      l.heuresFad,
      "",
      centre,
    ]);
    const pied = ["Total général", "", "", "", "", total.mh, total.presentiel, total.fad, "", ""];

    const csv = [entete, ...corps, pied].map((r) => r.map(cellule).join(";")).join("\r\n");
    const lien = document.createElement("a");
    lien.href = URL.createObjectURL(
      new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }),
    );
    lien.download = nomFichier("csv");
    lien.click();
    URL.revokeObjectURL(lien.href);
    toast(`${visibles.length} lignes exportées`);
  }

  return (
    <div className="flex flex-col gap-6 px-6 py-10 md:px-10 md:pb-14">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[11.5px] uppercase tracking-[0.12em] text-slate-light">
            Document officiel
          </span>
          <h1 className="font-display text-[34px] font-bold leading-tight tracking-[-0.02em] text-ink">
            Tableau de service
          </h1>
          <p className="text-base text-slate-2">
            Vos affectations horaires de l&apos;année, dans la forme que fait signer la
            Direction Régionale.{" "}
            <span className="font-mono text-body">{visibles.length} ligne
            {visibles.length > 1 ? "s" : ""}</span>{" "}
            · <span className="font-mono text-body">{total.mh} h</span> au total.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" icon={Sheet} onClick={exporterCsv} disabled={visibles.length === 0}>
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
          <div className="min-w-[1060px]">
            <div className={`${GRILLE} border-b border-border bg-paper-alt px-6 py-3.5`}>
              {COLONNES.map((c) => (
                <span
                  key={c.cle}
                  className={`font-mono text-[11px] uppercase tracking-[0.1em] ${
                    "ajout" in c || "vide" in c ? "text-muted" : "text-slate-light"
                  } ${"nombre" in c ? "text-right" : ""}`}
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
                  Le tableau se remplit dès qu&apos;un module est affecté à un groupe.
                </span>
              </div>
            ) : (
              <>
                {visibles.map((l) => (
                  <div
                    key={l.id}
                    className={`${GRILLE} border-b border-separator px-6 py-3.5 transition-colors duration-150 ease-out last:border-0 hover:bg-paper`}
                  >
                    <span className="font-mono text-[13px] text-slate-2">
                      {l.dateAffectation ? formatDate(l.dateAffectation) : "—"}
                    </span>
                    <span className="truncate text-[14px] text-slate-2">{l.filiere}</span>
                    <span className="text-[14px] text-slate-2">
                      {l.annee ? libelleAnnee(l.annee) : "—"}
                    </span>
                    <span className="text-[14.5px] font-semibold text-ink">{l.groupe}</span>
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-7 shrink-0 items-center justify-center rounded-[7px] bg-wash px-2 font-mono text-[11.5px] font-semibold text-slate-2">
                        {l.codeModule ?? "—"}
                      </span>
                      <span className="truncate text-[14px] text-body" title={l.module}>
                        {l.module}
                      </span>
                    </span>
                    <span className="text-right font-mono text-[14.5px] font-semibold text-ink">
                      {l.mhAffectee}
                    </span>
                    <span className="text-right font-mono text-[14px] text-slate-2">
                      {l.heuresPresentiel}
                    </span>
                    <span className="text-right font-mono text-[14px] text-slate-2">
                      {l.heuresFad}
                    </span>
                    <span aria-hidden className="text-[14px] text-muted">
                      —
                    </span>
                    <span
                      className="truncate text-[13px] text-slate-2"
                      title={centre}
                    >
                      {centre}
                    </span>
                  </div>
                ))}

                <div className={`${GRILLE} border-t border-border bg-paper-alt px-6 py-4`}>
                  <span className="col-span-5 text-[14.5px] font-semibold text-ink">
                    Total général
                  </span>
                  <span className="text-right font-mono text-[15px] font-bold text-ink">
                    {total.mh}
                  </span>
                  <span className="text-right font-mono text-[14px] text-slate-2">
                    {total.presentiel}
                  </span>
                  <span className="text-right font-mono text-[14px] text-slate-2">
                    {total.fad}
                  </span>
                  <span aria-hidden />
                  <span aria-hidden />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <p className="max-w-[820px] text-[13.5px] text-slate-light">
        <span className="font-semibold text-slate-2">Présentiel</span> et{" "}
        <span className="font-semibold text-slate-2">FAD</span> ne figurent pas sur le
        document officiel : elles décomposent la masse horaire affectée pour votre
        propre suivi. <span className="font-semibold text-slate-2">EFP</span> reprend
        le nom du centre réglé dans{" "}
        <Link href="/parametres">Paramètres</Link>, où se dépose aussi le logo
        imprimé en tête des documents.{" "}
        <span className="font-semibold text-slate-2">MUT</span> reste vide —
        l&apos;application ne détient pas cette donnée — et se complète à la main
        sur le document imprimé.
      </p>
    </div>
  );
}
