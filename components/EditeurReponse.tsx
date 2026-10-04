"use client";

import { useState } from "react";
import AutoTextarea from "@/components/ui/AutoTextarea";
import Button from "@/components/ui/Button";
import Segments from "@/components/ui/Segments";
import ReponseMarkdown from "@/components/ReponseMarkdown";
import { useMiseEnForme } from "@/components/ui/useMiseEnForme";
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
  // La mécanique de sélection vit dans un crochet partagé : la copie du
  // stagiaire s'en sert aussi, et un défaut corrigé ici profite aux deux.
  const { zone, entourer, prefixer } = useMiseEnForme(texte, setTexte);

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
