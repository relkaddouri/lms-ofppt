"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import BandeauIa from "@/components/BandeauIa";
import { useToast } from "@/components/ui/Toast";
import { partagerCorrection, saveCorrection } from "@/app/actions/corrections";
import {
  correctionVide,
  type CorrectionTp,
} from "@/lib/correction";
import { ConfirmModal } from "@/components/ui/Modal";
import { Eye, EyeOff, Lock, PenLine, Save, Sparkles } from "lucide-react";
import DocumentRedige from "@/components/DocumentRedige";
import { inputStyles as inputClass } from "@/components/ui/Input";
import { estRedigee } from "@/lib/correction";

/**
 * Grille de correction d'un TP (PRD §4.4, « proposition de correction »).
 *
 * Le PRD dit « correction », l'écran dit « grille » : dans une application qui
 * note déjà des copies de contrôle toute seule, appeler « correction » un
 * document qui ne note rien laissait croire que le TP se corrigeait aussi tout
 * seul. Ici rien n'est noté — c'est l'outil avec lequel le formateur corrige,
 * et il peut très bien s'en passer.
 *
 * Elle n'apparaît qu'après coup, et l'écran le dit plutôt que de masquer un
 * bouton sans explication : un formateur qui ne la trouve pas la cherchera
 * ailleurs. La raison est pédagogique, pas technique — les stagiaires doivent
 * avoir cherché avant qu'un corrigé existe.
 *
 * Elle est fermée aux stagiaires par défaut, y compris après la séance. Le
 * formateur l'ouvre quand il le juge bon, correction par correction — jamais
 * pour un module entier. Refermer bloque les accès à venir et rien de plus :
 * l'écran le dit, promettre un retrait rétroactif serait une fausse sécurité.
 */
