"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateSeance, type Seance } from "@/app/actions/seances";
import { useToast } from "@/components/ui/Toast";
import { formatDate, formatHeures } from "@/lib/format";
import { formatHeure } from "@/lib/creneaux";
import { Check, ChevronRight } from "lucide-react";

/**
 * Une séance dans la liste de progression : une ligne, pas une carte.
 *
 * La carte précédente embarquait un champ de saisie et deux boutons. Sur un
 * module de trente séances, cela faisait quatre-vingt-dix contrôles empilés,
 * et rendait impossible de repérer où on en était. Depuis qu'une page de
 * séance existe, la liste n'a plus à être un éditeur : elle situe et elle
 * mène. Une seule action y reste, celle qu'on fait en fin de séance.
 */
export default function LigneSeance({
  seance,
  numero,
  prochaine = false,
}: {
  seance: Seance;
  numero: number;
  /** Première séance à faire du module : le point où reprendre. */
  prochaine?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [fait, setFait] = useState(seance.statut === "fait");
  const [busy, setBusy] = useState(false);

  async function basculer() {
    const cible = !fait;
    setFait(cible);
    setBusy(true);
    try {
      await updateSeance(seance.id, { statut: cible ? "fait" : "a_faire" });
      router.refresh();
    } catch (e) {
      setFait(!cible);
      toast(e instanceof Error ? e.message : "Changement non enregistré.", "error");
    } finally {
      setBusy(false);
    }
  }

  const creneau =
    seance.heure_debut && seance.heure_fin
      ? `${formatHeure(seance.heure_debut)} – ${formatHeure(seance.heure_fin)}`
      : null;

  const duree = seance.duree_prevue ?? seance.duree_realisee;

  return (
    <li
      className={`flex items-center gap-3 border-b border-border px-3 py-2 last:border-0 ${
        prochaine ? "bg-wash/40" : ""
      } ${fait ? "opacity-60" : ""}`}
    >
      <button
        type="button"
        onClick={basculer}
        disabled={busy}
        aria-pressed={fait}
        aria-label={`Séance ${numero} ${fait ? "faite" : "à faire"}`}
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition-colors ${
          fait
            ? "border-ink bg-ink text-white"
            : "border-border text-transparent hover:border-ink"
        }`}
      >
        <Check className="h-3.5 w-3.5" />
      </button>

      <span className="w-6 shrink-0 text-right font-mono text-xs text-slate">
        {numero}
      </span>

      <span
        className={`w-20 shrink-0 text-xs ${
          seance.nature === "pratique" ? "text-teal-dark" : "text-slate"
        }`}
      >
        {seance.nature === "pratique"
          ? "pratique"
          : seance.nature === "theorique"
            ? "théorique"
            : "—"}
      </span>

      <span className="w-16 shrink-0 font-mono text-xs text-slate">
        {duree ? formatHeures(duree) : "—"}
      </span>

      <span className="min-w-0 flex-1 truncate text-sm text-ink">
        {seance.date ? (
          <span className="font-mono text-xs text-slate">
            {formatDate(seance.date)}
            {creneau ? ` ${creneau}` : ""}
            {" · "}
          </span>
        ) : null}
        {seance.contenu_realise?.trim() ? (
          <span className="text-slate">{seance.contenu_realise}</span>
        ) : (
          <span className="italic text-slate/60">
            {seance.date ? "contenu à renseigner" : "date à fixer"}
          </span>
        )}
      </span>

      <Link
        href={`/groupes/${seance.groupe_id}/seances/${seance.id}`}
        className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-ink hover:bg-wash"
      >
        Ouvrir
        <ChevronRight className="h-3 w-3" />
      </Link>
    </li>
  );
}
