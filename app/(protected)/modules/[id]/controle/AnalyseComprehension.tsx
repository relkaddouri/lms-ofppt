"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Lock, Sparkles, UserRound } from "lucide-react";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formatDateJour, formatDateTime } from "@/lib/format";
import type { EtatComprehension } from "@/lib/analyse-comprehension";
import {
  compterCopiesCorrigees,
  getAnalyses,
  type AnalyseControle,
} from "@/app/actions/controles";

const ETAT: Record<EtatComprehension, { libelle: string; pastille: string; barre: string }> = {
  acquis: {
    libelle: "Acquis",
    pastille: "border-tint-green bg-success-wash text-green-dark",
    barre: "bg-green",
  },
  fragile: {
    libelle: "Fragile",
    pastille: "border-tint-teal-strong bg-tint-teal text-teal-dark",
    barre: "bg-teal",
  },
  non_acquis: {
    libelle: "Non acquis",
    pastille: "border-tint-alert-strong bg-alert-wash text-coral-dark",
    barre: "bg-coral",
  },
};

function Pastille({ etat }: { etat: EtatComprehension }) {
  return (
    <span
      className={`whitespace-nowrap rounded-full border px-2.5 py-[3px] text-[12px] font-semibold ${ETAT[etat].pastille}`}
    >
      {ETAT[etat].libelle}
    </span>
  );
}

const nombre = (n: number) => n.toLocaleString("fr-FR");

function Titre({ children, detail }: { children: string; detail?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h3 className="font-display text-[17px] font-semibold text-ink">{children}</h3>
      {detail ? <span className="text-[13px] text-slate-light">{detail}</span> : null}
    </div>
  );
}

/**
 * L'analyse de compréhension d'un contrôle, dans l'onglet « Analyse »
 * (PRD §4.7bis, atome 10.6).
 *
 * Ce qu'elle dit se lit dans l'ordre où le formateur en a besoin : le niveau
 * de la classe, puis question par question ce qui a été compris et les
 * erreurs qui reviennent, les notions, qui accompagner, et quoi reprendre à
 * quelle séance. Les chiffres viennent des copies ; la lecture, du modèle.
 *
 * Les noms s'affichent ici, et seulement ici : le modèle n'a vu que des
 * pseudonymes, et la correspondance est rendue à l'écran du formateur.
 */
