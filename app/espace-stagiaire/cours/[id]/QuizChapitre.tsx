import QuizJoueur from "@/components/QuizJoueur";

/** Le quiz d'auto-évaluation d'un chapitre (PRD §4.5bis). */
export default function QuizChapitre({ supportId }: { supportId: string }) {
  return (
    <QuizJoueur
      endpoint="/api/generate/quiz"
      corps={{ supportId }}
      genre="chapitre"
      titre="Testez-vous sur ce chapitre"
      intro="Quelques questions tirées du cours, corrigées tout de suite. Ce n'est pas noté, et vous pouvez recommencer autant que vous voulez."
    />
  );
}
