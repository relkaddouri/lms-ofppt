/**
 * Les vidéos d'un cours.
 *
 * Le formateur écrit ses cours en markdown, et veut y voir le lecteur —
 * pas un lien qui emmène ailleurs : une démonstration se regarde au milieu
 * du texte qui l'explique.
 *
 * ── Pourquoi on ne prend pas la balise telle quelle ──────────────────────
 *
 * Le premier réflexe est de coller le code d'intégration donné par YouTube.
 * On le reconnaît donc — c'est ce qu'on a sous la main quand on clique
 * « Partager › Intégrer » —, mais on n'en garde que l'adresse, et le lecteur
 * est reconstruit ici. Insérer le HTML de la page tel quel reviendrait à
 * ouvrir les cours à n'importe quelle balise, alors qu'ils passent aussi par
 * la génération automatique : une adresse se vérifie, un fragment de HTML
 * non.
 *
 * Deux hébergeurs, et deux seulement. Pas par principe : chacun a sa façon de
 * fabriquer l'adresse du lecteur, et une liste ouverte ne voudrait rien dire —
 * on ne peut pas deviner celle d'un site qu'on ne connaît pas.
 */

export type Video = {
  /** L'adresse du lecteur, prête à poser dans un cadre. */
  src: string;
  /** Ce qu'on annonce sous le lecteur, et ce qui remplace la vidéo à l'impression. */
  titre: string | null;
  /** L'adresse d'origine : c'est elle qu'on imprime, pas celle du lecteur. */
  lien: string;
  source: "youtube" | "drive";
};

/** L'identifiant d'une vidéo YouTube, quelle que soit la forme de l'adresse. */
function idYoutube(url: URL): string | null {
  const hote = url.hostname.replace(/^www\./, "");
  if (hote === "youtu.be") return url.pathname.slice(1).split("/")[0] || null;
  if (!/(^|\.)youtube(-nocookie)?\.com$/.test(hote)) return null;
  if (url.pathname === "/watch") return url.searchParams.get("v");
  const chemin = url.pathname.match(/^\/(?:embed|shorts|v)\/([^/?#]+)/);
  return chemin?.[1] ?? null;
}

/** L'identifiant d'un fichier Google Drive. */
function idDrive(url: URL): string | null {
  if (url.hostname.replace(/^www\./, "") !== "drive.google.com") return null;
  const chemin = url.pathname.match(/^\/file\/d\/([^/?#]+)/);
  if (chemin) return chemin[1]!;
  // L'ancienne forme, encore donnée par certains partages.
  return url.searchParams.get("id");
}

/**
 * Reconnaît une adresse de vidéo, et rend de quoi l'afficher.
 *
 * `null` pour tout le reste — un lien vers un article reste un lien, et c'est
 * ce qui permet d'écrire une adresse dans un cours sans qu'elle se transforme
 * en lecteur.
 */
export function lireVideo(adresse: string, titre?: string | null): Video | null {
  let url: URL;
  try {
    url = new URL(adresse.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;

  const yt = idYoutube(url);
  if (yt) {
    // `youtube-nocookie` : le lecteur ne pose rien tant qu'on n'a pas lancé la
    // lecture. Sur un cours qu'on ouvre pour lire, la plupart des vidéos ne
    // seront jamais jouées.
    const debut = url.searchParams.get("t") ?? url.searchParams.get("start");
    const secondes = debut ? String(parseInt(debut, 10) || 0) : null;
    return {
      src: `https://www.youtube-nocookie.com/embed/${yt}${
        secondes && secondes !== "0" ? `?start=${secondes}` : ""
      }`,
      titre: titre?.trim() || null,
      lien: `https://youtu.be/${yt}`,
      source: "youtube",
    };
  }

  const drive = idDrive(url);
  if (drive) {
    return {
      src: `https://drive.google.com/file/d/${drive}/preview`,
      titre: titre?.trim() || null,
      lien: `https://drive.google.com/file/d/${drive}/view`,
      source: "drive",
    };
  }

  return null;
}

/**
 * Reconnaît une ligne de cours qui ne contient qu'une vidéo.
 *
 * Trois écritures, parce que trois gestes différents mènent ici :
 *
 * - l'adresse seule, collée depuis la barre du navigateur ;
 * - `![Titre](adresse)`, quand on veut annoncer ce qu'on va voir ;
 * - le code d'intégration de YouTube, collé tel quel — on n'en lit que le
 *   `src`, le reste est jeté.
 */
export function videoDeLaLigne(ligne: string): Video | null {
  const l = ligne.trim();

  const balise = l.match(/^<iframe\b[^>]*\ssrc=["']([^"']+)["'][^>]*>\s*<\/iframe>$/i);
  if (balise) return lireVideo(balise[1]!);

  const image = l.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
  if (image) return lireVideo(image[2]!, image[1]);

  if (/^https:\/\/\S+$/.test(l)) return lireVideo(l);

  return null;
}
