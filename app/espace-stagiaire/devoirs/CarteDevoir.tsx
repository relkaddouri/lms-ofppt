"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import AutoTextarea from "@/components/ui/AutoTextarea";
import { inputStyles } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { formatDate, formatDateTime } from "@/lib/format";
import { enregistrerRendu, type DevoirStagiaire } from "@/app/actions/devoirs";
import { Check, Save } from "lucide-react";

/** Jours restants avant l'échéance ; négatif si elle est passée. */
function joursRestants(echeance: string | null): number | null {
  if (!echeance) return null;
  const jour = 86_400_000;
  const aujourdhui = new Date().toISOString().slice(0, 10);
  return Math.round(
    (new Date(`${echeance}T12:00:00Z`).getTime() -
      new Date(`${aujourdhui}T12:00:00Z`).getTime()) /
      jour,
  );
}

export default function CarteDevoir({ devoir }: { devoir: DevoirStagiaire }) {
  const router = useRouter();
  const toast = useToast();
  const [enCours, startTransition] = useTransition();
  const [contenu, setContenu] = useState(devoir.monRendu?.contenu ?? "");
  const [ouvert, setOuvert] = useState(false);

  const rendu = devoir.monRendu?.statut === "rendu";
  const jours = joursRestants(devoir.date_echeance);
  const enRetard = !rendu && jours !== null && jours < 0;

  function enregistrer(remettre: boolean) {
    startTransition(async () => {
      try {
        await enregistrerRendu(devoir.id, contenu, remettre);
        toast(remettre ? "Devoir remis" : "Brouillon enregistré");
        router.refresh();
      } catch (e) {
        toast(e instanceof Error ? e.message : "Enregistrement impossible.", "error");
      }
    });
  }

  return (
    <article className="border-b border-border p-4 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-ink">{devoir.titre}</h2>
          {devoir.moduleNom ? (
            <p className="mt-0.5 text-xs text-slate">{devoir.moduleNom}</p>
          ) : null}
        </div>
        {rendu ? (
          <Badge tone="success">rendu</Badge>
        ) : enRetard ? (
          <Badge tone="danger">en retard</Badge>
        ) : devoir.monRendu ? (
          <Badge tone="info">brouillon</Badge>
        ) : null}
      </div>

      {devoir.date_echeance ? (
        <p
          className={`mt-2 text-sm ${enRetard ? "text-coral-dark" : "text-slate"}`}
        >
          À rendre le {formatDate(devoir.date_echeance)}
          {jours !== null && !rendu ? (
            <span>
              {" — "}
              {jours < 0
                ? `en retard de ${-jours} jour${-jours > 1 ? "s" : ""}`
                : jours === 0
                  ? "aujourd'hui"
                  : `dans ${jours} jour${jours > 1 ? "s" : ""}`}
            </span>
          ) : null}
        </p>
      ) : null}

      {devoir.description ? (
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink">
          {devoir.description}
        </p>
      ) : null}

      {rendu ? (
        <div className="mt-3 rounded-lg bg-wash px-3 py-2">
          <p className="text-xs text-ink">
            Remis le {formatDateTime(devoir.monRendu!.date_rendu!)}
          </p>
          {devoir.monRendu?.contenu ? (
            <p className="mt-1 whitespace-pre-line break-words text-sm text-ink">
              {devoir.monRendu.contenu}
            </p>
          ) : null}
        </div>
      ) : ouvert ? (
        <div className="mt-3">
          {devoir.type_rendu === "lien" ? (
            <input
              value={contenu}
              onChange={(e) => setContenu(e.target.value)}
              placeholder="https://…"
              aria-label="Lien du rendu"
              className={inputStyles}
            />
          ) : (
            <AutoTextarea
              value={contenu}
              minRows={4}
              onChange={(e) => setContenu(e.target.value)}
              placeholder={
                devoir.type_rendu === "fichier"
                  ? "Collez le lien de partage de votre fichier…"
                  : "Votre réponse…"
              }
              aria-label="Votre rendu"
            />
          )}

          {devoir.type_rendu === "fichier" ? (
            <p className="mt-1 text-xs text-slate">
              Le dépôt de fichier n&apos;est pas encore disponible : partagez un
              lien vers votre document.
            </p>
          ) : null}

          <div className="mt-2 flex gap-2">
            <Button
              icon={Check}
              onClick={() => enregistrer(true)}
              disabled={enCours || !contenu.trim()}
              className="min-h-[44px]"
            >
              Remettre
            </Button>
            <Button
              variant="ghost"
              icon={Save}
              onClick={() => enregistrer(false)}
              disabled={enCours}
              className="min-h-[44px]"
            >
              Brouillon
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="secondary"
          onClick={() => setOuvert(true)}
          className="mt-3 min-h-[44px]"
        >
          {devoir.monRendu ? "Reprendre mon brouillon" : "Faire ce devoir"}
        </Button>
      )}
    </article>
  );
}
