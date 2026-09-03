"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Lock } from "lucide-react";
import Segments from "@/components/ui/Segments";
import ParametresLlmForm from "./ParametresLlmForm";
import ParametresHeuresForm from "./ParametresHeuresForm";
import ParametresEtablissementForm from "./ParametresEtablissementForm";
import type { ParametresLlm } from "@/app/actions/parametres-llm";
import type { ParametresFormateur } from "@/app/actions/heures";
import type { Etablissement } from "@/app/actions/etablissement";

const ONGLETS = [
  { cle: "heures", libelle: "Ma charge horaire" },
  { cle: "etablissement", libelle: "Établissement" },
  { cle: "llm", libelle: "Modèle de langage" },
] as const;

type Onglet = (typeof ONGLETS)[number]["cle"];

/**
 * Trois réglages sans rapport les uns avec les autres : la charge horaire du
 * formateur, l'identité de son établissement et le fournisseur d'intelligence
 * artificielle. Les empiler sur une seule page obligeait à traverser l'un pour
 * atteindre l'autre.
 */
export default function ParametresOnglets({
  llm,
  heures,
  etablissement,
}: {
  llm: ParametresLlm | null;
  heures: ParametresFormateur;
  etablissement: Etablissement;
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

      {onglet === "heures" ? <ParametresHeuresForm initial={heures} /> : null}
      {onglet === "etablissement" ? (
        <ParametresEtablissementForm initial={etablissement} />
      ) : null}
      {onglet === "llm" ? <ParametresLlmForm initial={llm} /> : null}

      {/* Le journal n'est pas un réglage : il ne se règle pas, il se
          consulte. Il a donc son écran, atteint depuis ici. */}
      <Link
        href="/parametres/journal"
        className="flex items-center gap-3.5 rounded-[14px] border border-border bg-surface px-6 py-5 no-underline shadow-repos transition-colors duration-150 ease-out hover:border-border-strong hover:no-underline"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-wash">
          <Lock size={17} className="text-slate-2" aria-hidden />
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="font-display text-[15.5px] font-semibold text-ink">
            Journal d&apos;audit
          </span>
          <span className="text-[14px] text-slate-light">
            Les modifications portées aux fiches, contrôles et notes. Lecture
            seule.
          </span>
        </span>
        <ChevronRight size={18} className="ml-auto shrink-0 text-muted" aria-hidden />
      </Link>
    </div>
  );
}
