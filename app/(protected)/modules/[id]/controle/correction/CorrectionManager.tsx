"use client";

import { useState } from "react";
import {
  getControle,
  type Controle,
  type Question,
} from "@/app/actions/controles";
import Breadcrumb from "@/components/Breadcrumb";
import Badge from "@/components/ui/Badge";
import { Wand2 } from "lucide-react";

const inputClass =
  "w-full rounded-lg border border-border px-3 py-2 text-sm text-ink focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest";
const btnPrimary =
  "inline-flex items-center gap-1.5 rounded-lg bg-forest px-4 py-2 text-sm font-medium text-white hover:bg-forest/90 focus:outline-none focus:ring-2 focus:ring-forest disabled:cursor-not-allowed disabled:opacity-50";

type Result = {
  points: number;
  bareme: number;
  commentaire: string;
};

export default function CorrectionManager({
  moduleId,
  moduleNom,
  controles,
}: {
  moduleId: string;
  moduleNom: string;
  controles: Controle[];
}) {
  const [controleId, setControleId] = useState<string | null>(
    controles[0]?.id ?? null,
  );
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionId, setQuestionId] = useState<string | null>(null);
  const [reponse, setReponse] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadControle(id: string) {
    setControleId(id);
    setQuestionId(null);
    setReponse("");
    setResult(null);
    setError(null);
    const c = await getControle(id);
    setQuestions(c?.questions ?? []);
  }

  const current = questions.find((q) => q.id === questionId) ?? null;

  async function handleEvaluate() {
    if (!questionId) return;
    if (!reponse.trim()) {
      setError("Saisissez la réponse du stagiaire avant d'évaluer.");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/corrige", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, reponse }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur de correction");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-8">
      <Breadcrumb
        items={[
          { label: "Modules", href: "/modules" },
          { label: moduleNom, href: `/modules/${moduleId}` },
          { label: "Contrôle", href: `/modules/${moduleId}/controle` },
          { label: "Correction" },
        ]}
      />

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[340px_1fr]">
        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4">
            <h2 className="text-sm font-medium text-ink">Contrôle</h2>
            <select
              value={controleId ?? ""}
              onChange={(e) => e.target.value && loadControle(e.target.value)}
              className={`${inputClass} mt-2`}
            >
              <option value="" disabled>
                Sélectionner un contrôle
              </option>
              {controles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.titre ?? "Sans titre"}
                </option>
              ))}
            </select>

            <h2 className="mt-5 text-sm font-medium text-ink">Question</h2>
            <select
              value={questionId ?? ""}
              onChange={(e) => {
                setQuestionId(e.target.value || null);
                setReponse("");
                setResult(null);
                setError(null);
              }}
              className={`${inputClass} mt-2`}
              disabled={questions.length === 0}
            >
              <option value="" disabled>
                {questions.length ? "Sélectionner une question" : "Aucune question"}
              </option>
              {questions.map((q, i) => (
                <option key={q.id} value={q.id}>
                  Question {i + 1} — {Number(q.bareme) || 0} pts
                </option>
              ))}
            </select>
          </div>
        </aside>

        <div className="space-y-4">
          {current ? (
            <div className="rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4">
              <div className="flex items-start justify-between gap-4">
                <p className="text-sm text-ink">{current.enonce}</p>
                <Badge tone="neutral">
                  {Number(current.bareme) || 0} pts
                </Badge>
              </div>
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-medium text-forest">
                  Voir le corrigé
                </summary>
                <p className="mt-1 whitespace-pre-line text-sm text-slate">
                  {current.corrige ?? "Non renseigné"}
                </p>
              </details>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-10 text-center text-sm text-slate">
              Sélectionnez un contrôle puis une question pour commencer.
            </div>
          )}

          {current ? (
            <div className="rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4">
              <label
                htmlFor="reponse"
                className="block text-sm font-medium text-ink"
              >
                Réponse du stagiaire
              </label>
              <textarea
                id="reponse"
                rows={5}
                value={reponse}
                onChange={(e) => setReponse(e.target.value)}
                className={`${inputClass} mt-2`}
                placeholder="Collez ici la réponse à évaluer…"
              />
              <div className="mt-3 flex items-center gap-3">
                <button
                  onClick={handleEvaluate}
                  disabled={busy}
                  className={btnPrimary}
                >
                  <Wand2 size={16} />
                  {busy ? "Évaluation…" : "Évaluer la réponse"}
                </button>
                <p className="text-xs text-slate">
                  Suggestion de note — jamais une note automatique définitive.
                </p>
              </div>

              {error ? (
                <p className="mt-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                  {error}
                </p>
              ) : null}

              {result ? (
                <div className="mt-4 rounded-lg border border-border bg-paper p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge
                      tone={
                        result.points === result.bareme
                          ? "success"
                          : result.points > 0
                            ? "info"
                            : "danger"
                      }
                    >
                      {result.points} / {result.bareme} pts
                    </Badge>
                    <span className="text-xs font-medium text-slate">
                      Note suggérée par l&apos;assistant
                    </span>
                  </div>
                  {result.commentaire ? (
                    <p className="mt-2 text-sm text-ink">
                      {result.commentaire}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