export default function AnalyseComprehension({ controleId }: { controleId: string }) {
  const toast = useToast();
  const [analyses, setAnalyses] = useState<AnalyseControle[] | null>(null);
  const [copies, setCopies] = useState<number | null>(null);
  const [choisie, setChoisie] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function charger(selection?: string) {
    const [a, c] = await Promise.all([
      getAnalyses(controleId),
      compterCopiesCorrigees(controleId),
    ]);
    setAnalyses(a);
    setCopies(c);
    setChoisie(selection ?? a[0]?.id ?? null);
  }

  useEffect(() => {
    setAnalyses(null);
    charger().catch((e) =>
      toast(e instanceof Error ? e.message : "Chargement impossible", "error"),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controleId]);

  async function lancer() {
    setEnCours(true);
    try {
      const res = await fetch("/api/generate/controle/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ controleId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Échec de l'analyse");
      await charger(data.id);
      toast("Analyse terminée.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur inattendue", "error");
    } finally {
      setEnCours(false);
    }
  }

  if (analyses === null || copies === null) {
    return <p className="mt-6 text-sm text-slate">Chargement…</p>;
  }

  const a = analyses.find((x) => x.id === choisie) ?? null;
  const nouvelles = a ? copies - a.nb_copies : 0;

  return (
    <div className="mt-6 flex flex-col gap-5">
      {/* ── En-tête ──────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3 rounded-[14px] border border-border bg-surface px-5 py-4 shadow-repos md:flex-row md:items-center">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="font-display text-[18px] font-semibold text-ink">
            Analyse de compréhension
          </h2>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] text-slate">
            <span>
              {copies} copie{copies > 1 ? "s" : ""} corrigée{copies > 1 ? "s" : ""}
            </span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <Lock className="h-3.5 w-3.5" aria-hidden />
              jamais montrée aux stagiaires, envoyée à l&apos;IA sans les noms
            </span>
          </p>
        </div>
        {analyses.length > 1 ? (
          <select
            aria-label="Analyses précédentes"
            value={choisie ?? ""}
            onChange={(e) => setChoisie(e.target.value)}
            className="rounded-[10px] border border-border-strong bg-surface px-3 py-2 text-[14px] text-body"
          >
            {analyses.map((x, i) => (
              <option key={x.id} value={x.id}>
                {i === 0 ? "Dernière — " : ""}
                {formatDateTime(x.created_at)} · {x.nb_copies} copies
              </option>
            ))}
          </select>
        ) : null}
        <Button
          icon={Sparkles}
          onClick={lancer}
          loading={enCours}
          loadingLabel="Lecture des copies…"
          disabled={enCours || copies === 0}
          title={copies === 0 ? "Aucune copie corrigée à analyser." : undefined}
        >
          {analyses.length ? "Relancer l'analyse" : "Analyser les copies"}
        </Button>
      </section>

      {copies === 0 && !a ? (
        <p className="rounded-[14px] border border-border bg-surface p-5 text-[14.5px] leading-relaxed text-body shadow-repos">
          L&apos;analyse lit les réponses réelles des stagiaires. Elle sera
          possible dès qu&apos;une copie sera corrigée — plus il y en a, plus
          elle est juste.
        </p>
      ) : !a ? (
        <p className="rounded-[14px] border border-border bg-surface p-5 text-[14.5px] leading-relaxed text-body shadow-repos">
          Aucune analyse pour l&apos;instant. Elle dit ce que la classe a
          compris question par question, les erreurs qui reviennent, qui
          accompagner, et quoi reprendre à quelle séance.
          {copies < 3 ? " Avec moins de trois copies, elle en dira peu." : ""}
        </p>
      ) : (
        <>
          {nouvelles > 0 ? (
            <p className="rounded-[12px] border border-tint-teal-strong bg-tint-teal px-4 py-2.5 text-[13.5px] text-ink">
              {nouvelles} copie{nouvelles > 1 ? "s" : ""} corrigée
              {nouvelles > 1 ? "s" : ""} depuis cette analyse : relancez-la pour
              en tenir compte.
            </p>
          ) : null}

          {/* ── Niveau de la classe ────────────────────────────────────── */}
          <section className="flex flex-col gap-4 rounded-[14px] border border-border bg-surface p-5 shadow-repos md:p-6">
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-slate-light">
                Niveau de la classe · {formatDateTime(a.created_at)}
              </span>
              <p className="text-balance font-display text-[22px] font-bold leading-tight text-ink">
                {a.lecture.niveau.appreciation || "—"}
              </p>
            </div>
            <p className="max-w-[70ch] text-[15px] leading-relaxed text-body">
              {a.lecture.niveau.resume}
            </p>

            <dl className="grid grid-cols-2 gap-3 border-t border-separator pt-4 md:grid-cols-4">
              {[
                ["Moyenne", `${nombre(a.statistiques.moyenne)} / ${nombre(a.statistiques.total)}`],
                ["Médiane", `${nombre(a.statistiques.mediane)} / ${nombre(a.statistiques.total)}`],
                ["Copies", String(a.nb_copies)],
                ["À accompagner", String(a.statistiques.aAccompagner.length)],
              ].map(([k, v]) => (
                <div key={k} className="flex flex-col gap-0.5">
                  <dt className="text-[12.5px] text-slate-light">{k}</dt>
                  <dd className="font-mono text-[17px] font-semibold tabular-nums text-ink">{v}</dd>
                </div>
              ))}
            </dl>

            {/* Répartition : une barre, quatre tranches. */}
            <div className="flex flex-col gap-2">
              <div
                className="flex h-3 overflow-hidden rounded-full bg-wash-strong"
                role="img"
                aria-label={`Répartition : ${a.statistiques.repartition.moins40} sous 40 %, ${a.statistiques.repartition.de40a60} de 40 à 60 %, ${a.statistiques.repartition.de60a80} de 60 à 80 %, ${a.statistiques.repartition.plus80} au-dessus de 80 %`}
              >
                {(
                  [
                    ["moins40", "bg-coral"],
                    ["de40a60", "bg-teal/60"],
                    ["de60a80", "bg-teal"],
                    ["plus80", "bg-green"],
                  ] as const
                ).map(([k, c]) =>
                  a.statistiques.repartition[k] > 0 ? (
                    <span
                      key={k}
                      className={c}
                      style={{ width: `${(a.statistiques.repartition[k] / a.nb_copies) * 100}%` }}
                    />
                  ) : null,
                )}
              </div>
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-slate">
                <span>
                  <span className="mr-1 inline-block h-2 w-2 rounded-full bg-coral" />
                  sous 40 % : {a.statistiques.repartition.moins40}
                </span>
                <span>
                  <span className="mr-1 inline-block h-2 w-2 rounded-full bg-teal/60" />
                  40–60 % : {a.statistiques.repartition.de40a60}
                </span>
                <span>
                  <span className="mr-1 inline-block h-2 w-2 rounded-full bg-teal" />
                  60–80 % : {a.statistiques.repartition.de60a80}
                </span>
                <span>
                  <span className="mr-1 inline-block h-2 w-2 rounded-full bg-green" />
                  80 % et plus : {a.statistiques.repartition.plus80}
                </span>
              </p>
            </div>
          </section>

          {/* ── Question par question ──────────────────────────────────── */}
          <section className="flex flex-col gap-3 rounded-[14px] border border-border bg-surface p-5 shadow-repos md:p-6">
            <Titre detail="taux = points obtenus sur points possibles">Question par question</Titre>
            <ol className="flex flex-col divide-y divide-separator">
              {a.statistiques.questions.map((q) => {
                const l = a.lecture.questions.find((x) => x.numero === q.numero);
                const e = l?.etat ?? q.etat;
                return (
                  <li key={q.numero} className="flex flex-col gap-2 py-4 first:pt-1 last:pb-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <span className="font-display text-[20px] font-bold leading-none text-ink">
                        {q.numero}
                      </span>
                      <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-slate-light">
                        {q.type} · {nombre(q.bareme)} pts
                      </span>
                      <Pastille etat={e} />
                      <span className="ml-auto flex items-center gap-2 text-[13px] text-slate">
                        <span className="relative h-2 w-28 overflow-hidden rounded-full bg-wash-strong">
                          <span
                            className={`absolute inset-y-0 left-0 ${ETAT[e].barre}`}
                            style={{ width: `${Math.min(100, q.taux)}%` }}
                          />
                        </span>
                        <span className="font-mono tabular-nums text-ink">{nombre(q.taux)} %</span>
                        <span className="hidden md:inline">
                          · réussite {nombre(q.reussite)} %{q.vides ? ` · ${q.vides} sans réponse` : ""}
                        </span>
                      </span>
                    </div>
                    {l?.erreurs_frequentes.length ? (
                      <ul className="flex flex-col gap-1 pl-[34px]">
                        {l.erreurs_frequentes.map((er) => (
                          <li key={er} className="flex gap-2 text-[14px] leading-snug text-body">
                            <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-coral" />
                            {er}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {l?.lecture ? (
                      <p className="pl-[34px] text-[14px] leading-relaxed text-slate-2">{l.lecture}</p>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </section>

          {/* ── Notions ────────────────────────────────────────────────── */}
          {a.lecture.notions.length > 0 ? (
            <section className="flex flex-col gap-3 rounded-[14px] border border-border bg-surface p-5 shadow-repos md:p-6">
              <Titre>Notions évaluées</Titre>
              <ul className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
                {a.lecture.notions.map((n) => (
                  <li
                    key={n.notion}
                    className="flex flex-col gap-2 rounded-[12px] border border-border bg-paper-alt px-4 py-3"
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-[14.5px] font-semibold leading-snug text-ink">{n.notion}</span>
                      <Pastille etat={n.etat} />
                    </span>
                    {n.constat ? (
                      <span className="text-[13.5px] leading-relaxed text-slate-2">{n.constat}</span>
                    ) : null}
                    {n.questions.length ? (
                      <span className="font-mono text-[12px] text-slate-light">
                        question{n.questions.length > 1 ? "s" : ""} {n.questions.join(", ")}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* ── À accompagner ──────────────────────────────────────────── */}
          <section className="flex flex-col gap-3 rounded-[14px] border border-border bg-surface p-5 shadow-repos md:p-6">
            <Titre detail="sous 50 % des points">Stagiaires à accompagner</Titre>
            {a.statistiques.aAccompagner.length === 0 ? (
              <p className="text-[14.5px] text-body">Aucun stagiaire sous la moitié des points.</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {a.statistiques.aAccompagner.map((p) => {
                  const s = a.statistiques.stagiaires.find((x) => x.pseudo === p);
                  const l = a.lecture.stagiaires.find((x) => x.pseudo === p);
                  return (
                    <li key={p} className="flex gap-3 rounded-[12px] border border-border bg-paper-alt px-4 py-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-wash-strong text-slate-2">
                        <UserRound className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="flex flex-wrap items-baseline gap-x-2">
                          <span className="text-[15px] font-semibold text-ink">
                            {a.pseudonymes[p] ?? p}
                          </span>
                          <span className="font-mono text-[12px] text-slate-light">
                            {p} · {s ? `${nombre(s.taux)} %` : ""}
                            {s?.echecs.length ? ` · questions ${s.echecs.join(", ")}` : ""}
                          </span>
                        </span>
                        {l?.constat ? (
                          <span className="text-[14px] leading-relaxed text-body">{l.constat}</span>
                        ) : null}
                        {l?.accompagnement ? (
                          <span className="text-[14px] leading-relaxed text-slate-2">
                            <span className="font-semibold text-ink">À faire : </span>
                            {l.accompagnement}
                          </span>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* ── Ajustements ────────────────────────────────────────────── */}
          {a.lecture.ajustements.length > 0 ? (
            <section className="flex flex-col gap-3 rounded-[14px] border border-border bg-surface p-5 shadow-repos md:p-6">
              <Titre>Ce qu&apos;il faut ajuster</Titre>
              <ol className="flex flex-col gap-3">
                {a.lecture.ajustements.map((j, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-ink font-mono text-[13px] font-semibold text-white">
                      {i + 1}
                    </span>
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="text-[15px] font-semibold leading-snug text-ink">{j.action}</span>
                      {j.pourquoi ? (
                        <span className="text-[14px] leading-relaxed text-slate-2">{j.pourquoi}</span>
                      ) : null}
                      {j.seance || j.duree_minutes ? (
                        <span className="inline-flex items-center gap-1.5 font-mono text-[12.5px] text-teal-dark">
                          <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                          {[
                            j.seance ? `séance du ${formatDateJour(j.seance)}` : null,
                            j.duree_minutes ? `${j.duree_minutes} min` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          <p className="text-center font-mono text-[12px] text-slate-light">
            Chiffres calculés sur les copies · lecture par {a.modele ?? "le modèle"} ·
            relisez-la comme une proposition
          </p>
        </>
      )}
    </div>
  );
}
