import type { Camarade } from "@/app/actions/fil";

/**
 * Rend un texte en mettant en évidence les camarades mentionnés.
 *
 * La mention est écrite « @Prénom Nom » dans le texte et résolue à
 * l'affichage : stocker des identifiants dans la prose rendrait le commentaire
 * illisible partout ailleurs — export, notification, base.
 */
export default function TexteMentions({
  texte,
  camarades,
}: {
  texte: string;
  camarades: Camarade[];
}) {
  // Les noms longs d'abord : sans cela « @Youssef » masquerait
  // « @Youssef Benali ».
  const noms = [...camarades]
    .map((c) => c.nom)
    .sort((a, b) => b.length - a.length);

  const morceaux: (string | { mention: string })[] = [];
  let reste = texte;

  while (reste.length > 0) {
    const arobase = reste.indexOf("@");
    if (arobase === -1) {
      morceaux.push(reste);
      break;
    }
    if (arobase > 0) morceaux.push(reste.slice(0, arobase));

    const apres = reste.slice(arobase + 1);
    const trouve = noms.find((n) => apres.toLowerCase().startsWith(n.toLowerCase()));

    if (trouve) {
      morceaux.push({ mention: apres.slice(0, trouve.length) });
      reste = apres.slice(trouve.length);
    } else {
      morceaux.push("@");
      reste = apres;
    }
  }

  return (
    <>
      {morceaux.map((m, i) =>
        typeof m === "string" ? (
          <span key={i}>{m}</span>
        ) : (
          <span key={i} className="font-medium text-ink">
            @{m.mention}
          </span>
        ),
      )}
    </>
  );
}
