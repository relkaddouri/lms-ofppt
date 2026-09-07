import { texteNu } from "@/lib/markdown";

/**
 * Découpe un cours en markdown en diapositives 16:9.
 *
 * Le modèle est celui du support de référence fourni par le porteur de projet
 * — 82 diapositives produites avec les jetons de ce design system, mêmes
 * couleurs et mêmes trois polices. Il n'y avait donc rien à inventer, seulement
 * à retrouver sa structure :
 *
 * - une couverture, tirée du titre de niveau 1 et des métadonnées qui suivent ;
 * - un sommaire, construit sur les titres de niveau 2 ;
 * - un intercalaire par section, qui annonce ce qui vient ;
 * - des diapositives de contenu, paginées, la suite portant « (suite) ».
 *
 * La pagination est le cœur : une diapositive projetée ne défile pas. Chaque
 * bloc porte donc un coût, et on ferme la diapositive avant de déborder plutôt
 * que de réduire le texte jusqu'à l'illisible.
 */

/**
 * Un encadré de diapositive.
 *
 * `accent` distingue ce qui structure de ce qui illustre : dans le support de
 * référence, les critères d'évaluation sortent en encre et la consigne de
 * déroulement en sarcelle, tandis que les notions parallèles restent neutres.
 * Ce n'est pas de la décoration — c'est ce qui dit au stagiaire où regarder.
 */
export type Carte = {
  intitule: string;
  titre: string | null;
  lignes: { texte: string; puce: boolean }[];
  accent: "neutre" | "encre" | "sarcelle";
};

export type BlocDiapo =
  | { type: "texte"; texte: string }
  | { type: "liste"; items: string[]; ordonnee: boolean }
  | { type: "cartes"; cartes: Carte[] }
  | { type: "tableau"; entetes: string[]; lignes: string[][] }
  | { type: "sousTitre"; texte: string };

export type Diapo =
  | {
      type: "couverture";
      surtitre: string;
      titre: string;
      sousTitre: string | null;
      meta: { cle: string; valeur: string }[];
    }
  | { type: "sommaire"; surtitre: string; entrees: string[] }
  | { type: "intercalaire"; surtitre: string; titre: string; sousTitre: string | null }
  | {
      type: "contenu";
      surtitre: string;
      titre: string;
      suite: boolean;
      blocs: BlocDiapo[];
    };

// ── Analyse en blocs ──────────────────────────────────────────────────────

export type Noeud =
  | { k: "h"; niveau: number; texte: string }
  | { k: "p"; texte: string; brut: string }
  | { k: "li"; texte: string; brut: string; ordonnee: boolean }
  | { k: "quote"; lignes: string[] }
  | { k: "table"; entetes: string[]; lignes: string[][] }
  | { k: "hr" };

/**
 * Exportée pour que le document A4 et le diaporama partent du même découpage.
 * Deux analyses auraient divergé sur le premier cas tordu — un encadré qui
 * contient un tableau, une liste qui suit un titre sans ligne vide.
 */
export function analyser(markdown: string): Noeud[] {
  const lignes = markdown.replace(/\r\n/g, "\n").split("\n");
  const noeuds: Noeud[] = [];
  let i = 0;

  while (i < lignes.length) {
    const brut = lignes[i]!;
    const l = brut.trim();

    if (!l) {
      i++;
      continue;
    }

    const h = l.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      noeuds.push({ k: "h", niveau: h[1]!.length, texte: h[2]!.trim() });
      i++;
      continue;
    }

    if (/^(?:---|\*\*\*|___)$/.test(l)) {
      noeuds.push({ k: "hr" });
      i++;
      continue;
    }

    // Une citation se lit d'un bloc : ses lignes forment un encadré.
    if (l.startsWith(">")) {
      const bloc: string[] = [];
      while (i < lignes.length && lignes[i]!.trim().startsWith(">")) {
        bloc.push(lignes[i]!.trim().replace(/^>\s?/, ""));
        i++;
      }
      noeuds.push({ k: "quote", lignes: bloc });
      continue;
    }

    // Un tableau : une ligne d'en-têtes, une ligne de séparation, des lignes.
    if (l.startsWith("|") && (lignes[i + 1] ?? "").trim().match(/^\|[\s:|-]+\|$/)) {
      const cellules = (s: string) =>
        s.trim().replace(/^\||\|$/g, "").split("|").map((c) => texteNu(c.trim()));
      const entetes = cellules(l);
      i += 2;
      const corps: string[][] = [];
      while (i < lignes.length && lignes[i]!.trim().startsWith("|")) {
        corps.push(cellules(lignes[i]!));
        i++;
      }
      noeuds.push({ k: "table", entetes, lignes: corps });
      continue;
    }

    const puce = l.match(/^[-*+]\s+(.*)$/);
    const num = l.match(/^\d+[.)]\s+(.*)$/);
    if (puce || num) {
      const contenu = puce ? puce[1]! : num![1]!;
      noeuds.push({
        k: "li",
        texte: texteNu(contenu),
        brut: contenu,
        ordonnee: Boolean(num),
      });
      i++;
      continue;
    }

    noeuds.push({ k: "p", texte: texteNu(l), brut: l });
    i++;
  }

  return noeuds;
}

