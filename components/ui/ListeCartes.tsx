import type { ReactNode } from "react";

/**
 * Une liste qui est un tableau sur écran large et des cartes sous 768px
 * (design_system.md §3bis).
 *
 * Treize écrans formateur portent aujourd'hui un tableau dense. Les convertir
 * un par un aurait produit treize interprétations du même pattern ; celui-ci
 * est écrit une fois et décrit par les données.
 *
 * Les deux rendus coexistent dans le DOM, l'un caché par un point de rupture
 * CSS. C'est délibéré : détecter la largeur en JavaScript ferait clignoter la
 * liste à l'hydratation et se tromperait pendant le rendu serveur, pour une
 * poignée de lignes en double dont le poids est négligeable.
 */

export type RoleColonne =
  /** Le nom de la ligne. Une seule colonne le porte. */
  | "titre"
  /** Ce qui qualifie le titre — code, groupe, date. Sous le titre en carte. */
  | "meta"
  /** Une valeur secondaire, affichée avec son libellé en carte. */
  | "detail"
  /** Boutons et menus : en haut à droite de la carte. */
  | "action";

export type Colonne<T> = {
  cle: string;
  entete: string;
  cellule: (ligne: T) => ReactNode;
  /** Défaut : `detail`. */
  role?: RoleColonne;
  aligne?: "droite";
  /**
   * Colonne à taire en carte — une information déjà portée par le contexte,
   * ou trop longue pour un petit écran. Elle reste dans le tableau.
   */
  masqueeEnCarte?: boolean;
};

export default function ListeCartes<T>({
  colonnes,
  lignes,
  cle,
  vide,
  href,
}: {
  colonnes: Colonne<T>[];
  lignes: T[];
  cle: (ligne: T) => string;
  /** Ce qu'on affiche quand il n'y a rien — jamais « aucune donnée » (§11). */
  vide: ReactNode;
  /** Rend la carte entière cliquable, quand la ligne mène quelque part. */
  href?: (ligne: T) => string | null;
}) {
  if (lignes.length === 0) {
    return (
      <div className="rounded-[14px] border border-border bg-surface px-6 py-8 text-center text-sm text-slate shadow-repos">
        {vide}
      </div>
    );
  }

  const par = (role: RoleColonne) =>
    colonnes.filter((c) => (c.role ?? "detail") === role && !c.masqueeEnCarte);

  const titre = par("titre")[0];
  const metas = par("meta");
  const details = par("detail");
  const actions = par("action");

  return (
    <>
      {/* ── Écran large : le tableau, inchangé ────────────────────────── */}
      <div className="hidden overflow-hidden rounded-[14px] border border-border bg-surface shadow-repos md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-paper text-xs uppercase tracking-wide text-slate">
                {colonnes.map((c) => (
                  <th
                    key={c.cle}
                    className={`px-4 py-3 font-medium ${c.aligne === "droite" ? "text-right" : ""}`}
                  >
                    {c.entete}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => (
                <tr
                  key={cle(l)}
                  className="border-t border-border transition-colors duration-150 ease-out hover:bg-wash/50"
                >
                  {colonnes.map((c) => (
                    <td
                      key={c.cle}
                      className={`px-4 py-3 align-top ${
                        c.aligne === "droite" ? "text-right" : ""
                      } ${(c.role ?? "detail") === "titre" ? "font-medium text-ink" : ""}`}
                    >
                      {c.cellule(l)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Sous 768px : une carte par ligne ──────────────────────────── */}
      <ul className="flex list-none flex-col gap-2.5 p-0 md:hidden">
        {lignes.map((l) => {
          const lien = href?.(l) ?? null;
          const contenu = (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  {/* Un div et non un span : une colonne `titre` peut rendre
                      une structure entière — un nom, puis un dépliant. */}
                  {titre ? (
                    <div className="text-[15px] font-semibold leading-snug text-ink">
                      {titre.cellule(l)}
                    </div>
                  ) : null}
                  {/* La ligne d'identité à deux niveaux (§4) : le nom, puis
                      ce qui le qualifie, jamais sur la même ligne. */}
                  {metas.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-slate-2">
                      {metas.map((c) => (
                        <span key={c.cle}>{c.cellule(l)}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
                {actions.length > 0 ? (
                  <span className="flex shrink-0 items-center gap-1.5">
                    {actions.map((c) => (
                      <span key={c.cle}>{c.cellule(l)}</span>
                    ))}
                  </span>
                ) : null}
              </div>

              {details.length > 0 ? (
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-separator pt-3">
                  {details.map((c) => (
                    <div key={c.cle} className="flex flex-col gap-0.5">
                      <dt className="text-xs text-slate-light">{c.entete}</dt>
                      <dd className="text-sm text-ink">{c.cellule(l)}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </>
          );

          const habillage =
            "block rounded-[14px] border border-border bg-surface px-4 py-3.5 shadow-repos";

          return (
            <li key={cle(l)}>
              {lien ? (
                <a
                  href={lien}
                  className={`${habillage} transition-colors duration-150 ease-out hover:bg-paper-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal`}
                >
                  {contenu}
                </a>
              ) : (
                <div className={habillage}>{contenu}</div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
