"use client";

import { useLayoutEffect, useRef, useState } from "react";
import AutoTextarea from "@/components/ui/AutoTextarea";
import Button from "@/components/ui/Button";
import Segments from "@/components/ui/Segments";
import ReponseMarkdown from "@/components/ReponseMarkdown";
import type { Camarade } from "@/app/actions/fil";
import {
  Bold,
  Code,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Send,
} from "lucide-react";

/** Le plafond de la réponse du formateur, tenu aussi en base (migration 086). */
export const LONGUEUR_MAX_REPONSE_FORMATEUR = 20000;

type Vue = "ecrire" | "apercu";

/**
 * La réponse du formateur à une question de cours (PRD §4.4).
 *
 * Le champ d'une ligne convenait à un commentaire ; il ne convenait pas à une
 * explication. Une zone qui grandit avec le texte, du Markdown, et un aperçu
 * pour voir ce que le stagiaire lira avant de l'envoyer — une réponse publiée
 * aussitôt ne se relit pas après coup sans qu'on l'ait déjà lue de travers.
 *
 * La barre d'outils n'est qu'un raccourci : elle écrit la syntaxe dans le
 * texte, elle ne cache rien. Qui connaît le Markdown l'ignore ; qui ne le
 * connaît pas l'apprend en voyant ce que chaque bouton a écrit.
 */