/**
 * Une citation devient une carte : son intitulé, son titre, ses lignes.
 *
 * L'intitulé est la première ligne quand elle est en capitales — c'est ainsi
 * qu'un support pose « OBJECTIF 1 » ou « CONSIGNES ». Le titre est la ligne
 * suivante si elle est en gras. Le reste fait le corps.
 */
function enCarte(lignes: string[]): Carte {
  const utiles = lignes.filter((l) => l.trim());
  const premiere = texteNu(utiles[0] ?? "");
  const enCapitales =
    premiere.length > 1 &&
    premiere.length <= 90 &&
    /\p{Lu}/u.test(premiere) &&
    premiere === premiere.toLocaleUpperCase("fr");

  const reste = utiles.slice(enCapitales ? 1 : 0);
  const gras = reste[0]?.trim().match(/^\*\*(.+?)\*\*$/);

  return {
    intitule: enCapitales ? premiere : "",
    titre: gras ? gras[1]!.trim() : null,
    // La puce est conservée : une liste projetée se lit par ses puces, pas en
    // paragraphes collés les uns aux autres.
    lignes: reste
      .slice(gras ? 1 : 0)
      .map((l) => ({
        texte: texteNu(l),
        puce: /^\s*[-*+]\s+/.test(l),
      }))
      .filter((l) => l.texte),
    accent: "neutre",
  };
}

/**
 * Donne son accent à chaque carte d'un groupe.
 *
 * Les cartes brèves et parallèles restent neutres : les colorer toutes ferait
 * un vitrail. Celles qui portent un vrai développement — un barème, une
 * consigne de déroulement — prennent l'accent, encre puis sarcelle, parce que
 * ce sont elles qu'on cherche du regard.
 */
function accentuer(cartes: Carte[]): Carte[] {
  const accents = ["encre", "sarcelle"] as const;
  let rang = 0;
  return cartes.map((c) => {
    const longueur = c.lignes.reduce((t, l) => t + l.texte.length, 0);
    if (longueur < 200) return c;
    const accent = accents[rang % accents.length]!;
    rang++;
    return { ...c, accent };
  });
}

// ── Coût d'un bloc, en lignes de projection ───────────────────────────────
//
// Une diapositive tient environ seize lignes sous son titre. Le coût compte
// donc en lignes, pas en caractères : un tableau de huit lignes coûte dix, une
// carte en coûte quatre quelle que soit sa prose.

// La zone de corps va de 23,33 % à 90,5 % de la hauteur, soit 483 px sur 720.
// Une ligne de 14 pt interlignée à 1,45 en occupe 27 : la diapositive tient
// donc dix-sept lignes, et non quinze comme le supposait la première version
// dont les polices étaient un quart trop grandes.
const BUDGET = 17;

/**
 * Une carte coûte ce que sa prose occupe, pas un forfait.
 *
 * Compter quatre lignes par carte quelle qu'elle soit faisait tenir sur une
 * seule diapositive quatre objectifs d'une ligne et deux encadrés de dix : le
 * bas débordait sous le pied de page. Une carte demi-largeur tient environ
 * cinquante-cinq caractères par ligne.
 */
function coutCarte(c: Carte): number {
  // Ligne par ligne, et non sur le texte joint : chaque ligne fait son propre
  // paragraphe dans la carte. Une carte de huit lignes brèves était comptée
  // pour deux et en occupait huit — c'est ce qui faisait déborder les blocs de
  // données du cas fil rouge.
  const prose = c.lignes.reduce(
    (t, l) => t + Math.max(1, Math.ceil(l.texte.length / 55)),
    0,
  );
  const contenu =
    (c.intitule ? 1 : 0) + (c.titre ? 1.5 : 0) + prose + 1;
  // Plancher : une carte occupe au minimum les 22,82 % de hauteur du deck,
  // soit 164 px sur 720, soit près de six lignes de la zone de corps. Sans ce
  // plancher, une rangée de cartes brèves était comptée pour trois lignes
  // alors qu'elle en occupe six, et la diapositive débordait.
  return Math.max(5.8, contenu);
}

