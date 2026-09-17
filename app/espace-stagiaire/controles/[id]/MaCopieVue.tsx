import Link from "next/link";
import type {
  ControleStagiaire,
  MaCopie,
} from "@/app/actions/controles-stagiaire";
import {
  ArrowLeft,
  Check,
  CircleCheck,
  Hourglass,
  MessageSquareText,
  PenLine,
  X,
} from "lucide-react";
import DonneesQuestion from "@/components/DonneesQuestion";
import { CorpsRedige } from "@/components/DocumentRedige";
import RecommencerTest from "./RecommencerTest";

const COULEURS_NUMERO = ["text-coral", "text-teal", "text-green", "text-ink"];

const LIBELLE_TYPE: Record<string, string> = {
  qcm: "Choix multiple",
  ouverte: "Question",
  exercice: "Exercice d'application",
};

const nombre = (n: number) => n.toLocaleString("fr-FR");

/** Vert quand tous les points sont là, corail à zéro, sarcelle entre les deux. */
function tonPoints(points: number, bareme: number) {
  if (bareme > 0 && points >= bareme) return "border-tint-green bg-success-wash text-green-dark";
  if (points <= 0) return "border-tint-alert-strong bg-alert-wash text-coral-dark";
  return "border-tint-teal-strong bg-tint-teal text-teal-dark";
}

/**
 * La copie rendue, vue par son auteur.
 *
 * Avant la publication : la confirmation que la copie est arrivée, rien
 * d'autre — ni note, ni corrigé.
 *
 * Après : le même contrôle qu'il a passé, présenté comme sa passation, et
 * chaque question corrigée. Il compare sa réponse à la bonne — pour un QCM,
 * ses cases cochées à côté des propositions justes —, lit ses points et le
 * commentaire du formateur. Un contrôle se rend pour apprendre de ses
 * erreurs ; une note seule n'apprend rien.
 */
