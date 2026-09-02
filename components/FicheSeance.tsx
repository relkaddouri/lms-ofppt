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
import {
  Download,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

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
  const [fiche, ecrireFiche] = useState<Fiche>(() => lireFiche(initial));
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
      ecrireFiche({ ...ficheVide(), ...data.fiche });
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
    if (fiche.developpement.length === 0) {
      toast("Le développement est vide.", "error");
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
      const { telechargerFichePdf } = await import("@/lib/pdf-fiche");
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
        <AutoTextarea
          minRows={3}
          value={fiche[cle].contenu}
          onChange={(e) => majBloc(cle, { contenu: e.target.value })}
          className="mt-1"
        />
      </div>
      <div>
        <label className="block text-xs text-slate">Durée (min)</label>
        <input
          type="number"
          min={0}
          step={5}
          value={fiche[cle].minutes}
          onChange={(e) =>
            majBloc(cle, { minutes: Number(e.target.value) || 0 })
          }
          className="mt-1"
        />
      </div>
    </div>
  );

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
                setFiche(lireFiche(initial));
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
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-3">
            {(
              [
                ["Nature", fiche.nature],
                ["Modalité", fiche.modalite],
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
              <span className="text-slate">Objectifs : </span>
              {fiche.objectifs}
            </p>
          ) : null}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <tbody>
                {(
                  [
                    [
                      "Introduction",
                      "Éléments de motivation",
                      fiche.motivation,
                    ],
                    ["", "Plan de la séance", fiche.plan],
                  ] as const
                ).map(([groupe, libelle, bloc], i) => (
                  <tr key={i} className="border-b border-border align-top">
                    <th className="w-28 py-2 pr-3 text-left text-xs font-medium text-slate">
                      {groupe}
                    </th>
                    <td className="w-44 py-2 pr-3 text-xs text-slate">
                      {libelle}
                    </td>
                    <td className="whitespace-pre-line py-2 text-ink">
                      {bloc.contenu || "—"}
                    </td>
                    <td className="w-20 py-2 text-right font-mono text-xs text-slate">
                      {bloc.minutes} min
                    </td>
                  </tr>
                ))}
                {fiche.developpement.map((l, i) => (
                  <tr
                    key={`d${i}`}
                    className="border-b border-border align-top"
                  >
                    <th className="py-2 pr-3 text-left text-xs font-medium text-slate">
                      {i === 0 ? "Développement" : ""}
                    </th>
                    <td className="whitespace-pre-line py-2 pr-3 text-xs text-slate">
                      {l.strategie}
                    </td>
                    <td className="whitespace-pre-line py-2 text-ink">
                      {l.contenu}
                    </td>
                    <td className="py-2 text-right font-mono text-xs text-slate">
                      {l.minutes} min
                    </td>
                  </tr>
                ))}
                {(
                  [
                    ["Conclusion", "Évaluation formative", fiche.evaluation],
                    ["", "Prochaine séance", fiche.prochaine],
                  ] as const
                ).map(([groupe, libelle, bloc], i) => (
                  <tr
                    key={`c${i}`}
                    className="border-b border-border align-top last:border-0"
                  >
                    <th className="py-2 pr-3 text-left text-xs font-medium text-slate">
                      {groupe}
                    </th>
                    <td className="py-2 pr-3 text-xs text-slate">{libelle}</td>
                    <td className="whitespace-pre-line py-2 text-ink">
                      {bloc.contenu || "—"}
                    </td>
                    <td className="py-2 text-right font-mono text-xs text-slate">
                      {bloc.minutes} min
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {edition && !compact ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
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
      ) : null}

      {edition ? (
        <>
          <div className="mt-4">
            <label className="block text-xs text-slate">
              Objectifs de la séance
            </label>
            <AutoTextarea
              minRows={2}
              value={fiche.objectifs}
              onChange={(e) =>
                setFiche((f) => ({ ...f, objectifs: e.target.value }))
              }
              className="mt-1"
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
                    <label className="block text-xs text-slate">
                      Stratégie
                    </label>
                    <AutoTextarea
                      minRows={3}
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
                    <AutoTextarea
                      minRows={3}
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

          <h3 className="mt-5 text-sm font-medium text-ink">Conclusion</h3>
          <div className="mt-2 space-y-3">
            {champBloc("Évaluation formative", "evaluation")}
            {champBloc("Prochaine séance (pédagogie inversée)", "prochaine")}
          </div>
        </>
      ) : null}
    </div>
  );
}
