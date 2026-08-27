"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveFiche } from "@/app/actions/fiches";
import { useToast } from "@/components/ui/Toast";
import Button from "@/components/ui/Button";
import { inputStyles as inputClass } from "@/components/ui/Input";
import { slugify } from "@/lib/format";
import { Download, Plus, Save, Sparkles, Trash2 } from "lucide-react";

export type Bloc = { contenu: string; minutes: number };
export type LigneDev = { strategie: string; contenu: string; minutes: number };

export type Fiche = {
  nature: string;
  objectifs: string;
  modalite: string;
  fichiers: string;
  motivation: Bloc;
  plan: Bloc;
  developpement: LigneDev[];
  evaluation: Bloc;
  prochaine: Bloc;
};

export function ficheVide(): Fiche {
  return {
    nature: "cours théorique",
    objectifs: "",
    modalite: "Synchrone présentiel",
    fichiers: "-",
    motivation: { contenu: "", minutes: 10 },
    plan: { contenu: "", minutes: 5 },
    developpement: [],
    evaluation: { contenu: "", minutes: 10 },
    prochaine: { contenu: "", minutes: 5 },
  };
}

/**
 * Une version enregistrée avant la mise au format officiel contient du
 * Markdown libre. On ne la perd pas : son texte atterrit dans le
 * développement, à charge du formateur de le répartir.
 */
export function lireFiche(contenu: string | null): Fiche {
  if (!contenu?.trim()) return ficheVide();
  try {
    const brut = JSON.parse(contenu) as Partial<Fiche>;
    if (!brut || typeof brut !== "object" || !("developpement" in brut)) {
      throw new Error("format inconnu");
    }
    return { ...ficheVide(), ...brut } as Fiche;
  } catch {
    const v = ficheVide();
    v.developpement = [
      { strategie: "À répartir", contenu: contenu.trim(), minutes: 0 },
    ];
    return v;
  }
}

export type ContexteFiche = {
  seanceId: string;
  date: string | null;
  dateFormatee: string | null;
  groupeNom: string;
  filiere: string;
  annee: number | null;
  moduleNom: string;
  minutesSeance: number | null;
};

/**
 * Éditeur de fiche de préparation au format officiel OFPPT.
 *
 * Partagé par la page de séance et la page module : c'est le même document,
 * il n'a pas à exister en deux versions.
 */