export default function MaCopieVue({
  controle,
  copie,
}: {
  controle: ControleStagiaire;
  copie: MaCopie | null;
}) {
  const nature =
    controle.type === "EFM"
      ? `EFM ${controle.type_efm === "regional" ? "régional" : "local"}`
      : controle.type === "TEST"
        ? "Contrôle de test"
        : "Contrôle continu";

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/espace-stagiaire/controles"
        className="inline-flex min-h-[44px] items-center gap-1.5 self-start text-sm text-slate hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Contrôles
      </Link>

      {/* ── Couverture, avec la note une fois publiée ───────────────────── */}
      <section className="flex flex-col gap-5 rounded-[14px] bg-ink px-5 py-6 text-white md:flex-row md:items-end md:px-10 md:py-9">
        <div className="flex min-w-0 flex-1 flex-col">
          <span aria-hidden className="mb-4 flex items-center gap-1.5">
            {["bg-green", "bg-teal", "bg-coral"].map((c) => (
              <span key={c} className={`h-2.5 w-2.5 rounded-full ${c}`} />
            ))}
          </span>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/50">
            {[nature, controle.codeOperationnel, copie ? "copie corrigée" : "copie rendue"]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <h1 className="mt-2 text-balance font-display text-[24px] font-bold leading-[1.15] tracking-[-0.02em] md:text-[30px]">
            {controle.titre ?? controle.moduleNom ?? "Contrôle"}
          </h1>
          {controle.moduleNom && controle.titre ? (
            <p className="mt-2 text-[15px] leading-relaxed text-white/70">
              {controle.moduleNom}
            </p>
          ) : null}
        </div>
        {copie ? (
          <div className="flex shrink-0 flex-col items-start rounded-[12px] bg-white/[0.08] px-5 py-3 md:items-end">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-white/50">
              Note
            </span>
            <span className="font-display text-[34px] font-bold leading-none tabular-nums">
              {nombre(copie.note)}
              <span className="text-[20px] font-semibold text-white/60"> / {nombre(copie.total)}</span>
            </span>
          </div>
        ) : null}
      </section>

      {controle.compteTest ? (
        <div className="flex flex-col items-start gap-2 rounded-[12px] border border-border bg-wash px-4 py-3">
          <p className="text-sm text-body">
            Compte de test : cette copie n&apos;apparaît ni dans les listes ni
            dans l&apos;analyse. Corrigez-la et publiez-la dans l&apos;onglet
            Copies du contrôle pour voir ce que verra un stagiaire, puis
            effacez-la pour repasser.
          </p>
          <RecommencerTest controleId={controle.id} />
        </div>
      ) : null}

      {!copie ? (
        // §4.7 : tant que le formateur n'a pas publié, le stagiaire ne voit
        // ni note ni corrigé. Le dire ainsi plutôt que « détail non
        // disponible », qui laissait croire à une copie égarée.
        <section className="flex items-start gap-3 rounded-[14px] border border-tint-teal-strong bg-tint-teal px-5 py-4">
          <Hourglass className="mt-0.5 h-5 w-5 shrink-0 text-teal-dark" aria-hidden />
          <p className="text-[15px] leading-relaxed text-ink">
            <span className="font-semibold">Votre copie est bien arrivée.</span>{" "}
            Votre formateur la corrige : la note, la bonne réponse de chaque
            question et ses commentaires s&apos;afficheront ici dès qu&apos;il
            aura publié le résultat.
          </p>
        </section>
      ) : (
        <ol className="flex flex-col gap-6">
          {copie.details.map((d, i) => {
            const qcm = d.type === "qcm" && d.options.length > 0;
            const cochees = new Set(
              d.reponse.split("\n").map((t) => t.trim()).filter(Boolean),
            );
            return (
              <li
                key={d.question_id}
                className="rounded-[14px] border border-border bg-surface px-4 py-5 md:px-7 md:py-6"
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
                    {LIBELLE_TYPE[d.type ?? "ouverte"] ?? "Question"}
                  </span>
                  <span
                    className={`ml-auto whitespace-nowrap rounded-full border px-2.5 py-[3px] font-mono text-[12.5px] font-semibold ${tonPoints(d.points, d.bareme)}`}
                  >
                    {nombre(d.points)} / {nombre(d.bareme)} pt{d.bareme > 1 ? "s" : ""}
                  </span>
                </header>

                <div className="mt-4 [&_li]:text-ink [&_p]:font-medium [&_p]:text-ink md:[&_p]:text-[15.5px]">
                  <CorpsRedige texte={d.enonce} />
                </div>

                {d.donnees?.trim() ? <DonneesQuestion texte={d.donnees} /> : null}

                {qcm ? (
                  // Chaque proposition dit deux choses côte à côte : ce que le
                  // stagiaire a coché, et ce qui était juste.
                  <ul className="mt-5 flex flex-col gap-2">
                    {d.options.map((o, j) => {
                      const coche = cochees.has(o.texte.trim());
                      const ton = o.correcte
                        ? "border-tint-green bg-success-wash"
                        : coche
                          ? "border-tint-alert-strong bg-alert-wash"
                          : "border-border";
                      return (
                        <li
                          key={j}
                          className={`flex min-h-[48px] items-center gap-3 rounded-[10px] border px-3.5 py-2.5 ${ton}`}
                        >
                          <span
                            aria-hidden
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border-[1.5px] ${
                              coche ? "border-ink bg-ink text-white" : "border-border-strong bg-surface"
                            }`}
                          >
                            {coche ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                          </span>
                          <span className="flex-1 text-[15px] leading-snug text-ink md:text-[14.5px]">
                            {o.texte}
                          </span>
                          <span className="sr-only">
                            {coche ? "Vous avez coché. " : "Non coché. "}
                            {o.correcte ? "Proposition juste." : "Proposition fausse."}
                          </span>
                          {o.correcte ? (
                            <span className="inline-flex items-center gap-1 whitespace-nowrap text-[12.5px] font-semibold text-green-dark">
                              <CircleCheck className="h-4 w-4" aria-hidden />
                              Juste
                            </span>
                          ) : coche ? (
                            <span className="inline-flex items-center gap-1 whitespace-nowrap text-[12.5px] font-semibold text-coral-dark">
                              <X className="h-4 w-4" aria-hidden />
                              Fausse
                            </span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <div className="overflow-hidden rounded-[12px] border border-border-strong bg-paper-alt">
                      <p className="flex items-center gap-2 border-b border-separator bg-surface px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-slate-light">
                        <PenLine className="h-3.5 w-3.5" aria-hidden />
                        Votre réponse
                      </p>
                      <p className="whitespace-pre-wrap break-words px-4 py-3 text-[15px] leading-relaxed text-body">
                        {d.reponse.trim() || (
                          <span className="italic text-slate-light">Sans réponse</span>
                        )}
                      </p>
                    </div>
                    <div className="overflow-hidden rounded-[12px] border border-tint-green bg-success-wash">
                      <p className="flex items-center gap-2 border-b border-tint-green px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-green-dark">
                        <CircleCheck className="h-3.5 w-3.5" aria-hidden />
                        Réponse attendue
                      </p>
                      <div className="px-4 py-3">
                        {d.corrige?.trim() ? (
                          <CorpsRedige texte={d.corrige} />
                        ) : (
                          <p className="text-[14px] italic text-slate">
                            Le formateur n&apos;a pas rédigé de réponse type pour cette question.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {d.commentaire.trim() ? (
                  <div className="mt-3 flex gap-3 rounded-[12px] border border-tint-teal-strong bg-tint-teal px-4 py-3">
                    <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-teal-dark" aria-hidden />
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-teal-dark">
                        Commentaire du formateur
                      </span>
                      <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink">
                        {d.commentaire}
                      </p>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
