"use client";

/**
 * Choix exclusif présenté en carte, et non en liste déroulante.
 *
 * `Préparer un contrôle.dc.html` remplace les `select` de la v2 par des cartes
 * radio : la nature et le format d'un contrôle emportent des conséquences —
 * circuit de validation, salle, forme des questions — qu'un menu replié ne
 * laisse pas voir. Chaque carte porte donc son explication et sa conséquence.
 */
export type Choix<T extends string> = {
  cle: T;
  label: string;
  detail: string;
  meta: string;
};

export default function CarteChoix<T extends string>({
  titre,
  description,
  choix,
  valeur,
  onChange,
}: {
  titre: string;
  description: string;
  choix: readonly Choix<T>[];
  valeur: T;
  onChange: (v: T) => void;
}) {
  return (
    <section className="flex flex-col gap-[18px] rounded-[14px] border border-border bg-surface p-6 shadow-repos">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-[18px] font-semibold text-ink">
          {titre}
        </h2>
        <p className="text-sm text-slate-light">{description}</p>
      </div>

      <div
        role="radiogroup"
        aria-label={titre}
        className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(228px,1fr))]"
      >
        {choix.map((c) => {
          const actif = c.cle === valeur;
          return (
            <button
              key={c.cle}
              type="button"
              role="radio"
              aria-checked={actif}
              onClick={() => onChange(c.cle)}
              className={`flex flex-col gap-2 rounded-xl border p-4 text-left transition-colors duration-150 ease-out ${
                actif
                  ? "border-ink bg-paper-alt"
                  : "border-border bg-surface hover:border-border-strong"
              }`}
            >
              <span className="flex items-center gap-2.5">
                <span
                  aria-hidden
                  className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 bg-surface ${
                    actif ? "border-ink" : "border-border-strong"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      actif ? "bg-ink" : "bg-transparent"
                    }`}
                  />
                </span>
                <span className="font-display text-[15.5px] font-semibold text-ink">
                  {c.label}
                </span>
              </span>
              <span className="text-[13.5px] leading-snug text-slate-2">
                {c.detail}
              </span>
              <span
                className={`font-mono text-[12.5px] ${
                  actif ? "text-teal-dark" : "text-muted"
                }`}
              >
                {c.meta}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
