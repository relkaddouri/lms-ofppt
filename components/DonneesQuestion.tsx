"use client";

import { CorpsRedige } from "@/components/DocumentRedige";
import { Table2 } from "lucide-react";

/**
 * Les données d'une question de contrôle (PRD §4.7bis, migration 088).
 *
 * Observations d'utilisateurs, tableau, extrait de cahier des charges : ce sur
 * quoi le stagiaire travaille. Il passe le contrôle en ligne et n'a rien
 * d'autre sous la main — ces données sont donc sur l'écran même où il
 * répond, entre l'énoncé et son champ de réponse.
 *
 * Rendues par le même moteur que les supports de cours : tableaux à en-tête
 * encre, qui deviennent des blocs empilés sur téléphone, listes numérotées. Le
 * stagiaire lit ses données comme il lit ses cours. Aucun HTML interprété.
 */
export default function DonneesQuestion({ texte }: { texte: string }) {
  return (
    <section className="mt-4 overflow-hidden rounded-[12px] border border-border bg-paper-alt">
      <p className="flex items-center gap-1.5 border-b border-separator bg-surface px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-slate-light">
        <Table2 className="h-3.5 w-3.5" aria-hidden />
        Données
      </p>
      <div className="px-4 py-4 md:px-5">
        <CorpsRedige texte={texte} />
      </div>
    </section>
  );
}
