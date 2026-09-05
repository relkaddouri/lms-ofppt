"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveFiche } from "@/app/actions/fiches";
import { useToast } from "@/components/ui/Toast";
import BandeauIa from "@/components/BandeauIa";
import Button from "@/components/ui/Button";
import { inputStyles as inputClass } from "@/components/ui/Input";
import AutoTextarea from "@/components/ui/AutoTextarea";
import { slugify } from "@/lib/format";
import { getEtablissement } from "@/app/actions/etablissement";
import { marqueDe } from "@/lib/pdf-marque";
import {
  PHASES,
  definitionPhase,
  phasesDepuisAncienneFiche,
  quatrePhases,
  type ClePhase,
  type PhaseFiche,
} from "@/lib/phases";
import { Download, Pencil, Save, Sparkles, X } from "lucide-react";

export type { PhaseFiche };

export type Fiche = {
  nature: string;
  objectifs: string;
  methodeActive: string;
  modalite: string;
  fichiers: string;
  /** Les quatre phases, dans l'ordre — PRD §4.3ter. */
  phases: PhaseFiche[];
};

export function ficheVide(minutesSeance: number | null = null): Fiche {
  return {
    nature: "cours théorique",
    objectifs: "",
    methodeActive: "",
    modalite: "Synchrone présentiel",
    fichiers: "-",
    phases: quatrePhases([], minutesSeance),
  };
}

/**
 * Relit une fiche enregistrée, quel que soit son âge.
 *
 * Trois formats se sont succédé et cohabitent en base : du Markdown libre
 * d'avant la mise au format officiel, la structure minutée
 * (motivation/plan/développement/évaluation/prochaine), et les quatre phases.
 * Aucun n'est perdu : le premier atterrit dans l'activité, le deuxième est
 * converti phase par phase (§4.3ter, « remplace, ne s'ajoute pas »).
 */
