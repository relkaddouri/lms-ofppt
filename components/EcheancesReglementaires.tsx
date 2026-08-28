import Link from "next/link";
import { formatDate } from "@/lib/format";
import type { Echeance } from "@/lib/echeances";
import { AlertTriangle, CalendarClock, Clock } from "lucide-react";

/**
 * Rappels d'échéances réglementaires.
 *
 * Ils informent : aucune génération, aucun envoi, aucun blocage. Ces délais
 * existent dans le règlement, l'application se contente de les rendre visibles
 * au moment où ils comptent.
 */
export default function EcheancesReglementaires({
  echeances,
  controleHref,
}: {
  echeances: Echeance[];
  controleHref: (id: string) => string;
}) {
  if (echeances.length === 0) return null;

  // Ce qui est déjà loin n'a pas besoin d'être rappelé chaque jour.
  const visibles = echeances.filter(
    (e) => e.etat !== "a_venir" || (e.jours ?? 0) <= 30,
  );
  if (visibles.length === 0) return null;

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h2 className="flex items-center gap-1.5 text-sm font-medium text-ink">
        <CalendarClock className="h-4 w-4 text-slate" aria-hidden />
        Échéances réglementaires
      </h2>

      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {visibles.map((e, i) => {
          const retard = e.etat === "depasse";
          const presse = e.etat === "imminent";
          return (
            <li key={`${e.controleId}-${i}`}>
              <Link
                href={controleHref(e.controleId)}
                className={`block rounded-lg px-2.5 py-2 transition-colors ${
                  retard
                    ? "bg-danger/10 hover:bg-danger/15"
                    : presse
                      ? "bg-info/10 hover:bg-info/15"
                      : "border border-border hover:border-forest/50"
                }`}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span
                    className={`text-xs font-medium ${
                      retard
                        ? "text-danger"
                        : presse
                          ? "text-info"
                          : "text-ink"
                    }`}
                  >
                    {retard ? (
                      <AlertTriangle
                        className="mr-1 inline h-3 w-3"
                        aria-hidden
                      />
                    ) : presse ? (
                      <Clock className="mr-1 inline h-3 w-3" aria-hidden />
                    ) : null}
                    {e.libelle}
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-[11px] text-slate">
                    {e.date ? formatDate(e.date) : "à dater"}
                  </span>
                </span>

                <span className="mt-0.5 block truncate text-[11px] text-slate">
                  {e.groupeNom} · {e.controleLibelle}
                </span>

                {e.jours !== null ? (
                  <span
                    className={`mt-0.5 block text-[11px] ${
                      retard ? "text-danger" : "text-slate"
                    }`}
                  >
                    {e.jours < 0
                      ? `en retard de ${-e.jours} jour${-e.jours > 1 ? "s" : ""}`
                      : e.jours === 0
                        ? "aujourd'hui"
                        : `dans ${e.jours} jour${e.jours > 1 ? "s" : ""}`}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>

      {visibles.some((e) => e.etat === "inconnu") ? (
        <p className="mt-2 text-[11px] text-slate">
          Une échéance « à dater » attend que les séances suivant le contrôle
          soient posées : les notes se rendent à la deuxième d&apos;entre elles.
        </p>
      ) : null}
    </section>
  );
}
