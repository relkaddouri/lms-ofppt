"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDate, formatDateJour } from "@/lib/format";
import type { Echeance } from "@/lib/echeances";
import { marquerEcheance } from "@/app/actions/echeances";
import { useToast } from "@/components/ui/Toast";
import Segments from "@/components/ui/Segments";
import { ArrowUpRight, CalendarClock, Check, PartyPopper } from "lucide-react";

const cleDe = (e: Echeance) => `${e.controleId}|${e.type}`;

/** Les rubriques de la liste, dans l'ordre où elles pressent. */
const RUBRIQUES = [
  { etat: "depasse", titre: "En retard", ton: "text-coral-dark" },
  { etat: "imminent", titre: "Dans les 3 jours", ton: "text-teal-dark" },
  { etat: "a_venir", titre: "Dans le mois", ton: "text-slate" },
  { etat: "inconnu", titre: "À dater", ton: "text-slate" },
] as const;

/**
 * Échéances réglementaires, tenues comme une liste de tâches.
 *
 * Elles informent : aucune génération, aucun envoi, aucun blocage. Le
 * formateur coche ce qu'il a accompli : la case change aussitôt, l'écriture
 * suit en arrière-plan. Une échéance cochée reste barrée à sa place jusqu'au
 * prochain chargement, le temps de se raviser, puis rejoint « Faites ».
 */