export default function EditeurReponse({
  camarades,
  busy,
  onEnvoyer,
  onAnnuler,
}: {
  camarades: Camarade[];
  busy: boolean;
  onEnvoyer: (texte: string) => void;
  onAnnuler: () => void;
}) {
  const [texte, setTexte] = useState("");
  const [vue, setVue] = useState<Vue>("ecrire");
  const zone = useRef<HTMLTextAreaElement>(null);
  // La sélection à rétablir après une mise en forme. Appliquée une fois le
  // nouveau texte rendu, et non dans un `requestAnimationFrame` : React remet
  // le curseur en fin de champ en réécrivant sa valeur, et une image
  // d'animation ne vient pas toujours après — jamais dans un onglet en
  // arrière-plan, où le navigateur les suspend.
  const selectionAVenir = useRef<[number, number] | null>(null);

  useLayoutEffect(() => {
    const el = zone.current;
    const cible = selectionAVenir.current;
    if (!el || !cible) return;
    selectionAVenir.current = null;
    el.focus();
    el.setSelectionRange(cible[0], cible[1]);
  }, [texte]);

  const longueur = texte.length;
  const vide = texte.trim() === "";
  const tropLong = longueur > LONGUEUR_MAX_REPONSE_FORMATEUR;
  // Le compteur ne s'affiche qu'à l'approche du plafond : vingt mille
  // caractères, c'est dix pages, et un chiffre qui défile à chaque frappe
  // distrairait de ce qu'on écrit.
  const afficherCompteur = longueur > LONGUEUR_MAX_REPONSE_FORMATEUR * 0.8;

  function envoyer() {
    if (vide || tropLong || busy) return;
    onEnvoyer(texte.trim());
  }

  /**
   * Entoure la sélection, ou insère le modèle au curseur.
   *
   * La sélection est restaurée après coup, sur le texte entouré : on peut
   * enchaîner gras puis italique sans resélectionner.
   */
  function entourer(avant: string, apres: string, modele: string) {
    const el = zone.current;
    if (!el) return;
    const debut = el.selectionStart;
    const fin = el.selectionEnd;
    const choisi = texte.slice(debut, fin) || modele;
    const suite =
      texte.slice(0, debut) + avant + choisi + apres + texte.slice(fin);
    selectionAVenir.current = [
      debut + avant.length,
      debut + avant.length + choisi.length,
    ];
    setTexte(suite);
  }

  /** Préfixe chaque ligne sélectionnée — listes et citations. */
  function prefixer(prefixe: (i: number) => string) {
    const el = zone.current;
    if (!el) return;
    // On étend la sélection aux lignes entières : une liste qui commencerait au
    // milieu d'une phrase ne serait pas une liste.
    const debut = texte.lastIndexOf("\n", el.selectionStart - 1) + 1;
    const finLigne = texte.indexOf("\n", el.selectionEnd);
    const fin = finLigne === -1 ? texte.length : finLigne;
    const bloc = texte
      .slice(debut, fin)
      .split("\n")
      .map((l, i) => `${prefixe(i)}${l}`)
      .join("\n");
    selectionAVenir.current = [debut, debut + bloc.length];
    setTexte(texte.slice(0, debut) + bloc + texte.slice(fin));
  }

  const outils = [
    {
      libelle: "Gras",
      Icone: Bold,
      agir: () => entourer("**", "**", "texte en gras"),
    },
    {
      libelle: "Italique",
      Icone: Italic,
      agir: () => entourer("*", "*", "texte en italique"),
    },
    { libelle: "Code", Icone: Code, agir: () => entourer("`", "`", "code") },
    {
      libelle: "Lien",
      Icone: Link2,
      agir: () => entourer("[", "](https://)", "texte du lien"),
    },
    { libelle: "Liste à puces", Icone: List, agir: () => prefixer(() => "- ") },
    {
      libelle: "Liste numérotée",
      Icone: ListOrdered,
      agir: () => prefixer((i) => `${i + 1}. `),
    },
    { libelle: "Citation", Icone: Quote, agir: () => prefixer(() => "> ") },
  ];

  return (
    <div className="overflow-hidden rounded-[12px] border border-border-strong bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-separator bg-paper-alt px-2 py-1.5">
        {/* Les outils n'ont de sens qu'en écriture : en aperçu, ils agiraient
            sur un texte qu'on ne voit pas. */}
        <div
          role="toolbar"
          aria-label="Mise en forme"
          className={`flex flex-wrap items-center gap-0.5 ${vue === "apercu" ? "invisible" : ""}`}
        >
          {outils.map(({ libelle, Icone, agir }) => (
            <button
              key={libelle}
              type="button"
              onClick={agir}
              title={libelle}
              aria-label={libelle}
              disabled={busy}
              className="flex h-11 w-11 items-center justify-center rounded-[8px] text-slate-2 transition-colors duration-150 ease-out hover:bg-wash hover:text-ink disabled:opacity-60 md:h-8 md:w-8"
            >
              <Icone className="h-4 w-4" aria-hidden />
            </button>
          ))}
        </div>

        <div className="w-44">
          <Segments
            ariaLabel="Écrire ou prévisualiser"
            valeur={vue}
            onChange={setVue}
            options={[
              { valeur: "ecrire", libelle: "Écrire" },
              { valeur: "apercu", libelle: "Aperçu" },
            ]}
          />
        </div>
      </div>

      {vue === "ecrire" ? (
        <AutoTextarea
          ref={zone}
          value={texte}
          minRows={6}
          autoFocus
          maxLength={LONGUEUR_MAX_REPONSE_FORMATEUR + 500}
          onChange={(e) => setTexte(e.target.value)}
          onKeyDown={(e) => {
            // Cmd+Entrée envoie ; Entrée seule revient à la ligne, comme
            // dans tout texte long. L'inverse ferait partir une réponse à
            // moitié écrite au premier paragraphe.
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              envoyer();
            }
          }}
          placeholder={
            "Votre réponse, en Markdown si vous le souhaitez :\n\n**gras**, *italique*, `code`, listes, tableaux, [liens](https://…)"
          }
          aria-label="Réponse du formateur"
          className="max-h-[60vh] !overflow-y-auto rounded-none border-0 font-mono text-[13.5px] leading-relaxed shadow-none focus:shadow-none"
        />
      ) : (
        <div className="max-h-[60vh] min-h-[150px] overflow-y-auto px-4 py-3">
          {vide ? (
            <p className="text-sm text-slate-light">Rien à prévisualiser.</p>
          ) : (
            <ReponseMarkdown texte={texte} camarades={camarades} />
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-separator px-3 py-2.5">
        <span className="text-[12.5px] text-slate-light">
          {afficherCompteur ? (
            <span className={`font-mono ${tropLong ? "text-coral-dark" : ""}`}>
              {longueur.toLocaleString("fr-FR")} /{" "}
              {LONGUEUR_MAX_REPONSE_FORMATEUR.toLocaleString("fr-FR")}
            </span>
          ) : (
            <>
              <span className="hidden md:inline">
                Ctrl ou ⌘ + Entrée pour envoyer ·{" "}
              </span>
              Markdown pris en charge
            </>
          )}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onAnnuler} disabled={busy}>
            Annuler
          </Button>
          <Button
            icon={Send}
            onClick={envoyer}
            disabled={vide || tropLong}
            loading={busy}
            loadingLabel="Envoi…"
          >
            Envoyer
          </Button>
        </div>
      </div>
    </div>
  );
}
