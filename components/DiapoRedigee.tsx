"use client";

import type { BlocDiapo, Diapo } from "@/lib/diapos";

/**
 * Une diapositive 16:9, à la géométrie du support de référence.
 *
 * Toutes les valeurs ci-dessous sont relevées dans le PPTX fourni par le
 * porteur de projet, pas estimées : positions en pourcentage de la
 * diapositive, tailles en points converties en `cqw`. Une diapositive fait
 * 13,333 pouces de large, donc 1 pt vaut 1/96 de pouce sur 13,333, soit
 * 0,104167 cqw. Le titre de 26 pt fait ainsi 2,708 cqw exactement.
 *
 * Pourquoi cette précision : la première version posait les tailles à l'œil et
 * se trompait d'un quart — corps à 1,85 cqw au lieu de 1,458 — ce qui suffit à
 * faire déborder chaque bloc et à donner une page encombrée. Une mise en page
 * de diaporama ne se règle pas au jugé.
 */

/** Points vers `cqw` : 1 pt = 1/96 pouce, la diapositive en fait 13,333. */
const pt = (points: number) => `${(points / 96 / 13.3333) * 100}cqw`;

const MARGE = 4.5; // % — bord gauche du contenu
const LARGEUR = 90.75; // % — largeur utile
const CORPS_HAUT = 23.33; // % — première ligne sous le titre

function Pastilles({
  x,
  y,
  taille,
  ecart,
}: {
  x: number;
  y: number;
  taille: number;
  ecart: number;
}) {
  // Vert, sarcelle, corail — les trois accents du design system, dans cet
  // ordre. C'est la marque du document, elle ne se réinvente pas.
  return (
    <>
      {["bg-green", "bg-teal", "bg-coral"].map((c, i) => (
        <span
          key={c}
          aria-hidden
          className={`absolute rounded-full ${c}`}
          style={{
            left: `${x + i * ecart}%`,
            top: `${y}%`,
            width: `${taille}%`,
            aspectRatio: "1",
          }}
        />
      ))}
    </>
  );
}

