import type { InputHTMLAttributes, TextareaHTMLAttributes, ReactNode } from "react";
import { useId } from "react";

/**
 * Champ du système visuel v3.
 *
 * Relevé dans la planche de style : bordure `--border-strong` (et non
 * `--border`, plus pâle et réservée aux séparateurs), rayon 9 px, padding
 * 11×13, texte 15 px. Le focus pose la sarcelle et un halo de 3 px — c'est le
 * seul traitement de focus que les écrans livrés définissent.
 */
const champ =
  "mt-[7px] w-full rounded-[9px] border border-border-strong bg-surface " +
  "px-[13px] py-[11px] text-[15px] text-ink placeholder:text-slate-light " +
  "transition-colors duration-150 ease-out focus:border-teal focus:outline-none " +
  "focus:shadow-[0_0_0_3px_rgba(46,125,158,0.15)] " +
  "disabled:cursor-not-allowed disabled:bg-wash-strong disabled:text-muted";

const champEnErreur = "border-coral focus:border-coral";

function Enveloppe({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div>
      {label ? (
        <label
          htmlFor={id}
          className={`block text-sm font-semibold ${
            error ? "text-coral-dark" : "text-body"
          }`}
        >
          {label}
        </label>
      ) : null}
      {children}
      {/* Validation en ligne : le message s'affiche sous le champ, pas seulement à la soumission. */}
      {error ? (
        <p
          id={`${id}-erreur`}
          role="alert"
          className="mt-[7px] text-[13px] text-coral-dark"
        >
          {error}
        </p>
      ) : hint ? (
        <p className="mt-[7px] text-[13px] text-slate">{hint}</p>
      ) : null}
    </div>
  );
}

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  id?: string;
};

export default function Input({
  label,
  hint,
  error,
  id,
  className = "",
  ...rest
}: InputProps) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <Enveloppe id={inputId} label={label} hint={hint} error={error}>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-erreur` : undefined}
        className={`${champ} ${error ? champEnErreur : ""} ${className}`.trim()}
        {...rest}
      />
    </Enveloppe>
  );
}

type TextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  id?: string;
};

export function Textarea({
  label,
  hint,
  error,
  id,
  className = "",
  rows = 3,
  ...rest
}: TextareaProps) {
  const auto = useId();
  const areaId = id ?? auto;
  return (
    <Enveloppe id={areaId} label={label} hint={hint} error={error}>
      <textarea
        id={areaId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${areaId}-erreur` : undefined}
        className={`${champ} ${error ? champEnErreur : ""} ${className}`.trim()}
        {...rest}
      />
    </Enveloppe>
  );
}

/** Classes brutes du champ, pour les cas où l'enveloppe label/erreur ne convient pas. */
export const inputStyles = champ;
