/**
 * L'aller-retour de la copie du stagiaire ne doit rien perdre.
 *
 * Il compose dans une zone visuelle, on enregistre du Markdown, et on le lui
 * rend quand il reprend sa copie. Une sérialisation qui dérive ne lève aucune
 * erreur : elle rend un tableau en bouillie, et personne ne s'en aperçoit
 * avant la correction. D'où ce contrôle, au même titre que les autres.
 */
import { versHtml, versMarkdown } from "../lib/markdown-visuel.ts";

// Un DOM minimal : juste ce que `versMarkdown` lit.
(globalThis as Record<string, unknown>).Node = { TEXT_NODE: 3, ELEMENT_NODE: 1 };

type Faux = {
  nodeType: number;
  tagName?: string;
  textContent?: string;
  dataset?: Record<string, string>;
  childNodes: Faux[];
  children: Faux[];
  querySelectorAll?: (s: string) => Faux[];
};

/** Décode ce que `versHtml` a échappé dans un attribut. */
const desechapper = (t: string) =>
  t.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

function depuisHtml(html: string): Faux {
  // Analyseur minuscule, suffisant pour le HTML que `versHtml` produit :
  // des balises simples, sans attributs ni auto-fermeture hormis <br>.
  const pile: Faux[] = [];
  const racine: Faux = { nodeType: 1, tagName: "DIV", childNodes: [], children: [] };
  pile.push(racine);
  const jetons = html.split(/(<[^>]+>)/).filter((t) => t !== "");
  for (const j of jetons) {
    const haut = pile[pile.length - 1]!;
    if (j.startsWith("</")) { pile.pop(); continue; }
    if (j.startsWith("<")) {
      const interieur = j.slice(1, -1);
      const nom = (interieur.split(/\s/)[0] ?? "").toUpperCase();
      // Seul `data-schema` compte ici : c'est lui qui porte le dessin, et sa
      // perte serait invisible autrement — le texte du SVG ferait illusion.
      const attr = /data-schema="([^"]*)"/.exec(interieur);
      const el: Faux = {
        nodeType: 1,
        tagName: nom,
        childNodes: [],
        children: [],
        dataset: attr ? { schema: desechapper(attr[1]!) } : {},
      };
      haut.childNodes.push(el); haut.children.push(el);
      if (nom !== "BR") pile.push(el);
      continue;
    }
    const txt = j.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
    haut.childNodes.push({ nodeType: 3, textContent: txt, childNodes: [], children: [] });
  }
  const tousLes = (n: Faux, tag: string, acc: Faux[] = []): Faux[] => {
    for (const e of n.children) { if (e.tagName === tag) acc.push(e); tousLes(e, tag, acc); }
    return acc;
  };
  const brancher = (n: Faux) => { n.querySelectorAll = (s) => tousLes(n, s.toUpperCase()); n.children.forEach(brancher); };
  brancher(racine);
  return racine;
}

const cas = [
  "Un **mot gras** et un *mot italique*.",
  "- un\n- deux",
  "1. premier\n2. deuxième",
  "| Étape | Action |\n| --- | --- |\n| 1. | ouvrir |\n| 2. | payer |",
  "| Pense et ressent | Voit |\n| --- | --- |\n| Elle doute du prix |  |",
  // Un schéma dessiné : c'est le cas où une dérive coûterait le plus cher,
  // puisqu'un JSON abîmé ne se répare pas à la main.
  '```schema\n{"formes":[{"id":"a","type":"bloc","texte":"Accueil","x":40,"y":30,"w":170,"h":66}],"fleches":[],"traits":[]}\n```',
];

