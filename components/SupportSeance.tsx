"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveSupport } from "@/app/actions/seances";
import { useToast } from "@/components/ui/Toast";
import BandeauIa from "@/components/BandeauIa";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { inputStyles as inputClass } from "@/components/ui/Input";
import { slugify } from "@/lib/format";
import DiaporamaCours from "@/components/DiaporamaCours";
import {
  estRedigee,
  sectionRedigee,
  type SectionCours,
  type Support,
} from "@/lib/support";
import TexteMarkdown from "@/components/TexteMarkdown";
import { ListeRessources } from "@/components/RessourcesSupport";
import { Download, PenLine, Save, Sparkles, Trash2 } from "lucide-react";
import { getEtablissement } from "@/app/actions/etablissement";
import { marqueDe } from "@/lib/pdf-marque";

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
  const [support, ecrireSupport] = useState<Support | null>(
    (initial as Support | null) ?? null,
  );
  // Vrai tant que le support sort du modèle sans relecture du formateur.
  const [issuDuModele, setIssuDuModele] = useState(false);

  // Toute modification vaut relecture : le bandeau tombe au premier caractère.
  const setSupport: typeof ecrireSupport = (v) => {
    setIssuDuModele(false);
    ecrireSupport(v);
  };
  const [busy, setBusy] = useState(false);
  const [avertissements, setAvertissements] = useState<string[]>([]);
  // Un cours se projette autant qu'il s'édite : les deux vues portent le même
  // contenu, on bascule plutôt que d'empiler.
  const [vue, setVue] = useState<"edition" | "diaporama">("edition");

  /**
   * Ouvre une section rédigée : la première d'un support neuf, ou une de plus.
   *
   * Sur un support pratique il n'y a pas de sections — le formateur y écrit
   * déjà tout à la main. Le bouton n'y a donc pas de sens et l'action se
   * contente de le dire.
   */
  function redigerAlaMain() {
    if (support && support.type === "pratique") {
      toast("Un énoncé de TP se saisit déjà champ par champ.");
      return;
    }
    if (!support) {
      setSupport({
        type: "theorique",
        titre: contexte.objectif || "Support de cours",
        introduction: "",
        sections: [sectionRedigee("Contenu")],
        aRetenir: [],
        ressources: [],
      });
      setIssuDuModele(false);
      return;
    }
    setSupport({
      ...support,
      sections: [...support.sections, sectionRedigee()],
    });
  }

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
      ecrireSupport(data.support);
      setIssuDuModele(true);
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
      // Enregistrer, c'est valider : le support n'est plus un brouillon.
      setIssuDuModele(false);
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
      const [{ telechargerSupportPdf }, marque] = await Promise.all([
        import("@/lib/pdf-support"),
        getEtablissement(),
      ]);
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
        marqueDe(marque),
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
        {/* §4.4 : « la génération IA ne doit jamais être le seul chemin ».
            Le bouton est donc voisin de celui qui génère, même taille et même
            rang — pas relégué sous le formulaire une fois qu'on a renoncé. */}
        <Button
          variant="secondary"
          size="sm"
          icon={PenLine}
          onClick={redigerAlaMain}
          disabled={busy}
        >
          {support ? "Ajouter une section rédigée" : "Rédiger à la main"}
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

      {support?.type === "theorique" ? (
        <div
          role="tablist"
          aria-label="Vue du support"
          className="mt-3 inline-flex rounded-lg border border-border p-0.5"
        >
          {(
            [
              ["edition", "Édition"],
              ["diaporama", "Diaporama 16:9"],
            ] as const
          ).map(([cle, libelle]) => (
            <button
              key={cle}
              type="button"
              role="tab"
              aria-selected={vue === cle}
              onClick={() => setVue(cle)}
              className={`rounded-lg px-3 py-1 text-sm ${
                vue === cle
                  ? "bg-wash font-medium text-ink"
                  : "text-slate hover:text-ink"
              }`}
            >
              {libelle}
            </button>
          ))}
        </div>
      ) : null}

      {issuDuModele ? (
        <div className="mt-3">
          <BandeauIa>
            {pratique
              ? "Énoncé généré par l'IA — relisez-le avant de le distribuer."
              : "Cours généré par l'IA — relisez-le avant de le remettre."}
          </BandeauIa>
        </div>
      ) : null}

      {avertissements.length > 0 ? (
        <ul className="mt-3 list-disc space-y-0.5 rounded-lg bg-tint-teal px-5 py-2 text-sm text-ink">
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
      ) : support.type === "theorique" && vue === "diaporama" ? (
        <div className="mt-4">
          <DiaporamaCours
            support={support}
            sousTitre={[contexte.moduleNom, contexte.groupeNom]
              .filter(Boolean)
              .join(" · ")}
          />
        </div>
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
          {support.sections.map((sec, i) =>
            estRedigee(sec) || sec.markdown === "" ? (
              <SectionRedigee
                key={i}
                section={sec}
                index={i}
                onChange={(next) =>
                  setSupport({
                    ...support,
                    sections: support.sections.map((x, k) =>
                      k === i ? next : x,
                    ),
                  })
                }
                onRetirer={() =>
                  setSupport({
                    ...support,
                    sections: support.sections.filter((_, k) => k !== i),
                  })
                }
              />
            ) : (
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
              <label className="mt-2 block text-xs text-slate">
                Schéma — une étape par ligne, vide si la section n&apos;en a pas
                besoin
              </label>
              <textarea
                rows={3}
                value={(sec.schema?.etapes ?? []).join("\n")}
                onChange={(e) => {
                  const etapes = e.target.value.split("\n").filter((l) => l.trim());
                  setSupport({
                    ...support,
                    sections: support.sections.map((x, k) =>
                      k === i
                        ? {
                            ...x,
                            schema:
                              etapes.length >= 2
                                ? {
                                    titre: x.schema?.titre || x.titre,
                                    etapes,
                                    legende: x.schema?.legende ?? null,
                                  }
                                : null,
                          }
                        : x,
                    ),
                  });
                }}
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
            ),
          )}
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
          <div className="pt-1">
            <ListeRessources
              ressources={support.ressources ?? []}
              formateur
              onRetirer={(k) =>
                setSupport({
                  ...support,
                  ressources: (support.ressources ?? []).filter(
                    (_, j) => j !== k,
                  ),
                })
              }
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
                    : "text-coral-dark"
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
          <div className="pt-1">
            <ListeRessources
              ressources={support.ressources ?? []}
              formateur
              onRetirer={(k) =>
                setSupport({
                  ...support,
                  ressources: (support.ressources ?? []).filter(
                    (_, j) => j !== k,
                  ),
                })
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Édition d'une section rédigée à la main.
 *
 * Champ de saisie et aperçu côte à côte au-dessus de 768px, empilés en
 * dessous : écrire du markdown sans voir ce qu'il donne, c'est écrire à
 * l'aveugle — et l'aperçu utilise le même composant que la lecture stagiaire,
 * donc ce que le formateur voit là est littéralement ce que le stagiaire
 * verra.
 */
function SectionRedigee({
  section,
  index,
  onChange,
  onRetirer,
}: {
  section: SectionCours;
  index: number;
  onChange: (s: SectionCours) => void;
  onRetirer: () => void;
}) {
  return (
    <div className="rounded-lg border border-border-strong p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={section.titre}
          aria-label={`Titre de la section ${index + 1}`}
          onChange={(e) => onChange({ ...section, titre: e.target.value })}
          className={`${inputClass} font-medium`}
        />
        <Badge tone="info">rédigée</Badge>
        <button
          type="button"
          onClick={onRetirer}
          aria-label={`Retirer la section ${index + 1}`}
          className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-coral-dark transition-colors duration-150 ease-out hover:bg-alert-wash max-md:h-11 max-md:w-11"
        >
          <Trash2 size={15} aria-hidden />
        </button>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate">
            Markdown — titres, listes, gras, liens
          </span>
          <textarea
            rows={10}
            value={section.markdown ?? ""}
            onChange={(e) => onChange({ ...section, markdown: e.target.value })}
            placeholder={"## Une idée\n\n- un point\n- un autre\n\nUn **mot important**."}
            className={`${inputClass} font-mono text-[13px]`}
          />
        </label>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-slate">Aperçu</span>
          <div className="min-h-[120px] rounded-[9px] border border-border bg-surface p-3">
            {section.markdown?.trim() ? (
              <TexteMarkdown texte={section.markdown} />
            ) : (
              <p className="text-sm text-slate-light">
                L&apos;aperçu s&apos;affiche ici à mesure que vous écrivez.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
