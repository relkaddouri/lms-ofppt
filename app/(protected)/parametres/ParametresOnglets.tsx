"use client";

import { useState } from "react";
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
    <>
      <div
        role="tablist"
        aria-label="Sections des paramètres"
        className="mt-5 flex gap-1 border-b border-border"
      >
        {ONGLETS.map((o) => (
          <button
            key={o.cle}
            type="button"
            role="tab"
            aria-selected={onglet === o.cle}
            onClick={() => setOnglet(o.cle)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm ${
              onglet === o.cle
                ? "border-forest font-medium text-forest"
                : "border-transparent text-slate hover:text-ink"
            }`}
          >
            {o.libelle}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {onglet === "heures" ? (
          <ParametresHeuresForm initial={heures} />
        ) : (
          <>
            <p className="mb-4 text-sm text-slate">
              Le modèle utilisé pour générer les contrôles, les fiches de
              préparation et les corrigés.
            </p>
            <ParametresLlmForm initial={llm} />
          </>
        )}
      </div>
    </>
  );
}