function cout(bloc: BlocDiapo): number {
  switch (bloc.type) {
    case "texte":
      return Math.max(1, Math.ceil(bloc.texte.length / 95));
    case "sousTitre":
      return 2;
    case "liste":
      return bloc.items.reduce(
        (t, i) => t + Math.max(1, Math.ceil(i.length / 95)),
        0,
      );
    case "cartes": {
      // Les cartes vont deux par rangée : une rangée coûte la plus haute des
      // deux, pas leur somme.
      let total = 0;
      for (let i = 0; i < bloc.cartes.length; i += 2) {
        total += Math.max(
          ...bloc.cartes.slice(i, i + 2).map(coutCarte),
        );
      }
      return total;
    }
    case "tableau":
      return bloc.lignes.length + 2;
  }
}

export type ContexteDiapos = {
  /** Le surtitre de la couverture — module, élément, nature du document. */
  surtitre: string;
  /** Ce que le pied de page répète sur chaque diapositive. */
  pied: string;
};

export type EnTeteDocument = {
  titre: string;
  sousTitre: string | null;
  /** La ligne en italique sous le titre, quand il y en a une. */
  legende: string | null;
  meta: { cle: string; valeur: string }[];
  /** Nombre de nœuds consommés en tête : le corps commence après. */
  consommes: number;
};

/**
 * L'en-tête d'un cours rédigé : titre, sous-titre, légende, métadonnées.
 *
 * Partagée par la couverture du diaporama et celle du document, pour qu'un
 * même cours ne s'annonce pas de deux façons différentes selon le support.
 *
 * Les métadonnées se lisent sur la ligne brute et non sur le texte dépouillé :
 * c'est le gras qui marque la clé. Sur « **Module** M202 — Analyser… », lire
 * le texte nu ferait couper au petit bonheur, au milieu du titre du module.
 */
export function enTeteDocument(noeuds: Noeud[]): EnTeteDocument | null {
  const iTitre = noeuds.findIndex((n) => n.k === "h" && n.niveau === 1);
  if (iTitre === -1) return null;
  const titre = noeuds[iTitre] as { texte: string };

  let i = iTitre + 1;
  let sousTitre: string | null = null;
  let legende: string | null = null;
  const meta: { cle: string; valeur: string }[] = [];

  while (i < noeuds.length) {
    const n = noeuds[i]!;
    if (n.k === "h" && n.niveau === 2 && !sousTitre && meta.length === 0) {
      sousTitre = n.texte;
      i++;
      continue;
    }
    if (n.k === "p") {
      const cle = n.brut.match(/^\*\*(.{2,40}?)\*\*\s+(.{4,})$/);
      if (cle) {
        meta.push({ cle: cle[1]!.trim(), valeur: texteNu(cle[2]!).trim() });
        i++;
        continue;
      }
      if (!legende && /^\*[^*]+\*$/.test(n.brut.trim())) {
        legende = n.texte;
        i++;
        continue;
      }
    }
    // Le filet qui suit l'en-tête en fait partie : il le clôt.
    if (n.k === "hr" && meta.length > 0) {
      i++;
      break;
    }
    break;
  }

  return {
    titre: titre.texte,
    sousTitre,
    legende,
    meta,
    consommes: meta.length > 0 || sousTitre ? i : iTitre + 1,
  };
}

