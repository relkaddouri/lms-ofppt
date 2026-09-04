import type { RessourceSupport, SchemaSupport } from "@/lib/support";
import { ArrowRight, ExternalLink, X } from "lucide-react";

/**
 * Une figure du support : des étapes nommées, dans l'ordre de lecture
 * (PRD §4.4).
 *
 * Pas une image : l'application n'en produit pas, et en fabriquer une de
 * toutes pièces reviendrait à dessiner ce qu'on ne sait pas dessiner. Une
 * suite d'étapes se lit à l'écran comme au PDF et dit la même chose.
 */
export function FigureSupport({ schema }: { schema: SchemaSupport }) {
  return (
    <figure className="mt-3 rounded-[10px] border border-border bg-paper-alt px-4 py-3.5">
      <figcaption className="font-mono text-[11.5px] uppercase tracking-[0.12em] text-slate-light">
        {schema.titre}
      </figcaption>
      <ol className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-2">
        {schema.etapes.map((e, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="rounded-lg border border-border-strong bg-surface px-3 py-1.5 text-[13.5px] text-ink">
              {e}
            </span>
            {i < schema.etapes.length - 1 ? (
              <ArrowRight
                size={14}
                className="shrink-0 text-slate-light"
                aria-hidden
              />
            ) : null}
          </li>
        ))}
      </ol>
      {schema.legende ? (
        <p className="mt-2.5 text-[13px] text-slate-2">{schema.legende}</p>
      ) : null}
    </figure>
  );
}

/**
 * Les ressources citées par le support (PRD §4.4).
 *
 * L'origine se voit : ce que le formateur a écrit dans sa fiche fait foi, ce
 * que le modèle a proposé reste à vérifier. Confondre les deux ferait passer
 * une suggestion pour une référence validée.
 *
 * `formateur` montre les mentions de fiabilité ; côté stagiaire elles n'ont
 * pas de sens — il ne va rien vérifier — et un lien mort n'est simplement pas
 * affiché.
 */
export function ListeRessources({
  ressources,
  formateur = false,
  onRetirer,
}: {
  ressources: RessourceSupport[];
  formateur?: boolean;
  /** Fourni côté formateur : retirer une ressource qu'il ne veut pas remettre. */
  onRetirer?: (index: number) => void;
}) {
  const visibles = formateur
    ? ressources
    : ressources.filter((r) => r.joignable !== false);
  if (visibles.length === 0) return null;

  return (
    <section>
      <h2 className="text-sm font-semibold text-ink">Pour aller plus loin</h2>
      <ul className="mt-2 flex flex-col gap-2">
        {visibles.map((r, i) => (
          <li
            key={i}
            className="rounded-[10px] border border-border bg-surface px-3.5 py-2.5"
          >
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              {r.url ? (
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal underline"
                >
                  {r.titre}
                  <ExternalLink size={13} aria-hidden />
                </a>
              ) : (
                <span className="text-sm font-semibold text-ink">{r.titre}</span>
              )}
              {formateur && r.origine === "proposee" ? (
                <span className="rounded-full border border-border bg-paper px-2 py-px text-[12px] text-slate-2">
                  proposée — à vérifier
                </span>
              ) : null}
              {formateur && r.joignable === false ? (
                <span className="rounded-full border border-coral-soft bg-alert-wash px-2 py-px text-[12px] font-semibold text-coral-dark">
                  lien mort
                </span>
              ) : null}
              {onRetirer ? (
                <button
                  type="button"
                  onClick={() => onRetirer(ressources.indexOf(r))}
                  aria-label={`Retirer ${r.titre}`}
                  className="ml-auto rounded-md p-0.5 text-slate transition-colors duration-150 ease-out hover:bg-paper hover:text-coral-dark"
                >
                  <X size={14} aria-hidden />
                </button>
              ) : null}
            </div>
            {r.pourquoi ? (
              <p className="mt-1 text-[13px] leading-relaxed text-slate-2">
                {r.pourquoi}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
