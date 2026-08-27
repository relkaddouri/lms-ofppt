"use client";

import { useState, useTransition } from "react";
import Breadcrumb from "@/components/Breadcrumb";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { inputStyles as inputClass } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { formatHeures } from "@/lib/format";
import { proposerRepartition, arrondi } from "@/lib/repartition";
import {
  saveRepartition,
  genererPlanSeances,
  type PlanificationModule,
} from "@/app/actions/repartition";
import { construirePlan, HEURES_PAR_CONTROLE } from "@/lib/planification";
import { ConfirmModal } from "@/components/ui/Modal";
import { getManuel } from "@/app/actions/manuel";
import { slugify } from "@/lib/format";
import { BookOpen, RotateCcw, Save } from "lucide-react";

export default function RepartitionManager({
  groupeId,
  moduleId,
  plan,
}: {
  groupeId: string;
  moduleId: string;
  plan: PlanificationModule;
}) {
  const toast = useToast();
  const [enCours, startTransition] = useTransition();
  const [lignes, setLignes] = useState(plan.lignes);
  const [proposition, setProposition] = useState(plan.proposition);
  const [confirmRemplacer, setConfirmRemplacer] = useState(false);

  // Aperçu du découpage, recalculé à chaque ajustement : le formateur voit
  // combien de séances et de contrôles il s'apprête à créer.
  const apercu = construirePlan(
    lignes.map((l) => ({
      id: l.id,
      code: l.code,
      intitule: l.intitule,
      heures_theoriques: l.heures_theoriques,
      heures_pratiques: l.heures_pratiques,
    })),
  );

  const totalTheorique = lignes.reduce((s, l) => s + l.heures_theoriques, 0);
  const totalPratique = lignes.reduce((s, l) => s + l.heures_pratiques, 0);
  const total = arrondi(totalTheorique + totalPratique + plan.heuresEvaluation);
  const ecart = arrondi(total - plan.masseHoraire);

  function maj(id: string, champ: "heures_theoriques" | "heures_pratiques", v: number) {
    setLignes((ls) =>
      ls.map((l) => (l.id === id ? { ...l, [champ]: Math.max(0, v) } : l)),
    );
    setProposition(false);
  }

  async function telechargerManuel() {
    startTransition(async () => {
      try {
        const manuel = await getManuel(moduleId, groupeId);
        if (!manuel) throw new Error("Référentiel introuvable pour ce module.");
        const { telechargerManuelPdf } = await import("@/lib/pdf-manuel");
        await telechargerManuelPdf(
          manuel,
          `manuel-formateur-competence-${manuel.numero}-${slugify(
            plan.groupeNom,
            "groupe",
          )}.pdf`,
        );
      } catch (e) {
        toast(e instanceof Error ? e.message : "Export impossible.", "error");
      }
    });
  }

  function reproposer() {
    const { parts } = proposerRepartition(
      lignes,
      plan.masseHoraire,
      plan.pctTheorique,
      plan.pctPratique,
      plan.pctEvaluation,
    );
    const m = new Map(parts.map((p) => [p.suggestion_pedagogique_id, p]));
    setLignes((ls) =>
      ls.map((l) => ({
        ...l,
        heures_theoriques: m.get(l.id)?.heures_theoriques ?? l.heures_theoriques,
        heures_pratiques: m.get(l.id)?.heures_pratiques ?? l.heures_pratiques,
      })),
    );
    setProposition(true);
    toast("Répartition recalculée depuis le référentiel.");
  }

  function enregistrer(remplacer = false) {
    startTransition(async () => {
      try {
        await saveRepartition(
          groupeId,
          moduleId,
          lignes.map((l) => ({
            suggestion_pedagogique_id: l.id,
            heures_theoriques: l.heures_theoriques,
            heures_pratiques: l.heures_pratiques,
          })),
        );
        setProposition(false);

        const r = await genererPlanSeances(groupeId, moduleId, remplacer);
        setConfirmRemplacer(false);

        if (r.dejaPlanifie) {
          setConfirmRemplacer(true);
          toast("Répartition enregistrée. Ce module est déjà planifié.");
          return;
        }
        toast(
          `${r.seancesCreees} séances et ${r.controlesCrees} contrôles créés.`,
        );
      } catch (e) {
        toast(e instanceof Error ? e.message : "Enregistrement impossible.", "error");
      }
    });
  }

  // Les objectifs se lisent par élément de compétence, comme dans le manuel.
  let lettrePrecedente = "";

  return (
    <div className="p-8">
      <Breadcrumb
        items={[
          { label: "Groupes", href: "/groupes" },
          { label: plan.groupeNom, href: `/groupes/${groupeId}` },
          { label: "Modules", href: `/groupes/${groupeId}/modules` },
          { label: plan.moduleNom },
        ]}
      />

      <header className="mt-6">
        <h1 className="text-2xl font-semibold text-ink">
          Plan de déroulement du module
        </h1>
        <p className="mt-1 text-sm text-slate">
          {plan.competenceNom}
          {plan.codeOfficiel ? ` · ${plan.codeOfficiel}` : ""}
          {plan.dureeNationale
            ? ` · ${plan.dureeNationale} h au référentiel national`
            : ""}
        </p>
      </header>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        {[
          { libelle: "Masse horaire allouée", valeur: formatHeures(plan.masseHoraire) },
          { libelle: `Théorique (${plan.pctTheorique} %)`, valeur: formatHeures(totalTheorique) },
          { libelle: `Pratique (${plan.pctPratique} %)`, valeur: formatHeures(totalPratique) },
          {
            libelle: `Évaluation (${plan.pctEvaluation} %)`,
            valeur: formatHeures(plan.heuresEvaluation),
          },
        ].map((c) => (
          <div key={c.libelle} className="rounded-xl border border-border bg-surface p-3">
            <p className="text-xs text-slate">{c.libelle}</p>
            <p className="mt-0.5 text-lg font-semibold text-ink">{c.valeur}</p>
          </div>
        ))}
      </div>

      {proposition ? (
        <p className="mt-4 rounded-xl border border-info/30 bg-info/10 px-4 py-3 text-sm text-ink">
          Le manuel de formateur laisse ces heures en « ? ». Voici une
          proposition, calculée depuis la part de chaque élément au référentiel.
          Ajustez-la, puis enregistrez : rien n&apos;est encore enregistré.
        </p>
      ) : null}

      <div className="mt-4 rounded-xl border border-border bg-surface px-4 py-3">
        <p className="text-sm text-ink">
          <span className="font-medium">{apercu.seances.length} séances</span>{" "}
          seront créées, dont{" "}
          {apercu.seances.filter((s) => s.nature === "theorique").length}{" "}
          théoriques et{" "}
          {apercu.seances.filter((s) => s.nature === "pratique").length}{" "}
          pratiques, plus{" "}
          <span className="font-medium">
            {apercu.controles.length} contrôles
          </span>{" "}
          — un tous les {HEURES_PAR_CONTROLE} heures.
        </p>
        <p className="mt-1 text-xs text-slate">
          Chaque séance porte son objectif pédagogique. Les fiches de
          préparation ne sont pas générées : vous les produirez séance par
          séance.
        </p>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border bg-mist text-left">
              <th className="px-3 py-2 font-medium text-slate">
                Objectif d&apos;apprentissage
              </th>
              <th className="w-28 px-3 py-2 text-right font-medium text-slate">
                Théorique
              </th>
              <th className="w-28 px-3 py-2 text-right font-medium text-slate">
                Pratique
              </th>
              <th className="w-24 px-3 py-2 text-right font-medium text-slate">
                Total
              </th>
              <th className="w-32 px-3 py-2 font-medium text-slate">Mode</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => {
              const nouvelElement = l.lettre !== lettrePrecedente;
              lettrePrecedente = l.lettre;
              return (
                <tr
                  key={l.id}
                  className={`border-b border-border last:border-0 ${
                    nouvelElement ? "border-t-2 border-t-border" : ""
                  }`}
                >
                  <td className="px-3 py-2">
                    <span className="font-mono text-xs text-slate">{l.code}</span>{" "}
                    <span className="text-ink">{l.intitule}</span>
                    {l.pourcentElement != null ? (
                      <Badge tone="neutral">élément {l.lettre} — {l.pourcentElement} %</Badge>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      aria-label={`Heures théoriques ${l.code}`}
                      value={l.heures_theoriques}
                      onChange={(e) =>
                        maj(l.id, "heures_theoriques", Number(e.target.value) || 0)
                      }
                      className={`${inputClass} text-right`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      aria-label={`Heures pratiques ${l.code}`}
                      value={l.heures_pratiques}
                      onChange={(e) =>
                        maj(l.id, "heures_pratiques", Number(e.target.value) || 0)
                      }
                      className={`${inputClass} text-right`}
                    />
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-ink">
                    {formatHeures(l.heures_theoriques + l.heures_pratiques)}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate">
                    {[
                      l.presentiel ? "présentiel" : null,
                      l.synchrone ? "synchrone" : null,
                      l.asynchrone ? "asynchrone" : null,
                    ]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button icon={Save} onClick={() => enregistrer(false)} disabled={enCours}>
          {enCours ? "Enregistrement…" : "Enregistrer et créer les séances"}
        </Button>
        <Button variant="secondary" icon={RotateCcw} onClick={reproposer}>
          Recalculer depuis le référentiel
        </Button>
        <Button
          variant="ghost"
          icon={BookOpen}
          onClick={telechargerManuel}
          disabled={enCours || proposition}
          title={
            proposition
              ? "Enregistrez la répartition avant d'éditer le manuel"
              : undefined
          }
        >
          Manuel de formateur
        </Button>
        <span
          className={`ml-auto text-sm ${ecart === 0 ? "text-slate" : "text-danger"}`}
        >
          {formatHeures(total)} répartie{ecart === 0 ? "s" : "s"} sur{" "}
          {formatHeures(plan.masseHoraire)}
          {ecart !== 0
            ? ` — écart de ${ecart > 0 ? "+" : ""}${formatHeures(ecart)}`
            : ""}
        </span>
      </div>

      <ConfirmModal
        open={confirmRemplacer}
        title="Ce module est déjà planifié"
        message="Les séances déjà faites, et celles dont la fiche de préparation est écrite, seront conservées. Les autres seront remplacées par le nouveau découpage."
        confirmLabel="Remplacer les séances"
        busy={enCours}
        onConfirm={() => enregistrer(true)}
        onClose={() => setConfirmRemplacer(false)}
      />
    </div>
  );
}
