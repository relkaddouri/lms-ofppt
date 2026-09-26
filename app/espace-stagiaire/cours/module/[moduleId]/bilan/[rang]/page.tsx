import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Milestone } from "lucide-react";
import { getJalon } from "@/app/actions/cours-stagiaire";
import QuizJoueur from "@/components/QuizJoueur";

/**
 * Le quiz de bilan d'un jalon — trois chapitres (PRD §4.5bis).
 *
 * Il a sa page, et non un encart de plus au bas d'un chapitre : on s'y met
 * comme on se met à réviser, en sachant sur quoi il porte.
 */
export default async function BilanPage({
  params,
}: {
  params: Promise<{ moduleId: string; rang: string }>;
}) {
  const { moduleId, rang } = await params;
  const jalon = await getJalon(moduleId, Number(rang));
  if (!jalon) notFound();

  const premier = jalon.chapitres[0]!.numero;
  const dernier = jalon.chapitres.at(-1)!.numero;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <Link
        href={`/espace-stagiaire/cours/module/${moduleId}`}
        className="mx-5 inline-flex min-h-[44px] items-center gap-1.5 self-start text-sm text-slate hover:text-ink md:mx-0"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {jalon.moduleNom}
      </Link>

      <header className="mx-5 flex flex-col gap-2 rounded-[14px] bg-ink px-5 py-6 text-white md:mx-0 md:px-8">
        <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-white/50">
          <Milestone className="h-4 w-4" aria-hidden />
          Bilan {jalon.rang} · chapitres {premier} à {dernier}
        </span>
        <h1 className="font-display text-[22px] font-bold leading-tight tracking-[-0.02em] md:text-[26px]">
          Ce que vous retenez de ces trois chapitres
        </h1>
        <ul className="mt-1 flex flex-col gap-1 text-[14.5px] text-white/75">
          {jalon.chapitres.map((c) => (
            <li key={c.id}>
              <Link
                href={`/espace-stagiaire/cours/${c.id}`}
                className="text-white/75 underline-offset-2 hover:text-white"
              >
                Chapitre {c.numero} — {c.titre}
              </Link>
            </li>
          ))}
        </ul>
      </header>

      <div className="px-5 md:px-0">
        <QuizJoueur
          endpoint="/api/generate/quiz/bilan"
          corps={{ moduleId, rang: jalon.rang }}
          genre="bilan"
          titre={`Bilan des chapitres ${premier} à ${dernier}`}
          intro="Huit questions qui relient les trois chapitres. Ce n'est pas noté : c'est pour savoir ce qui tient et ce qu'il faut relire."
          bouton="Commencer le bilan"
        />
      </div>
    </div>
  );
}
