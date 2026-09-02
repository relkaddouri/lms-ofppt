"use client";

import { Zap } from "lucide-react";

/**
 * Marque un contenu sorti du modèle et pas encore repassé par le formateur.
 *
 * `design_system.md` §8 en fait la leçon directe de l'audit précédent : ne
 * jamais laisser un contenu généré passer pour définitif sans passage humain
 * visible. Le bandeau disparaît à la première modification ou à la relecture
 * explicite — à ce moment le contenu redevient un contenu comme un autre.
 *
 * `Préparer un contrôle.dc.html` le rend en teinte d'alerte et lui donne un
 * bouton « Marquer comme relu », là où §8 décrivait un bandeau menthe discret.
 * Le fichier de maquette fait foi ; §8 est corrigé en conséquence.
 */
export default function BandeauIa({
  meta,
  onRelu,
  children,
}: {
  /** Origine du contenu, en mono : « Claude · 6 questions ». */
  meta?: string;
  /** Sans action, le bandeau informe seulement. */
  onRelu?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-3 rounded-[11px] border border-tint-alert-strong bg-alert-wash px-4 py-3"
    >
      <Zap size={16} className="shrink-0 text-coral" aria-hidden />
      <span className="text-sm text-coral-dark">
        {children ?? "Généré par l'IA — à relire avant de vous en servir."}
      </span>
      {meta ? (
        <span className="font-mono text-[12.5px] text-coral/70">{meta}</span>
      ) : null}
      {onRelu ? (
        <button
          type="button"
          onClick={onRelu}
          className="ml-auto whitespace-nowrap rounded-lg border border-coral bg-coral px-3.5 py-[7px] text-[13.5px] font-semibold text-white transition-colors duration-150 ease-out hover:border-coral-dark hover:bg-coral-dark"
        >
          Marquer comme relu
        </button>
      ) : null}
    </div>
  );
}
