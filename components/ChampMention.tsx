"use client";

import { useRef, useState } from "react";
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
        <ul className="absolute bottom-full left-0 z-10 mb-1 w-full overflow-hidden rounded-lg border border-border bg-surface shadow-flottant">
          {suggestions.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => choisir(c.nom)}
                className="flex min-h-[44px] w-full items-center px-3 text-left text-sm text-ink hover:bg-wash"
              >
                {c.nom}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Champ arrondi en pilule et bouton rond, comme la maquette mobile :
          le composeur se lit comme une barre de message, pas comme un
          formulaire. */}
      <div className="flex items-center gap-[9px]">
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
          className="min-h-[44px] min-w-0 flex-1 rounded-full border border-border-strong bg-surface px-[15px] py-[11px] text-[14.5px] text-ink outline-none transition-colors duration-150 ease-out placeholder:text-slate-light focus:border-teal focus:shadow-[0_0_0_3px_rgba(46,125,158,0.15)]"
        />
        <button
          type="button"
          onClick={envoyer}
          disabled={busy || !texte.trim()}
          aria-label="Envoyer"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-ink bg-ink text-white transition-colors duration-150 ease-out hover:border-ofppt-ink-dark hover:bg-ofppt-ink-dark disabled:cursor-not-allowed disabled:border-muted disabled:bg-muted"
        >
          <Send size={17} aria-hidden />
        </button>
      </div>
    </div>
  );
}
