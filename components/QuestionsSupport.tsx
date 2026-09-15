"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import { ConfirmModal } from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/format";
import TexteMentions from "@/components/TexteMentions";
import ChampMention from "@/components/ChampMention";
import EditeurReponse from "@/components/EditeurReponse";
import ReponseMarkdown from "@/components/ReponseMarkdown";
import {
  poserQuestion,
  publierMessage,
  repondreQuestion,
  supprimerMessage,
  type Message,
  type QuestionSupport,
  type ReglagesCommentaires,
} from "@/app/actions/questions-support";
import type { Camarade } from "@/app/actions/fil";
import {
  Check,
  Lock,
  MessageCircle,
  Reply,
  Settings2,
  Trash2,
} from "lucide-react";

type Genre = "question" | "reponse";

/** Le message à supprimer, retenu le temps de la confirmation. */
type ASupprimer = {
  genre: Genre;
  message: Message;
  /** Les réponses qui partiront avec la question, en cascade. */
  reponses: number;
} | null;

/**
 * Les questions posées sur un support, et leurs réponses.
 *
 * La question reste attachée au cours qui l'a fait naître : la relire un an
 * plus tard n'a de sens qu'à côté du passage qui bloquait. Un camarade répond
 * aussi bien que le formateur — d'où la même mécanique de mention des deux
 * côtés, et le même composant dans les deux espaces.
 *
 * Le formateur modère (migration 085) : ce qu'écrit un stagiaire peut attendre
 * sa validation, les questions peuvent être fermées, et tout message peut être
 * supprimé. Rien de cela n'est tenu par cet écran seul — la base refuse ce que
 * l'écran ne propose pas, et l'écran ne montre que ce que la base a renvoyé.
 */
