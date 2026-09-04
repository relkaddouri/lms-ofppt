"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { lireFiche } from "@/components/FicheSeance";
import { definitionPhase, PHASES } from "@/lib/phases";
import { marquerPhase, type SeanceDetail } from "@/app/actions/seances";
import { formatDateJour } from "@/lib/format";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";

/**
 * Le déroulement de la séance, une phase à la fois (PRD §4.3ter).
 *
 * Ce n'est pas un document à relire, c'est un support d'exécution : le
 * formateur anime sa classe et jette un œil à l'écran. D'où le texte plus
 * grand qu'ailleurs dans l'application, une seule phase visible, et rien
 * d'autre à l'écran que ce qu'il faut faire maintenant.
 */
export default function ModeAnimation({
  seance,
  groupeId,
}: {
  seance: SeanceDetail;
  groupeId: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [enCours, startTransition] = useTransition();

  const minutes = seance.duree_prevue
    ? Math.round(Number(seance.duree_prevue) * 60)
    : null;
  const fiche = lireFiche(seance.ficheContenu, minutes);

  // Les phases terminées sont en base ; la phase regardée ne l'est pas. On
  // peut revenir voir la précédente sans que ça défasse l'avancement.
  const [index, setIndex] = useState(() =>
    Math.min(seance.phase_courante, PHASES.length - 1),
  );
  const [faites, setFaites] = useState(seance.phase_courante);

  const phase = fiche.phases[index]!;
  const def = definitionPhase(phase.cle);
  const retour = `/groupes/${groupeId}/seances/${seance.id}`;

  const rien =
    phase.instructions.length === 0 &&
    phase.questions.length === 0 &&
    phase.points.length === 0;

  function enregistrerAvancement(n: number) {
    startTransition(async () => {
      try {
        await marquerPhase(seance.id, n);
        setFaites(n);
        router.refresh();
      } catch (e) {
        toast(e instanceof Error ? e.message : "Enregistrement impossible");
      }
    });
  }

  function terminerPhase() {
    const n = Math.max(faites, index + 1);
    enregistrerAvancement(n);
    if (index < PHASES.length - 1) setIndex(index + 1);
    else toast("Séance déroulée — les quatre phases sont faites.");
  }

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      {/* En-tête : le strict nécessaire pour savoir où l'on est. */}
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-surface px-6 py-3.5">
        <span className="text-sm font-semibold text-ink">
          {seance.groupeNom}
        </span>
        <span className="text-sm text-slate-2">{seance.moduleNom}</span>
        {seance.date ? (
          <span className="font-mono text-[13px] text-slate">
            {formatDateJour(seance.date, { court: true })}
          </span>
        ) : null}
        <Link
          href={retour}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-slate transition-colors duration-150 ease-out hover:bg-paper hover:text-ink"
        >
          <X size={16} aria-hidden />
          Quitter
        </Link>
      </header>

      {/* La barre des quatre phases : où l'on en est, d'un coup d'œil. */}
      <nav
        aria-label="Phases de la séance"
        className="flex gap-1.5 border-b border-separator bg-surface px-6 pb-3"
      >
        {PHASES.map((p, i) => {
          const faite = i < faites;
          const courante = i === index;
          return (
            <button
              key={p.cle}
              type="button"
              onClick={() => setIndex(i)}
              aria-current={courante ? "step" : undefined}
              className={`flex flex-1 flex-col gap-1.5 rounded-lg px-2.5 py-2 text-left transition-colors duration-150 ease-out ${
                courante ? "bg-wash" : "hover:bg-paper"
              }`}
            >
              <span
                className={`h-1.5 rounded-full ${
                  faite ? "bg-green" : courante ? "bg-teal" : "bg-wash-strong"
                }`}
              />
              <span
                className={`text-[12.5px] ${
                  courante ? "font-semibold text-ink" : "text-slate-2"
                }`}
              >
                {p.titre}
              </span>
            </button>
          );
        })}
      </nav>

      {/* La phase, seule au centre. */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.02em] text-ink">
            {def.titre}
          </h1>
          <span className="ml-auto font-mono text-base text-slate">
            {phase.minutes} min
          </span>
        </div>
        <p className="mt-1 text-[15px] text-slate-2">{def.intention}</p>
        {phase.methode ? (
          <p className="mt-3 inline-flex rounded-full border border-tint-teal-strong bg-tint-teal px-3.5 py-1.5 text-sm font-semibold text-ink">
            {phase.methode}
          </p>
        ) : null}

        {rien ? (
          <p className="mt-8 rounded-[10px] border border-border bg-surface px-5 py-4 text-[15px] text-slate">
            Cette phase est vide. Complétez la fiche de préparation avant
            d&apos;animer la séance —{" "}
            <Link href={retour} className="font-semibold text-teal underline">
              revenir à la préparation
            </Link>
            .
          </p>
        ) : (
          <div className="mt-7 flex flex-col gap-6">
            {phase.instructions.length > 0 ? (
              <section>
                <h2 className="font-mono text-[11.5px] uppercase tracking-[0.12em] text-slate-light">
                  À faire
                </h2>
                <ol className="mt-2.5 flex flex-col gap-2.5">
                  {phase.instructions.map((l, i) => (
                    <li
                      key={i}
                      className="flex gap-3 text-[17px] leading-relaxed text-ink"
                    >
                      <span className="mt-1 font-mono text-[13px] text-slate-light">
                        {i + 1}
                      </span>
                      <span>{l}</span>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}

            {phase.questions.length > 0 ? (
              <section>
                <h2 className="font-mono text-[11.5px] uppercase tracking-[0.12em] text-slate-light">
                  À demander, tel quel
                </h2>
                <ul className="mt-2.5 flex flex-col gap-2.5">
                  {phase.questions.map((q, i) => (
                    <li
                      key={i}
                      className="rounded-[10px] border-l-[3px] border-l-ink bg-surface px-4 py-3 text-[17px] leading-relaxed text-ink"
                    >
                      « {q} »
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {phase.points.length > 0 ? (
              <section>
                <h2 className="font-mono text-[11.5px] uppercase tracking-[0.12em] text-slate-light">
                  {def.libellePoints}
                </h2>
                <ul className="mt-2.5 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-ink">
                  {phase.points.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        )}
      </main>

      {/* La navigation reste en bas, à portée de pouce comme de souris. */}
      <footer className="sticky bottom-0 flex items-center gap-3 border-t border-border bg-surface px-6 py-3.5">
        <Button
          variant="secondary"
          icon={ArrowLeft}
          onClick={() => setIndex(index - 1)}
          disabled={index === 0}
        >
          Précédente
        </Button>
        <span className="font-mono text-[13px] text-slate">
          {index + 1} / {PHASES.length}
        </span>
        <div className="ml-auto flex items-center gap-3">
          {index < PHASES.length - 1 ? (
            <Button
              variant="ghost"
              iconRight={ArrowRight}
              onClick={() => setIndex(index + 1)}
            >
              Suivante
            </Button>
          ) : null}
          <Button
            icon={Check}
            onClick={terminerPhase}
            disabled={enCours || index < faites}
          >
            {index < faites
              ? "Phase terminée"
              : index === PHASES.length - 1
                ? "Terminer la séance"
                : "Phase terminée, passer à la suite"}
          </Button>
        </div>
      </footer>
    </div>
  );
}
