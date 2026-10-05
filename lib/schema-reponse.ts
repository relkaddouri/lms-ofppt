/**
 * Les schémas que le stagiaire dessine dans sa copie, et ce que l'IA en lit.
 *
 * Un user flow, un wireframe, un parcours : des choses qui se dessinent et ne
 * s'écrivent pas. Mais la correction automatique n'envoie au modèle qu'une
 * chaîne de texte, et le modèle configuré n'a pas de vision. Un dessin aurait
 * donc échappé entièrement à la correction.
 *
 * D'où la forme retenue : le stagiaire manipule des blocs nommés et des
 * flèches, pas seulement des traits. Ce qu'il construit a donc un sens
 * lisible — « Accueil mène à Recherche », « si résultat trouvé, Réservation » —
 * et c'est précisément ce qu'on évalue dans un user flow. L'image est pour le
 * formateur ; la description est pour l'IA.
 *
 * Le tracé libre reste possible pour annoter, et lui n'est pas lisible : on
 * le dit au correcteur plutôt que de laisser croire qu'il a tout vu.
 *
 * Le schéma vit dans la copie comme un bloc de code Markdown. Il traverse
 * ainsi toute la chaîne existante — enregistrement, PDF, affichage — sans
 * qu'aucune n'ait à le comprendre.
 */

export type TypeForme = "bloc" | "decision" | "note";

export type Forme = {
  id: string;
  type: TypeForme;
  texte: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type Fleche = {
  id: string;
  de: string;
  vers: string;
  /** L'étiquette portée par la flèche : « oui », « non », « valider ». */
  texte: string;
};

/** Un tracé à main levée : des coordonnées, et rien qui se décrive. */
export type Trait = { id: string; points: number[] };

export type Schema = {
  formes: Forme[];
  fleches: Fleche[];
  traits: Trait[];
};

export const SCHEMA_VIDE: Schema = { formes: [], fleches: [], traits: [] };

/** La clôture du bloc de code qui porte un schéma dans la copie. */
const BALISE = "schema";

export const LARGEUR_CANEVAS = 1000;
export const HAUTEUR_CANEVAS = 620;

const LIBELLES: Record<TypeForme, string> = {
  bloc: "Écran",
  decision: "Décision",
  note: "Note",
};

/** Le schéma tel qu'il s'écrit dans la copie. */
export function versBloc(schema: Schema): string {
  return ["```" + BALISE, JSON.stringify(schema), "```"].join("\n");
}

/** Repère les schémas d'une copie, dans l'ordre où ils apparaissent. */
const MOTIF = new RegExp("```" + BALISE + "\\s*\\n([\\s\\S]*?)\\n?```", "g");

export function lireSchemas(markdown: string): Schema[] {
  const trouves: Schema[] = [];
  for (const m of markdown.matchAll(MOTIF)) {
    const lu = analyser(m[1] ?? "");
    if (lu) trouves.push(lu);
  }
  return trouves;
}

/**
 * Analyse un schéma, en refusant tout ce qui n'a pas la forme attendue.
 *
 * Une copie vient du navigateur d'un stagiaire : ce qu'elle contient n'est pas
 * une donnée de confiance, et un schéma mal formé ne doit pas faire tomber
 * l'écran de correction.
 */
export function analyser(brut: string): Schema | null {
  try {
    const lu = JSON.parse(brut) as Partial<Schema>;
    const formes = (Array.isArray(lu.formes) ? lu.formes : [])
      .filter((f): f is Forme => Boolean(f) && typeof f.id === "string")
      .map((f) => ({
        id: f.id,
        type: (["bloc", "decision", "note"] as const).includes(f.type)
          ? f.type
          : ("bloc" as TypeForme),
        texte: String(f.texte ?? ""),
        x: Number(f.x) || 0,
        y: Number(f.y) || 0,
        w: Number(f.w) || 160,
        h: Number(f.h) || 64,
      }));
    const connus = new Set(formes.map((f) => f.id));
    return {
      formes,
      // Une flèche dont une extrémité a été supprimée ne mène nulle part.
      fleches: (Array.isArray(lu.fleches) ? lu.fleches : [])
        .filter(
          (f): f is Fleche =>
            Boolean(f) && connus.has(f.de) && connus.has(f.vers),
        )
        .map((f) => ({
          id: String(f.id),
          de: f.de,
          vers: f.vers,
          texte: String(f.texte ?? ""),
        })),
      traits: (Array.isArray(lu.traits) ? lu.traits : [])
        .filter((t): t is Trait => Boolean(t) && Array.isArray(t.points))
        .map((t) => ({
          id: String(t.id),
          points: t.points.map(Number).filter((n) => Number.isFinite(n)),
        })),
    };
  } catch {
    return null;
  }
}

/**
 * Ce que le correcteur lit à la place du dessin.
 *
 * On nomme les formes et on décrit les liens, dans l'ordre du parcours quand
 * il y en a un. C'est la substance d'un user flow : quels écrans, dans quel
 * ordre, et à quelle condition on bifurque.
 */
export function decrire(schema: Schema): string {
  const { formes, fleches, traits } = schema;
  if (formes.length === 0 && traits.length === 0) return "(schéma vide)";

  const nom = (id: string) => {
    const f = formes.find((x) => x.id === id);
    if (!f) return "?";
    const t = f.texte.trim();
    return t ? `« ${t} »` : `${LIBELLES[f.type]} sans titre`;
  };

  const lignes: string[] = [];

  if (formes.length > 0) {
    lignes.push(`${formes.length} élément(s) :`);
    for (const f of formes) {
      const t = f.texte.trim();
      lignes.push(`- ${LIBELLES[f.type]} ${t ? `« ${t} »` : "sans titre"}`);
    }
  }

  if (fleches.length > 0) {
    lignes.push("", `${fleches.length} liaison(s) :`);
    for (const f of fleches) {
      const etiquette = f.texte.trim() ? ` [${f.texte.trim()}]` : "";
      lignes.push(`- ${nom(f.de)} → ${nom(f.vers)}${etiquette}`);
    }
  }

  // Les formes qu'aucune flèche ne touche : dans un parcours, c'est
  // généralement un oubli, et c'est au correcteur de le voir.
  const reliees = new Set(fleches.flatMap((f) => [f.de, f.vers]));
  const isolees = formes.filter((f) => !reliees.has(f.id));
  if (formes.length > 1 && isolees.length > 0) {
    lignes.push(
      "",
      `Non relié(s) au reste : ${isolees.map((f) => nom(f.id)).join(", ")}.`,
    );
  }

  if (traits.length > 0) {
    lignes.push(
      "",
      `${traits.length} tracé(s) à main levée, dont le contenu n'est pas lisible automatiquement : n'en tenez pas compte et ne les comptez pas comme manquants.`,
    );
  }

  return lignes.join("\n");
}

/**
 * Remplace les schémas d'une copie par leur description, pour la correction.
 *
 * Le reste du texte ne bouge pas : le correcteur reçoit la copie telle que le
 * stagiaire l'a rendue, le dessin en moins et sa lecture en plus.
 */
export function pourCorrection(markdown: string): string {
  return markdown.replace(MOTIF, (_, brut: string) => {
    const lu = analyser(brut);
    return lu
      ? `[Schéma dessiné par le stagiaire]\n${decrire(lu)}\n[fin du schéma]`
      : "[Schéma illisible]";
  });
}
