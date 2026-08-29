"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { formatDateTime } from "@/lib/format";
import TexteMentions from "@/components/TexteMentions";
import ChampMention from "@/components/ChampMention";
import {
  poserQuestion,
  repondreQuestion,
  type QuestionSupport,
} from "@/app/actions/questions-support";
import type { Camarade } from "@/app/actions/fil";
import { MessageCircle, Reply } from "lucide-react";

/**
 * Les questions posées sur un support, et leurs réponses.
 *
 * La question reste attachée au cours qui l'a fait naître : la relire un an
 * plus tard n'a de sens qu'à côté du passage qui bloquait. Un camarade répond
 * aussi bien que le formateur — d'où la même mécanique de mention des deux
 * côtés, et le même composant dans les deux espaces.
 */
export default function QuestionsSupport({
  supportId,
  questions,
  camarades,
  vue = "stagiaire",
}: {
  supportId: string;
  questions: QuestionSupport[];
  camarades: Camarade[];
  /** Le formateur répond ; il ne se pose pas de question à lui-même. */
  vue?: "stagiaire" | "formateur";
}) {
  const router = useRouter();
  const toast = useToast();
  const [enCours, startTransition] = useTransition();
  const [repondA, setRepondA] = useState<string | null>(null);

  function agir(action: () => Promise<void>, succes: string) {
    startTransition(async () => {
      try {
        await action();
        toast(succes);
        setRepondA(null);
        router.refresh();
      } catch (e) {
        toast(e instanceof Error ? e.message : "Envoi impossible.", "error");
      }
    });
  }

  return (
    <section className="space-y-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <MessageCircle className="h-4 w-4 text-slate" aria-hidden />
        Questions sur ce cours
        {questions.length > 0 ? (
          <span className="font-normal text-slate">({questions.length})</span>
        ) : null}
      </h2>

      {questions.length === 0 ? (
        <p className="text-sm text-slate">
          {vue === "formateur"
            ? "Aucune question posée sur ce support pour l'instant."
            : "Un point du cours reste flou ? Posez la question ici : votre formateur et vos camarades la verront."}
        </p>
      ) : (
        <ul className="space-y-3">
          {questions.map((q) => (
            <li
              key={q.id}
              className="rounded-xl border border-border bg-surface p-4"
            >
              <Entete message={q} />
              <p className="mt-1 text-sm leading-relaxed text-ink">
                <TexteMentions texte={q.texte} camarades={camarades} />
              </p>

              {q.reponses.length > 0 ? (
                <ul className="mt-3 space-y-3 border-l-2 border-mint pl-3">
                  {q.reponses.map((r) => (
                    <li key={r.id}>
                      <Entete message={r} />
                      <p className="mt-1 text-sm leading-relaxed text-ink">
                        <TexteMentions texte={r.texte} camarades={camarades} />
                      </p>
                    </li>
                  ))}
                </ul>
              ) : null}

              {repondA === q.id ? (
                <div className="mt-3">
                  <ChampMention
                    camarades={camarades}
                    busy={enCours}
                    placeholder="Votre réponse… @ pour mentionner"
                    onEnvoyer={(texte) =>
                      agir(
                        () => repondreQuestion(q.id, texte, supportId),
                        "Réponse envoyée",
                      )
                    }
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setRepondA(q.id)}
                  className="mt-3 flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-forest"
                >
                  <Reply className="h-4 w-4" aria-hidden />
                  Répondre
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {vue === "stagiaire" ? (
        <ChampMention
          camarades={camarades}
          busy={enCours}
          placeholder="Poser une question… @ pour mentionner"
          onEnvoyer={(texte) =>
            agir(() => poserQuestion(supportId, texte), "Question posée")
          }
        />
      ) : null}
    </section>
  );
}

function Entete({ message }: { message: QuestionSupport | QuestionSupport["reponses"][number] }) {
  return (
    <p className="text-xs text-slate">
      <span className="font-medium text-ink">
        {message.estMien ? "Vous" : message.auteurNom}
      </span>
      {message.auteurFormateur ? (
        <span className="ml-1.5 rounded-full bg-mint px-1.5 py-0.5 text-[10px] font-medium text-forest">
          formateur
        </span>
      ) : null}
      <span className="ml-1.5">{formatDateTime(message.created_at)}</span>
    </p>
  );
}
