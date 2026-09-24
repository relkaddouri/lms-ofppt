/**
 * L'en-tête d'un écran de l'espace stagiaire (PRD §4.5bis).
 *
 * Les cinq écrans s'ouvrent de la même façon : un surtitre qui situe, un
 * titre, une ligne qui dit ce qu'il y a à suivre. Écrit une fois ici plutôt
 * que recopié cinq fois — sans quoi les écrans divergent au premier
 * retouchage, ce qui était déjà le cas : les devoirs n'avaient pas d'en-tête
 * du tout, et on ne savait pas, en arrivant, sur quel écran on était.
 */
export default function EnTete({
  surtitre,
  titre,
  resume,
  dansCarte = true,
}: {
  surtitre: string;
  titre: string;
  resume?: React.ReactNode;
  /**
   * Vrai quand l'en-tête ouvre une carte qui tient toute la largeur : le
   * retrait vient alors de la carte. Faux quand la page enchaîne des cartes
   * séparées, où l'en-tête s'aligne sur elles.
   */
  dansCarte?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-1.5 pb-4 pt-[22px] ${
        dansCarte ? "px-5" : "px-5 md:px-0"
      }`}
    >
      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
        {surtitre}
      </span>
      <h1 className="font-display text-[26px] font-bold leading-tight tracking-[-0.02em] text-ink">
        {titre}
      </h1>
      {resume ? (
        <span className="text-[14.5px] text-slate-light">{resume}</span>
      ) : null}
    </div>
  );
}