export function lireFiche(
  contenu: string | null,
  minutesSeance: number | null = null,
): Fiche {
  const vide = ficheVide(minutesSeance);
  if (!contenu?.trim()) return vide;

  let brut: Record<string, unknown>;
  try {
    brut = JSON.parse(contenu) as Record<string, unknown>;
    if (!brut || typeof brut !== "object") throw new Error("format inconnu");
  } catch {
    const v = ficheVide(minutesSeance);
    const act = v.phases.find((p) => p.cle === "activite")!;
    act.instructions = contenu.trim().split("\n").filter(Boolean).slice(0, 20);
    return v;
  }

  const base: Fiche = {
    nature: String(brut.nature ?? vide.nature),
    objectifs: String(brut.objectifs ?? ""),
    methodeActive: String(brut.methodeActive ?? ""),
    modalite: String(brut.modalite ?? vide.modalite),
    fichiers: String(brut.fichiers ?? vide.fichiers),
    phases: vide.phases,
  };

  if (Array.isArray(brut.phases)) {
    return { ...base, phases: quatrePhases(brut.phases, minutesSeance) };
  }
  const reprises = phasesDepuisAncienneFiche(brut, minutesSeance);
  return reprises ? { ...base, phases: reprises } : base;
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
  const [fiche, ecrireFiche] = useState<Fiche>(() =>
    lireFiche(initial, contexte.minutesSeance),
  );
  // Vrai tant que la fiche sort du modèle sans que le formateur y ait touché.
  const [issuDuModele, setIssuDuModele] = useState(false);

  // Toute modification vaut relecture : le bandeau tombe au premier caractère.
  // Passer par ce setter partout évite d'avoir à y penser champ par champ.
  const setFiche: typeof ecrireFiche = (v) => {
    setIssuDuModele(false);
    ecrireFiche(v);
  };
  const [busy, setBusy] = useState(false);
  const [avertissements, setAvertissements] = useState<string[]>([]);
  // On consulte une fiche bien plus souvent qu'on ne la modifie : la lecture
  // est l'état par défaut dès qu'il y a quelque chose à lire.
  const [edition, setEdition] = useState(!initial);

  const totalMinutes = fiche.phases.reduce((t, p) => t + p.minutes, 0);

  function majPhase(cle: ClePhase, v: Partial<PhaseFiche>) {
    setFiche((f) => ({
      ...f,
      phases: f.phases.map((p) => (p.cle === cle ? { ...p, ...v } : p)),
    }));
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
      ecrireFiche({
        ...ficheVide(contexte.minutesSeance),
        ...data.fiche,
        phases: quatrePhases(data.fiche?.phases, contexte.minutesSeance),
      });
      setIssuDuModele(true);
      setAvertissements(data.avertissements ?? []);
      toast("Fiche générée. Relisez-la avant d'enregistrer.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur inattendue", "error");
    } finally {
      setBusy(false);
    }
  }

  async function enregistrer() {
    if (fiche.phases.every((p) => p.instructions.length === 0)) {
      toast("Aucune phase n'a d'instruction.", "error");
      return;
    }
    setBusy(true);
    try {
      const version = await saveFiche(contexte.seanceId, JSON.stringify(fiche));
      // Enregistrer, c'est valider : le contenu n'est plus un brouillon de modèle.
      setIssuDuModele(false);
      toast(`Version ${version} enregistrée`);
      setEdition(false);
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
      const [{ telechargerFichePdf }, marque] = await Promise.all([
        import("@/lib/pdf-fiche"),
        getEtablissement(),
      ]);
      await telechargerFichePdf(
        {
          nature: fiche.nature,
          date: contexte.dateFormatee,
          dureeHeures: contexte.minutesSeance
            ? contexte.minutesSeance / 60
            : null,
          filiere: contexte.filiere,
          annee: contexte.annee,
          groupe: contexte.groupeNom,
          module: contexte.moduleNom,
          objectifs: fiche.objectifs,
          methodeActive: fiche.methodeActive,
          modalite: fiche.modalite,
          fichiers: fiche.fichiers,
          phases: fiche.phases,
        },
        `fiche-${slugify(
          [contexte.groupeNom, contexte.date ?? "", fiche.objectifs]
            .filter(Boolean)
            .join(" "),
          "seance",
        )}.pdf`,
        marqueDe(marque),
      );
    } catch {
      toast("Export PDF impossible.", "error");
    } finally {
      setBusy(false);
    }
  }

  /** Une liste éditée en texte libre, une entrée par ligne. */
  const champListe = (
    cle: ClePhase,
    champ: "instructions" | "questions" | "points",
    libelle: string,
    aide: string,
  ) => {
    const phase = fiche.phases.find((p) => p.cle === cle)!;
    return (
      <div>
        <label className="block text-xs text-slate">{libelle}</label>
        <AutoTextarea
          minRows={3}
          value={phase[champ].join("\n")}
          onChange={(e) =>
            majPhase(cle, {
              [champ]: e.target.value.split("\n").filter((l) => l.trim()),
            })
          }
          placeholder={aide}
          className="mt-1"
        />
      </div>
    );
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {edition ? (
          <>
            <Button icon={Save} size="sm" onClick={enregistrer} disabled={busy}>
              Enregistrer
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={X}
              onClick={() => {
                setFiche(lireFiche(initial, contexte.minutesSeance));
                setEdition(false);
              }}
              disabled={busy}
            >
              Annuler
            </Button>
          </>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            icon={Pencil}
            onClick={() => setEdition(true)}
          >
            Modifier
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          icon={Sparkles}
          onClick={generer}
          loading={busy}
          loadingLabel="Génération…"
        >
          {initial ? "Regénérer" : "Générer la fiche"}
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
              ? "text-coral-dark"
              : "text-slate"
          }`}
        >
          {totalMinutes} min
          {contexte.minutesSeance ? ` / ${contexte.minutesSeance} min` : ""}
        </span>
      </div>

      {issuDuModele ? (
        <div className="mt-3">
          <BandeauIa />
        </div>
      ) : null}

      {avertissements.length > 0 ? (
        <ul className="mt-3 list-disc space-y-0.5 rounded-lg bg-tint-teal px-5 py-2 text-sm text-ink">
          {avertissements.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      ) : null}

      {!edition ? (
        <div className="mt-4">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-4">
            {(
              [
                ["Nature", fiche.nature],
                ["Modalité", fiche.modalite],
                ["Méthode active", fiche.methodeActive],
                ["Fichiers de travail", fiche.fichiers],
              ] as const
            ).map(([libelle, valeur]) => (
              <div key={libelle}>
                <dt className="text-xs text-slate">{libelle}</dt>
                <dd className="text-sm text-ink">{valeur || "—"}</dd>
              </div>
            ))}
          </dl>

          {fiche.objectifs ? (
            <p className="mt-4 rounded-lg bg-wash px-3 py-2 text-sm text-ink">
              <span className="text-slate">Objectif : </span>
              {fiche.objectifs}
            </p>
          ) : null}

          <ol className="mt-4 flex flex-col gap-3">
            {fiche.phases.map((phase, i) => {
              const def = definitionPhase(phase.cle);
              return (
                <li
                  key={phase.cle}
                  className="overflow-hidden rounded-[10px] border border-border"
                >
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-separator bg-paper-alt px-4 py-2.5">
                    <span className="font-mono text-[11.5px] text-slate-light">
                      {i + 1}
                    </span>
                    <h4 className="text-sm font-semibold text-ink">
                      {def.titre}
                    </h4>
                    {phase.methode ? (
                      <span className="text-[13px] text-slate-2">
                        {phase.methode}
                      </span>
                    ) : null}
                    <span className="ml-auto font-mono text-xs text-slate">
                      {phase.minutes} min
                    </span>
                  </div>
                  <div className="flex flex-col gap-3 px-4 py-3">
                    {(
                      [
                        ["Instructions", phase.instructions],
                        ["Questions à poser", phase.questions],
                        [def.libellePoints, phase.points],
                      ] as const
                    ).map(([libelle, lignes]) =>
                      lignes.length > 0 ? (
                        <div key={libelle}>
                          <p className="text-xs text-slate">{libelle}</p>
                          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-ink">
                            {lignes.map((l, k) => (
                              <li key={k}>{l}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null,
                    )}
                    {phase.instructions.length === 0 &&
                    phase.questions.length === 0 &&
                    phase.points.length === 0 ? (
                      <p className="text-sm text-slate">
                        Phase vide — {def.intention}.
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}

      {edition && !compact ? (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="block text-xs text-slate">Nature</label>
            <select
              value={fiche.nature}
              onChange={(e) =>
                setFiche((f) => ({ ...f, nature: e.target.value }))
              }
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
              onChange={(e) =>
                setFiche((f) => ({ ...f, modalite: e.target.value }))
              }
              className={`${inputClass} mt-1`}
            />
          </div>
          <div>
            <label className="block text-xs text-slate">Méthode active</label>
            <input
              value={fiche.methodeActive}
              onChange={(e) =>
                setFiche((f) => ({ ...f, methodeActive: e.target.value }))
              }
              placeholder="Étude de cas, travail en sous-groupes…"
              className={`${inputClass} mt-1`}
            />
          </div>
          <div className="md:col-span-3">
            <label className="block text-xs text-slate">
              Fichiers de travail
            </label>
            <input
              value={fiche.fichiers}
              onChange={(e) =>
                setFiche((f) => ({ ...f, fichiers: e.target.value }))
              }
              className={`${inputClass} mt-1`}
            />
          </div>
        </div>
      ) : null}

      {edition ? (
        <>
          <div className="mt-4">
            <label className="block text-xs text-slate">
              Objectif de la séance
            </label>
            <AutoTextarea
              minRows={2}
              value={fiche.objectifs}
              onChange={(e) =>
                setFiche((f) => ({ ...f, objectifs: e.target.value }))
              }
              placeholder="À partir de … le stagiaire produit / analyse / arbitre … en respectant …"
              className="mt-1"
            />
          </div>

          {/* Les quatre phases sont fixes : on n'en ajoute ni n'en retire. */}
          {PHASES.map((def, i) => {
            const phase = fiche.phases.find((p) => p.cle === def.cle)!;
            return (
              <section
                key={def.cle}
                className="mt-4 rounded-[10px] border border-border p-4"
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-mono text-[11.5px] text-slate-light">
                    {i + 1}
                  </span>
                  <h3 className="text-sm font-semibold text-ink">
                    {def.titre}
                  </h3>
                  <span className="text-[13px] text-slate-2">
                    {def.intention}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[1fr_110px]">
                  <div>
                    <label className="block text-xs text-slate">
                      Méthode active de la phase
                    </label>
                    <input
                      value={phase.methode}
                      onChange={(e) =>
                        majPhase(def.cle, { methode: e.target.value })
                      }
                      className={`${inputClass} mt-1`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate">
                      Durée (min)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={5}
                      value={phase.minutes}
                      onChange={(e) =>
                        majPhase(def.cle, {
                          minutes: Number(e.target.value) || 0,
                        })
                      }
                      className={`${inputClass} mt-1`}
                    />
                  </div>
                </div>

                <div className="mt-3 flex flex-col gap-3">
                  {champListe(
                    def.cle,
                    "instructions",
                    "Instructions — une action par ligne",
                    "Affichez les deux maquettes du dossier.",
                  )}
                  {champListe(
                    def.cle,
                    "questions",
                    "Questions à poser — telles quelles",
                    "Laquelle a été conçue avec l'utilisateur ?",
                  )}
                  {champListe(
                    def.cle,
                    "points",
                    def.libellePoints,
                    "Une ligne par point",
                  )}
                </div>
              </section>
            );
          })}
        </>
      ) : null}
    </div>
  );
}
