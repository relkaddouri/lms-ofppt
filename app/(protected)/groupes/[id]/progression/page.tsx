import { getSeancesByGroupe, createSeancesForGroupe, type Seance } from "@/app/actions/seances";
import SeanceCard from "./SeanceCard";
import Card from "@/components/ui/Card";
import { Sparkles } from "lucide-react";
import { buttonStyles } from "@/components/ui/Button";

export default async function ProgressionPage({
  params,
}: PageProps<"/groupes/[id]/progression">) {
  const { id } = await params;
  const seances = await getSeancesByGroupe(id);

  const byModule = new Map<string, { nom: string; seances: Seance[] }>();
  for (const s of seances) {
    const nom = s.modules?.nom ?? "Module";
    if (!byModule.has(s.module_id)) {
      byModule.set(s.module_id, { nom, seances: [] });
    }
    byModule.get(s.module_id)!.seances.push(s);
  }

  if (seances.length === 0) {
    return (
      <Card className="mt-8 p-6 text-center" padded={false}>
        <p className="text-sm text-slate">
          Aucune séance générée pour ce groupe. Les séances sont créées pour
          chaque module assigné.
        </p>
        <form action={createSeancesForGroupe.bind(null, id)} className="mt-4">
          <button type="submit" className={buttonStyles("primary")}>
            <Sparkles size={16} aria-hidden />
            Générer les séances
          </button>
        </form>
      </Card>
    );
  }

  return (
    <div className="mt-8 space-y-8">
      {[...byModule.entries()].map(([moduleId, { nom, seances: list }]) => (
        <section key={moduleId}>
          <h2 className="font-display text-xl font-bold text-ink">{nom}</h2>
          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {list.map((s) => (
              <SeanceCard key={s.id} seance={s} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
