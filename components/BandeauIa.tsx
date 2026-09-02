"use client";

import { Sparkles, Zap } from "lucide-react";

export type VarianteBandeauIa = "informatif" | "engageant";

/**
 * Marque un contenu sorti du modèle et pas encore repassé par le formateur.
 *
 * `design_system.md` §8 en fait la leçon directe de l'audit précédent : ne
 * jamais laisser un contenu généré passer pour définitif sans passage humain
 * visible. Le bandeau disparaît à la première modification ou à la relecture
 * explicite — à ce moment le contenu redevient un contenu comme un autre.
 *
 * Deux variantes, parce que tous les contenus générés n'engagent pas la même
 * chose :
 *
 * - `informatif` (défaut) — teinte menthe, discret. Il informe, il n'alerte
 *   pas : une fiche de préparation ou un support de cours générés sont des
 *   brouillons de travail, pas des erreurs.
 * - `engageant` — teinte d'alerte, avec l'origine du contenu et une action de
 *   relecture. Réservé à ce qui pèse sur une note : barème, questions et
 *   corrigé d'un contrôle, correction suggérée d'une copie. C'est le rendu de
 *   `Préparer un contrôle.dc.html`.
 */
const VARIANTES: Record<
  VarianteBandeauIa,
  { cadre: string; icone: string; texte: string; meta: string; action: string }
> = {
  informatif: {
    // Le `--forest/30` de la v2 ne se transpose pas : `--ink` est un alias de
    // variable, et Tailwind laisse tomber l'opacité au lieu de la calculer —
    // la bordure sortait pleine. `--border-strong` est le trait fin réel du
    // système, sans valeur inventée.
    cadre: "border-border-strong bg-mint",
    icone: "text-ink",
    texte: "text-body",
    meta: "text-slate-light",
    action:
      "border-border-strong bg-surface text-ink hover:border-ink hover:bg-paper",
  },
  engageant: {
    cadre: "border-tint-alert-strong bg-alert-wash",
    icone: "text-coral",
    texte: "text-coral-dark",
    meta: "text-coral/70",
    action:
      "border-coral bg-coral text-white hover:border-coral-dark hover:bg-coral-dark",
  },
};

export default function BandeauIa({
  variante = "informatif",
  meta,
  onRelu,
  children,
}: {
  variante?: VarianteBandeauIa;
  /** Origine du contenu, en mono : « Claude · 6 questions ». */
  meta?: string;
  /** Sans action, le bandeau informe seulement. */
  onRelu?: () => void;
  children?: React.ReactNode;
}) {
  const style = VARIANTES[variante];
  const Icone = variante === "engageant" ? Zap : Sparkles;

  return (
    <div
      role="status"
      className={`flex flex-wrap items-center gap-3 rounded-[11px] border px-4 py-3 ${style.cadre}`}
    >
      <Icone size={16} className={`shrink-0 ${style.icone}`} aria-hidden />
      <span className={`text-sm ${style.texte}`}>
        {children ?? "Généré par l'IA — à relire avant de vous en servir."}
      </span>
      {meta ? (
        <span className={`font-mono text-[12.5px] ${style.meta}`}>{meta}</span>
      ) : null}
      {onRelu ? (
        <button
          type="button"
          onClick={onRelu}
          className={`ml-auto whitespace-nowrap rounded-lg border px-3.5 py-[7px] text-[13.5px] font-semibold transition-colors duration-150 ease-out ${style.action}`}
        >
          Marquer comme relu
        </button>
      ) : null}
    </div>
  );
}
