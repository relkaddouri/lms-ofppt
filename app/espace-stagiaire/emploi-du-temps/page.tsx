import Link from "next/link";
import { CalendarDays, ChevronDown, FileCheck2 } from "lucide-react";
import Badge from "@/components/ui/Badge";
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
  const contenu = (
    <>
      <div className="w-14 shrink-0 text-center">
        {ev.genre === "controle" ? (
          <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-danger/10">
            <FileCheck2 className="h-4 w-4 text-danger" aria-hidden />
          </span>
        ) : (
          <>
            <p className="text-sm font-semibold tabular-nums text-ink">
              {ev.heure_debut ? heure(ev.heure_debut) : "—"}
            </p>
            {ev.heure_fin ? (
              <p className="text-xs tabular-nums text-slate">
                {heure(ev.heure_fin)}
              </p>
            ) : null}
          </>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="text-base font-semibold leading-snug text-ink">
          {ev.titre}
        </h3>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          {ev.genre === "controle" ? (
            <Badge tone="danger">
              {ev.typeControle === "EFM"
                ? ev.typeEfm === "regional"
                  ? "EFM régional"
                  : "EFM"
                : "contrôle"}
            </Badge>
          ) : ev.nature ? (
            <Badge
              tone={ev.nature === "pratique" ? "success" : "info"}
              variant="type"
            >
              {ev.nature === "pratique" ? "pratique" : "théorie"}
            </Badge>
          ) : null}
          <p className="min-w-0 truncate text-xs text-slate">
            {[
              // La durée passe devant : c'est ce qu'on retient d'un contrôle.
              ev.genre === "controle" && ev.dureeHeures
                ? formatHeures(ev.dureeHeures)
                : null,
              ev.codeOperationnel,
              ev.moduleNom,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>
    </>
  );

  const classes =
    "flex min-h-[64px] items-start gap-3 border-b border-border p-4 last:border-0";

  // Un contrôle mène à sa page ; une séance n'a rien de plus à montrer ici.
  return ev.genre === "controle" ? (
    <Link
      href={`/espace-stagiaire/controles/${ev.id}`}
      className={`${classes} hover:bg-mint`}
    >
      {contenu}
    </Link>
  ) : (
    <div className={classes}>{contenu}</div>
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
  return (
    <section>
      <h2 className="flex items-center gap-2 px-1 pb-2 text-sm font-medium text-slate first-letter:uppercase">
        {libelleJour(date, anneeCourante)}
        {date === aujourdhui ? <Badge tone="success">aujourd&apos;hui</Badge> : null}
      </h2>
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        {evenements.map((ev) => (
          <Evenement key={`${ev.genre}-${ev.id}`} ev={ev} />
        ))}
      </div>
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

  return (
    <div className="space-y-6">
      {aVenir.length > 0 ? (
        <div className="space-y-5">
          {aVenir.map(([date, liste]) => (
            <Journee
              key={date}
              date={date}
              evenements={liste}
              aujourdhui={aujourdhui}
              anneeCourante={anneeCourante}
            />
          ))}
        </div>
      ) : (
        <section className="rounded-xl border border-border bg-surface px-4 py-8 text-center">
          <p className="text-sm text-slate">
            Aucune séance à venir n&apos;est planifiée pour le moment.
          </p>
        </section>
      )}

      {passe.length > 0 ? (
        <details className="group">
          <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-center rounded-xl border border-border bg-surface px-4 text-sm font-medium text-slate hover:bg-mint">
            Séances passées ({passe.reduce((n, [, l]) => n + l.length, 0)})
            <ChevronDown
              className="ml-2 h-4 w-4 transition-transform group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <div className="mt-4 space-y-5 opacity-80">
            {passe.map(([date, liste]) => (
              <Journee
                key={date}
                date={date}
                evenements={liste}
                aujourdhui={aujourdhui}
                anneeCourante={anneeCourante}
              />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
