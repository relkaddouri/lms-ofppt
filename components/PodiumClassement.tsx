import { Crown } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import Feux from "@/components/Feux";
import type { LigneClassement } from "@/app/actions/classement";

/**
 * Le classement d'une épreuve : le podium, puis la classe (demande du 25/09/2026).
 *
 * Le podium d'abord, parce que l'annonce sert à entretenir l'émulation : ce
 * sont les trois premiers qu'on voit en arrivant. Le reste du classement suit
 * en liste, et chacun y retrouve sa ligne mise en avant — sans elle,
 * l'annonce ne dirait rien à qui n'est pas sur le podium.
 *
 * Or, argent, bronze : trois teintes de la palette, prises pour ce qu'elles
 * valent ici — la place, jamais un statut ni une alerte.
 *
 * Les feux d'artifice ne s'éteignent pas : une annonce se relit le soir, la
 * semaine d'après, et une fête jouée une fois ne dirait plus rien à qui
 * arrive après. Ils s'arrêtent seulement quand le podium sort de l'écran, ou
 * si le système demande à réduire les animations.
 */

const MARCHES = [
  { fond: "var(--groupe-5-fond)", trait: "var(--groupe-5-trait)", hauteur: 118 },
  { fond: "var(--groupe-2-fond)", trait: "var(--groupe-2-trait)", hauteur: 86 },
  { fond: "var(--coral-wash)", trait: "var(--ofppt-coral-dark)", hauteur: 66 },
] as const;

const note = (n: number) => n.toLocaleString("fr-FR");

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

  const podium = lignes.slice(0, 3);
  const suite = lignes.slice(3);
  // Deuxième à gauche, premier au centre, troisième à droite : la marche du
  // milieu est la plus haute, et c'est ce qui se lit sans légende.
  const ordre = [podium[1], podium[0], podium[2]].filter(Boolean) as LigneClassement[];

  return (
    <div className="flex flex-col gap-4">
      <div className="relative overflow-hidden rounded-[14px] border border-border bg-wash-strong px-3 pt-5">
        <Feux actif continu hauteurGerbe={0.34} />
        <ul className="relative flex items-end justify-center gap-2 md:gap-3">
          {ordre.map((l) => {
            const marche = MARCHES[Math.min(l.rang, 3) - 1]!;
            const premier = l.rang === 1;
            const moi = !!moiId && l.stagiaireId === moiId;
            return (
              <li
                key={l.stagiaireId}
                className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
              >
                {premier ? (
                  <Crown
                    size={22}
                    strokeWidth={1.8}
                    aria-hidden
                    style={{ color: "var(--groupe-5-trait)" }}
                  />
                ) : null}

                <Avatar
                  nom={l.nom}
                  prenom={l.prenom}
                  photo={l.photo}
                  taille={premier ? "lg" : "md"}
                  className="ring-2 ring-surface"
                />

                <span className="w-full truncate text-center text-[13.5px] font-semibold leading-tight text-ink">
                  {l.prenom} {l.nom}
                  {moi ? <span className="text-slate-light"> · vous</span> : null}
                </span>

                <span
                  className="whitespace-nowrap rounded-full px-2 py-px font-mono text-[11.5px] font-semibold"
                  style={{ background: marche.fond, color: marche.trait }}
                >
                  {note(l.note)}/{total}
                </span>

                <span
                  className="flex w-full items-start justify-center rounded-t-[10px] pt-2 font-display text-[22px] font-bold"
                  style={{
                    background: marche.fond,
                    color: marche.trait,
                    height: marche.hauteur,
                  }}
                >
                  {l.rang}
                </span>
              </li>
            );
          })}
        </ul>
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
