"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveSupport } from "@/app/actions/seance";
import { useToast } from "@/components/ui/Toast";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { inputStyles as inputClass } from "@/components/ui/Input";
import { slugify } from "@/lib/format";
import type { Support } from "@/app/api/generate/support/route";
import { Download, Save, Sparkles } from "lucide-react";

export type ContexteSupport = {
  seanceId: string;
  moduleNom: string;
  groupeNom: string;
  date: string | null;
  dateFormatee: string | null;
  dureeHeures: number | null;
  objectif: string | null;
  nature: "theorique" | "pratique" | null;
};

/**
 * Support remis au stagiaire : cours ou énoncé de TP selon la séance.
 *
 * Éditable avant remise — le formateur reste responsable de ce qu'il distribue,
 * il ne signe pas une sortie de modèle sans l'avoir relue.
 */
export default function SupportSeance({
  contexte,
  initial,
  version,
}: {
  contexte: ContexteSupport;
  initial: unknown | null;
  version: number | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [support, setSupport] = useState<Support | null>(
    (initial as Support | null) ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [avertissements, setAvertissements] = useState<string[]>([]);

  const pratique = contexte.nature === "pratique";

  async function generer() {
    setBusy(true);
    try {
      const res = await fetch("/api/generate/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seanceId: contexte.seanceId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur de génération");
      setSupport(data.support);
      setAvertissements(data.avertissements ?? []);
      toast("Support généré. Relisez-le avant de le remettre.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur inattendue", "error");
    } finally {
      setBusy(false);
    }
  }

  async function enregistrer() {
    if (!support) return;
    setBusy(true);
    try {
      const v = await saveSupport(contexte.seanceId, support.type, support);
      toast(`Version ${v} enregistrée`);
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur inattendue", "error");
    } finally {
      setBusy(false);
    }
  }

  async function exporter() {
    if (!support) return;
    setBusy(true);
    try {
      const { telechargerSupportPdf } = await import("@/lib/pdf-support");
      await telechargerSupportPdf(
        support,
        {
          moduleNom: contexte.moduleNom,
          groupeNom: contexte.groupeNom,
          date: contexte.dateFormatee,
          dureeHeures: contexte.dureeHeures,
          objectif: contexte.objectif,
        },
        `${support.type === "pratique" ? "tp" : "cours"}-${slugify(
          [contexte.groupeNom, contexte.date ?? "", support.titre]
            .filter(Boolean)
            .join(" "),
          "support",
        )}.pdf`,
      );
    } catch {
      toast("Export PDF impossible.", "error");
    } finally {
      setBusy(false);
    }
  }

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
          {pratique ? "Générer l'énoncé de TP" : "Générer le cours"}
        </Button>
        <Button icon={Save} size="sm" onClick={enregistrer} disabled={busy || !support}>
          Enregistrer
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={Download}
          onClick={exporter}
          disabled={busy || !support}
        >
          Télécharger
        </Button>
        {version ? (
          <Badge tone="success">version {version}</Badge>
        ) : (
          <Badge tone="neutral">aucune version</Badge>
        )}
      </div>

      {avertissements.length > 0 ? (
        <ul className="mt-3 list-disc space-y-0.5 rounded-lg bg-info/10 px-5 py-2 text-sm text-ink">
          {avertissements.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      ) : null}

      {!support ? (
        <p className="mt-4 text-sm text-slate">
          {contexte.nature
            ? `Aucun support. Cette séance est ${pratique ? "pratique" : "théorique"} : la génération produira ${pratique ? "un énoncé de travaux pratiques" : "un support de cours"}.`
            : "Cette séance n'a pas de nature définie ; la génération produira un support de cours."}
        </p>
      ) : support.type === "theorique" ? (
        <div className="mt-4 space-y-4">
          <input
            value={support.titre}
            onChange={(e) => setSupport({ ...support, titre: e.target.value })}
            aria-label="Titre du cours"
            className={`${inputClass} font-medium`}
          />
          <div>
            <label className="block text-xs text-slate">Introduction</label>
            <textarea
              rows={3}
              value={support.introduction}
              onChange={(e) =>
                setSupport({ ...support, introduction: e.target.value })
              }
              className={`${inputClass} mt-1`}
            />
          </div>
          {support.sections.map((sec, i) => (
            <div key={i} className="rounded-lg border border-border p-3">
              <input
                value={sec.titre}
                aria-label={`Titre de la section ${i + 1}`}
                onChange={(e) =>
                  setSupport({
                    ...support,
                    sections: support.sections.map((x, k) =>
                      k === i ? { ...x, titre: e.target.value } : x,
                    ),
                  })
                }
                className={`${inputClass} font-medium`}
              />
              <label className="mt-2 block text-xs text-slate">
                Notions — une par ligne
              </label>
              <textarea
                rows={4}
                value={sec.notions.join("\n")}
                onChange={(e) =>
                  setSupport({
                    ...support,
                    sections: support.sections.map((x, k) =>
                      k === i
                        ? { ...x, notions: e.target.value.split("\n") }
                        : x,
                    ),
                  })
                }
                className={`${inputClass} mt-1`}
              />
              <label className="mt-2 block text-xs text-slate">Exemple</label>
              <textarea
                rows={2}
                value={sec.exemple ?? ""}
                onChange={(e) =>
                  setSupport({
                    ...support,
                    sections: support.sections.map((x, k) =>
                      k === i ? { ...x, exemple: e.target.value || null } : x,
                    ),
                  })
                }
                className={`${inputClass} mt-1`}
              />
            </div>
          ))}
          <div>
            <label className="block text-xs text-slate">
              À retenir — un point par ligne
            </label>
            <textarea
              rows={4}
              value={support.aRetenir.join("\n")}
              onChange={(e) =>
                setSupport({ ...support, aRetenir: e.target.value.split("\n") })
              }
              className={`${inputClass} mt-1`}
            />
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <input
            value={support.titre}
            onChange={(e) => setSupport({ ...support, titre: e.target.value })}
            aria-label="Titre du TP"
            className={`${inputClass} font-medium`}
          />
          {(
            [
              ["Contexte", "contexte"],
              ["Objectif", "objectif"],
              ["Livrable attendu", "livrable"],
            ] as const
          ).map(([libelle, cle]) => (
            <div key={cle}>
              <label className="block text-xs text-slate">{libelle}</label>
              <textarea
                rows={cle === "contexte" ? 4 : 2}
                value={support[cle]}
                onChange={(e) => setSupport({ ...support, [cle]: e.target.value })}
                className={`${inputClass} mt-1`}
              />
            </div>
          ))}
          <div>
            <label className="block text-xs text-slate">
              Consignes — une par ligne
            </label>
            <textarea
              rows={6}
              value={support.consignes.join("\n")}
              onChange={(e) =>
                setSupport({ ...support, consignes: e.target.value.split("\n") })
              }
              className={`${inputClass} mt-1`}
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs text-slate">
                Critères d&apos;évaluation
              </label>
              <span
                className={`text-xs ${
                  support.criteres.reduce((t, c) => t + c.points, 0) === 20
                    ? "text-slate"
                    : "text-danger"
                }`}
              >
                {support.criteres.reduce((t, c) => t + c.points, 0)} / 20
              </span>
            </div>
            <div className="mt-1 space-y-2">
              {support.criteres.map((c, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={c.critere}
                    aria-label={`Critère ${i + 1}`}
                    onChange={(e) =>
                      setSupport({
                        ...support,
                        criteres: support.criteres.map((x, k) =>
                          k === i ? { ...x, critere: e.target.value } : x,
                        ),
                      })
                    }
                    className={inputClass}
                  />
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={c.points}
                    aria-label={`Points du critère ${i + 1}`}
                    onChange={(e) =>
                      setSupport({
                        ...support,
                        criteres: support.criteres.map((x, k) =>
                          k === i
                            ? { ...x, points: Number(e.target.value) || 0 }
                            : x,
                        ),
                      })
                    }
                    className={`${inputClass} w-24`}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
