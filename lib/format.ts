/**
 * Fonctions de formatage partagées.
 * Source unique du projet : ne jamais réécrire une variante locale
 * (conventions.md « ne jamais dupliquer une fonction utilitaire »).
 */

/** Date courte française. `fallback` s'affiche quand la date est absente. */
export function formatDate(
  value: string | Date | null | undefined,
  fallback = "—",
): string {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString("fr-FR");
}

/**
 * Date d'une séance, jour de la semaine compris — « Vendredi 07/09/2026 ».
 *
 * Le formateur pense en jours (« le vendredi je vois DES101 »), pas en
 * quantièmes : lui faire recalculer le jour de tête est une charge évitable
 * (design_system.md §11). Forme courte — « Ven. 07/09/2026 » — pour les
 * listes denses.
 *
 * Un seul appel produit le jour et les chiffres : les calculer séparément
 * exposerait à ce qu'ils se contredisent au passage d'un fuseau.
 */
export function formatDateJour(
  value: string | Date | null | undefined,
  options: { court?: boolean } = {},
  fallback = "—",
): string {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  const texte = date.toLocaleDateString("fr-FR", {
    weekday: options.court ? "short" : "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  // Le français rend le jour en minuscule ; en tête de ligne il porte une
  // majuscule comme n'importe quel début de libellé.
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

/** Date + heure, pour les horodatages (copies, historique). */
export function formatDateTime(
  value: string | Date | null | undefined,
  fallback = "—",
): string {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Initiales sur deux lettres maximum.
 * Accepte des parties séparées (`initials(prenom, nom)`) ou une chaîne unique,
 * y compris une adresse email (`initials("sara.el-amrani@ofppt.ma")` → "SE").
 */
export function initials(...parts: (string | null | undefined)[]): string {
  const nettoyees = parts
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .flatMap((p) =>
      p.includes("@") ? p.split("@")[0]!.split(/[\s._-]+/) : [p],
    )
    .filter(Boolean);

  const lettres = nettoyees
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");

  return lettres || "?";
}

/** Heures à la française : 9.5 -> « 9,5 h », 115 -> « 115 h ». */
/**
 * Durée en heures et minutes, jamais en décimales.
 *
 * « 5,25 h » ne veut rien dire pour un formateur : une séance dure 2 h 30, 3 h
 * ou 5 h. On écrit donc « 5 h 15 », comme sur un emploi du temps.
 */
export function formatHeures(valeur: number | string | null | undefined): string {
  const n = Number(valeur);
  if (!Number.isFinite(n)) return "—";
  const signe = n < 0 ? "-" : "";
  const total = Math.round(Math.abs(n) * 60);
  const h = Math.floor(total / 60);
  const min = total % 60;
  if (min === 0) return `${signe}${h} h`;
  return `${signe}${h} h ${String(min).padStart(2, "0")}`;
}

/** Fragment de nom de fichier sûr : accents et ponctuation retirés, espaces en tirets. */
export function slugify(value: string, fallback = "document"): string {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // diacritiques combinants
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  return slug || fallback;
}

/**
 * Une date au format `YYYY-MM-DD`, dans le fuseau de l'utilisateur.
 *
 * `toISOString().slice(0, 10)` ne fait pas ça : il convertit d'abord en UTC.
 * À l'est de Greenwich, le lundi ramené à minuit local ressort daté du
 * dimanche — c'est ce qui bloquait la navigation du calendrier, chaque
 * « semaine suivante » retombant sur la même semaine.
 */
export function dateLocale(d: Date): string {
  const mois = String(d.getMonth() + 1).padStart(2, "0");
  const jour = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mois}-${jour}`;
}

/** La date du jour, telle que l'utilisateur la lit sur son calendrier. */
export function maintenant(): string {
  return dateLocale(new Date());
}
