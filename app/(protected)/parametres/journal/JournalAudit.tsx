"use client";

import { useState } from "react";
import { ChevronDown, Lock } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import type { EntreeAudit, PorteeAudit } from "@/app/actions/audit";
import { formatDateTime } from "@/lib/format";

/** Teinte par famille d'entrée, reprise de `Journal d'audit.dc.html`. */
const TEINTES: Record<
  PorteeAudit,
  { etiquette: string; pastille: "green" | "teal" | "neutre" }
> = {
  Contrôle: {
    etiquette: "border-tint-green bg-success-wash text-green-dark",
    pastille: "green",
  },
  Note: {
    etiquette: "border-tint-teal-strong bg-tint-teal text-teal-dark",
    pastille: "teal",
  },
  Fiche: {
    etiquette: "border-border bg-wash-strong text-slate-2",
    pastille: "neutre",
  },
};

/** « il y a 25 min », « hier · 11:05 » — la maquette date par proximité. */
function depuis(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const heures = Math.round(minutes / 60);
  if (heures < 24) return `il y a ${heures} h`;
  const jours = Math.round(heures / 24);
  return jours === 1 ? "hier" : `il y a ${jours} j`;
}

/**
 * Journal d'audit, en lecture seule.
 *
 * Une entrée se lit d'abord en une ligne — qui, quoi, quand — et se déplie sur
 * le détail champ par champ, ancienne valeur contre nouvelle. C'est ce que
 * demande un contrôle pédagogique : pas un dump de la ligne modifiée, mais ce
 * qui a bougé.
 */
export default function JournalAudit({ entrees }: { entrees: EntreeAudit[] }) {
  const [ouvertes, setOuvertes] = useState<Set<string>>(new Set());

  function basculer(id: string) {
    setOuvertes((prev) => {
      const suivant = new Set(prev);
      if (suivant.has(id)) suivant.delete(id);
      else suivant.add(id);
      return suivant;
    });
  }

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-5">
      <div className="mt-5 flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[11.5px] uppercase tracking-[0.12em] text-slate-light">
            Traçabilité · lecture seule
          </span>
          <h1 className="font-display text-[29px] font-bold leading-tight tracking-[-0.02em] text-ink">
            Journal d&apos;audit
          </h1>
          <p className="text-base text-slate-2">
            Les modifications portées aux fiches de préparation, aux contrôles
            et aux notes.
          </p>
        </div>
        <span className="flex items-center gap-2.5 rounded-full border border-border bg-wash px-3.5 py-[7px]">
          <Lock size={14} className="text-slate-2" aria-hidden />
          <span className="text-[13.5px] font-semibold text-slate-2">
            Non modifiable
          </span>
        </span>
      </div>

      <section className="overflow-hidden rounded-[14px] border border-border bg-surface shadow-repos">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-separator bg-paper-alt px-6 py-4">
          <h2 className="font-display text-base font-semibold text-ink">
            7 derniers jours
          </h2>
          <span className="font-mono text-[13px] text-slate-light">
            {entrees.length} entrée{entrees.length > 1 ? "s" : ""}
          </span>
        </div>

        {entrees.length === 0 ? (
          <p className="px-6 py-12 text-center text-[14.5px] text-slate-light">
            Aucune modification enregistrée sur les sept derniers jours.
          </p>
        ) : (
          entrees.map((e) => {
            const ouverte = ouvertes.has(e.id);
            const teinte = TEINTES[e.portee];
            return (
              <div key={e.id} className="border-b border-separator">
                <div
                  className={`flex gap-3.5 px-6 py-[18px] ${
                    ouverte ? "bg-paper-alt" : "bg-surface"
                  }`}
                >
                  <Avatar
                    prenom={e.auteur}
                    texte={e.auteur === "Vous" ? "moi" : undefined}
                    taille="xs"
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="text-[15.5px] font-semibold text-ink">
                        {e.action}
                      </span>
                      <span
                        className={`whitespace-nowrap rounded-full border px-2.5 py-[3px] text-xs font-semibold ${teinte.etiquette}`}
                      >
                        {e.portee}
                      </span>
                      <span className="ml-auto whitespace-nowrap font-mono text-[12.5px] text-muted">
                        {depuis(e.date)}
                      </span>
                    </div>
                    <span className="text-sm text-slate-2">
                      {e.auteur} ·{" "}
                      <span className="font-mono text-slate-light">
                        {e.cible}
                      </span>
                    </span>
                    {e.changements.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => basculer(e.id)}
                        aria-expanded={ouverte}
                        className="flex items-center gap-[7px] self-start py-0.5 text-[13.5px] font-semibold text-teal transition-colors duration-150 ease-out hover:text-ink"
                      >
                        {ouverte ? "Masquer le détail" : "Voir le détail"}
                        <ChevronDown
                          size={12}
                          strokeWidth={2.4}
                          aria-hidden
                          className={`transition-transform duration-150 ease-out ${
                            ouverte ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                    ) : (
                      <span className="text-[13.5px] text-slate-light">
                        Aucun champ suivi n&apos;a changé.
                      </span>
                    )}
                  </div>
                </div>

                {ouverte ? (
                  <div className="flex flex-col gap-3 px-6 pb-5 pl-[74px]">
                    <div className="grid gap-3 border-b border-separator py-2.5 [grid-template-columns:minmax(120px,0.8fr)_minmax(140px,1fr)_minmax(140px,1fr)]">
                      {["Champ", "Ancienne valeur", "Nouvelle valeur"].map(
                        (c) => (
                          <span
                            key={c}
                            className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-slate-light"
                          >
                            {c}
                          </span>
                        ),
                      )}
                    </div>
                    {e.changements.map((c) => (
                      <div
                        key={c.champ}
                        className="grid items-stretch gap-3 [grid-template-columns:minmax(120px,0.8fr)_minmax(140px,1fr)_minmax(140px,1fr)]"
                      >
                        <span className="self-center text-sm text-body">
                          {c.champ}
                        </span>
                        <span className="rounded-[9px] border border-border bg-paper-alt px-3 py-2.5 text-sm leading-relaxed text-slate-2">
                          {c.avant}
                        </span>
                        <span className="rounded-[9px] border border-tint-green bg-success-wash px-3 py-2.5 text-sm leading-relaxed text-green-dark">
                          {c.apres}
                        </span>
                      </div>
                    ))}
                    <div className="flex flex-wrap items-center gap-4 pt-1.5">
                      <span className="font-mono text-[12.5px] text-muted">
                        {formatDateTime(e.date)}
                      </span>
                      <span className="font-mono text-[12.5px] text-muted">
                        {e.reference}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 bg-paper-alt px-6 py-4">
          <span className="text-sm text-slate-2">
            Les entrées plus anciennes restent en base ; cette vue s&apos;arrête
            à sept jours.
          </span>
        </div>
      </section>
    </div>
  );
}
