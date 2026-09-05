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
  type Difficulte,
} from "@/app/actions/controles";
import CopiesManager from "./CopiesManager";
import ContenuCouvert from "./ContenuCouvert";
import { Stepper, NavigationEtapes, ETAPES } from "./Stepper";
import CarteChoix, { type Choix } from "./CarteChoix";
import Segments from "@/components/ui/Segments";
import { useToast } from "@/components/ui/Toast";
import BandeauIa from "@/components/BandeauIa";
import Breadcrumb from "@/components/Breadcrumb";
import Badge from "@/components/ui/Badge";
import Button, { buttonStyles } from "@/components/ui/Button";
import { inputStyles } from "@/components/ui/Input";
import { ConfirmModal } from "@/components/ui/Modal";
import { formatDateJour, slugify } from "@/lib/format";
import { libelleModule } from "@/lib/modules";
import {
  BadgeCheck,
  Download,
  History,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { getEtablissement } from "@/app/actions/etablissement";
import { marqueDe } from "@/lib/pdf-marque";
import { baremeAttendu, socleAccessible } from "@/lib/controles";

type DraftQuestion = {
  id: string;
  type: TypeQuestion;
  enonce: string;
  bareme: number;
  options: OptionQcm[];
  corrige: string;
  /** Place dans la courbe de difficulté (PRD §4.7), null si non calibrée. */
  difficulte: Difficulte;
  /** Pourquoi ce barème correspond à cette difficulté. */
  justification: string;
};

const LIBELLE_QUESTION: Record<TypeQuestion, string> = {
  qcm: "Choix multiple",
  ouverte: "Question ouverte",
  exercice: "Exercice d'application",
};

/** Libellés courts du segmenté de la maquette, où la place est comptée. */
const LIBELLE_COURT: Record<TypeQuestion, string> = {
  qcm: "QCM",
  ouverte: "Ouverte",
  exercice: "Exercice",
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
    // Une question ajoutée à la main n'est pas calibrée : la supposer
    // accessible fausserait le calcul du socle.
    difficulte: null,
    justification: "",
  };
}

function optionVide(): OptionQcm {
  return { texte: "", correcte: false };
}

/**
 * Les trois natures que la maquette présente côte à côte. Le modèle en garde
 * deux champs — `type` et `type_efm` — que ces clés recomposent.
 */
const NATURES: readonly Choix<"cc" | "efml" | "efmr">[] = [
  {
    cle: "cc",
    label: "CC",
    detail: "Contrôle continu interne au module.",
    meta: "Validation formateur",
  },
  {
    cle: "efml",
    label: "EFM local",
    detail: "Évaluation de fin de module, sujet établissement.",
    meta: "Validation chef de pôle",
  },
  {
    cle: "efmr",
    label: "EFM régional",
    detail: "Sujet régional harmonisé entre établissements.",
    meta: "Date imposée par la DR",
  },
];

