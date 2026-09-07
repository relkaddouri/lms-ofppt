import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Rend du markdown avec la typographie du produit (PRD §4.4).
 *
 * La règle est explicite : « la source de la rédaction ne doit jamais se voir
 * dans le résultat ». Un support écrit à la main doit donc être indiscernable
 * d'un support généré — mêmes tailles, mêmes couleurs, mêmes espacements que
 * les sections structurées d'à côté. D'où la table de correspondance
 * ci-dessous plutôt que les styles par défaut du navigateur, qui trahiraient
 * l'origine à la première puce.
 *
 * `remark-gfm` pour les tableaux et les listes de cases à cocher : un
 * formateur qui colle un tableau de barème s'attend à voir un tableau.
 */
export default function TexteMarkdown({ texte }: { texte: string }) {
  return (
    <div className="flex flex-col gap-3">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h3 className="font-display text-[17px] font-semibold leading-snug text-ink">
              {children}
            </h3>
          ),
          h2: ({ children }) => (
            <h4 className="font-display text-[15.5px] font-semibold leading-snug text-ink">
              {children}
            </h4>
          ),
          h3: ({ children }) => (
            <h5 className="font-display text-[14.5px] font-semibold text-body">
              {children}
            </h5>
          ),
          p: ({ children }) => (
            <p className="text-[14.5px] leading-relaxed text-body">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[14.5px] leading-relaxed text-body">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[14.5px] leading-relaxed text-body">
              {children}
            </ol>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-ink">{children}</strong>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-[3px] border-tint-teal-strong bg-tint-teal px-3.5 py-2.5 text-[14.5px] leading-relaxed text-body">
              {children}
            </blockquote>
          ),
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
          // Un lien reste bleu et souligné : c'est la seule affordance qui dit
          // qu'on peut cliquer, et le support est fait pour être suivi.
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
          hr: () => <hr className="border-t border-separator" />,
          // Un tableau déborde vite : il défile dans son propre cadre, jamais
          // en poussant la page (design_system §3bis).
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-[13.5px]">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-border bg-paper px-3 py-2 font-medium text-slate">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-t border-separator px-3 py-2 align-top text-body">
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