export default function EcheancesReglementaires({
  echeances,
  controleHref,
}: {
  echeances: Echeance[];
  controleHref: (id: string) => string;
}) {
  const toast = useToast();
  const [vue, setVue] = useState<"a_faire" | "faites">("a_faire");
  // Ce que le formateur vient de cocher ou décocher : la page n'est pas
  // rechargée après l'écriture, c'est cet état qui fait foi à l'écran.
  const [surcharges, setSurcharges] = useState<Map<string, boolean>>(
    () => new Map(),
  );

  const toutes = echeances.map((e) => {
    const s = surcharges.get(cleDe(e));
    return s === undefined ? e : { ...e, faite: s, faiteLe: s ? e.faiteLe : null };
  });

  // Ce qui est déjà loin n'a pas besoin d'être rappelé chaque jour. Ce qui
  // vient d'être coché reste dans la liste, barré, pour pouvoir se décocher.
  const cocheeIci = (e: Echeance) =>
    surcharges.get(cleDe(e)) === true &&
    !echeances.find((x) => cleDe(x) === cleDe(e))?.faite;
  const aFaire = toutes.filter(
    (e) =>
      (!e.faite || cocheeIci(e)) &&
      (e.etat !== "a_venir" || (e.jours ?? 0) <= 30),
  );
  const restantes = aFaire.filter((e) => !e.faite).length;
  const faites = toutes
    .filter((e) => e.faite)
    .sort((a, b) => (b.faiteLe ?? "").localeCompare(a.faiteLe ?? ""));

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

  const total = restantes + faites.length;
  const enRetard = aFaire.filter((e) => !e.faite && e.etat === "depasse").length;

  return (
    <section className="flex flex-col gap-4 rounded-[14px] border border-border bg-surface p-5">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 className="flex items-center gap-1.5 text-[15px] font-semibold text-ink">
              <CalendarClock className="h-4 w-4 text-slate" aria-hidden />
              Échéances réglementaires
            </h2>
            <p className="text-xs text-slate">
              {enRetard > 0
                ? `${enRetard} en retard — cochez dès que c'est fait.`
                : "Cochez une échéance dès qu'elle est faite."}
            </p>
          </div>
          <span className="shrink-0 font-mono text-sm text-ink">
            {faites.length}
            <span className="text-slate"> / {total}</span>
          </span>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-wash"
          role="progressbar"
          aria-valuenow={faites.length}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label="Échéances faites"
        >
          <div
            className="h-full rounded-full bg-teal transition-[width] duration-300"
            style={{ width: `${total > 0 ? (faites.length / total) * 100 : 0}%` }}
          />
        </div>
      </div>

      <Segments
        valeur={vue}
        onChange={setVue}
        ariaLabel="Échéances à faire ou faites"
        options={[
          { valeur: "a_faire", libelle: `À faire · ${restantes}` },
          { valeur: "faites", libelle: `Faites · ${faites.length}` },
        ]}
      />

      {vue === "a_faire" ? (
        aFaire.length === 0 ? (
          <Vide
            icone={<PartyPopper className="h-5 w-5" aria-hidden />}
            texte="Tout est à jour : aucune échéance en attente."
          />
        ) : (
          <div className="flex flex-col gap-4">
            {RUBRIQUES.map((r) => {
              const liste = aFaire.filter((e) => e.etat === r.etat);
              if (liste.length === 0) return null;
              return (
                <div key={r.etat} className="flex flex-col gap-1">
                  <h3
                    className={`font-mono text-[11px] uppercase tracking-[0.1em] ${r.ton}`}
                  >
                    {r.titre} · {liste.length}
                  </h3>
                  <ul className="flex flex-col divide-y divide-separator">
                    {liste.map((e) => (
                      <Tache
                        key={`${e.controleId}-${e.type ?? e.libelle}`}
                        e={e}
                        href={controleHref(e.controleId)}
                        onBasculer={() => basculer(e)}
                      />
                    ))}
                  </ul>
                  {r.etat === "inconnu" ? (
                    <p className="text-[11px] text-slate">
                      Les notes se rendent à la deuxième séance suivant le
                      contrôle : la date viendra quand ces séances seront
                      posées.
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )
      ) : faites.length === 0 ? (
        <Vide
          icone={<Check className="h-5 w-5" aria-hidden />}
          texte="Rien de coché pour l'instant."
        />
      ) : (
        <ul className="flex flex-col divide-y divide-separator">
          {faites.map((e) => (
            <Tache
              key={`${e.controleId}-${e.type}`}
              e={e}
              href={controleHref(e.controleId)}
              onBasculer={() => basculer(e)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function Vide({ icone, texte }: { icone: React.ReactNode; texte: string }) {
  return (
    <p className="flex flex-col items-center gap-2 rounded-lg bg-wash px-4 py-6 text-center text-sm text-slate">
      <span className="text-teal-dark">{icone}</span>
      {texte}
    </p>
  );
}

function Tache({
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

  const statut = e.faite
    ? e.faiteLe
      ? `faite le ${formatDate(e.faiteLe)}`
      : "faite"
    : e.jours === null
      ? "à dater"
      : e.jours < 0
        ? `${-e.jours} j de retard`
        : e.jours === 0
          ? "aujourd'hui"
          : `dans ${e.jours} j`;

  return (
    <li className="group flex items-center gap-1.5 py-2">
      {e.type ? (
        <button
          type="button"
          role="checkbox"
          aria-checked={e.faite}
          aria-label={`${e.libelle} — ${e.groupeNom} · ${e.controleLibelle}`}
          onClick={onBasculer}
          // Une cible de 44 px au doigt, une case de 20 px à l'œil.
          className="-my-1 -ml-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
        >
          <span
            className={`flex h-5 w-5 items-center justify-center rounded-md border-[1.5px] transition-colors duration-150 ${
              e.faite
                ? "border-teal bg-teal text-surface"
                : retard
                  ? "border-coral/70 group-hover:border-coral"
                  : "border-slate-light group-hover:border-ink"
            }`}
          >
            {e.faite ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
          </span>
        </button>
      ) : (
        <span className="-ml-3 h-11 w-11 shrink-0" aria-hidden />
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={`text-[13.5px] leading-snug font-medium transition-colors ${
            e.faite ? "text-slate line-through" : "text-ink"
          }`}
        >
          {e.libelle}
        </span>
        <span
          className="truncate text-xs text-slate"
          title={`${e.groupeNom} · ${e.controleLibelle}`}
        >
          {e.groupeNom} · {e.controleLibelle}
        </span>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <span
          className={`whitespace-nowrap rounded-md px-1.5 py-px text-[11.5px] font-medium ${
            e.faite
              ? "bg-tint-teal text-teal-dark"
              : retard
                ? "bg-alert-wash text-coral-dark"
                : presse
                  ? "bg-tint-teal text-teal-dark"
                  : "bg-wash text-slate"
          }`}
        >
          {statut}
        </span>
        {e.date ? (
          <span className="whitespace-nowrap text-[11px] text-slate">
            {formatDateJour(e.date, { court: true })}
          </span>
        ) : null}
      </div>

      <Link
        href={href}
        aria-label={`Ouvrir le contrôle ${e.controleLibelle}`}
        title="Ouvrir le contrôle"
        className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate transition-colors hover:bg-wash hover:text-ink"
      >
        <ArrowUpRight className="h-4 w-4" aria-hidden />
      </Link>
    </li>
  );
}
