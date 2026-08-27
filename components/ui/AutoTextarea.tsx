"use client";

import { useEffect, useRef, type TextareaHTMLAttributes } from "react";
import { inputStyles } from "@/components/ui/Input";

/**
 * Zone de texte qui épouse son contenu.
 *
 * Une hauteur fixe tronquait les fiches : l'activité d'une étape se lisait
 * dans une boîte de trois lignes qu'il fallait faire défiler séparément. On ne
 * relit pas un document de cette façon.
 */
export default function AutoTextarea({
  value,
  className = "",
  minRows = 2,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  value: string;
  minRows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Remise à zéro avant mesure : sans elle, la zone ne peut que grandir.
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, minRows * 22)}px`;
  }, [value, minRows]);

  return (
    <textarea
      ref={ref}
      value={value}
      rows={minRows}
      className={`${inputStyles} resize-none overflow-hidden ${className}`}
      {...rest}
    />
  );
}
