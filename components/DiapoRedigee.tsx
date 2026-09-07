"use client";

import type { BlocDiapo, Diapo } from "@/lib/diapos";

/**
 * Une diapositive 16:9 d'un cours rédigé.
 *
 * La géométrie est relevée sur le support de référence du porteur de projet :
 * logo à 4,7 % du bord, surtitre de section à 10,9 %, titre à 11,3 % de haut,
 * pied et numéro à 94,4 %, corps à partir de 23 %. Les encadrés y vont par
 * rangées de deux, jamais en colonne unique — c'est ce qui remplit la largeur
 * d'un 16:9 au lieu de laisser une bande vide à droite.
 *
 * Les tailles sont en `cqw` : elles se mesurent sur la largeur de la
 * diapositive, pas sur celle de l'écran. Une diapositive projetée et la même
 * dans une vignette gardent ainsi exactement les mêmes proportions.
 */

function Pastilles() {
  return (
    <span aria-hidden className="flex items-center gap-[0.5cqw]">
      {["bg-green", "bg-teal", "bg-ink"].map((c) => (
        <span key={c} className={`h-[0.9cqw] w-[0.9cqw] rounded-full ${c}`} />
      ))}
    </span>
  );
}

function Corps({ blocs }: { blocs: BlocDiapo[] }) {
  return (
    <div className="flex flex-col gap-[1.8cqw]">
      {blocs.map((b, i) => {
        if (b.type === "sousTitre") {
          return (
            <p
              key={i}
              className="font-display text-[2.1cqw] font-semibold text-ink"
            >
              {b.texte}
            </p>
          );
        }
        if (b.type === "texte") {
          return (
            <p key={i} className="text-[1.85cqw] leading-relaxed text-body">
              {b.texte}
            </p>
          );
        }
        if (b.type === "liste") {
          return (
            <ul key={i} className="flex list-none flex-col gap-[1cqw] p-0">
              {b.items.map((it, k) => (
                <li
                  key={k}
                  className="flex gap-[1.2cqw] text-[1.85cqw] leading-relaxed text-body"
                >
                  {/* Une liste numérotée garde ses numéros : dans un sommaire
                      ou une suite d'étapes, l'ordre est l'information. */}
                  {b.ordonnee ? (
                    <span className="mt-[0.15cqw] shrink-0 font-mono text-[1.5cqw] text-slate-light">
                      {String(k + 1).padStart(2, "0")}
                    </span>
                  ) : (
                    <span
                      aria-hidden
                      className="mt-[0.8cqw] h-[0.55cqw] w-[0.55cqw] shrink-0 rounded-full bg-teal"
                    />
                  )}
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          );
        }
        if (b.type === "cartes") {
          return (
            <div key={i} className="grid grid-cols-2 gap-[1.6cqw]">
              {b.cartes.map((c, k) => (
                <div
                  key={k}
                  className="flex flex-col gap-[0.6cqw] rounded-[0.9cqw] border border-border bg-paper px-[1.6cqw] py-[1.3cqw]"
                >
                  {c.intitule ? (
                    <p className="font-mono text-[1.15cqw] font-semibold uppercase tracking-[0.1em] text-slate-light">
                      {c.intitule}
                    </p>
                  ) : null}
                  {c.titre ? (
                    <p className="font-display text-[1.85cqw] font-semibold leading-snug text-ink">
                      {c.titre}
                    </p>
                  ) : null}
                  {c.lignes.map((l, j) => (
                    <p
                      key={j}
                      className="text-[1.6cqw] leading-snug text-slate-2"
                    >
                      {l}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          );
        }
        return (
          <div
            key={i}
            className="overflow-hidden rounded-[0.7cqw] border border-border"
          >
            <table className="w-full border-collapse text-left text-[1.5cqw]">
              <thead className="bg-paper-alt">
                <tr>
                  {b.entetes.map((e, k) => (
                    <th
                      key={k}
                      className="border-b border-border px-[1.1cqw] py-[0.7cqw] font-medium text-slate"
                    >
                      {e}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.lignes.map((ligne, k) => (
                  <tr key={k}>
                    {ligne.map((c, j) => (
                      <td
                        key={j}
                        className="border-t border-separator px-[1.1cqw] py-[0.6cqw] align-top text-body"
                      >
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

export default function DiapoRedigee({
  diapo,
  numero,
  pied,
}: {
  diapo: Diapo;
  numero: number;
  pied: string;
}) {
  // La couverture et les intercalaires sont sombres : ils marquent une
  // rupture, et c'est ce qui fait qu'on sait où on en est dans une projection
  // d'une heure.
  if (diapo.type === "couverture" || diapo.type === "intercalaire") {
    return (
      <div className="flex h-full flex-col justify-center bg-ink px-[6cqw] py-[5cqw] text-white">
        <p className="font-mono text-[1.3cqw] uppercase tracking-[0.18em] text-white/55">
          {diapo.surtitre}
        </p>
        <p className="mt-[1.6cqw] font-display text-[4.2cqw] font-bold leading-[1.1] tracking-[-0.02em]">
          {diapo.titre}
        </p>
        {diapo.sousTitre ? (
          <p className="mt-[1.4cqw] text-[1.9cqw] text-white/70">
            {diapo.sousTitre}
          </p>
        ) : null}
        {diapo.type === "couverture" && diapo.meta.length > 0 ? (
          <dl className="mt-[3.5cqw] grid grid-cols-2 gap-x-[3cqw] gap-y-[1.4cqw]">
            {diapo.meta.map((m) => (
              <div key={m.cle} className="flex flex-col gap-[0.3cqw]">
                <dt className="font-mono text-[1.1cqw] uppercase tracking-[0.12em] text-white/45">
                  {m.cle}
                </dt>
                <dd className="text-[1.5cqw] text-white/85">{m.valeur}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-surface px-[4.5cqw] pb-[3cqw] pt-[5.5cqw]">
      <div className="flex items-center gap-[1.5cqw]">
        <Pastilles />
        <p className="font-mono text-[1.15cqw] uppercase tracking-[0.14em] text-slate-light">
          {diapo.surtitre}
        </p>
      </div>

      <p className="mt-[1.2cqw] font-display text-[2.9cqw] font-bold leading-tight tracking-[-0.02em] text-ink">
        {diapo.type === "sommaire" ? "Sommaire" : diapo.titre}
      </p>

      <div className="mt-[2.4cqw] min-h-0 flex-1 overflow-hidden">
        {diapo.type === "sommaire" ? (
          <ol className="flex list-none flex-col gap-[1.3cqw] p-0">
            {diapo.entrees.map((e, i) => (
              <li key={i} className="flex items-baseline gap-[1.6cqw]">
                <span className="font-mono text-[1.6cqw] text-slate-light">
                  {String(i).padStart(2, "0")}
                </span>
                <span className="text-[2cqw] text-body">{e}</span>
              </li>
            ))}
          </ol>
        ) : (
          <Corps blocs={diapo.blocs} />
        )}
      </div>

      <div className="flex items-baseline justify-between pt-[1.2cqw]">
        <p className="font-mono text-[1.1cqw] text-muted">{pied}</p>
        <p className="font-mono text-[1.1cqw] text-muted">{numero}</p>
      </div>
    </div>
  );
}
