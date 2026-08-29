"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { ConfirmModal } from "@/components/ui/Modal";
import { inputStyles as inputClass } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import FicheSeance from "@/components/FicheSeance";
import SupportSeance from "@/components/SupportSeance";
import QuestionsSupport from "@/components/QuestionsSupport";
import { formatDate, formatDateTime, formatHeures } from "@/lib/format";
import { formatHeure } from "@/lib/creneaux";
import {
  setPresence,
  marquerToutPresent,
  ajouterRemarque,
  supprimerRemarque,
  majSeance,
  type SeanceDetail,
  type RemarqueSeance,
} from "@/app/actions/seance";
import { Check, CheckCheck, Plus, Trash2, X } from "lucide-react";

export default function SeanceDetailView({ seance }: { seance: SeanceDetail }) {
  const router = useRouter();
  const toast = useToast();
  const [enCours, startTransition] = useTransition();

  const [presences, setPresences] = useState(seance.presences);
  const [nouvelleRemarque, setNouvelleRemarque] = useState("");
  // Une remarque d'observation ne se retape pas : on confirme avant d'effacer.
  const [remarqueASupprimer, setRemarqueASupprimer] =
    useState<RemarqueSeance | null>(null);
  const [contenuRealise, setContenuRealise] = useState(
    seance.contenu_realise ?? "",
  );
  // Trois moments distincts : préparer, projeter, tenir le cahier. Les empiler
  // obligeait à traverser mille pixels de formulaire pour atteindre le support.
  const [onglet, setOnglet] = useState<
    "preparation" | "support" | "deroulement"
  >("preparation");

  const minutesSeance = seance.duree_prevue
    ? Math.round(Number(seance.duree_prevue) * 60)
    : null;

  const presents = presences.filter((p) => p.present === true).length;
  const absents = presences.filter((p) => p.present === false).length;
  const nonPointes = presences.filter((p) => p.present === null).length;

  function supprimerLaRemarque() {
    const cible = remarqueASupprimer;
    if (!cible) return;
    startTransition(async () => {
      try {
        await supprimerRemarque(cible.id);
        toast("Remarque supprimée");
        setRemarqueASupprimer(null);
        router.refresh();
      } catch (e) {
        toast(
          e instanceof Error ? e.message : "Suppression impossible.",
          "error",
        );
      }
    });
  }

  function pointer(stagiaireId: string, present: boolean) {
    // L'état local part en premier : pointer un appel doit répondre au clic,
    // pas attendre l'aller-retour serveur.
    setPresences((ps) =>
      ps.map((p) =>
        p.stagiaire_id === stagiaireId
          ? { ...p, present, motif: present ? null : p.motif }
          : p,
      ),
    );
    startTransition(async () => {
      try {
        await setPresence(seance.id, stagiaireId, present, null);
      } catch (e) {
        toast(
          e instanceof Error ? e.message : "Appel non enregistré.",
          "error",
        );
      }
    });
  }

  function toutPresent() {
    setPresences((ps) => ps.map((p) => ({ ...p, present: true, motif: null })));
    startTransition(async () => {
      try {
        await marquerToutPresent(
          seance.id,
          presences.map((p) => p.stagiaire_id),
        );
        toast("Tout le monde est marqué présent.");
      } catch (e) {
        toast(
          e instanceof Error ? e.message : "Appel non enregistré.",
          "error",
        );
      }
    });
  }

  function ajouter() {
    const texte = nouvelleRemarque.trim();
    if (!texte) return;
    startTransition(async () => {
      try {
        await ajouterRemarque(seance.id, texte);
        setNouvelleRemarque("");
        router.refresh();
      } catch (e) {
        toast(
          e instanceof Error ? e.message : "Remarque non ajoutée.",
          "error",
        );
      }
    });
  }

  function enregistrerDeroulement(statut?: "a_faire" | "fait") {
    startTransition(async () => {
      try {
        await majSeance(seance.id, {
          contenu_realise: contenuRealise.trim() || null,
          ...(statut ? { statut } : {}),
        });
        toast(
          statut === "fait"
            ? "Séance marquée faite."
            : "Déroulement enregistré.",
        );
        router.refresh();
      } catch (e) {
        toast(
          e instanceof Error ? e.message : "Enregistrement impossible.",
          "error",
        );
      }
    });
  }

  const creneau =
    seance.heure_debut && seance.heure_fin
      ? `${formatHeure(seance.heure_debut)} – ${formatHeure(seance.heure_fin)}`
      : null;

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Groupes", href: "/groupes" },
          { label: seance.groupeNom, href: `/groupes/${seance.groupe_id}` },
          {
            label: "Progression",
            href: `/groupes/${seance.groupe_id}/progression`,
          },
          { label: seance.date ? formatDate(seance.date) : "Séance" },
        ]}
      />

      <header className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-ink">
              {seance.objectifCode
                ? `${seance.objectifCode} — ${seance.objectifIntitule}`
                : (seance.objectif_operationnel ?? "Séance")}
            </h1>
            {seance.nature ? (
              <Badge tone={seance.nature === "pratique" ? "info" : "neutral"}>
                {seance.nature === "pratique" ? "pratique" : "théorique"}
              </Badge>
            ) : null}
            <Badge tone={seance.statut === "fait" ? "success" : "neutral"}>
              {seance.statut === "fait" ? "faite" : "à faire"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate">
            {[
              seance.moduleNom,
              seance.date ? formatDate(seance.date) : "date à définir",
              creneau,
              seance.duree_prevue ? formatHeures(seance.duree_prevue) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {seance.statut !== "fait" ? (
          <Button
            icon={Check}
            onClick={() => enregistrerDeroulement("fait")}
            disabled={enCours}
          >
            Marquer la séance faite
          </Button>
        ) : null}
      </header>

      {seance.objectifContenu ? (
        <div className="mt-4 rounded-xl border border-border bg-surface p-4">
          <h2 className="text-sm font-medium text-ink">
            Éléments de contenu du référentiel
          </h2>
          <p className="mt-1 whitespace-pre-line text-sm text-slate">
            {seance.objectifContenu}
          </p>
        </div>
      ) : null}

      <div
        role="tablist"
        aria-label="Vue de la séance"
        className="mt-6 flex gap-1 border-b border-border"
      >
        <button
          type="button"
          role="tab"
          aria-selected={onglet === "preparation"}
          onClick={() => setOnglet("preparation")}
          className={`-mb-px border-b-2 px-4 py-2 text-sm ${
            onglet === "preparation"
              ? "border-forest font-medium text-forest"
              : "border-transparent text-slate hover:text-ink"
          }`}
        >
          Préparation
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={onglet === "support"}
          onClick={() => setOnglet("support")}
          className={`-mb-px border-b-2 px-4 py-2 text-sm ${
            onglet === "support"
              ? "border-forest font-medium text-forest"
              : "border-transparent text-slate hover:text-ink"
          }`}
        >
          Support
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={onglet === "deroulement"}
          onClick={() => setOnglet("deroulement")}
          className={`-mb-px border-b-2 px-4 py-2 text-sm ${
            onglet === "deroulement"
              ? "border-forest font-medium text-forest"
              : "border-transparent text-slate hover:text-ink"
          }`}
        >
          Déroulement
        </button>
      </div>
      <div className="mt-5">
        {onglet === "preparation" ? (
          <section className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink">
                Fiche de préparation
              </h2>
              {seance.ficheVersion ? (
                <Badge tone="success">version {seance.ficheVersion}</Badge>
              ) : (
                <Badge tone="neutral">aucune version</Badge>
              )}
            </div>
            <div className="mt-4">
              <FicheSeance
                contexte={{
                  seanceId: seance.id,
                  date: seance.date,
                  dateFormatee: seance.date ? formatDate(seance.date) : null,
                  groupeNom: seance.groupeNom,
                  filiere: seance.filiere,
                  annee: seance.annee,
                  moduleNom: seance.moduleNom,
                  minutesSeance,
                }}
                initial={seance.ficheContenu}
              />
            </div>
          </section>
        ) : onglet === "support" ? (
          <section className="rounded-xl border border-border bg-surface p-4">
            <h2 className="text-base font-semibold text-ink">
              {seance.nature === "pratique"
                ? "Énoncé de travaux pratiques"
                : "Support de cours"}
            </h2>
            <p className="mt-1 text-xs text-slate">
              Le document remis aux stagiaires, distinct de votre fiche.
            </p>
            <div className="mt-3">
              <SupportSeance
                contexte={{
                  seanceId: seance.id,
                  moduleNom: seance.moduleNom,
                  groupeNom: seance.groupeNom,
                  date: seance.date,
                  dateFormatee: seance.date ? formatDate(seance.date) : null,
                  dureeHeures: seance.duree_prevue
                    ? Number(seance.duree_prevue)
                    : null,
                  objectif: seance.objectifIntitule,
                  nature: seance.nature,
                }}
                initial={seance.supportContenu}
                version={seance.supportVersion}
              />
            </div>

            {seance.supportId ? (
              <div className="mt-6 border-t border-border pt-5">
                <QuestionsSupport
                  supportId={seance.supportId}
                  questions={seance.questions}
                  camarades={seance.presences.map((p) => ({
                    id: p.stagiaire_id,
                    nom: `${p.prenom} ${p.nom}`,
                  }))}
                  vue="formateur"
                />
              </div>
            ) : null}
          </section>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-ink">Présences</h2>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={CheckCheck}
                  onClick={toutPresent}
                  disabled={enCours || presences.length === 0}
                >
                  Tous présents
                </Button>
              </div>

              {presences.length === 0 ? (
                <p className="mt-3 text-sm text-slate">
                  Aucun stagiaire inscrit dans ce groupe.
                </p>
              ) : (
                <>
                  <p className="mt-1 text-xs text-slate">
                    {presents} présents · {absents} absents
                    {nonPointes > 0 ? ` · ${nonPointes} non pointés` : ""}
                  </p>
                  <ul className="mt-3 space-y-1.5">
                    {presences.map((p) => (
                      <li
                        key={p.stagiaire_id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-1.5"
                      >
                        <span className="truncate text-sm text-ink">
                          {p.prenom} {p.nom}
                        </span>
                        <span className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            aria-label={`${p.prenom} ${p.nom} présent`}
                            aria-pressed={p.present === true}
                            onClick={() => pointer(p.stagiaire_id, true)}
                            className={`rounded-md border px-2 py-1 ${
                              p.present === true
                                ? "border-success bg-success/10 text-success"
                                : "border-border text-slate hover:border-success/50"
                            }`}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label={`${p.prenom} ${p.nom} absent`}
                            aria-pressed={p.present === false}
                            onClick={() => pointer(p.stagiaire_id, false)}
                            className={`rounded-md border px-2 py-1 ${
                              p.present === false
                                ? "border-danger bg-danger/10 text-danger"
                                : "border-border text-slate hover:border-danger/50"
                            }`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
            <section className="rounded-xl border border-border bg-surface p-4">
              <h2 className="text-base font-semibold text-ink">
                Ce qui a été fait
              </h2>
              <p className="mt-1 text-xs text-slate">
                Alimente la préparation de la séance suivante et le contenu
                couvert par les contrôles.
              </p>
              <textarea
                rows={4}
                value={contenuRealise}
                onChange={(e) => setContenuRealise(e.target.value)}
                placeholder="Notions réellement traitées…"
                className={`${inputClass} mt-2`}
              />
              <Button
                size="sm"
                className="mt-2"
                onClick={() => enregistrerDeroulement()}
                disabled={enCours}
              >
                Enregistrer
              </Button>
            </section>
            <section className="rounded-xl border border-border bg-surface p-4">
              <h2 className="text-base font-semibold text-ink">Remarques</h2>
              <div className="mt-2 flex gap-2">
                <input
                  value={nouvelleRemarque}
                  onChange={(e) => setNouvelleRemarque(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !enCours) ajouter();
                  }}
                  placeholder="Incident, point à reprendre…"
                  aria-label="Nouvelle remarque"
                  className={inputClass}
                />
                <Button
                  size="sm"
                  icon={Plus}
                  onClick={ajouter}
                  disabled={enCours || !nouvelleRemarque.trim()}
                >
                  Ajouter
                </Button>
              </div>

              {seance.remarques.length === 0 ? (
                <p className="mt-3 text-sm text-slate">Aucune remarque.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {seance.remarques.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-start justify-between gap-2 rounded-lg border border-border px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-ink">{r.texte}</p>
                        <p className="mt-0.5 text-xs text-slate">
                          {formatDateTime(r.created_at)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Trash2}
                        aria-label="Supprimer la remarque"
                        onClick={() => setRemarqueASupprimer(r)}
                      >
                        {""}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>

      <ConfirmModal
        open={remarqueASupprimer !== null}
        onClose={() => setRemarqueASupprimer(null)}
        onConfirm={supprimerLaRemarque}
        busy={enCours}
        title="Supprimer cette remarque ?"
        message={
          remarqueASupprimer ? (
            <>
              «&nbsp;{remarqueASupprimer.texte}&nbsp;» sera définitivement
              effacée du cahier de séance.
            </>
          ) : (
            ""
          )
        }
      />
    </div>
  );
}
