"use client";

/**
 * Interrupteur à bascule.
 *
 * Relevé dans `Paramètres.dc.html` : piste de 46×26, pastille blanche de
 * 20 px qui glisse de 3 px à 23 px, piste verte à l'état actif et
 * `--border-strong` au repos. Transition de 150 ms, comme tout le reste.
 */
export default function Interrupteur({
  actif,
  onChange,
  label,
  disabled = false,
}: {
  actif: boolean;
  onChange: (actif: boolean) => void;
  /** Décrit ce que l'interrupteur commande, pour les lecteurs d'écran. */
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={actif}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!actif)}
      className={`relative h-[26px] w-[46px] shrink-0 rounded-full transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(46,125,158,0.15)] disabled:cursor-not-allowed disabled:opacity-60 ${
        actif ? "bg-green" : "bg-border-strong"
      }`}
    >
      <span
        aria-hidden
        className={`absolute top-[3px] h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(46,59,78,0.35)] transition-[left] duration-150 ease-out ${
          actif ? "left-[23px]" : "left-[3px]"
        }`}
      />
    </button>
  );
}