const FORMATS: readonly Choix<FormatControle>[] = [
  {
    cle: "theorique",
    label: "Théorique",
    detail: "Questions de cours et raisonnement écrit.",
    meta: "Salle de cours",
  },
  {
    cle: "pratique",
    label: "Pratique",
    detail: "Manipulation sur poste, livrable évalué.",
    meta: "Salle informatique",
  },
  {
    cle: "mixte",
    label: "Mixte",
    detail: "Partie écrite puis mise en œuvre sur machine.",
    meta: "Salle informatique",
  },
];

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
  const [titre, setTitre] = useState("");
  const [consignes, setConsignes] = useState("");
  const [duree, setDuree] = useState(1);
  const [statut, setStatut] = useState<"brouillon" | "valide">("brouillon");
  const [type, setType] = useState<TypeControle>("CC");
  const [typeEfm, setTypeEfm] = useState<TypeEfm>("local");
  const [format, setFormat] = useState<FormatControle>("theorique");
  const [datePrevue, setDatePrevue] = useState("");
  const [questions, ecrireQuestions] = useState<DraftQuestion[]>([]);
  // Vrai tant que le sujet sort du modèle sans que le formateur y ait touché.
  const [issuDuModele, setIssuDuModele] = useState(false);

  // Toute modification vaut relecture : le bandeau tombe à la première retouche
  // d'un énoncé, d'un barème ou d'un corrigé.
  const setQuestions: typeof ecrireQuestions = (v) => {
    setIssuDuModele(false);
    ecrireQuestions(v);
  };
  const [genDuree, setGenDuree] = useState(2);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<"editeur" | "copies">("editeur");
  const [confirmBareme, setConfirmBareme] = useState(false);
  const [avertissements, setAvertissements] = useState<string[]>([]);
  const [instruction, setInstruction] = useState("");
  // Préparer un contrôle se fait en quatre temps : voir ce qui est couvert,
  // choisir la nature, produire les questions, relire.
  const [etape, setEtape] = useState(1);
  // Séances retenues à l'étape 1, transmises au générateur.
  const [seancesRetenues, setSeancesRetenues] = useState<string[]>([]);

  // Une seule clé pour les trois cartes de nature, recomposée depuis les deux
  // champs que le modèle enregistre.
  const natureCle: "cc" | "efml" | "efmr" =
    type === "CC" ? "cc" : typeEfm === "regional" ? "efmr" : "efml";

  function changerNature(cle: "cc" | "efml" | "efmr") {
    if (cle === "cc") {
      setType("CC");
      return;
    }
    setType("EFM");
    setTypeEfm(cle === "efmr" ? "regional" : "local");
  }
  const [confirmSuppression, setConfirmSuppression] = useState(false);
  const toast = useToast();

  // PRD §4.7 : 20 points pour un contrôle continu, 40 pour une épreuve de fin
  // de module. Le seuil suit donc le type choisi, il n'est plus constant.
  const totalAttendu = baremeAttendu(type);
  // §4.7 : 60 % du total doivent porter sur des questions accessibles — le
  // socle que toute la classe doit pouvoir atteindre. Les 40 % restants
  // distinguent les meilleurs, ils ne servent pas à faire échouer la majorité.
  const socleAttendu = socleAccessible(type);
  const pointsAccessibles = questions
    .filter((q) => q.difficulte === "accessible")
    .reduce((t, q) => t + (Number(q.bareme) || 0), 0);
  const pointsDiscriminants = questions
    .filter((q) => q.difficulte === "discriminant")
    .reduce((t, q) => t + (Number(q.bareme) || 0), 0);
  const questionsNonCalibrees = questions.filter((q) => q.difficulte === null).length;
  const totalBareme = questions.reduce(
    (s, q) => s + (Number(q.bareme) || 0),
    0,
  );

  async function loadControle(id: string) {
    setLoading(true);
    try {
      const c = await getControle(id);
      if (!c) return;
      setTitre(c.titre ?? "");
      setConsignes(c.consignes ?? "");
      setDuree(Number(c.duree_heures) || 1);
      setStatut(c.statut);
      setType(c.type);
      setTypeEfm(c.type_efm ?? "local");
      setFormat(c.format);
      setDatePrevue(c.date_prevue ?? "");
      ecrireQuestions(
        c.questions.map((q: Question) => ({
          id: q.id,
          type: q.type ?? "ouverte",
          enonce: q.enonce ?? "",
          bareme: Number(q.bareme) || 0,
          options: Array.isArray(q.options) ? q.options : [],
          corrige: q.corrige ?? "",
          difficulte: q.difficulte ?? null,
          justification: q.justification_bareme ?? "",
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
          seanceIds: seancesRetenues,
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
                    difficulte: q.difficulte,
                    justification_bareme: q.justification || null,
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
      ecrireQuestions(
        (
          data.questions ?? []
        ).map(
          (q: Partial<DraftQuestion> & { justification_bareme?: string | null }) => ({
            id: crypto.randomUUID(),
            type: q.type ?? "ouverte",
            enonce: q.enonce ?? "",
            bareme: Number(q.bareme) || 0,
            options: Array.isArray(q.options) ? q.options : [],
            corrige: q.corrige ?? "",
            difficulte: q.difficulte ?? null,
            justification: q.justification_bareme ?? "",
          }),
        ),
      );
      setIssuDuModele(true);
      setAvertissements(
        Array.isArray(data.avertissements) ? data.avertissements : [],
      );
      setNotice(
        `Contrôle généré — barème total : ${data.totalBareme ?? "?"} pts (vérifiez qu'il tombe sur ${totalAttendu}).`,
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
    // Un barème hors du total attendu n'est pas bloquant, mais il demande une
    // confirmation explicite.
    if (totalBareme !== totalAttendu) {
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
          difficulte: q.difficulte,
          justification_bareme: q.justification || null,
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
    if (totalBareme !== totalAttendu) {
      toast(
        `Le barème doit totaliser ${totalAttendu} points (actuellement : ${totalBareme}).`,
        "error",
      );
      return;
    }
    setBusy(true);
    try {
      await setControleStatut(activeId, moduleId, "valide");
      // Valider, c'est assumer le contenu : le bandeau n'a plus lieu d'être.
      setIssuDuModele(false);
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


  async function handleDownloadPdf() {
    setBusy(true);
    try {
      const [{ telechargerControlePdf }, marque] = await Promise.all([
        import("@/lib/pdf-controle"),
        getEtablissement(),
      ]);
      await telechargerControlePdf(
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
        marqueDe(marque),
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
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, ...patch } : q)),
    );
  }

  function removeQuestion(id: string) {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  }

  return (
    <div className="p-8">
      <Breadcrumb
        items={[
          { label: "Modules", href: "/modules" },
          { label: libelleModule(moduleCode, moduleNom), href: `/modules/${moduleId}` },
          { label: "Contrôle" },
        ]}
      />

      <header className="mt-6 flex flex-col gap-2">
        <span className="font-mono text-[11.5px] uppercase tracking-[0.12em] text-slate-light">
          Étape {etape} sur {ETAPES.length} · {ETAPES[etape - 1]?.libelle}
        </span>
        <h1 className="font-display text-[29px] font-bold leading-tight tracking-[-0.02em] text-ink">
          {titre.trim() || `Contrôle — ${moduleNom}`}
        </h1>
        <p className="text-base text-slate-2">
          {[
            groupeNom,
            NATURES.find((n) => n.cle === natureCle)?.label,
            datePrevue ? `session du ${formatDateJour(datePrevue)}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </header>

      <div className="mt-6 flex flex-wrap items-end gap-4 rounded-[14px] border border-border bg-surface p-[18px] shadow-repos">
        <div>
          <label
            htmlFor="genDuree"
            className="block text-sm font-medium text-ink"
          >
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

      {issuDuModele ? (
        <div className="mt-4">
          <BandeauIa
            variante="engageant"
            meta={`Claude · ${questions.length} question${questions.length > 1 ? "s" : ""}`}
            onRelu={() => setIssuDuModele(false)}
          >
            Sujet et corrigé générés par l&apos;IA — relisez-les avant de
            valider le contrôle.
          </BandeauIa>
        </div>
      ) : null}

      {avertissements.length > 0 ? (
        <div className="mt-4 rounded-xl border border-tint-teal-strong bg-tint-teal px-4 py-3">
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
        <p className="mt-4 rounded-xl border border-tint-green bg-success-wash px-3 py-2 text-sm text-green-dark">
          {notice}
        </p>
      ) : null}

      <div className="mt-6 max-w-[320px]">
        <Segments
          valeur={tab}
          ariaLabel="Vue du contrôle"
          onChange={setTab}
          options={[
            { valeur: "editeur" as const, libelle: "Éditeur" },
            { valeur: "copies" as const, libelle: "Copies" },
          ]}
        />
      </div>

      {tab === "copies" ? (
        activeId ? (
          <div className="mt-6">
            <CopiesManager
              controleId={activeId}
              controleTitre={titre}
              moduleNom={moduleNom}
              moduleId={moduleId}
              groupeId={groupeId ?? ""}
              totalAttendu={totalAttendu}
            />
          </div>
        ) : (
          <p className="mt-6 rounded-[14px] border border-border bg-surface shadow-repos p-4 text-sm text-slate">
            Enregistrez d&apos;abord un contrôle pour consulter ses copies.
          </p>
        )
      ) : (
        <div className="mt-6">
          <Stepper etape={etape} onAller={setEtape} />

          {etape === 1 ? (
            <div className="max-w-[760px]">
              <ContenuCouvert
                groupeId={groupeId ?? null}
                moduleId={moduleId}
                type={type}
                onSelection={setSeancesRetenues}
              />
            </div>
          ) : etape === 2 ? (
            <div className="flex max-w-[880px] flex-col gap-5">
              <CarteChoix
                titre="Nature du contrôle"
                description="Détermine le circuit de validation et l'archivage."
                valeur={natureCle}
                onChange={changerNature}
                choix={NATURES}
              />

              <CarteChoix
                titre="Format d'évaluation"
                description="Oriente la génération des questions à l'étape suivante."
                valeur={format}
                onChange={setFormat}
                choix={FORMATS}
              />

              <section className="flex flex-col gap-[18px] rounded-[14px] border border-border bg-surface p-6 shadow-repos">
                <div className="flex flex-col gap-1">
                  <h2 className="font-display text-[18px] font-semibold text-ink">
                    Session
                  </h2>
                  <p className="text-sm text-slate-light">
                    {natureCle === "efmr"
                      ? "La date d'un EFM régional est fixée par la Direction Régionale : elle se saisit ici, elle ne peut pas être estimée."
                      : "La date à laquelle le groupe passera l'épreuve."}
                  </p>
                </div>
                <label
                  htmlFor="datePrevue"
                  className="flex max-w-[240px] flex-col gap-[7px]"
                >
                  <span className="text-sm font-semibold text-body">
                    Date prévue
                  </span>
                  <input
                    id="datePrevue"
                    type="date"
                    value={datePrevue}
                    onChange={(e) => setDatePrevue(e.target.value)}
                    className={inputClass}
                  />
                </label>
              </section>
            </div>
          ) : etape === 3 ? (
            <div className="space-y-4">
              {questions.length > 0 ? (
                <div className="mb-4 rounded-[14px] border border-border bg-surface p-4 shadow-repos">
                  <h2 className="text-sm font-medium text-ink">
                    Retravailler ce contrôle
                  </h2>
                  <p className="mt-1 text-xs text-slate">
                    Décrivez ce qui ne va pas plutôt que de corriger à la main.
                    Le contrôle affiché est renvoyé au modèle avec votre
                    consigne.
                  </p>
                  <div className="mt-2 flex flex-col gap-2 md:flex-row">
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

              <div className="overflow-hidden rounded-[14px] border border-border bg-surface shadow-repos">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-separator bg-paper-alt px-6 py-[18px]">
                  <h2 className="font-display text-[17px] font-semibold text-ink">
                    Questions{" "}
                    <span className="font-mono text-sm font-medium text-slate-light">
                      {String(questions.length).padStart(2, "0")}
                    </span>
                  </h2>
                  <span className="flex items-center gap-2.5">
                    <span className="text-[13.5px] text-slate-light">
                      Barème
                    </span>
                    <span
                      className={`font-mono text-[15px] font-medium ${
                        totalBareme > totalAttendu
                          ? "text-coral-dark"
                          : totalBareme === totalAttendu
                            ? "text-green-dark"
                            : "text-ink"
                      }`}
                    >
                      {totalBareme}
                    </span>
                    <span className="font-mono text-[13px] text-muted">
                      / {totalAttendu}
                    </span>
                  </span>
                </div>

                {loading ? (
                  <p className="px-6 py-5 text-sm text-slate-light">
                    Chargement du contrôle…
                  </p>
                ) : questions.length === 0 ? (
                  <div className="m-6 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-paper px-6 py-10 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-wash">
                      <svg
                        className="h-6 w-6 text-ink"
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
                      Générez un contrôle avec l&apos;IA, ou composez-le
                      question par question.
                    </p>
                    {/* Sans cette seconde porte, un formateur sans clé de
                        modèle n'avait aucun moyen de composer son contrôle. */}
                    <div className="mt-5 flex flex-wrap justify-center gap-2.5">
                      <Button
                        icon={Sparkles}
                        onClick={() => handleGenerate(false)}
                        loading={busy}
                        loadingLabel="Génération…"
                      >
                        Générer un contrôle
                      </Button>
                      <Button
                        variant="secondary"
                        icon={Plus}
                        onClick={() =>
                          setQuestions((prev) => [...prev, newQuestion()])
                        }
                      >
                        Ajouter une question
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {questions.map((q, i) => (
                      <div
                        key={q.id}
                        className="flex gap-3.5 border-b border-separator px-6 py-[18px] last:border-b-0"
                      >
                        <span
                          aria-hidden
                          className="mt-1 flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] bg-wash font-mono text-xs font-semibold text-slate-2"
                        >
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                          <div className="overflow-hidden rounded-[10px] border border-border-strong bg-surface">
                            <textarea
                              id={`enonce-${q.id}`}
                              rows={2}
                              aria-label={`Énoncé de la question ${i + 1}`}
                              value={q.enonce}
                              placeholder="Énoncé de la question…"
                              onChange={(e) =>
                                updateQuestion(q.id, { enonce: e.target.value })
                              }
                              className="w-full resize-y border-none bg-transparent px-[13px] py-[11px] text-[15px] leading-snug text-body outline-none placeholder:text-slate-light"
                            />
                          </div>

                          <div className="flex flex-wrap items-center gap-2.5">
                            <span
                              role="radiogroup"
                              aria-label={`Type de la question ${i + 1}`}
                              className="flex gap-[3px] rounded-[9px] border border-border bg-wash-strong p-[3px] max-md:w-full"
                            >
                              {(
                                Object.keys(LIBELLE_COURT) as TypeQuestion[]
                              ).map((tq) => {
                                const actif = q.type === tq;
                                return (
                                  <button
                                    key={tq}
                                    type="button"
                                    role="radio"
                                    aria-checked={actif}
                                    onClick={() =>
                                      updateQuestion(q.id, {
                                        type: tq,
                                        options:
                                          tq === "qcm" &&
                                          q.options.length === 0
                                            ? [
                                                optionVide(),
                                                optionVide(),
                                                optionVide(),
                                              ]
                                            : q.options,
                                      })
                                    }
                                    className={`rounded-lg px-[11px] py-1.5 text-[13px] font-semibold transition-colors duration-150 ease-out max-md:min-h-11 max-md:grow ${
                                      actif
                                        ? "bg-surface text-ink shadow-[0_1px_2px_rgba(46,59,78,0.12)]"
                                        : "text-slate-2 hover:text-ink"
                                    }`}
                                  >
                                    {LIBELLE_COURT[tq]}
                                  </button>
                                );
                              })}
                            </span>

                            <label
                              htmlFor={`bareme-${q.id}`}
                              className="ml-auto flex items-center gap-2"
                            >
                              <span className="text-[13px] text-slate-2">
                                Barème
                              </span>
                              <span className="flex items-stretch overflow-hidden rounded-lg border border-border-strong bg-surface max-md:min-h-11">
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
                                  className="w-14 border-none bg-transparent px-2 py-[7px] text-right font-mono text-sm text-ink outline-none"
                                />
                                <span className="flex items-center border-l border-border px-[9px] font-mono text-[12.5px] text-slate-light">
                                  pts
                                </span>
                              </span>
                            </label>

                            <button
                              type="button"
                              aria-label={`Supprimer la question ${i + 1}`}
                              onClick={() => removeQuestion(q.id)}
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-transparent text-coral-dark transition-colors duration-150 ease-out hover:border-tint-alert-strong hover:bg-alert-wash max-md:h-11 max-md:w-11"
                            >
                              <Trash2 size={15} aria-hidden />
                            </button>
                          </div>

                          {/* §4.7 : le barème suit la difficulté, et la
                              raison de ce choix se relit — c'est elle qui
                              permet de contester un chiffre plutôt que de le
                              subir. */}
                          <div className="flex flex-wrap items-center gap-2.5">
                            <span className="flex gap-1 rounded-[9px] border border-border bg-wash-strong p-1 max-md:w-full">
                              {(
                                [
                                  ["accessible", "Accessible"],
                                  ["discriminant", "Discriminant"],
                                ] as const
                              ).map(([niveau, libelle]) => {
                                const actif = q.difficulte === niveau;
                                return (
                                  <button
                                    key={niveau}
                                    type="button"
                                    role="radio"
                                    aria-checked={actif}
                                    onClick={() =>
                                      updateQuestion(q.id, {
                                        difficulte: actif ? null : niveau,
                                      })
                                    }
                                    className={`rounded-[7px] px-2.5 py-1 text-[12.5px] font-semibold transition-colors duration-150 ease-out max-md:min-h-11 max-md:grow ${
                                      actif
                                        ? "bg-surface text-ink shadow-[0_1px_2px_rgba(46,59,78,0.12)]"
                                        : "text-slate-light hover:text-ink"
                                    }`}
                                  >
                                    {libelle}
                                  </button>
                                );
                              })}
                            </span>

                            <input
                              value={q.justification}
                              onChange={(e) =>
                                updateQuestion(q.id, {
                                  justification: e.target.value,
                                })
                              }
                              placeholder="Pourquoi ce barème pour cette difficulté…"
                              aria-label={`Justification du barème de la question ${i + 1}`}
                              className="min-w-[220px] flex-1 rounded-[9px] border border-border bg-surface px-3 py-[7px] text-[13.5px] text-body outline-none transition-colors duration-150 ease-out placeholder:text-slate-light focus:border-teal focus:shadow-[0_0_0_3px_rgba(46,125,158,0.15)] max-md:min-h-11"
                            />
                          </div>

                        {q.type === "qcm" ? (
                          <div className="mt-3">
                            <p className="text-xs text-slate">
                              Propositions — cochez celles qui sont correctes
                            </p>
                            <ul className="mt-2 space-y-2">
                              {q.options.map((opt, j) => (
                                <li
                                  key={j}
                                  /* `max-md:flex-wrap` et non `flex-wrap` :
                                     `inputStyles` porte déjà `w-full`, qui
                                     sur une ligne qui s'enroule prend la
                                     largeur entière et renvoie les deux
                                     autres contrôles à la ligne — y compris
                                     sur bureau, où ils restent alignés. */
                                  className="flex items-center gap-2 max-md:flex-wrap"
                                >
                                  {/* La case garde ses 16px — c'est sa taille
                                      native, et l'étirer donnerait un
                                      rectangle. C'est son label qui porte les
                                      44px de zone tactile (§3bis) et qui lui
                                      transmet le clic.

                                      Le mot « Correcte » n'apparaît que sous
                                      768px : détachée du champ, la case ne
                                      dirait plus ce qu'elle coche. */}
                                  <label className="flex shrink-0 cursor-pointer items-center gap-2 max-md:order-2 max-md:h-11">
                                    <input
                                      type="checkbox"
                                      aria-label={`Proposition ${j + 1} correcte`}
                                      checked={opt.correcte}
                                      onChange={(e) =>
                                        updateQuestion(q.id, {
                                          options: q.options.map((o, k) =>
                                            k === j
                                              ? {
                                                  ...o,
                                                  correcte: e.target.checked,
                                                }
                                              : o,
                                          ),
                                        })
                                      }
                                      className="h-4 w-4 shrink-0 accent-ink"
                                    />
                                    <span className="text-[13px] text-slate-2 md:sr-only">
                                      Correcte
                                    </span>
                                  </label>
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
                                    className={`${inputClass} max-md:order-1 max-md:mt-0`}
                                  />
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    icon={Trash2}
                                    className="max-md:order-3 max-md:ml-auto"
                                    aria-label={`Supprimer la proposition ${j + 1}`}
                                    onClick={() =>
                                      updateQuestion(q.id, {
                                        options: q.options.filter(
                                          (_, k) => k !== j,
                                        ),
                                      })
                                    }
                                  >
                                    {""}
                                  </Button>
                                </li>
                              ))}
                            </ul>
                            {q.options.length < 2 ? (
                              <p className="mt-2 text-xs text-coral-dark">
                                Un QCM demande au moins deux propositions.
                              </p>
                            ) : !q.options.some((o) => o.correcte) ? (
                              <p className="mt-2 text-xs text-coral-dark">
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
                                updateQuestion(q.id, {
                                  corrige: e.target.value,
                                })
                              }
                              className={`${inputClass} mt-1`}
                            />
                          </div>
                        )}
                        </div>
                      </div>
                    ))}
                    <div className="flex flex-wrap items-center gap-3 bg-paper-alt px-6 py-4">
                      <Button
                        variant="secondary"
                        icon={Plus}
                        onClick={() =>
                          setQuestions((prev) => [...prev, newQuestion()])
                        }
                      >
                        Ajouter une question
                      </Button>
                      <span
                        className={`text-[13.5px] ${
                          totalBareme === totalAttendu
                            ? "text-green-dark"
                            : totalBareme > totalAttendu
                              ? "text-coral-dark"
                              : "text-slate-light"
                        }`}
                      >
                        {totalBareme === totalAttendu
                          ? "Barème complet."
                          : totalBareme > totalAttendu
                            ? `Barème supérieur à ${totalAttendu} points.`
                            : `Il reste ${totalAttendu - totalBareme} points à répartir.`}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
              <div className="space-y-4">
                <section className="flex flex-col gap-[22px] rounded-[14px] border border-border bg-surface p-[26px] shadow-repos">
                  <div className="flex flex-wrap items-start justify-between gap-6">
                    <div className="flex flex-col gap-1">
                      <h2 className="font-display text-[18px] font-semibold text-ink">
                        Relecture finale
                      </h2>
                      <p className="text-sm text-slate-light">
                        Vérifiez la cohérence du barème avant validation.
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-slate-light">
                        Barème total
                      </span>
                      <span
                        className={`font-display text-[40px] font-bold leading-none tracking-[-0.03em] ${
                          totalBareme > totalAttendu
                            ? "text-coral-dark"
                            : totalBareme === totalAttendu
                              ? "text-green-dark"
                              : "text-ink"
                        }`}
                      >
                        {totalBareme}
                      </span>
                      <span className="font-mono text-[13px] text-slate-light">
                        sur {totalAttendu} points
                      </span>
                    </div>
                  </div>

                  {/* §4.7 : la courbe de difficulté. Un contrôle bien conçu
                      laisse toute la classe atteindre le socle, et réserve une
                      minorité de points aux questions qui distinguent les
                      meilleurs — jamais l'inverse. */}
                  <div className="flex flex-col gap-2.5 border-t border-separator pt-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-slate-light">
                        Courbe de difficulté
                      </span>
                      <span className="font-mono text-[13px] text-slate-2">
                        socle attendu {socleAttendu} pts · 60 %
                      </span>
                    </div>

                    <div className="flex h-2.5 overflow-hidden rounded-full bg-wash">
                      <span
                        className="bg-green"
                        style={{
                          width: `${totalBareme ? (pointsAccessibles / totalBareme) * 100 : 0}%`,
                        }}
                      />
                      <span
                        className="bg-teal"
                        style={{
                          width: `${totalBareme ? (pointsDiscriminants / totalBareme) * 100 : 0}%`,
                        }}
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13.5px]">
                      <span className="flex items-center gap-2 text-slate-2">
                        <span aria-hidden className="h-2 w-2 rounded-full bg-green" />
                        Accessible{" "}
                        <span className="font-mono text-ink">
                          {pointsAccessibles} pts
                        </span>
                      </span>
                      <span className="flex items-center gap-2 text-slate-2">
                        <span aria-hidden className="h-2 w-2 rounded-full bg-teal" />
                        Discriminant{" "}
                        <span className="font-mono text-ink">
                          {pointsDiscriminants} pts
                        </span>
                      </span>
                      {questionsNonCalibrees > 0 ? (
                        <span className="flex items-center gap-2 text-slate-light">
                          <span
                            aria-hidden
                            className="h-2 w-2 rounded-full bg-border-strong"
                          />
                          {questionsNonCalibrees} question
                          {questionsNonCalibrees > 1 ? "s" : ""} à classer
                        </span>
                      ) : null}
                    </div>

                    <p className="text-[13.5px] text-slate-light">
                      {questionsNonCalibrees === questions.length
                        ? "Aucune question n'est classée : la courbe se calibre à la génération, ou à la main sur chaque question."
                        : Math.abs(pointsAccessibles - socleAttendu) <= totalAttendu * 0.1
                          ? `Répartition conforme : toute la classe peut viser ${socleAttendu} points.`
                          : pointsAccessibles < socleAttendu
                            ? `Socle trop mince — ${pointsAccessibles} points accessibles au lieu de ${socleAttendu}. Une partie de la classe n'atteindra pas la moyenne.`
                            : `Socle trop large — ${pointsAccessibles} points accessibles au lieu de ${socleAttendu}. Le contrôle distinguera mal les meilleurs.`}
                    </p>
                  </div>

                  <dl className="grid gap-4 border-t border-separator pt-5 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
                    {[
                      {
                        cle: "Nature",
                        valeur:
                          NATURES.find((n) => n.cle === natureCle)?.label ??
                          "—",
                        mono: false,
                      },
                      {
                        cle: "Format",
                        valeur:
                          FORMATS.find((f) => f.cle === format)?.label ?? "—",
                        mono: false,
                      },
                      {
                        cle: "Questions",
                        valeur: String(questions.length).padStart(2, "0"),
                        mono: true,
                      },
                      {
                        cle: "Contenu couvert",
                        valeur: `${seancesRetenues.length} séances`,
                        mono: true,
                      },
                    ].map((c) => (
                      <div key={c.cle} className="flex flex-col gap-[5px]">
                        <dt className="text-[13px] text-slate-light">
                          {c.cle}
                        </dt>
                        <dd
                          className={`text-[15px] font-semibold text-ink ${
                            c.mono ? "font-mono font-medium" : ""
                          }`}
                        >
                          {c.valeur}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  {(() => {
                    const relu = !issuDuModele;
                    const conforme = totalBareme === totalAttendu;
                    const bon = relu && conforme;
                    return (
                      <div
                        className={`flex items-center gap-2.5 rounded-[10px] border px-3.5 py-3 ${
                          bon
                            ? "border-tint-green bg-success-wash"
                            : "border-tint-alert-strong bg-alert-wash"
                        }`}
                      >
                        <span
                          aria-hidden
                          className={`h-[7px] w-[7px] shrink-0 rounded-full ${
                            bon ? "bg-green" : "bg-coral"
                          }`}
                        />
                        <span
                          className={`text-[13.5px] leading-snug ${
                            bon ? "text-green-dark" : "text-coral-dark"
                          }`}
                        >
                          {!relu
                            ? "Les questions générées par l'IA n'ont pas encore été marquées comme relues."
                            : conforme
                              ? "Contenu relu et barème conforme — prêt pour validation."
                              : `Contenu relu, mais le barème totalise ${totalBareme} points au lieu de ${totalAttendu}.`}
                        </span>
                      </div>
                    );
                  })()}
                </section>
                <div className="max-w-[640px] rounded-[14px] border border-border bg-surface shadow-repos p-4">
                  <label
                    htmlFor="titre"
                    className="block text-sm font-medium text-ink"
                  >
                    Titre
                  </label>
                  <input
                    id="titre"
                    value={titre}
                    onChange={(e) => setTitre(e.target.value)}
                    className={`${inputClass} mt-1`}
                  />
                </div>
                <div className="max-w-[640px] rounded-[14px] border border-border bg-surface shadow-repos p-4">
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
              </div>
              <aside className="space-y-4">
                <div className="rounded-[14px] border border-border bg-surface shadow-repos p-4">
                  <h2 className="text-sm font-medium text-ink">Actions</h2>
                  <div className="mt-3 flex flex-col gap-2">
                    <Button
                      icon={Save}
                      onClick={handleSave}
                      disabled={busy || loading}
                    >
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

          <NavigationEtapes
            etape={etape}
            onAller={setEtape}
            peutAvancer={etape !== 3 || questions.length > 0}
          />
        </div>
      )}

      <ConfirmModal
        open={confirmBareme}
        onClose={() => setConfirmBareme(false)}
        onConfirm={() => void enregistrer()}
        busy={busy}
        title={`Barème hors ${totalAttendu} points`}
        message={`Le barème total est de ${totalBareme} points (attendu : ${totalAttendu}). Enregistrer quand même ?`}
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
