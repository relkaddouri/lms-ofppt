/**
 * L'aller-retour entre ce que le stagiaire voit et ce qu'on enregistre.
 *
 * Il compose dans une zone visuelle : un tableau est un tableau, du gras est
 * gras, et aucune syntaxe ne traîne à l'écran. Ce qui part en base, lui, reste
 * du Markdown — toute la chaîne qui existe déjà le consomme ainsi : la
 * correction par l'IA, le PDF de la copie, l'affichage au formateur. Changer
 * le format de stockage aurait obligé à les réécrire tous, pour un gain nul
 * du côté de celui qui écrit.
 *
 * Le sous-ensemble est volontairement étroit — paragraphes, gras, italique,
 * listes, tableaux. C'est ce qu'une copie demande, et c'est ce qui fait un
 * aller-retour fidèle. Tout le reste est ramené à du texte.
 */

import { analyser, versBloc } from "@/lib/schema-reponse";
import { svgDuSchema } from "@/lib/schema-svg";

/** Ce qu'un attribut ou un texte ne doit jamais pouvoir ouvrir. */
function echapper(texte: string): string {
  return texte
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Les marques d'une ligne : `**gras**` et `*italique*`.
 *
 * On traite le gras d'abord : sans cela, `**mot**` serait lu comme deux
 * italiques accolés et rendrait `<em></em>mot<em></em>`.
 */
function marquesVersHtml(ligne: string): string {
  return echapper(ligne)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
}

/** Une ligne de tableau Markdown découpée en cellules. */
function cellules(ligne: string): string[] {
  return ligne
    .replace(/^\s*\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map((c) => c.trim());
}

const estSeparateur = (ligne: string) =>
  /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(ligne) && ligne.includes("-");

const estLigneTableau = (ligne: string) => ligne.trim().startsWith("|");

/**
 * Du Markdown enregistré vers le document que le stagiaire manipule.
 *
 * Appelé pour garnir la zone d'édition : à l'ouverture d'une copie reprise,
 * et quand un gabarit est inséré.
 */
export function versHtml(markdown: string): string {
  const lignes = markdown.replace(/\r\n/g, "\n").split("\n");
  const sortie: string[] = [];
  let i = 0;

  while (i < lignes.length) {
    const ligne = lignes[i]!;

    if (ligne.trim() === "") {
      i += 1;
      continue;
    }

    // Un schéma dessiné. Il entre dans le document comme un bloc qu'on ne
    // modifie pas au clavier : son contenu est du JSON, qu'une frappe
    // malheureuse rendrait illisible. On le rouvre dans son éditeur.
    if (ligne.trim() === "```schema") {
      const corps: string[] = [];
      i += 1;
      while (i < lignes.length && lignes[i]!.trim() !== "```") {
        corps.push(lignes[i]!);
        i += 1;
      }
      i += 1;
      const lu = analyser(corps.join("\n"));
      if (lu) {
        sortie.push(
          `<figure data-schema="${echapper(JSON.stringify(lu)).replace(/"/g, "&quot;")}" contenteditable="false">${svgDuSchema(lu)}</figure>`,
        );
      }
      continue;
    }

    // Un tableau : la ligne d'en-tête, son séparateur, puis le corps.
    if (estLigneTableau(ligne) && estSeparateur(lignes[i + 1] ?? "")) {
      const entetes = cellules(ligne);
      i += 2;
      const corps: string[][] = [];
      while (i < lignes.length && estLigneTableau(lignes[i]!)) {
        corps.push(cellules(lignes[i]!));
        i += 1;
      }
      const thead = `<thead><tr>${entetes
        .map((c) => `<th>${marquesVersHtml(c)}</th>`)
        .join("")}</tr></thead>`;
      const tbody = `<tbody>${corps
        .map(
          (r) =>
            `<tr>${entetes
              .map((_, c) => `<td>${marquesVersHtml(r[c] ?? "")}</td>`)
              .join("")}</tr>`,
        )
        .join("")}</tbody>`;
      sortie.push(`<table>${thead}${tbody}</table>`);
      continue;
    }

    // Une liste : on avale toutes les lignes de même nature.
    const puce = /^\s*[-*+]\s+(.*)$/.exec(ligne);
    const numero = /^\s*\d+[.)]\s+(.*)$/.exec(ligne);
    if (puce || numero) {
      const ordonnee = Boolean(numero);
      const items: string[] = [];
      while (i < lignes.length) {
        const m = ordonnee
          ? /^\s*\d+[.)]\s+(.*)$/.exec(lignes[i]!)
          : /^\s*[-*+]\s+(.*)$/.exec(lignes[i]!);
        if (!m) break;
        items.push(`<li>${marquesVersHtml(m[1]!)}</li>`);
        i += 1;
      }
      sortie.push(`<${ordonnee ? "ol" : "ul"}>${items.join("")}</${ordonnee ? "ol" : "ul"}>`);
      continue;
    }

    sortie.push(`<p>${marquesVersHtml(ligne)}</p>`);
    i += 1;
  }

  // Une zone vide a besoin d'un paragraphe : sans lui, le navigateur n'a nulle
  // part où poser le curseur, et la première frappe crée un nœud de texte nu
  // que la sérialisation perdrait.
  return sortie.join("") || "<p><br></p>";
}

