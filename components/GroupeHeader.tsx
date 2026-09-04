"use client";

import { usePathname } from "next/navigation";
import { useToast } from "./ui/Toast";
import Breadcrumb from "./Breadcrumb";
import type { Groupe } from "@/app/actions/groupes";
import Button from "@/components/ui/Button";
import { formatDateJour } from "@/lib/format";
import { ONGLETS_GROUPE, ongletGroupeActif } from "@/lib/navigation";

export default function GroupeHeader({
  groupe,
  stagiairesCount,
}: {
  groupe: Groupe;
  stagiairesCount: number;
}) {
  const toast = useToast();
  const pathname = usePathname();


  const items: { label: string; href?: string }[] = [
    { label: "Groupes", href: "/groupes" },
    { label: groupe.nom, href: `/groupes/${groupe.id}` },
  ];
  const onglet = ongletGroupeActif(pathname);
  if (onglet.key !== ONGLETS_GROUPE[0].key) items.push({ label: onglet.label });

  const numero =
    groupe.nom.match(/(\d{2,4})$/)?.[1] ?? groupe.nom.slice(0, 2).toUpperCase();

  return (
    <div className="flex flex-col gap-5">
      <Breadcrumb items={items} />

      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="flex min-w-0 items-start gap-4">
          <span className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-xl bg-ink font-mono text-base font-semibold text-white">
            {numero}
          </span>
          <div className="flex min-w-0 flex-col gap-2">
            <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.02em] text-ink">
              {groupe.nom}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              {groupe.annee ? (
                <span className="rounded-full border border-tint-teal-strong bg-tint-teal px-2.5 py-1 text-[12.5px] font-semibold text-teal-dark">
                  {groupe.annee === 1 ? "1ʳᵉ" : `${groupe.annee}ᵉ`} année
                </span>
              ) : null}
              {groupe.specialite ? (
                <span className="rounded-full border border-border bg-wash-strong px-2.5 py-1 text-[12.5px] font-semibold text-slate-2">
                  {groupe.specialite}
                </span>
              ) : null}
              <span className="rounded-full border border-border bg-wash-strong px-2.5 py-1 text-[12.5px] font-semibold text-slate-2">
                {stagiairesCount} stagiaire{stagiairesCount > 1 ? "s" : ""}
              </span>
              {/* La période se lit sur les séances placées, pas sur une
                  saisie : tant que l'emploi du temps n'est pas généré, il
                  n'y a rien d'honnête à afficher. */}
              {groupe.date_debut ? (
                <span className="font-mono text-[13px] text-slate-light">
                  {formatDateJour(groupe.date_debut, { court: true })} →{" "}
                  {formatDateJour(groupe.date_fin, { court: true })}
                </span>
              ) : (
                <span className="font-mono text-[13px] text-muted">
                  emploi du temps à générer
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2.5">
          {/* Présents parce que la maquette les montre ; l'export du classeur
              vit dans l'onglet Fiches et la planification dans un module. */}
          <Button variant="secondary" disabled title="L'export vit dans l'onglet Fiches">
            Exporter
          </Button>
          <Button disabled title="La planification se fait depuis un module du groupe">
            Planifier une séance
          </Button>
        </div>
      </div>
    </div>
  );
}
