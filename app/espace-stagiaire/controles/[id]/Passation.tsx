"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import AutoTextarea from "@/components/ui/AutoTextarea";
import { ConfirmModal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import type {
  ControleStagiaire,
  QuestionSujet,
} from "@/app/actions/controles-stagiaire";
import { ArrowLeft, Send } from "lucide-react";

/**
 * Composition d'un contrôle.
 *
 * Les propositions de QCM arrivent sans leur drapeau « correcte » — la base ne
 * le laisse pas sortir. Les réponses cochées sont stockées une par ligne,
 * forme que la correction compare côté serveur.
 */
export default function Passation({
  controle,
  sujet,
}: {
  controle: ControleStagiaire;
  sujet: QuestionSujet[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [reponses, setReponses] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [confirme, setConfirme] = useState(false);

  const repondues = sujet.filter((q) => (reponses[q.id] ?? "").trim()).length;

  async function rendre() {
    setBusy(true);
    try {
      const res = await fetch("/api/controle/passer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ controleId: controle.id, reponses }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Remise impossible.");
      toast("Copie rendue");
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Remise impossible.", "error");
    } finally {
      setBusy(false);
      setConfirme(false);
    }
  }

  return (
    <div>
      <Link
        href="/espace-stagiaire/controles"
        className="inline-flex min-h-[44px] items-center gap-1.5 text-sm text-slate"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Contrôles
      </Link>

      <h1 className="mt-2 text-lg font-semibold text-ink">
        {controle.titre ?? controle.moduleNom ?? "Contrôle"}
      </h1>
      <p className="mt-0.5 text-sm text-slate">
        {[
          controle.moduleNom,
          controle.duree_heures ? `${controle.duree_heures} h` : null,
          `${sujet.length} questions`,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>

      <ol className="mt-5 space-y-4">
        {sujet.map((q, i) => (
          <li
            key={q.id}
            className="rounded-xl border border-border bg-surface p-4"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs font-medium uppercase tracking-wide text-slate">
                Question {i + 1}
              </span>
              <Badge tone="neutral">{q.bareme} pts</Badge>
            </div>

            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink">
              {q.enonce}
            </p>

            {q.type === "qcm" && q.options?.length ? (
              <fieldset className="mt-3">
                <legend className="text-xs text-slate">
                  Cochez la ou les bonnes propositions
                </legend>
                <div className="mt-2 space-y-2">
                  {q.options.map((opt, j) => {
                    const cochees = (reponses[q.id] ?? "")
                      .split("\n")
                      .filter(Boolean);
                    const coche = cochees.includes(opt.texte);
                    return (
                      <label
                        key={j}
                        className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2"
                      >
                        <input
                          type="checkbox"
                          checked={coche}
                          onChange={(e) => {
                            const restant = cochees.filter((c) => c !== opt.texte);
                            setReponses((r) => ({
                              ...r,
                              [q.id]: (e.target.checked
                                ? [...restant, opt.texte]
                                : restant
                              ).join("\n"),
                            }));
                          }}
                          className="h-5 w-5 shrink-0 accent-forest"
                        />
                        <span className="text-sm text-ink">{opt.texte}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ) : (
              <AutoTextarea
                value={reponses[q.id] ?? ""}
                minRows={3}
                onChange={(e) =>
                  setReponses((r) => ({ ...r, [q.id]: e.target.value }))
                }
                placeholder="Votre réponse…"
                aria-label={`Réponse à la question ${i + 1}`}
                className="mt-3"
              />
            )}
          </li>
        ))}
      </ol>

      <div className="sticky bottom-24 mt-5 rounded-xl border border-border bg-surface p-3 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
        <p className="text-xs text-slate">
          {repondues} question{repondues > 1 ? "s" : ""} sur {sujet.length}{" "}
          répondue{repondues > 1 ? "s" : ""}
        </p>
        <Button
          icon={Send}
          className="mt-2 min-h-[44px] w-full"
          onClick={() => setConfirme(true)}
          disabled={busy || repondues === 0}
        >
          {busy ? "Remise…" : "Rendre ma copie"}
        </Button>
      </div>

      <ConfirmModal
        open={confirme}
        title="Rendre votre copie ?"
        message={
          repondues < sujet.length
            ? `Il reste ${sujet.length - repondues} question${sujet.length - repondues > 1 ? "s" : ""} sans réponse. Une copie rendue ne peut plus être modifiée.`
            : "Une copie rendue ne peut plus être modifiée."
        }
        confirmLabel="Rendre"
        busy={busy}
        onConfirm={rendre}
        onClose={() => setConfirme(false)}
      />
    </div>
  );
}
