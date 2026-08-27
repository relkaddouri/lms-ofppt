"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  saveFiche,
  type FichePreparation,
  type SeanceAPreparer,
} from "@/app/actions/fiches";
import { useToast } from "@/components/ui/Toast";
import Breadcrumb from "@/components/Breadcrumb";
import Button from "@/components/ui/Button";
import { inputStyles as inputClass } from "@/components/ui/Input";
import { slugify, formatDate } from "@/lib/format";
import { dureeHeures } from "@/lib/creneaux";
import { Download, Plus, Save, Sparkles, Trash2 } from "lucide-react";

type Bloc = { contenu: string; minutes: number };
type LigneDev = { strategie: string; contenu: string; minutes: number };

type Fiche = {
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

function ficheVide(): Fiche {
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
function lireFiche(contenu: string | null): Fiche {
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

export default function FichePreparationManager({
  moduleId,
  moduleNom,
  seances,
  seanceId,
  versions,
  ficheLegacy,
}: {
  moduleId: string;
  moduleNom: string;
  moduleDuree: number;
  seances: SeanceAPreparer[];
  seanceId: string | null;
  versions: FichePreparation[];
  ficheLegacy: string | null;
}) {
  const router = useRouter();
  const toast = useToast();

  const [fiche, setFiche] = useState<Fiche>(() =>
    lireFiche(versions[0]?.contenu ?? null),
  );
  const [activeVersion, setActiveVersion] = useState<number | null>(
    versions[0]?.version ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [avertissements, setAvertissements] = useState<string[]>([]);

  const seance = seances.find((s) => s.id === seanceId) ?? null;

  const minutesSeance =
    seance?.heure_debut && seance.heure_fin
      ? Math.round(dureeHeures(seance.heure_debut, seance.heure_fin) * 60)
      : null;

  const totalMinutes =
    fiche.motivation.minutes +
    fiche.plan.minutes +
    fiche.developpement.reduce((s, l) => s + l.minutes, 0) +
    fiche.evaluation.minutes +
    fiche.prochaine.minutes;

  function majBloc(cle: "motivation" | "plan" | "evaluation" | "prochaine", v: Partial<Bloc>) {
    setFiche((f) => ({ ...f, [cle]: { ...f[cle], ...v } }));
  }

  async function handleGenerate() {
    if (!seanceId) {
      toast("Choisissez d'abord la séance à préparer.", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/generate/fiche-preparation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seanceId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur de génération");
      setFiche({ ...ficheVide(), ...data.fiche });
      setActiveVersion(null);
      setAvertissements(data.avertissements ?? []);
      toast("Fiche générée. Relisez-la avant d'enregistrer.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur inattendue", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    if (!seanceId) {
      toast("Choisissez d'abord la séance à préparer.", "error");
      return;
    }
    if (fiche.developpement.length === 0) {
      toast("Le développement est vide.", "error");
      return;
    }
    setBusy(true);
    try {
      const version = await saveFiche(seanceId, JSON.stringify(fiche));
      setActiveVersion(version);
      toast(`Version ${version} enregistrée`);
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur inattendue", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleDownloadPdf() {
    if (!seance) return;
    setBusy(true);
    try {
      const { telechargerFichePdf } = await import("@/lib/pdf-fiche");
      await telechargerFichePdf(
        {
          nature: fiche.nature,
          date: seance.date ? formatDate(seance.date) : null,
          dureeHeures: minutesSeance ? minutesSeance / 60 : null,
          filiere: seance.filiere,
          annee: seance.groupe_annee,
          groupe: seance.groupe_nom,
          module: moduleNom,
          objectifs: fiche.objectifs,
          modalite: fiche.modalite,
          fichiers: fiche.fichiers,
          motivation: fiche.motivation,
          plan: fiche.plan,
          developpement: fiche.developpement,
          evaluation: fiche.evaluation,
          prochaine: fiche.prochaine,
        },
        `fiche-${slugify(moduleNom)}-${seance.date ?? ""}.pdf`,
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
    <div className="p-8">
      <Breadcrumb
        items={[
          { label: "Modules", href: "/modules" },
          { label: moduleNom, href: `/modules/${moduleId}` },
          { label: "Fiche de préparation" },
        ]}
      />

      <div className="mt-6 rounded-xl border border-border bg-surface p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <label className="block text-sm font-medium text-ink" htmlFor="seance">
          Séance préparée
        </label>
        {seances.length === 0 ? (
          <p className="mt-2 rounded-lg bg-info/10 px-3 py-2 text-sm text-ink">
            Aucune séance n&apos;est encore planifiée pour ce module. Créez-en une
            depuis la progression d&apos;un groupe pour pouvoir la préparer.
          </p>
        ) : (
          <select
            id="seance"
            value={seanceId ?? ""}
            onChange={(e) => router.push(`?seance=${e.target.value}`)}
            className={`${inputClass} mt-2`}
          >
            {seances.map((s) => (
              <option key={s.id} value={s.id}>
                {[
                  s.groupe_nom,
                  s.date ? formatDate(s.date) : "date à définir",
                  s.heure_debut ? s.heure_debut.slice(0, 5) : null,
                  s.statut === "fait" ? "faite" : "à faire",
                  s.nb_versions > 0 ? `${s.nb_versions} version(s)` : "aucune fiche",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </option>
            ))}
          </select>
        )}
        {seance?.objectif_operationnel ? (
          <p className="mt-2 text-sm text-ink">
            <span className="text-slate">Objectif : </span>
            {seance.objectif_operationnel}
          </p>
        ) : null}
      </div>

      {ficheLegacy && versions.length === 0 ? (
        <div className="mt-4 rounded-xl border border-info/30 bg-info/10 px-4 py-3">
          <p className="text-sm font-medium text-ink">
            Une ancienne fiche existe pour ce module
          </p>
          <p className="mt-1 text-sm text-ink">
            Elle était rattachée au module, pas à une séance. Reprenez son
            contenu si vous le souhaitez.
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-2"
            onClick={() =>
              setFiche((f) => ({
                ...f,
                developpement: [
                  ...f.developpement,
                  { strategie: "À répartir", contenu: ficheLegacy, minutes: 0 },
                ],
              }))
            }
          >
            Reprendre son contenu
          </Button>
        </div>
      ) : null}

      {avertissements.length > 0 ? (
        <div className="mt-4 rounded-xl border border-info/30 bg-info/10 px-4 py-3">
          <p className="text-sm font-medium text-ink">À vérifier</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-ink">
            {avertissements.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button icon={Save} onClick={handleSave} disabled={busy || !seanceId}>
          Enregistrer une nouvelle version
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon={Sparkles}
          onClick={handleGenerate}
          loading={busy}
          loadingLabel="Génération…"
          disabled={!seanceId}
        >
          Générer la fiche
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={Download}
          onClick={handleDownloadPdf}
          disabled={busy || !seance}
        >
          Exporter au format officiel
        </Button>
        <span
          className={`ml-auto text-sm ${
            minutesSeance && totalMinutes !== minutesSeance
              ? "text-danger"
              : "text-slate"
          }`}
        >
          {totalMinutes} min
          {minutesSeance ? ` / ${minutesSeance} min de séance` : ""}
        </span>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_220px]">
        <div className="space-y-4">
          <section className="rounded-xl border border-border bg-surface p-4">
            <h2 className="text-sm font-medium text-ink">Identification</h2>
            <div className="mt-3 space-y-3">
              <div>
                <label className="block text-xs text-slate">
                  Objectifs de la séance
                </label>
                <textarea
                  rows={2}
                  value={fiche.objectifs}
                  onChange={(e) =>
                    setFiche((f) => ({ ...f, objectifs: e.target.value }))
                  }
                  className={`${inputClass} mt-1`}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
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
            </div>
          </section>

          <section className="rounded-xl border border-border bg-surface p-4">
            <h2 className="text-sm font-medium text-ink">Introduction</h2>
            <div className="mt-3 space-y-3">
              {champBloc("Éléments de motivation", "motivation")}
              {champBloc("Plan de la séance", "plan")}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-ink">Développement</h2>
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
            <div className="mt-3 space-y-3">
              {fiche.developpement.map((l, i) => (
                <div key={i} className="rounded-lg border border-border p-3">
                  <div className="grid gap-2 sm:grid-cols-[180px_1fr_110px]">
                    <div>
                      <label className="block text-xs text-slate">
                        Stratégie pédagogique
                      </label>
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
                      <label className="block text-xs text-slate">
                        Durée (min)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={5}
                        value={l.minutes}
                        onChange={(e) =>
                          setFiche((f) => ({
                            ...f,
                            developpement: f.developpement.map((x, k) =>
                              k === i
                                ? { ...x, minutes: Number(e.target.value) || 0 }
                                : x,
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
                            developpement: f.developpement.filter(
                              (_, k) => k !== i,
                            ),
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
          </section>

          <section className="rounded-xl border border-border bg-surface p-4">
            <h2 className="text-sm font-medium text-ink">Conclusion</h2>
            <div className="mt-3 space-y-3">
              {champBloc("Évaluation formative", "evaluation")}
              {champBloc("Prochaine séance (pédagogie inversée)", "prochaine")}
            </div>
          </section>
        </div>

        <aside className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-sm font-medium text-ink">Versions</h2>
          {versions.length === 0 ? (
            <p className="mt-2 text-sm text-slate">Aucune version enregistrée.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {versions.map((v) => (
                <li key={v.id}>
                  <button
                    onClick={() => {
                      setFiche(lireFiche(v.contenu));
                      setActiveVersion(v.version);
                    }}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm focus:outline-none focus:ring-2 focus:ring-forest ${
                      activeVersion === v.version
                        ? "border-forest bg-mint text-ink"
                        : "border-border text-slate hover:border-forest/50"
                    }`}
                  >
                    <span className="font-mono">v{v.version}</span>
                    <span className="mt-0.5 block text-xs text-slate">
                      {new Date(v.created_at).toLocaleString("fr-FR")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
