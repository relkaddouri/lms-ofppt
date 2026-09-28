import Link from "next/link";
import { Check } from "lucide-react";
import BasculeSommaire from "@/components/BasculeSommaire";
import type { SommaireModule } from "@/app/actions/cours-stagiaire";

/**
 * Le sommaire du module, à côté du chapitre lu (PRD §4.5bis).
 *
 * Il accompagne la lecture : on voit d'où l'on vient, ce qui reste, et l'on
 * saute d'un chapitre à l'autre sans repasser par la liste. Sur téléphone il
 * se replie derrière un résumé — la place va au cours, pas à la table des
 * matières.
 *
 * Sur grand écran, il se replie aussi, mais à la demande : deux cent quatre-
 * vingts pixels de table des matières valent le coup quand on cherche son
 * chapitre, beaucoup moins quand on lit — surtout depuis qu'on peut grossir le
 * texte, ce qui rétrécit d'autant la colonne qui reste.
 */
export default function SommaireLateral({
  module,
  courantId,
}: {
  module: SommaireModule;
  courantId: string;
}) {
  // Le rang du chapitre lu dans la suite complète : c'est ce que le rail
  // affiche quand le panneau est replié — « où j'en suis », en trois
  // caractères.
  const tous = module.parties.flatMap((p) => p.chapitres);
  const rang = tous.findIndex((c) => c.id === courantId) + 1;
  const liste = (
    <ol className="flex flex-col gap-4">
      {module.parties.map((p, i) => (
        <li key={p.lettre} className="flex flex-col gap-1.5">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-slate-light">
            Partie {i + 1} · {p.intitule}
          </span>
          <ol className="flex flex-col">
            {p.chapitres.map((c) => {
              const courant = c.id === courantId;
              return (
                <li key={c.id}>
                  <Link
                    href={`/espace-stagiaire/cours/${c.id}`}
                    aria-current={courant ? "page" : undefined}
                    className={`flex items-start gap-2.5 rounded-[9px] px-2.5 py-2 text-[13.5px] leading-snug no-underline transition-colors duration-150 ease-out hover:no-underline ${
                      courant
                        ? "bg-wash font-semibold text-ink"
                        : "text-body hover:bg-paper-alt"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`mt-[1px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border ${
                        c.lu
                          ? "border-green bg-green text-white"
                          : courant
                            ? "border-encre bg-surface"
                            : "border-border-strong bg-surface"
                      }`}
                    >
                      {c.lu ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                    </span>
                    <span className="min-w-0">{c.titre}</span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </li>
      ))}
    </ol>
  );

  const entete = (
    <div className="flex flex-col gap-2">
      {/* Le nom du module et la commande de repli sur la même ligne : dans le
          flux, elle ne recouvre rien et ne se déplace pas d'un état à
          l'autre. */}
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/espace-stagiaire/cours/module/${module.id}`}
          className="text-[14px] font-semibold text-ink no-underline hover:underline"
        >
          {module.nom}
        </Link>
        <span className="hidden md:block">
          <BasculeSommaire variante="entete" />
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-wash-strong">
          <span
            className="block h-full rounded-full bg-green transition-[width] duration-300"
            style={{ width: `${module.progression}%` }}
          />
        </span>
        <span className="font-mono text-[11.5px] text-slate">
          {module.progression} %
        </span>
      </div>
      <span className="font-mono text-[11.5px] text-slate-light">
        {module.lus} / {module.chapitres} chapitres terminés
      </span>
    </div>
  );

  return (
    <>
      {/* Téléphone : replié, pour laisser la place au cours. */}
      <details className="rounded-[12px] border border-border bg-surface px-4 py-3 md:hidden">
        <summary className="cursor-pointer list-none">{entete}</summary>
        <div className="mt-3 border-t border-separator pt-3">{liste}</div>
      </details>

      {/* Replié, le sommaire ne disparaît pas : il se réduit à un rail qui
          dit où l'on en est, et le panneau entier revient au survol — posé
          par-dessus le cours, sans le décaler. Un sommaire qui s'efface tout
          à fait oblige à le rouvrir pour la seule question qu'on se pose en
          lisant : « j'en suis où ? ». */}
      <aside className="sommaire-repliable sticky top-[84px] hidden w-[280px] shrink-0 md:block">
        <BasculeSommaire
          variante="rail"
          progression={module.progression}
          rang={rang}
          total={module.chapitres}
        />

        <div className="sommaire-panneau flex max-h-[calc(100dvh-110px)] flex-col gap-3 overflow-y-auto rounded-[14px] border border-border bg-surface px-4 py-4">
          {entete}
          <div className="border-t border-separator pt-3">{liste}</div>
        </div>
      </aside>
    </>
  );
}
