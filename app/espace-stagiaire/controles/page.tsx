import Link from "next/link";
import { Clock, FileCheck2 } from "lucide-react";
import { getMesControles } from "@/app/actions/controles-stagiaire";
import { formatDateJour } from "@/lib/format";
import { baremeAttendu, noteSur20, testOuvert } from "@/lib/controles";
import { instantEtablissement } from "@/lib/format";
import { dureeEnTexte, formatHeure } from "@/lib/creneaux";
import EnConstruction from "../EnConstruction";
import EnTete from "../EnTete";

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
  //
  // Chaque note se lit sur le total de son contrôle — 20 pour un contrôle
  // continu, 40 pour une épreuve de fin de module (PRD §4.7). Les additionner
  // telles quelles donnerait un chiffre faux : un 31/40 pèserait plus lourd
  // qu'un 19/20 alors qu'il vaut moins. La moyenne passe donc par l'échelle
  // sur 20, celle sous laquelle un stagiaire lit sa scolarité.
  //
  // Un contrôle de test n'y entre pas : il est formatif (PRD §4.7bis).
  const notes = controles
    .filter((c) => c.note !== null && c.type !== "TEST")
    .map((c) => noteSur20(c.note as number, baremeAttendu(c.type)));
  const moyenne =
    notes.length > 0
      ? Math.round((notes.reduce((s, n) => s + n, 0) / notes.length) * 10) / 10
      : null;

  return (
    <div className="mx-auto w-full max-w-5xl bg-surface md:overflow-hidden md:rounded-[14px] md:border md:border-border">
      <EnTete
        surtitre="Évaluations"
        titre="Contrôles"
        resume={
          moyenne === null ? (
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
          )
        }
      />

      {controles.map((c) => {
        const rendu = c.passationId !== null;
        const note = c.note;
        const efm = c.type === "EFM";
        const test = c.type === "TEST";
        const total = baremeAttendu(c.type, c.bareme_total);
        const ouvert = test && testOuvert(c);
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
                  : test
                    ? "bg-success-wash text-green-dark"
                    : "bg-wash-strong text-slate-2"
              }`}
            >
              {efm ? "EFM" : test ? "TEST" : "CC"}
            </span>

            <span className="flex min-w-0 flex-1 flex-col gap-[5px]">
              <span className="truncate text-[15.5px] font-semibold text-ink">
                {c.titre ?? c.moduleNom ?? "Contrôle"}
              </span>
              <span className="flex flex-wrap items-center gap-2.5">
                <span className="font-mono text-[12.5px] text-slate-light">
                  {[
                    c.codeOperationnel,
                    test
                      ? ouvert
                        ? c.ferme_le
                          ? `ouvert jusqu'à ${formatHeure(instantEtablissement(new Date(c.ferme_le)).heure)}`
                          : "ouvert maintenant"
                        : "fermé"
                      : c.date_prevue
                        ? formatDateJour(c.date_prevue)
                        : "date à venir",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                {c.duree_heures ? (
                  <span className="inline-flex items-center gap-[5px] font-mono text-[12.5px] text-slate-light">
                    <Clock size={12} aria-hidden />
                    {dureeEnTexte(Number(c.duree_heures))}
                  </span>
                ) : null}
              </span>
            </span>

            <span className="flex shrink-0 flex-col items-end gap-1">
              <span
                className={`font-mono text-base font-medium ${
                  note === null
                    ? "text-muted"
                    : note >= total / 2
                      ? "text-green-dark"
                      : "text-coral-dark"
                }`}
              >
                {/* Chaque note reste affichée sur son propre total : la
                    ramener sur 20 masquerait le barème de l'épreuve. */}
                {note === null
                  ? "—"
                  : `${note.toLocaleString("fr-FR")}/${total}`}
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
                {note !== null
                  ? "Corrigé"
                  : rendu
                    ? "Rendu"
                    : c.compteTest && c.statut === "brouillon"
                      ? "Brouillon"
                      : test && !ouvert
                        ? c.compteTest
                          ? "Non ouvert"
                          : "Fermé"
                        : "À composer"}
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
