import { getGroupeById } from "@/app/actions/groupes";
import { getStagiairesCount } from "@/app/actions/stagiaires";
import {
  createSeancesForGroupe,
  getSeancesByGroupe,
  type Seance,
} from "@/app/actions/seances";
import { redirect } from "next/navigation";
import SeanceCard from "./SeanceCard";
import GroupeHeader from "@/components/GroupeHeader";
import GroupeTabs from "@/components/GroupeTabs";
import { Sparkles } from "lucide-react";

export default async function ProgressionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const groupe = await getGroupeById(id);
  if (!groupe) redirect("/groupes");

  const [seances, stagiairesCount] = await Promise.all([
    getSeancesByGroupe(id),
    getStagiairesCount(id),
  ]);

  const byModule = new Map<string, { nom: string; seances: Seance[] }>();
  for (const s of seances) {
    const nom = s.modules?.nom ?? "Module";
    if (!byModule.has(s.module_id)) {
      byModule.set(s.module_id, { nom, seances: [] });
    }
    byModule.get(s.module_id)!.seances.push(s);
  }

  return (
    <div className="p-8">
      <GroupeHeader groupe={groupe} stagiairesCount={stagiairesCount} />
      <GroupeTabs />

      {seances.length === 0 ? (
        <div className="mt-8 rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-6 text-center">
          <p className="text-sm text-slate">
            Aucune séance générée pour ce groupe. Les séances sont créées pour
            chaque module assigné.
          </p>
          <form action={createSeancesForGroupe.bind(null, id)} className="mt-4">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-forest px-4 py-2 text-sm font-medium text-white hover:bg-forest/90 focus:outline-none focus:ring-2 focus:ring-forest"
            >
              <Sparkles size={16} />
              Générer les séances
            </button>
          </form>
        </div>
      ) : (
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
      )}
    </div>
  );
}
