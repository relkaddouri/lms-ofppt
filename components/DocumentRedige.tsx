import { Fragment } from "react";
import { analyser, enTeteDocument, type Noeud } from "@/lib/diapos";
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

/**
 * Colonnes rendues en pastilles.
 *
 * Une colonne dont toutes les cellules tiennent en un mot court est une
 * colonne de catégories — « Quanti », « Quali », « Mixte ». Le support de
 * référence les pose en pastilles colorées : on les compare alors d'un coup
 * d'œil au lieu de les lire ligne à ligne.
 *
 * La couleur suit l'ordre d'apparition des valeurs distinctes, pas leur
 * contenu : rien à coder en dur, et deux tableaux du même document donnent la
 * même couleur à la même valeur.
 */
const PASTILLES = [
  "border-tint-teal-strong bg-tint-teal text-teal-dark",
  "border-tint-green bg-success-wash text-green-dark",
  "border-tint-alert-strong bg-alert-wash text-coral-dark",
  "border-border bg-wash-strong text-slate-2",
] as const;

function colonnesEnPastilles(lignes: string[][], nbColonnes: number) {
  const enPastille = new Set<number>();
  const couleurs = new Map<string, string>();

  for (let c = 0; c < nbColonnes; c++) {
    const valeurs = lignes.map((l) => (l[c] ?? "").trim()).filter(Boolean);
    if (valeurs.length < 3) continue;
    if (!valeurs.every((v) => v.length <= 12 && !/\s/.test(v))) continue;
    // Des valeurs toutes différentes ne sont pas des catégories : ce sont des
    // données. Une catégorie se répète.
    const distinctes = [...new Set(valeurs)];
    if (distinctes.length > 4 || distinctes.length === valeurs.length) continue;
    enPastille.add(c);
    distinctes.forEach((v, i) => {
      if (!couleurs.has(v)) couleurs.set(v, PASTILLES[i % PASTILLES.length]!);
    });
  }
  return { enPastille, couleurs };
}

function Tableau({ entetes, lignes }: { entetes: string[]; lignes: string[][] }) {
  const { enPastille, couleurs } = colonnesEnPastilles(lignes, entetes.length);
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
                  {enPastille.has(j) && c.trim() ? (
                    <span
                      className={`inline-block whitespace-nowrap rounded-full border px-2 py-px text-[11.5px] font-semibold ${
                        couleurs.get(c.trim()) ?? PASTILLES[3]
                      }`}
                    >
                      {c.trim()}
                    </span>
                  ) : (
                    <Ligne>{c}</Ligne>
                  )}
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

/**
 * La page de couverture, reprise du support de référence.
 *
 * Un panneau encre encastré dans la page blanche, et non une page pleine :
 * c'est ce qui lui donne l'air d'un document relié plutôt que d'une bannière.
 * Le titre en haut, les métadonnées enfermées dans un cadre en bas, et entre
 * les deux le vide — qui fait la moitié de l'effet.
 *
 * `break-after: page` à l'impression : le corps commence à la page suivante.
 */
function Couverture({
  titre,
  sousTitre,
  legende,
  meta,
  surtitre,
}: {
  titre: string;
  sousTitre: string | null;
  legende: string | null;
  meta: { cle: string; valeur: string }[];
  surtitre: string | null;
}) {
  return (
    <section className="doc-couverture flex min-h-[62vh] flex-col rounded-[14px] bg-ink px-8 py-9 text-white md:min-h-[900px] md:px-12 md:py-14">
      <span aria-hidden className="mb-7 flex items-center gap-1.5">
        {["bg-green", "bg-teal", "bg-coral"].map((c) => (
          <span key={c} className={`h-2.5 w-2.5 rounded-full ${c}`} />
        ))}
      </span>

      {surtitre ? (
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/50">
          {surtitre}
        </p>
      ) : null}

      <h1 className="mt-3 font-display text-[34px] font-bold leading-[1.1] tracking-[-0.02em] md:text-[42px]">
        {titre}
      </h1>

      {sousTitre ? (
        <p className="mt-4 text-[17px] leading-relaxed text-white/75">
          {sousTitre}
        </p>
      ) : null}

      {legende ? (
        <p className="mt-2 text-[14.5px] italic leading-relaxed text-white/55">
          {legende}
        </p>
      ) : null}

      {meta.length > 0 ? (
        <div className="mt-auto pt-12">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-white/40">
            Support de cours du stagiaire
          </p>
          <dl className="mt-3 flex flex-col gap-1.5 rounded-[10px] bg-white/[0.06] px-5 py-4 text-[13.5px] leading-relaxed">
            {meta.map((m) => (
              <div key={m.cle} className="flex flex-wrap gap-x-2">
                <dt className="font-semibold text-white/90">{m.cle}</dt>
                <dd className="text-white/70">{m.valeur}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </section>
  );
}

export default function DocumentRedige({
  texte,
  surtitre,
}: {
  texte: string;
  /** Module et groupe, pour le surtitre de la couverture. */
  surtitre?: string | null;
}) {
  const noeuds = analyser(texte);
  const entete = enTeteDocument(noeuds);

  // Pas de couverture sans métadonnées : un texte collé à la va-vite n'a pas à
  // se voir affublé d'une page de garde vide.
  if (!entete || entete.meta.length === 0) return <Blocs texte={texte} />;

  const corps = texte
    .replace(/\r\n/g, "\n")
    .split("\n")
    .slice(lignesDeLEntete(texte, entete.consommes))
    .join("\n");

  return (
    <div className="flex flex-col gap-6">
      <Couverture
        titre={entete.titre}
        sousTitre={entete.sousTitre}
        legende={entete.legende}
        meta={entete.meta}
        surtitre={surtitre ?? null}
      />
      <Blocs texte={corps} />
    </div>
  );
}

/**
 * Où couper le markdown pour laisser la couverture derrière soi.
 *
 * `enTeteDocument` compte en nœuds, pas en lignes : on retrouve la ligne en
 * comptant les blocs franchis. Plus simple et plus sûr que de recomposer le
 * texte à partir des nœuds, qui perdrait les blancs et le balisage.
 */
function lignesDeLEntete(texte: string, noeudsConsommes: number): number {
  const lignes = texte.replace(/\r\n/g, "\n").split("\n");
  let vus = 0;
  let i = 0;
  while (i < lignes.length && vus < noeudsConsommes) {
    const l = lignes[i]!.trim();
    i++;
    if (!l) continue;
    vus++;
    // Une citation ou un tableau occupe plusieurs lignes pour un seul nœud.
    if (l.startsWith(">")) {
      while (i < lignes.length && lignes[i]!.trim().startsWith(">")) i++;
    }
  }
  return i;
}
