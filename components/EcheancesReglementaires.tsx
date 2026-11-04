"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDateJour } from "@/lib/format";
import type { Echeance } from "@/lib/echeances";
import { marquerEcheance } from "@/app/actions/echeances";
import { useToast } from "@/components/ui/Toast";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  ChevronRight,
  Clock,
} from "lucide-react";

const cleDe = (e: Echeance) => `${e.controleId}|${e.type}`;

/**
 * Rappels d'échéances réglementaires.
 *
 * Ils informent : aucune génération, aucun envoi, aucun blocage. Ces délais
 * existent dans le règlement, l'application se contente de les rendre visibles
 * au moment où ils comptent. Le formateur coche ce qu'il a accompli : la case
 * change aussitôt, l'écriture suit en arrière-plan.
 */
export default function EcheancesReglementaires({
  echeances,
  controleHref,
}: {
  echeances: Echeance[];
  controleHref: (id: string) => string;
}) {
  const toast = useToast();
  // Ce que le formateur vient de cocher ou décocher : la page n'est pas
  // rechargée après l'écriture, c'est cet état qui fait foi à l'écran.
  const [surcharges, setSurcharges] = useState<Map<string, boolean>>(
    () => new Map(),
  );

  const toutes = echeances.map((e) => {
    const s = surcharges.get(cleDe(e));
    return s === undefined ? e : { ...e, faite: s };
  });

  // Ce qui est déjà loin n'a pas besoin d'être rappelé chaque jour.
  const aFaire = toutes.filter(
    (e) => !e.faite && (e.etat !== "a_venir" || (e.jours ?? 0) <= 30),
  );
  const faites = toutes
    .filter((e) => e.faite)
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  if (aFaire.length === 0 && faites.length === 0) return null;

  const basculer = async (e: Echeance) => {
    if (!e.type) return;
    const cle = cleDe(e);
    const faite = !e.faite;
    setSurcharges((m) => new Map(m).set(cle, faite));
    try {
      await marquerEcheance(e.controleId, e.type, faite);
    } catch (err) {
      setSurcharges((m) => new Map(m).set(cle, !faite));
      toast(
        err instanceof Error ? err.message : "Enregistrement impossible.",
        "error",
      );
    }
  };

  const enRetard = aFaire.filter((e) => e.etat === "depasse").length;

  return (
    <section className="rounded-[14px] border border-border bg-surface p-4">
      <h2 className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm font-medium text-ink">
        <CalendarClock className="h-4 w-4 text-slate" aria-hidden />
        Échéances réglementaires
        {enRetard > 0 ? (
          <span className="rounded-md bg-alert-wash px-1.5 py-px text-[11px] font-medium text-coral-dark">
            {enRetard} en retard
          </span>
        ) : null}
      </h2>
      <p className="mt-1 text-[11px] text-slate">
        Cochez une échéance dès qu&apos;elle est faite.
      </p>

      {aFaire.length > 0 ? (
        <ul className="mt-3 grid grid-cols-1 gap-1.5 md:grid-cols-2">
          {aFaire.map((e) => (
            <Ligne
              key={`${e.controleId}-${e.type ?? e.libelle}`}
              e={e}
              href={controleHref(e.controleId)}
              onBasculer={() => basculer(e)}
            />
          ))}
        </ul>
      ) : (
        <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-tint-teal px-2.5 py-2 text-xs text-teal-dark">
          <Check className="h-3.5 w-3.5" aria-hidden />
          Tout est à jour : aucune échéance en attente.
        </p>
      )}

      {aFaire.some((e) => e.etat === "inconnu") ? (
        <p className="mt-2 text-[11px] text-slate">
          Une échéance « à dater » attend que les séances suivant le contrôle
          soient posées : les notes se rendent à la deuxième d&apos;entre elles.
        </p>
      ) : null}

      {faites.length > 0 ? (
        <details className="group mt-3 border-t border-separator pt-2">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-xs text-slate hover:text-ink">
            <ChevronRight
              className="h-3.5 w-3.5 transition-transform group-open:rotate-90"
              aria-hidden
            />
            {faites.length} échéance{faites.length > 1 ? "s" : ""} faite
            {faites.length > 1 ? "s" : ""}
          </summary>
          <ul className="mt-2 grid grid-cols-1 gap-1.5 md:grid-cols-2">
            {faites.map((e) => (
              <Ligne
                key={`${e.controleId}-${e.type}`}
                e={e}
                href={controleHref(e.controleId)}
                onBasculer={() => basculer(e)}
              />
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function Ligne({
  e,
  href,
  onBasculer,
}: {
  e: Echeance;
  href: string;
  onBasculer: () => void;
}) {
  const retard = !e.faite && e.etat === "depasse";
  const presse = !e.faite && e.etat === "imminent";

  return (
    <li
      className={`flex items-start gap-2 rounded-lg px-2.5 py-2 transition-colors ${
        e.faite
          ? "border border-border opacity-60"
          : retard
            ? "bg-alert-wash"
            : presse
              ? "bg-tint-teal"
              : "border border-border"
      }`}
    >
      {e.type ? (
        <input
          type="checkbox"
          checked={e.faite}
          onChange={onBasculer}
          aria-label={`${e.libelle} — ${e.groupeNom} · ${e.controleLibelle}`}
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-teal"
        />
      ) : (
        <span className="h-4 w-4 shrink-0" aria-hidden />
      )}

      <Link href={href} className="group/lien min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span
            className={`text-xs font-medium group-hover/lien:underline ${
              e.faite
                ? "text-slate line-through"
                : retard
                  ? "text-coral-dark"
                  : presse
                    ? "text-teal-dark"
                    : "text-ink"
            }`}
          >
            {retard ? (
              <AlertTriangle className="mr-1 inline h-3 w-3" aria-hidden />
            ) : presse ? (
              <Clock className="mr-1 inline h-3 w-3" aria-hidden />
            ) : null}
            {e.libelle}
          </span>
          <span className="shrink-0 whitespace-nowrap text-[11px] text-slate">
            {e.date ? formatDateJour(e.date) : "à dater"}
          </span>
        </span>

        <span className="mt-0.5 block truncate text-[11px] text-slate">
          {e.groupeNom} · {e.controleLibelle}
        </span>

        {e.faite ? (
          <span className="mt-0.5 block text-[11px] text-teal-dark">faite</span>
        ) : e.jours !== null ? (
          <span
            className={`mt-0.5 block text-[11px] ${
              retard ? "text-coral-dark" : "text-slate"
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
}
