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
// Le corps commençait à 23,33 % dans le support de référence, sous un titre
// de 26 pt posé à 11,33 % : 11,33 + 26 × 1,15 / 540 pt, soit 5,54 %, laisse un
// écart de 6,46 %. C'est ce chiffre qui sépare maintenant titre et corps, le
// titre étant passé dans le flux.
const ECART_TITRE = "6.46cqh";
const CORPS_SEUL = 13.5; // % — première ligne quand le titre n'est pas repris

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
        {bloc.cartes.map((c, k) => {
          // Marges et écarts internes repris du deck : le contenu commence à
          // 2,66 % du haut et 1,5 % du bord. La hauteur plancher de 22,82 %
          // rend la grille régulière — des cartes ajustées à leur texte
          // donnent des rangées bancales — mais elle n'a de sens qu'entre deux
          // cartes qui se font face. Une carte seule prend toute la largeur et
          // sa hauteur naturelle, plutôt que de flotter dans une demi-boîte.
          const seule = k === bloc.cartes.length - 1 && k % 2 === 0;
          return (
          <div
            key={k}
            className={`flex flex-col rounded-[0.6cqw] border ${
              c.accent === "encre"
                ? "border-ink bg-ink"
                : c.accent === "sarcelle"
                  ? "border-tint-teal-strong bg-tint-teal"
                  : "border-border bg-surface"
            }`}
            style={{
              gridColumn: seule ? "1 / -1" : undefined,
              minHeight: seule ? undefined : "22.82cqh",
              padding: "2.66cqh 1.5cqw",
              gap: "0.8cqh",
              // Une ombre très basse détache la carte du fond sans la faire
              // flotter : c'est ce que fait le support de référence.
              boxShadow: "0 0.12cqw 0.4cqw rgba(46,59,78,0.06)",
            }}
          >
            {c.intitule ? (
              <p
                className={`font-mono uppercase ${
                  c.accent === "encre" ? "text-white/55" : "text-slate-light"
                }`}
                style={{ fontSize: pt(9.5), letterSpacing: "0.08em" }}
              >
                {c.intitule}
              </p>
            ) : null}
            {c.titre ? (
              <p
                className={`font-semibold ${
                  c.accent === "encre" ? "text-white" : "text-body"
                }`}
                style={{ fontSize: pt(14), lineHeight: 1.3 }}
              >
                {c.titre}
              </p>
            ) : null}
            {c.lignes.map((l, j) => (
              <p
                key={j}
                className={`flex ${
                  c.accent === "encre" ? "text-white/85" : "text-body"
                }`}
                style={{
                  fontSize: pt(14),
                  lineHeight: 1.4,
                  gap: l.puce ? "0.8cqw" : undefined,
                }}
              >
                {l.puce ? (
                  <span
                    aria-hidden
                    className={`mt-[0.55cqw] shrink-0 rounded-full ${
                      c.accent === "encre" ? "bg-white/50" : "bg-teal"
                    }`}
                    style={{ width: "0.4cqw", height: "0.4cqw" }}
                  />
                ) : null}
                <span>{l.texte}</span>
              </p>
            ))}
          </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[0.5cqw] border border-border">
      <table
        className="w-full border-collapse text-left"
        style={{ fontSize: pt(11) }}
      >
        <thead className="bg-ink">
          <tr>
            {bloc.entetes.map((e, k) => (
              <th
                key={k}
                className="font-semibold text-white"
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

        {/* Le sous-titre suit le titre au lieu d'être posé à une ordonnée
            fixe : celle-ci laissait un trou sous un titre d'une ligne et
            passait par-dessus un titre de deux. L'écart reproduit celui du
            support de référence pour un titre d'une ligne. */}
        <div
          className="absolute"
          style={{
            left: "6%",
            top: couverture ? "26.67%" : "29.33%",
            width: "86.25%",
          }}
        >
          <p
            className="font-display font-bold"
            style={{
              fontSize: pt(couverture ? 44 : 40),
              lineHeight: 1.12,
              letterSpacing: "-0.02em",
            }}
          >
            {diapo.titre}
          </p>

          {diapo.sousTitre ? (
            <p
              style={{
                marginTop: couverture ? "13.53cqh" : "8.37cqh",
                width: "95.6%",
                fontSize: pt(18),
                lineHeight: 1.4,
                color: "#DCE3EB",
              }}
            >
              {diapo.sousTitre}
            </p>
          ) : null}
        </div>

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
  //
  // Le titre n'est écrit qu'une fois par section. Les diapositives qui la
  // poursuivent s'en passent — le surtitre court en haut de chacune et dit
  // déjà où l'on est — et récupèrent en échange la hauteur du titre.
  const titre =
    diapo.type === "sommaire" ? "Sommaire" : diapo.suite ? null : diapo.titre;

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

      <div
        className="absolute flex flex-col overflow-hidden"
        style={{
          left: `${MARGE}%`,
          top: titre ? "11.33%" : `${CORPS_SEUL}%`,
          width: `${LARGEUR}%`,
          bottom: "9.5%",
        }}
      >
        {/* Le titre est dans le flux, non posé à une ordonnée fixe : sur deux
            lignes il pousse le corps au lieu de l'écraser. L'écart sous lui
            reproduit celui du support de référence pour une ligne. */}
        {titre ? (
          <p
            className="shrink-0 font-display font-bold text-ink"
            style={{
              marginBottom: ECART_TITRE,
              fontSize: pt(26),
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
            }}
          >
            {titre}
          </p>
        ) : null}

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
