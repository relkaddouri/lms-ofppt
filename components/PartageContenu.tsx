"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/format";
import { formatHeure } from "@/lib/creneaux";
import {
  getSeancesParalleles,
  partagerContenu,
  cesserPartage,
} from "@/app/actions/partage";
import type { SeanceParallele } from "@/lib/partage";
import { Link2, Link2Off, Users } from "lucide-react";

/**
 * Partage de la fiche et du support entre séances de groupes parallèles
 * (§4.3bis).
 *
 * Le rapprochement automatique n'apparaît qu'à la demande, et toujours comme
 * une proposition : lier deux séances fait qu'écrire ici modifie ce que voit
 * un autre groupe, absent de l'écran. Cet effet-là se consent explicitement.
 */
export default function PartageContenu({
  seanceId,
  partage,
}: {
  seanceId: string;
  partage: { role: "source" | "miroir"; groupes: string[] } | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [enCours, startTransition] = useTransition();

  const [propositions, setPropositions] = useState<SeanceParallele[] | null>(
    null,
  );
  const [aDetacher, setADetacher] = useState(false);
  const [aLier, setALier] = useState<SeanceParallele | null>(null);

  function chercher() {
    startTransition(async () => {
      try {
        const trouvees = await getSeancesParalleles(seanceId);
        setPropositions(trouvees);
        if (trouvees.length === 0) {
          toast("Aucune séance parallèle repérée sur ce contenu");
        }
      } catch (e) {
        toast(e instanceof Error ? e.message : "Recherche impossible");
      }
    });
  }

  function lier() {
    const cible = aLier;
    if (!cible) return;
    startTransition(async () => {
      try {
        await partagerContenu(seanceId, cible.id);
        setALier(null);
        setPropositions(null);
        toast(`Fiche et support partagés avec ${cible.groupeNom}`);
        router.refresh();
      } catch (e) {
        toast(e instanceof Error ? e.message : "Partage impossible");
      }
    });
  }

  function detacher() {
    startTransition(async () => {
      try {
        await cesserPartage(seanceId);
        setADetacher(false);
        toast("Séance détachée du contenu partagé");
        router.refresh();
      } catch (e) {
        toast(e instanceof Error ? e.message : "Détachement impossible");
      }
    });
  }

  const listeGroupes = partage?.groupes.join(", ") ?? "";
  // Plusieurs séances d'un même groupe peuvent porter les mêmes éléments :
  // le rapprochement ne tranche pas, il le dit.
  const ambigu =
    propositions !== null &&
    new Set(propositions.map((p) => p.groupeNom)).size < propositions.length;

  return (
    <>
      {partage ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-tint-teal-strong bg-tint-teal px-4 py-3">
          <p className="flex items-start gap-2 text-[13.5px] text-ink">
            <Users size={16} className="mt-0.5 shrink-0 text-teal" aria-hidden />
            <span>
              {partage.role === "miroir" ? (
                <>
                  Contenu partagé : cette fiche et ce support appartiennent à la
                  séance de <strong className="font-semibold">{listeGroupes}</strong>.
                  Ce que vous écrivez ici vaut pour les deux groupes.
                </>
              ) : (
                <>
                  Contenu partagé avec{" "}
                  <strong className="font-semibold">{listeGroupes}</strong>. Ce
                  que vous écrivez ici vaut pour les deux groupes.
                </>
              )}
            </span>
          </p>
          {partage.role === "miroir" ? (
            <Button
              variant="secondary"
              size="sm"
              icon={Link2Off}
              onClick={() => setADetacher(true)}
              disabled={enCours}
            >
              Ne plus partager
            </Button>
          ) : null}
        </div>
      ) : propositions === null ? (
        <Button
          variant="secondary"
          size="sm"
          icon={Link2}
          onClick={chercher}
          disabled={enCours}
        >
          Partager avec un groupe parallèle
        </Button>
      ) : (
        <div className="rounded-[10px] border border-border bg-paper-alt px-4 py-3.5">
          <p className="text-[13.5px] text-slate">
            Ces séances couvrent les mêmes éléments de contenu. Les lier fait
            qu&apos;une seule fiche et un seul support servent aux deux groupes.
          </p>
          {ambigu ? (
            <p className="mt-1.5 text-[13px] text-muted">
              Un même objectif s&apos;étale sur plusieurs créneaux : toutes ses
              séances portent les mêmes éléments. La date vous dit laquelle
              correspond.
            </p>
          ) : null}
          <ul className="mt-3 flex flex-col gap-2">
            {propositions.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-separator bg-surface px-3.5 py-2.5"
              >
                <span className="text-[13.5px] text-ink">
                  <strong className="font-semibold">{p.groupeNom}</strong>
                  {p.date ? ` — ${formatDate(p.date)}` : ""}
                  {p.heure_debut && p.heure_fin
                    ? ` ${formatHeure(p.heure_debut)}–${formatHeure(p.heure_fin)}`
                    : ""}
                  {p.objectif ? (
                    <span className="block text-[13px] text-muted">
                      {p.objectif}
                    </span>
                  ) : null}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setALier(p)}
                  disabled={enCours || p.dejaLiee}
                >
                  {p.dejaLiee ? "Déjà partagée" : "Partager"}
                </Button>
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPropositions(null)}
              disabled={enCours}
            >
              Annuler
            </Button>
          </div>
        </div>
      )}

      <ConfirmModal
        open={aLier !== null}
        title="Partager le contenu ?"
        message={`La fiche et le support de cette séance seront ceux de ${aLier?.groupeNom ?? ""}. Le contenu propre à cette séance, s'il existe, sera supprimé. Les présences, les remarques et le contrôle ne sont pas concernés.`}
        confirmLabel="Partager"
        onConfirm={lier}
        onClose={() => setALier(null)}
        busy={enCours}
      />

      <ConfirmModal
        open={aDetacher}
        title="Ne plus partager ?"
        message="Cette séance repartira sans fiche ni support : elle n'en reçoit pas de copie. L'autre groupe garde les siens."
        confirmLabel="Détacher"
        onConfirm={detacher}
        onClose={() => setADetacher(false)}
        busy={enCours}
      />
    </>
  );
}
