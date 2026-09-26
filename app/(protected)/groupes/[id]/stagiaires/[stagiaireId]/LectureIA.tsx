"use client";

import { useState } from "react";
import { Sparkles, ThumbsUp, TriangleAlert, Waypoints } from "lucide-react";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formatDateTime } from "@/lib/format";
import type { LectureSuivi } from "@/lib/lecture-suivi";

/**
 * Ce que le suivi veut dire, lu par le modèle (atome 13.3).
 *
 * À la demande, jamais à l'ouverture : la fiche se consulte dix fois par
 * semaine, et une lecture par ouverture coûterait un appel à chaque coup
 * d'œil. Une fois écrite, elle est conservée et s'affiche telle quelle ; le
 * bouton la relance quand le formateur veut la rafraîchir.
 */
export default function LectureIA({
  stagiaireId,
  initiale,
}: {
  stagiaireId: string;
  initiale: {
    lecture: LectureSuivi;
    assise: string | null;
    modele: string | null;
    genereLe: string;
  } | null;
}) {
  const toast = useToast();
  const [etat, setEtat] = useState(initiale);
  const [enCours, setEnCours] = useState(false);

  async function demander(regenerer: boolean) {
    setEnCours(true);
    try {
      const res = await fetch("/api/generate/suivi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stagiaireId, regenerer }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Lecture indisponible.");
      setEtat(data);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Lecture indisponible.", "error");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-[14px] border border-border bg-surface p-5 shadow-repos">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-tint-teal text-teal-dark">
          <Sparkles size={17} strokeWidth={1.9} aria-hidden />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-display text-[16px] font-semibold text-ink">
            Ce que ces chiffres disent
          </span>
          <span className="font-mono text-[12px] text-slate-light">
            {etat
              ? [
                  etat.assise,
                  `lu le ${formatDateTime(etat.genereLe)}`,
                  etat.modele,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "Le modèle lit le suivi et dit ce qui est acquis, ce qui manque, quoi reprendre."}
          </span>
        </span>
        <Button
          variant={etat ? "secondary" : "primary"}
          size="sm"
          icon={Sparkles}
          onClick={() => demander(!!etat)}
          loading={enCours}
          loadingLabel="Lecture en cours…"
        >
          {etat ? "Relancer la lecture" : "Lire ce que ça dit"}
        </Button>
      </div>

      {etat ? (
        <>
          <p className="max-w-[78ch] whitespace-pre-line text-[14.5px] leading-relaxed text-body">
            {etat.lecture.resume}
          </p>

          <div className="grid gap-3 md:grid-cols-3">
            <Bloc
              Icone={ThumbsUp}
              titre="Acquis"
              items={etat.lecture.forces}
              ton="border-tint-green bg-success-wash text-green-dark"
            />
            <Bloc
              Icone={TriangleAlert}
              titre="Ce qui manque"
              items={etat.lecture.lacunes}
              ton="border-tint-alert-strong bg-alert-wash text-coral-dark"
            />
            <Bloc
              Icone={Waypoints}
              titre="À reprendre avec lui"
              items={etat.lecture.conseils}
              ton="border-tint-teal-strong bg-tint-teal text-teal-dark"
            />
          </div>

          <p className="text-[12.5px] text-slate-light">
            Écrit par le modèle à partir des chiffres ci-dessus, sans son nom.
            À relire avant d&apos;en faire quoi que ce soit.
          </p>
        </>
      ) : null}
    </section>
  );
}

function Bloc({
  Icone,
  titre,
  items,
  ton,
}: {
  Icone: typeof ThumbsUp;
  titre: string;
  items: string[];
  ton: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className={`flex flex-col gap-2 rounded-[12px] border p-3.5 ${ton}`}>
      <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em]">
        <Icone size={14} strokeWidth={2} aria-hidden />
        {titre}
      </span>
      <ul className="flex flex-col gap-1.5">
        {items.map((t, i) => (
          <li key={i} className="text-[13.5px] leading-snug text-ink">
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}
