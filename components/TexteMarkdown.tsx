import type { ReactNode } from "react";
import { Children, isValidElement } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Rend du markdown comme un document du produit (PRD §4.4).
 *
 * La règle est explicite : « la source de la rédaction ne doit jamais se voir
 * dans le résultat ». Un cours collé par le formateur doit donc sortir comme
 * un support de cours, pas comme du texte balisé — d'où la table de
 * correspondance ci-dessous plutôt que les styles du navigateur.
 *
 * L'élément qui porte ces documents est l'**encadré** : une citation dont la
 * première ligne est un intitulé en capitales. C'est ainsi qu'un support de
 * cours pose un objectif, un rappel, une consigne d'atelier ou un extrait de
 * brief. Rendue en simple citation, elle perdrait ce qui la distingue du
 * corps ; rendue en encadré titré, elle se lit d'un coup d'œil.
 */

/**
 * Les enfants utiles, sans les blancs.
 *
 * `react-markdown` intercale des sauts de ligne entre les blocs : sans ce
 * filtre, le « premier enfant » d'une citation est presque toujours « \n » et
 * aucun encadré n'est reconnu.
 */
function utiles(enfants: ReactNode): ReactNode[] {
  return Children.toArray(enfants).filter(
    (n) => typeof n !== "string" || n.trim() !== "",
  );
}

/** Tout le texte d'un nœud, quelle que soit sa profondeur. */
function texteDe(noeud: ReactNode): string {
  if (typeof noeud === "string" || typeof noeud === "number") {
    return String(noeud);
  }
  if (Array.isArray(noeud)) return noeud.map(texteDe).join("");
  if (isValidElement<{ children?: ReactNode }>(noeud)) {
    return texteDe(noeud.props.children ?? null);
  }
  return "";
}

/**
 * L'intitulé d'un encadré : sa première ligne, si elle est en capitales.
 *
 * On lit le texte et non la balise. Les composants passés à `react-markdown`
 * remplacent `strong` par le nôtre : comparer le type du nœud à « strong » ne
 * reconnaissait donc aucun encadré, alors que le balisage était bon.
 *
 * Une ligne entièrement en capitales et courte est un intitulé — « OBJECTIF
 * 1 », « RÈGLE D'OR », « CONSIGNES ». Une phrase ordinaire ne l'est pas.
 */
function intituleEncadre(enfants: ReactNode): string | null {
  const premier = utiles(enfants)[0];
  if (!isValidElement(premier)) return null;

  const texte = texteDe(premier).trim();
  if (texte.length < 2 || texte.length > 90) return null;
  if (!/\p{Lu}/u.test(texte)) return null;
  return texte === texte.toLocaleUpperCase("fr") ? texte : null;
}

/** Le même bloc, privé de son intitulé. */
function sansIntitule(enfants: ReactNode): ReactNode[] {
  const tous = utiles(enfants);
  const premier = tous[0];
  if (!isValidElement<{ children?: ReactNode }>(premier)) return tous;
  // Le premier paragraphe peut ne contenir que l'intitulé : on le laisse
  // tomber plutôt que de garder une ligne vide sous le titre.
  const reste = utiles(premier.props.children).slice(1);
  return reste.length > 0
    ? [<p key="reste">{reste}</p>, ...tous.slice(1)]
    : tous.slice(1);
}

export default function TexteMarkdown({ texte }: { texte: string }) {
  return (
    <div className="flex flex-col gap-3.5 text-[14.5px] leading-relaxed text-body">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mt-2 font-display text-[24px] font-bold leading-tight tracking-[-0.02em] text-ink">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-5 border-b border-separator pb-2 font-display text-[19px] font-semibold leading-snug text-ink">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-3 font-display text-[16px] font-semibold text-ink">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="mt-2 font-display text-[14.5px] font-semibold text-body">
              {children}
            </h4>
          ),
          p: ({ children }) => <p className="leading-relaxed">{children}</p>,
          ul: ({ children, className }) => (
            <ul
              className={
                className?.includes("contains-task-list")
                  ? "flex list-none flex-col gap-1.5 pl-0"
                  : "flex list-disc flex-col gap-1.5 pl-5"
              }
            >
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="flex list-decimal flex-col gap-1.5 pl-5">
              {children}
            </ol>
          ),
          li: ({ children, className }) => (
            <li
              className={
                className?.includes("task-list-item")
                  ? "flex items-start gap-2"
                  : ""
              }
            >
              {children}
            </li>
          ),
          // Une case à cocher d'un support imprimé se coche au stylo : elle
          // reste vide et inerte, comme sur le papier.
          input: ({ checked }) => (
            <span
              aria-hidden
              className={`mt-[3px] inline-block h-3.5 w-3.5 shrink-0 rounded-[3px] border ${
                checked ? "border-ink bg-ink" : "border-border-strong bg-surface"
              }`}
            />
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-ink">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-slate-2">{children}</em>
          ),
          blockquote: ({ children }) => {
            const intitule = intituleEncadre(children);
            if (!intitule) {
              return (
                <blockquote className="border-l-[3px] border-border-strong pl-4 italic text-slate-2">
                  {children}
                </blockquote>
              );
            }
            return (
              <aside className="flex flex-col gap-2 rounded-[12px] border border-border bg-paper px-4 py-3.5">
                <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] text-slate-light">
                  {intitule}
                </p>
                <div className="flex flex-col gap-2 text-body">
                  {sansIntitule(children)}
                </div>
              </aside>
            );
          },
          code: ({ children }) => (
            <code className="rounded bg-wash-strong px-1.5 py-px font-mono text-[13px] text-ink">
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="overflow-x-auto rounded-[10px] border border-border bg-paper px-3.5 py-3 font-mono text-[12.5px] leading-relaxed text-body">
              {children}
            </pre>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-teal underline underline-offset-2 hover:text-teal-dark"
            >
              {children}
            </a>
          ),
          hr: () => <hr className="my-2 border-t border-separator" />,
          // Un tableau déborde vite : il défile dans son propre cadre, jamais
          // en poussant la page (design_system §3bis).
          table: ({ children }) => (
            <div className="overflow-x-auto rounded-[10px] border border-border">
              <table className="w-full border-collapse text-left text-[13.5px]">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-paper-alt">{children}</thead>
          ),
          th: ({ children, style }) => (
            <th
              style={style}
              className="border-b border-border px-3 py-2 align-bottom font-medium text-slate"
            >
              {children}
            </th>
          ),
          td: ({ children, style }) => (
            <td
              style={style}
              className="border-t border-separator px-3 py-2 align-top"
            >
              {children}
            </td>
          ),
        }}
      >
        {texte}
      </Markdown>
    </div>
  );
}
