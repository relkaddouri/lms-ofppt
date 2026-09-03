"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  setMasseHoraire,
  setTypeEfm,
  type GroupeModuleInfo,
  type TypeEfmModule,
} from "@/app/actions/groupes";
import Card from "@/components/ui/Card";
import Button, { buttonStyles } from "@/components/ui/Button";
import Input, { inputStyles } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import Interrupteur from "@/components/ui/Interrupteur";
import { ArrowRight, BookOpen, Check, Clock, Pencil, X } from "lucide-react";

/**
 * Les quatre cases du tableau de service officiel (PRD §4.13bis) : présentiel
 * ou distance, croisés avec le semestre. Un module peut se donner entièrement
 * sur un semestre — les cases de l'autre restent à zéro.
 */
const CHAMPS = [
  { cle: "presentiel_s1", libelle: "Présentiel S1" },
  { cle: "fad_s1", libelle: "FAD S1" },
  { cle: "presentiel_s2", libelle: "Présentiel S2" },
  { cle: "fad_s2", libelle: "FAD S2" },
] as const;

type CleHeures = (typeof CHAMPS)[number]["cle"];

const SAISIE_VIDE: Record<CleHeures, string> = {
  presentiel_s1: "0",
  fad_s1: "0",
  presentiel_s2: "0",
  fad_s2: "0",
};

