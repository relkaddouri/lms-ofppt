import Link from "next/link";
import Badge from "@/components/ui/Badge";
import type {
  ControleStagiaire,
  MaCopie,
} from "@/app/actions/controles-stagiaire";
import { ArrowLeft } from "lucide-react";

/**
 * Copie rendue, vue par son auteur.
 *
 * Le corrigé de référence n'y figure pas : le stagiaire voit sa réponse, sa
 * note et l'appréciation, comme sur une copie rendue en classe.
 */
export default function MaCopieVue({
  controle,
  copie,
}: {
  controle: ControleStagiaire;
  copie: MaCopie | null;
}) {
  return (
    <div>
      <Link
        href="/espace-stagiaire/controles"
        className="inline-flex min-h-[44px] items-center gap-1.5 text-sm text-slate"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Contrôles
      </Link>

      <div className="mt-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-ink">
            {controle.titre ?? controle.moduleNom ?? "Contrôle"}
          </h1>
          <p className="mt-0.5 text-sm text-slate">{controle.moduleNom}</p>
        </div>
        {copie ? (
          <span className="shrink-0 rounded-xl border border-border px-4 py-2 text-center">
            <span className="block text-[11px] text-slate">Note</span>
            <span className="block text-xl font-semibold text-ink">
              {copie.note.toLocaleString("fr-FR")} / {copie.total}
            </span>
          </span>
        ) : null}
      </div>

      {!copie ? (
        <p className="mt-5 text-sm text-slate">
          Votre copie a été rendue, son détail n&apos;est pas disponible.
        </p>
      ) : (
        <ol className="mt-5 space-y-3">
          {copie.details.map((d, i) => (
            <li
              key={d.question_id}
              className="rounded-xl border border-border bg-surface p-4"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs font-medium uppercase tracking-wide text-slate">
                  Question {i + 1}
                </span>
                <Badge
                  tone={
                    d.points >= d.bareme
                      ? "success"
                      : d.points === 0
                        ? "danger"
                        : "info"
                  }
                >
                  {d.points} / {d.bareme}
                </Badge>
              </div>

              <p className="mt-2 whitespace-pre-line text-sm text-ink">
                {d.enonce}
              </p>

              {d.reponse ? (
                <div className="mt-2 rounded-lg bg-mist px-3 py-2">
                  <p className="text-[11px] text-slate">Votre réponse</p>
                  <p className="mt-0.5 whitespace-pre-line text-sm text-ink">
                    {d.reponse}
                  </p>
                </div>
              ) : null}

              {d.commentaire ? (
                <p className="mt-2 text-sm text-slate">{d.commentaire}</p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