let echecs = 0;
for (const md of cas) {
  const retour = versMarkdown(depuisHtml(versHtml(md)) as unknown as HTMLElement);
  const ok = retour === md;
  if (!ok) echecs += 1;
  console.log(`${ok ? "✓" : "✗"} ${JSON.stringify(md.slice(0, 44))}`);
  if (!ok) console.log(`    rendu : ${JSON.stringify(retour)}`);
}
// ── Le dossier remis à l'administration ────────────────────────────────────
//
// La copie part aussi en PDF. Le moteur d'impression a longtemps ignoré les
// tableaux, et les stagiaires en rendent désormais : le dossier imprimait des
// barres verticales à la place du travail. On vérifie donc qu'il n'en reste
// aucune, ni d'astérisque, ni de JSON de schéma.
{
  const { dessinerMarkdown } = await import("../lib/pdf-markdown.ts");
  const ecrits: string[] = [];
  const faux: Record<string, unknown> = {};
  for (const m of ["setFillColor","setDrawColor","setLineWidth","setTextColor","setFont","setFontSize","rect","line"]) faux[m] = () => faux;
  faux.text = (t: unknown) => { ecrits.push(String(t)); return faux; };
  faux.getFontList = () => ({});
  faux.getTextWidth = (t: string) => String(t).length * 1.9;
  faux.splitTextToSize = (t: string, l: number) => {
    const parLigne = Math.max(8, Math.floor(l / 1.9));
    const mots = String(t).split(/\s+/).filter(Boolean);
    if (!mots.length) return [""];
    const out: string[] = []; let c = "";
    for (const mo of mots) { const e = c ? `${c} ${mo}` : mo; if (e.length <= parLigne) c = e; else { out.push(c); c = mo; } }
    if (c) out.push(c); return out;
  };

  const copie = [
    "| Étape | Action |", "| --- | --- |", "| 1 | Ouvrir |", "",
    "Un mot de **conclusion**.", "",
    "```schema",
    '{"formes":[{"id":"a","type":"bloc","texte":"Accueil","x":0,"y":0,"w":170,"h":66}],"fleches":[],"traits":[]}',
    "```",
  ].join("\n");

  let y = 10;
  dessinerMarkdown(faux as never, copie, {
    x: 20, largeur: 170, y,
    place: (h: number) => { y += h; return y; },
  });

  // Le fond coloré d'un bloc est tracé d'après une mesure prise avant le
  // texte. Si les deux divergent d'un millimètre, le texte déborde sous son
  // fond — ce qui s'est vu sur un dossier déjà remis.
  const { mesurerMarkdown } = await import("../lib/pdf-markdown.ts");
  for (const [nom, md] of [
    ["paragraphe", "Une méthode de sondage répond à la question Combien, à grande échelle, et dit ce que les utilisateurs déclarent plutôt que ce qu'ils font."],
    ["tableau", "| Étape | Action |\n| --- | --- |\n| 1 | Ouvrir |"],
    ["liste", "- un\n- deux"],
    ["schéma", '```schema\n{"formes":[{"id":"a","type":"bloc","texte":"Accueil","x":0,"y":0,"w":170,"h":66}],"fleches":[],"traits":[]}\n```'],
  ] as [string, string][]) {
    const mesure = mesurerMarkdown(faux as never, md, 150);
    let yd = 0;
    dessinerMarkdown(faux as never, md, {
      x: 0, largeur: 150, y: yd,
      place: (h: number) => { yd += h; return yd; },
    });
    if (Math.abs(mesure - yd) > 0.01) {
      console.error(`✗ PDF : ${nom} — mesuré ${mesure.toFixed(2)} mm, tracé ${yd.toFixed(2)} mm. Le fond déborderait.`);
      echecs += 1;
    }
  }

  const fautes: string[] = [];
  if (ecrits.some((t) => t.includes("|"))) fautes.push("barres verticales");
  if (ecrits.some((t) => t.includes("**"))) fautes.push("astérisques");
  if (ecrits.some((t) => t.includes('{"formes"'))) fautes.push("JSON de schéma");
  if (!ecrits.includes("Étape")) fautes.push("en-tête de tableau manquant");

  if (fautes.length) {
    console.error(`✗ PDF : le dossier imprimerait encore ${fautes.join(", ")}.`);
    echecs += 1;
  } else {
    console.log("✓ PDF : tableaux et schémas rendus, aucune syntaxe imprimée.");
  }
}

if (echecs > 0) {
  console.error(`\n✗ ${echecs} cas perdent du contenu à l'aller-retour.`);
  process.exit(1);
}
console.log("✓ Markdown visuel : aller-retour fidèle sur tous les cas.");
