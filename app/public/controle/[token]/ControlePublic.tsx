"use client";

import { useEffect, useRef, useState } from "react";

import Button from "@/components/ui/Button";
import { inputStyles } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { slugify } from "@/lib/format";

const inputClass = inputStyles;

type Question = {
  id: string;
  type: "qcm" | "ouverte" | "exercice" | null;
  enonce: string;
  bareme: number;
  /** QCM uniquement. Le drapeau « correcte » est retiré côté base. */
  options: { texte: string }[] | null;
};

type Controle = {
  id: string;
  titre: string | null;
  consignes: string | null;
  duree_heures: number;
};

type Detail = {
  question_id: string;
  enonce: string;
  bareme: number;
  points: number;
  commentaire: string;
  corrige: string;
  reponse: string;
};

type Result = {
  passationId: string;
  titre: string;
  note: number;
  total: number;
  details: Detail[];
};

export default function ControlePublic({
  token,
  controle,
  questions,
}: {
  token: string;
  controle: Controle;
  questions: Question[];
}) {
  const toast = useToast();
  const reponsesRef = useRef<Record<string, string>>({});
  const submittedRef = useRef(false);

  const [phase, setPhase] = useState<"intro" | "exam" | "result">("intro");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [reponses, setReponses] = useState<Record<string, string>>({});
  const [tempsTotal, setTempsTotal] = useState(
    Math.round((controle.duree_heures || 1) * 3600),
  );
  const [tempsRestant, setTempsRestant] = useState(tempsTotal);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (phase !== "exam") return;
    const timer = setInterval(() => {
      setTempsRestant((t) => (t <= 1 ? 0 : t - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "exam" || tempsRestant > 0 || submittedRef.current) return;
    submittedRef.current = true;
    handleSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tempsRestant, phase]);

  async function handleSubmit() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/controle/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          nom,
          email: email || undefined,
          reponses: reponsesRef.current,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur de correction");
      setResult(data);
      setPhase("result");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur inattendue", "error");
    } finally {
      setBusy(false);
    }
  }

  function startExam() {
    if (!nom.trim()) {
      toast("Veuillez saisir votre nom complet.", "error");
      return;
    }
    setPhase("exam");
  }

  function fmt(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  const pct = Math.max(0, Math.min(100, (tempsRestant / tempsTotal) * 100));

  async function handleDownloadPdf() {
    if (!result) return;
    setBusy(true);
    try {
      const { telechargerCopiePdf } = await import("@/lib/pdf-copie");
      await telechargerCopiePdf(
        {
          titre: result.titre,
          stagiaire: nom,
          note: result.note,
          total: result.total,
          questions: result.details.map((d) => ({
            enonce: d.enonce,
            bareme: d.bareme,
            points: d.points,
            commentaire: d.commentaire,
            reponse: d.reponse,
          })),
          // Le stagiaire reçoit sa copie, jamais le corrigé de référence.
          avecCorrige: false,
        },
        `resultat-${slugify(nom, "stagiaire")}-${slugify(result.titre, "controle")}.pdf`,
      );
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Erreur de génération du PDF",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  if (phase === "intro") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper p-8">
        <div className="w-full max-w-lg rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-8">
          <div className="text-center">
            <div className="font-display text-lg font-bold text-ink">LMS OFPPT</div>
            <h1 className="mt-4 font-display text-[28px] font-bold text-ink">
              {controle.titre ?? "Contrôle"}
            </h1>
            <p className="mt-1 font-mono text-sm text-slate">
              Durée : {controle.duree_heures} h
            </p>
          </div>
          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              startExam();
            }}
          >
            <div>
              <label htmlFor="nom" className="block text-sm font-medium text-ink">
                Nom complet
              </label>
              <input
                id="nom"
                required
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                className={inputClass}
                placeholder="Ex. : Sara El Amrani"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-ink">
                Email (optionnel)
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </div>
            <Button type="submit" size="touch" className="w-full">
              Commencer le contrôle
            </Button>
          </form>
        </div>
      </main>
    );
  }

  if (phase === "result" && result) {
    return (
      <main className="min-h-screen bg-paper">
        <header className="flex items-center justify-between bg-ink px-6 py-4">
          <div className="font-display text-lg font-bold text-white">LMS OFPPT</div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownloadPdf}
            loading={busy}
            loadingLabel="Génération…"
          >
            Télécharger mon résultat (PDF)
          </Button>
        </header>

        <div className="mx-auto w-full max-w-[1200px] px-8 py-8">
          <div className="rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-6 text-center">
            <h1 className="font-display text-[28px] font-bold text-ink">
              {result.titre}
            </h1>
            <p className="mt-1 text-sm text-slate">Stagiaire : {nom}</p>
            <p className="mt-4 font-display text-[48px] font-bold text-ink">
              {result.note.toLocaleString("fr-FR")} / {result.total}
            </p>
            <p className="text-sm text-slate">Note obtenue</p>
          </div>

          <div className="mt-6 space-y-4">
            {result.details.map((d, i) => (
              <div key={d.question_id} className="rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4">
                <div className="flex items-start justify-between gap-4">
                  <h2 className="font-display text-lg font-bold text-ink">
                    Question {i + 1}
                  </h2>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                      d.points === d.bareme
                        ? "text-success"
                        : d.points > 0
                          ? "text-info"
                          : "text-danger"
                    }`}
                  >
                    {d.points} / {d.bareme} pts
                  </span>
                </div>
                <p className="mt-2 text-sm text-ink">{d.enonce}</p>
                <p className="mt-2 text-sm text-slate">
                  <span className="font-medium text-ink">Votre réponse :</span>{" "}
                  {d.reponse || "(vide)"}
                </p>
                {d.commentaire ? (
                  <p className="mt-2 text-sm text-forest">
                    <span className="font-medium">Commentaire :</span> {d.commentaire}
                  </p>
                ) : null}
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm font-medium text-forest">
                    Voir le corrigé
                  </summary>
                  <p className="mt-1 whitespace-pre-line text-sm text-slate">{d.corrige}</p>
                </details>
              </div>
            ))}
          </div>
        </div>

      </main>
    );
  }

  return (
    <main className="min-h-screen bg-paper">
      <header className="flex items-center justify-between bg-ink px-6 py-4">
        <div className="font-display text-lg font-bold text-white">LMS OFPPT</div>
        <span className="rounded-full bg-surface/10 px-3 py-1 text-xs font-medium text-white">
          {nom}
        </span>
      </header>

      <div className="mx-auto w-full max-w-[1200px] px-8 py-6">
        <div className="sticky top-0 z-10 rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4">
          <div className="flex items-center justify-between">
            <h1 className="font-display text-xl font-bold text-ink">
              {controle.titre ?? "Contrôle"}
            </h1>
            <span
              className={`rounded-full px-3 py-1 font-mono text-sm font-medium ${
                tempsRestant < 300 ? "text-danger" : "text-forest"
              }`}
            >
              ⏱ {fmt(tempsRestant)}
            </span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate/20">
            <div
              className="h-2 rounded-full bg-forest transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {controle.consignes ? (
          <p className="mt-6 rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4 text-sm text-ink">
            {controle.consignes}
          </p>
        ) : null}

        <div className="mt-6 space-y-4">
          {questions.map((q, i) => (
            <div key={q.id} className="rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4">
              <div className="flex items-start justify-between gap-4">
                <h2 className="font-display text-lg font-bold text-ink">
                  Question {i + 1}
                </h2>
                <span className="shrink-0 font-mono text-xs text-slate">
                  {q.bareme} pts
                </span>
              </div>
              <p className="mt-2 text-sm text-ink">{q.enonce}</p>

              {q.type === "qcm" && q.options?.length ? (
                <fieldset className="mt-3">
                  <legend className="text-xs font-medium text-slate">
                    Cochez la ou les bonnes propositions
                  </legend>
                  <div className="mt-2 space-y-2">
                    {q.options.map((opt, j) => {
                      // Les propositions cochées sont stockées une par ligne :
                      // c'est la forme que la notation compare côté serveur.
                      const cochees = (reponses[q.id] ?? "")
                        .split("\n")
                        .filter(Boolean);
                      const coche = cochees.includes(opt.texte);
                      return (
                        <label
                          key={j}
                          className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border px-3 py-2 hover:border-slate/40"
                        >
                          <input
                            type="checkbox"
                            checked={coche}
                            onChange={(e) => {
                              const restant = cochees.filter((c) => c !== opt.texte);
                              const valeur = (
                                e.target.checked ? [...restant, opt.texte] : restant
                              ).join("\n");
                              const next = {
                                ...reponsesRef.current,
                                [q.id]: valeur,
                              };
                              reponsesRef.current = next;
                              setReponses(next);
                            }}
                            className="mt-0.5 h-4 w-4 shrink-0 accent-forest"
                          />
                          <span className="text-sm text-ink">{opt.texte}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ) : (
                <>
                  <label className="mt-3 block text-xs font-medium text-slate">
                    Votre réponse
                  </label>
                  <textarea
                    rows={3}
                    value={reponses[q.id] ?? ""}
                    onChange={(e) => {
                      const next = {
                        ...reponsesRef.current,
                        [q.id]: e.target.value,
                      };
                      reponsesRef.current = next;
                      setReponses(next);
                    }}
                    className={inputClass}
                    placeholder="Écrivez votre réponse ici…"
                  />
                </>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 pb-8">
          <Button
            size="touch"
            onClick={handleSubmit}
            loading={busy}
            loadingLabel="Correction en cours…"
            className="w-full"
          >
            Terminer et corriger
          </Button>
        </div>
      </div>
    </main>
  );
}