function Bloc({ bloc }: { bloc: BlocDiapo }) {
  if (bloc.type === "sousTitre") {
    return (
      <p
        className="font-display font-semibold text-ink"
        style={{ fontSize: pt(16) }}
      >
        {bloc.texte}
      </p>
    );
  }

  if (bloc.type === "texte") {
    return (
      <p className="text-body" style={{ fontSize: pt(14), lineHeight: 1.45 }}>
        {bloc.texte}
      </p>
    );
  }

  if (bloc.type === "liste") {
    return (
      <ul className="flex list-none flex-col p-0" style={{ gap: "1.1%" }}>
        {bloc.items.map((it, k) => (
          <li
            key={k}
            className="flex text-body"
            style={{ gap: "1.2%", fontSize: pt(14), lineHeight: 1.45 }}
          >
            {bloc.ordonnee ? (
              <span
                className="shrink-0 font-mono text-slate-light"
                style={{ fontSize: pt(11.5), minWidth: "2.2%" }}
              >
                {String(k + 1).padStart(2, "0")}
              </span>
            ) : (
              <span
                aria-hidden
                className="mt-[0.65cqw] shrink-0 rounded-full bg-teal"
                style={{ width: "0.5cqw", height: "0.5cqw" }}
              />
            )}
            <span>{it}</span>
          </li>
        ))}
      </ul>
    );
  }

  if (bloc.type === "cartes") {
    // Deux colonnes de 44,25 %, séparées de 2,25 % : les chiffres du deck.
    return (
      <div
        className="grid grid-cols-2"
        style={{ columnGap: "2.25%", rowGap: "2%" }}
      >
        {bloc.cartes.map((c, k) => (
          // Hauteur minimale, marges et écarts internes repris du deck : la
          // carte y fait 22,82 % de la hauteur, son contenu commence à 2,66 %
          // du haut et 1,5 % du bord. C'est cette hauteur fixe qui rend la
          // grille régulière — des cartes ajustées à leur texte donnent des
          // rangées bancales.
          <div
            key={k}
            className="flex flex-col rounded-[0.6cqw] border border-border bg-surface"
            style={{
              minHeight: "22.82cqh",
              padding: "2.66cqh 1.5cqw",
              gap: "0.8cqh",
            }}
          >
            {c.intitule ? (
              <p
                className="font-mono uppercase text-slate-light"
                style={{ fontSize: pt(9.5), letterSpacing: "0.08em" }}
              >
                {c.intitule}
              </p>
            ) : null}
            {c.titre ? (
              <p
                className="font-semibold text-body"
                style={{ fontSize: pt(14), lineHeight: 1.3 }}
              >
                {c.titre}
              </p>
            ) : null}
            {c.lignes.map((l, j) => (
              <p
                key={j}
                className="text-body"
                style={{ fontSize: pt(14), lineHeight: 1.4 }}
              >
                {l}
              </p>
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[0.5cqw] border border-border">
      <table
        className="w-full border-collapse text-left"
        style={{ fontSize: pt(11) }}
      >
        <thead className="bg-paper-alt">
          <tr>
            {bloc.entetes.map((e, k) => (
              <th
                key={k}
                className="border-b border-border font-medium text-slate"
                style={{ padding: "0.7% 1%" }}
              >
                {e}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bloc.lignes.map((ligne, k) => (
            <tr key={k}>
              {ligne.map((c, j) => (
                <td
                  key={j}
                  className="border-t border-separator align-top text-body"
                  style={{ padding: "0.6% 1%" }}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DiapoRedigee({
  diapo,
  numero,
  pied,
}: {
  diapo: Diapo;
  numero: number;
  pied: string;
}) {
  // ── Couverture et intercalaires : fond encre, plein cadre ───────────────
  if (diapo.type === "couverture" || diapo.type === "intercalaire") {
    const couverture = diapo.type === "couverture";
    return (
      <div className="relative h-full w-full overflow-hidden bg-ink text-white">
        <Pastilles x={6} y={10.67} taille={1.65} ecart={2.175} />

        <p
          className="absolute font-mono uppercase"
          style={{
            left: "6%",
            top: couverture ? "19.33%" : "20%",
            width: "86.25%",
            fontSize: pt(11),
            letterSpacing: "0.14em",
            color: "#9FB0C2",
          }}
        >
          {diapo.surtitre}
        </p>

        <p
          className="absolute font-display font-bold"
          style={{
            left: "6%",
            top: couverture ? "26.67%" : "29.33%",
            width: "86.25%",
            fontSize: pt(couverture ? 44 : 40),
            lineHeight: 1.12,
            letterSpacing: "-0.02em",
          }}
        >
          {diapo.titre}
        </p>

        {diapo.sousTitre ? (
          <p
            className="absolute"
            style={{
              left: "6%",
              top: couverture ? "49.33%" : "46%",
              width: "82.5%",
              fontSize: pt(18),
              lineHeight: 1.4,
              color: "#DCE3EB",
            }}
          >
            {diapo.sousTitre}
          </p>
        ) : null}

        {couverture && diapo.meta.length > 0 ? (
          <dl
            className="absolute grid grid-cols-2"
            style={{
              left: "6%",
              top: "66.67%",
              width: "86.25%",
              columnGap: "3%",
              rowGap: "2.2%",
              fontSize: pt(12.5),
              color: "#DCE3EB",
            }}
          >
            {diapo.meta.map((m) => (
              <div key={m.cle} className="flex flex-col" style={{ gap: "0.4%" }}>
                <dt
                  className="font-mono uppercase"
                  style={{
                    fontSize: pt(9.5),
                    letterSpacing: "0.12em",
                    color: "#9FB0C2",
                  }}
                >
                  {m.cle}
                </dt>
                <dd style={{ lineHeight: 1.35 }}>{m.valeur}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    );
  }

  // ── Sommaire et contenu : fond clair, en-tête et pied fixes ─────────────
  return (
    <div className="relative h-full w-full overflow-hidden bg-surface">
      <Pastilles x={4.65} y={7.73} taille={1.2} ecart={1.575} />

      <p
        className="absolute font-mono uppercase text-slate-light"
        style={{
          left: "10.88%",
          top: "6.67%",
          width: "71.25%",
          fontSize: pt(10.5),
          letterSpacing: "0.14em",
        }}
      >
        {diapo.surtitre}
      </p>

      <p
        className="absolute font-display font-bold text-ink"
        style={{
          left: `${MARGE}%`,
          top: "11.33%",
          width: `${LARGEUR}%`,
          fontSize: pt(26),
          lineHeight: 1.15,
          letterSpacing: "-0.02em",
        }}
      >
        {diapo.type === "sommaire" ? "Sommaire" : diapo.titre}
      </p>

      <div
        className="absolute overflow-hidden"
        style={{
          left: `${MARGE}%`,
          top: `${CORPS_HAUT}%`,
          width: `${LARGEUR}%`,
          bottom: "9.5%",
        }}
      >
        {diapo.type === "sommaire" ? (
          // Deux colonnes, pastille numérotée : la forme du deck. Une colonne
          // unique laisserait la moitié droite vide sur un 16:9.
          <div
            className="grid grid-cols-2"
            style={{ columnGap: "2.5%", rowGap: "2.4%" }}
          >
            {diapo.entrees.map((e, i) => (
              <div key={i} className="flex items-start" style={{ gap: "1.4%" }}>
                <span
                  className={`flex shrink-0 items-center justify-center rounded-[0.35cqw] font-display font-semibold text-white ${
                    ["bg-ink", "bg-teal", "bg-green", "bg-coral"][i % 4]
                  }`}
                  style={{
                    width: "3.3%",
                    aspectRatio: "1",
                    fontSize: pt(11),
                  }}
                >
                  {i}
                </span>
                <span
                  className="text-body"
                  style={{ fontSize: pt(14), lineHeight: 1.35 }}
                >
                  {e}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col" style={{ gap: "2.4%" }}>
            {diapo.blocs.map((b, i) => (
              <Bloc key={i} bloc={b} />
            ))}
          </div>
        )}
      </div>

      <p
        className="absolute font-mono text-slate-light"
        style={{ left: `${MARGE}%`, top: "94.4%", fontSize: pt(8.5) }}
      >
        {pied}
      </p>
      <p
        className="absolute text-right font-mono text-slate-light"
        style={{ right: `${MARGE}%`, top: "94.4%", fontSize: pt(8.5) }}
      >
        {numero}
      </p>
    </div>
  );
}
