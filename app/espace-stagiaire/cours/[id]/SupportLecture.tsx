import type { Support } from "@/app/api/generate/support/route";

/**
 * Le support tel que le stagiaire le lit.
 *
 * Le formateur a une version éditable, faite de champs de saisie ; ici c'est
 * un document. On ne lui montre pas un formulaire en lecture seule : il vient
 * réviser, pas relire une fiche de travail.
 */
export default function SupportLecture({ support }: { support: Support }) {
  if (support.type === "pratique") {
    const total = support.criteres.reduce((t, c) => t + c.points, 0);
    return (
      <div className="space-y-5">
        <Bloc titre="Contexte">
          <p className="text-sm leading-relaxed text-ink">{support.contexte}</p>
        </Bloc>

        <Bloc titre="Objectif">
          <p className="text-sm leading-relaxed text-ink">{support.objectif}</p>
        </Bloc>

        <Bloc titre="Consignes">
          <ol className="space-y-2">
            {support.consignes.map((c, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed text-ink">
                <span className="shrink-0 font-semibold text-forest">
                  {i + 1}.
                </span>
                <span>{c}</span>
              </li>
            ))}
          </ol>
        </Bloc>

        <Bloc titre="Livrable attendu">
          <p className="text-sm leading-relaxed text-ink">{support.livrable}</p>
        </Bloc>

        <Bloc titre={`Barème (${total} / 20)`}>
          <ul className="divide-y divide-border">
            {support.criteres.map((c, i) => (
              <li key={i} className="flex items-baseline gap-3 py-2 text-sm">
                <span className="flex-1 text-ink">{c.critere}</span>
                <span className="shrink-0 font-medium tabular-nums text-slate">
                  {c.points} pt{c.points > 1 ? "s" : ""}
                </span>
              </li>
            ))}
          </ul>
        </Bloc>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-ink">{support.introduction}</p>

      {support.sections.map((sec, i) => (
        <Bloc key={i} titre={sec.titre}>
          <ul className="space-y-2">
            {sec.notions.map((n, k) => (
              <li key={k} className="flex gap-2 text-sm leading-relaxed text-ink">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-forest" />
                <span>{n}</span>
              </li>
            ))}
          </ul>
          {sec.exemple ? (
            <p className="mt-3 rounded-lg bg-mist p-3 text-sm leading-relaxed text-slate">
              <span className="font-medium text-ink">Exemple — </span>
              {sec.exemple}
            </p>
          ) : null}
        </Bloc>
      ))}

      {support.aRetenir.length > 0 ? (
        <section className="rounded-xl border border-border bg-mint/40 p-4">
          <h2 className="text-sm font-semibold text-forest">À retenir</h2>
          <ul className="mt-2 space-y-2">
            {support.aRetenir.map((r, i) => (
              <li key={i} className="flex gap-2 text-sm leading-relaxed text-ink">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-forest" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-ink">{titre}</h2>
      {children}
    </section>
  );
}