export default function QuestionsSupport({
  supportId,
  questions,
  camarades,
  vue = "stagiaire",
  reglages = { ouverts: true, valides: true },
}: {
  supportId: string;
  questions: QuestionSupport[];
  camarades: Camarade[];
  /** Le formateur répond et modère ; il ne se pose pas de question à lui-même. */
  vue?: "stagiaire" | "formateur";
  /** Côté stagiaire : décide s'il y a lieu de proposer d'écrire. */
  reglages?: ReglagesCommentaires;
}) {
  const router = useRouter();
  const toast = useToast();
  const [enCours, startTransition] = useTransition();
  const [repondA, setRepondA] = useState<string | null>(null);
  const [aSupprimer, setASupprimer] = useState<ASupprimer>(null);

  const formateur = vue === "formateur";
  // Le formateur écrit toujours : fermer les questions ne concerne que les
  // stagiaires, c'est lui qui modère.
  const peutEcrire = formateur || reglages.ouverts;

  function agir(action: () => Promise<void>, succes: string) {
    startTransition(async () => {
      try {
        await action();
        toast(succes);
        setRepondA(null);
        setASupprimer(null);
        router.refresh();
      } catch (e) {
        toast(e instanceof Error ? e.message : "Action impossible.", "error");
      }
    });
  }

  // Ce que le formateur a à trancher, compté pour l'en-tête : sans ce
  // chiffre, il faudrait parcourir tout le fil pour savoir s'il reste du
  // travail.
  const enAttente = formateur
    ? questions.reduce(
        (n, q) =>
          n +
          (q.enAttente ? 1 : 0) +
          q.reponses.filter((r) => r.enAttente).length,
        0,
      )
    : 0;

  // Le stagiaire est prévenu de ce qui arrive à son message, au moment où il
  // l'envoie : sinon il le chercherait dans le fil et croirait à une panne.
  const apresEnvoi = (quoi: "question" | "réponse") =>
    !formateur && reglages.valides
      ? `${quoi === "question" ? "Question envoyée" : "Réponse envoyée"} — elle sera visible après validation par votre formateur.`
      : quoi === "question"
        ? "Question posée"
        : "Réponse envoyée";

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <MessageCircle className="h-4 w-4 text-slate" aria-hidden />
          Questions sur ce cours
          {questions.length > 0 ? (
            <span className="font-normal text-slate">({questions.length})</span>
          ) : null}
          {enAttente > 0 ? (
            <Badge tone="info">{enAttente} à valider</Badge>
          ) : null}
        </h2>

        {/* Les réglages vivent dans les paramètres ; le lien est ici parce
            que c'est ici qu'on découvre qu'on en a besoin. */}
        {formateur ? (
          <Link
            href="/parametres?onglet=commentaires"
            className="flex min-h-11 items-center gap-1.5 text-[13px] font-medium text-slate-2 no-underline hover:text-ink hover:no-underline"
          >
            <Settings2 className="h-4 w-4" aria-hidden />
            Réglages des questions
          </Link>
        ) : null}
      </div>

      {questions.length === 0 ? (
        <p className="text-sm text-slate">
          {formateur
            ? "Aucune question posée sur ce support pour l'instant."
            : reglages.ouverts
              ? "Un point du cours reste flou ? Posez la question ici : votre formateur et vos camarades la verront."
              : "Aucune question sur ce cours."}
        </p>
      ) : (
        <ul className="space-y-3">
          {questions.map((q) => (
            <li
              key={q.id}
              // L'ancre que vise la notification : elle pointe la question,
              // pas la liste qui la contient.
              id={`question-${q.id}`}
              className={`scroll-mt-24 rounded-[14px] border p-4 target:border-tint-teal-strong target:bg-tint-teal ${
                q.enAttente
                  ? "border-dashed border-border-strong bg-paper-alt"
                  : "border-border bg-surface"
              }`}
            >
              <Entete message={q} formateur={formateur} />
              <Corps message={q} camarades={camarades} />

              <Actions
                message={q}
                formateur={formateur}
                enCours={enCours}
                onPublier={() =>
                  agir(
                    () => publierMessage("question", q.id, supportId),
                    "Question publiée",
                  )
                }
                onSupprimer={() =>
                  setASupprimer({
                    genre: "question",
                    message: q,
                    reponses: q.reponses.length,
                  })
                }
              />

              {q.reponses.length > 0 ? (
                <ul className="mt-3 space-y-3 border-l-2 border-mint pl-3">
                  {q.reponses.map((r) => (
                    <li
                      key={r.id}
                      className={
                        r.enAttente
                          ? "rounded-[10px] border border-dashed border-border-strong bg-paper-alt p-2.5"
                          : ""
                      }
                    >
                      <Entete message={r} formateur={formateur} />
                      <Corps message={r} camarades={camarades} />
                      <Actions
                        message={r}
                        formateur={formateur}
                        enCours={enCours}
                        onPublier={() =>
                          agir(
                            () => publierMessage("reponse", r.id, supportId),
                            "Réponse publiée",
                          )
                        }
                        onSupprimer={() =>
                          setASupprimer({
                            genre: "reponse",
                            message: r,
                            reponses: 0,
                          })
                        }
                      />
                    </li>
                  ))}
                </ul>
              ) : null}

              {/* On ne répond pas à une question que le groupe ne voit pas
                  encore : la réponse serait publiée sur un fil vide. */}
              {peutEcrire && !q.enAttente ? (
                repondA === q.id ? (
                  <div className="mt-3">
                    {/* Le formateur explique : une zone qui grandit, du
                        Markdown, un aperçu. Le stagiaire commente : le champ
                        d'une ligne lui suffit, et un astérisque dans sa
                        question doit rester un astérisque. */}
                    {formateur ? (
                      <EditeurReponse
                        camarades={camarades}
                        busy={enCours}
                        onAnnuler={() => setRepondA(null)}
                        onEnvoyer={(texte) =>
                          agir(
                            () => repondreQuestion(q.id, texte, supportId),
                            apresEnvoi("réponse"),
                          )
                        }
                      />
                    ) : (
                      <ChampMention
                        camarades={camarades}
                        busy={enCours}
                        placeholder="Votre réponse… @ pour mentionner"
                        onEnvoyer={(texte) =>
                          agir(
                            () => repondreQuestion(q.id, texte, supportId),
                            apresEnvoi("réponse"),
                          )
                        }
                      />
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setRepondA(q.id)}
                    className="mt-3 flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-ink"
                  >
                    <Reply className="h-4 w-4" aria-hidden />
                    Répondre
                  </button>
                )
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {!formateur ? (
        reglages.ouverts ? (
          <div className="space-y-2">
            <ChampMention
              camarades={camarades}
              busy={enCours}
              placeholder="Poser une question… @ pour mentionner"
              onEnvoyer={(texte) =>
                agir(
                  () => poserQuestion(supportId, texte),
                  apresEnvoi("question"),
                )
              }
            />
            {/* Dit avant l'envoi, pas seulement après : un message qui
                n'apparaît pas tout de suite ne doit surprendre personne. */}
            {reglages.valides ? (
              <p className="text-[12.5px] text-slate-light">
                Votre formateur valide chaque message avant qu&apos;il soit
                visible par le groupe.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="flex items-center gap-2 rounded-[10px] border border-border bg-paper-alt px-3.5 py-3 text-[13.5px] text-slate-2">
            <Lock className="h-4 w-4 shrink-0" aria-hidden />
            Les questions sont fermées sur les cours pour le moment.
          </p>
        )
      ) : null}

      <ConfirmModal
        open={aSupprimer !== null}
        onClose={() => setASupprimer(null)}
        busy={enCours}
        title={
          aSupprimer?.genre === "question"
            ? "Supprimer cette question ?"
            : "Supprimer cette réponse ?"
        }
        message={
          aSupprimer ? (
            <>
              «&nbsp;{extrait(aSupprimer.message.texte)}&nbsp;»
              {aSupprimer.reponses > 0
                ? ` sera définitivement effacée, avec ${
                    aSupprimer.reponses > 1
                      ? `ses ${aSupprimer.reponses} réponses`
                      : "sa réponse"
                  }.`
                : " sera définitivement effacée."}
            </>
          ) : null
        }
        onConfirm={() => {
          const cible = aSupprimer;
          if (!cible) return;
          agir(
            () => supprimerMessage(cible.genre, cible.message.id, supportId),
            cible.genre === "question"
              ? "Question supprimée"
              : "Réponse supprimée",
          );
        }}
      />
    </section>
  );
}

/**
 * Le texte d'un message.
 *
 * Markdown pour le formateur, texte simple pour un stagiaire. La distinction
 * suit l'auteur et non l'écran : le stagiaire lit la réponse mise en forme,
 * comme le formateur l'a écrite et prévisualisée.
 */
function Corps({
  message,
  camarades,
}: {
  message: Message;
  camarades: Camarade[];
}) {
  if (message.auteurFormateur) {
    return (
      <div className="mt-1.5">
        <ReponseMarkdown texte={message.texte} camarades={camarades} />
      </div>
    );
  }
  return (
    <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink">
      <TexteMentions texte={message.texte} camarades={camarades} />
    </p>
  );
}

/** Le début d'un message, pour que la confirmation dise lequel on efface. */
function extrait(texte: string): string {
  const net = texte.replace(/\s+/g, " ").trim();
  return net.length > 90 ? `${net.slice(0, 90)}…` : net;
}

function Entete({
  message,
  formateur,
}: {
  message: Message;
  formateur: boolean;
}) {
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-slate">
      <span className="font-medium text-ink">
        {message.estMien ? "Vous" : message.auteurNom}
      </span>
      {message.auteurFormateur ? (
        <span className="rounded-full bg-wash px-1.5 py-0.5 text-[10px] font-medium text-ink">
          formateur
        </span>
      ) : null}
      <span>{formatDateTime(message.created_at)}</span>
      {/* Le mot ne dit pas la même chose aux deux : au formateur, un travail
          à faire ; à l'auteur, pourquoi personne ne lui répond encore. */}
      {message.enAttente ? (
        <Badge tone="neutral">
          {formateur
            ? "à valider"
            : "en attente de validation · visible par vous seul"}
        </Badge>
      ) : null}
    </p>
  );
}

/**
 * Publier, supprimer.
 *
 * Le formateur voit les deux sur tout message ; un stagiaire ne voit que la
 * suppression, et seulement sur les siens — ce que la policy lui permet déjà,
 * et qu'il n'avait aucun moyen de faire depuis l'écran.
 */
function Actions({
  message,
  formateur,
  enCours,
  onPublier,
  onSupprimer,
}: {
  message: Message;
  formateur: boolean;
  enCours: boolean;
  onPublier: () => void;
  onSupprimer: () => void;
}) {
  const peutPublier = formateur && message.enAttente;
  const peutSupprimer = formateur || message.estMien;
  if (!peutPublier && !peutSupprimer) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {peutPublier ? (
        <button
          type="button"
          onClick={onPublier}
          disabled={enCours}
          className="flex min-h-11 items-center gap-1.5 rounded-[9px] border border-tint-green bg-success-wash px-3 text-[13px] font-semibold text-green-dark transition-colors duration-150 ease-out hover:border-green disabled:opacity-60 md:min-h-9"
        >
          <Check className="h-4 w-4" aria-hidden />
          Publier
        </button>
      ) : null}
      {peutSupprimer ? (
        <button
          type="button"
          onClick={onSupprimer}
          disabled={enCours}
          className="flex min-h-11 items-center gap-1.5 rounded-[9px] border border-transparent px-2.5 text-[13px] font-medium text-slate-2 transition-colors duration-150 ease-out hover:border-tint-alert-strong hover:bg-alert-wash hover:text-coral-dark disabled:opacity-60 md:min-h-9"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
          Supprimer
        </button>
      ) : null}
    </div>
  );
}
