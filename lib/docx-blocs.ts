/**
 * Rendre un texte officiel du cahier, bloc par bloc.
 *
 * Les procédures et les annexes sont des listes de paragraphes typés
 * (`docx-cahier-textes.ts`). Le même rendu sert aux deux : un seul endroit
 * décide qu'un titre de niveau trois se met en sarcelle et qu'une puce
 * s'indente.
 */

import type { Paragraph } from "docx";
import type { BlocTexte } from "@/lib/docx-cahier-textes";
import { paragraphe, puce, titre1, titre2, titre3 } from "@/lib/docx-charte";

export function rendreBlocs(blocs: BlocTexte[]): Paragraph[] {
  return blocs.map((b) => {
    if (b.genre === "titre1") return titre1(b.texte);
    if (b.genre === "titre2") return titre2(b.texte);
    if (b.genre === "titre3") return titre3(b.texte);
    if (b.genre === "puce") return puce(b.texte);
    return paragraphe(b.texte);
  });
}