export default function GroupeModulesManager({
  groupeId,
  modules,
}: {
  groupeId: string;
  modules: GroupeModuleInfo[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [enEdition, setEnEdition] = useState<string | null>(null);
  const [saisie, setSaisie] = useState(SAISIE_VIDE);
  const [mutualisee, setMutualisee] = useState(false);
  const [busy, setBusy] = useState(false);

  const total = modules.reduce((s, m) => s + m.masse_horaire_allouee, 0);

  function ouvrirEdition(m: GroupeModuleInfo) {
    setEnEdition(m.module_id);
    setSaisie({
      presentiel_s1: String(m.presentiel_s1),
      fad_s1: String(m.fad_s1),
      presentiel_s2: String(m.presentiel_s2),
      fad_s2: String(m.fad_s2),
    });
    setMutualisee(m.fad_mutualisee);
  }

  const chiffres = {
    presentiel_s1: Number(saisie.presentiel_s1),
    fad_s1: Number(saisie.fad_s1),
    presentiel_s2: Number(saisie.presentiel_s2),
    fad_s2: Number(saisie.fad_s2),
  };
  const totalSaisi =
    chiffres.presentiel_s1 +
    chiffres.fad_s1 +
    chiffres.presentiel_s2 +
    chiffres.fad_s2;
  const fadSaisie = chiffres.fad_s1 + chiffres.fad_s2;

  const erreur = CHAMPS.some(
    (c) =>
      saisie[c.cle].trim() === "" ||
      !Number.isFinite(chiffres[c.cle]) ||
      chiffres[c.cle] < 0,
  )
    ? "Chaque case attend un nombre d'heures positif."
    : mutualisee && fadSaisie === 0
      ? "Sans heures à distance, il n'y a rien à partager."
      : null;

  async function changerTypeEfm(moduleId: string, type: TypeEfmModule) {
    setBusy(true);
    try {
      await setTypeEfm(groupeId, moduleId, type);
      toast(
        type === "regional"
          ? "EFM régional — pensez à démarrer ce module tôt dans l'année."
          : type === "local"
            ? "EFM local enregistré"
            : "Type d'EFM remis à préciser",
      );
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur inattendue", "error");
    } finally {
      setBusy(false);
    }
  }

  async function enregistrer(moduleId: string) {
    if (erreur) return;
    setBusy(true);
    try {
      await setMasseHoraire(groupeId, moduleId, {
        ...chiffres,
        fad_mutualisee: mutualisee,
      });
      setEnEdition(null);
      toast("Masse horaire enregistrée");
      router.refresh();
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Erreur inattendue",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  if (modules.length === 0) {
    return (
      <Card className="mt-6 p-10 text-center" padded={false}>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-wash">
          <BookOpen className="h-6 w-6 text-ink" aria-hidden />
        </div>
        <p className="mt-4 text-sm font-medium text-ink">
          Aucun module assigné à ce groupe
        </p>
        <p className="mt-1 text-sm text-slate">
          Assignez des modules au groupe pour pouvoir répartir leur masse
          horaire.
        </p>
        <Link href="/groupes" className={buttonStyles("primary", "md", "mt-5")}>
          <BookOpen size={16} aria-hidden />
          Gérer les groupes
        </Link>
      </Card>
    );
  }

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-xl font-bold text-ink">
          Modules du groupe
        </h2>
        <p className="text-sm text-slate">
          Masse horaire totale allouée :{" "}
          <span className="font-mono font-medium text-ink">{total} h</span>
        </p>
      </div>

      <p className="mt-1 max-w-[640px] text-sm text-slate">
        La masse horaire est propre à ce groupe : un même module peut valoir un
        volume différent pour un autre groupe. La durée de référence nationale
        n&apos;est qu&apos;un repère.
      </p>

      <div className="mt-4 space-y-3">
        {modules.map((m) => {
          const edition = enEdition === m.module_id;
          const ecart = m.masse_horaire_allouee - m.duree_reference;

          return (
            <Card key={m.module_id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-2">
                    {m.code_operationnel ? (
                      <span className="font-mono text-sm font-medium text-ink">
                        {m.code_operationnel}
                      </span>
                    ) : null}
                    <span className="truncate text-sm font-semibold text-ink">
                      {m.nom}
                    </span>
                    {/* PRD §4.1 : un EFM régional a une date imposée par la
                        Direction Régionale. Le repérer d'un coup d'œil est ce
                        qui permet de décider dans quel ordre programmer les
                        modules de l'année. */}
                    <span
                      className={`whitespace-nowrap rounded-full border px-2.5 py-[3px] text-[11.5px] font-semibold ${
                        m.type_efm === "regional"
                          ? "border-tint-alert-strong bg-alert-wash text-coral-dark"
                          : m.type_efm === "local"
                            ? "border-border bg-wash-strong text-slate-2"
                            : "border-dashed border-border-strong bg-surface text-muted"
                      }`}
                    >
                      {m.type_efm === "regional"
                        ? "EFM régional"
                        : m.type_efm === "local"
                          ? "EFM local"
                          : "EFM à préciser"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate">
                    Référence nationale :{" "}
                    <span className="font-mono">{m.duree_reference} h</span>
                    {ecart !== 0 ? (
                      <>
                        {" · "}
                        <span className="font-mono">
                          {ecart > 0 ? "+" : ""}
                          {ecart} h
                        </span>{" "}
                        pour ce groupe
                      </>
                    ) : null}
                  </p>
                  <span className="mt-2 flex flex-wrap items-center gap-4">
                    <Link
                      href={`/groupes/${groupeId}/modules/${m.module_id}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-ink underline"
                    >
                      Plan de déroulement
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                    {/* PRD §4.2bis : les heures dispensées ne disent pas si
                        le référentiel a été couvert. */}
                    <Link
                      href={`/groupes/${groupeId}/modules/${m.module_id}/couverture`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-ink underline"
                    >
                      Couverture du référentiel
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </span>
                </div>

                {edition ? (
                  <div className="flex w-full max-w-[520px] flex-col gap-3">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {CHAMPS.map((c, i) => (
                        <Input
                          key={c.cle}
                          type="number"
                          min={0}
                          step={1}
                          autoFocus={i === 0}
                          value={saisie[c.cle]}
                          onChange={(e) =>
                            setSaisie((s) => ({ ...s, [c.cle]: e.target.value }))
                          }
                          label={
                            <span className="text-xs text-slate">{c.libelle}</span>
                          }
                        />
                      ))}
                    </div>

                    {/* PRD §4.13bis : sur le document officiel, la part à
                        distance d'un module de tronc commun partagé n'est
                        portée que par une seule des deux lignes de groupe. */}
                    <label className="flex items-center gap-3">
                      <Interrupteur
                        actif={mutualisee}
                        onChange={setMutualisee}
                        label="Part à distance partagée avec un autre groupe"
                        disabled={busy}
                      />
                      <span className="text-xs text-slate">
                        FAD partagée avec un autre groupe
                        <span className="block text-slate-light">
                          Le groupe reste crédité de ces heures ; votre tableau
                          de service ne les compte qu&apos;une fois.
                        </span>
                      </span>
                    </label>

                    <p className="text-xs text-slate">
                      Total :{" "}
                      <span className="font-mono text-ink">
                        {Number.isFinite(totalSaisi) ? totalSaisi : 0} h
                      </span>
                      {fadSaisie > 0 ? (
                        <span className="text-slate-light">
                          {" "}
                          · {totalSaisi - fadSaisie} présentiel + {fadSaisie} FAD
                        </span>
                      ) : null}
                    </p>
                    {erreur ? (
                      <p className="text-xs text-coral">{erreur}</p>
                    ) : null}

                    <div className="flex flex-wrap items-end gap-3">
                    <label className="flex shrink-0 flex-col gap-[7px]">
                      <span className="text-xs text-slate">Type d&apos;EFM</span>
                      <select
                        value={m.type_efm ?? ""}
                        onChange={(e) =>
                          changerTypeEfm(
                            m.module_id,
                            (e.target.value || null) as TypeEfmModule,
                          )
                        }
                        disabled={busy}
                        className={inputStyles}
                      >
                        <option value="">À préciser</option>
                        <option value="local">Local</option>
                        <option value="regional">Régional</option>
                      </select>
                    </label>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        size="sm"
                        icon={Check}
                        onClick={() => enregistrer(m.module_id)}
                        disabled={busy || erreur !== null}
                      >
                        Enregistrer
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={X}
                        onClick={() => setEnEdition(null)}
                        disabled={busy}
                      >
                        Annuler
                      </Button>
                    </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-wash px-3 py-1 font-mono text-sm font-medium text-ink">
                      <Clock size={16} aria-hidden />
                      {m.masse_horaire_allouee} h
                      {m.heures_fad > 0 ? (
                        <span className="text-slate-2">
                          {" "}
                          · {m.masse_horaire_allouee - m.heures_fad} présentiel
                          + {m.heures_fad} FAD
                          {m.fad_mutualisee ? " partagée" : ""}
                        </span>
                      ) : null}
                    </span>
                    <span className="font-mono text-xs text-slate-light">
                      S1 {m.presentiel_s1 + m.fad_s1} h · S2{" "}
                      {m.presentiel_s2 + m.fad_s2} h
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={Pencil}
                      onClick={() => ouvrirEdition(m)}
                    >
                      Modifier
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
