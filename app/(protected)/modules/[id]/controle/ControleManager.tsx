"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getControle,
  saveControle,
  updateControle,
  setControleStatut,
  deleteControle,
  type Controle,
  type Question,
} from "@/app/actions/controles";
import CopiesManager from "./CopiesManager";
import { useToast } from "@/components/ui/Toast";
import Breadcrumb from "@/components/Breadcrumb";
import Badge from "@/components/ui/Badge";
import { exportPdfFromParts } from "@/lib/pdf";
import {
  BadgeCheck,
  Download,
  History,
  Link as LinkIcon,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";

type DraftQuestion = {
  id: string;
  enonce: string;
  bareme: number;
  corrige: string;
};

const inputClass =
  "w-full rounded-lg border border-border px-3 py-2 text-sm text-ink focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest";
const btnPrimary =
  "inline-flex items-center gap-1.5 rounded-lg bg-forest px-4 py-2 text-sm font-medium text-white hover:bg-forest/90 focus:outline-none focus:ring-2 focus:ring-forest disabled:cursor-not-allowed disabled:opacity-50";
const btnSecondary =
  "inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink hover:bg-paper focus:outline-none focus:ring-2 focus:ring-forest disabled:cursor-not-allowed disabled:opacity-50";
const btnGhost =
  "inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-slate hover:bg-slate/10 focus:outline-none focus:ring-2 focus:ring-forest";
const btnDangerGhost =
  "inline-flex items-center gap-1.5 rounded-lg border border-danger/50 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/10 focus:outline-none focus:ring-2 focus:ring-danger";

function newQuestion(): DraftQuestion {
  return { id: crypto.randomUUID(), enonce: "", bareme: 0, corrige: "" };
}

export default function ControleManager({
  moduleId,
  moduleNom,
  groupeId,
  controles,
}: {
  moduleId: string;
  moduleNom: string;
  moduleDuree: number;
  groupeId?: string | null;
  controles: Controle[];
}) {
  const router = useRouter();
  const pdfHeaderRef = useRef<HTMLDivElement>(null);
  const pdfBodyRef = useRef<HTMLDivElement>(null);

  const [activeId, setActiveId] = useState<string | null>(
    controles[0]?.id ?? null,
  );
  const [tokenPublic, setTokenPublic] = useState<string | null>(
    controles[0]?.token_public ?? null,
  );
  const [titre, setTitre] = useState("");
  const [consignes, setConsignes] = useState("");
  const [duree, setDuree] = useState(1);
  const [statut, setStatut] = useState<"brouillon" | "valide">("brouillon");
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);
  const [genDuree, setGenDuree] = useState(2);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<"editeur" | "copies">("editeur");
  const toast = useToast();

  const totalBareme = questions.reduce((s, q) => s + (Number(q.bareme) || 0), 0);

  async function loadControle(id: string) {
    setLoading(true);
    try {
      const c = await getControle(id);
      if (!c) return;
      setTokenPublic(c.token_public);
      setTitre(c.titre ?? "");
      setConsignes(c.consignes ?? "");
      setDuree(Number(c.duree_heures) || 1);
      setStatut(c.statut);
      setQuestions(
        c.questions.map((q: Question) => ({
          id: q.id,
          enonce: q.enonce ?? "",
          bareme: Number(q.bareme) || 0,
          corrige: q.corrige ?? "",
        })),
      );
      setNotice(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!activeId) return;
    loadControle(activeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  function handleNew() {
    setActiveId(null);
    setTokenPublic(null);
    setLoading(false);
    setTitre(`Contrôle — ${moduleNom}`);
    setConsignes("");
    setDuree(2);
    setStatut("brouillon");
    setQuestions([]);
    setNotice(null);
  }

  async function handleGenerate() {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/generate/controle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleId,
          dureeHeures: genDuree,
          groupeId: groupeId ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur de génération");

      setActiveId(null);
      setTitre(data.titre ?? `Contrôle — ${moduleNom}`);
      setConsignes(data.consignes ?? "");
      setDuree(genDuree);
      setStatut("brouillon");
      setQuestions(
        (data.questions ?? []).map((q: DraftQuestion) => ({
          id: crypto.randomUUID(),
          enonce: q.enonce ?? "",
          bareme: Number(q.bareme) || 0,
          corrige: q.corrige ?? "",
        })),
      );
      setNotice(
        `Contrôle généré — barème total : ${data.totalBareme ?? "?"} pts (vérifiez qu'il tombe sur 20).`,
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    if (!titre.trim()) {
      alert("Le titre est requis.");
      return;
    }
    if (totalBareme !== 20) {
      if (
        !confirm(
          `Le barème total est de ${totalBareme} points (attendu : 20). Enregistrer quand même ?`,
        )
      )
        return;
    }
    setBusy(true);
    try {
      const payload = {
        titre,
        consignes,
        duree_heures: duree,
        questions: questions.map((q) => ({
          enonce: q.enonce,
          bareme: Number(q.bareme) || 0,
          corrige: q.corrige || null,
        })),
      };
      if (activeId) {
        await updateControle(activeId, moduleId, payload);
      } else {
        const id = await saveControle(moduleId, payload);
        setActiveId(id);
      }
      setNotice("Contrôle enregistré (brouillon).");
      toast("Contrôle enregistré");
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setBusy(false);
    }
  }

  async function handleValidate() {
    if (!activeId) {
      alert("Enregistrez d'abord le contrôle avant de le valider.");
      return;
    }
    if (totalBareme !== 20) {
      alert(`Le barème doit totaliser 20 points (actuellement : ${totalBareme}).`);
      return;
    }
    setBusy(true);
    try {
      await setControleStatut(activeId, moduleId, "valide");
      setStatut("valide");
      setNotice("Contrôle validé.");
      toast("Contrôle validé");
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!activeId) return;
    if (!confirm("Supprimer ce contrôle ?")) return;
    try {
      await deleteControle(activeId, moduleId);
      handleNew();
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur inattendue");
    }
  }

  async function handleCopyLink() {
    if (!tokenPublic) {
      alert("Enregistrez d'abord le contrôle pour générer son lien.");
      return;
    }
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/public/controle/${tokenPublic}`,
      );
      alert("Lien de passage copié dans le presse-papiers.");
    } catch {
      alert("Impossible de copier le lien.");
    }
  }

  async function handleDownloadPdf() {
    setBusy(true);
    try {
      const safe = moduleNom.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");
      await exportPdfFromParts(
        pdfHeaderRef.current,
        pdfBodyRef.current,
        `controle-${safe}.pdf`,
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur de génération du PDF");
    } finally {
      setBusy(false);
    }
  }

  function updateQuestion(id: string, patch: Partial<DraftQuestion>) {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }

  function removeQuestion(id: string) {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  }

  return (
    <div className="p-8">
      <Breadcrumb
        items={[
          { label: "Modules", href: "/modules" },
          { label: moduleNom, href: `/modules/${moduleId}` },
          { label: "Contrôle" },
        ]}
      />

      <div className="mt-6 flex flex-wrap items-end gap-4 rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4">
        <div>
          <label htmlFor="genDuree" className="block text-sm font-medium text-ink">
            Durée du contrôle (heures)
          </label>
          <input
            id="genDuree"
            type="number"
            min={1}
            max={6}
            value={genDuree}
            onChange={(e) => setGenDuree(Number(e.target.value) || 1)}
            className={`${inputClass} mt-1 w-28`}
          />
        </div>
        <button onClick={handleGenerate} disabled={busy} className={btnSecondary}>
          {busy ? (
            "Génération…"
          ) : (
            <>
              <Sparkles size={16} />
              Générer un contrôle
            </>
          )}
        </button>
        <div className="ml-auto flex items-center gap-3">
          <select
            value={activeId ?? ""}
            onChange={(e) => {
              if (e.target.value === "__new") handleNew();
              else if (e.target.value) setActiveId(e.target.value);
            }}
            className={`${inputClass} w-56`}
          >
            <option value="__new">— Nouveau contrôle —</option>
            {controles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.titre ?? "Sans titre"} ({c.statut})
              </option>
            ))}
          </select>
        </div>
      </div>

      {notice ? (
        <p className="mt-4 rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          {notice}
        </p>
      ) : null}

      <div className="mt-6 flex gap-1 rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-1">
        <button
          onClick={() => setTab("editeur")}
          className={`flex-1 rounded-[4px] px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-forest ${
            tab === "editeur" ? "bg-mint text-forest" : "text-slate hover:bg-slate/5"
          }`}
        >
          Éditeur
        </button>
        <button
          onClick={() => setTab("copies")}
          className={`flex-1 rounded-[4px] px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-forest ${
            tab === "copies" ? "bg-mint text-forest" : "text-slate hover:bg-slate/5"
          }`}
        >
          Copies
        </button>
      </div>

      {tab === "copies" ? (
        activeId ? (
          <div className="mt-6">
            <CopiesManager
              controleId={activeId}
              controleTitre={titre}
              moduleNom={moduleNom}
            />
          </div>
        ) : (
          <p className="mt-6 rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4 text-sm text-slate">
            Enregistrez d&apos;abord un contrôle pour consulter ses copies.
          </p>
        )
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <div className="max-w-[640px] rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4">
            <label htmlFor="titre" className="block text-sm font-medium text-ink">
              Titre
            </label>
            <input
              id="titre"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              className={`${inputClass} mt-1`}
            />
          </div>

          <div className="max-w-[640px] rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4">
            <label
              htmlFor="consignes"
              className="block text-sm font-medium text-ink"
            >
              Consignes
            </label>
            <textarea
              id="consignes"
              rows={3}
              value={consignes}
              onChange={(e) => setConsignes(e.target.value)}
              className={`${inputClass} mt-1`}
            />
          </div>

          <div className="rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-ink">Questions</h2>
              <Badge tone={totalBareme === 20 ? "success" : "info"}>
                Barème : {totalBareme} / 20
              </Badge>
            </div>

            {loading ? (
              <p className="mt-3 text-sm text-slate">
                Chargement du contrôle…
              </p>
            ) : questions.length === 0 ? (
              <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-paper px-6 py-10 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-mint">
                  <svg
                    className="h-6 w-6 text-forest"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden
                  >
                    <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                    <rect x="9" y="3" width="6" height="4" rx="1" />
                    <path d="M9 12l2 2 4-4" />
                  </svg>
                </div>
                <p className="mt-4 text-sm font-medium text-ink">
                  Aucune question pour l&apos;instant
                </p>
                <p className="mt-1 text-sm text-slate">
                  Générez un contrôle avec l&apos;IA pour préparer
                  automatiquement les questions et le barème.
                </p>
                <button
                  onClick={handleGenerate}
                  disabled={busy}
                  className={`${btnPrimary} mt-5`}
                >
                  {busy ? (
                    "Génération…"
                  ) : (
                    <>
                      <Sparkles size={16} />
                      Générer un contrôle
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="mt-3 space-y-4">
                {questions.map((q, i) => (
                  <div
                    key={q.id}
                    className="rounded-lg border border-border p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate">
                        Question {i + 1}
                      </span>
                      <button
                        onClick={() => removeQuestion(q.id)}
                        className={btnDangerGhost}
                      >
                        <Trash2 size={16} />
                        Supprimer
                      </button>
                    </div>
                    <div className="mt-2">
                      <label
                        className="block text-xs text-slate"
                        htmlFor={`enonce-${q.id}`}
                      >
                        Énoncé
                      </label>
                      <textarea
                        id={`enonce-${q.id}`}
                        rows={2}
                        value={q.enonce}
                        onChange={(e) =>
                          updateQuestion(q.id, { enonce: e.target.value })
                        }
                        className={`${inputClass} mt-1`}
                      />
                    </div>
                    <div className="mt-2 grid grid-cols-[120px_1fr] gap-3">
                      <div>
                        <label
                          className="block text-xs text-slate"
                          htmlFor={`bareme-${q.id}`}
                        >
                          Barème
                        </label>
                        <input
                          id={`bareme-${q.id}`}
                          type="number"
                          min={0}
                          step={0.5}
                          value={q.bareme}
                          onChange={(e) =>
                            updateQuestion(q.id, {
                              bareme: Number(e.target.value) || 0,
                            })
                          }
                          className={`${inputClass} mt-1`}
                        />
                      </div>
                      <div>
                        <label
                          className="block text-xs text-slate"
                          htmlFor={`corrige-${q.id}`}
                        >
                          Corrigé
                        </label>
                        <textarea
                          id={`corrige-${q.id}`}
                          rows={2}
                          value={q.corrige}
                          onChange={(e) =>
                            updateQuestion(q.id, { corrige: e.target.value })
                          }
                          className={`${inputClass} mt-1`}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => setQuestions((prev) => [...prev, newQuestion()])}
                  className={`${btnSecondary} mt-4`}
                >
                  <Plus size={16} />
                  Ajouter une question
                </button>
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4">
            <h2 className="text-sm font-medium text-ink">Actions</h2>
            <div className="mt-3 flex flex-col gap-2">
              <button onClick={handleSave} disabled={busy || loading} className={btnPrimary}>
                <Save size={16} />
                Enregistrer
              </button>
              <button
                onClick={handleValidate}
                disabled={busy || statut === "valide"}
                className={btnSecondary}
              >
                {statut === "valide" ? (
                  <>
                    <BadgeCheck size={16} />
                    Validé
                  </>
                ) : (
                  <>
                    <BadgeCheck size={16} />
                    Valider le contrôle
                  </>
                )}
              </button>
              <button
                onClick={handleDownloadPdf}
                disabled={busy || questions.length === 0}
                className={btnGhost}
              >
                <Download size={16} />
                Exporter en PDF
              </button>
              <button
                onClick={handleCopyLink}
                disabled={!tokenPublic}
                className={btnGhost}
              >
                <LinkIcon size={16} />
                Copier le lien de passage
              </button>
              <button
                onClick={handleDelete}
                disabled={!activeId}
                className={btnDangerGhost}
              >
                <Trash2 size={16} />
                Supprimer
              </button>
              <Link
                href={`/modules/${moduleId}/controle/correction`}
                className={btnGhost}
              >
                <Wand2 size={16} />
                Assistant de correction
              </Link>
              <Link
                href={`/modules/${moduleId}/controle/historique`}
                className={btnGhost}
              >
                <History size={16} />
                Historique des modifications
              </Link>
            </div>
            <p className="mt-3 text-xs text-slate">
              Statut :{" "}
              <span className="font-medium">
                {statut === "valide" ? "validé" : "brouillon"}
              </span>
            </p>
          </div>
        </aside>
      </div>
      )}

      <div className="pdf-capture" aria-hidden>
        <div className="px-10 py-8">
          <div ref={pdfHeaderRef}>
            <div className="pdf-doc-header">
              <div>
                <div className="pdf-brand">OFPPT</div>
                <div className="pdf-org">
                  Office de la Formation Professionnelle et de la Promotion du Travail
                </div>
                <div className="pdf-org-sub">Royaume du Maroc</div>
              </div>
              <div className="pdf-ref">
                <div>Durée : {duree} h</div>
                <div>Barème : {totalBareme} pts</div>
              </div>
            </div>
          </div>

          <div ref={pdfBodyRef}>
            <h1 className="pdf-title">{titre || "Contrôle"}</h1>
            <p className="pdf-module">{moduleNom}</p>

            <div className="pdf-identity">
              <div>Nom :</div>
              <div>Prénom :</div>
            </div>

            {consignes ? (
              <div className="pdf-consignes">
                <strong>Consignes :</strong> {consignes}
              </div>
            ) : null}

            <div className="pdf-questions">
              {questions.map((q, i) => (
                <div key={q.id} className="pdf-question">
                  <div className="pdf-q-head">
                    <span className="pdf-q-num">Question {i + 1}</span>
                    <span className="pdf-q-bareme">{Number(q.bareme) || 0} pts</span>
                  </div>
                  <p className="pdf-q-enonce">{q.enonce}</p>
                  <div className="pdf-q-answer-space" />
                </div>
              ))}
            </div>

            <div className="pdf-footer">LMS OFPPT — {titre || "Contrôle"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
