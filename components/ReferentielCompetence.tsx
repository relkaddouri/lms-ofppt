"use client";

import { useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import type { Manuel } from "@/app/actions/manuel";
import { ChevronDown, ChevronUp } from "lucide-react";

/**
 * Consultation du référentiel officiel d'une compétence.
 *
 * En divulgation progressive : le formateur qui ouvre un module cherche
 * d'abord à se rappeler de quoi il s'agit, pas à relire dix-huit critères de
 * performance. Le détail complet reste à un clic, jamais imposé.
 */
export default function ReferentielCompetence({
  referentiel,
}: {
  referentiel: Manuel;
}) {
  const [ouvert, setOuvert] = useState(false);
  const r = referentiel;

  const nbCriteres = r.elements.reduce((t, e) => t + e.criteres.length, 0);

  return (
    <section className="rounded-[14px] border border-border bg-surface p-5 shadow-repos">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold text-ink">
            Référentiel officiel
          </h2>
          <p className="mt-0.5 text-sm text-slate">
            Compétence {r.numero}
            {r.codeOfficiel ? ` · ${r.codeOfficiel}` : ""}
            {r.dureeNationale ? ` · ${r.dureeNationale} h au national` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="neutral">Théorique {r.pctTheorique} %</Badge>
          <Badge tone="neutral">Pratique {r.pctPratique} %</Badge>
          <Badge tone="neutral">Évaluation {r.pctEvaluation} %</Badge>
        </div>
      </div>

      {/* Le résumé, toujours visible : de quoi s'agit-il, en une phrase. */}
      {r.enonce ? (
        <p className="mt-3 rounded-lg bg-wash px-3 py-2 text-sm text-ink">
          {r.enonce}
        </p>
      ) : null}

      <p className="mt-3 text-sm text-slate">
        {r.elements.length} élément{r.elements.length > 1 ? "s" : ""} de
        compétence · {nbCriteres} critère{nbCriteres > 1 ? "s" : ""} de
        performance · {r.objectifs.length} objectif
        {r.objectifs.length > 1 ? "s" : ""} d&apos;apprentissage
      </p>

      <Button
        variant="secondary"
        size="sm"
        icon={ouvert ? ChevronUp : ChevronDown}
        className="mt-3"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
      >
        {ouvert ? "Masquer le détail" : "Voir le détail complet"}
      </Button>

      {ouvert ? (
        <div className="mt-5 space-y-5 border-t border-border pt-5">
          {r.descriptionGenerale ? (
            <div>
              <h3 className="text-sm font-medium text-ink">
                Description générale du cours
              </h3>
              <p className="mt-1 whitespace-pre-line text-sm text-slate">
                {r.descriptionGenerale}
              </p>
            </div>
          ) : null}

          {r.contexteRealisation ? (
            <div>
              <h3 className="text-sm font-medium text-ink">
                Contexte de réalisation
              </h3>
              <p className="mt-1 whitespace-pre-line text-sm text-slate">
                {r.contexteRealisation}
              </p>
            </div>
          ) : null}

          {r.criteresGeneraux ? (
            <div>
              <h3 className="text-sm font-medium text-ink">
                Critères généraux de performance
              </h3>
              <p className="mt-1 whitespace-pre-line text-sm text-slate">
                {r.criteresGeneraux}
              </p>
            </div>
          ) : null}

          <div>
            <h3 className="text-sm font-medium text-ink">
              Éléments de la compétence
            </h3>
            <div className="mt-2 space-y-3">
              {r.elements.map((el) => {
                const objectifs = r.objectifs.filter(
                  (o) => o.lettre === el.lettre,
                );
                return (
                  <div
                    key={el.lettre}
                    className="rounded-lg border border-border p-3"
                  >
                    <p className="text-sm font-medium text-ink">
                      <span className="font-mono text-ink">{el.lettre}.</span>{" "}
                      {el.intitule}
                    </p>

                    {el.criteres.length > 0 ? (
                      <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-slate">
                        {el.criteres.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    ) : null}

                    {objectifs.length > 0 ? (
                      <ul className="mt-3 space-y-1.5 border-t border-border pt-2">
                        {objectifs.map((o) => (
                          <li key={o.code} className="text-sm">
                            <span className="font-mono text-xs text-ink">
                              {o.code}
                            </span>{" "}
                            <span className="text-ink">{o.intitule}</span>
                            {o.contenu ? (
                              <span className="mt-0.5 block whitespace-pre-line text-xs text-slate">
                                {o.contenu}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
