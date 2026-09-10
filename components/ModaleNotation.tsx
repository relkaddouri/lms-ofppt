"use client";

import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Avatar from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import {
  cloturerSeance,
  getStagiairesANoter,
  type StagiaireANoter,
} from "@/app/actions/distinction";
import { ChevronLeft, ChevronRight, Crown } from "lucide-react";

/**
 * Noter la participation, un stagiaire à la fois (PRD §4.5).
 *
 * Un stagiaire par écran plutôt qu'une liste de seize curseurs : noter une
 * participation demande de se souvenir de la journée de quelqu'un, et une
 * liste invite à la parcourir en diagonale en posant la même note partout.
 * Le format oblige à passer devant chaque visage.
 *
 * La note par défaut est 5 — le milieu. Partir de 0 ferait d'une séance
 * ordinaire un mauvais jour pour qui l'oublie ; partir de 10 rendrait la
 * distinction insignifiante.
 */
const NOTE_PAR_DEFAUT = 5;

export default function ModaleNotation({
  seanceId,
  ouverte,
  onFermer,
  onCloture,
}: {
  seanceId: string;
  ouverte: boolean;
  onFermer: () => void;
  /** Appelé après la clôture, avec le nom du stagiaire distingué. */
  onCloture: (gagnant: string | null) => void;
}) {
  const toast = useToast();
  const [stagiaires, setStagiaires] = useState<StagiaireANoter[] | null>(null);
  const [notes, setNotes] = useState<Record<string, number>>({});
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ouverte) return;
    let annule = false;
    setStagiaires(null);
    getStagiairesANoter(seanceId)
      .then((liste) => {
        if (annule) return;
        // Les absents ne sont pas notés : ils ne sont pas dans la salle.
        const presents = liste.filter((s) => s.present);
        setStagiaires(presents);
        setNotes(
          Object.fromEntries(
            presents.map((s) => [s.id, s.note ?? NOTE_PAR_DEFAUT]),
          ),
        );
        setIndex(0);
      })
      .catch(() => {
        if (!annule) toast("Liste des stagiaires indisponible.", "error");
      });
    return () => {
      annule = true;
    };
  }, [ouverte, seanceId, toast]);

  const courant = stagiaires?.[index] ?? null;
  const dernier = stagiaires ? index >= stagiaires.length - 1 : false;

  // Le meilleur du moment, montré au formateur pendant qu'il note : il voit
  // se dessiner ce qu'il est en train de décider, plutôt que de le découvrir
  // après coup.
  const meilleur = useMemo(() => {
    if (!stagiaires?.length) return null;
    let gagnant: StagiaireANoter | null = null;
    let note = -1;
    for (const s of stagiaires) {
      const n = notes[s.id] ?? NOTE_PAR_DEFAUT;
      if (n > note) {
        note = n;
        gagnant = s;
      }
    }
    return gagnant ? { nom: gagnant.prenom, note } : null;
  }, [stagiaires, notes]);

  async function cloturer() {
    if (!stagiaires) return;
    setBusy(true);
    try {
      const resultat = await cloturerSeance(
        seanceId,
        stagiaires.map((s) => ({
          stagiaireId: s.id,
          note: notes[s.id] ?? NOTE_PAR_DEFAUT,
        })),
      );
      onCloture(resultat?.gagnant ?? null);
    } catch (e) {
      toast(
        e instanceof Error ? e.message : "La clôture a échoué.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={ouverte}
      onClose={onFermer}
      title="Participation de la journée"
      description="Notez chaque stagiaire sur 10. La meilleure note désigne le stagiaire de la journée."
      footer={
        <>
          <Button variant="ghost" onClick={onFermer} disabled={busy}>
            Annuler
          </Button>
          {dernier ? (
            <Button onClick={cloturer} loading={busy} loadingLabel="Clôture…">
              Clôturer la séance
            </Button>
          ) : (
            <Button
              iconRight={ChevronRight}
              onClick={() => setIndex((i) => i + 1)}
              disabled={busy || !stagiaires?.length}
            >
              Suivant
            </Button>
          )}
        </>
      }
    >
      {stagiaires === null ? (
        <p className="py-6 text-sm text-slate">Chargement du groupe…</p>
      ) : stagiaires.length === 0 ? (
        <p className="py-6 text-sm text-slate">
          Personne à noter : tout le groupe est marqué absent, ou la séance n
          &apos;a pas de stagiaires.
        </p>
      ) : courant ? (
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-slate-light">
              {index + 1} / {stagiaires.length}
            </span>
            {meilleur ? (
              <span className="flex items-center gap-1.5 rounded-full bg-success-wash px-2.5 py-1 text-[12.5px] font-medium text-green-dark">
                <Crown size={13} aria-hidden />
                {meilleur.nom} · {meilleur.note}/10
              </span>
            ) : null}
          </div>

          <div className="flex flex-col items-center gap-3 py-2">
            <Avatar
              nom={courant.nom}
              prenom={courant.prenom}
              photo={courant.photo}
              taille="lg"
              className="h-20 w-20 text-[26px]"
            />
            <p className="font-display text-lg font-semibold text-ink">
              {courant.prenom} {courant.nom}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold text-body">
                Participation
              </span>
              <span className="font-mono text-2xl font-medium text-ink">
                {(notes[courant.id] ?? NOTE_PAR_DEFAUT).toFixed(1)}
                <span className="text-sm text-muted"> / 10</span>
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={10}
              step={0.5}
              value={notes[courant.id] ?? NOTE_PAR_DEFAUT}
              onChange={(e) =>
                setNotes((n) => ({
                  ...n,
                  [courant.id]: Number(e.target.value),
                }))
              }
              className="h-11 w-full accent-ink"
              aria-label={`Participation de ${courant.prenom} ${courant.nom}`}
            />
            <div className="flex justify-between font-mono text-[11px] text-slate-light">
              <span>0</span>
              <span>5</span>
              <span>10</span>
            </div>
          </div>

          {index > 0 ? (
            <button
              type="button"
              onClick={() => setIndex((i) => i - 1)}
              disabled={busy}
              className="flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-slate-2 hover:text-ink"
            >
              <ChevronLeft size={16} aria-hidden />
              Revenir à {stagiaires[index - 1]?.prenom}
            </button>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}
