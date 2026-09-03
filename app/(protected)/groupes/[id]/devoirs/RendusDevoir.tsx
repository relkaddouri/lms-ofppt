"use client";

import { useState, useTransition } from "react";
import { ChevronDown, Download, Paperclip } from "lucide-react";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { formatDateTime } from "@/lib/format";
import { tailleLisible } from "@/lib/devoirs";
import { getRendusDevoir, lienRendu, type RenduRecu } from "@/app/actions/devoirs";

/**
 * Les copies déposées sur un devoir.
 *
 * Le compteur de la carte dit combien sont arrivées, jamais de qui ni quoi :
 * un devoir à rendre sous forme de fichier n'avait donc aucun endroit d'où le
 * récupérer. La liste ne se charge qu'à l'ouverture — la plupart des devoirs
 * se consultent sans qu'on ait besoin du détail.
 */
export default function RendusDevoir({
  devoirId,
  nbRendus,
}: {
  devoirId: string;
  nbRendus: number;
}) {
  const toast = useToast();
  const [ouvert, setOuvert] = useState(false);
  const [rendus, setRendus] = useState<RenduRecu[] | null>(null);
  const [enCours, startTransition] = useTransition();

  function basculer() {
    if (ouvert) {
      setOuvert(false);
      return;
    }
    setOuvert(true);
    if (rendus) return;
    startTransition(async () => {
      try {
        setRendus(await getRendusDevoir(devoirId));
      } catch (e) {
        toast(e instanceof Error ? e.message : "Lecture impossible.", "error");
        setOuvert(false);
      }
    });
  }

  function telecharger(rendu: RenduRecu) {
    startTransition(async () => {
      try {
        // Le bucket est privé : le lien est signé à la demande, sous la
        // session du formateur, et expire au bout de quelques minutes.
        const url = await lienRendu(rendu.fichier!.chemin);
        window.open(url, "_blank", "noopener,noreferrer");
      } catch (e) {
        toast(e instanceof Error ? e.message : "Téléchargement impossible.", "error");
      }
    });
  }

  return (
    <div className="mt-3 border-t border-separator pt-3">
      <button
        type="button"
        onClick={basculer}
        aria-expanded={ouvert}
        disabled={nbRendus === 0}
        className="flex items-center gap-1.5 text-[13.5px] font-semibold text-ink transition-colors duration-150 ease-out hover:text-teal disabled:cursor-not-allowed disabled:text-muted"
      >
        <ChevronDown
          size={15}
          aria-hidden
          className={`transition-transform duration-150 ease-out ${ouvert ? "rotate-180" : ""}`}
        />
        {nbRendus === 0
          ? "Aucune copie déposée"
          : ouvert
            ? "Masquer les copies"
            : nbRendus === 1
              ? "Voir la copie"
              : `Voir les ${nbRendus} copies`}
      </button>

      {ouvert ? (
        <div className="mt-2.5 flex flex-col gap-2">
          {rendus === null ? (
            <p className="text-[13px] text-slate-light">Chargement…</p>
          ) : rendus.length === 0 ? (
            <p className="text-[13px] text-slate-light">
              Rien n&apos;a encore été déposé.
            </p>
          ) : (
            rendus.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[10px] border border-border bg-paper px-3 py-2.5"
              >
                <span className="text-[14px] font-semibold text-ink">
                  {r.stagiaire}
                </span>
                <Badge tone={r.statut === "rendu" ? "success" : "neutral"}>
                  {r.statut === "rendu" ? "rendu" : "brouillon"}
                </Badge>
                {r.date_rendu ? (
                  <span className="font-mono text-[12px] text-slate-light">
                    {formatDateTime(r.date_rendu)}
                  </span>
                ) : null}

                {r.fichier ? (
                  <span className="ml-auto flex items-center gap-2">
                    <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-slate-2">
                      <Paperclip size={13} aria-hidden className="shrink-0" />
                      <span className="truncate">{r.fichier.nom}</span>
                      <span className="shrink-0 font-mono text-slate-light">
                        {tailleLisible(r.fichier.taille)}
                      </span>
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={Download}
                      onClick={() => telecharger(r)}
                      disabled={enCours}
                    >
                      Télécharger
                    </Button>
                  </span>
                ) : null}

                {r.contenu ? (
                  <p className="w-full whitespace-pre-line break-words text-[13.5px] text-body">
                    {r.contenu}
                  </p>
                ) : null}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
