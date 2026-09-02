import Link from "next/link";
import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  FileCheck2,
  FileText,
  FlaskConical,
} from "lucide-react";
import { formatHeures } from "@/lib/format";
import {
  getMonEmploiDuTemps,
  type EvenementStagiaire,
} from "@/app/actions/stagiaire";
import EnConstruction from "../EnConstruction";

export const metadata = { title: "Emploi du temps" };

/** « mardi 1 septembre » — l'année n'apparaît que si elle change. */
function libelleJour(date: string, anneeCourante: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  return d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(d.getUTCFullYear() === anneeCourante ? {} : { year: "numeric" }),
    timeZone: "UTC",
  });
}

/** « 08:30 » sans les secondes que renvoie Postgres. */
const heure = (h: string) => h.slice(0, 5);

function Evenement({ ev }: { ev: EvenementStagiaire }) {
  const controle = ev.genre === "controle";
  const pratique = ev.nature === "pratique";

  return (
    <div className="flex gap-[13px] border-b border-separator bg-surface px-5 py-4">
      {/* Rail horaire : début en haut, fin en bas, reliés par un filet —
          on lit la durée d'un coup d'œil sans lire les deux heures. */}
      <div className="flex w-[52px] shrink-0 flex-col items-center gap-2">
        {ev.heure_debut ? (
          <>
            <span className="font-mono text-sm font-medium text-ink">
              {heure(ev.heure_debut)}
            </span>
            <span
              aria-hidden
              className="min-h-[14px] w-px flex-1 bg-separator"
            />
            <span className="font-mono text-xs text-border-strong">
              {ev.heure_fin ? heure(ev.heure_fin) : ""}
            </span>
          </>
        ) : (
          // Un contrôle n'a qu'une date : le rail montre sa durée plutôt
          // qu'un tiret et un filet qui ne relient rien.
          <span className="font-mono text-[13px] font-medium text-coral-dark">
            {ev.dureeHeures ? formatHeures(ev.dureeHeures) : "à situer"}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-[11px]">
        <div className="flex items-start gap-[11px]">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${
              controle
                ? "bg-alert-wash"
                : pratique
                  ? "bg-success-wash"
                  : "bg-tint-teal"
            }`}
          >
            {controle ? (
              <FileCheck2
                size={17}
                strokeWidth={1.9}
                aria-hidden
                className="text-coral-dark"
              />
            ) : pratique ? (
              <FlaskConical
                size={17}
                strokeWidth={1.9}
                aria-hidden
                className="text-green-dark"
              />
            ) : (
              <BookOpen
                size={17}
                strokeWidth={1.9}
                aria-hidden
                className="text-teal-dark"
              />
            )}
          </span>

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-[15.5px] font-semibold leading-snug text-ink">
              {ev.titre}
            </span>
            <div className="flex flex-wrap items-center gap-[9px]">
              <span className="font-mono text-[12.5px] text-slate-light">
                {[ev.codeOperationnel, ev.moduleNom].filter(Boolean).join(" · ")}
              </span>
              <span
                className={`whitespace-nowrap rounded-full border px-2 py-px text-[11.5px] font-semibold ${
                  controle
                    ? "border-tint-alert-strong bg-alert-wash text-coral-dark"
                    : pratique
                      ? "border-tint-green bg-success-wash text-green-dark"
                      : "border-tint-teal-strong bg-tint-teal text-teal-dark"
                }`}
              >
                {controle
                  ? ev.typeControle === "EFM"
                    ? ev.typeEfm === "regional"
                      ? "EFM régional"
                      : "EFM"
                    : "contrôle"
                  : pratique
                    ? "pratique"
                    : "théorie"}
              </span>
            </div>
            {/* La maquette place ici la salle ; le modèle n'en a pas. La durée
                d'un contrôle est ce que la donnée offre à cet endroit. */}
            {/* La maquette place ici la salle ; le modèle n'en a pas. */}
          </div>
        </div>

        {controle ? (
          <Link
            href={`/espace-stagiaire/controles/${ev.id}`}
            className="flex min-h-[44px] w-full items-center justify-center gap-2.5 rounded-xl border border-ink bg-ink px-4 py-3 text-[14.5px] font-semibold text-white no-underline transition-colors duration-150 ease-out hover:border-ofppt-ink-dark hover:bg-ofppt-ink-dark hover:no-underline"
          >
            <FileCheck2 size={16} strokeWidth={2.1} aria-hidden />
            Ouvrir le contrôle
          </Link>
        ) : ev.supportId ? (
          <Link
            href={`/espace-stagiaire/cours/${ev.supportId}`}
            className="inline-flex min-h-[40px] items-center gap-2 self-start rounded-full border border-tint-teal-strong bg-tint-teal px-3.5 py-2 text-[13.5px] font-semibold text-teal-dark no-underline transition-colors duration-150 ease-out hover:bg-tint-teal-strong hover:no-underline"
          >
            <FileText size={14} aria-hidden />
            Support disponible
            <ChevronRight size={13} strokeWidth={2.4} aria-hidden />
          </Link>
        ) : (
          <span className="inline-flex items-center gap-2 self-start rounded-full border border-separator bg-paper px-3.5 py-2 text-[13px] text-muted">
            <CircleAlert size={13} aria-hidden />
            Support à venir
          </span>
        )}
      </div>
    </div>
  );
}

function Journee({
  date,
  evenements,
  aujourdhui,
  anneeCourante,
}: {
  date: string;
  evenements: EvenementStagiaire[];
  aujourdhui: string;
  anneeCourante: number;
}) {
  const cejour = date === aujourdhui;
  return (
    <section>
      <h2
        className={`sticky top-[71px] z-20 flex items-center gap-2.5 border-y border-separator px-5 py-2.5 ${
          cejour ? "bg-tint-teal" : "bg-paper-alt"
        }`}
      >
        <span
          className={`font-display text-sm font-semibold first-letter:uppercase ${
            cejour ? "text-teal-dark" : "text-ink"
          }`}
        >
          {libelleJour(date, anneeCourante)}
        </span>
        <span className="ml-auto font-mono text-xs text-muted">
          {evenements.length} créneau{evenements.length > 1 ? "x" : ""}
        </span>
      </h2>
      {evenements.map((ev) => (
        <Evenement key={`${ev.genre}-${ev.id}`} ev={ev} />
      ))}
    </section>
  );
}

/** Regroupe le fil chronologique par date, en gardant l'ordre reçu. */
function parJour(evenements: EvenementStagiaire[]) {
  const jours = new Map<string, EvenementStagiaire[]>();
  for (const ev of evenements) {
    const liste = jours.get(ev.date);
    if (liste) liste.push(ev);
    else jours.set(ev.date, [ev]);
  }
  return [...jours.entries()];
}

export default async function EmploiDuTempsPage() {
  const evenements = await getMonEmploiDuTemps();

  if (evenements.length === 0) {
    return (
      <EnConstruction
        titre="Emploi du temps"
        description="Vos séances et vos dates de contrôle apparaîtront ici dès que votre formateur les aura planifiées."
        Icone={CalendarDays}
      />
    );
  }

  const aujourdhui = new Date().toISOString().slice(0, 10);
  const anneeCourante = new Date().getUTCFullYear();

  // Ce qui reste à venir d'abord : le passé n'est qu'une référence.
  const aVenir = parJour(evenements.filter((e) => e.date >= aujourdhui));
  const passe = parJour(evenements.filter((e) => e.date < aujourdhui)).reverse();

  const semaine = Math.ceil(
    ((Date.now() - new Date(new Date().getUTCFullYear(), 0, 1).getTime()) /
      86400000 +
      1) /
      7,
  );
  const aVenirCompte = evenements.filter((e) => e.date >= aujourdhui).length;

  return (
    <div className="bg-surface md:overflow-hidden md:rounded-[14px] md:border md:border-border">
      <div className="flex flex-col gap-1.5 px-5 pb-4 pt-[22px]">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
          Semaine {semaine}
        </span>
        <h1 className="font-display text-[26px] font-bold leading-tight tracking-[-0.02em] text-ink">
          Emploi du temps
        </h1>
        <span className="text-[14.5px] text-slate-light">
          À venir en premier ·{" "}
          <span className="font-mono text-body">{aVenirCompte}</span> échéance
          {aVenirCompte > 1 ? "s" : ""} à suivre
        </span>
      </div>

      {aVenir.length > 0 ? (
        aVenir.map(([date, liste]) => (
          <Journee
            key={date}
            date={date}
            evenements={liste}
            aujourdhui={aujourdhui}
            anneeCourante={anneeCourante}
          />
        ))
      ) : (
        <p className="border-t border-separator px-5 py-10 text-center text-sm text-slate-light">
          Aucune séance à venir n&apos;est planifiée pour le moment.
        </p>
      )}

      {passe.length > 0 ? (
        <details className="group border-t border-separator">
          <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-center gap-2 px-5 text-sm font-semibold text-slate-2 transition-colors duration-150 ease-out hover:bg-paper-alt hover:text-ink">
            Séances passées ({passe.reduce((n, [, l]) => n + l.length, 0)})
            <ChevronDown
              size={16}
              aria-hidden
              className="transition-transform duration-150 ease-out group-open:rotate-180"
            />
          </summary>
          {passe.map(([date, liste]) => (
            <Journee
              key={date}
              date={date}
              evenements={liste}
              aujourdhui={aujourdhui}
              anneeCourante={anneeCourante}
            />
          ))}
        </details>
      ) : (
        <div className="flex justify-center border-t border-separator px-5 pb-2 pt-6">
          <span className="font-mono text-xs text-border-strong">
            Séances passées plus bas dans l&apos;historique
          </span>
        </div>
      )}
    </div>
  );
}
