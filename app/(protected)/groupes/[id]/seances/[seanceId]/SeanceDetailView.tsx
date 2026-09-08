"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import Link from "next/link";
import Button, { buttonStyles } from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import Interrupteur from "@/components/ui/Interrupteur";
import { ConfirmModal } from "@/components/ui/Modal";
import { inputStyles as inputClass } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import FicheSeance from "@/components/FicheSeance";
import SupportSeance from "@/components/SupportSeance";
import QuestionsSupport from "@/components/QuestionsSupport";
import PartageContenu from "@/components/PartageContenu";
import CorrectionTpPanneau from "@/components/CorrectionTpPanneau";
import { formatDateJour, formatDateTime, formatHeures } from "@/lib/format";
import { formatHeure } from "@/lib/creneaux";
import {
  setPresence,
  marquerToutPresent,
  ajouterRemarque,
  supprimerRemarque,
  majSeance,
  type SeanceDetail,
  type RemarqueSeance,
} from "@/app/actions/seances";
import { Check, CheckCheck, Lock, Play, Plus, Trash2 } from "lucide-react";

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
  const [estFad, setEstFad] = useState(seance.est_fad);
  const [lienTeams, setLienTeams] = useState(seance.lien_teams ?? "");
  // Trois moments distincts : préparer, projeter, tenir le cahier. Les empiler
  // obligeait à traverser mille pixels de formulaire pour atteindre le support.
  const [onglet, setOnglet] = useState<
    "preparation" | "support" | "support-formateur" | "deroulement"
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

  function basculerFad(valeur: boolean) {
    setEstFad(valeur);
    if (!valeur) setLienTeams("");
    startTransition(async () => {
      try {
        await majSeance(seance.id, { est_fad: valeur });
        toast(valeur ? "Séance passée en FAD" : "Séance repassée en présentiel");
        router.refresh();
      } catch (e) {
        setEstFad(!valeur);
        toast(e instanceof Error ? e.message : "Erreur inattendue", "error");
      }
    });
  }

  function enregistrerLien() {
    if ((seance.lien_teams ?? "") === lienTeams) return;
    startTransition(async () => {
      try {
        await majSeance(seance.id, { lien_teams: lienTeams.trim() || null });
        toast("Lien enregistré");
        router.refresh();
      } catch (e) {
        toast(e instanceof Error ? e.message : "Erreur inattendue", "error");
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
          { label: seance.date ? formatDateJour(seance.date) : "Séance" },
        ]}
      />

      <header className="mt-6 flex flex-wrap items-start justify-between gap-6">
        <div className="flex min-w-0 items-start gap-4">
          {seance.objectifCode ? (
            <span className="mt-1 flex h-9 shrink-0 items-center justify-center rounded-[9px] bg-wash px-2.5 font-mono text-xs font-semibold text-slate-2">
              {seance.objectifCode}
            </span>
          ) : null}
          <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-[26px] font-bold leading-tight tracking-[-0.02em] text-ink">
              {seance.objectifIntitule ??
                seance.objectif_operationnel ??
                "Séance"}
            </h1>
            {seance.nature ? (
              <Badge tone={seance.nature === "pratique" ? "info" : "neutral"}>
                {seance.nature === "pratique" ? "pratique" : "théorique"}
              </Badge>
            ) : null}
            <Badge tone={seance.statut === "fait" ? "success" : "neutral"}>
              {seance.statut === "fait" ? "faite" : "à faire"}
            </Badge>
            {seance.groupesPartages.length > 0 ? (
              <Badge tone="info">
                partagée avec{" "}
                {seance.groupesPartages.map((g) => g.nom).join(", ")}
              </Badge>
            ) : null}
          </div>
          <p className="text-[14.5px] text-slate-2">
            <span className="font-mono text-body">
              {[
                seance.date ? formatDateJour(seance.date) : "date à définir",
                creneau,
                seance.duree_prevue ? formatHeures(seance.duree_prevue) : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
            {seance.moduleNom ? ` · ${seance.moduleNom}` : ""}
          </p>
          </div>
        </div>

        {/* PRD §4.3ter : l'animation est un autre usage que la préparation,
            donc un autre écran — et son entrée est en tête de page, là où on
            la cherche en arrivant en classe. */}
        <Link
          href={`/groupes/${seance.groupe_id}/seances/${seance.id}/animer`}
          className={buttonStyles("primary", "md")}
        >
          <Play size={16} aria-hidden />
          {seance.phase_courante > 0 && seance.phase_courante < 4
            ? `Reprendre — phase ${seance.phase_courante + 1} sur 4`
            : "Animer la séance"}
        </Link>
      </header>

      {/* PRD §4.1bis : une bascule, pas un formulaire. Le lien n'apparaît
          qu'une fois la séance déclarée à distance. */}
      <section className="mt-5 flex flex-wrap items-center gap-4 rounded-[14px] border border-border bg-surface px-6 py-4 shadow-repos">
        <span className="flex items-center gap-3">
          <Interrupteur
            actif={estFad}
            onChange={basculerFad}
            disabled={enCours}
            label="Cette séance est en FAD"
          />
          <span className="text-[14.5px] font-semibold text-ink">
            Cette séance est en FAD
          </span>
        </span>
        {estFad ? (
          <label className="flex min-w-[260px] flex-1 items-center gap-3">
            <span className="whitespace-nowrap text-sm font-semibold text-body">
              Lien Teams
            </span>
            <input
              type="url"
              value={lienTeams}
              onChange={(e) => setLienTeams(e.target.value)}
              onBlur={enregistrerLien}
              placeholder="https://teams.microsoft.com/…"
              className={inputClass}
            />
          </label>
        ) : (
          <span className="text-[13.5px] text-slate-light">
            Une séance à distance peut réunir plusieurs groupes ; une séance
            en présentiel reste propre au sien.
          </span>
        )}
      </section>

      {seance.objectifContenu ? (
        <div className="mt-5 rounded-[14px] border border-border bg-surface p-6 shadow-repos">
          <h2 className="font-display text-[15px] font-semibold text-ink">
            Éléments de contenu du référentiel
          </h2>
          <p className="mt-2 whitespace-pre-line text-[14.5px] leading-relaxed text-body">
            {seance.objectifContenu}
          </p>
        </div>
      ) : null}

      <div
        role="tablist"
        aria-label="Vue de la séance"
        // Quatre onglets ne tiennent plus sur 375px : la barre défile
        // horizontalement plutôt que de couper un libellé. C'est un
        // défilement contenu, pas celui de la page — ce que le §3bis
        // interdit, c'est le second.
        className="mt-6 flex items-stretch gap-1.5 overflow-x-auto border-t border-separator px-1"
      >
        {(
          [
            { cle: "preparation" as const, label: "Préparation", compte: 0 },
            {
              cle: "support" as const,
              label: "Support",
              compte: seance.questions.length,
            },
            // Le support du formateur est un second document, pas une variante
            // du premier : il a son onglet, à côté, et non une bascule à
            // l'intérieur du Support — sans quoi on ne saurait jamais lequel on
            // est en train de modifier.
            {
              cle: "support-formateur" as const,
              label: "Support formateur",
              compte: 0,
            },
            { cle: "deroulement" as const, label: "Déroulement", compte: 0 },
          ]
        ).map((o) => {
          const actif = onglet === o.cle;
          return (
            <button
              key={o.cle}
              type="button"
              role="tab"
              aria-selected={actif}
              onClick={() => setOnglet(o.cle)}
              className={`flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-2.5 py-3.5 text-sm transition-colors duration-150 ease-out hover:text-ink ${
                actif
                  ? "border-b-ink font-semibold text-ink"
                  : "border-b-transparent text-slate-2"
              }`}
            >
              {o.label}
              {o.compte > 0 ? (
                <span
                  className={`rounded-full px-1.5 py-px font-mono text-xs font-medium ${
                    actif ? "bg-wash text-ink" : "bg-paper text-slate-2"
                  }`}
                >
                  {o.compte}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        {onglet === "preparation" ? (
          <section className="overflow-hidden rounded-[14px] border border-border bg-surface shadow-repos">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-separator bg-paper-alt px-6 py-[18px]">
              <h2 className="font-display text-base font-semibold text-ink">
                Fiche de préparation
              </h2>
              {seance.ficheVersion ? (
                <Badge tone="success">version {seance.ficheVersion}</Badge>
              ) : (
                <Badge tone="neutral">aucune version</Badge>
              )}
            </div>
            <div className="flex flex-col gap-5 px-6 py-[22px]">
              <PartageContenu seanceId={seance.id} partage={seance.partage} />
              <FicheSeance
                contexte={{
                  seanceId: seance.id,
                  date: seance.date,
                  dateFormatee: seance.date ? formatDateJour(seance.date) : null,
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
          <section className="overflow-hidden rounded-[14px] border border-border bg-surface shadow-repos">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-separator bg-paper-alt px-6 py-[18px]">
              <div className="flex flex-col gap-[3px]">
                <h2 className="font-display text-base font-semibold text-ink">
                  {seance.nature === "pratique"
                    ? "Énoncé de travaux pratiques"
                    : "Support de cours"}
                </h2>
                <p className="text-[13px] text-slate-light">
                  Le document remis aux stagiaires, distinct de votre fiche.
                </p>
              </div>
              {seance.supportVersion ? (
                <span className="font-mono text-[12.5px] text-slate-2">
                  Version {seance.supportVersion}
                </span>
              ) : null}
            </div>
            <div className="px-6 py-[22px]">
              <SupportSeance
                contexte={{
                  seanceId: seance.id,
                  moduleNom: seance.moduleNom,
                  groupeNom: seance.groupeNom,
                  date: seance.date,
                  dateFormatee: seance.date ? formatDateJour(seance.date) : null,
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

            {/* §4.4 : la grille est un document du formateur, pas du
                stagiaire. Elle vit sous l'énoncé, jamais dans son cadre. */}
            {seance.nature === "pratique" ? (
              <div className="border-t border-separator px-6 py-[22px]">
                <h3 className="font-display text-[15px] font-semibold text-ink">
                  Grille de correction
                </h3>
                <p className="mb-3.5 text-[13px] text-slate-light">
                  Facultative : elle vous aide à corriger, elle ne corrige rien
                  à votre place. Fermée aux stagiaires par défaut — c&apos;est
                  vous qui l&apos;ouvrez, TP par TP.
                </p>
                <CorrectionTpPanneau
                  seanceId={seance.id}
                  seanceFaite={seance.statut === "fait"}
                  aUnEnonce={Boolean(seance.supportVersion)}
                  initial={seance.correction}
                  versionInitiale={seance.correctionVersion}
                  partageeInitial={seance.correctionPartagee}
                />
              </div>
            ) : null}

            {seance.supportId ? (
              <div className="border-t border-separator px-6 py-[22px]">
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
        ) : onglet === "support-formateur" ? (
          <section className="overflow-hidden rounded-[14px] border border-border bg-surface shadow-repos">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-separator bg-paper-alt px-6 py-[18px]">
              <div className="flex flex-col gap-[3px]">
                <h2 className="font-display text-base font-semibold text-ink">
                  Support du formateur
                </h2>
                <p className="text-[13px] text-slate-light">
                  Le vôtre : conduite de séance, réponses attendues, ce que vous
                  projetez pour vous. Jamais servi aux stagiaires.
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                {/* La mention est portée par l'écran, mais c'est la policy
                    `supports_lecture_stagiaire` qui la tient. */}
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-paper px-2.5 py-1 text-[12.5px] font-medium text-slate-2">
                  <Lock size={13} aria-hidden />
                  Privé
                </span>
                {seance.supportFormateurVersion ? (
                  <span className="font-mono text-[12.5px] text-slate-2">
                    Version {seance.supportFormateurVersion}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="px-6 py-[22px]">
              <SupportSeance
                destinataire="formateur"
                contexte={{
                  seanceId: seance.id,
                  moduleNom: seance.moduleNom,
                  groupeNom: seance.groupeNom,
                  date: seance.date,
                  dateFormatee: seance.date ? formatDateJour(seance.date) : null,
                  dureeHeures: seance.duree_prevue
                    ? Number(seance.duree_prevue)
                    : null,
                  objectif: seance.objectifIntitule,
                  nature: seance.nature,
                }}
                initial={seance.supportFormateurContenu}
                version={seance.supportFormateurVersion}
              />
            </div>
          </section>
        ) : (
          <div className="grid items-start gap-5 lg:[grid-template-columns:minmax(0,1.15fr)_minmax(0,1fr)]">
            <section className="min-w-0 overflow-hidden rounded-[14px] border border-border bg-surface shadow-repos">
              <div className="flex flex-wrap items-center gap-3 border-b border-separator px-[22px] py-[18px]">
                <div className="flex flex-col gap-[3px]">
                  <h2 className="font-display text-base font-semibold text-ink">
                    Appel
                  </h2>
                  <p className="text-[13px] text-slate-light">
                    <span
                      className={`font-mono font-medium ${
                        presents > 0 ? "text-green-dark" : "text-slate-light"
                      }`}
                    >
                      {presents}
                    </span>{" "}
                    présents ·{" "}
                    <span
                      className={`font-mono font-medium ${
                        absents > 0 ? "text-coral-dark" : "text-slate-light"
                      }`}
                    >
                      {absents}
                    </span>{" "}
                    absents sur {presences.length}
                    {nonPointes > 0 ? ` · ${nonPointes} non pointés` : ""}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={CheckCheck}
                  className="ml-auto"
                  onClick={toutPresent}
                  disabled={enCours || presences.length === 0}
                >
                  Tous présents
                </Button>
              </div>

              {presences.length === 0 ? (
                <p className="px-[22px] py-8 text-center text-sm text-slate-light">
                  Aucun stagiaire inscrit dans ce groupe.
                </p>
              ) : (
                <div className="max-h-[520px] overflow-y-auto">
                  {presences.map((p) => {
                    const absent = p.present === false;
                    const nomComplet = `${p.prenom} ${p.nom}`;
                    return (
                      <button
                        key={p.stagiaire_id}
                        type="button"
                        aria-pressed={p.present === true}
                        aria-label={`${nomComplet} — ${
                          absent ? "absent" : p.present ? "présent" : "non pointé"
                        }`}
                        disabled={enCours}
                        // Un stagiaire non pointé bascule d'abord vers présent :
                        // c'est le cas majoritaire, et un premier clic qui
                        // marque absent serait un piège.
                        onClick={() => pointer(p.stagiaire_id, p.present !== true)}
                        className={`flex w-full items-center gap-3 border-b border-separator px-[22px] py-3 text-left transition-colors duration-150 ease-out ${
                          absent ? "bg-alert-wash" : "bg-surface hover:bg-paper"
                        }`}
                      >
                        <span
                          aria-hidden
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border-[1.5px] ${
                            p.present === true
                              ? "border-ink bg-ink"
                              : "border-border-strong bg-surface"
                          }`}
                        >
                          {p.present === true ? (
                            <Check
                              className="h-3 w-3 text-white"
                              strokeWidth={3}
                            />
                          ) : null}
                        </span>
                        <Avatar prenom={p.prenom} nom={p.nom} taille="xs" />
                        <span className="flex min-w-0 flex-col gap-[2px]">
                          <span
                            className={`truncate text-[14.5px] font-semibold ${
                              absent ? "text-slate-light" : "text-ink"
                            }`}
                          >
                            {nomComplet}
                          </span>
                          {/* La maquette place ici le matricule ; aucune
                              colonne de ce genre n'existe dans `stagiaires`,
                              le motif d'absence est ce que la donnée offre. */}
                          {p.motif ? (
                            <span className="text-[12.5px] text-slate-light">
                              {p.motif}
                            </span>
                          ) : null}
                        </span>
                        <span
                          className={`ml-auto whitespace-nowrap rounded-full border px-2.5 py-[3px] text-[12.5px] font-semibold ${
                            p.present === true
                              ? "border-tint-green bg-success-wash text-green-dark"
                              : absent
                                ? "border-tint-alert-strong bg-alert-wash text-coral-dark"
                                : "border-border bg-wash-strong text-slate-2"
                          }`}
                        >
                          {p.present === true
                            ? "Présent"
                            : absent
                              ? "Absent"
                              : "Non pointé"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <div className="flex min-w-0 flex-col gap-5">
              <section className="flex flex-col gap-3 rounded-[14px] border border-border bg-surface p-[22px] shadow-repos">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-display text-base font-semibold text-ink">
                    Contenu réalisé
                  </h2>
                  <span className="font-mono text-[12.5px] text-muted">
                    {contenuRealise.length} caractères
                  </span>
                </div>
                <div className="overflow-hidden rounded-[10px] border border-border-strong border-l-[3px] border-l-ink bg-surface">
                  <textarea
                    rows={5}
                    value={contenuRealise}
                    onChange={(e) => setContenuRealise(e.target.value)}
                    placeholder="Ce qui a effectivement été traité, l'écart avec la préparation, l'état d'avancement du groupe…"
                    className="w-full resize-y border-none bg-transparent px-[15px] py-[13px] text-[15px] leading-relaxed text-body outline-none placeholder:text-slate-light"
                  />
                </div>
                <span className="text-[13px] text-slate-light">
                  Repris automatiquement dans le classeur pédagogique et le
                  bilan du module.
                </span>
              </section>

              <section className="flex flex-col gap-3.5 rounded-[14px] border border-border bg-surface p-[22px] shadow-repos">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-display text-base font-semibold text-ink">
                    Remarques
                  </h2>
                  <span className="font-mono text-[12.5px] text-muted">
                    {String(seance.remarques.length).padStart(2, "0")}
                  </span>
                </div>

                {seance.remarques.length === 0 ? (
                  <p className="py-2 text-sm text-slate-light">
                    Aucune remarque.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-[9px]">
                    {seance.remarques.map((r) => (
                      <li
                        key={r.id}
                        className="flex items-start gap-[11px] rounded-[10px] border border-border bg-paper-alt px-[13px] py-[11px]"
                      >
                        <span
                          aria-hidden
                          className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-teal"
                        />
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="text-[14.5px] leading-snug text-body">
                            {r.texte}
                          </span>
                          <span className="font-mono text-[12px] text-slate-light">
                            {formatDateTime(r.created_at)}
                          </span>
                        </span>
                        <button
                          type="button"
                          aria-label="Supprimer la remarque"
                          onClick={() => setRemarqueASupprimer(r)}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] border border-transparent text-coral-dark transition-colors duration-150 ease-out hover:border-tint-alert-strong hover:bg-alert-wash"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex gap-2">
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
              </section>

              <section className="flex flex-col gap-3.5 rounded-[14px] border border-border bg-surface px-[22px] py-5 shadow-repos">
                <div className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className={`h-[7px] w-[7px] shrink-0 rounded-full ${
                      seance.statut === "fait" ? "bg-green" : "bg-teal"
                    }`}
                  />
                  <p
                    className={`text-sm leading-snug ${
                      seance.statut === "fait" ? "text-green-dark" : "text-body"
                    }`}
                  >
                    {seance.statut === "fait"
                      ? "Séance clôturée : appel enregistré et contenu réalisé versé au classeur."
                      : `Appel saisi pour ${presents + absents} stagiaires sur ${presences.length}${
                          contenuRealise.trim()
                            ? " · contenu réalisé renseigné. La séance peut être clôturée."
                            : " · contenu réalisé à renseigner."
                        }`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <Button
                    variant="secondary"
                    onClick={() => enregistrerDeroulement()}
                    disabled={enCours}
                  >
                    Enregistrer
                  </Button>
                  <Button
                    icon={Check}
                    className="min-w-[200px] flex-1 justify-center"
                    onClick={() => enregistrerDeroulement("fait")}
                    disabled={enCours || seance.statut === "fait"}
                  >
                    {seance.statut === "fait"
                      ? "Séance marquée faite"
                      : "Marquer la séance faite"}
                  </Button>
                </div>
              </section>
            </div>
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
