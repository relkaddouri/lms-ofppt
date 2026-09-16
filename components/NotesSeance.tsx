"use client";

import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import {
  enregistrerNotesSeance,
  getNotesSeance,
} from "@/app/actions/notes-seance";

/**
 * « Notes pour moi » : ce que le formateur garde pour lui sur une séance.
 *
 * Chargées à part, et enregistrées à part du déroulement : une note se prend
 * en passant, sans vouloir clôturer ni réenregistrer l'appel.
 */
export default function NotesSeance({ seanceId }: { seanceId: string }) {
  const toast = useToast();
  const [texte, setTexte] = useState("");
  const [enregistre, setEnregistre] = useState("");
  const [charge, setCharge] = useState(false);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    let annule = false;
    getNotesSeance(seanceId)
      .then((t) => {
        if (annule) return;
        setTexte(t);
        setEnregistre(t);
      })
      .catch(() => {})
      .finally(() => !annule && setCharge(true));
    return () => {
      annule = true;
    };
  }, [seanceId]);

  const modifie = texte !== enregistre;

  async function enregistrer() {
    setEnCours(true);
    try {
      await enregistrerNotesSeance(seanceId, texte);
      setEnregistre(texte);
      toast("Notes enregistrées.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erreur inattendue", "error");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-[14px] border border-border bg-surface p-[22px] shadow-repos">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold text-ink">
          <Lock className="h-4 w-4 text-slate" aria-hidden />
          Notes pour moi
        </h2>
        {modifie ? (
          <span className="font-mono text-[12.5px] text-muted">
            non enregistrées
          </span>
        ) : null}
      </div>
      <textarea
        rows={3}
        value={texte}
        disabled={!charge}
        aria-label="Notes pour moi"
        onChange={(e) => setTexte(e.target.value)}
        placeholder="Organisation, rattrapage, rappel pour la prochaine fois…"
        className="w-full resize-y rounded-[10px] border border-border-strong bg-paper-alt px-[15px] py-[13px] text-[15px] leading-relaxed text-body outline-none placeholder:text-slate-light focus:border-teal"
      />
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex-1 text-[13px] text-slate-light">
          Jamais montrées aux stagiaires, jamais envoyées à l&apos;IA.
        </span>
        <Button
          size="sm"
          variant="secondary"
          onClick={enregistrer}
          disabled={enCours || !modifie}
        >
          Enregistrer les notes
        </Button>
      </div>
    </section>
  );
}
