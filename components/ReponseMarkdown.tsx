"use client";

import { Children, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import TexteMentions from "@/components/TexteMentions";
import type { Camarade } from "@/app/actions/fil";

/**
 * La réponse du formateur, rendue en Markdown (PRD §4.4).
 *
 * Réservée à ses messages : un stagiaire écrit du texte simple, et un astérisque
 * dans sa question doit rester un astérisque. Le formateur, lui, explique — un
 * exemple de code, une démarche numérotée, un tableau qui compare deux
 * méthodes — et le texte brut rendait tout cela illisible.
 *
 * `react-markdown` et non le découpage maison de `DocumentRedige` : celui-là
 * tient la mise en page d'un cours entier, pas les tableaux ni les blocs de
 * code d'une réponse. Le coût d'un analyseur complet, qui avait figé le cours
 * rédigé à dix-sept tableaux, ne se pose pas pour quelques réponses par fil.
 *
 * Sûr par construction : le HTML écrit dans le texte n'est jamais interprété,
 * et les adresses en `javascript:` sont neutralisées par la bibliothèque. Les
 * images sont écartées — une réponse n'a pas à charger une image d'un site
 * tiers dans l'écran d'un stagiaire, ni à déborder de la carte qui la porte.
 */
export default function ReponseMarkdown({
  texte,
  camarades,
}: {
  texte: string;
  camarades: Camarade[];
}) {
  /**
   * Les mentions survivent au Markdown. `@Prénom Nom` est résolu à
   * l'affichage, comme partout ailleurs : on le cherche dans les fragments de
   * texte, jamais dans le code, où un `@` n'est qu'un caractère.
   */
  const avecMentions = (enfants: ReactNode): ReactNode =>
    Children.map(enfants, (enfant) =>
      typeof enfant === "string" ? (
        <TexteMentions texte={enfant} camarades={camarades} />
      ) : (
        enfant
      ),
    );

  const composants: Components = {
    p: ({ children }) => (
      <p className="leading-relaxed">{avecMentions(children)}</p>
    ),
    h1: ({ children }) => (
      <h3 className="font-display text-[16px] font-semibold text-ink">
        {avecMentions(children)}
      </h3>
    ),
    h2: ({ children }) => (
      <h3 className="font-display text-[15px] font-semibold text-ink">
        {avecMentions(children)}
      </h3>
    ),
    h3: ({ children }) => (
      <h4 className="text-[14px] font-semibold text-ink">
        {avecMentions(children)}
      </h4>
    ),
    // Au-delà du troisième niveau, un titre dans une réponse est un
    // paragraphe en gras : la hiérarchie d'un document n'a pas sa place ici.
    h4: ({ children }) => (
      <p className="font-semibold">{avecMentions(children)}</p>
    ),
    h5: ({ children }) => (
      <p className="font-semibold">{avecMentions(children)}</p>
    ),
    h6: ({ children }) => (
      <p className="font-semibold">{avecMentions(children)}</p>
    ),
    // Une liste de tâches porte déjà sa case : la puce en plus faisait deux
    // marqueurs pour un seul élément.
    ul: ({ children, className }) => (
      <ul
        className={
          className?.includes("contains-task-list")
            ? "space-y-1"
            : "list-disc space-y-1 pl-5 marker:text-slate-light"
        }
      >
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal space-y-1 pl-5 marker:font-mono marker:text-slate-2">
        {children}
      </ol>
    ),
    li: ({ children }) => <li className="pl-0.5">{avecMentions(children)}</li>,
    strong: ({ children }) => (
      <strong className="font-semibold text-ink">
        {avecMentions(children)}
      </strong>
    ),
    em: ({ children }) => <em>{avecMentions(children)}</em>,
    // Une adresse neutralisée — `javascript:` et consorts — revient vide :
    // on n'en fait pas un lien qui rouvrirait la page dans un nouvel onglet.
    a: ({ href, children }) =>
      !href ? (
        <span>{children}</span>
      ) : (
        <a
          href={href}
          // Un lien dans une réponse mène hors de l'application : on n'y perd
          // pas le cours qu'on était en train de lire.
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-teal underline decoration-teal/40 underline-offset-2 hover:decoration-teal"
        >
          {children}
        </a>
      ),
    blockquote: ({ children }) => (
      <blockquote className="border-l-2 border-border-strong pl-3 text-slate-2">
        {children}
      </blockquote>
    ),
    hr: () => <hr className="border-separator" />,
    // Le code en ligne et le bloc de code arrivent tous deux par `code` ;
    // `pre` porte le bloc, et c'est lui qui défile quand une ligne dépasse —
    // la carte, elle, ne doit jamais défiler en travers (§3bis).
    pre: ({ children }) => (
      <pre className="overflow-x-auto rounded-[10px] border border-border bg-paper-alt p-3 font-mono text-[12.5px] leading-relaxed text-ink [&>code]:bg-transparent [&>code]:p-0">
        {children}
      </pre>
    ),
    code: ({ children }) => (
      <code className="rounded-[5px] bg-wash px-1 py-0.5 font-mono text-[12.5px] text-ink">
        {children}
      </code>
    ),
    table: ({ children }) => (
      <div className="overflow-x-auto rounded-[10px] border border-border">
        <table className="w-full border-collapse text-left text-[13px]">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-ink text-white">{children}</thead>
    ),
    th: ({ children }) => (
      <th className="whitespace-nowrap px-3 py-2 font-semibold">{children}</th>
    ),
    td: ({ children }) => (
      <td className="border-t border-separator px-3 py-2 align-top">
        {avecMentions(children)}
      </td>
    ),
    // Cases à cocher des listes de tâches : lues, jamais modifiables ici.
    input: ({ checked }) => (
      <input
        type="checkbox"
        checked={Boolean(checked)}
        readOnly
        disabled
        className="mr-1.5 align-middle accent-green"
      />
    ),
  };

  return (
    <div className="space-y-2.5 text-sm text-ink [overflow-wrap:anywhere]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={composants}
        disallowedElements={["img"]}
        unwrapDisallowed
      >
        {texte}
      </ReactMarkdown>
    </div>
  );
}
