import type jsPDF from "jspdf";

/**
 * Identité visuelle des documents PDF (design_system.md §1 et §3).
 *
 * Un PDF produit par Pédago est un document de l'établissement, pas un export
 * technique : mêmes polices et même palette que les écrans. Avant ce fichier,
 * les dix générateurs partaient tous sur Helvetica et redéclaraient chacun
 * leur gris — cinq définitions de « GRIS », quatre de « TRAIT », aucune tirée
 * du design system.
 *
 * Une seule implémentation, donc, pour que les documents ne divergent pas à la
 * première retouche (`conventions.md`).
 */

// ── Palette, reprise du §1 telle quelle ───────────────────────────────────

type Rvb = [number, number, number];

/** Convertit `#2E3B4E` en triplet, pour n'écrire les couleurs qu'une fois. */
function rvb(hex: string): Rvb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const COULEURS = {
  /** Bleu-ardoise : titres, en-têtes, filets structurants. */
  encre: rvb("#2E3B4E"),
  encreFoncee: rvb("#25303F"),
  /** Texte courant — jamais l'encre, qui est réservée aux titres (§1). */
  corps: rvb("#3F4E62"),
  ardoise: rvb("#6B7A8D"),
  ardoiseClaire: rvb("#8C99A8"),
  muet: rvb("#A9B4C0"),
  /** Sarcelle : information, liens, accents non alarmants. */
  sarcelle: rvb("#2E7D9E"),
  vert: rvb("#3C8C5C"),
  /** Corail : l'alerte, et rien d'autre — au plus un usage par document. */
  corail: rvb("#E2574C"),
  blanc: rvb("#FFFFFF"),
  papier: rvb("#F6F7F9"),
  papierAlt: rvb("#FAFBFC"),
  lavis: rvb("#EFF2F5"),
  bordure: rvb("#E3E7EC"),
  bordureForte: rvb("#C9D2DC"),
  separateur: rvb("#EDF0F3"),
} satisfies Record<string, Rvb>;

// ── Polices ───────────────────────────────────────────────────────────────

/**
 * Les rôles typographiques, nommés par ce qu'ils font et non par leur fonte.
 *
 * Les générateurs appellent `police(doc, "titre")`, jamais
 * `setFont("Sora", "normal")` : le jour où une fonte change, elle change ici.
 */
export type RolePolice = "titre" | "corps" | "corpsGras" | "mono";

type Face = { fichier: string; famille: string; style: "normal" | "bold" };

const FACES: Record<RolePolice, Face> = {
  titre: { fichier: "sora-600", famille: "Sora", style: "normal" },
  corps: { fichier: "source-400", famille: "SourceSans3", style: "normal" },
  corpsGras: { fichier: "source-600", famille: "SourceSans3", style: "bold" },
  mono: { fichier: "mono-400", famille: "PlexMono", style: "normal" },
};

/**
 * Les fontes une fois lues, gardées d'un document à l'autre.
 *
 * 640 Ko de TTF ne se retéléchargent pas à chaque export. Le cache vit le
 * temps de l'onglet ; le navigateur garde les fichiers eux-mêmes au-delà.
 */
let cache: Record<string, string> | null = null;
let enCours: Promise<Record<string, string>> | null = null;

async function lireFaces(): Promise<Record<string, string>> {
  if (cache) return cache;
  if (enCours) return enCours;

  enCours = (async () => {
    const entrees = await Promise.all(
      Object.values(FACES).map(async (f) => {
        const rep = await fetch(`/polices/${f.fichier}.ttf`);
        if (!rep.ok) throw new Error(`Police ${f.fichier} introuvable`);
        const octets = new Uint8Array(await rep.arrayBuffer());
        // btoa n'accepte pas un tableau : on passe par une chaîne binaire,
        // découpée pour ne pas dépasser la taille d'appel de String.
        let binaire = "";
        for (let i = 0; i < octets.length; i += 8192) {
          binaire += String.fromCharCode(...octets.subarray(i, i + 8192));
        }
        return [f.fichier, btoa(binaire)] as const;
      }),
    );
    cache = Object.fromEntries(entrees);
    return cache;
  })();

  return enCours;
}

/**
 * Installe les polices du design system dans un document.
 *
 * À appeler une fois, juste après la création du `jsPDF`. Si la lecture
 * échoue — hors ligne, fichier absent — le document sort en Helvetica plutôt
 * que de ne pas sortir du tout : un export dégradé vaut mieux qu'un bouton
 * qui ne fait rien, et l'appelant est prévenu par la valeur de retour.
 */
export async function installerPolices(doc: jsPDF): Promise<boolean> {
  try {
    const faces = await lireFaces();
    for (const face of Object.values(FACES)) {
      doc.addFileToVFS(`${face.fichier}.ttf`, faces[face.fichier]!);
      doc.addFont(`${face.fichier}.ttf`, face.famille, face.style);
    }
    return true;
  } catch {
    return false;
  }
}

/** Choisit le rôle typographique et la taille, d'un seul geste. */
export function police(doc: jsPDF, role: RolePolice, taille?: number): void {
  const face = FACES[role];
  // `getFontList` dit ce que le document connaît réellement : si l'installation
  // a échoué, on retombe sur Helvetica sans jeter.
  const connues = doc.getFontList();
  if (connues[face.famille]) {
    doc.setFont(face.famille, face.style);
  } else {
    doc.setFont("helvetica", role === "corpsGras" || role === "titre" ? "bold" : "normal");
  }
  if (taille !== undefined) doc.setFontSize(taille);
}

/** Applique une couleur de la palette au texte. */
export function encre(doc: jsPDF, couleur: Rvb): void {
  doc.setTextColor(...couleur);
}
