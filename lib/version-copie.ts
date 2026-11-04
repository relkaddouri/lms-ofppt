/**
 * Deux versions d'une copie corrigée sont-elles la même ?
 *
 * Sert de garde à l'enregistrement : l'écran de correction ne relit plus la
 * page après chaque question, il garde lui-même la dernière version
 * enregistrée. Un onglet resté ouvert, ou une page restaurée par le bouton
 * « précédent », peut donc tenir une version périmée — et l'enregistrer
 * écraserait la bonne. On compare ce que l'écran croit être en base avec ce
 * qui y est vraiment.
 *
 * L'ordre des clés ne compte pas : `jsonb` les réordonne à l'écriture, et la
 * copie relue n'a jamais l'ordre de celle envoyée. Les champs `undefined`
 * non plus : ils disparaissent en traversant JSON, à l'aller comme au retour.
 */
export function memeVersion(a: unknown, b: unknown): boolean {
  return canonique(a) === canonique(b);
}

function canonique(valeur: unknown): string {
  return JSON.stringify(trier(JSON.parse(JSON.stringify(valeur ?? null))));
}

function trier(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(trier);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.keys(v)
        .sort()
        .map((k) => [k, trier((v as Record<string, unknown>)[k])]),
    );
  }
  return v;
}
