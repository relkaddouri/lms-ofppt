"use client";

import { useEffect, useState } from "react";
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
  type TypeControle,
  type TypeEfm,
  type FormatControle,
  type TypeQuestion,
  type OptionQcm,
} from "@/app/actions/controles";
import CopiesManager from "./CopiesManager";
import { useToast } from "@/components/ui/Toast";
import Breadcrumb from "@/components/Breadcrumb";
import Badge from "@/components/ui/Badge";
import Button, { buttonStyles } from "@/components/ui/Button";
import { inputStyles } from "@/components/ui/Input";
import { ConfirmModal } from "@/components/ui/Modal";
import { telechargerControlePdf } from "@/lib/pdf-controle";
import { slugify } from "@/lib/format";
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
  type: TypeQuestion;
  enonce: string;
  bareme: number;
  options: OptionQcm[];
  corrige: string;
};

const LIBELLE_QUESTION: Record<TypeQuestion, string> = {
  qcm: "Choix multiple",
  ouverte: "Question ouverte",
  exercice: "Exercice d'application",
};

const inputClass = inputStyles;
const btnGhostLink = buttonStyles("ghost", "sm");

function newQuestion(): DraftQuestion {
  return {
    id: crypto.randomUUID(),
    type: "ouverte",
    enonce: "",
    bareme: 0,
    options: [],
    corrige: "",
  };
}

function optionVide(): OptionQcm {
  return { texte: "", correcte: false };
}

