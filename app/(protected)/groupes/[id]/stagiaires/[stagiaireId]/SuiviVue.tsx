import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  FileCheck2,
  Lightbulb,
  Target,
} from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { formatDateJour, formatDateTime } from "@/lib/format";
import type { SuiviStagiaire } from "@/app/actions/suivi";

/**
 * La fiche de suivi d'un stagiaire (demande du 25/09/2026).
 *
 * Trois questions dans l'ordre où un formateur se les pose : travaille-t-il,
 * sur quoi, et qu'est-ce qui ne rentre pas. Les chiffres d'abord, le détail
 * ensuite, les notions qui résistent en évidence — c'est la seule partie de
 * l'écran sur laquelle on peut agir dès la séance suivante.
 */

const duree = (secondes: number) => {
  if (secondes < 60) return `${secondes} s`;
  const m = Math.round(secondes / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
};

function Tuile({
  Icone,
  libelle,
  valeur,
  appoint,
}: {
  Icone: typeof Target;
  libelle: string;
  valeur: string;
  appoint?: string | null;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[14px] border border-border bg-surface p-4 shadow-repos">
      <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-slate-light">
        <Icone size={14} strokeWidth={1.9} aria-hidden />
        {libelle}
      </span>
      <span className="font-display text-[24px] font-bold leading-none text-ink">
        {valeur}
      </span>
      {appoint ? (
        <span className="text-[13px] text-slate">{appoint}</span>
      ) : null}
    </div>
  );
}

export default function SuiviVue({ suivi }: { suivi: SuiviStagiaire }) {
  const { identite, activite, modules, quiz, notions, controles, devoirs } = suivi;
  const notes = controles.filter((c) => c.note !== null);
  const maximum = Math.max(1, ...activite.calendrier.map((j) => j.actions));

  return (
    <div className="flex flex-col gap-5 pb-12">
      <Link
        href={`/groupes/${identite.groupeId}`}
        className="inline-flex min-h-[44px] items-center gap-1.5 self-start text-sm text-slate hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {identite.groupeNom ?? "Le groupe"}
      </Link>

      <header className="flex flex-wrap items-center gap-4 rounded-[14px] border border-border bg-surface p-5 shadow-repos">
        <Avatar
          nom={identite.nom}
          prenom={identite.prenom}
          photo={identite.photo}
          taille="lg"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h1 className="font-display text-[22px] font-bold leading-tight tracking-[-0.02em] text-ink">
            {identite.prenom} {identite.nom}
          </h1>
          <p className="font-mono text-[12.5px] text-slate-light">
            {[
              identite.cef,
              identite.groupeNom,
              identite.aUnCompte ? "compte actif" : "sans compte",
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {activite.derniere ? (
          <span className="rounded-full border border-border bg-wash-strong px-3 py-1 font-mono text-[12px] text-slate-2">
            vu {formatDateTime(activite.derniere)}
          </span>
        ) : (
          <span className="rounded-full border border-tint-alert-strong bg-alert-wash px-3 py-1 font-mono text-[12px] text-coral-dark">
            aucune trace d&apos;activité
          </span>
        )}
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tuile
          Icone={CalendarCheck}
          libelle="Jours actifs"
          valeur={String(activite.joursActifs)}
          appoint={
            activite.premiere
              ? `depuis le ${formatDateJour(activite.premiere.slice(0, 10), { court: true })}`
              : "jamais venu"
          }
        />
        <Tuile
          Icone={Lightbulb}
          libelle="Quiz passés"
          valeur={String(quiz.tentatives)}
          appoint={`${quiz.chapitres} chapitre${quiz.chapitres > 1 ? "s" : ""} · ${quiz.bilans} bilan${quiz.bilans > 1 ? "s" : ""}`}
        />
        <Tuile
          Icone={Target}
          libelle="Réussite aux quiz"
          valeur={quiz.reussite === null ? "—" : `${quiz.reussite} %`}
          appoint={
            activite.secondesQuiz > 0
              ? `${duree(activite.secondesQuiz)} passées à se tester`
              : "aucune tentative"
          }
        />
        <Tuile
          Icone={ClipboardList}
          libelle="Devoirs remis"
          valeur={`${devoirs.remis}`}
          appoint={`${notes.length} contrôle${notes.length > 1 ? "s" : ""} noté${notes.length > 1 ? "s" : ""}`}
        />
      </div>

      {/* Trente jours glissants : c'est la fenêtre où une habitude — ou son
          absence — se reconnaît d'un coup d'œil. */}
      <section className="flex flex-col gap-3 rounded-[14px] border border-border bg-surface p-5 shadow-repos">
        <h2 className="font-display text-[16px] font-semibold text-ink">
          Ces trente derniers jours
        </h2>
        <ol className="flex items-end gap-[3px]">
          {activite.calendrier.map((j) => (
            <li
              key={j.jour}
              title={`${formatDateJour(j.jour, { court: true })} — ${j.actions} action${j.actions > 1 ? "s" : ""}`}
              className="flex-1"
            >
              <span
                className={`block rounded-[3px] ${
                  j.actions > 0 ? "bg-teal" : "bg-wash-strong"
                }`}
                style={{
                  height: j.actions > 0 ? 8 + (j.actions / maximum) * 34 : 8,
                }}
              />
            </li>
          ))}
        </ol>
        <p className="text-[13px] text-slate">
          {activite.actions} action{activite.actions > 1 ? "s" : ""} enregistrée
          {activite.actions > 1 ? "s" : ""} en tout — chapitre lu, quiz passé,
          devoir remis, copie rendue.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="px-1 font-display text-[16px] font-semibold text-ink">
          Où il en est, module par module
        </h2>
        {modules.length === 0 ? (
          <p className="rounded-[14px] border border-border bg-surface p-5 text-sm text-slate shadow-repos">
            Aucun chapitre ne lui a encore été remis.
          </p>
        ) : (
          <ul className="overflow-hidden rounded-[14px] border border-border bg-surface shadow-repos">
            {modules.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center gap-4 border-b border-separator px-5 py-4 last:border-0"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-tint-teal text-teal-dark">
                  <BookOpen size={17} strokeWidth={1.9} aria-hidden />
                </span>
                <span className="flex min-w-[200px] flex-1 flex-col gap-1.5">
                  <span className="text-[15px] font-semibold text-ink">
                    {m.libelle}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 w-full max-w-[240px] overflow-hidden rounded-full bg-wash-strong">
                      <span
                        className="block h-full rounded-full bg-green"
                        style={{ width: `${m.progression}%` }}
                      />
                    </span>
                    <span className="shrink-0 font-mono text-[12px] text-slate">
                      {m.lus}/{m.chapitres} lus
                    </span>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-4 font-mono text-[12.5px] text-slate-light">
                  <span>
                    {m.tentatives} quiz
                    {m.bilans > 0 ? ` · ${m.bilans} bilan${m.bilans > 1 ? "s" : ""}` : ""}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-px font-semibold ${
                      m.reussite === null
                        ? "border-border bg-wash-strong text-slate-2"
                        : m.reussite >= 60
                          ? "border-tint-green bg-success-wash text-green-dark"
                          : "border-tint-alert-strong bg-alert-wash text-coral-dark"
                    }`}
                  >
                    {m.reussite === null ? "pas testé" : `${m.reussite} %`}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="flex flex-col gap-3">
          <h2 className="px-1 font-display text-[16px] font-semibold text-ink">
            Ce qui ne rentre pas
          </h2>
          {notions.length === 0 ? (
            <p className="rounded-[14px] border border-border bg-surface p-5 text-sm text-slate shadow-repos">
              Rien à signaler : aucune question ratée, ou aucun quiz passé.
            </p>
          ) : (
            <ul className="overflow-hidden rounded-[14px] border border-border bg-surface shadow-repos">
              {notions.map((n) => (
                <li
                  key={n.question}
                  className="flex items-start gap-3 border-b border-separator px-4 py-3 last:border-0"
                >
                  <span className="mt-0.5 shrink-0 rounded-full border border-tint-alert-strong bg-alert-wash px-2 py-px font-mono text-[11.5px] font-semibold text-coral-dark">
                    {n.erreurs}/{n.tentatives}
                  </span>
                  <span className="min-w-0 flex-1 text-[14px] leading-snug text-body">
                    {n.question}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="px-1 font-display text-[16px] font-semibold text-ink">
            Ses dernières tentatives
          </h2>
          {quiz.dernieres.length === 0 ? (
            <p className="rounded-[14px] border border-border bg-surface p-5 text-sm text-slate shadow-repos">
              Il ne s&apos;est pas encore testé.
            </p>
          ) : (
            <ul className="overflow-hidden rounded-[14px] border border-border bg-surface shadow-repos">
              {quiz.dernieres.map((t, i) => (
                <li
                  key={`${t.quand}-${i}`}
                  className="flex items-center gap-3 border-b border-separator px-4 py-2.5 last:border-0"
                >
                  <span
                    className={`shrink-0 rounded-[8px] px-2 py-0.5 font-mono text-[11px] font-semibold uppercase ${
                      t.genre === "bilan"
                        ? "bg-ink text-white"
                        : "bg-tint-teal text-teal-dark"
                    }`}
                  >
                    {t.genre === "bilan" ? "bilan" : "quiz"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[14px] text-ink">
                    {t.cible}
                  </span>
                  <span className="shrink-0 font-mono text-[12.5px] text-slate-light">
                    {formatDateJour(t.quand.slice(0, 10), { court: true })}
                  </span>
                  <span
                    className={`shrink-0 font-mono text-[13px] font-semibold ${
                      t.justes * 2 >= t.questions ? "text-green-dark" : "text-coral-dark"
                    }`}
                  >
                    {t.justes}/{t.questions}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="px-1 font-display text-[16px] font-semibold text-ink">
          Ses contrôles
        </h2>
        {controles.length === 0 ? (
          <p className="rounded-[14px] border border-border bg-surface p-5 text-sm text-slate shadow-repos">
            Il n&apos;a encore rendu aucune copie.
          </p>
        ) : (
          <ul className="overflow-hidden rounded-[14px] border border-border bg-surface shadow-repos">
            {controles.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-3 border-b border-separator px-5 py-3 last:border-0"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-wash-strong font-mono text-[11px] font-semibold text-slate-2">
                  {c.type}
                </span>
                <span className="min-w-0 flex-1 truncate text-[14.5px] text-ink">
                  {c.titre}
                </span>
                <span className="shrink-0 font-mono text-[12.5px] text-slate-light">
                  {c.date ? formatDateJour(c.date, { court: true }) : "—"}
                </span>
                <span
                  className={`shrink-0 font-mono text-[14px] font-semibold ${
                    c.note === null
                      ? "text-muted"
                      : c.note >= c.total / 2
                        ? "text-green-dark"
                        : "text-coral-dark"
                  }`}
                >
                  {c.note === null
                    ? c.publie
                      ? "—"
                      : "à corriger"
                    : `${c.note.toLocaleString("fr-FR")}/${c.total}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="flex items-start gap-2 px-1 text-[13px] text-slate-light">
        <FileCheck2 size={15} className="mt-0.5 shrink-0" aria-hidden />
        Les quiz et les bilans ne comptent dans aucune moyenne : ils disent
        seulement ce qui est acquis et ce qui ne l&apos;est pas. Le stagiaire ne
        voit pas cet écran.
      </p>
    </div>
  );
}
