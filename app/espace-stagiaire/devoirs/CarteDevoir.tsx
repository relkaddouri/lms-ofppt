"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import AutoTextarea from "@/components/ui/AutoTextarea";
import { inputStyles } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { formatDateJour, formatDateTime, maintenant } from "@/lib/format";
import { enregistrerRendu, type DevoirStagiaire } from "@/app/actions/devoirs";
import { createClient } from "@/lib/supabase/client";
import {
  BUCKET_RENDUS,
  cheminRendu,
  RENDU_EXTENSIONS,
  RENDU_TAILLE_MAX,
  RENDU_TYPES,
  tailleLisible,
} from "@/lib/devoirs";
import { Check, ClipboardList, Paperclip, Save, X } from "lucide-react";

/** Jours restants avant l'échéance ; négatif si elle est passée. */
function joursRestants(echeance: string | null): number | null {
  if (!echeance) return null;
  const jour = 86_400_000;
  const aujourdhui = maintenant();
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
  const [fichier, setFichier] = useState(devoir.monRendu?.fichier ?? null);
  const [depot, setDepot] = useState<File | null>(null);
  const [televerse, setTeleverse] = useState(false);
  const fichierRef = useRef<HTMLInputElement>(null);
  const attendFichier = devoir.type_rendu === "fichier";

  const rendu = devoir.monRendu?.statut === "rendu";
  const jours = joursRestants(devoir.date_echeance);
  const enRetard = !rendu && jours !== null && jours < 0;

  function choisirFichier(f: File | undefined) {
    if (!f) return;
    if (!RENDU_TYPES.includes(f.type)) {
      toast("Format refusé : PDF, image, ZIP ou document Office.", "error");
      return;
    }
    if (f.size > RENDU_TAILLE_MAX) {
      toast(`Fichier trop lourd : ${tailleLisible(RENDU_TAILLE_MAX)} au maximum.`, "error");
      return;
    }
    setDepot(f);
  }

  function enregistrer(remettre: boolean) {
    startTransition(async () => {
      try {
        let joint = fichier;

        // Le fichier part sous la session du stagiaire : ce sont les policies
        // du bucket qui autorisent l'écriture, pas le serveur de l'app.
        if (depot) {
          setTeleverse(true);
          const chemin = cheminRendu(devoir.id, devoir.stagiaireId, depot.name);
          const { error } = await createClient()
            .storage.from(BUCKET_RENDUS)
            .upload(chemin, depot, { upsert: false, contentType: depot.type });
          setTeleverse(false);
          if (error) throw new Error(`Dépôt refusé : ${error.message}`);
          joint = { chemin, nom: depot.name, taille: depot.size };
        }

        await enregistrerRendu(devoir.id, contenu, remettre, joint);
        setFichier(joint);
        setDepot(null);
        toast(remettre ? "Devoir remis" : "Brouillon enregistré");
        router.refresh();
      } catch (e) {
        setTeleverse(false);
        toast(e instanceof Error ? e.message : "Enregistrement impossible.", "error");
      }
    });
  }

  return (
    <article className="border-b border-separator px-5 py-4 last:border-0">
      {/* Même grammaire de carte que les chapitres et les contrôles : une
          pastille qui dit l'état, le titre, une ligne d'appoint, l'étiquette
          à droite. */}
      <div className="flex items-start gap-[13px]">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${
            rendu
              ? "bg-green text-white"
              : enRetard
                ? "bg-alert-wash text-coral-dark"
                : "bg-tint-teal text-teal-dark"
          }`}
        >
          {rendu ? (
            <Check size={17} strokeWidth={2.6} aria-hidden />
          ) : (
            <ClipboardList size={17} strokeWidth={1.9} aria-hidden />
          )}
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="text-[15.5px] font-semibold leading-snug text-ink">
            {devoir.titre}
          </h2>
          <span className="font-mono text-[12.5px] text-slate-light">
            {devoir.moduleNom}
          </span>
          {devoir.date_echeance ? (
            <span
              className={`font-mono text-[12.5px] ${
                enRetard ? "text-coral-dark" : "text-slate-light"
              }`}
            >
              À rendre le{" "}
              {formatDateJour(devoir.date_echeance, { court: true })}
              {jours !== null && !rendu
                ? jours < 0
                  ? ` · en retard de ${-jours} jour${-jours > 1 ? "s" : ""}`
                  : jours === 0
                    ? " · aujourd'hui"
                    : ` · dans ${jours} jour${jours > 1 ? "s" : ""}`
                : ""}
            </span>
          ) : null}
        </div>

        <span className="shrink-0">
          {rendu ? (
            <Badge tone="success">rendu</Badge>
          ) : enRetard ? (
            <Badge tone="danger">en retard</Badge>
          ) : devoir.monRendu ? (
            <Badge tone="info">brouillon</Badge>
          ) : null}
        </span>
      </div>

      {/* Le corps s'aligne sur le titre là où il y a la place ; sur
          téléphone, il prend toute la largeur — une zone de saisie retranchée
          de 49 px n'y tiendrait plus. */}
      <div className="md:pl-[49px]">
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
            {devoir.monRendu?.fichier ? (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-2">
                <Paperclip size={13} aria-hidden />
                <span className="truncate">{devoir.monRendu.fichier.nom}</span>
                <span className="shrink-0 font-mono text-slate-light">
                  {tailleLisible(devoir.monRendu.fichier.taille)}
                </span>
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
                minRows={attendFichier ? 2 : 4}
                onChange={(e) => setContenu(e.target.value)}
                placeholder={
                  attendFichier
                    ? "Un mot pour accompagner (facultatif)…"
                    : "Votre réponse…"
                }
                aria-label="Votre rendu"
              />
            )}

            {attendFichier ? (
              <div className="mt-2 flex flex-col gap-2">
                <input
                  ref={fichierRef}
                  type="file"
                  accept={RENDU_EXTENSIONS}
                  className="sr-only"
                  onChange={(e) => {
                    choisirFichier(e.target.files?.[0]);
                    // Sans cela, redéposer le même fichier après un retrait
                    // n'émettrait aucun évènement.
                    e.target.value = "";
                  }}
                />

                {depot || fichier ? (
                  <span className="flex items-center gap-2 rounded-lg border border-border bg-wash px-3 py-2">
                    <Paperclip
                      size={14}
                      className="shrink-0 text-slate-2"
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">
                      {depot ? depot.name : fichier!.nom}
                    </span>
                    <span className="shrink-0 font-mono text-xs text-slate-light">
                      {tailleLisible(depot ? depot.size : fichier!.taille)}
                    </span>
                    <button
                      type="button"
                      aria-label="Retirer le fichier"
                      onClick={() => {
                        setDepot(null);
                        setFichier(null);
                      }}
                      disabled={enCours}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-2 hover:bg-surface hover:text-ink"
                    >
                      <X size={14} aria-hidden />
                    </button>
                  </span>
                ) : null}

                <Button
                  variant="secondary"
                  icon={Paperclip}
                  onClick={() => fichierRef.current?.click()}
                  disabled={enCours}
                  className="min-h-[44px] self-start"
                >
                  {depot || fichier
                    ? "Remplacer le fichier"
                    : "Choisir un fichier"}
                </Button>

                <p className="text-xs text-slate">
                  PDF, image, ZIP ou document Office,{" "}
                  {tailleLisible(RENDU_TAILLE_MAX)} au maximum. Votre fichier
                  n&apos;est visible que de vous et de votre formateur.
                </p>
              </div>
            ) : null}

            <div className="mt-2 flex gap-2">
              <Button
                icon={Check}
                onClick={() => enregistrer(true)}
                disabled={enCours || (!contenu.trim() && !depot && !fichier)}
                loading={televerse}
                loadingLabel="Envoi du fichier…"
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
      </div>
    </article>
  );
}
