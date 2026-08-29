"use client";

import { useState, type ReactNode } from "react";
import BarreSuivi, { type Vue } from "./BarreSuivi";
import type { Seance } from "@/app/actions/seances";

/**
 * Enveloppe le suivi des séances : barre d'outils partagée par les deux vues,
 * puis la vue tableau (rendue par la barre) ou la vue liste (le regroupement
 * par module et par objectif, passé en enfant depuis le serveur).
 */
export default function SuiviSeances({
  groupeId,
  seances,
  enfants,
}: {
  groupeId: string;
  seances: Seance[];
  /** Vue liste : le plan par module, rendu côté serveur. */
  enfants: ReactNode;
}) {
  const [vue, setVue] = useState<Vue>("liste");
  const [filtre, setFiltre] = useState("");

  return (
    <div className="flex flex-col gap-5">
      <BarreSuivi
        groupeId={groupeId}
        seances={seances}
        vue={vue}
        onVueChange={setVue}
        filtre={filtre}
        onFiltreChange={setFiltre}
      />
      {vue === "liste" ? enfants : null}
    </div>
  );
}
