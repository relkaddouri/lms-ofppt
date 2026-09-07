"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  corrigerPassation,
  type Controle,
  type Passation,
  type PassationDetail,
} from "@/app/actions/controles";
import Breadcrumb from "@/components/Breadcrumb";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import { inputStyles } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { formatDateTime } from "@/lib/format";
import { ChevronRight, X, Zap } from "lucide-react";
import { libelleModule } from "@/lib/modules";
import BandeauIa from "@/components/BandeauIa";
import { baremeAttendu } from "@/lib/controles";

type Suggestion = { points: number; commentaire: string };

/** Une question compte pour corrigée dès qu'elle porte des points saisis. */
function estCorrigee(r: PassationDetail): boolean {
  return r.points !== null && r.points !== undefined && !Number.isNaN(r.points);
}

function resume(enonce: string): string {
  const nettoye = enonce.trim().replace(/\s+/g, " ");
  return nettoye.length > 68 ? `${nettoye.slice(0, 66)}…` : nettoye;
}

/**
 * Correction d'une copie, question par question.
 *
 * L'écran précédent ne corrigeait rien : on y collait une réponse à la main
 * pour obtenir une suggestion, sans copie ni stagiaire ni enregistrement.
 * `Correction copie.dc.html` en fait ce qu'il devrait être — le rail des
 * questions à gauche avec leur état, la réponse rendue et la notation à
 * droite, la copie suivante à portée. La suggestion de l'IA reste une
 * proposition : rien ne s'applique sans un clic explicite.
 */
