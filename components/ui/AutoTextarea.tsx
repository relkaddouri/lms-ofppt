"use client";

import {
  useEffect,
  useRef,
  type Ref,
  type TextareaHTMLAttributes,
} from "react";
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
  ref: refExterne,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  value: string;
  minRows?: number;
  /**
   * Pour qui doit agir sur la sélection — une barre de mise en forme. La
   * zone garde sa propre référence pour se mesurer : sans cette fusion, la
   * référence passée de l'extérieur remplaçait la sienne, et la zone cessait
   * de grandir.
   */
  ref?: Ref<HTMLTextAreaElement>;
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
      ref={(el) => {
        ref.current = el;
        if (typeof refExterne === "function") refExterne(el);
        else if (refExterne) refExterne.current = el;
      }}
      value={value}
      rows={minRows}
      className={`${inputStyles} resize-none overflow-hidden ${className}`}
      {...rest}
    />
  );
}
