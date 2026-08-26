import { getDashboardData } from "@/app/actions/dashboard";
import Link from "next/link";
import DashboardCharts from "./DashboardCharts";
import RailDeProgression from "@/components/RailDeProgression";
import { formatDate } from "@/lib/format";

const statsConfig: {
  key: "totalStagiaires" | "groupesActifs" | "modulesCount" | "controlesEnAttente";
  label: string;
  highlight?: boolean;
}[] = [
  { key: "totalStagiaires", label: "Stagiaires" },
  { key: "groupesActifs", label: "Groupes actifs" },
  { key: "modulesCount", label: "Modules" },
  { key: "controlesEnAttente", label: "Contrôles à valider", highlight: true },
];

export default async function DashboardPage() {
  const { stats, groupes, evolution } = await getDashboardData();

  return (
    <main className="p-8">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {statsConfig.map((s) => (
          <div
            key={s.key}
            className={`rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-5 ${
              s.highlight ? "border-l-[3px] border-l-forest" : ""
            }`}
          >
            <p className="font-display text-[28px] font-bold leading-none text-ink">
              {stats[s.key]}
            </p>
            <p className="mt-2 text-sm text-slate">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <DashboardCharts groupes={groupes} evolution={evolution} />
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-display text-xl font-bold text-ink">
            Groupes par urgence
          </h2>
          <p className="mt-0.5 text-xs text-slate">
            Triés par date de fin la plus proche en premier.
          </p>
        </div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-paper text-xs uppercase tracking-wide text-slate">
              <th className="px-4 py-3 font-medium">Groupe</th>
              <th className="px-4 py-3 font-medium">Date de fin</th>
              <th className="px-4 py-3 font-medium">Progression</th>
            </tr>
          </thead>
          <tbody>
            {groupes.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-8 text-center text-sm text-slate"
                >
                  Aucun groupe.
                </td>
              </tr>
            ) : (
              groupes.map((g) => (
                <tr key={g.id} className="border-t border-border transition-colors hover:bg-mint/50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/groupes/${g.id}/progression`}
                      className="font-medium text-ink hover:text-forest focus:outline-none focus:ring-2 focus:ring-forest"
                    >
                      {g.nom}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate">
                    {formatDate(g.date_fin, "Pas de date de fin")}
                  </td>
                  <td className="max-w-xs px-4 py-3">
                    <RailDeProgression
                      heuresRealisees={g.heuresRealisees}
                      masseHoraire={g.masseHoraire}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