export function decouperEnDiapositives(
  markdown: string,
  contexte: ContexteDiapos,
): Diapo[] {
  const noeuds = analyser(markdown);
  const diapos: Diapo[] = [];

  // ── Couverture ─────────────────────────────────────────────────────────
  const titre1 = noeuds.find((n) => n.k === "h" && n.niveau === 1);
  const iTitre = titre1 ? noeuds.indexOf(titre1) : -1;
  const apresTitre = noeuds.slice(iTitre + 1);
  const sousTitre = apresTitre.find((n) => n.k === "h" && n.niveau === 2);
  // La ligne brute, et non le texte dépouillé : c'est le gras qui marque la
  // clé. Sur « **Module** M202 — Analyser… », lire le texte nu ferait couper
  // au petit bonheur, quelque part au milieu du titre du module.
  const meta: { cle: string; valeur: string }[] = [];
  for (const n of apresTitre.slice(0, 12)) {
    if (n.k !== "p") continue;
    const m = n.brut.match(/^\*\*(.{2,40}?)\*\*\s+(.{4,})$/);
    if (m) meta.push({ cle: m[1]!.trim(), valeur: texteNu(m[2]!).trim() });
  }

  diapos.push({
    type: "couverture",
    surtitre: contexte.surtitre.toLocaleUpperCase("fr"),
    titre: titre1 && titre1.k === "h" ? titre1.texte : contexte.pied,
    sousTitre: sousTitre && sousTitre.k === "h" ? sousTitre.texte : null,
    meta: meta.slice(0, 4),
  });

  // ── Sections ───────────────────────────────────────────────────────────
  const sections: { titre: string; contenu: Noeud[] }[] = [];
  let courante: { titre: string; contenu: Noeud[] } | null = null;
  let vuLeTitre1 = false;

  for (const n of noeuds) {
    if (n.k === "h" && n.niveau === 1) {
      vuLeTitre1 = true;
      continue;
    }
    if (n.k === "h" && n.niveau === 2) {
      // Le sous-titre de couverture n'ouvre pas une section.
      if (vuLeTitre1 && sections.length === 0 && !courante && n === sousTitre) {
        continue;
      }
      courante = { titre: n.texte, contenu: [] };
      sections.push(courante);
      continue;
    }
    if (courante) courante.contenu.push(n);
  }

  // Le sommaire dit ce que la séance va couvrir — sauf si l'auteur a écrit le
  // sien, ce que font les supports soignés. En ajouter un second serait
  // corriger un document qui n'a pas de défaut.
  const aSonSommaire = sections.some((s) =>
    /^(?:\d+[.)]\s*)?sommaire\b/i.test(s.titre.trim()),
  );
  if (sections.length > 1 && !aSonSommaire) {
    diapos.push({
      type: "sommaire",
      surtitre: (titre1 && titre1.k === "h" ? titre1.texte : contexte.pied)
        .toLocaleUpperCase("fr"),
      entrees: sections.map((s) => s.titre),
    });
  }

  for (const section of sections) {
    const surtitre = section.titre.toLocaleUpperCase("fr");

    // L'intercalaire reprend la ligne d'italique qui suit souvent le titre.
    const premier = section.contenu[0];
    const legende =
      premier && premier.k === "p" && premier.texte.length < 80
        ? premier.texte
        : null;

    diapos.push({
      type: "intercalaire",
      surtitre: contexte.pied.toLocaleUpperCase("fr"),
      titre: section.titre,
      sousTitre: legende,
    });

    // ── Les blocs de la section, groupés puis paginés ────────────────────
    const blocs: BlocDiapo[] = [];
    let listeEnCours: { items: string[]; ordonnee: boolean } | null = null;
    let cartesEnCours: Carte[] | null = null;

    const fermerListe = () => {
      if (listeEnCours) {
        blocs.push({ type: "liste", ...listeEnCours });
        listeEnCours = null;
      }
    };
    const fermerCartes = () => {
      if (cartesEnCours) {
        blocs.push({ type: "cartes", cartes: accentuer(cartesEnCours) });
        cartesEnCours = null;
      }
    };

    for (const n of section.contenu.slice(legende ? 1 : 0)) {
      if (n.k === "li") {
        fermerCartes();
        if (!listeEnCours || listeEnCours.ordonnee !== n.ordonnee) {
          fermerListe();
          listeEnCours = { items: [], ordonnee: n.ordonnee };
        }
        listeEnCours.items.push(n.texte);
        continue;
      }
      fermerListe();

      if (n.k === "quote") {
        (cartesEnCours ??= []).push(enCarte(n.lignes));
        continue;
      }
      fermerCartes();

      if (n.k === "h") {
        blocs.push({ type: "sousTitre", texte: n.texte });
      } else if (n.k === "p") {
        blocs.push({ type: "texte", texte: n.texte });
      } else if (n.k === "table") {
        blocs.push({ type: "tableau", entetes: n.entetes, lignes: n.lignes });
      }
    }
    fermerListe();
    fermerCartes();

    // Pagination : on ferme avant de déborder.
    let paquet: BlocDiapo[] = [];
    let charge = 0;
    let premiere = true;

    const poser = () => {
      if (paquet.length === 0) return;
      diapos.push({
        type: "contenu",
        surtitre,
        titre: premiere ? section.titre : `${section.titre} (suite)`,
        suite: !premiere,
        blocs: paquet,
      });
      premiere = false;
      paquet = [];
      charge = 0;
    };

    for (const b of blocs) {
      // Un groupe de cartes plus long qu'une diapositive se coupe entre deux
      // rangées : c'est ce que fait le support de référence, avec « (suite) »
      // au titre. Un tableau, lui, part entier — le couper lui ferait perdre
      // ses en-têtes.
      if (b.type === "cartes" && cout(b) > BUDGET) {
        let rangee: Carte[] = [];
        for (let i = 0; i < b.cartes.length; i += 2) {
          const paire = b.cartes.slice(i, i + 2);
          const c = Math.max(...paire.map(coutCarte));
          if (charge > 0 && charge + c > BUDGET) {
            if (rangee.length) paquet.push({ type: "cartes", cartes: rangee });
            rangee = [];
            poser();
          }
          rangee.push(...paire);
          charge += c;
        }
        if (rangee.length) paquet.push({ type: "cartes", cartes: rangee });
        continue;
      }

      const c = cout(b);
      if (charge > 0 && charge + c > BUDGET) poser();
      paquet.push(b);
      charge += c;
    }
    poser();
  }

  return diapos;
}
