import { Crown } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import Feux from "@/components/Feux";
import type { LigneClassement } from "@/app/actions/classement";

/**
 * Le classement d'une épreuve : les trois meilleures notes, puis la classe
 * (demande du 25/09/2026).
 *
 * Les médailles se donnent à la **note**, pas à la place : trois stagiaires à
 * 16/20 sont tous premiers, avec la même couronne d'or, et non premier,
 * deuxième et troisième dans un ordre qu'aucun d'eux n'a mérité. C'est aussi
 * ce qui permet une liste plutôt que trois marches — un podium ne sait pas
 * loger trois personnes sur la même.
 *
 * Or, argent, bronze : trois teintes de la palette, prises pour ce qu'elles
 * valent ici — la place, jamais un statut ni une alerte.
 *
 * Les feux d'artifice ne s'éteignent pas : une annonce se relit le soir, la
 * semaine d'après, et une fête jouée une fois ne dirait plus rien à qui
 * arrive après. Ils s'arrêtent seulement quand le classement sort de l'écran,
 * ou si le système demande à réduire les animations.
 */

const MEDAILLES = [
  {
    nom: "1ʳᵉ place",
    fond: "var(--groupe-5-fond)",
    trait: "var(--groupe-5-trait)",
  },
  {
    // L'argent est le gris neutre de la palette, pas le sarcelle : à côté de
    // l'or et du bronze, une couronne bleue ne se lit pas comme une médaille.
    nom: "2ᵉ place",
    fond: "var(--groupe-1-fond)",
    trait: "var(--groupe-1-trait)",
  },
  {
    nom: "3ᵉ place",
    fond: "var(--coral-wash)",
    trait: "var(--ofppt-coral-dark)",
  },
] as const;

const note = (n: number) => n.toLocaleString("fr-FR");

/** Les lignes regroupées par note, de la meilleure à la moins bonne. */
function parNote(lignes: LigneClassement[]): LigneClassement[][] {
  const groupes: LigneClassement[][] = [];
  for (const l of lignes) {
    const dernier = groupes.at(-1);
    if (dernier && dernier[0]!.note === l.note) dernier.push(l);
    else groupes.push([l]);
  }
  return groupes;
}

export default function PodiumClassement({
  lignes,
  total,
  moyenne = null,
  moiId = null,
}: {
  lignes: LigneClassement[];
  total: number;
  moyenne?: number | null;
  /** Le stagiaire qui lit, pour mettre sa ligne en avant. */
  moiId?: string | null;
}) {
  if (lignes.length === 0) return null;

  const groupes = parNote(lignes);
  const medailles = groupes.slice(0, 3);
  const suite = groupes.slice(3).flat();

  return (
    <div className="flex flex-col gap-4">
      <div className="relative overflow-hidden rounded-[14px] border border-border bg-wash-strong p-3">
        <Feux actif continu hauteurGerbe={0.3} />

        <ol className="relative flex flex-col gap-2">
          {medailles.map((groupe, rang) => {
            const medaille = MEDAILLES[rang]!;
            return (
              <li
                key={medaille.nom}
                className="overflow-hidden rounded-[12px] border bg-surface"
                style={{ borderColor: medaille.fond }}
              >
                <p
                  className="flex items-center justify-between gap-2 px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em]"
                  style={{ background: medaille.fond, color: medaille.trait }}
                >
                  <span>{medaille.nom}</span>
                  <span className="font-semibold">
                    {note(groupe[0]!.note)}/{total}
                  </span>
                </p>

                <ul className="flex flex-col">
                  {groupe.map((l) => {
                    const moi = !!moiId && l.stagiaireId === moiId;
                    return (
                      <li
                        key={l.stagiaireId}
                        className={`flex items-center gap-3 border-b border-separator px-3.5 py-2.5 last:border-0 ${
                          moi ? "bg-tint-teal" : ""
                        }`}
                      >
                        <Crown
                          size={rang === 0 ? 20 : 17}
                          strokeWidth={1.9}
                          aria-hidden
                          className="shrink-0"
                          style={{ color: medaille.trait }}
                        />
                        <Avatar
                          nom={l.nom}
                          prenom={l.prenom}
                          photo={l.photo}
                          taille={rang === 0 ? "md" : "sm"}
                        />
                        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">
                          {l.prenom} {l.nom}
                          {moi ? (
                            <span className="font-normal text-slate"> · vous</span>
                          ) : null}
                        </span>
                        <span
                          className="shrink-0 whitespace-nowrap rounded-full px-2 py-px font-mono text-[12px] font-semibold"
                          style={{
                            background: medaille.fond,
                            color: medaille.trait,
                          }}
                        >
                          {note(l.note)}/{total}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ol>
      </div>

      {moyenne !== null ? (
        <p className="px-1 text-[13.5px] text-slate">
          Moyenne de la classe{" "}
          <span className="font-mono font-medium text-body">
            {note(moyenne)}/{total}
          </span>{" "}
          · {lignes.length} copie{lignes.length > 1 ? "s" : ""} corrigée
          {lignes.length > 1 ? "s" : ""}
        </p>
      ) : null}

      {suite.length > 0 ? (
        <ul className="overflow-hidden rounded-[14px] border border-border bg-surface">
          {suite.map((l) => {
            const moi = !!moiId && l.stagiaireId === moiId;
            return (
              <li
                key={l.stagiaireId}
                className={`flex items-center gap-3 border-b border-separator px-4 py-2.5 last:border-0 ${
                  moi ? "bg-tint-teal" : ""
                }`}
              >
                <span className="w-6 shrink-0 text-center font-mono text-[13px] text-slate-light">
                  {l.rang}
                </span>
                <Avatar
                  nom={l.nom}
                  prenom={l.prenom}
                  photo={l.photo}
                  taille="xs"
                />
                <span className="min-w-0 flex-1 truncate text-[14.5px] text-ink">
                  {l.prenom} {l.nom}
                  {moi ? <span className="text-slate"> · vous</span> : null}
                </span>
                <span className="shrink-0 font-mono text-[13.5px] font-medium text-body">
                  {note(l.note)}/{total}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
