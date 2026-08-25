"use client";

import { useEffect, useRef, useState } from "react";
import { getPassations, type Passation } from "@/app/actions/controles";
import { Download } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { exportPdfFromParts } from "@/lib/pdf";
import { formatDateTime, slugify } from "@/lib/format";

function noteTone(note: number): "success" | "info" | "danger" {
  if (note >= 10) return "success";
  if (note >= 5) return "info";
  return "danger";
}

export default function CopiesManager({
  controleId,
  controleTitre,
  moduleNom,
}: {
  controleId: string;
  controleTitre: string;
  moduleNom: string;
}) {
  const pdfHeaderRef = useRef<HTMLDivElement>(null);
  const pdfBodyRef = useRef<HTMLDivElement>(null);
  const [passations, setPassations] = useState<Passation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const selected = passations.find((p) => p.id === selectedId) ?? null;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getPassations(controleId)
      .then((data) => {
        if (cancelled) return;
        setPassations(data);
        setSelectedId((prev) =>
          prev && data.some((p) => p.id === prev) ? prev : data[0]?.id ?? null,
        );
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erreur");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [controleId]);

  async function handleDownloadPdf() {
    if (!selected) return;
    setBusy(true);
    try {
      const safeTitre = slugify(controleTitre || "controle", "controle");
      const safeNom = slugify(selected.nom_complet, "copie");
      await exportPdfFromParts(
        pdfHeaderRef.current,
        pdfBodyRef.current,
        `copie-${safeNom}-${safeTitre}.pdf`,
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

  return (
    <div>
      {error ? (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : loading ? (
        <p className="text-sm text-slate">Chargement des copies…</p>
      ) : passations.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4 text-sm text-slate">
          Aucune copie soumise pour l&apos;instant. Partagez le lien de passage
          pour collecter les réponses des stagiaires.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[340px_1fr]">
          <div className="rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-3">
            <h2 className="px-1 text-sm font-medium text-ink">
              Copies ({passations.length})
            </h2>
            <ul className="mt-2 space-y-1">
              {passations.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => setSelectedId(p.id)}
                    className={`w-full rounded-lg px-3 py-2 text-left hover:bg-slate/5 focus:outline-none focus:ring-2 focus:ring-forest ${
                      p.id === selectedId ? "bg-mint text-forest" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-ink">
                        {p.nom_complet}
                      </span>
                      <Badge tone={noteTone(Number(p.note) || 0)}>
                        {Number(p.note) || 0} / 20
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-slate">
                      {formatDateTime(p.submitted_at)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {selected ? (
            <div className="rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-bold text-ink">
                    {selected.nom_complet}
                  </h2>
                  <p className="text-xs text-slate">
                    {selected.email ? `${selected.email} · ` : ""}
                    {formatDateTime(selected.submitted_at)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Download}
                  onClick={handleDownloadPdf}
                  loading={busy}
                  loadingLabel="Génération…"
                >
                  Télécharger la copie (PDF)
                </Button>
              </div>

              <p className="mt-4 font-display text-4xl font-bold text-ink">
                {Number(selected.note) || 0}{" "}
                <span className="text-lg text-slate">/ 20</span>
              </p>

              <div className="mt-5 space-y-4">
                {(selected.responses ?? []).map((d, i) => (
                  <div
                    key={d.question_id}
                    className="rounded-xl border border-border p-3"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="text-sm font-bold text-ink">
                        Question {i + 1}
                      </h3>
                      <Badge
                        tone={
                          d.points === d.bareme
                            ? "success"
                            : d.points > 0
                              ? "info"
                              : "danger"
                        }
                      >
                        {d.points} / {d.bareme} pts
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-ink">{d.enonce}</p>
                    <p className="mt-2 text-sm text-slate">
                      <span className="font-medium text-ink">
                        Réponse du stagiaire :
                      </span>{" "}
                      {d.reponse || "(vide)"}
                    </p>
                    {d.commentaire ? (
                      <p className="mt-2 text-sm text-forest">
                        <span className="font-medium">Commentaire :</span>{" "}
                        {d.commentaire}
                      </p>
                    ) : null}
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm font-medium text-forest">
                        Voir le corrigé
                      </summary>
                      <p className="mt-1 whitespace-pre-line text-sm text-slate">
                        {d.corrige}
                      </p>
                    </details>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {selected ? (
        <div className="pdf-capture" aria-hidden>
          <div className="px-10 py-8">
            <div ref={pdfHeaderRef}>
              <div className="pdf-doc-header">
                <div>
                  <div className="pdf-brand">OFPPT</div>
                  <div className="pdf-org">
                    Office de la Formation Professionnelle et de la Promotion du
                    Travail
                  </div>
                  <div className="pdf-org-sub">Royaume du Maroc</div>
                </div>
                <div className="pdf-ref">
                  <div>Stagiaire : {selected.nom_complet}</div>
                  <div>
                    Note : {Number(selected.note) || 0} / 20
                  </div>
                </div>
              </div>
            </div>

            <div ref={pdfBodyRef}>
              <h1 className="pdf-title">{controleTitre || "Contrôle"}</h1>
              <p className="pdf-module">{moduleNom}</p>
              <div className="pdf-questions">
              {(selected.responses ?? []).map((d, i) => (
                <div key={d.question_id} className="pdf-question">
                  <div className="pdf-q-head">
                    <span className="pdf-q-num">Question {i + 1}</span>
                    <span className="pdf-q-bareme">
                      {d.points} / {d.bareme} pts
                    </span>
                  </div>
                  <p className="pdf-q-enonce">{d.enonce}</p>
                  <p className="pdf-q-answer">
                    <strong>Réponse :</strong> {d.reponse || "(vide)"}
                  </p>
                  {d.commentaire ? (
                    <p className="pdf-q-comment">
                      <strong>Commentaire :</strong> {d.commentaire}
                    </p>
                  ) : null}
                  <div className="pdf-q-corrige">
                    <p>
                      <strong>Corrigé :</strong> {d.corrige}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="pdf-footer">
              LMS OFPPT — {controleTitre || "Contrôle"}
            </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
