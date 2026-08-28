import { formatHeures } from "@/lib/format";
import type { BilanHeures, Plafond } from "@/lib/heures-formateur";
import { AlertTriangle, BellRing } from "lucide-react";

function Jauge({ p }: { p: Plafond }) {
  const pct = Math.min(100, Math.round(p.taux * 100));
  const couleur =
    p.niveau === "depasse"
      ? "bg-danger"
      : p.niveau === "proche"
        ? "bg-info"
        : "bg-forest";

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 text-xs text-slate">{p.libelle}</span>
        <span
          className={`shrink-0 whitespace-nowrap text-xs tabular-nums ${
            p.niveau === "depasse" ? "font-semibold text-danger" : "text-ink"
          }`}
        >
          {formatHeures(p.valeur)} / {p.plafond} h
        </span>
      </div>
      <div
        className="mt-1 h-1.5 overflow-hidden rounded-full bg-border"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={p.libelle}
      >
        <div className={`h-full rounded-full ${couleur}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/**
 * Suivi cumulatif des heures dispensées (PRD §4.10).
 *
 * Trois plafonds de nature différente se surveillent ensemble : rester sous la
 * masse légale annuelle ne dit rien du plafond mensuel d'heures
 * supplémentaires, ni de leur plafond annuel.
 */
export default function SuiviHeures({
  bilan,
  compact = false,
}: {
  bilan: BilanHeures;
  /** En bandeau : l'essentiel sur une ligne, sans les jauges. */
  compact?: boolean;
}) {
  const s = bilan.semaineCourante;
  const alertes = bilan.plafonds.filter((p) => p.niveau !== "aucun");
  const annuel = bilan.plafonds[0];

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
        <span className="text-ink">
          <span className="font-semibold">{formatHeures(s?.heures ?? 0)}</span>{" "}
          <span className="text-slate">
            cette semaine · cible {formatHeures(s?.cible ?? 0)}
          </span>
        </span>
        {bilan.heuresSupActives && s && s.supplementaires > 0 ? (
          <span className="font-medium text-info">
            +{formatHeures(s.supplementaires)} sup.
          </span>
        ) : null}
        {annuel ? (
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-24 overflow-hidden rounded-full bg-border">
              <span
                className={`block h-full rounded-full ${
                  annuel.niveau === "depasse"
                    ? "bg-danger"
                    : annuel.niveau === "proche"
                      ? "bg-info"
                      : "bg-forest"
                }`}
                style={{ width: `${Math.min(100, Math.round(annuel.taux * 100))}%` }}
              />
            </span>
            <span className="whitespace-nowrap text-xs text-slate">
              {formatHeures(annuel.valeur)} / {annuel.plafond} h sur l&apos;année
            </span>
          </span>
        ) : null}
        {alertes.map((p) => (
          <span
            key={p.libelle}
            className={`rounded-md px-2 py-0.5 text-xs ${
              p.niveau === "depasse"
                ? "bg-danger/10 text-danger"
                : "bg-info/10 text-info"
            }`}
          >
            {p.message}
          </span>
        ))}
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h2 className="text-sm font-medium text-ink">Mes heures</h2>

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
        <span className="text-sm text-ink">
          <span className="font-semibold">
            {formatHeures(s?.heures ?? 0)}
          </span>{" "}
          <span className="text-slate">
            cette semaine · cible {formatHeures(s?.cible ?? 0)}
          </span>
        </span>
        {bilan.heuresSupActives && s && s.supplementaires > 0 ? (
          <span className="text-sm font-medium text-info">
            +{formatHeures(s.supplementaires)} supplémentaires
          </span>
        ) : null}
      </div>

      <div className="mt-4 space-y-3">
        {bilan.plafonds.map((p) => (
          <Jauge key={p.libelle} p={p} />
        ))}
      </div>

      {alertes.length > 0 ? (
        <ul className="mt-4 space-y-1.5">
          {alertes.map((p) => (
            <li
              key={p.libelle}
              className={`flex items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-xs ${
                p.niveau === "depasse"
                  ? "bg-danger/10 text-danger"
                  : "bg-info/10 text-info"
              }`}
            >
              {p.niveau === "depasse" ? (
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              ) : (
                <BellRing className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              )}
              {p.message}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-3 text-[11px] text-slate">
        Calculé sur les séances marquées faites, du 1<sup>er</sup> septembre au
        31 août.
        {bilan.heuresSupActives
          ? " Au-delà de la cible de la semaine, les heures sont comptées supplémentaires."
          : null}
      </p>
    </section>
  );
}
