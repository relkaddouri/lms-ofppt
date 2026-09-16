"use client";

import ReponseMarkdown from "@/components/ReponseMarkdown";
import { Table2 } from "lucide-react";

/**
 * Les données d'une question de contrôle (PRD §4.7bis, migration 088).
 *
 * Observations d'utilisateurs, tableau, extrait de cahier des charges : ce sur
 * quoi le stagiaire travaille. Il passe le contrôle en ligne et n'a rien
 * d'autre sous la main — ces données sont donc sur l'écran même où il
 * répond, entre l'énoncé et son champ de réponse.
 *
 * Rendues en Markdown pour les tableaux et les listes, par le même moteur que
 * les réponses du formateur : sûr par construction, aucun HTML interprété.
 * Un tableau large défile dans son cadre, jamais la page — le contrôle se
 * passe aussi depuis un téléphone.
 */
export default function DonneesQuestion({ texte }: { texte: string }) {
  return (
    <div className="mt-3 overflow-hidden rounded-[10px] border border-border bg-paper-alt">
      <p className="flex items-center gap-1.5 border-b border-separator px-3 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-slate-light">
        <Table2 className="h-3.5 w-3.5" aria-hidden />
        Données
      </p>
      <div className="px-3 py-3">
        <ReponseMarkdown texte={texte} camarades={[]} />
      </div>
    </div>
  );
}
