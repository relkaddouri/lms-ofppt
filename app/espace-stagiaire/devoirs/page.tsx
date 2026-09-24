import { ClipboardList } from "lucide-react";
import { getMesDevoirs } from "@/app/actions/devoirs";
import { maintenant } from "@/lib/format";
import CarteDevoir from "./CarteDevoir";
import EnConstruction from "../EnConstruction";
import EnTete from "../EnTete";

export const metadata = { title: "Devoirs" };

/**
 * Les devoirs du stagiaire, dans la tenue du reste de son espace (PRD §4.5bis).
 *
 * Deux listes et non une : ce qui reste à rendre appelle une action, ce qui
 * est remis ne se relit que pour vérifier. Chacune s'annonce par son
 * intertitre, comme les parties d'un module.
 */
export default async function DevoirsPage() {
  const devoirs = await getMesDevoirs();

  if (devoirs.length === 0) {
    return (
      <EnConstruction
        titre="Aucun devoir"
        description="Les devoirs assignés par votre formateur apparaîtront ici, avec leur date de rendu."
        Icone={ClipboardList}
      />
    );
  }

  // Ce qui reste à faire d'abord : un devoir déjà remis n'appelle plus d'action.
  const aFaire = devoirs.filter((d) => d.monRendu?.statut !== "rendu");
  const remis = devoirs.filter((d) => d.monRendu?.statut === "rendu");

  const aujourdhui = maintenant();
  const enRetard = aFaire.filter(
    (d) => d.date_echeance !== null && d.date_echeance < aujourdhui,
  ).length;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <EnTete
        surtitre="Mes devoirs"
        titre="Devoirs"
        dansCarte={false}
        resume={
          aFaire.length === 0 ? (
            "Tout est remis"
          ) : (
            <>
              <span className="font-mono text-body">{aFaire.length}</span> devoir
              {aFaire.length > 1 ? "s" : ""} à rendre
              {enRetard > 0 ? (
                <>
                  {" · "}
                  <span className="font-mono font-medium text-coral-dark">
                    {enRetard} en retard
                  </span>
                </>
              ) : null}
            </>
          )
        }
      />

      {aFaire.length > 0 ? (
        <Section titre="À rendre" nombre={aFaire.length}>
          {aFaire.map((d) => (
            <CarteDevoir key={d.id} devoir={d} />
          ))}
        </Section>
      ) : null}

      {remis.length > 0 ? (
        <Section titre="Remis" nombre={remis.length}>
          {remis.map((d) => (
            <CarteDevoir key={d.id} devoir={d} />
          ))}
        </Section>
      ) : null}
    </div>
  );
}

/** Une liste de devoirs sous son intertitre, dans la tenue des parties d'un module. */
function Section({
  titre,
  nombre,
  children,
}: {
  titre: string;
  nombre: number;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden border-y border-border bg-surface md:rounded-[14px] md:border">
      <h2 className="flex items-center gap-2.5 border-b border-separator bg-paper-alt px-5 py-2.5">
        <span className="font-display text-sm font-semibold text-ink">
          {titre}
        </span>
        <span className="ml-auto font-mono text-xs text-muted">
          {nombre} devoir{nombre > 1 ? "s" : ""}
        </span>
      </h2>
      {children}
    </section>
  );
}
