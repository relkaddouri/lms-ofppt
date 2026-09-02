"use client";

import Link from "next/link";
import type { Rappel } from "@/lib/rappels";
import { formatHeures } from "@/lib/format";
import { AlertTriangle, BellRing, CheckCircle2 } from "lucide-react";

/**
 * Notification d'échéance de contrôle.
 *
 * Elle informe, elle ne déclenche rien : préparer le contrôle reste un geste
 * du formateur, qui choisit son moment et son format.
 */
export default function RappelControle({
  rappel,
  href,
  compact = false,
}: {
  rappel: Rappel;
  /** Lien vers la préparation du contrôle, quand il y a lieu. */
  href?: string;
  compact?: boolean;
}) {
  if (rappel.etat === "aucun") {
    if (compact || rappel.prochaine === null) return null;
    return (
      <p className="flex items-center gap-1.5 text-xs text-slate">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
        Prochain contrôle dans {formatHeures(rappel.restantAvantProchaine ?? 0)}
      </p>
    );
  }

  const retard = rappel.etat === "en_retard";
  const Icone = retard ? AlertTriangle : BellRing;

  const contenu = (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${
        retard ? "bg-alert-wash text-coral-dark" : "bg-tint-teal text-teal-dark"
      }`}
    >
      <Icone className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {rappel.libelle}
    </span>
  );

  return href ? (
    <Link href={href} className="focus:outline-none focus:ring-2 focus:ring-ink">
      {contenu}
    </Link>
  ) : (
    contenu
  );
}
