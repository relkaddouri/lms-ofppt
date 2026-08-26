import { formatHeures } from "@/lib/format";

/**
 * Progression d'un groupe ou d'un module, exprimée en heures dispensées sur la
 * masse horaire allouée. Le design system impose un chiffre aligné à droite en
 * mono, jamais une barre graphique : la clarté du nombre prime.
 */
export default function RailDeProgression({
  heuresRealisees,
  masseHoraire,
}: {
  heuresRealisees: number;
  masseHoraire: number;
}) {
  const pourcentage =
    masseHoraire > 0
      ? Math.round((heuresRealisees / masseHoraire) * 100)
      : 0;

  return (
    <div className="text-right">
      <p className="font-mono text-sm text-ink">
        {formatHeures(heuresRealisees)}{" "}
        <span className="text-slate">/ {formatHeures(masseHoraire)}</span>
      </p>
      <p className="font-mono text-xs text-slate">
        {masseHoraire > 0 ? `${pourcentage} %` : "masse horaire non définie"}
      </p>
    </div>
  );
}
