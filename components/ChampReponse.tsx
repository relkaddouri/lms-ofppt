"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  LayoutTemplate,
  List,
  ListOrdered,
  Table2,
} from "lucide-react";
import AutoTextarea from "@/components/ui/AutoTextarea";
import Segments from "@/components/ui/Segments";
import { CorpsRedige } from "@/components/DocumentRedige";
import { useMiseEnForme } from "@/components/ui/useMiseEnForme";
import { GABARITS } from "@/lib/gabarits-reponse";

type Vue = "ecrire" | "apercu";

/**
 * La copie du stagiaire : écrire, et voir ce qu'on rend.
 *
 * Un contrôle de M202 demande une fiche persona, une empathy map, une user
 * journey map — et la zone de réponse n'offrait qu'un `textarea`. Le stagiaire
 * avait le choix entre rendre un paragraphe là où on attendait un tableau, ou
 * compter ses barres verticales à la main sous le chronomètre. Le formateur,
 * lui, corrigeait des colonnes désalignées.
 *
 * L'aperçu passe par le même moteur que les cours et les données des
 * questions : le stagiaire voit sa copie rendue exactement comme il lit son
 * module. Rien de nouveau à charger sur cette page, et rien de nouveau à
 * comprendre.
 *
 * Ce qui part en base reste du texte. La correction, le PDF et l'affichage de
 * la copie le traitent sans changer d'un caractère.
 */
export default function ChampReponse({
  id,
  valeur,
  onChange,
  minRows,
  placeholder,
  ariaLabel,
  disabled = false,
}: {
  id: string;
  valeur: string;
  onChange: (valeur: string) => void;
  minRows: number;
  placeholder: string;
  ariaLabel: string;
  disabled?: boolean;
}) {
  const [vue, setVue] = useState<Vue>("ecrire");
  const [gabarits, setGabarits] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const { zone, entourer, prefixer, inserer } = useMiseEnForme(valeur, onChange);

  // Le menu se referme comme n'importe quel menu : en cliquant ailleurs, ou
  // avec Échap. Sans cela il resterait ouvert par-dessus la question suivante.
  useEffect(() => {
    if (!gabarits) return;
    const dehors = (e: MouseEvent) => {
      if (!menu.current?.contains(e.target as Node)) setGabarits(false);
    };
    const echap = (e: KeyboardEvent) => {
      if (e.key === "Escape") setGabarits(false);
    };
    document.addEventListener("mousedown", dehors);
    document.addEventListener("keydown", echap);
    return () => {
      document.removeEventListener("mousedown", dehors);
      document.removeEventListener("keydown", echap);
    };
  }, [gabarits]);

  const outils = [
    { libelle: "Gras", Icone: Bold, agir: () => entourer("**", "**", "texte en gras") },
    {
      libelle: "Italique",
      Icone: Italic,
      agir: () => entourer("*", "*", "texte en italique"),
    },
    { libelle: "Liste à puces", Icone: List, agir: () => prefixer(() => "- ") },
    {
      libelle: "Liste numérotée",
      Icone: ListOrdered,
      agir: () => prefixer((i) => `${i + 1}. `),
    },
    {
      libelle: "Tableau",
      Icone: Table2,
      agir: () => inserer(GABARITS[0]!.bloc),
    },
  ];

  const mots = valeur.trim() ? valeur.trim().split(/\s+/).length : 0;

  return (
    <div className="overflow-hidden rounded-[12px] border border-border-strong bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-separator bg-paper-alt px-2 py-1.5">
        {/* Les outils n'agissent que sur un texte visible : en aperçu, ils
            modifieraient à l'aveugle. */}
        <div
          role="toolbar"
          aria-label="Mise en forme de votre réponse"
          className={`flex flex-wrap items-center gap-0.5 ${vue === "apercu" ? "invisible" : ""}`}
        >
          {outils.map(({ libelle, Icone, agir }) => (
            <button
              key={libelle}
              type="button"
              onClick={agir}
              title={libelle}
              aria-label={libelle}
              disabled={disabled}
              className="flex h-11 w-11 items-center justify-center rounded-[8px] text-slate-2 transition-colors duration-150 ease-out hover:bg-wash hover:text-ink disabled:opacity-60 md:h-8 md:w-8"
            >
              <Icone className="h-4 w-4" aria-hidden />
            </button>
          ))}

          <div className="relative" ref={menu}>
            <button
              type="button"
              onClick={() => setGabarits((o) => !o)}
              disabled={disabled}
              aria-expanded={gabarits}
              aria-haspopup="menu"
              className="flex h-11 items-center gap-1.5 rounded-[8px] px-2.5 text-[13px] font-semibold text-slate-2 transition-colors duration-150 ease-out hover:bg-wash hover:text-ink disabled:opacity-60 md:h-8"
            >
              <LayoutTemplate className="h-4 w-4" aria-hidden />
              Gabarits
            </button>

            {gabarits ? (
              <div
                role="menu"
                className="absolute left-0 top-full z-20 mt-1 w-[280px] overflow-hidden rounded-[10px] border border-border bg-surface shadow-eleve"
              >
                {GABARITS.map((g) => (
                  <button
                    key={g.cle}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      inserer(g.bloc);
                      setGabarits(false);
                      setVue("ecrire");
                    }}
                    className="flex w-full flex-col items-start gap-0.5 border-b border-separator px-3.5 py-2.5 text-left last:border-b-0 hover:bg-paper"
                  >
                    <span className="text-[14px] font-semibold text-ink">
                      {g.libelle}
                    </span>
                    <span className="text-[12.5px] leading-snug text-slate">
                      {g.aide}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="w-40 shrink-0">
          <Segments
            ariaLabel="Écrire ou prévisualiser votre réponse"
            valeur={vue}
            onChange={setVue}
            options={[
              { valeur: "ecrire" as const, libelle: "Écrire" },
              { valeur: "apercu" as const, libelle: "Aperçu" },
            ]}
          />
        </div>
      </div>

      {vue === "ecrire" ? (
        <AutoTextarea
          id={id}
          ref={zone}
          value={valeur}
          minRows={minRows}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={ariaLabel}
          className="!rounded-none !border-0 !bg-transparent px-4 py-3 text-[16px] leading-[1.75] !shadow-none focus:!ring-0 md:text-[15px]"
        />
      ) : (
        <div className="px-4 py-3 md:px-5">
          {valeur.trim() ? (
            <CorpsRedige texte={valeur} />
          ) : (
            <p className="text-[15px] text-slate">
              Rien à prévisualiser pour l&apos;instant.
            </p>
          )}
        </div>
      )}

      {/* Le compte de mots reste sous la zone, et non dans l'étiquette : en
          aperçu, l'étiquette disparaît du champ de vision. */}
      <p className="border-t border-separator bg-paper-alt px-4 py-1.5 text-right text-[12px] text-slate-light">
        {mots > 0 ? `${mots} mot${mots > 1 ? "s" : ""}` : " "}
      </p>
    </div>
  );
}
