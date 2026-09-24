"use client";

import { useState } from "react";
import { Check, Lightbulb, RotateCcw, X } from "lucide-react";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { QuestionQuiz } from "@/lib/quiz";

/**
 * Le quiz d'auto-évaluation d'un chapitre (PRD §4.5bis).
 *
 * Une question à la fois, corrigée dès qu'on répond : c'est le moment où l'on
 * apprend quelque chose, et le retenir pour la fin le gâcherait. L'explication
 * s'affiche même quand la réponse est juste — savoir pourquoi on a bon vaut
 * autant que savoir pourquoi on s'est trompé.
 *
 * Rien n'est enregistré : ni score, ni tentative, ni remontée au formateur. Le
 * quiz se rejoue autant de fois qu'on veut.
 */
export default function QuizChapitre({ supportId }: { supportId: string }) {
  const toast = useToast();
  const [questions, setQuestions] = useState<QuestionQuiz[] | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [index, setIndex] = useState(0);
  const [choix, setChoix] = useState<number | null>(null);
  const [justes, setJustes] = useState(0);
  const [fini, setFini] = useState(false);

  async function commencer() {
    setEnCours(true);
    try {
      const res = await fetch("/api/generate/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supportId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Quiz indisponible.");
      setQuestions(data.questions as QuestionQuiz[]);
      setIndex(0);
      setChoix(null);
      setJustes(0);
      setFini(false);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Quiz indisponible.", "error");
    } finally {
      setEnCours(false);
    }
  }

  function repondre(i: number) {
    if (choix !== null || !questions) return;
    setChoix(i);
    if (i === questions[index]!.bonne) setJustes((n) => n + 1);
  }

  function suite() {
    if (!questions) return;
    if (index + 1 >= questions.length) {
      setFini(true);
      return;
    }
    setIndex((n) => n + 1);
    setChoix(null);
  }

  if (!questions) {
    return (
      <section className="flex flex-col gap-3 rounded-[14px] border border-border bg-surface p-4 md:flex-row md:items-center md:p-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-tint-teal text-teal-dark">
          <Lightbulb className="h-5 w-5" aria-hidden />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-display text-[16px] font-semibold text-ink">
            Testez-vous sur ce chapitre
          </span>
          <span className="text-[13.5px] leading-relaxed text-slate">
            Quelques questions tirées du cours, corrigées tout de suite. Ce
            n&apos;est pas noté, et vous pouvez recommencer autant que vous
            voulez.
          </span>
        </span>
        <Button
          onClick={commencer}
          loading={enCours}
          loadingLabel="Préparation…"
          className="min-h-[44px] max-md:w-full"
        >
          Commencer le quiz
        </Button>
      </section>
    );
  }

  if (fini) {
    const sur = questions.length;
    return (
      <section className="flex flex-col items-start gap-3 rounded-[14px] border border-border bg-surface p-5">
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-slate-light">
          Quiz terminé
        </span>
        <p className="font-display text-[22px] font-bold text-ink">
          {justes} bonne{justes > 1 ? "s" : ""} réponse{justes > 1 ? "s" : ""} sur{" "}
          {sur}
        </p>
        <p className="max-w-[60ch] text-[14.5px] leading-relaxed text-body">
          {justes === sur
            ? "Le chapitre est acquis. Passez au suivant, ou revenez-y avant le contrôle."
            : justes >= sur / 2
              ? "L'essentiel est là. Relisez les points sur lesquels vous avez hésité, puis refaites le quiz."
              : "Reprenez le chapitre tranquillement : les questions portent toutes sur ce qui y est écrit."}
        </p>
        <Button variant="secondary" icon={RotateCcw} onClick={() => { setFini(false); setIndex(0); setChoix(null); setJustes(0); }}>
          Recommencer
        </Button>
      </section>
    );
  }

  const q = questions[index]!;
  const repondu = choix !== null;

  return (
    <section className="flex flex-col gap-4 rounded-[14px] border border-border bg-surface p-4 md:p-5">
      <div className="flex items-center gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-slate-light">
          Question {index + 1} sur {questions.length}
        </span>
        <span className="ml-auto flex gap-1" aria-hidden>
          {questions.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-6 rounded-full ${
                i < index ? "bg-teal" : i === index ? "bg-ink" : "bg-wash-strong"
              }`}
            />
          ))}
        </span>
      </div>

      <p className="text-[16px] font-semibold leading-snug text-ink">{q.question}</p>

      <ul className="flex flex-col gap-2">
        {q.propositions.map((p, i) => {
          const juste = i === q.bonne;
          const choisi = choix === i;
          const ton = !repondu
            ? "border-border hover:border-border-strong"
            : juste
              ? "border-tint-green bg-success-wash"
              : choisi
                ? "border-tint-alert-strong bg-alert-wash"
                : "border-border opacity-60";
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => repondre(i)}
                disabled={repondu}
                aria-label={`${p}${repondu ? (juste ? " — bonne réponse" : choisi ? " — votre réponse, fausse" : "") : ""}`}
                className={`flex min-h-[48px] w-full items-center gap-3 rounded-[10px] border px-3.5 py-2.5 text-left transition-colors duration-150 ${ton} ${
                  repondu ? "cursor-default" : "cursor-pointer"
                }`}
              >
                <span
                  aria-hidden
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[12px] font-semibold ${
                    repondu && juste
                      ? "border-green bg-green text-white"
                      : repondu && choisi
                        ? "border-coral bg-coral text-white"
                        : "border-border-strong text-slate-2"
                  }`}
                >
                  {repondu && juste ? (
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  ) : repondu && choisi ? (
                    <X className="h-3.5 w-3.5" strokeWidth={3} />
                  ) : (
                    String.fromCharCode(65 + i)
                  )}
                </span>
                <span className="text-[15px] leading-snug text-ink">{p}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {repondu ? (
        <div className="flex flex-col gap-3">
          {q.explication ? (
            <p className="rounded-[10px] border border-tint-teal-strong bg-tint-teal px-4 py-3 text-[14.5px] leading-relaxed text-ink">
              <span className="font-semibold">
                {choix === q.bonne ? "C'est juste. " : "La bonne réponse était « " + q.propositions[q.bonne] + " ». "}
              </span>
              {q.explication}
            </p>
          ) : null}
          <Button onClick={suite} className="min-h-[44px] self-start">
            {index + 1 >= questions.length ? "Voir mon résultat" : "Question suivante"}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
