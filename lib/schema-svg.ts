/**
 * La géométrie d'un schéma, et son rendu figé.
 *
 * Deux endroits montrent le même dessin : l'aperçu posé dans la copie, qui
 * n'est qu'une image, et le canevas où l'on dessine, qui est interactif. Les
 * formes doivent y tomber au même endroit, sans quoi le stagiaire verrait son
 * schéma bouger en fermant l'éditeur. D'où ces calculs ici, communs aux deux.
 */

import {
  HAUTEUR_CANEVAS,
  LARGEUR_CANEVAS,
  type Fleche,
  type Forme,
  type Schema,
} from "@/lib/schema-reponse";

export const COULEURS = {
  bloc: { fond: "#eef2f7", trait: "#2e3b4e", texte: "#1f2937" },
  decision: { fond: "#fdf3e3", trait: "#b4802a", texte: "#6b4e16" },
  note: { fond: "#eaf6ef", trait: "#2f7d52", texte: "#1f5137" },
} as const;

export const centre = (f: Forme) => ({ x: f.x + f.w / 2, y: f.y + f.h / 2 });

/**
 * Le point où une flèche touche le bord d'une forme.
 *
 * Partir du centre ferait passer la pointe sous la boîte : on avance depuis le
 * centre en direction de la cible jusqu'à rencontrer le bord du rectangle.
 */
export function bord(f: Forme, vers: { x: number; y: number }) {
  const c = centre(f);
  const dx = vers.x - c.x;
  const dy = vers.y - c.y;
  if (dx === 0 && dy === 0) return c;
  const demiL = f.w / 2;
  const demiH = f.h / 2;
  // L'échelle à appliquer au vecteur pour atteindre le bord le plus proche.
  const echelle = Math.min(
    dx === 0 ? Infinity : demiL / Math.abs(dx),
    dy === 0 ? Infinity : demiH / Math.abs(dy),
  );
  return { x: c.x + dx * echelle, y: c.y + dy * echelle };
}

/** Les deux extrémités d'une flèche, posées sur les bords des formes. */
export function extremites(schema: Schema, fleche: Fleche) {
  const de = schema.formes.find((f) => f.id === fleche.de);
  const vers = schema.formes.find((f) => f.id === fleche.vers);
  if (!de || !vers) return null;
  return { depart: bord(de, centre(vers)), arrivee: bord(vers, centre(de)) };
}

/** Le chemin d'un tracé à main levée. */
export function cheminTrait(points: number[]): string {
  if (points.length < 4) return "";
  const morceaux = [`M ${points[0]} ${points[1]}`];
  for (let i = 2; i < points.length - 1; i += 2) {
    morceaux.push(`L ${points[i]} ${points[i + 1]}`);
  }
  return morceaux.join(" ");
}

const echapper = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Découpe un libellé en lignes qui tiennent dans sa forme.
 *
 * Sans cela, un nom d'écran un peu long sortait de sa boîte et se superposait
 * à la suivante. On coupe aux espaces, et on tronque au-delà de trois lignes :
 * une étiquette de user flow est un nom, pas un paragraphe.
 */
export function lignesDuTexte(texte: string, largeur: number): string[] {
  const mots = texte.trim().split(/\s+/).filter(Boolean);
  if (mots.length === 0) return [];
  // ~7,2 px par caractère à 13 px : une approximation suffisante pour couper.
  const parLigne = Math.max(6, Math.floor((largeur - 16) / 7.2));
  const lignes: string[] = [];
  let courante = "";
  for (const mot of mots) {
    const essai = courante ? `${courante} ${mot}` : mot;
    if (essai.length <= parLigne) courante = essai;
    else {
      if (courante) lignes.push(courante);
      courante = mot;
    }
  }
  if (courante) lignes.push(courante);
  if (lignes.length > 3) {
    return [...lignes.slice(0, 2), `${lignes[2]!.slice(0, parLigne - 1)}…`];
  }
  return lignes;
}

/**
 * Le schéma en SVG figé, pour l'aperçu posé dans la copie.
 *
 * Rendu en chaîne et non en JSX : il est inséré dans le document que le
 * stagiaire édite, lequel est du HTML et non un arbre React.
 */
export function svgDuSchema(schema: Schema): string {
  const formes = schema.formes
    .map((f) => {
      const c = COULEURS[f.type];
      const lignes = lignesDuTexte(f.texte, f.w);
      const hauteurTexte = lignes.length * 16;
      const depart = f.y + f.h / 2 - hauteurTexte / 2 + 12;
      const texte = lignes
        .map(
          (l, i) =>
            `<text x="${f.x + f.w / 2}" y="${depart + i * 16}" text-anchor="middle" font-size="13" fill="${c.texte}" font-family="system-ui, sans-serif">${echapper(l)}</text>`,
        )
        .join("");
      const forme =
        f.type === "decision"
          ? `<polygon points="${f.x + f.w / 2},${f.y} ${f.x + f.w},${f.y + f.h / 2} ${f.x + f.w / 2},${f.y + f.h} ${f.x},${f.y + f.h / 2}" fill="${c.fond}" stroke="${c.trait}" stroke-width="1.5" />`
          : `<rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" rx="8" fill="${c.fond}" stroke="${c.trait}" stroke-width="1.5" ${f.type === "note" ? 'stroke-dasharray="5 4"' : ""} />`;
      return forme + texte;
    })
    .join("");

  const fleches = schema.fleches
    .map((fl) => {
      const e = extremites(schema, fl);
      if (!e) return "";
      const milieuX = (e.depart.x + e.arrivee.x) / 2;
      const milieuY = (e.depart.y + e.arrivee.y) / 2;
      const etiquette = fl.texte.trim()
        ? `<rect x="${milieuX - fl.texte.trim().length * 3.4 - 4}" y="${milieuY - 9}" width="${fl.texte.trim().length * 6.8 + 8}" height="16" rx="3" fill="#ffffff" opacity="0.92" /><text x="${milieuX}" y="${milieuY + 3}" text-anchor="middle" font-size="11" fill="#475569" font-family="system-ui, sans-serif">${echapper(fl.texte.trim())}</text>`
        : "";
      return `<line x1="${e.depart.x}" y1="${e.depart.y}" x2="${e.arrivee.x}" y2="${e.arrivee.y}" stroke="#64748b" stroke-width="1.6" marker-end="url(#pointe)" />${etiquette}`;
    })
    .join("");

  const traits = schema.traits
    .map(
      (t) =>
        `<path d="${cheminTrait(t.points)}" fill="none" stroke="#2e3b4e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />`,
    )
    .join("");

  return [
    `<svg viewBox="0 0 ${LARGEUR_CANEVAS} ${HAUTEUR_CANEVAS}" xmlns="http://www.w3.org/2000/svg" width="100%" role="img" aria-label="Schéma dessiné">`,
    `<defs><marker id="pointe" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" /></marker></defs>`,
    fleches,
    formes,
    traits,
    "</svg>",
  ].join("");
}
