"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Input from "@/components/ui/Input";
import AutoTextarea from "@/components/ui/AutoTextarea";
import { ConfirmModal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";
import { formatDateJour, initials } from "@/lib/format";
import {
  BAREME,
  DOCUMENTS_STAGE,
  noteFinale,
  totalExpose,
  totalRapport,
  type TypeDocumentStage,
} from "@/lib/stage";
import {
  majStage,
  enregistrerDocumentStage,
  supprimerDocumentStage,
  urlDocumentStage,
  type StageStagiaire,
  type DocumentStage,
} from "@/app/actions/stages";
import { ChevronRight, Download, Trash2, Upload } from "lucide-react";

const BUCKET = "documents-stage";

/** Une case de barème : la valeur saisie et son plafond, jamais l'un sans l'autre. */
function CaseNote({
  label,
  valeur,
  max,
  onChange,
}: {
  label: string;
  valeur: number | null;
  max: number;
  onChange: (v: number | null) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate">
        {label} <span className="font-mono">/{max}</span>
      </span>
      <Input
        type="number"
        min={0}
        max={max}
        step="0.25"
        value={valeur ?? ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : Number(e.target.value))
        }
      />
    </label>
  );
}

export default function CarteStage({ stage }: { stage: StageStagiaire }) {
  const router = useRouter();
  const toast = useToast();
  const [enCours, startTransition] = useTransition();
  const [ouvert, setOuvert] = useState(false);
  const [aSupprimer, setASupprimer] = useState<DocumentStage | null>(null);
  const [televersement, setTeleversement] = useState<TypeDocumentStage | null>(
    null,
  );
  const champsFichier = useRef<Record<string, HTMLInputElement | null>>({});

  const [form, setForm] = useState({
    entreprise: stage.entreprise ?? "",
    tuteur_nom: stage.tuteur_nom ?? "",
    tuteur_contact: stage.tuteur_contact ?? "",
    date_debut: stage.date_debut ?? "",
    date_fin: stage.date_fin ?? "",
    date_soutenance: stage.date_soutenance ?? "",
    jury: stage.jury ?? "",
  });
  const [notes, setNotes] = useState({
    note_rapport_presentation: stage.note_rapport_presentation,
    note_rapport_contenu: stage.note_rapport_contenu,
    note_expose_fond: stage.note_expose_fond,
    note_expose_forme: stage.note_expose_forme,
  });

  const rapport = totalRapport(notes);
  const expose = totalExpose(notes);
  const finale = noteFinale(notes);

  function enregistrer() {
    startTransition(async () => {
      try {
        await majStage(stage.stagiaireId, {
          entreprise: form.entreprise.trim() || null,
          tuteur_nom: form.tuteur_nom.trim() || null,
          tuteur_contact: form.tuteur_contact.trim() || null,
          date_debut: form.date_debut || null,
          date_fin: form.date_fin || null,
          date_soutenance: form.date_soutenance || null,
          jury: form.jury.trim() || null,
          ...notes,
        });
        toast("Stage enregistré");
        router.refresh();
      } catch (e) {
        toast(
          e instanceof Error ? e.message : "Enregistrement impossible.",
          "error",
        );
      }
    });
  }

  async function televerser(type: TypeDocumentStage, fichier: File) {
    setTeleversement(type);
    try {
      // Le stage doit exister avant le dépôt : c'est son identifiant qui sert
      // de dossier dans le bucket et qui décide de l'accès.
      let stageId = stage.stageId;
      if (!stageId) {
        await majStage(stage.stagiaireId, {});
        router.refresh();
        toast(
          "Dossier de stage créé. Relancez le dépôt du document.",
          "error",
        );
        return;
      }

      // Un chemin fixe par nature de pièce : redéposer remplace le fichier au
      // lieu d'en laisser un orphelin dans le bucket.
      const chemin = `${stageId}/${type}`;
      const supabase = createClient();
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(chemin, fichier, { upsert: true, contentType: fichier.type });
      if (error) throw new Error(error.message);

      await enregistrerDocumentStage({
        stageId,
        type,
        chemin,
        nomFichier: fichier.name,
        tailleOctets: fichier.size,
      });
      toast("Document déposé");
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Dépôt impossible.", "error");
    } finally {
      setTeleversement(null);
    }
  }

  function telecharger(doc: DocumentStage) {
    startTransition(async () => {
      try {
        const url = await urlDocumentStage(doc.chemin, doc.nom_fichier);
        window.open(url, "_blank", "noopener");
      } catch (e) {
        toast(e instanceof Error ? e.message : "Lien indisponible.", "error");
      }
    });
  }

  function supprimerDoc() {
    const cible = aSupprimer;
    if (!cible) return;
    startTransition(async () => {
      try {
        await supprimerDocumentStage(cible.id);
        toast("Document retiré");
        setASupprimer(null);
        router.refresh();
      } catch (e) {
        toast(
          e instanceof Error ? e.message : "Suppression impossible.",
          "error",
        );
      }
    });
  }

  return (
    <article className="border-b border-border last:border-0">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        className="flex w-full items-center gap-3 p-4 text-left hover:bg-wash"
      >
        <ChevronRight
          className={`h-4 w-4 shrink-0 text-slate transition-transform ${
            ouvert ? "rotate-90" : ""
          }`}
          aria-hidden
        />
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-wash text-xs font-medium text-ink">
          {initials(stage.prenom, stage.nom)}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block font-medium text-ink">
            {stage.prenom} {stage.nom}
          </span>
          <span className="block truncate text-xs text-slate">
            {stage.entreprise ?? "Entreprise non renseignée"}
            {stage.date_debut ? ` · ${formatDateJour(stage.date_debut, { court: true })}` : ""}
            {stage.date_fin ? ` → ${formatDateJour(stage.date_fin, { court: true })}` : ""}
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-2">
          <span className="hidden text-xs text-slate sm:inline">
            {stage.documents.length}/{DOCUMENTS_STAGE.length} pièces
          </span>
          {finale === null ? (
            <Badge tone="neutral">à noter</Badge>
          ) : (
            <Badge tone={finale >= 10 ? "success" : "danger"}>
              {finale.toLocaleString("fr-FR")} / 20
            </Badge>
          )}
        </span>
      </button>

      {ouvert ? (
        <div className="space-y-5 border-t border-border bg-paper p-4">
          <section>
            <h3 className="text-sm font-medium text-ink">Le stage</h3>
            <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-xs text-slate">Entreprise</span>
                <Input
                  value={form.entreprise}
                  onChange={(e) =>
                    setForm({ ...form, entreprise: e.target.value })
                  }
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-slate">Tuteur</span>
                <Input
                  value={form.tuteur_nom}
                  onChange={(e) =>
                    setForm({ ...form, tuteur_nom: e.target.value })
                  }
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-slate">
                  Contact du tuteur
                </span>
                <Input
                  value={form.tuteur_contact}
                  onChange={(e) =>
                    setForm({ ...form, tuteur_contact: e.target.value })
                  }
                  placeholder="Téléphone ou email"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-slate">Début</span>
                <Input
                  type="date"
                  value={form.date_debut}
                  onChange={(e) =>
                    setForm({ ...form, date_debut: e.target.value })
                  }
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-slate">Fin</span>
                <Input
                  type="date"
                  value={form.date_fin}
                  min={form.date_debut || undefined}
                  onChange={(e) =>
                    setForm({ ...form, date_fin: e.target.value })
                  }
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-slate">Soutenance</span>
                <Input
                  type="date"
                  value={form.date_soutenance}
                  onChange={(e) =>
                    setForm({ ...form, date_soutenance: e.target.value })
                  }
                />
              </label>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-[14px] border border-border bg-surface p-3">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-medium text-ink">Rapport</h3>
                <span className="font-mono text-sm tabular-nums text-slate">
                  {rapport === null ? "—" : rapport.toLocaleString("fr-FR")} / 20
                </span>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
                <CaseNote
                  label="Présentation"
                  max={BAREME.rapport.presentation}
                  valeur={notes.note_rapport_presentation}
                  onChange={(v) =>
                    setNotes({ ...notes, note_rapport_presentation: v })
                  }
                />
                <CaseNote
                  label="Contenu"
                  max={BAREME.rapport.contenu}
                  valeur={notes.note_rapport_contenu}
                  onChange={(v) =>
                    setNotes({ ...notes, note_rapport_contenu: v })
                  }
                />
              </div>
            </div>

            <div className="rounded-[14px] border border-border bg-surface p-3">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-medium text-ink">Exposé</h3>
                <span className="font-mono text-sm tabular-nums text-slate">
                  {expose === null ? "—" : expose.toLocaleString("fr-FR")} / 20
                </span>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
                <CaseNote
                  label="Fond"
                  max={BAREME.expose.fond}
                  valeur={notes.note_expose_fond}
                  onChange={(v) => setNotes({ ...notes, note_expose_fond: v })}
                />
                <CaseNote
                  label="Forme"
                  max={BAREME.expose.forme}
                  valeur={notes.note_expose_forme}
                  onChange={(v) => setNotes({ ...notes, note_expose_forme: v })}
                />
              </div>
            </div>
          </section>

          <section>
            <label className="block">
              <span className="mb-1 block text-xs text-slate">
                Jury — un nom par ligne
              </span>
              <AutoTextarea
                value={form.jury}
                onChange={(e) => setForm({ ...form, jury: e.target.value })}
                placeholder={"M. Alaoui\nMme Bennani"}
              />
            </label>
          </section>

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-slate">
              Note finale{" "}
              <span className="font-mono text-ink">
                {finale === null ? "—" : finale.toLocaleString("fr-FR")} / 20
              </span>
              <span className="text-xs"> (moyenne des deux grilles)</span>
            </p>
            <Button onClick={enregistrer} disabled={enCours} loading={enCours}>
              Enregistrer
            </Button>
          </div>

          <section>
            <h3 className="text-sm font-medium text-ink">Pièces du dossier</h3>
            <ul className="mt-2 space-y-2">
              {DOCUMENTS_STAGE.map((d) => {
                const depose = stage.documents.find((x) => x.type === d.type);
                return (
                  <li
                    key={d.type}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-ink">{d.label}</span>
                      {depose ? (
                        <span className="block truncate text-xs text-slate">
                          {depose.nom_fichier} · déposé le{" "}
                          {formatDateJour(depose.created_at, { court: true })}
                        </span>
                      ) : (
                        <span className="block text-xs text-slate">
                          Aucune pièce déposée
                        </span>
                      )}
                    </span>

                    <input
                      ref={(el) => {
                        champsFichier.current[d.type] = el;
                      }}
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) televerser(d.type, f);
                        e.target.value = "";
                      }}
                    />

                    {depose ? (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={Download}
                          onClick={() => telecharger(depose)}
                          disabled={enCours}
                        >
                          Ouvrir
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Trash2}
                          aria-label={`Retirer ${d.label}`}
                          onClick={() => setASupprimer(depose)}
                        >
                          {""}
                        </Button>
                      </>
                    ) : null}

                    <Button
                      variant={depose ? "ghost" : "secondary"}
                      size="sm"
                      icon={Upload}
                      loading={televersement === d.type}
                      loadingLabel="Dépôt…"
                      onClick={() => champsFichier.current[d.type]?.click()}
                    >
                      {depose ? "Remplacer" : "Déposer"}
                    </Button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-xs text-slate">
              PDF, image ou document Word, 10 Mo maximum. Les pièces ne sont
              lisibles que par vous, via un lien temporaire.
            </p>
          </section>
        </div>
      ) : null}

      <ConfirmModal
        open={aSupprimer !== null}
        onClose={() => setASupprimer(null)}
        onConfirm={supprimerDoc}
        busy={enCours}
        title="Retirer cette pièce ?"
        confirmLabel="Retirer"
        message={
          aSupprimer
            ? `${aSupprimer.nom_fichier} sera définitivement supprimé du dossier de ${stage.prenom} ${stage.nom}.`
            : ""
        }
      />
    </article>
  );
}
