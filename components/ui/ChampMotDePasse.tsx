"use client";

import { useState, type InputHTMLAttributes } from "react";

/**
 * Champ de mot de passe avec bascule d'affichage intégrée.
 *
 * La bascule vit dans le cadre du champ, séparée par un filet, comme dans
 * `Connexion.dc.html` : bouton texte plutôt qu'icône d'œil, pour que l'action
 * soit lisible sans convention à deviner. La saisie est en IBM Plex Mono —
 * un mot de passe est une donnée précise, on doit distinguer l et 1, O et 0.
 */
export default function ChampMotDePasse({
  id,
  bordure = "border-border-strong",
  className = "",
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  id: string;
  /** Classe de bordure, pour l'état de validation du champ de confirmation. */
  bordure?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div
      className={`flex items-center overflow-hidden rounded-[9px] border bg-surface transition-colors duration-150 ease-out focus-within:border-teal focus-within:shadow-[0_0_0_3px_rgba(46,125,158,0.15)] ${bordure} ${className}`}
    >
      <input
        id={id}
        type={visible ? "text" : "password"}
        className="min-w-0 flex-1 border-none bg-transparent px-[13px] py-3 font-mono text-[15px] tracking-[0.04em] text-ink outline-none"
        {...rest}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="self-stretch whitespace-nowrap border-l border-border bg-paper-alt px-3.5 text-[13px] font-semibold text-slate-2 transition-colors duration-150 ease-out hover:bg-wash-strong hover:text-ink"
      >
        {visible ? "Masquer" : "Afficher"}
      </button>
    </div>
  );
}
