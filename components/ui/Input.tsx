import type { InputHTMLAttributes, TextareaHTMLAttributes, ReactNode } from "react";
import { useId } from "react";

// Design system : bordure 1px --border, fond --surface, focus bordure --forest 2px.
const champ =
  "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink " +
  "placeholder:text-slate/60 focus:border-forest focus:outline-none focus:ring-2 " +
  "focus:ring-forest disabled:cursor-not-allowed disabled:opacity-50";

const champEnErreur =
  "border-danger focus:border-danger focus:ring-danger";

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
        <label htmlFor={id} className="block text-sm font-medium text-ink">
          {label}
        </label>
      ) : null}
      {children}
      {/* Validation en ligne : le message s'affiche sous le champ, pas seulement à la soumission. */}
      {error ? (
        <p id={`${id}-erreur`} role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-slate">{hint}</p>
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
