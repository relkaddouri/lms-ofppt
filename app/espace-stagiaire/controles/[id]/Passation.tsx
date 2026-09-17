"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import AutoTextarea from "@/components/ui/AutoTextarea";
import DonneesQuestion from "@/components/DonneesQuestion";
import { CorpsRedige } from "@/components/DocumentRedige";
import { ConfirmModal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import type {
  ControleStagiaire,
  QuestionSujet,
} from "@/app/actions/controles-stagiaire";
import { ArrowLeft, Check, PenLine, Send, Timer } from "lucide-react";

/**
 * Composition d'un contrôle en ligne (PRD §4.7bis).
 *
 * Présenté comme les supports de cours que le stagiaire connaît — couverture
 * encre, questions numérotées en gros chiffres de couleur, tableaux à en-tête
 * encre — plutôt qu'en formulaire : il lit un sujet, puis il compose.
 *
 * La place pour répondre suit ce que la question demande, comme sur le sujet
 * imprimé : quelques lignes pour une définition, une vraie page pour un
 * exercice. Et rien ne se perd : la copie en cours est gardée sur l'appareil à
 * chaque frappe, qu'un onglet se ferme ou que le réseau tombe avant la remise.
 *
 * Les propositions de QCM arrivent sans leur drapeau « correcte » — la base ne
 * le laisse pas sortir. Les réponses cochées sont stockées une par ligne,
 * forme que la correction compare côté serveur.
 *
 * `apercu` : le même écran, montré au formateur dans l'onglet « Aperçu » de
 * son éditeur. On peut y cocher et y écrire pour éprouver la place de réponse,
 * mais rien n'est gardé ni rendu.
 */

const COULEURS_NUMERO = ["text-coral", "text-teal", "text-green", "text-ink"];

const LIBELLE_TYPE: Record<string, string> = {
  qcm: "Choix multiple",
  ouverte: "Question",
  exercice: "Exercice d'application",
};

/** « 12:04 » ou « 1:05:09 » : le temps restant, lisible d'un coup d'œil. */
function chrono(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const deux = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${deux(m)}:${deux(sec)}` : `${m}:${deux(sec)}`;
}

const points = (b: number) =>
  `${String(b).replace(".", ",")} pt${b > 1 ? "s" : ""}`;

/** Lignes de départ du champ de réponse, proportionnées au barème. */
function lignesDeReponse(q: QuestionSujet): number {
  const b = Math.max(0.5, Number(q.bareme) || 0);
  if (q.type === "exercice") return Math.min(24, Math.max(10, Math.round(b * 3)));
  return Math.min(12, Math.max(4, Math.round(b * 2 + 2)));
}

export default function Passation({
  controle,
  sujet,
  apercu = false,
}: {
  controle: ControleStagiaire;
  sujet: QuestionSujet[];
  apercu?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const cle = `pedago:copie:${controle.id}`;
  const [reponses, setReponses] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [confirme, setConfirme] = useState(false);
  const [gardee, setGardee] = useState(false);
  const restauree = useRef(false);

  // ── Test chronométré ────────────────────────────────────────────────────
  //
  // La fin vient de la base (`ferme_le`), pas d'une minuterie lancée à
  // l'ouverture de la page : recharger, ou arriver en retard, ne rend pas de
  // temps. À zéro, la copie part d'elle-même avec ce qui est écrit.
  //
  // Le compte de test du formateur passe souvent un brouillon, qui n'a pas de
  // fermeture. Il a quand même son chronomètre : la durée du contrôle, à
  // partir de sa première ouverture — gardée sur l'appareil, pour qu'un
  // rechargement ne rende pas de temps non plus. C'est ainsi qu'il éprouve
  // le rythme du sujet avant de le donner.
  const cleDebut = `pedago:debut-test:${controle.id}`;
  const dureeMs = Number(controle.duree_heures) > 0 ? Number(controle.duree_heures) * 3_600_000 : 0;
  const [fin, setFin] = useState<number | null>(() =>
    !apercu && controle.ferme_le ? new Date(controle.ferme_le).getTime() : null,
  );
  const [chronoDeTest, setChronoDeTest] = useState(false);
  const [reste, setReste] = useState<number | null>(() =>
    fin === null ? null : fin - Date.now(),
  );

  useEffect(() => {
    if (apercu || !controle.compteTest || controle.ferme_le || dureeMs === 0) return;
    let debut = Date.now();
    try {
      const garde = Number(localStorage.getItem(cleDebut));
      // Un chronomètre déjà écoulé repart : le formateur revient essayer.
      if (garde > 0 && garde + dureeMs > Date.now()) debut = garde;
      localStorage.setItem(cleDebut, String(debut));
    } catch {
      // Stockage indisponible : le chronomètre part de cette ouverture.
    }
    setChronoDeTest(true);
    setFin(debut + dureeMs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controle.id, controle.compteTest, controle.ferme_le, dureeMs, apercu]);
  const reponsesRef = useRef(reponses);
  reponsesRef.current = reponses;
  const partie = useRef(false);

  useEffect(() => {
    if (fin === null) return;
    // Une nouvelle fin — le formateur a rouvert le test — rarme la remise.
    partie.current = false;
    const tic = () => {
      const r = fin - Date.now();
      setReste(r);
      if (r <= 0 && !partie.current) {
        partie.current = true;
        const ecrites = Object.values(reponsesRef.current).some((v) => v.trim());
        if (ecrites) {
          toast("Temps écoulé : votre copie est rendue.");
          void rendre();
        } else {
          toast(
            chronoDeTest
              ? "Temps écoulé : aucune réponse écrite, rien n'a été rendu."
              : "Temps écoulé : le test est fermé.",
            "error",
          );
          router.refresh();
        }
      }
    };
    tic();
    const minuterie = window.setInterval(tic, 1000);
    return () => window.clearInterval(minuterie);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fin]);

  // La copie en cours revient telle qu'on l'a laissée.
  useEffect(() => {
    if (apercu) return;
    try {
      const brut = localStorage.getItem(cle);
      if (brut) {
        const lu = JSON.parse(brut) as Record<string, string>;
        const ids = new Set(sujet.map((q) => q.id));
        const utiles = Object.fromEntries(
          Object.entries(lu).filter(([k, v]) => ids.has(k) && typeof v === "string"),
        );
        if (Object.values(utiles).some((v) => v.trim())) {
          setReponses(utiles);
          toast("Votre copie en cours a été retrouvée.");
        }
      }
    } catch {
      // Stockage indisponible (navigation privée) : on compose sans filet.
    }
    restauree.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);

  useEffect(() => {
    if (apercu || !restauree.current) return;
    try {
      localStorage.setItem(cle, JSON.stringify(reponses));
      setGardee(true);
    } catch {
      setGardee(false);
    }
  }, [cle, reponses]);

  const repondues = sujet.filter((q) => (reponses[q.id] ?? "").trim()).length;
  const total = sujet.reduce((t, q) => t + (Number(q.bareme) || 0), 0);

  const ecrire = (id: string, valeur: string) =>
    setReponses((r) => ({ ...r, [id]: valeur }));

  async function rendre() {
    setBusy(true);
    try {
      const res = await fetch("/api/controle/passer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          controleId: controle.id,
          reponses: reponsesRef.current,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Remise impossible.");
      try {
        localStorage.removeItem(cle);
        localStorage.removeItem(cleDebut);
      } catch {
        // Rien à nettoyer.
      }
      toast("Copie rendue");
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Remise impossible.", "error");
    } finally {
      setBusy(false);
      setConfirme(false);
    }
  }

  const nature =
    controle.type === "EFM"
      ? `EFM ${controle.type_efm === "regional" ? "régional" : "local"}`
      : controle.type === "TEST"
        ? "Contrôle de test"
        : "Contrôle continu";

  return (
    <div className="flex flex-col gap-6">
      {apercu ? null : (
        <Link
          href="/espace-stagiaire/controles"
          className="inline-flex min-h-[44px] items-center gap-1.5 self-start text-sm text-slate hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Contrôles
        </Link>
      )}

      {/* ── Couverture ───────────────────────────────────────────────────── */}
      <section className="flex flex-col rounded-[14px] bg-ink px-5 py-6 text-white md:px-10 md:py-9">
        <span aria-hidden className="mb-4 flex items-center gap-1.5">
          {["bg-green", "bg-teal", "bg-coral"].map((c) => (
            <span key={c} className={`h-2.5 w-2.5 rounded-full ${c}`} />
          ))}
        </span>
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/50">
          {[nature, controle.codeOperationnel].filter(Boolean).join(" · ")}
        </p>
        <h1 className="mt-2 text-balance font-display text-[24px] font-bold leading-[1.15] tracking-[-0.02em] md:text-[32px]">
          {controle.titre ?? controle.moduleNom ?? "Contrôle"}
        </h1>
        {controle.moduleNom && controle.titre ? (
          <p className="mt-2 text-[15px] leading-relaxed text-white/70">
            {controle.moduleNom}
          </p>
        ) : null}
        <dl className="mt-5 grid grid-cols-3 gap-2 rounded-[10px] bg-white/[0.06] px-4 py-3 text-[13px]">
          {[
            ["Durée", controle.duree_heures ? `${controle.duree_heures} h` : "—"],
            ["Barème", `${String(total).replace(".", ",")} pts`],
            ["Questions", String(sujet.length)],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-col gap-0.5">
              <dt className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-white/45">
                {k}
              </dt>
              <dd className="font-semibold tabular-nums text-white/90">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {controle.consignes?.trim() ? (
        <section className="rounded-[14px] border border-border bg-surface px-5 py-4 md:px-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-slate-light">
            Consignes
          </p>
          <div className="mt-2">
            <CorpsRedige texte={controle.consignes} />
          </div>
        </section>
      ) : null}

      {/* ── Les questions ────────────────────────────────────────────────── */}
      <ol className="flex flex-col gap-6">
        {sujet.map((q, i) => {
          const repondu = Boolean((reponses[q.id] ?? "").trim());
          return (
            <li
              key={q.id}
              id={`question-${i + 1}`}
              className="scroll-mt-24 rounded-[14px] border border-border bg-surface px-4 py-5 md:px-7 md:py-6"
            >
              <header className="flex items-baseline gap-3 border-b border-border-strong pb-2.5">
                <span
                  className={`font-display text-[28px] font-bold leading-none ${
                    COULEURS_NUMERO[i % COULEURS_NUMERO.length]
                  }`}
                >
                  {i + 1}
                </span>
                <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-slate-light">
                  {LIBELLE_TYPE[q.type ?? "ouverte"] ?? "Question"}
                </span>
                <span className="ml-auto whitespace-nowrap rounded-full bg-wash-strong px-2.5 py-[3px] font-mono text-[12.5px] font-semibold text-ink">
                  {points(Number(q.bareme) || 0)}
                </span>
              </header>

              <div className="mt-4 [&_li]:text-ink [&_p]:font-medium [&_p]:text-ink md:[&_p]:text-[15.5px]">
                <CorpsRedige texte={q.enonce} />
              </div>

              {/* Les données de la question, sur l'écran même où l'on répond :
                  le contrôle se passe en ligne, et le stagiaire n'a rien
                  d'autre sous la main que ce qui s'affiche ici. */}
              {q.donnees?.trim() ? <DonneesQuestion texte={q.donnees} /> : null}

              {q.type === "qcm" && q.options?.length ? (
                <fieldset className="mt-5">
                  <legend className="font-mono text-[11px] uppercase tracking-[0.12em] text-slate-light">
                    Cochez la ou les bonnes propositions
                  </legend>
                  <div className="mt-2.5 flex flex-col gap-2">
                    {q.options.map((opt, j) => {
                      const cochees = (reponses[q.id] ?? "")
                        .split("\n")
                        .filter(Boolean);
                      const coche = cochees.includes(opt.texte);
                      return (
                        <label
                          key={j}
                          className={`flex min-h-[48px] cursor-pointer items-center gap-3 rounded-[10px] border px-3.5 py-2.5 transition-colors duration-150 ${
                            coche
                              ? "border-ink bg-wash"
                              : "border-border hover:border-border-strong"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={coche}
                            onChange={(e) => {
                              const restant = cochees.filter(
                                (c) => c !== opt.texte,
                              );
                              ecrire(
                                q.id,
                                (e.target.checked
                                  ? [...restant, opt.texte]
                                  : restant
                                ).join("\n"),
                              );
                            }}
                            className="h-5 w-5 shrink-0 accent-ink"
                          />
                          <span className="text-[15px] leading-snug text-ink md:text-[14.5px]">
                            {opt.texte}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ) : (
                <div className="mt-5 overflow-hidden rounded-[12px] border border-border-strong bg-paper-alt focus-within:border-ink">
                  <label
                    htmlFor={`reponse-${q.id}`}
                    className="flex items-center gap-2 border-b border-separator bg-surface px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-slate-light"
                  >
                    <PenLine className="h-3.5 w-3.5" aria-hidden />
                    Votre réponse
                    <span className="ml-auto normal-case tracking-normal">
                      {(reponses[q.id] ?? "").trim()
                        ? `${(reponses[q.id] ?? "").trim().split(/\s+/).length} mots`
                        : ""}
                    </span>
                  </label>
                  <AutoTextarea
                    id={`reponse-${q.id}`}
                    value={reponses[q.id] ?? ""}
                    minRows={lignesDeReponse(q)}
                    onChange={(e) => ecrire(q.id, e.target.value)}
                    placeholder={
                      q.type === "exercice"
                        ? "Rédigez votre réponse ici. Prenez le temps : vous pouvez aller à la ligne, faire des listes (- …) ou des tableaux."
                        : "Rédigez votre réponse ici…"
                    }
                    aria-label={`Réponse à la question ${i + 1}`}
                    className="!rounded-none !border-0 !bg-transparent px-4 py-3 text-[16px] leading-[1.75] !shadow-none focus:!ring-0 md:text-[15px]"
                  />
                </div>
              )}

              {repondu ? (
                <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-green-dark">
                  <Check className="h-3.5 w-3.5" aria-hidden />
                  Répondue
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>

      {/* ── Remise ───────────────────────────────────────────────────────── */}
      <div className="sticky bottom-24 z-10 flex flex-col gap-2.5 rounded-[14px] border border-border bg-surface p-3 shadow-ancre md:bottom-4 md:flex-row md:items-center md:gap-4">
        {reste !== null ? (
          <span
            role="timer"
            aria-live="off"
            aria-label={`Temps restant : ${chrono(reste)}`}
            className={`inline-flex items-center gap-1.5 self-start rounded-[8px] px-2.5 py-1.5 font-mono text-[15px] font-semibold tabular-nums ${
              reste <= 5 * 60_000
                ? "bg-alert-wash text-coral-dark"
                : "bg-wash-strong text-ink"
            }`}
          >
            <Timer className="h-4 w-4" aria-hidden />
            {chrono(reste)}
            {chronoDeTest ? (
              <span className="ml-1 font-sans text-[11.5px] font-normal text-slate">
                durée du contrôle
              </span>
            ) : null}
          </span>
        ) : null}
        <nav
          aria-label="Aller à une question"
          className="flex flex-wrap gap-1.5"
        >
          {sujet.map((q, i) => {
            const fait = Boolean((reponses[q.id] ?? "").trim());
            return (
              <a
                key={q.id}
                href={`#question-${i + 1}`}
                aria-label={`Question ${i + 1}${fait ? ", répondue" : ""}`}
                className={`flex h-8 min-w-8 items-center justify-center rounded-[8px] px-2 font-mono text-[12.5px] font-semibold ${
                  fait
                    ? "bg-ink text-white"
                    : "border border-border text-slate-2 hover:border-border-strong"
                }`}
              >
                {i + 1}
              </a>
            );
          })}
        </nav>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 md:ml-auto md:flex-nowrap">
          <p className="text-[13px] text-slate">
            {repondues} sur {sujet.length} répondue{repondues > 1 ? "s" : ""}
            {apercu
              ? " · aperçu, rien n'est enregistré"
              : gardee && repondues > 0
                ? " · gardée sur cet appareil"
                : ""}
          </p>
          <Button
            icon={Send}
            className="min-h-[44px] max-md:w-full"
            onClick={() => setConfirme(true)}
            disabled={apercu || busy || repondues === 0}
            title={apercu ? "Aperçu : la remise est désactivée." : undefined}
          >
            {busy ? "Remise…" : "Rendre ma copie"}
          </Button>
        </div>
      </div>

      <ConfirmModal
        open={confirme}
        title="Rendre votre copie ?"
        message={
          repondues < sujet.length
            ? `Il reste ${sujet.length - repondues} question${sujet.length - repondues > 1 ? "s" : ""} sans réponse. Une copie rendue ne peut plus être modifiée.`
            : "Une copie rendue ne peut plus être modifiée."
        }
        confirmLabel="Rendre"
        busy={busy}
        onConfirm={rendre}
        onClose={() => setConfirme(false)}
      />
    </div>
  );
}