/** Le texte d'un nœud, avec ses marques de gras et d'italique. */
function marquesVersMarkdown(noeud: Node): string {
  if (noeud.nodeType === Node.TEXT_NODE) {
    // Les caractères qui porteraient une syntaxe sont neutralisés : un
    // stagiaire qui écrit « 3 * 4 » ne doit pas produire d'italique.
    return (noeud.textContent ?? "").replace(/([*_`|])/g, "\\$1");
  }
  if (noeud.nodeType !== Node.ELEMENT_NODE) return "";

  const el = noeud as HTMLElement;
  const dedans = Array.from(el.childNodes).map(marquesVersMarkdown).join("");

  switch (el.tagName) {
    case "BR":
      return " ";
    case "STRONG":
    case "B":
      return dedans.trim() ? `**${dedans}**` : dedans;
    case "EM":
    case "I":
      return dedans.trim() ? `*${dedans}*` : dedans;
    default:
      return dedans;
  }
}

/** Une cellule : son contenu sur une seule ligne, les barres neutralisées. */
function cellule(el: Element): string {
  return marquesVersMarkdown(el).replace(/\s*\n\s*/g, " ").trim();
}

/**
 * Du document manipulé vers le Markdown enregistré.
 *
 * Appelé à chaque frappe : c'est ce qui part dans la copie, et c'est ce que
 * le correcteur lira.
 */
export function versMarkdown(racine: HTMLElement): string {
  const blocs: string[] = [];

  for (const enfant of Array.from(racine.children)) {
    const el = enfant as HTMLElement;

    if (el.tagName === "FIGURE" && el.dataset.schema) {
      const lu = analyser(el.dataset.schema);
      if (lu) blocs.push(versBloc(lu));
      continue;
    }

    if (el.tagName === "TABLE") {
      const lignes = Array.from(el.querySelectorAll("tr"));
      if (lignes.length === 0) continue;
      const rendues = lignes.map((tr) =>
        Array.from(tr.children).map((c) => cellule(c)),
      );
      const colonnes = Math.max(...rendues.map((r) => r.length));
      const ligne = (cs: string[]) =>
        `| ${Array.from({ length: colonnes }, (_, i) => cs[i] ?? "").join(" | ")} |`;
      const [entete, ...corps] = rendues;
      blocs.push(
        [
          ligne(entete ?? []),
          `| ${Array.from({ length: colonnes }, () => "---").join(" | ")} |`,
          ...corps.map(ligne),
        ].join("\n"),
      );
      continue;
    }

    if (el.tagName === "UL" || el.tagName === "OL") {
      const ordonnee = el.tagName === "OL";
      const items = Array.from(el.children).map(
        (li, i) => `${ordonnee ? `${i + 1}.` : "-"} ${cellule(li)}`,
      );
      if (items.length) blocs.push(items.join("\n"));
      continue;
    }

    const texte = marquesVersMarkdown(el).trim();
    if (texte) blocs.push(texte);
  }

  // Les blocs se séparent d'une ligne vide : c'est ce qui fait qu'un tableau
  // reste un tableau quand on le relit.
  return blocs.join("\n\n");
}
