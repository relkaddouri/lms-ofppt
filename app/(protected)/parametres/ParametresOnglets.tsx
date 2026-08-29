"use client";

import { useState } from "react";
import Segments from "@/components/ui/Segments";
import ParametresLlmForm from "./ParametresLlmForm";
import ParametresHeuresForm from "./ParametresHeuresForm";
import type { ParametresLlm } from "@/app/actions/parametres-llm";
import type { ParametresFormateur } from "@/app/actions/heures";

const ONGLETS = [
  { cle: "heures", libelle: "Ma charge horaire" },
  { cle: "llm", libelle: "Modèle de langage" },
] as const;

type Onglet = (typeof ONGLETS)[number]["cle"];

/**
 * Deux réglages sans rapport l'un avec l'autre : la charge horaire du
 * formateur et le fournisseur d'intelligence artificielle. Les empiler sur une
 * seule page obligeait à traverser l'un pour atteindre l'autre.
 */
export default function ParametresOnglets({
  llm,
  heures,
}: {
  llm: ParametresLlm | null;
  heures: ParametresFormateur;
}) {
  const [onglet, setOnglet] = useState<Onglet>("heures");

  return (
    <div className="flex flex-col gap-6">
      <Segments
        ariaLabel="Sections des paramètres"
        valeur={onglet}
        onChange={setOnglet}
        options={ONGLETS.map((o) => ({ valeur: o.cle, libelle: o.libelle }))}
      />

      {onglet === "heures" ? (
        <ParametresHeuresForm initial={heures} />
      ) : (
        <ParametresLlmForm initial={llm} />
      )}
    </div>
  );
}
