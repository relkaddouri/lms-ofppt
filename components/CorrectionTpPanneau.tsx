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
import { Eye, EyeOff, Lock, Save, Sparkles } from "lucide-react";

/**
 * Proposition de correction d'un TP (PRD §4.4).
 *
 * Elle n'apparaît qu'après coup, et l'écran le dit plutôt que de masquer un
 * bouton sans explication : un formateur qui ne trouve pas la correction la
 * cherchera ailleurs. La raison est pédagogique, pas technique — les
 * stagiaires doivent avoir cherché avant qu'un corrigé existe.
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
      toast("Correction proposée. Relisez-la avant de corriger.");
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
          ? "Correction visible par les stagiaires du groupe"
          : "Correction refermée — les accès à venir sont bloqués",
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
          La correction se prépare une fois la séance marquée comme faite. Ce
          n&apos;est pas une contrainte technique : les stagiaires doivent avoir
          cherché avant qu&apos;un corrigé existe.
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
          {correction ? "Regénérer la correction" : "Proposer une correction"}
        </Button>
        {correction ? (
          <Button
            size="sm"
            icon={Save}
            onClick={enregistrer}
            disabled={busy || !issuDuModele}
          >
            Enregistrer
          </Button>
        ) : null}
        {version ? (
          <Badge tone="success">version {version}</Badge>
        ) : (
          <Badge tone="neutral">aucune version</Badge>
        )}
        {version ? (
          <Button
            variant={partagee ? "secondary" : "primary"}
            size="sm"
            icon={partagee ? EyeOff : Eye}
            onClick={() => (partagee ? setAFermer(true) : basculerPartage(true))}
            disabled={busy}
          >
            {partagee ? "Ne plus partager" : "Partager avec les stagiaires"}
          </Button>
        ) : null}
        <span className="ml-auto text-[13px] text-slate">
          {partagee
            ? "Visible par les stagiaires du groupe"
            : "Réservée au formateur"}
        </span>
      </div>

      {version && partagee ? (
        <p className="rounded-[10px] border border-tint-teal-strong bg-tint-teal px-4 py-3 text-[13.5px] leading-relaxed text-ink">
          Les stagiaires de ce groupe voient cette correction dans leur espace.
          Eux seuls : un stagiaire d&apos;un autre groupe n&apos;y a pas accès,
          même partagée.
        </p>
      ) : null}

      {!aUnEnonce ? (
        <p className="text-sm text-slate">
          Aucun énoncé de TP n&apos;est enregistré pour cette séance : il
          n&apos;y a rien à corriger. Générez le support d&apos;abord.
        </p>
      ) : null}

      {issuDuModele ? (
        <BandeauIa>
          Correction proposée par l&apos;IA — relisez-la avant de corriger les
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
        title="Ne plus partager la correction ?"
        message="Les stagiaires n'y auront plus accès à partir de maintenant. Ceux qui l'ont déjà ouverte ont pu la lire ou l'enregistrer : refermer ne revient pas là-dessus."
        confirmLabel="Refermer"
        onConfirm={() => basculerPartage(false)}
        onClose={() => setAFermer(false)}
        busy={busy}
      />

      {correction ? (
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
