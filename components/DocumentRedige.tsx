import { Fragment } from "react";
import { analyser, type Noeud } from "@/lib/diapos";
import { segmenter } from "@/lib/markdown";

/**
 * Un cours rédigé, mis en page comme un document (PRD §4.4).
 *
 * Le rendu précédent empilait des boîtes grises identiques : lisible, mais
 * plat. Le support de référence du porteur de projet est autrement travaillé,
 * et ce sont quatre dispositifs qui font la différence — relevés dans son PDF,
 * pas inventés :
 *
 * - un **numéro de section** en gros chiffre coloré, avec sa ligne de contexte
 *   au-dessus et un filet en dessous ;
 * - les **encadrés parallèles en grille**, deux ou trois par rangée selon leur
 *   nombre, avec une teinte qui tourne — vert, sarcelle, neutre ;
 * - des **tableaux à en-tête encre**, texte blanc ;
 * - un rythme qui alterne au lieu d'une colonne uniforme.
 *
 * D'où le passage par `analyser` plutôt que par un rendu markdown direct :
 * regrouper des encadrés consécutifs suppose de les voir comme un groupe, ce
 * qu'un rendu ligne à ligne ne permet pas. C'est le même découpage que le
 * diaporama, donc les deux documents ne peuvent pas diverger.
 */

/**
 * Texte court avec son balisage en ligne — gras, italique, code, liens.
 *
 * Un analyseur markdown complet par fragment coûtait des centaines
 * d'instances sur un support qui compte dix-sept tableaux : la page se figeait
 * à l'affichage. `segmenter` fait le même travail sur une ligne, sans arbre.
 */
function Ligne({ children }: { children: string }) {
  const morceaux: React.ReactNode[] = [];
  let cle = 0;

  // Les liens d'abord : leur syntaxe englobe du texte qui peut être en gras.
  const motifLien = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  let position = 0;
  const pousserTexte = (t: string) => {
    for (const seg of segmenter(t)) {
      if (!seg.texte) continue;
      if (seg.code) {
        morceaux.push(
          <code
            key={cle++}
            className="rounded bg-wash-strong px-1 py-px font-mono text-[0.92em] text-ink"
          >
            {seg.texte}
          </code>,
        );
      } else if (seg.gras) {
        morceaux.push(
          <strong key={cle++} className="font-semibold text-ink">
            {seg.texte}
          </strong>,
        );
      } else if (seg.italique) {
        morceaux.push(
          <em key={cle++} className="italic">
            {seg.texte}
          </em>,
        );
      } else {
        morceaux.push(<span key={cle++}>{seg.texte}</span>);
      }
    }
  };

  for (const trouve of children.matchAll(motifLien)) {
    if (trouve.index > position) pousserTexte(children.slice(position, trouve.index));
    morceaux.push(
      <a
        key={cle++}
        href={trouve[2]}
        target="_blank"
        rel="noreferrer"
        className="text-teal underline underline-offset-2"
      >
        {trouve[1]}
      </a>,
    );
    position = trouve.index + trouve[0].length;
  }
  if (position < children.length) pousserTexte(children.slice(position));

  return <>{morceaux}</>;
}

/**
 * Les teintes d'encadré, dans l'ordre où elles tournent.
 *
 * Trois notions parallèles — first, second, third party — se distinguent par
 * leur fond avant même d'être lues. Une quatrième reprend la première : au-delà
 * de trois, la couleur ne classe plus rien, elle décore.
 */
const TEINTES = [
  "border-tint-green bg-success-wash",
  "border-tint-teal-strong bg-tint-teal",
  "border-border bg-paper",
] as const;

function Encadres({ groupes }: { groupes: string[][] }) {
  // Une rangée ne met côte à côte que des encadrés comparables. Un long
  // paragraphe posé à côté de trois notions brèves étire sa rangée et laisse
  // deux colonnes aux trois quarts vides — c'est ce qui donne l'impression de
  // désordre. Au-delà de 320 signes, l'encadré prend la largeur.
  const long = groupes.some((g) => g.join(" ").length > 320);
  const colonnes =
    long || groupes.length === 1
      ? ""
      : groupes.length >= 3
        ? "md:grid-cols-3"
        : "md:grid-cols-2";

  return (
    <div className={`grid grid-cols-1 gap-3 ${colonnes}`}>
      {groupes.map((lignes, i) => {
        const utiles = lignes.filter((l) => l.trim());
        const premiere = utiles[0] ?? "";
        const nue = premiere.replace(/\*\*/g, "").trim();
        const estIntitule =
          nue.length > 1 &&
          nue.length <= 90 &&
          /\p{Lu}/u.test(nue) &&
          nue === nue.toLocaleUpperCase("fr");

        return (
          <aside
            key={i}
            className={`flex flex-col gap-2 rounded-[12px] border px-4 py-3.5 ${
              groupes.length > 1 ? TEINTES[i % TEINTES.length] : TEINTES[2]
            }`}
          >
            {estIntitule ? (
              <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] text-slate-light">
                {nue}
              </p>
            ) : null}
            {/* Le contenu d'un encadré est un document à son tour : il porte
                des listes, parfois un tableau — les blocs de données du cas
                fil rouge en sont faits. Rendre chaque ligne comme du texte
                produisait des listes à l'intérieur de paragraphes, ce qui
                n'est pas du HTML valide et cassait l'hydratation. */}
            <Blocs texte={utiles.slice(estIntitule ? 1 : 0).join("\n")} />
          </aside>
        );
      })}
    </div>
  );
}

