"use client";

import { useState, useTransition } from "react";
import { ExternalLink, KeyRound, Plug, Trash2 } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input, { inputStyles } from "@/components/ui/Input";
import Badge from "@/components/ui/Badge";
import { ConfirmModal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { formatDateTime } from "@/lib/format";
import {
  FOURNISSEURS,
  fournisseur as decrire,
  type Fournisseur,
} from "@/lib/llm-catalogue";
import {
  saveParametresLlm,
  deleteCleLlm,
  testerLlm,
  type ParametresLlm,
} from "@/app/actions/parametres-llm";

export default function ParametresLlmForm({
  initial,
}: {
  initial: ParametresLlm | null;
}) {
  const toast = useToast();
  const [enCours, startTransition] = useTransition();
  const [test, setTest] = useState(false);
  const [confirmSuppression, setConfirmSuppression] = useState(false);

  const [choix, setChoix] = useState<Fournisseur>(initial?.fournisseur ?? "anthropic");
  const [modele, setModele] = useState(initial?.modele ?? "claude-opus-5");
  const [baseUrl, setBaseUrl] = useState(initial?.base_url ?? "");
  const [cle, setCle] = useState("");
  const [maxTokens, setMaxTokens] = useState(initial?.max_tokens ?? 8000);
  const [temperature, setTemperature] = useState<string>(
    initial?.temperature != null ? String(initial.temperature) : "",
  );
  const [cleDefinie, setCleDefinie] = useState(initial?.cle_definie ?? false);
  const [modelesDetectes, setModelesDetectes] = useState<string[]>([]);

  const description = decrire(choix)!;
  // Une clé est propre à son fournisseur : en changer rend l'ancienne
  // inutilisable, même si elle est toujours enregistrée.
  const cleObsolete = cleDefinie && initial != null && initial.fournisseur !== choix;

  function changerFournisseur(id: Fournisseur) {
    const f = decrire(id)!;
    setChoix(id);
    setModelesDetectes([]);
    // Un modèle Claude n'a aucun sens chez DeepSeek : on repart du défaut du
    // fournisseur plutôt que de laisser une valeur qui échouera à l'appel.
    setModele(f.modeles[0]?.id ?? "");
    setBaseUrl(f.baseUrl ?? "");
  }

  function enregistrer() {
    startTransition(async () => {
      try {
        await saveParametresLlm({
          fournisseur: choix,
          modele,
          base_url: description.baseUrl ? null : baseUrl,
          cle,
          max_tokens: Number(maxTokens) || 0,
          temperature: temperature.trim() === "" ? null : Number(temperature),
        });
        if (cle.trim()) setCleDefinie(true);
        setCle("");
        toast("Paramètres enregistrés.");
      } catch (e) {
        toast(e instanceof Error ? e.message : "Enregistrement impossible.", "error");
      }
    });
  }

  async function lancerTest() {
    setTest(true);
    try {
      const r = await testerLlm();
      setModelesDetectes(r.modeles);
      toast(r.message, r.ok ? "success" : "error");
    } finally {
      setTest(false);
    }
  }

  function supprimerCle() {
    startTransition(async () => {
      try {
        await deleteCleLlm();
        setCleDefinie(false);
        setModelesDetectes([]);
        setConfirmSuppression(false);
        toast("Clé supprimée.");
      } catch (e) {
        toast(e instanceof Error ? e.message : "Suppression impossible.", "error");
      }
    });
  }

  // Les modèles réellement détectés priment sur la liste par défaut : elle
  // vieillit à chaque sortie de modèle, le compte du formateur non.
  const modelesProposes =
    modelesDetectes.length > 0
      ? modelesDetectes.map((id) => ({ id, libelle: id }))
      : description.modeles;

  return (
    <>
      <Card>
        <h2 className="text-base font-semibold text-ink">Fournisseur</h2>
        <p className="mt-1 text-sm text-slate">{description.resume}</p>

        <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
          {FOURNISSEURS.map((f) => {
            const actif = f.id === choix;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => changerFournisseur(f.id)}
                aria-pressed={actif}
                className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  actif
                    ? "border-ink bg-wash"
                    : "border-border hover:border-slate/40"
                }`}
              >
                <span className="block text-sm font-medium text-ink">{f.nom}</span>
                <span className="mt-0.5 block text-xs text-slate">
                  {f.baseUrl ?? "URL à renseigner"}
                </span>
              </button>
            );
          })}
        </div>

        {description.remarque ? (
          <p className="mt-3 rounded-lg bg-tint-teal px-3 py-2 text-xs text-ink">
            {description.remarque}
          </p>
        ) : null}
      </Card>

      <Card className="mt-4">
        <h2 className="text-base font-semibold text-ink">Connexion</h2>

        {description.baseUrl === null ? (
          <div className="mt-4">
            <Input
              label="URL de base"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://openrouter.ai/api/v1"
              hint="Sans /chat/completions à la fin — l'application l'ajoute."
            />
          </div>
        ) : null}

        <div className="mt-4">
          <label className="block text-sm font-medium text-ink" htmlFor="cle">
            Clé API
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              id="cle"
              type="password"
              autoComplete="off"
              value={cle}
              onChange={(e) => setCle(e.target.value)}
              placeholder={
                cleDefinie
                  ? "Clé enregistrée — laissez vide pour la conserver"
                  : description.prefixeCle
                    ? `${description.prefixeCle}…`
                    : "Votre clé"
              }
              className={inputStyles}
            />
            {cleDefinie ? (
              <Badge tone={cleObsolete ? "danger" : "success"}>
                <KeyRound className="mr-1 inline h-3 w-3" />
                {cleObsolete ? "autre fournisseur" : "enregistrée"}
              </Badge>
            ) : null}
          </div>
          {cleObsolete ? (
            <p className="mt-1.5 text-xs text-coral-dark">
              La clé enregistrée est une clé {decrire(initial!.fournisseur)?.nom}.
              Saisissez une clé {description.nom} pour utiliser ce fournisseur.
            </p>
          ) : null}
          <p className="mt-1.5 text-xs text-slate">
            Chiffrée par Supabase Vault. Elle n&apos;est jamais réaffichée, ni ici
            ni ailleurs — seul le serveur peut la déchiffrer au moment d&apos;un
            appel.
          </p>
          {description.docCle ? (
            <a
              href={description.docCle}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-1 inline-flex items-center gap-1 text-xs text-ink underline"
            >
              Obtenir une clé {description.nom}
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </div>

        {cleDefinie ? (
          <Button
            variant="ghost"
            size="sm"
            icon={Trash2}
            className="mt-3"
            onClick={() => setConfirmSuppression(true)}
          >
            Supprimer la clé enregistrée
          </Button>
        ) : null}
      </Card>

      <Card className="mt-4">
        <h2 className="text-base font-semibold text-ink">Modèle</h2>

        <div className="mt-4">
          <label className="block text-sm font-medium text-ink" htmlFor="modele">
            Modèle utilisé
          </label>
          {modelesProposes.length > 0 ? (
            <select
              id="modele"
              value={modelesProposes.some((m) => m.id === modele) ? modele : "__autre"}
              onChange={(e) => {
                if (e.target.value !== "__autre") setModele(e.target.value);
                else setModele("");
              }}
              className={`${inputStyles} mt-1`}
            >
              {modelesProposes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.libelle}
                </option>
              ))}
              <option value="__autre">Autre — saisir manuellement</option>
            </select>
          ) : null}
          {modelesProposes.length === 0 ||
          !modelesProposes.some((m) => m.id === modele) ? (
            <input
              value={modele}
              onChange={(e) => setModele(e.target.value)}
              placeholder="Identifiant exact du modèle"
              aria-label="Identifiant du modèle"
              className={`${inputStyles} mt-2`}
            />
          ) : null}
          {modelesDetectes.length > 0 ? (
            <p className="mt-1.5 text-xs text-green-dark">
              {modelesDetectes.length} modèles détectés sur votre compte.
            </p>
          ) : null}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            label="Longueur maximale de réponse"
            type="number"
            min={256}
            max={128000}
            step={256}
            value={maxTokens}
            onChange={(e) => setMaxTokens(Number(e.target.value))}
            hint="En jetons. 8000 convient à un contrôle complet."
          />
          {description.temperature ? (
            <Input
              label="Température par défaut"
              type="number"
              min={0}
              max={2}
              step={0.1}
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              placeholder="laisser vide"
              hint="Plus haut = plus varié. La correction de copies impose sa propre valeur basse."
            />
          ) : null}
        </div>
      </Card>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button onClick={enregistrer} disabled={enCours}>
          {enCours ? "Enregistrement…" : "Enregistrer"}
        </Button>
        <Button
          variant="secondary"
          icon={Plug}
          onClick={lancerTest}
          disabled={test || !cleDefinie || cleObsolete}
        >
          {test ? "Test en cours…" : "Tester la connexion"}
        </Button>
        {!cleDefinie ? (
          <span className="text-xs text-slate">
            Enregistrez une clé pour pouvoir tester.
          </span>
        ) : initial?.updated_at ? (
          <span className="text-xs text-slate">
            Dernière modification {formatDateTime(initial.updated_at)}
          </span>
        ) : null}
      </div>

      <ConfirmModal
        open={confirmSuppression}
        title="Supprimer la clé API ?"
        message="La génération et la correction automatique cesseront de fonctionner jusqu'à ce qu'une nouvelle clé soit enregistrée."
        confirmLabel="Supprimer"
        onConfirm={supprimerCle}
        onClose={() => setConfirmSuppression(false)}
        busy={enCours}
      />
    </>
  );
}