export default function ControleManager({
  moduleId,
  moduleNom,
  moduleCode,
  groupeId,
  groupeNom,
  controles,
}: {
  moduleId: string;
  moduleNom: string;
  moduleDuree: number;
  moduleCode: string | null;
  groupeId: string;
  groupeNom: string;
  controles: Controle[];
}) {
  const router = useRouter();

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
  const [type, setType] = useState<TypeControle>("CC");
  const [typeEfm, setTypeEfm] = useState<TypeEfm>("local");
  const [format, setFormat] = useState<FormatControle>("theorique");
  const [datePrevue, setDatePrevue] = useState("");
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);
  const [genDuree, setGenDuree] = useState(2);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<"editeur" | "copies">("editeur");
  const [confirmBareme, setConfirmBareme] = useState(false);
  const [avertissements, setAvertissements] = useState<string[]>([]);
  const [instruction, setInstruction] = useState("");
  const [confirmSuppression, setConfirmSuppression] = useState(false);
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
      setType(c.type);
      setTypeEfm(c.type_efm ?? "local");
      setFormat(c.format);
      setDatePrevue(c.date_prevue ?? "");
      setQuestions(
        c.questions.map((q: Question) => ({
          id: q.id,
          type: q.type ?? "ouverte",
          enonce: q.enonce ?? "",
          bareme: Number(q.bareme) || 0,
          options: Array.isArray(q.options) ? q.options : [],
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
    setType("CC");
    setTypeEfm("local");
    setFormat("theorique");
    setDatePrevue("");
    setQuestions([]);
    setNotice(null);
  }

  /**
   * `raffiner` renvoie le contrôle affiché au modèle avec la consigne du
   * formateur, au lieu d'en générer un neuf : c'est ce qui permet de corriger
   * une génération par une phrase plutôt qu'à la main.
   */
  async function handleGenerate(raffiner = false) {
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
          // La nature du contrôle gouverne la génération : sans elle, le
          // sélecteur « Théorique / Pratique » ne serait qu'une étiquette.
          format,
          type,
          ...(raffiner
            ? {
                instruction: instruction.trim(),
                controleExistant: {
                  titre,
                  consignes,
                  questions: questions.map((q) => ({
                    type: q.type,
                    enonce: q.enonce,
                    bareme: q.bareme,
                    options: q.options,
                    corrige: q.corrige,
                  })),
                },
              }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur de génération");

      // Un raffinage retravaille le contrôle ouvert : on ne détache pas
      // l'enregistrement en cours, sinon « Enregistrer » en créerait un second.
      if (!raffiner) setActiveId(null);
      setTitre(data.titre ?? `Contrôle — ${moduleNom}`);
      setConsignes(data.consignes ?? "");
      setDuree(genDuree);
      setStatut("brouillon");
      setQuestions(
        (data.questions ?? []).map((q: Partial<DraftQuestion>) => ({
          id: crypto.randomUUID(),
          type: q.type ?? "ouverte",
          enonce: q.enonce ?? "",
          bareme: Number(q.bareme) || 0,
          options: Array.isArray(q.options) ? q.options : [],
          corrige: q.corrige ?? "",
        })),
      );
      setAvertissements(
        Array.isArray(data.avertissements) ? data.avertissements : [],
      );
      setNotice(
        `Contrôle généré — barème total : ${data.totalBareme ?? "?"} pts (vérifiez qu'il tombe sur 20).`,
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur inattendue", "error");
    } finally {
      setBusy(false);
    }
  }

  function handleSave() {
    if (!titre.trim()) {
      toast("Le titre est requis.", "error");
      return;
    }
    // Le barème hors 20 n'est pas bloquant, mais il demande une confirmation explicite.
    if (totalBareme !== 20) {
      setConfirmBareme(true);
      return;
    }
    void enregistrer();
  }

  async function enregistrer() {
    setConfirmBareme(false);
    setBusy(true);
    try {
      const payload = {
        titre,
        consignes,
        duree_heures: duree,
        type,
        type_efm: type === "EFM" ? typeEfm : null,
        format,
        date_prevue: datePrevue || null,
        questions: questions.map((q) => ({
          type: q.type,
          enonce: q.enonce,
          bareme: Number(q.bareme) || 0,
          options: q.options,
          corrige: q.corrige || null,
        })),
      };
      if (activeId) {
        await updateControle(activeId, moduleId, payload);
      } else {
        const id = await saveControle(groupeId, moduleId, payload);
        setActiveId(id);
      }
      setNotice("Contrôle enregistré (brouillon).");
      toast("Contrôle enregistré");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur inattendue", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleValidate() {
    if (!activeId) {
      toast("Enregistrez d'abord le contrôle avant de le valider.", "error");
      return;
    }
    if (totalBareme !== 20) {
      toast(
        `Le barème doit totaliser 20 points (actuellement : ${totalBareme}).`,
        "error",
      );
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
      toast(err instanceof Error ? err.message : "Erreur inattendue", "error");
    } finally {
      setBusy(false);
    }
  }

  async function supprimer() {
    if (!activeId) return;
    setBusy(true);
    try {
      await deleteControle(activeId, moduleId);
      setConfirmSuppression(false);
      handleNew();
      toast("Contrôle supprimé");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur inattendue", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleCopyLink() {
    if (!tokenPublic) {
      toast("Enregistrez d'abord le contrôle pour générer son lien.", "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/public/controle/${tokenPublic}`,
      );
      toast("Lien de passage copié");
    } catch {
      toast("Impossible de copier le lien.", "error");
    }
  }

  function handleDownloadPdf() {
    setBusy(true);
    try {
      telechargerControlePdf(
        {
          titre: titre || "Contrôle",
          moduleNom,
          moduleCode,
          groupeNom,
          type,
          typeEfm: type === "EFM" ? typeEfm : null,
          format,
          dureeHeures: duree,
          datePrevue: datePrevue || null,
          consignes,
          questions: questions.map((q) => ({
            type: q.type,
            enonce: q.enonce,
            bareme: Number(q.bareme) || 0,
            options: q.options,
          })),
        },
        `controle-${slugify(`${moduleCode ?? ""} ${groupeNom} ${moduleNom}`, "controle")}.pdf`,
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
        <Button
          variant="secondary"
          size="sm"
          icon={Sparkles}
          onClick={() => handleGenerate(false)}
          loading={busy}
          loadingLabel="Génération…"
        >
          Générer un contrôle
        </Button>
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

      {avertissements.length > 0 ? (
        <div className="mt-4 rounded-xl border border-info/30 bg-info/10 px-4 py-3">
          <p className="text-sm font-medium text-ink">
            À vérifier avant validation
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-ink">
            {avertissements.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      ) : null}

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

          <div className="max-w-[640px] rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4">
            <h2 className="text-sm font-medium text-ink">Nature du contrôle</h2>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="type" className="block text-xs text-slate">
                  Type
                </label>
                <select
                  id="type"
                  value={type}
                  onChange={(e) => setType(e.target.value as TypeControle)}
                  className={`${inputClass} mt-1`}
                >
                  <option value="CC">Contrôle continu (CC)</option>
                  <option value="EFM">Épreuve de fin de module (EFM)</option>
                </select>
              </div>

              {type === "EFM" ? (
                <div>
                  <label htmlFor="typeEfm" className="block text-xs text-slate">
                    Portée de l&apos;EFM
                  </label>
                  <select
                    id="typeEfm"
                    value={typeEfm}
                    onChange={(e) => setTypeEfm(e.target.value as TypeEfm)}
                    className={`${inputClass} mt-1`}
                  >
                    <option value="local">Local (date estimable)</option>
                    <option value="regional">Régional (date imposée)</option>
                  </select>
                </div>
              ) : null}

              <div>
                <label htmlFor="format" className="block text-xs text-slate">
                  Format
                </label>
                <select
                  id="format"
                  value={format}
                  onChange={(e) => setFormat(e.target.value as FormatControle)}
                  className={`${inputClass} mt-1`}
                >
                  <option value="theorique">Théorique</option>
                  <option value="pratique">Pratique</option>
                  <option value="mixte">Théorique et pratique</option>
                </select>
              </div>

              <div>
                <label htmlFor="datePrevue" className="block text-xs text-slate">
                  Date prévue
                </label>
                <input
                  id="datePrevue"
                  type="date"
                  value={datePrevue}
                  onChange={(e) => setDatePrevue(e.target.value)}
                  className={`${inputClass} mt-1`}
                />
              </div>
            </div>
            {type === "EFM" && typeEfm === "regional" ? (
              <p className="mt-3 text-xs text-slate">
                La date d&apos;un EFM régional est fixée par la Direction
                Régionale : elle se saisit ici, elle ne peut pas être estimée.
              </p>
            ) : null}
          </div>

          {questions.length > 0 ? (
            <div className="mb-4 rounded-xl border border-border bg-surface p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
              <h2 className="text-sm font-medium text-ink">
                Retravailler ce contrôle
              </h2>
              <p className="mt-1 text-xs text-slate">
                Décrivez ce qui ne va pas plutôt que de corriger à la main. Le
                contrôle affiché est renvoyé au modèle avec votre consigne.
              </p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && instruction.trim() && !busy) {
                      handleGenerate(true);
                    }
                  }}
                  placeholder="Ex. : remplace les deux derniers exercices par des QCM, et simplifie la question 3"
                  aria-label="Consigne de raffinage"
                  className={inputClass}
                />
                <Button
                  variant="secondary"
                  icon={Wand2}
                  onClick={() => handleGenerate(true)}
                  loading={busy}
                  loadingLabel="En cours…"
                  disabled={!instruction.trim()}
                  className="shrink-0"
                >
                  Appliquer
                </Button>
              </div>
            </div>
          ) : null}

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
                <Button
                  icon={Sparkles}
                  onClick={() => handleGenerate(false)}
                  loading={busy}
                  loadingLabel="Génération…"
                  className="mt-5"
                >
                  Générer un contrôle
                </Button>
              </div>
            ) : (
              <div className="mt-3 space-y-4">
                {questions.map((q, i) => (
                  <div
                    key={q.id}
                    className="rounded-lg border border-border p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate">
                        Question {i + 1}
                      </span>
                      <div className="flex items-center gap-2">
                        <select
                          aria-label={`Type de la question ${i + 1}`}
                          value={q.type}
                          onChange={(e) => {
                            const type = e.target.value as TypeQuestion;
                            updateQuestion(q.id, {
                              type,
                              options:
                                type === "qcm" && q.options.length === 0
                                  ? [optionVide(), optionVide(), optionVide()]
                                  : q.options,
                            });
                          }}
                          className={`${inputClass} w-44 py-1 text-xs`}
                        >
                          {(
                            Object.keys(LIBELLE_QUESTION) as TypeQuestion[]
                          ).map((t) => (
                            <option key={t} value={t}>
                              {LIBELLE_QUESTION[t]}
                            </option>
                          ))}
                        </select>
                        <Button
                          variant="danger"
                          size="sm"
                          icon={Trash2}
                          onClick={() => removeQuestion(q.id)}
                        >
                          Supprimer
                        </Button>
                      </div>
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
                    <div className="mt-2 w-32">
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

                    {q.type === "qcm" ? (
                      <div className="mt-3">
                        <p className="text-xs text-slate">
                          Propositions — cochez celles qui sont correctes
                        </p>
                        <ul className="mt-2 space-y-2">
                          {q.options.map((opt, j) => (
                            <li key={j} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                aria-label={`Proposition ${j + 1} correcte`}
                                checked={opt.correcte}
                                onChange={(e) =>
                                  updateQuestion(q.id, {
                                    options: q.options.map((o, k) =>
                                      k === j
                                        ? { ...o, correcte: e.target.checked }
                                        : o,
                                    ),
                                  })
                                }
                                className="h-4 w-4 shrink-0 accent-forest"
                              />
                              <input
                                value={opt.texte}
                                aria-label={`Texte de la proposition ${j + 1}`}
                                placeholder={`Proposition ${j + 1}`}
                                onChange={(e) =>
                                  updateQuestion(q.id, {
                                    options: q.options.map((o, k) =>
                                      k === j
                                        ? { ...o, texte: e.target.value }
                                        : o,
                                    ),
                                  })
                                }
                                className={inputClass}
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                icon={Trash2}
                                aria-label={`Supprimer la proposition ${j + 1}`}
                                onClick={() =>
                                  updateQuestion(q.id, {
                                    options: q.options.filter((_, k) => k !== j),
                                  })
                                }
                              >
                                {""}
                              </Button>
                            </li>
                          ))}
                        </ul>
                        {q.options.length < 2 ? (
                          <p className="mt-2 text-xs text-danger">
                            Un QCM demande au moins deux propositions.
                          </p>
                        ) : !q.options.some((o) => o.correcte) ? (
                          <p className="mt-2 text-xs text-danger">
                            Aucune proposition n&apos;est marquée correcte.
                          </p>
                        ) : null}
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={Plus}
                          className="mt-2"
                          onClick={() =>
                            updateQuestion(q.id, {
                              options: [...q.options, optionVide()],
                            })
                          }
                        >
                          Ajouter une proposition
                        </Button>
                      </div>
                    ) : (
                      <div className="mt-2">
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
                    )}
                  </div>
                ))}
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Plus}
                  onClick={() => setQuestions((prev) => [...prev, newQuestion()])}
                  className="mt-4"
                >
                  Ajouter une question
                </Button>
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4">
            <h2 className="text-sm font-medium text-ink">Actions</h2>
            <div className="mt-3 flex flex-col gap-2">
              <Button icon={Save} onClick={handleSave} disabled={busy || loading}>
                Enregistrer
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={BadgeCheck}
                onClick={handleValidate}
                disabled={busy || statut === "valide"}
              >
                {statut === "valide" ? "Validé" : "Valider le contrôle"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={Download}
                onClick={handleDownloadPdf}
                disabled={busy || questions.length === 0}
              >
                Exporter en PDF
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={LinkIcon}
                onClick={handleCopyLink}
                disabled={!tokenPublic}
              >
                Copier le lien de passage
              </Button>
              <Button
                variant="danger"
                size="sm"
                icon={Trash2}
                onClick={() => setConfirmSuppression(true)}
                disabled={!activeId}
              >
                Supprimer
              </Button>
              <Link
                href={`/modules/${moduleId}/controle/correction?groupe=${groupeId}`}
                className={btnGhostLink}
              >
                <Wand2 size={16} aria-hidden />
                Assistant de correction
              </Link>
              <Link
                href={`/modules/${moduleId}/controle/historique?groupe=${groupeId}`}
                className={btnGhostLink}
              >
                <History size={16} aria-hidden />
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

      <ConfirmModal
        open={confirmBareme}
        onClose={() => setConfirmBareme(false)}
        onConfirm={() => void enregistrer()}
        busy={busy}
        title="Barème hors 20 points"
        message={`Le barème total est de ${totalBareme} points (attendu : 20). Enregistrer quand même ?`}
        confirmLabel="Enregistrer quand même"
      />

      <ConfirmModal
        open={confirmSuppression}
        onClose={() => setConfirmSuppression(false)}
        onConfirm={() => void supprimer()}
        busy={busy}
        title="Supprimer ce contrôle ?"
        message="Supprimer définitivement ce contrôle, ses questions et son corrigé ? Cette action est irréversible."
      />
    </div>
  );
}