function Tableau({ entetes, lignes }: { entetes: string[]; lignes: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-[10px] border border-border">
      <table className="w-full border-collapse text-left text-[13px]">
        {/* En-tête encre, texte blanc : c'est ce qui fait qu'un tableau se
            repère d'un coup d'œil dans une page dense. */}
        <thead className="bg-ink text-white">
          <tr>
            {entetes.map((e, k) => (
              <th key={k} className="px-3 py-2 font-medium">
                {e}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lignes.map((ligne, k) => (
            <tr key={k} className="even:bg-paper-alt">
              {ligne.map((c, j) => (
                <td
                  key={j}
                  className={`border-t border-separator px-3 py-2 align-top ${
                    j === 0 ? "font-semibold text-ink" : "text-body"
                  }`}
                >
                  <Ligne>{c}</Ligne>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Couleur du numéro de section, tournante comme dans le support de référence. */
const NUMEROS = ["text-coral", "text-teal", "text-green", "text-ink"] as const;

function Blocs({ texte }: { texte: string }) {
  const noeuds = analyser(texte);
  const rendu: React.ReactNode[] = [];

  let i = 0;
  let rangSection = 0;
  // Une ligne en italique juste après un titre est sa légende : « Bloc 2 ·
  // 15 h 00 – 16 h 10 ». Elle se pose au-dessus du titre, en surtitre.
  const estLegende = (n: Noeud | undefined) =>
    n?.k === "p" && /^\*[^*]+\*$/.test(n.brut.trim());

  while (i < noeuds.length) {
    const n = noeuds[i]!;

    if (n.k === "h") {
      if (n.niveau === 1) {
        rendu.push(
          <h1
            key={i}
            className="font-display text-[26px] font-bold leading-tight tracking-[-0.02em] text-ink"
          >
            {n.texte}
          </h1>,
        );
        i++;
        continue;
      }

      if (n.niveau === 2) {
        const numero = n.texte.match(/^(\d+)[.)]\s*(.*)$/);
        const legende = estLegende(noeuds[i + 1]) ? noeuds[i + 1]! : null;
        const couleur = NUMEROS[rangSection % NUMEROS.length];
        rangSection++;

        rendu.push(
          <header key={i} className="mt-3 border-b border-border-strong pb-2">
            {legende && legende.k === "p" ? (
              <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-slate-light">
                {legende.texte.replace(/^\*|\*$/g, "")}
              </p>
            ) : null}
            <div className="flex items-baseline gap-3">
              {numero ? (
                <span
                  className={`font-display text-[26px] font-bold leading-none ${couleur}`}
                >
                  {numero[1]}
                </span>
              ) : null}
              <h2 className="font-display text-[19px] font-semibold leading-snug text-ink">
                {numero ? numero[2] : n.texte}
              </h2>
            </div>
          </header>,
        );
        i += legende ? 2 : 1;
        continue;
      }

      const Balise = (n.niveau === 3 ? "h3" : "h4") as "h3" | "h4";
      rendu.push(
        <Balise
          key={i}
          className={
            n.niveau === 3
              ? "mt-2 font-display text-[15.5px] font-semibold text-ink"
              : "mt-1 font-display text-[14px] font-semibold text-body"
          }
        >
          {n.texte}
        </Balise>,
      );
      i++;
      continue;
    }

    // Encadrés consécutifs : un groupe, donc une grille.
    if (n.k === "quote") {
      const groupes: string[][] = [];
      while (i < noeuds.length && noeuds[i]!.k === "quote") {
        groupes.push((noeuds[i] as { lignes: string[] }).lignes);
        i++;
      }
      rendu.push(<Encadres key={`q${i}`} groupes={groupes} />);
      continue;
    }

    if (n.k === "table") {
      rendu.push(<Tableau key={i} entetes={n.entetes} lignes={n.lignes} />);
      i++;
      continue;
    }

    if (n.k === "li") {
      const items: { brut: string; ordonnee: boolean }[] = [];
      const ordonnee = n.ordonnee;
      while (i < noeuds.length && noeuds[i]!.k === "li") {
        const l = noeuds[i] as { brut: string; ordonnee: boolean };
        if (l.ordonnee !== ordonnee) break;
        items.push(l);
        i++;
      }
      rendu.push(
        <ol
          key={`l${i}`}
          className={`flex flex-col gap-1.5 pl-0 text-[14px] leading-relaxed text-body`}
        >
          {items.map((it, k) => (
            <li key={k} className="flex gap-2.5">
              <span
                className={
                  ordonnee
                    ? "shrink-0 font-mono text-[13px] font-semibold text-coral"
                    : "mt-[7px] h-[5px] w-[5px] shrink-0 rounded-full bg-teal"
                }
                aria-hidden={!ordonnee}
              >
                {ordonnee ? k + 1 : null}
              </span>
              <span>
                <Ligne>{it.brut}</Ligne>
              </span>
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    if (n.k === "hr") {
      rendu.push(<hr key={i} className="border-t border-separator" />);
      i++;
      continue;
    }

    rendu.push(
      <p key={i} className="text-[14px] leading-relaxed text-body">
        <Ligne>{n.brut}</Ligne>
      </p>,
    );
    i++;
  }

  return (
    <div className="flex flex-col gap-3">
      {rendu.map((r, k) => (
        <Fragment key={k}>{r}</Fragment>
      ))}
    </div>
  );
}

export default function DocumentRedige({ texte }: { texte: string }) {
  return <Blocs texte={texte} />;
}
