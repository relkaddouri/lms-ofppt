"use client";

import { useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { inputStyles } from "@/components/ui/Input";
import type { Camarade } from "@/app/actions/fil";
import { Send } from "lucide-react";

/**
 * Saisie d'un message, avec mention d'un camarade.
 *
 * Le « @ » ouvre une liste filtrée au fil de la frappe : c'est le geste décrit
 * par design_system.md, et il évite d'avoir à taper un nom exactement. Le
 * champ sert au fil comme aux questions sur un support : une seule mécanique
 * de mention pour tout l'espace stagiaire.
 */
export default function ChampMention({
  camarades,
  onEnvoyer,
  busy,
  placeholder = "Écrire un commentaire… @ pour mentionner",
}: {
  camarades: Camarade[];
  onEnvoyer: (texte: string) => void;
  busy: boolean;
  placeholder?: string;
}) {
  const [texte, setTexte] = useState("");
  const [recherche, setRecherche] = useState<string | null>(null);
  const champ = useRef<HTMLInputElement>(null);

  /** Fragment tapé après le dernier « @ », s'il est encore en cours. */
  function fragmentMention(valeur: string): string | null {
    const arobase = valeur.lastIndexOf("@");
    if (arobase === -1) return null;
    const apres = valeur.slice(arobase + 1);
    // Un espace en trop signifierait que la mention est finie.
    return apres.includes("  ") ? null : apres;
  }

  const suggestions =
    recherche === null
      ? []
      : camarades
          .filter((c) => c.nom.toLowerCase().includes(recherche.toLowerCase()))
          .slice(0, 5);

  function choisir(nom: string) {
    const arobase = texte.lastIndexOf("@");
    setTexte(`${texte.slice(0, arobase)}@${nom} `);
    setRecherche(null);
    champ.current?.focus();
  }

  function envoyer() {
    if (!texte.trim() || busy) return;
    onEnvoyer(texte);
    setTexte("");
    setRecherche(null);
  }

  return (
    <div className="relative">
      {suggestions.length > 0 ? (
        <ul className="absolute bottom-full left-0 z-10 mb-1 w-full overflow-hidden rounded-lg border border-border bg-surface shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
          {suggestions.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => choisir(c.nom)}
                className="flex min-h-[44px] w-full items-center px-3 text-left text-sm text-ink hover:bg-mint"
              >
                {c.nom}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex gap-2">
        <input
          ref={champ}
          value={texte}
          onChange={(e) => {
            setTexte(e.target.value);
            setRecherche(fragmentMention(e.target.value));
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") envoyer();
            if (e.key === "Escape") setRecherche(null);
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          className={inputStyles}
        />
        <Button
          icon={Send}
          onClick={envoyer}
          disabled={busy || !texte.trim()}
          aria-label="Envoyer"
          className="min-h-[44px] min-w-[44px] shrink-0"
        >
          {""}
        </Button>
      </div>
    </div>
  );
}
