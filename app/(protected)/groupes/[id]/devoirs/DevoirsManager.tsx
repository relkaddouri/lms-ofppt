"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Input, { inputStyles as inputClass } from "@/components/ui/Input";
import AutoTextarea from "@/components/ui/AutoTextarea";
import Modal, { ConfirmModal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/format";
import {
  creerDevoir,
  supprimerDevoir,
  type Devoir,
  type TypeRendu,
} from "@/app/actions/devoirs";
import type { GroupeModuleInfo } from "@/app/actions/groupes";
import { ClipboardList, Plus, Trash2 } from "lucide-react";

const TYPES: { valeur: TypeRendu; label: string; aide: string }[] = [
  { valeur: "texte", label: "Réponse écrite", aide: "Le stagiaire rédige dans l'application." },
  { valeur: "lien", label: "Lien", aide: "Le stagiaire colle une URL." },
  {
    valeur: "fichier",
    label: "Fichier",
    aide: "Le dépôt de fichier n'est pas encore disponible : le stagiaire partagera un lien.",
  },
];

export default function DevoirsManager({
  groupeId,
  devoirs,
  modules,
}: {
  groupeId: string;
  devoirs: Devoir[];
  modules: GroupeModuleInfo[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [enCours, startTransition] = useTransition();
  const [ouvert, setOuvert] = useState(false);
  const [aSupprimer, setASupprimer] = useState<Devoir | null>(null);

  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [echeance, setEcheance] = useState("");
  const [typeRendu, setTypeRendu] = useState<TypeRendu>("texte");
  const [moduleId, setModuleId] = useState("");

  function creer() {
    startTransition(async () => {
      try {
        await creerDevoir({
          groupeId,
          titre,
          description: description || null,
          dateEcheance: echeance || null,
          typeRendu,
          moduleId: moduleId || null,
          seanceId: null,
        });
        setTitre("");
        setDescription("");
        setEcheance("");
        setModuleId("");
        setOuvert(false);
        toast("Devoir assigné");
        router.refresh();
      } catch (e) {
        toast(e instanceof Error ? e.message : "Création impossible.", "error");
      }
    });
  }

  return (
    <>
      <div className="mt-6 flex items-center justify-between gap-4">
        <p className="text-sm text-slate">
          {devoirs.length} devoir{devoirs.length > 1 ? "s" : ""} assigné
          {devoirs.length > 1 ? "s" : ""}
        </p>
        <Button icon={Plus} size="sm" onClick={() => setOuvert(true)}>
          Assigner un devoir
        </Button>
      </div>

      {devoirs.length === 0 ? (
        <Card className="mt-6 p-10 text-center" padded={false}>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-mint">
            <ClipboardList className="h-6 w-6 text-forest" aria-hidden />
          </div>
          <p className="mt-4 text-sm font-medium text-ink">Aucun devoir</p>
          <p className="mt-1 text-sm text-slate">
            Assignez un devoir : les stagiaires le verront dans leur espace.
          </p>
          <Button icon={Plus} className="mt-4" onClick={() => setOuvert(true)}>
            Assigner un devoir
          </Button>
        </Card>
      ) : (
        <div className="mt-4 space-y-3">
          {devoirs.map((d) => (
            <div
              key={d.id}
              className="rounded-xl border border-border bg-surface p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-ink">{d.titre}</h2>
                  <p className="mt-0.5 text-xs text-slate">
                    {[
                      d.moduleNom,
                      d.date_echeance
                        ? `à rendre le ${formatDate(d.date_echeance)}`
                        : "sans échéance",
                      TYPES.find((t) => t.valeur === d.type_rendu)?.label,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge
                    tone={
                      d.nbStagiaires > 0 && d.nbRendus === d.nbStagiaires
                        ? "success"
                        : "neutral"
                    }
                  >
                    {d.nbRendus} / {d.nbStagiaires} rendus
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Trash2}
                    aria-label="Supprimer le devoir"
                    onClick={() => setASupprimer(d)}
                  >
                    {""}
                  </Button>
                </div>
              </div>

              {d.description ? (
                <p className="mt-2 whitespace-pre-line text-sm text-slate">
                  {d.description}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={ouvert}
        onClose={() => setOuvert(false)}
        title="Assigner un devoir"
        description="Les stagiaires du groupe le verront dans leur espace, avec son échéance."
      >
        <div className="space-y-4">
          <Input
            label="Titre"
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            placeholder="Ex. : maquette basse fidélité"
          />

          <div>
            <label className="block text-sm font-medium text-ink">
              Consigne
            </label>
            <AutoTextarea
              value={description}
              minRows={3}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ce que le stagiaire doit produire…"
              className="mt-1"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="À rendre le"
              type="date"
              value={echeance}
              onChange={(e) => setEcheance(e.target.value)}
            />
            <div>
              <label className="block text-sm font-medium text-ink" htmlFor="module">
                Module
              </label>
              <select
                id="module"
                value={moduleId}
                onChange={(e) => setModuleId(e.target.value)}
                className={`${inputClass} mt-1`}
              >
                <option value="">Aucun</option>
                {modules.map((m) => (
                  <option key={m.module_id} value={m.module_id}>
                    {m.code_operationnel ? `${m.code_operationnel} — ` : ""}
                    {m.nom}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink" htmlFor="type">
              Forme du rendu
            </label>
            <select
              id="type"
              value={typeRendu}
              onChange={(e) => setTypeRendu(e.target.value as TypeRendu)}
              className={`${inputClass} mt-1`}
            >
              {TYPES.map((t) => (
                <option key={t.valeur} value={t.valeur}>
                  {t.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate">
              {TYPES.find((t) => t.valeur === typeRendu)?.aide}
            </p>
          </div>

          <Button onClick={creer} disabled={enCours || !titre.trim()}>
            {enCours ? "Enregistrement…" : "Assigner"}
          </Button>
        </div>
      </Modal>

      <ConfirmModal
        open={aSupprimer !== null}
        title="Supprimer ce devoir ?"
        message={`« ${aSupprimer?.titre} » et les rendus déjà déposés seront supprimés.`}
        confirmLabel="Supprimer"
        busy={enCours}
        onConfirm={() =>
          startTransition(async () => {
            if (!aSupprimer) return;
            await supprimerDevoir(aSupprimer.id, groupeId);
            setASupprimer(null);
            toast("Devoir supprimé");
            router.refresh();
          })
        }
        onClose={() => setASupprimer(null)}
      />
    </>
  );
}
