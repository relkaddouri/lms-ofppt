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
import { estRedige, type Support } from "@/lib/support";
import DocumentRedige from "@/components/DocumentRedige";
import { imprimer } from "@/lib/impression";
import { ListeRessources } from "@/components/RessourcesSupport";
import { Download, FileDown, PenLine, Save, Sparkles } from "lucide-react";
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
  const [vue, setVue] = useState<"edition" | "document" | "diaporama">(
    "edition",
  );

  // Au sens de l'écran : le champ existe, même vide — sinon la zone se
  // refermerait à la première frappe effacée.
  const redige =
    support?.type === "theorique" &&
    support.markdown !== null &&
    support.markdown !== undefined;

  function telechargerMarkdown() {
    if (!support || support.type !== "theorique" || !support.markdown) return;
    const lien = document.createElement("a");
    lien.href = URL.createObjectURL(
      new Blob([support.markdown], { type: "text/markdown;charset=utf-8" }),
    );
    lien.download = `${slugify(support.titre, "support")}.md`;
    lien.click();
    URL.revokeObjectURL(lien.href);
  }

  /**
   * Ouvre — ou referme — la zone de rédaction libre.
   *
   * Une seule zone pour tout le cours : le formateur arrive avec son texte
   * déjà écrit ailleurs et le colle. Lui demander de le découper en sections
   * avant de pouvoir le coller serait lui faire faire le travail que
   * l'application doit faire pour lui.
   *
   * Sur un énoncé de TP le bouton n'a pas de sens : il s'y saisit déjà tout à
   * la main, champ par champ.
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
        sections: [],
        aRetenir: [],
        ressources: [],
        markdown: "",
      });
      setIssuDuModele(false);
      return;
    }
    if (support.type !== "theorique") return;
    // Repasser au structuré ne détruit rien tant qu'on n'enregistre pas.
    setSupport({ ...support, markdown: redige ? null : (support.markdown ?? "") });
    setIssuDuModele(false);
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
          {redige ? "Reprendre le cours structuré" : "Rédiger / coller le cours"}
        </Button>
        <Button icon={Save} size="sm" onClick={enregistrer} disabled={busy || !support}>
          Enregistrer
        </Button>
        {/* L'export jsPDF ne sert plus un cours rédigé : il perdrait ses
            tableaux et ses encadrés, que le moteur ne sait pas dessiner. Pour
            celui-là, ce sont les deux boutons d'impression — document A4 dans
            l'onglet Document, diaporama 16:9 dans l'autre. */}
        {redige ? null : (
          <Button
            variant="ghost"
            size="sm"
            icon={Download}
            onClick={exporter}
            disabled={busy || !support}
          >
            Télécharger
          </Button>
        )}
        {/* Le markdown se récupère tel quel : c'est la source, elle se
            retravaille ailleurs, se met sous git, se recolle. Un support
            qu'on ne peut sortir qu'en PDF est un support qu'on ne peut plus
            reprendre. */}
        {redige ? (
          <Button
            variant="ghost"
            size="sm"
            icon={FileDown}
            onClick={telechargerMarkdown}
          >
            Télécharger en .md
          </Button>
        ) : null}
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
              // Le document est l'aperçu d'un cours rédigé : c'est la forme
              // qu'il a vraiment. Le diaporama sert à projeter, pas à relire.
              ...(redige ? ([["document", "Document"]] as const) : []),
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
      ) : support.type === "theorique" && redige && vue === "document" ? (
        <div className="mt-4">
          <Button
            variant="ghost"
            size="sm"
            icon={FileDown}
            onClick={() => imprimer("document")}
          >
            Télécharger le document (PDF A4)
          </Button>
          {/* Le même rendu sert l'écran et l'impression : c'est ce qui garantit
              que le PDF montre ce que le formateur vient de relire. Le moteur
              jsPDF, lui, perdait les tableaux et les encadrés. */}
          <div className="doc-impression mt-3 rounded-[14px] border border-border bg-surface px-6 py-6 shadow-repos md:px-10 md:py-9">
            <DocumentRedige texte={support.markdown ?? ""} />
          </div>
        </div>
      ) : support.type === "theorique" && vue === "diaporama" ? (
        <div className="mt-4">
          <DiaporamaCours
            support={support}
            pied={[contexte.moduleNom, contexte.groupeNom, "Support du stagiaire"]
              .filter(Boolean)
              .join(" · ")}
            sousTitre={[contexte.moduleNom, contexte.groupeNom]
              .filter(Boolean)
              .join(" · ")}
          />
        </div>
      ) : support.type === "theorique" && redige ? (
        // Une seule zone, et aucun aperçu à côté : l'aperçu, c'est l'onglet
        // « Diaporama 16:9 » — celui que la classe verra. En doubler un ici
        // reviendrait à montrer deux fois la même chose et à voler la moitié
        // de la largeur au texte qu'on est en train de coller.
        <div className="mt-4 space-y-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-slate">
              Collez votre cours ici — markdown : <code>##</code> pour un
              titre, <code>-</code> pour une puce, <code>**gras**</code>.
              Chaque titre ouvre une diapositive.
            </span>
            <textarea
              rows={22}
              value={support.markdown ?? ""}
              onChange={(e) =>
                setSupport({ ...support, markdown: e.target.value })
              }
              placeholder={"## Première idée\n\n- un point\n- un autre\n\n## Deuxième idée\n\nUn paragraphe avec un **mot important**."}
              className={`${inputClass} font-mono text-[13px] leading-relaxed`}
            />
          </label>
          <p className="text-[13px] text-slate-light">
            Basculez sur <span className="font-medium text-body">Diaporama
            16:9</span> pour voir le rendu.
          </p>
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
