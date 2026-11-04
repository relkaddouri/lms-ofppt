import { dateLocale, formatHeures } from "@/lib/format";
import type { BilanHeures } from "@/lib/heures-formateur";
import { AlertTriangle, BellRing } from "lucide-react";

/** Nombre de semaines montrées dans l'historique de la carte. */
const SEMAINES_HISTORIQUE = 8;

function lundisAvant(lundi: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(`${lundi}T12:00:00`);
    d.setDate(d.getDate() - 7 * (n - 1 - i));
    return dateLocale(d);
  });
}

/**
 * Carte « Heures cumulées » de l'emploi du temps.
 *
 * Elle répond, dans l'ordre, aux trois questions du formateur : où j'en suis
 * sur l'année, combien il me reste, et à quelle allure j'avance. Tout se lit
 * dans le bilan déjà chargé : aucune requête de plus.
 */
export default function CarteHeuresCumulees({
  bilan,
  lundi,
  estSemaineCourante,
  heuresPlanifiees,
}: {
  bilan: BilanHeures;
  /** Lundi de la semaine affichée : la carte suit la navigation. */
  lundi: string;
  estSemaineCourante: boolean;
  /** Heures posées dans la grille de la semaine, faites ou non. */
  heuresPlanifiees: number;
}) {
  const annuel = bilan.plafonds[0] ?? null;
  const supplementaires = bilan.plafonds.slice(1);

  const semaine = bilan.semaines.find((s) => s.lundi === lundi) ?? null;
  const faitesSemaine = semaine?.heures ?? 0;
  const cibleSemaine = semaine?.cible ?? bilan.cibleHebdomadaire;

  // Une semaine appartient au mois de son lundi, même règle que le bilan.
  const heuresDuMois = bilan.semaines
    .filter((s) => s.lundi.slice(0, 7) === lundi.slice(0, 7))
    .reduce((t, s) => t + s.heures, 0);

  // L'allure se mesure sur les semaines où des heures ont été faites : les
  // vacances et les jours fériés ne doivent pas la tirer vers le bas.
  const semainesTravaillees = bilan.semaines.filter((s) => s.heures > 0).length;
  const moyenne =
    semainesTravaillees > 0 ? bilan.totalAnnuel / semainesTravaillees : 0;

  // `taux` est une fraction (0,24), pas un pourcentage.
  const pct = annuel ? annuel.taux * 100 : 0;
  const restant = annuel ? Math.max(0, annuel.plafond - annuel.valeur) : 0;
  const semainesRestantes = (allure: number) =>
    allure > 0 ? Math.ceil(restant / allure) : null;
  const aLaCible = semainesRestantes(bilan.cibleHebdomadaire);
  const aLaMoyenne = semainesRestantes(moyenne);

  // Les semaines sans séance faite n'existent pas dans le bilan : elles
  // valent zéro, et c'est justement ce qu'il faut voir.
  const historique = lundisAvant(lundi, SEMAINES_HISTORIQUE).map((l) => {
    const s = bilan.semaines.find((x) => x.lundi === l);
    return { lundi: l, heures: s?.heures ?? 0, cible: s?.cible ?? bilan.cibleHebdomadaire };
  });
  const echelle = Math.max(
    1,
    ...historique.map((h) => Math.max(h.heures, h.cible)),
  );

  const couleurBarre =
    annuel?.niveau === "depasse"
      ? "bg-coral"
      : annuel?.niveau === "proche"
        ? "bg-teal-dark"
        : "bg-teal";

  return (
    <section className="flex flex-col gap-5 rounded-[14px] border border-border bg-surface p-6 shadow-repos">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-[17px] font-semibold text-ink">
          Heures cumulées
        </h2>
        <span className="text-[13.5px] text-slate-light">
          Séances marquées faites, depuis le début de l&apos;année
        </span>
      </div>

      {annuel ? (
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <span className="flex items-baseline gap-2">
              <span className="font-mono text-[28px] font-medium leading-none text-ink">
                {formatHeures(annuel.valeur)}
              </span>
              <span className="font-mono text-sm text-slate-light">
                sur {formatHeures(annuel.plafond)}
              </span>
            </span>
            <span
              className={`rounded-lg px-2 py-0.5 font-mono text-sm font-medium ${
                annuel.niveau === "depasse"
                  ? "bg-alert-wash text-coral-dark"
                  : "bg-tint-teal text-teal-dark"
              }`}
            >
              {Math.round(pct)} %
            </span>
          </div>

          <div
            className="h-2.5 overflow-hidden rounded-full bg-wash"
            role="progressbar"
            aria-valuenow={Math.round(pct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={annuel.libelle}
          >
            <div
              className={`h-full rounded-full transition-[width] ${couleurBarre}`}
              // Un minimum visible : 2 h sur 920 h ne doit pas laisser croire
              // que la barre est cassée.
              style={{ width: `${pct > 0 ? Math.max(1.5, Math.min(100, pct)) : 0}%` }}
            />
          </div>

          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-[13px]">
            <span className="text-slate-2">{annuel.libelle}</span>
            <span className="font-mono text-ink">
              {restant > 0
                ? `${formatHeures(restant)} restantes`
                : `dépassée de ${formatHeures(annuel.valeur - annuel.plafond)}`}
            </span>
          </div>

          {annuel.message ? (
            <p
              className={`flex items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-xs ${
                annuel.niveau === "depasse"
                  ? "bg-alert-wash text-coral-dark"
                  : "bg-tint-teal text-teal-dark"
              }`}
            >
              {annuel.niveau === "depasse" ? (
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              ) : (
                <BellRing className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              )}
              {annuel.message}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 border-t border-separator pt-[18px] sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <span className="text-[13px] text-slate-light">
            {estSemaineCourante ? "Cette semaine" : "Semaine affichée"}
          </span>
          <span className="font-mono text-[19px] font-medium text-ink">
            {formatHeures(faitesSemaine)}
          </span>
          <span className="mt-0.5 h-1 overflow-hidden rounded-full bg-wash">
            <span
              className="block h-full rounded-full bg-teal"
              style={{
                width: `${cibleSemaine > 0 ? Math.min(100, (faitesSemaine / cibleSemaine) * 100) : 0}%`,
              }}
            />
          </span>
          <span className="text-[12px] text-slate-light">
            faites · cible {formatHeures(cibleSemaine)}
          </span>
          {heuresPlanifiees > faitesSemaine ? (
            <span className="text-[12px] text-slate-light">
              {formatHeures(heuresPlanifiees)} planifiées
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[13px] text-slate-light">Ce mois</span>
          <span className="font-mono text-[19px] font-medium text-ink">
            {formatHeures(heuresDuMois)}
          </span>
          <span className="text-[12px] text-slate-light">faites</span>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[13px] text-slate-light">Rythme moyen</span>
          <span className="font-mono text-[19px] font-medium text-ink">
            {formatHeures(moyenne)}
          </span>
          <span className="text-[12px] text-slate-light">
            par semaine, sur {semainesTravaillees} semaine{semainesTravaillees > 1 ? "s" : ""}{" "}
            de cours
          </span>
        </div>
      </div>

      <figure className="flex flex-col gap-2">
        <figcaption className="flex items-baseline justify-between gap-3 text-[13px]">
          <span className="text-slate-2">
            {SEMAINES_HISTORIQUE} dernières semaines
          </span>
          <span className="flex items-center gap-1.5 text-[12px] text-slate-light">
            <span
              aria-hidden
              className="inline-block w-3 border-t border-dashed border-ink/40"
            />
            cible
          </span>
        </figcaption>
        <ol className="flex h-20 items-end gap-1.5">
          {historique.map((h) => {
            const atteinte = h.heures >= h.cible;
            const affichee = h.lundi === lundi;
            const jour = new Date(`${h.lundi}T12:00:00`);
            return (
              <li
                key={h.lundi}
                className="relative flex h-full flex-1 flex-col justify-end"
                title={`Semaine du ${jour.toLocaleDateString("fr-FR")} : ${formatHeures(h.heures)} faites, cible ${formatHeures(h.cible)}`}
              >
                <span
                  aria-hidden
                  className="absolute -inset-x-[3px] z-10 border-t border-dashed border-ink/40"
                  style={{ bottom: `${(h.cible / echelle) * 100}%` }}
                />
                <span
                  className={`block rounded-t-[4px] ${
                    h.heures === 0
                      ? "bg-wash"
                      : atteinte
                        ? "bg-teal"
                        : "bg-teal/45"
                  } ${affichee ? "ring-2 ring-ink/30 ring-offset-1 ring-offset-surface" : ""}`}
                  style={{
                    height: h.heures > 0 ? `${Math.max(4, (h.heures / echelle) * 100)}%` : "3px",
                  }}
                />
                <span className="sr-only">
                  Semaine du {jour.toLocaleDateString("fr-FR")} :{" "}
                  {formatHeures(h.heures)} sur {formatHeures(h.cible)}
                </span>
              </li>
            );
          })}
        </ol>
        <div className="flex gap-1.5 font-mono text-[10.5px] text-slate-light" aria-hidden>
          {historique.map((h) => (
            <span key={h.lundi} className="flex-1 text-center">
              {h.lundi.slice(8, 10)}/{h.lundi.slice(5, 7)}
            </span>
          ))}
        </div>
      </figure>

      {annuel && restant > 0 && (aLaCible || aLaMoyenne) ? (
        <p className="rounded-lg bg-wash px-3 py-2.5 text-[13px] leading-relaxed text-slate-2">
          {aLaCible ? (
            <>
              À votre cible de {formatHeures(bilan.cibleHebdomadaire)} par
              semaine, il reste environ{" "}
              <span className="font-medium text-ink">
                {aLaCible} semaine{aLaCible > 1 ? "s" : ""}
              </span>{" "}
              de cours.
            </>
          ) : null}
          {aLaMoyenne && aLaMoyenne !== aLaCible ? (
            <>
              {" "}
              À votre rythme actuel, environ{" "}
              <span className="font-medium text-ink">
                {aLaMoyenne} semaine{aLaMoyenne > 1 ? "s" : ""}
              </span>
              .
            </>
          ) : null}
        </p>
      ) : null}

      {supplementaires.length > 0 ? (
        <ul className="flex flex-col gap-1.5 border-t border-separator pt-4">
          {supplementaires.map((p) => (
            <li
              key={p.libelle}
              className="flex items-baseline justify-between gap-3 text-[13px]"
            >
              <span className="text-slate-2">{p.libelle}</span>
              <span
                className={`font-mono ${
                  p.niveau === "depasse" ? "font-semibold text-coral-dark" : "text-ink"
                }`}
              >
                {formatHeures(p.valeur)} / {formatHeures(p.plafond)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