export default function FicheSeance({
  contexte,
  initial,
  compact = false,
}: {
  contexte: ContexteFiche;
  initial: string | null;
  /** Masque l'identification, déjà affichée par la page hôte. */
  compact?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [fiche, setFiche] = useState<Fiche>(() => lireFiche(initial));
  const [busy, setBusy] = useState(false);
  const [avertissements, setAvertissements] = useState<string[]>([]);

  const totalMinutes =
    fiche.motivation.minutes +
    fiche.plan.minutes +
    fiche.developpement.reduce((s, l) => s + l.minutes, 0) +
    fiche.evaluation.minutes +
    fiche.prochaine.minutes;

  function majBloc(
    cle: "motivation" | "plan" | "evaluation" | "prochaine",
    v: Partial<Bloc>,
  ) {
    setFiche((f) => ({ ...f, [cle]: { ...f[cle], ...v } }));
  }

  async function generer() {
    setBusy(true);
    try {
      const res = await fetch("/api/generate/fiche-preparation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seanceId: contexte.seanceId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur de génération");
      setFiche({ ...ficheVide(), ...data.fiche });
      setAvertissements(data.avertissements ?? []);
      toast("Fiche générée. Relisez-la avant d'enregistrer.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur inattendue", "error");
    } finally {
      setBusy(false);
    }
  }

  async function enregistrer() {
    if (fiche.developpement.length === 0) {
      toast("Le développement est vide.", "error");
      return;
    }
    setBusy(true);
    try {
      const version = await saveFiche(contexte.seanceId, JSON.stringify(fiche));
      toast(`Version ${version} enregistrée`);
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur inattendue", "error");
    } finally {
      setBusy(false);
    }
  }

  async function exporter() {
    setBusy(true);
    try {
      const { telechargerFichePdf } = await import("@/lib/pdf-fiche");
      await telechargerFichePdf(
        {
          nature: fiche.nature,
          date: contexte.dateFormatee,
          dureeHeures: contexte.minutesSeance ? contexte.minutesSeance / 60 : null,
          filiere: contexte.filiere,
          annee: contexte.annee,
          groupe: contexte.groupeNom,
          module: contexte.moduleNom,
          objectifs: fiche.objectifs,
          modalite: fiche.modalite,
          fichiers: fiche.fichiers,
          motivation: fiche.motivation,
          plan: fiche.plan,
          developpement: fiche.developpement,
          evaluation: fiche.evaluation,
          prochaine: fiche.prochaine,
        },
        `fiche-${slugify(
          [contexte.groupeNom, contexte.date ?? "", fiche.objectifs]
            .filter(Boolean)
            .join(" "),
          "seance",
        )}.pdf`,
      );
    } catch {
      toast("Export PDF impossible.", "error");
    } finally {
      setBusy(false);
    }
  }

  const champBloc = (
    libelle: string,
    cle: "motivation" | "plan" | "evaluation" | "prochaine",
  ) => (
    <div className="grid gap-2 sm:grid-cols-[1fr_110px]">
      <div>
        <label className="block text-xs text-slate">{libelle}</label>
        <textarea
          rows={3}
          value={fiche[cle].contenu}
          onChange={(e) => majBloc(cle, { contenu: e.target.value })}
          className={`${inputClass} mt-1`}
        />
      </div>
      <div>
        <label className="block text-xs text-slate">Durée (min)</label>
        <input
          type="number"
          min={0}
          step={5}
          value={fiche[cle].minutes}
          onChange={(e) => majBloc(cle, { minutes: Number(e.target.value) || 0 })}
          className={`${inputClass} mt-1`}
        />
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          icon={Sparkles}
          onClick={generer}
          loading={busy}
          loadingLabel="Génération…"
        >
          Générer la fiche
        </Button>
        <Button icon={Save} size="sm" onClick={enregistrer} disabled={busy}>
          Enregistrer
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={Download}
          onClick={exporter}
          disabled={busy}
        >
          Format officiel
        </Button>
        <span
          className={`ml-auto text-sm ${
            contexte.minutesSeance && totalMinutes !== contexte.minutesSeance
              ? "text-danger"
              : "text-slate"
          }`}
        >
          {totalMinutes} min
          {contexte.minutesSeance ? ` / ${contexte.minutesSeance} min` : ""}
        </span>
      </div>

      {avertissements.length > 0 ? (
        <ul className="mt-3 list-disc space-y-0.5 rounded-lg bg-info/10 px-5 py-2 text-sm text-ink">
          {avertissements.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      ) : null}

      {!compact ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-xs text-slate">Nature</label>
            <select
              value={fiche.nature}
              onChange={(e) => setFiche((f) => ({ ...f, nature: e.target.value }))}
              className={`${inputClass} mt-1`}
            >
              <option value="cours théorique">cours théorique</option>
              <option value="cours pratique">cours pratique</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate">Modalité</label>
            <input
              value={fiche.modalite}
              onChange={(e) => setFiche((f) => ({ ...f, modalite: e.target.value }))}
              className={`${inputClass} mt-1`}
            />
          </div>
          <div>
            <label className="block text-xs text-slate">Fichiers de travail</label>
            <input
              value={fiche.fichiers}
              onChange={(e) => setFiche((f) => ({ ...f, fichiers: e.target.value }))}
              className={`${inputClass} mt-1`}
            />
          </div>
        </div>
      ) : null}

      <div className="mt-4">
        <label className="block text-xs text-slate">Objectifs de la séance</label>
        <textarea
          rows={2}
          value={fiche.objectifs}
          onChange={(e) => setFiche((f) => ({ ...f, objectifs: e.target.value }))}
          className={`${inputClass} mt-1`}
        />
      </div>

      <h3 className="mt-5 text-sm font-medium text-ink">Introduction</h3>
      <div className="mt-2 space-y-3">
        {champBloc("Éléments de motivation", "motivation")}
        {champBloc("Plan de la séance", "plan")}
      </div>

      <div className="mt-5 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ink">Développement</h3>
        <Button
          variant="secondary"
          size="sm"
          icon={Plus}
          onClick={() =>
            setFiche((f) => ({
              ...f,
              developpement: [
                ...f.developpement,
                { strategie: "", contenu: "", minutes: 0 },
              ],
            }))
          }
        >
          Ajouter une étape
        </Button>
      </div>
      <div className="mt-2 space-y-3">
        {fiche.developpement.map((l, i) => (
          <div key={i} className="rounded-lg border border-border p-3">
            <div className="grid gap-2 sm:grid-cols-[170px_1fr_110px]">
              <div>
                <label className="block text-xs text-slate">Stratégie</label>
                <textarea
                  rows={3}
                  value={l.strategie}
                  onChange={(e) =>
                    setFiche((f) => ({
                      ...f,
                      developpement: f.developpement.map((x, k) =>
                        k === i ? { ...x, strategie: e.target.value } : x,
                      ),
                    }))
                  }
                  className={`${inputClass} mt-1`}
                />
              </div>
              <div>
                <label className="block text-xs text-slate">Contenu</label>
                <textarea
                  rows={3}
                  value={l.contenu}
                  onChange={(e) =>
                    setFiche((f) => ({
                      ...f,
                      developpement: f.developpement.map((x, k) =>
                        k === i ? { ...x, contenu: e.target.value } : x,
                      ),
                    }))
                  }
                  className={`${inputClass} mt-1`}
                />
              </div>
              <div>
                <label className="block text-xs text-slate">Durée (min)</label>
                <input
                  type="number"
                  min={0}
                  step={5}
                  value={l.minutes}
                  onChange={(e) =>
                    setFiche((f) => ({
                      ...f,
                      developpement: f.developpement.map((x, k) =>
                        k === i ? { ...x, minutes: Number(e.target.value) || 0 } : x,
                      ),
                    }))
                  }
                  className={`${inputClass} mt-1`}
                />
                <Button
                  variant="danger"
                  size="sm"
                  icon={Trash2}
                  className="mt-2 w-full"
                  onClick={() =>
                    setFiche((f) => ({
                      ...f,
                      developpement: f.developpement.filter((_, k) => k !== i),
                    }))
                  }
                >
                  Retirer
                </Button>
              </div>
            </div>
          </div>
        ))}
        {fiche.developpement.length === 0 ? (
          <p className="text-sm text-slate">
            Aucune étape. Générez la fiche ou ajoutez-en une.
          </p>
        ) : null}
      </div>

      <h3 className="mt-5 text-sm font-medium text-ink">Conclusion</h3>
      <div className="mt-2 space-y-3">
        {champBloc("Évaluation formative", "evaluation")}
        {champBloc("Prochaine séance (pédagogie inversée)", "prochaine")}
      </div>
    </div>
  );
}
