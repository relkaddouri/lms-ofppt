import Link from "next/link";
import { Clock, FileCheck2 } from "lucide-react";
import { getMesControles } from "@/app/actions/controles-stagiaire";
import { formatDate } from "@/lib/format";
import EnConstruction from "../EnConstruction";

export const metadata = { title: "Contrôles" };

export default async function ControlesPage() {
  const controles = await getMesControles();

  if (controles.length === 0) {
    return (
      <EnConstruction
        titre="Aucun contrôle"
        description="Les contrôles de votre groupe apparaîtront ici dès que votre formateur les aura validés."
        Icone={FileCheck2}
      />
    );
  }

  // La moyenne ne porte que sur les copies notées : une épreuve à venir ne
  // vaut pas zéro.
  const notes = controles
    .map((c) => c.note)
    .filter((n): n is number => n !== null);
  const moyenne =
    notes.length > 0
      ? Math.round((notes.reduce((s, n) => s + n, 0) / notes.length) * 10) / 10
      : null;

  return (
    <div className="bg-surface md:overflow-hidden md:rounded-[14px] md:border md:border-border">
      <div className="flex flex-col gap-1.5 px-5 pb-4 pt-[22px]">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
          Évaluations
        </span>
        <h1 className="font-display text-[26px] font-bold leading-tight tracking-[-0.02em] text-ink">
          Contrôles
        </h1>
        <span className="text-[14.5px] text-slate-light">
          {moyenne === null ? (
            "Aucune copie notée pour l'instant"
          ) : (
            <>
              Moyenne des contrôles passés{" "}
              <span
                className={`font-mono font-medium ${
                  moyenne >= 10 ? "text-green-dark" : "text-coral-dark"
                }`}
              >
                {moyenne.toLocaleString("fr-FR")} / 20
              </span>
            </>
          )}
        </span>
      </div>

      {controles.map((c) => {
        const rendu = c.passationId !== null;
        const note = c.note;
        const efm = c.type === "EFM";
        return (
          <Link
            key={c.id}
            href={`/espace-stagiaire/controles/${c.id}`}
            className="flex items-center gap-[13px] border-t border-separator bg-surface px-5 py-4 no-underline transition-colors duration-150 ease-out hover:bg-paper-alt hover:no-underline"
          >
            <span
              className={`flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[11px] font-mono text-xs font-semibold ${
                efm
                  ? "bg-tint-teal text-teal-dark"
                  : "bg-wash-strong text-slate-2"
              }`}
            >
              {efm ? "EFM" : "CC"}
            </span>

            <span className="flex min-w-0 flex-1 flex-col gap-[5px]">
              <span className="truncate text-[15.5px] font-semibold text-ink">
                {c.titre ?? c.moduleNom ?? "Contrôle"}
              </span>
              <span className="flex flex-wrap items-center gap-2.5">
                <span className="font-mono text-[12.5px] text-slate-light">
                  {[
                    c.codeOperationnel,
                    c.date_prevue ? formatDate(c.date_prevue) : "date à venir",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                {c.duree_heures ? (
                  <span className="inline-flex items-center gap-[5px] font-mono text-[12.5px] text-slate-light">
                    <Clock size={12} aria-hidden />
                    {c.duree_heures} h
                  </span>
                ) : null}
              </span>
            </span>

            <span className="flex shrink-0 flex-col items-end gap-1">
              <span
                className={`font-mono text-base font-medium ${
                  note === null
                    ? "text-muted"
                    : note >= 10
                      ? "text-green-dark"
                      : "text-coral-dark"
                }`}
              >
                {note === null ? "—" : `${note.toLocaleString("fr-FR")}/20`}
              </span>
              <span
                className={`whitespace-nowrap rounded-full border px-2 py-px text-[11px] font-semibold ${
                  note !== null
                    ? "border-tint-green bg-success-wash text-green-dark"
                    : rendu
                      ? "border-tint-teal-strong bg-tint-teal text-teal-dark"
                      : "border-border bg-wash-strong text-slate-2"
                }`}
              >
                {note !== null ? "Corrigé" : rendu ? "Rendu" : "À composer"}
              </span>
            </span>
          </Link>
        );
      })}

      <div className="flex justify-center border-t border-separator px-5 pb-2 pt-6">
        <span className="font-mono text-xs text-border-strong">
          Année scolaire en cours
        </span>
      </div>
    </div>
  );
}
