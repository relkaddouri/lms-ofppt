import Link from "next/link";
import { ChevronRight, FileCheck2 } from "lucide-react";
import { formatDateJour } from "@/lib/format";
import type { ControleProgression } from "@/app/actions/controles";

/**
 * Un contrôle dans la progression, à sa place dans le déroulement.
 *
 * La demande du 28/09/2026 : « voir où j'ai passé le contrôle, dans la même
 * progression ». Il se lit donc comme une séance — même hauteur de ligne,
 * même colonne d'heure, même flèche à droite — mais dans le corail des
 * évaluations, la seule couleur que le système visuel réserve à ce qui
 * compte pour la note. Trente lignes grises et une corail : on la trouve
 * sans la chercher.
 *
 * La ligne entière est un lien vers l'écran du contrôle : c'est là qu'on va
 * quand on la voit.
 */

/** Ce que le contrôle en est : prévu, ouvert, passé. */
function etat(c: ControleProgression): string {
  if (c.statut === "brouillon") return "brouillon";
  const maintenant = Date.now();
  const ouvert = c.ouvert_le ? new Date(c.ouvert_le).getTime() : null;
  const ferme = c.ferme_le ? new Date(c.ferme_le).getTime() : null;
  if (ouvert && ouvert <= maintenant && (!ferme || ferme > maintenant)) {
    return "ouvert";
  }
  if (ferme && ferme <= maintenant) return "passé";
  return "prévu";
}

export default function LigneControle({
  controle,
  groupeId,
}: {
  controle: ControleProgression;
  groupeId: string;
}) {
  const test = controle.type === "TEST";
  const etiquette =
    controle.type === "EFM"
      ? controle.type_efm === "regional"
        ? "EFM RÉG."
        : "EFM"
      : controle.type;

  return (
    <li className="border-b border-border last:border-0">
      <Link
        href={`/modules/${controle.module_id}/controle?groupe=${groupeId}&controle=${controle.id}`}
        className={`flex items-center gap-3 px-3 py-2 no-underline transition-colors hover:no-underline ${
          test ? "bg-success-wash/40 hover:bg-success-wash" : "bg-coral-wash hover:bg-alert-wash"
        }`}
      >
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${
            test ? "bg-green text-white" : "bg-coral text-white"
          }`}
        >
          <FileCheck2 className="h-3.5 w-3.5" aria-hidden />
        </span>

        <span
          className={`w-[62px] shrink-0 rounded-full border px-1.5 py-px text-center font-mono text-[10.5px] font-semibold ${
            test
              ? "border-tint-green bg-surface text-green-dark"
              : "border-tint-alert-strong bg-surface text-coral-dark"
          }`}
        >
          {etiquette}
        </span>

        <span className="w-16 shrink-0 font-mono text-xs text-slate">
          {etat(controle)}
        </span>

        <span className="min-w-0 flex-1 truncate text-sm">
          {controle.date_prevue ? (
            <span className="font-mono text-xs text-slate">
              {formatDateJour(controle.date_prevue, { court: true })}
              {" · "}
            </span>
          ) : null}
          <span className={test ? "text-green-dark" : "text-coral-dark"}>
            {controle.titre?.trim() ||
              (controle.type === "EFM"
                ? "Épreuve de fin de module"
                : test
                  ? "Contrôle de test"
                  : "Contrôle continu")}
          </span>
        </span>

        <span
          className={`flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium ${
            test ? "text-green-dark" : "text-coral-dark"
          }`}
        >
          Ouvrir
          <ChevronRight className="h-3 w-3" aria-hidden />
        </span>
      </Link>
    </li>
  );
}
