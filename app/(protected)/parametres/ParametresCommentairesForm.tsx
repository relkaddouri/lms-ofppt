"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Interrupteur from "@/components/ui/Interrupteur";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import {
  enregistrerReglagesCommentaires,
  type ReglagesCommentaires,
} from "@/app/actions/questions-support";

/**
 * Les questions que les stagiaires posent sous les cours (PRD §4.4).
 *
 * Deux interrupteurs et rien d'autre. Ils s'appliquent à tous les groupes du
 * formateur à la fois : le besoin est venu d'un groupe qui écrivait des
 * messages déplacés, et un réglage par cours aurait obligé à refermer chaque
 * support un par un — y compris ceux qui ne sont pas encore écrits.
 *
 * La base tient ces réglages, pas cet écran : un stagiaire qui appellerait
 * l'API directement se heurterait au même refus.
 */
export default function ParametresCommentairesForm({
  initial,
}: {
  initial: ReglagesCommentaires;
}) {
  const router = useRouter();
  const toast = useToast();
  const [ouverts, setOuverts] = useState(initial.ouverts);
  const [valides, setValides] = useState(initial.valides);
  const [enCours, startTransition] = useTransition();

  const modifie = ouverts !== initial.ouverts || valides !== initial.valides;

  function enregistrer() {
    startTransition(async () => {
      try {
        await enregistrerReglagesCommentaires({ ouverts, valides });
        toast("Réglages des questions enregistrés");
        router.refresh();
      } catch (e) {
        toast(
          e instanceof Error ? e.message : "Enregistrement impossible.",
          "error",
        );
      }
    });
  }

  return (
    <section className="flex flex-col gap-5 rounded-[14px] border border-border bg-surface p-6 shadow-repos">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-lg font-semibold text-ink">
          Questions sous les cours
        </h2>
        <p className="text-[14px] leading-snug text-slate-light">
          Ce que vos stagiaires peuvent écrire sous les supports que vous leur
          remettez. S&apos;applique à tous vos groupes.
        </p>
      </div>

      <div className="flex items-start justify-between gap-6 border-t border-separator pt-5">
        <div className="flex flex-col gap-1">
          <span className="text-[15px] font-semibold text-ink">
            Questions ouvertes
          </span>
          <span className="max-w-[46ch] text-[13.5px] leading-snug text-slate-light">
            Fermées, les stagiaires ne peuvent plus poser de question ni
            répondre. Ce qui est déjà publié reste lisible, et vous pouvez
            toujours répondre.
          </span>
        </div>
        <Interrupteur
          actif={ouverts}
          onChange={setOuverts}
          label="Autoriser les stagiaires à écrire sous les cours"
        />
      </div>

      <div className="flex items-start justify-between gap-6 border-t border-separator pt-5">
        <div className="flex flex-col gap-1">
          <span
            className={`text-[15px] font-semibold ${ouverts ? "text-ink" : "text-muted"}`}
          >
            Valider avant publication
          </span>
          <span className="max-w-[46ch] text-[13.5px] leading-snug text-slate-light">
            Chaque question ou réponse d&apos;un stagiaire reste invisible pour
            le groupe tant que vous ne l&apos;avez pas publiée. Son auteur la
            voit, marquée en attente.
          </span>
        </div>
        {/* Sans objet quand les questions sont fermées : on le montre
            grisé plutôt que de le cacher, pour qu'il soit retrouvé à la
            réouverture exactement où on l'avait laissé. */}
        <Interrupteur
          actif={valides}
          onChange={setValides}
          disabled={!ouverts}
          label="Valider les messages des stagiaires avant publication"
        />
      </div>

      {/* Réglage déjà en place, on dit ce qu'il fait maintenant — pas ce
          qu'il ferait. */}
      <p className="rounded-[10px] border border-border bg-paper-alt px-3.5 py-3 text-[13.5px] text-slate-2">
        {!ouverts
          ? "Les stagiaires lisent les questions publiées, mais ne peuvent plus en écrire."
          : valides
            ? "Les stagiaires écrivent ; rien n'est visible du groupe avant votre validation."
            : "Les stagiaires écrivent, et leurs messages sont visibles aussitôt."}
      </p>

      <div className="flex justify-end gap-3 border-t border-separator pt-5">
        <Button
          variant="ghost"
          onClick={() => {
            setOuverts(initial.ouverts);
            setValides(initial.valides);
          }}
          disabled={!modifie || enCours}
        >
          Annuler
        </Button>
        <Button
          onClick={enregistrer}
          disabled={!modifie}
          loading={enCours}
          loadingLabel="Enregistrement…"
        >
          Enregistrer
        </Button>
      </div>
    </section>
  );
}