export default function CorrectionManager({
  moduleId,
  moduleNom,
  moduleCode,
  groupeId,
  controles,
  controleId,
  copies,
  copieInitiale,
}: {
  moduleId: string;
  moduleNom: string;
  moduleCode: string | null;
  groupeId: string;
  controles: Controle[];
  controleId: string | null;
  copies: Passation[];
  copieInitiale: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [enCours, startTransition] = useTransition();

  const [copieId, setCopieId] = useState<string | null>(
    copieInitiale ?? copies[0]?.id ?? null,
  );
  const copie = copies.find((c) => c.id === copieId) ?? null;
  const rang = copies.findIndex((c) => c.id === copieId);

  // La correction se travaille en local, puis s'enregistre d'un bloc : la
  // saisie ne part pas à la base à chaque frappe.
  const [reponses, setReponses] = useState<PassationDetail[]>(
    copie?.responses ?? [],
  );
  const [index, setIndex] = useState(0);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [busyIa, setBusyIa] = useState(false);
  // Les réponses dont la note et le commentaire viennent du modèle et n'ont
  // pas encore été relus. Sans cela, une note produite par l'IA se
  // enregistrerait comme une note saisie à la main — c'est précisément ce que
  // design_system.md §8 interdit.
  const [issuesDeLIa, setIssuesDeLIa] = useState<Set<string>>(new Set());

  // PRD §4.7 : la note se lit sur le total du contrôle corrigé — 20 pour un
  // contrôle continu, 40 pour une épreuve de fin de module.
  const totalAttendu = baremeAttendu(
    controles.find((c) => c.id === controleId)?.type,
  );

  const oublierIa = (id: string) =>
    setIssuesDeLIa((prev) => {
      if (!prev.has(id)) return prev;
      const suite = new Set(prev);
      suite.delete(id);
      return suite;
    });

  const active = reponses[index] ?? null;
  const corrigees = reponses.filter(estCorrigee).length;
  const note = useMemo(
    () => reponses.reduce((s, r) => s + (Number(r.points) || 0), 0),
    [reponses],
  );

  function ouvrirCopie(id: string) {
    const c = copies.find((x) => x.id === id);
    setCopieId(id);
    setReponses(c?.responses ?? []);
    setIndex(0);
    setSuggestion(null);
    setIssuesDeLIa(new Set());
  }

  function modifierActive(patch: Partial<PassationDetail>, deLIa = false) {
    setReponses((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    );
    // §8 : le bandeau disparaît dès que le formateur touche au contenu. Une
    // retouche manuelle vaut donc relecture ; l'application d'une suggestion,
    // au contraire, pose la marque.
    const id = reponses[index]?.question_id;
    if (!id) return;
    if (deLIa) setIssuesDeLIa((prev) => new Set(prev).add(id));
    else oublierIa(id);
  }

  async function demanderSuggestion() {
    if (!active) return;
    setBusyIa(true);
    setSuggestion(null);
    try {
      const res = await fetch("/api/corrige", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: active.question_id,
          reponse: active.reponse ?? "",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur de correction");
      setSuggestion({
        points: Number(data.points) || 0,
        commentaire: data.commentaire ?? "",
      });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur inattendue", "error");
    } finally {
      setBusyIa(false);
    }
  }

  function enregistrer(puisSuivante: boolean) {
    if (!copie) return;
    startTransition(async () => {
      try {
        await corrigerPassation(copie.id, reponses);
        toast(`Copie de ${copie.nom_complet} enregistrée — ${note} / ${totalAttendu}`);
        if (puisSuivante && index < reponses.length - 1) {
          setIndex(index + 1);
          setSuggestion(null);
        }
        router.refresh();
      } catch (e) {
        toast(e instanceof Error ? e.message : "Enregistrement impossible", "error");
      }
    });
  }

  if (copies.length === 0) {
    return (
      <div className="p-8">
        <Breadcrumb
          items={[
            { label: "Modules", href: "/modules" },
            { label: libelleModule(moduleCode, moduleNom), href: `/modules/${moduleId}` },
            {
              label: "Contrôle",
              href: `/modules/${moduleId}/controle?groupe=${groupeId}`,
            },
            { label: "Correction" },
          ]}
        />
        <p className="mt-6 rounded-[14px] border border-border bg-surface px-6 py-10 text-center text-[14.5px] text-slate-light shadow-repos">
          Aucune copie rendue pour l&apos;instant. Les stagiaires composent
          depuis leur espace ; les copies apparaissent ici dès la remise.
        </p>
      </div>
    );
  }

  const bareme = Number(active?.bareme) || 0;
  const marques = [0, bareme / 2, bareme];

  return (
    <div className="p-8">
      <Breadcrumb
        items={[
          { label: "Modules", href: "/modules" },
          { label: libelleModule(moduleCode, moduleNom), href: `/modules/${moduleId}` },
          {
            label: "Contrôle",
            href: `/modules/${moduleId}/controle?groupe=${groupeId}`,
          },
          { label: "Correction" },
        ]}
      />

      <header className="mt-6 flex flex-wrap items-start justify-between gap-6">
        <div className="flex min-w-0 items-start gap-4">
          <Avatar prenom={copie?.nom_complet ?? "?"} taille="lg" />
          <div className="flex min-w-0 flex-col gap-1.5">
            <h1 className="font-display text-[27px] font-bold leading-tight tracking-[-0.02em] text-ink">
              {copie?.nom_complet ?? "Copie"}
            </h1>
            <div className="flex flex-wrap items-center gap-3.5 text-[14.5px] text-slate-2">
              <span className="font-mono text-body">
                {[moduleCode, controles.find((c) => c.id === controleId)?.titre]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              <span>
                Copie {rang + 1} sur {copies.length}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-col items-end gap-[3px]">
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-slate-light">
              Note provisoire
            </span>
            <span
              className={`font-mono text-2xl font-medium ${
                corrigees < reponses.length
                  ? "text-ink"
                  : note >= 10
                    ? "text-green-dark"
                    : "text-coral-dark"
              }`}
            >
              {note}{" "}
              <span className="text-[15px] text-muted">/ {totalAttendu}</span>
            </span>
          </div>
          <Button
            iconRight={ChevronRight}
            disabled={rang >= copies.length - 1}
            onClick={() => ouvrirCopie(copies[rang + 1]!.id)}
          >
            Copie suivante
          </Button>
        </div>
      </header>

      {copies.length > 1 ? (
        <label className="mt-5 flex max-w-[380px] flex-col gap-[7px]">
          <span className="text-sm font-semibold text-body">Copie</span>
          <select
            value={copieId ?? ""}
            onChange={(e) => ouvrirCopie(e.target.value)}
            className={inputStyles}
          >
            {copies.map((c, i) => (
              <option key={c.id} value={c.id}>
                {i + 1}. {c.nom_complet} — {Number(c.note) || 0} / {totalAttendu}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="mt-5 grid grid-cols-1 items-start gap-5 xl:[grid-template-columns:320px_minmax(0,1fr)]">
        <section className="min-w-0 overflow-hidden rounded-[14px] border border-border bg-surface shadow-repos">
          <div className="flex items-center gap-2.5 border-b border-separator bg-paper-alt px-[18px] py-4">
            <h2 className="font-display text-[15.5px] font-semibold text-ink">
              Questions
            </h2>
            <span className="rounded-full bg-wash-strong px-2.5 py-0.5 font-mono text-[12.5px] font-medium text-slate-2">
              {corrigees} / {reponses.length}
            </span>
          </div>

          {reponses.map((r, i) => {
            const actif = i === index;
            const faite = estCorrigee(r);
            return (
              <button
                key={r.question_id}
                type="button"
                aria-current={actif ? "true" : undefined}
                onClick={() => {
                  setIndex(i);
                  setSuggestion(null);
                }}
                className={`flex w-full items-start gap-3 border-b border-l-[3px] border-separator px-[18px] py-3.5 text-left transition-colors duration-150 ease-out ${
                  actif
                    ? "border-l-ink bg-paper-alt"
                    : "border-l-transparent bg-surface hover:bg-paper"
                }`}
              >
                <span className="mt-0.5 shrink-0 font-mono text-xs font-semibold text-slate-light">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="flex min-w-0 flex-col gap-1.5">
                  <span
                    className={`text-sm leading-snug ${
                      actif ? "text-ink" : "text-body"
                    }`}
                  >
                    {resume(r.enonce)}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 self-start whitespace-nowrap rounded-full border px-2.5 py-[3px] text-xs font-semibold ${
                      faite
                        ? "border-tint-green bg-success-wash text-green-dark"
                        : "border-tint-alert-strong bg-alert-wash text-coral-dark"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`h-[5px] w-[5px] shrink-0 rounded-full ${
                        faite ? "bg-green" : "bg-coral"
                      }`}
                    />
                    {faite ? "Corrigée" : "À corriger"}
                  </span>
                </span>
                <span
                  className={`ml-auto mt-0.5 shrink-0 whitespace-nowrap font-mono text-[13px] ${
                    faite ? "text-body" : "text-muted"
                  }`}
                >
                  {faite ? Number(r.points) : "—"}/{Number(r.bareme) || 0}
                </span>
              </button>
            );
          })}

          <div className="flex items-center justify-between gap-3 bg-paper-alt px-[18px] py-3.5">
            <span className="text-[13.5px] text-slate-2">Progression</span>
            <span className="font-mono text-[13.5px] text-body">
              {reponses.length
                ? Math.round((corrigees / reponses.length) * 100)
                : 0}{" "}
              %
            </span>
          </div>
        </section>

        {active ? (
          <div className="flex min-w-0 flex-col gap-[18px]">
            <section className="overflow-hidden rounded-[14px] border border-border bg-surface shadow-repos">
              <div className="flex flex-col gap-2.5 border-b border-separator px-6 py-5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-slate-light">
                    Question {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="ml-auto font-mono text-[13px] text-slate-light">
                    Barème {bareme} pts
                  </span>
                </div>
                <p className="text-[16.5px] leading-relaxed text-ink">
                  {active.enonce}
                </p>
              </div>

              <div className="flex flex-col gap-2.5 px-6 py-5">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-slate-light">
                  Réponse du stagiaire
                </span>
                <div className="rounded-[11px] border border-border bg-paper-alt px-[18px] py-4">
                  <p className="whitespace-pre-line text-[15.5px] leading-relaxed text-body">
                    {active.reponse?.trim() || "Aucune réponse rendue."}
                  </p>
                </div>
                {copie?.submitted_at ? (
                  <span className="font-mono text-[12.5px] text-muted">
                    Rendu le {formatDateTime(copie.submitted_at)}
                  </span>
                ) : null}
                {active.corrige?.trim() ? (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-[13.5px] font-semibold text-teal-dark">
                      Voir le corrigé
                    </summary>
                    <p className="mt-1.5 whitespace-pre-line text-[14.5px] leading-relaxed text-slate-2">
                      {active.corrige}
                    </p>
                  </details>
                ) : null}
              </div>

              <div className="flex flex-col gap-4 px-6 pb-[22px]">
                {/* §8 : une correction issue du modèle reste marquée tant
                    qu'elle n'a pas été relue — une note pèse sur une moyenne
                    annuelle, d'où la variante engageante. */}
                {issuesDeLIa.has(active.question_id) ? (
                  <BandeauIa
                    variante="engageant"
                    meta={`Claude · ${active.points ?? 0} / ${bareme}`}
                    onRelu={() => oublierIa(active.question_id)}
                  >
                    Note et commentaire proposés par l&apos;IA — relisez-les
                    avant d&apos;enregistrer.
                  </BandeauIa>
                ) : null}

                <div className="flex flex-wrap items-end gap-4">
                  <label
                    htmlFor="points"
                    className="flex flex-col gap-[7px]"
                  >
                    <span className="text-sm font-semibold text-body">
                      Points obtenus
                    </span>
                    <span className="flex items-stretch overflow-hidden rounded-[9px] border border-border-strong bg-surface max-md:min-h-11">
                      <input
                        id="points"
                        type="number"
                        min={0}
                        max={bareme}
                        step={0.5}
                        value={active.points ?? ""}
                        onChange={(e) =>
                          modifierActive({
                            points:
                              e.target.value === ""
                                ? null
                                : Number(e.target.value) || 0,
                          })
                        }
                        className="w-[62px] border-none bg-transparent px-2.5 py-2.5 text-right font-mono text-base text-ink outline-none"
                      />
                      <span className="flex items-center border-l border-border px-3 font-mono text-[13px] text-slate-light">
                        / {bareme}
                      </span>
                    </span>
                  </label>

                  <div className="flex flex-wrap gap-1.5">
                    {marques.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => modifierActive({ points: m })}
                        className="rounded-lg border border-border-strong bg-surface px-3 py-2 font-mono text-[13px] font-medium text-body transition-colors duration-150 ease-out hover:border-ink hover:bg-paper max-md:min-h-11 max-md:min-w-11"
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <label htmlFor="commentaire" className="flex flex-col gap-[7px]">
                  <span className="text-sm font-semibold text-body">
                    Commentaire au stagiaire
                  </span>
                  <div className="overflow-hidden rounded-[10px] border border-border-strong bg-surface">
                    <textarea
                      id="commentaire"
                      rows={3}
                      value={active.commentaire ?? ""}
                      onChange={(e) =>
                        modifierActive({ commentaire: e.target.value })
                      }
                      placeholder="Remarque courte, visible par le stagiaire…"
                      className="w-full resize-y border-none bg-transparent px-3.5 py-3 text-[15px] leading-relaxed text-body outline-none placeholder:text-slate-light"
                    />
                  </div>
                </label>

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="secondary"
                    icon={Zap}
                    onClick={demanderSuggestion}
                    loading={busyIa}
                    loadingLabel="Analyse…"
                  >
                    Proposer une correction avec l&apos;IA
                  </Button>
                  <span className="ml-auto flex gap-2.5">
                    <Button
                      variant="secondary"
                      onClick={() => modifierActive({ points: null })}
                      disabled={!estCorrigee(active)}
                    >
                      Laisser à corriger
                    </Button>
                    <Button
                      onClick={() => enregistrer(true)}
                      loading={enCours}
                      loadingLabel="Enregistrement…"
                    >
                      Valider et continuer
                    </Button>
                  </span>
                </div>

                {suggestion ? (
                  <div className="overflow-hidden rounded-[14px] border border-tint-alert-strong bg-alert-wash">
                    <div className="flex flex-wrap items-center gap-2.5 border-b border-tint-alert-strong px-5 py-3.5">
                      <Zap size={16} className="shrink-0 text-coral" aria-hidden />
                      <span className="font-display text-[15px] font-semibold text-coral-dark">
                        Suggestion de l&apos;IA — à valider
                      </span>
                      <span className="font-mono text-[12.5px] text-coral/70">
                        Claude · non appliquée
                      </span>
                      <button
                        type="button"
                        aria-label="Ignorer la suggestion"
                        onClick={() => setSuggestion(null)}
                        className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg border border-tint-alert-strong bg-surface text-coral-dark transition-colors duration-150 ease-out hover:bg-alert-wash"
                      >
                        <X size={13} strokeWidth={2.2} aria-hidden />
                      </button>
                    </div>

                    <div className="flex flex-col gap-4 px-5 py-[18px]">
                      <div className="flex flex-col gap-1">
                        <span className="text-[13px] text-slate-light">
                          Points suggérés
                        </span>
                        <span className="font-mono text-[19px] font-medium text-coral-dark">
                          {suggestion.points} / {bareme}
                        </span>
                      </div>

                      {suggestion.commentaire ? (
                        <div className="flex flex-col gap-1.5 rounded-[10px] border border-tint-alert-strong bg-surface px-4 py-3.5">
                          <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-coral/70">
                            Commentaire proposé
                          </span>
                          <p className="text-[15px] leading-relaxed text-body">
                            {suggestion.commentaire}
                          </p>
                        </div>
                      ) : null}

                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="text-[13.5px] text-coral-dark">
                          Rien n&apos;est appliqué avant votre validation.
                        </span>
                        <span className="ml-auto flex gap-2.5">
                          <button
                            type="button"
                            onClick={() => setSuggestion(null)}
                            className="rounded-[9px] border border-tint-alert-strong bg-surface px-4 py-2 text-sm font-semibold text-coral-dark transition-colors duration-150 ease-out hover:bg-alert-wash"
                          >
                            Ignorer
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              modifierActive(
                                {
                                  points: suggestion.points,
                                  commentaire: suggestion.commentaire,
                                },
                                true,
                              );
                              setSuggestion(null);
                            }}
                            className="rounded-[9px] border border-coral bg-coral px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 ease-out hover:border-coral-dark hover:bg-coral-dark"
                          >
                            Appliquer la suggestion
                          </button>
                        </span>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}