export default function CorrectionTpPanneau({
  seanceId,
  seanceFaite,
  aUnEnonce,
  initial,
  versionInitiale,
  partageeInitial,
}: {
  seanceId: string;
  seanceFaite: boolean;
  aUnEnonce: boolean;
  initial: CorrectionTp | null;
  versionInitiale: number | null;
  partageeInitial: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [correction, setCorrection] = useState<CorrectionTp | null>(initial);
  // Au sens de l'écran : le champ existe, même vide — sinon la zone de saisie
  // se refermerait à la première frappe effacée. `estRedigee` garde son sens
  // strict pour tout ce qui lit une correction enregistrée.
  const redigee =
    correction !== null &&
    correction.markdown !== null &&
    correction.markdown !== undefined;

  /**
   * Bascule la grille en rédaction libre.
   *
   * Le markdown remplace la grille structurée, il ne s'y ajoute pas : un
   * formateur qui écrit la sienne a écarté la proposition du modèle, la voir
   * subsister dessous n'aurait aucun sens. Repasser à vide restitue la
   * structure, rien n'est détruit tant qu'on n'enregistre pas.
   */
  function redigerAlaMain() {
    const base = correction ?? correctionVide();
    setCorrection({ ...base, markdown: base.markdown ?? "" });
    setIssuDuModele(false);
  }
  const [version, setVersion] = useState(versionInitiale);
  const [issuDuModele, setIssuDuModele] = useState(false);
  const [avertissements, setAvertissements] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [partagee, setPartagee] = useState(partageeInitial);
  // Fermer se confirme, ouvrir non : ouvrir se défait, la lecture qui a eu
  // lieu ne se défait pas.
  const [aFermer, setAFermer] = useState(false);

  async function generer() {
    setBusy(true);
    try {
      const res = await fetch("/api/generate/correction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seanceId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur de génération");
      setCorrection({ ...correctionVide(), ...data.correction });
      setIssuDuModele(true);
      setAvertissements(data.avertissements ?? []);
      toast("Grille proposée. Relisez-la avant de corriger.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur inattendue", "error");
    } finally {
      setBusy(false);
    }
  }

  async function basculerPartage(vers: boolean) {
    setBusy(true);
    try {
      await partagerCorrection(seanceId, vers);
      setPartagee(vers);
      setAFermer(false);
      toast(
        vers
          ? "Corrigé visible par les stagiaires du groupe"
          : "Corrigé refermé — les accès à venir sont bloqués",
      );
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur inattendue", "error");
    } finally {
      setBusy(false);
    }
  }

  async function enregistrer() {
    if (!correction) return;
    setBusy(true);
    try {
      const v = await saveCorrection(seanceId, correction);
      setVersion(v);
      setIssuDuModele(false);
      toast(`Version ${v} enregistrée`);
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur inattendue", "error");
    } finally {
      setBusy(false);
    }
  }

  if (!seanceFaite) {
    return (
      <div className="flex flex-wrap items-start gap-2.5 rounded-[10px] border border-border bg-paper-alt px-4 py-3.5">
        <Lock size={16} className="mt-0.5 shrink-0 text-slate" aria-hidden />
        <p className="text-[13.5px] leading-relaxed text-slate-2">
          La grille de correction se prépare une fois la séance marquée comme
          faite. Ce n&apos;est pas une contrainte technique : les stagiaires
          doivent avoir cherché avant qu&apos;un corrigé existe.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          icon={Sparkles}
          onClick={generer}
          loading={busy}
          loadingLabel="Génération…"
          disabled={!aUnEnonce}
        >
          {correction ? "Regénérer la grille" : "Proposer une grille"}
        </Button>
        {/* §4.4 : la génération n'est jamais le seul chemin. Le bouton est
            voisin du sien, pas caché sous la grille. */}
        <Button
          variant="secondary"
          size="sm"
          icon={PenLine}
          onClick={redigerAlaMain}
          disabled={busy}
        >
          {redigee ? "Reprendre la grille rédigée" : "Rédiger la grille"}
        </Button>
        {correction ? (
          <Button
            size="sm"
            icon={Save}
            onClick={enregistrer}
            // `issuDuModele` garde le bouton fermé tant qu'une proposition
            // n'a pas été relue. Une grille écrite à la main n'a personne à
            // relire : elle s'enregistre directement.
            disabled={busy || (!issuDuModele && !redigee)}
          >
            Enregistrer
          </Button>
        ) : null}
        {version ? (
          <Badge tone="success">version {version}</Badge>
        ) : (
          <Badge tone="neutral">aucune grille</Badge>
        )}
        {version ? (
          <Button
            variant={partagee ? "secondary" : "primary"}
            size="sm"
            icon={partagee ? EyeOff : Eye}
            onClick={() => (partagee ? setAFermer(true) : basculerPartage(true))}
            disabled={busy}
          >
            {partagee ? "Ne plus partager" : "Partager le corrigé"}
          </Button>
        ) : null}
        <span className="ml-auto text-[13px] text-slate">
          {partagee
            ? "Corrigé visible par les stagiaires"
            : "Pour vous seul"}
        </span>
      </div>

      {version && partagee ? (
        <p className="rounded-[10px] border border-tint-teal-strong bg-tint-teal px-4 py-3 text-[13.5px] leading-relaxed text-ink">
          Les stagiaires de ce groupe voient ce corrigé dans leur espace. Eux
          seuls : un stagiaire d&apos;un autre groupe n&apos;y a pas accès, même
          partagé.
        </p>
      ) : null}

      {!aUnEnonce ? (
        <p className="text-sm text-slate">
          Aucun énoncé de TP n&apos;est enregistré pour cette séance : il
          n&apos;y a rien sur quoi bâtir une grille. Générez le support
          d&apos;abord.
        </p>
      ) : null}

      {issuDuModele ? (
        <BandeauIa>
          Grille proposée par l&apos;IA — relisez-la avant de corriger les
          copies.
        </BandeauIa>
      ) : null}

      {avertissements.length > 0 ? (
        <ul className="list-disc space-y-0.5 rounded-lg bg-tint-teal px-5 py-2 text-sm text-ink">
          {avertissements.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      ) : null}

      <ConfirmModal
        open={aFermer}
        title="Ne plus partager le corrigé ?"
        message="Les stagiaires n'y auront plus accès à partir de maintenant. Ceux qui l'ont déjà ouvert ont pu le lire ou l'enregistrer : refermer ne revient pas là-dessus."
        confirmLabel="Refermer"
        onConfirm={() => basculerPartage(false)}
        onClose={() => setAFermer(false)}
        busy={busy}
      />

      {correction && redigee ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate">
                Markdown — titres, listes, gras
              </span>
              <textarea
                rows={14}
                value={correction.markdown ?? ""}
                onChange={(e) =>
                  setCorrection({ ...correction, markdown: e.target.value })
                }
                placeholder={"## Critère 1 — 6 pts\n\n- ce qui vaut le total\n- ce qui coûte des points"}
                className={`${inputClass} font-mono text-[13px]`}
              />
            </label>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-slate">Aperçu</span>
              <div className="min-h-[160px] rounded-[9px] border border-border bg-surface p-3">
                {correction.markdown?.trim() ? (
                  <DocumentRedige texte={correction.markdown} />
                ) : (
                  <p className="text-sm text-slate-light">
                    L&apos;aperçu s&apos;affiche ici à mesure que vous écrivez.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : correction ? (
        <div className="flex flex-col gap-4">
          {correction.proposition ? (
            <section>
              <h3 className="font-mono text-[11.5px] uppercase tracking-[0.12em] text-slate-light">
                Production de référence
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink">
                {correction.proposition}
              </p>
            </section>
          ) : null}

          {correction.etapes.length > 0 ? (
            <section className="flex flex-col gap-2.5">
              <h3 className="font-mono text-[11.5px] uppercase tracking-[0.12em] text-slate-light">
                Consigne par consigne
              </h3>
              {correction.etapes.map((e, i) => (
                <div
                  key={i}
                  className="rounded-[10px] border border-border bg-surface px-4 py-3"
                >
                  <p className="text-sm font-semibold text-ink">
                    {i + 1}. {e.consigne}
                  </p>
                  {e.attendu.length > 0 ? (
                    <>
                      <p className="mt-2 text-xs text-slate">Attendu</p>
                      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-ink">
                        {e.attendu.map((a, k) => (
                          <li key={k}>{a}</li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                  {e.erreurs.length > 0 ? (
                    <>
                      <p className="mt-2 text-xs text-slate">
                        Erreurs fréquentes
                      </p>
                      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-slate-2">
                        {e.erreurs.map((x, k) => (
                          <li key={k}>{x}</li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </div>
              ))}
            </section>
          ) : null}

          {correction.criteres.length > 0 ? (
            <section>
              <h3 className="font-mono text-[11.5px] uppercase tracking-[0.12em] text-slate-light">
                Barème — celui de l&apos;énoncé
              </h3>
              <ul className="mt-1.5 divide-y divide-separator">
                {correction.criteres.map((c, i) => (
                  <li key={i} className="flex items-baseline gap-3 py-2">
                    <span className="flex-1 text-sm text-ink">
                      {c.critere}
                      {c.bareme ? (
                        <span className="block text-[13px] text-slate-2">
                          {c.bareme}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 font-mono text-sm tabular-nums text-slate">
                      {c.points} pt{c.points > 1 ? "s" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {correction.aReprendre.length > 0 ? (
            <section className="rounded-[10px] border border-tint-teal-strong bg-tint-teal px-4 py-3">
              <h3 className="text-sm font-semibold text-ink">
                À reprendre avec le groupe
              </h3>
              <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-sm text-ink">
                {correction.aReprendre.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
