/**
 * Marque de Pédago : trois losanges puis le nom.
 *
 * Les losanges viennent du logo officiel de l'OFPPT — l'organisme reste la
 * source de l'identité visuelle, même si le produit porte son propre nom.
 *
 * Reprise des écrans livrés (`Connexion.dc.html`, en-tête de la planche de
 * style) : trois carrés pivotés à 45°, vert, sarcelle et corail, dans cet
 * ordre. Le losange corail est le seul corail toléré hors de la règle du
 * corail — c'est un élément de marque, pas un signal d'attention.
 */
export default function MarquePedago({
  taille = 15,
  ecart = 4,
}: {
  /** Côté d'un losange, avant rotation. 15px sur l'écran de connexion, 11px dans la planche. */
  taille?: number;
  ecart?: number;
}) {
  return (
    <span
      aria-hidden
      className="flex shrink-0"
      style={{ gap: `${ecart}px` }}
    >
      {["bg-green", "bg-teal", "bg-coral"].map((fond) => (
        <span
          key={fond}
          className={`${fond} rotate-45`}
          style={{ width: taille, height: taille }}
        />
      ))}
    </span>
  );
}
