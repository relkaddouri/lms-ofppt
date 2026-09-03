"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Download, Plus, Wand2 } from "lucide-react";
import Button from "@/components/ui/Button";
import Input, { inputStyles } from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { formatDate, maintenant } from "@/lib/format";
import type { Groupe } from "@/app/actions/groupes";
import {
  ajouterCreneau,
  genererSeances,
  ouvrirMotif,
  supprimerCreneau,
  type MotifHebdomadaire,
} from "@/app/actions/motifs";
import { JOURS } from "@/lib/motifs";
import { marqueDe } from "@/lib/pdf-marque";
import { formatHeures, slugify } from "@/lib/format";
import type { Etablissement } from "@/app/actions/etablissement";
import GrilleMotif from "./GrilleMotif";

const VIDE_CRENEAU = {
  jour: 1,
  heureDebut: "08:30",
  heureFin: "13:30",
  groupeId: "",
};

/**
 * Emploi du temps — le document officiel, et le moteur qui le fait vivre.
 *
 * Distinct du calendrier opérationnel (§4.10) : celui-ci ne montre pas les
 * séances mais le **rythme** qui les place. On y déclare le motif de la
 * période, puis on lance la génération, groupe par groupe.
 */
export default function EmploiDuTempsManager({
  motifs,
  groupes,
  etablissement,
  anneeScolaire,
  emailCompte,
}: {
  motifs: MotifHebdomadaire[];
  groupes: Groupe[];
  etablissement: Etablissement;
  anneeScolaire: string | null;
  emailCompte: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [enCours, startTransition] = useTransition();

  const courant = motifs.find((m) => m.courant) ?? null;
  const precedents = motifs.filter((m) => !m.courant);

  function exporter() {
    startTransition(async () => {
      try {
        const { telechargerEmploiDuTempsPdf } = await import(
          "@/lib/pdf-emploi-du-temps"
        );
        await telechargerEmploiDuTempsPdf(
          {
            marque: marqueDe(etablissement),
            formateur: etablissement.nomFormateur ?? emailCompte,
            anneeScolaire,
            edite: formatDate(maintenant()),
          },
          motifs.map((m) => ({
            libelle: m.libelle,
            date_debut: m.date_debut,
            date_fin: m.date_fin,
            courant: m.courant,
            creneaux: m.creneaux.map((c) => ({
              jour_semaine: c.jour_semaine,
              heure_debut: c.heure_debut,
              heure_fin: c.heure_fin,
              groupeNom: c.groupeNom,
            })),
          })),
          `emploi-du-temps-${slugify(anneeScolaire ?? maintenant(), "emploi-du-temps")}.pdf`,
        );
        toast(
          motifs.length > 1
            ? `Emploi du temps exporté — ${motifs.length} rythmes`
            : "Emploi du temps exporté",
        );
      } catch (e) {
        toast(e instanceof Error ? e.message : "Export impossible.", "error");
      }
    });
  }

  const [nouveauMotif, setNouveauMotif] = useState(false);
  const [formMotif, setFormMotif] = useState({
    libelle: "",
    dateDebut: maintenant(),
  });
  const [formCreneau, setFormCreneau] = useState({
    ...VIDE_CRENEAU,
    groupeId: groupes[0]?.id ?? "",
  });
  const [generation, setGeneration] = useState({
    groupeId: groupes[0]?.id ?? "",
    dateDebut: maintenant(),
  });

  function creerMotif(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await ouvrirMotif(formMotif.libelle, formMotif.dateDebut);
        setNouveauMotif(false);
        setFormMotif({ libelle: "", dateDebut: formMotif.dateDebut });
        toast("Motif ouvert — le précédent est clos la veille.");
        router.refresh();
      } catch (err) {
        toast(err instanceof Error ? err.message : "Erreur inattendue", "error");
      }
    });
  }

  function poserCreneau(e: React.FormEvent) {
    e.preventDefault();
    if (!courant) return;
    startTransition(async () => {
      try {
        await ajouterCreneau({ motifId: courant.id, ...formCreneau });
        toast("Créneau ajouté");
        router.refresh();
      } catch (err) {
        toast(err instanceof Error ? err.message : "Erreur inattendue", "error");
      }
    });
  }

  function retirerCreneau(id: string) {
    startTransition(async () => {
      try {
        await supprimerCreneau(id);
        router.refresh();
      } catch (err) {
        toast(err instanceof Error ? err.message : "Erreur inattendue", "error");
      }
    });
  }

  function lancerGeneration() {
    startTransition(async () => {
      try {
        const r = await genererSeances(
          generation.groupeId,
          generation.dateDebut,
        );
        toast(
          r.placees === 0
            ? "Aucune séance en attente de date pour ce groupe."
            : `${r.placees} séance${r.placees > 1 ? "s" : ""} placée${
                r.placees > 1 ? "s" : ""
              }${r.derniereDate ? `, jusqu'au ${formatDate(r.derniereDate)}` : ""}${
                r.joursSautes > 0
                  ? ` · ${r.joursSautes} jour${r.joursSautes > 1 ? "s" : ""} sauté${r.joursSautes > 1 ? "s" : ""}`
                  : ""
              }${
                r.heuresRestantes > 0
                  ? ` · ${formatHeures(r.heuresRestantes)} encore sans créneau`
                  : ""
              }`,
        );
        router.refresh();
      } catch (err) {
        toast(err instanceof Error ? err.message : "Erreur inattendue", "error");
      }
    });
  }

  return (
    <div className="p-8">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[11.5px] uppercase tracking-[0.12em] text-slate-light">
            Document officiel · section I.B
          </span>
          <h1 className="font-display text-[29px] font-bold leading-tight tracking-[-0.02em] text-ink">
            Emploi du temps
          </h1>
          <p className="text-base text-slate-2">
            Votre rythme hebdomadaire : quel groupe, quel jour, quel créneau.
            C&apos;est lui qui place les séances, pas l&apos;inverse.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button
            variant="secondary"
            icon={Download}
            onClick={exporter}
            disabled={enCours || motifs.length === 0}
            title={
              motifs.length === 0
                ? "Déclarez d'abord un rythme hebdomadaire"
                : undefined
            }
          >
            Exporter en PDF
          </Button>
          <Button icon={CalendarPlus} onClick={() => setNouveauMotif(true)}>
            Nouveau motif
          </Button>
        </div>
      </div>

      {courant ? (
        <section className="mt-6 overflow-hidden rounded-[14px] border border-border bg-surface shadow-repos">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-separator bg-paper-alt px-6 py-[18px]">
            <div className="flex flex-col gap-[3px]">
              <h2 className="font-display text-base font-semibold text-ink">
                {courant.libelle ?? "Motif en vigueur"}
              </h2>
              <span className="font-mono text-[12.5px] text-slate-light">
                depuis le {formatDate(courant.date_debut)} · en cours
              </span>
            </div>
            <span className="rounded-full border border-tint-green bg-success-wash px-3 py-1 text-[12.5px] font-semibold text-green-dark">
              {courant.creneaux.length} créneau
              {courant.creneaux.length > 1 ? "x" : ""} par semaine
            </span>
          </div>

          <GrilleMotif
            motif={courant}
            modifiable
            onSupprimer={retirerCreneau}
          />

          <form
            onSubmit={poserCreneau}
            className="flex flex-wrap items-end gap-3 border-t border-separator bg-paper-alt px-6 py-4"
          >
            <label className="flex flex-col gap-[7px]">
              <span className="text-xs text-slate">Jour</span>
              <select
                value={formCreneau.jour}
                onChange={(e) =>
                  setFormCreneau({ ...formCreneau, jour: Number(e.target.value) })
                }
                className={inputStyles}
              >
                {JOURS.map((j) => (
                  <option key={j.valeur} value={j.valeur}>
                    {j.long}
                  </option>
                ))}
              </select>
            </label>
            <div className="w-[120px]">
              <Input
                type="time"
                value={formCreneau.heureDebut}
                onChange={(e) =>
                  setFormCreneau({ ...formCreneau, heureDebut: e.target.value })
                }
                label={<span className="text-xs text-slate">De</span>}
              />
            </div>
            <div className="w-[120px]">
              <Input
                type="time"
                value={formCreneau.heureFin}
                onChange={(e) =>
                  setFormCreneau({ ...formCreneau, heureFin: e.target.value })
                }
                label={<span className="text-xs text-slate">À</span>}
              />
            </div>
            <label className="flex flex-col gap-[7px]">
              <span className="text-xs text-slate">Groupe</span>
              <select
                value={formCreneau.groupeId}
                onChange={(e) =>
                  setFormCreneau({ ...formCreneau, groupeId: e.target.value })
                }
                className={inputStyles}
              >
                {groupes.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nom}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" icon={Plus} disabled={enCours}>
              Ajouter le créneau
            </Button>
          </form>
        </section>
      ) : (
        <section className="mt-6 flex flex-col items-center gap-3 rounded-[14px] border border-border bg-surface px-6 py-12 text-center shadow-repos">
          <p className="text-[15px] font-semibold text-ink">
            Aucun motif déclaré
          </p>
          <p className="max-w-[440px] text-[14px] text-slate-light">
            Déclarez votre semaine type — un créneau par rendez-vous avec un
            groupe. Les séances issues de la répartition horaire viendront s&apos;y
            poser d&apos;elles-mêmes.
          </p>
          <Button icon={CalendarPlus} onClick={() => setNouveauMotif(true)}>
            Déclarer un motif
          </Button>
        </section>
      )}

      {courant && courant.creneaux.length > 0 ? (
        <section className="mt-5 flex flex-col gap-4 rounded-[14px] border border-border bg-surface p-6 shadow-repos">
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-base font-semibold text-ink">
              Générer les séances
            </h2>
            <p className="text-sm text-slate-light">
              Les séances déjà produites par la répartition horaire reçoivent
              leur date, semaine après semaine. Les jours fériés, vacances et
              indisponibilités déclarées sont sautés.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-[7px]">
              <span className="text-xs text-slate">Groupe</span>
              <select
                value={generation.groupeId}
                onChange={(e) =>
                  setGeneration({ ...generation, groupeId: e.target.value })
                }
                className={inputStyles}
              >
                {groupes.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nom}
                  </option>
                ))}
              </select>
            </label>
            <div className="w-[180px]">
              <Input
                type="date"
                value={generation.dateDebut}
                onChange={(e) =>
                  setGeneration({ ...generation, dateDebut: e.target.value })
                }
                label={<span className="text-xs text-slate">À partir du</span>}
              />
            </div>
            <Button
              icon={Wand2}
              onClick={lancerGeneration}
              loading={enCours}
              loadingLabel="Placement…"
            >
              Placer les séances
            </Button>
          </div>
        </section>
      ) : null}

      {precedents.length > 0 ? (
        <section className="mt-5 flex flex-col gap-4">
          <h2 className="font-display text-base font-semibold text-ink">
            Motifs précédents
          </h2>
          {precedents.map((m) => (
            <div
              key={m.id}
              className="overflow-hidden rounded-[14px] border border-border bg-surface shadow-repos"
            >
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-separator bg-paper-alt px-6 py-3.5">
                <span className="font-display text-[15px] font-semibold text-slate-2">
                  {m.libelle ?? "Motif"}
                </span>
                <span className="font-mono text-[12.5px] text-muted">
                  {formatDate(m.date_debut)} —{" "}
                  {m.date_fin ? formatDate(m.date_fin) : "…"}
                </span>
              </div>
              <GrilleMotif motif={m} />
            </div>
          ))}
        </section>
      ) : null}

      <Modal
        open={nouveauMotif}
        onClose={() => setNouveauMotif(false)}
        title="Nouveau motif hebdomadaire"
        description="Le motif en vigueur sera clos la veille de cette date."
      >
        <form onSubmit={creerMotif} className="space-y-4">
          <Input
            id="libelle"
            label="Intitulé"
            hint="Facultatif — « Rentrée », « Après les vacances »…"
            value={formMotif.libelle}
            onChange={(e) =>
              setFormMotif({ ...formMotif, libelle: e.target.value })
            }
          />
          <Input
            id="dateDebut"
            label="En vigueur à partir du"
            type="date"
            required
            value={formMotif.dateDebut}
            onChange={(e) =>
              setFormMotif({ ...formMotif, dateDebut: e.target.value })
            }
          />
          <div className="flex justify-end gap-3 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setNouveauMotif(false)}
            >
              Annuler
            </Button>
            <Button type="submit" loading={enCours} loadingLabel="Création…">
              Ouvrir le motif
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
