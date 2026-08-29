"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { theme } from "@/lib/theme";
import type { EvolutionPoint } from "@/app/actions/dashboard";

/**
 * Évolution de la progression, en aire pleine.
 *
 * La maquette (`Tableau de bord formateur v2.dc.html`) trace une aire
 * `#2E3B4E` à 7 % sous une ligne de 2,5 px de la même couleur. Le dégradé
 * vert de la v2 n'existe plus : les écrans livrés n'emploient aucun dégradé.
 *
 * Le graphique en barres « Avancement par groupe » a disparu avec lui — la
 * carte « Groupes par urgence » porte déjà la même information, chiffrée, et
 * la maquette ne garde que celle-là.
 */
export default function DashboardCharts({
  evolution,
}: {
  evolution: EvolutionPoint[];
}) {
  const donnees = evolution.map((e) => ({
    date: e.label,
    totalFait: e.totalFait,
  }));

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={donnees}
          margin={{ top: 8, right: 8, bottom: 0, left: -18 }}
        >
          <CartesianGrid
            stroke={theme.separator}
            strokeDasharray="0"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12, fill: theme.slateLight }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 12, fill: theme.slateLight }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ stroke: theme.borderStrong, strokeWidth: 1 }}
            formatter={(value) => [`${value} séance(s)`, "Cumul fait"]}
            contentStyle={{
              borderRadius: 10,
              border: `1px solid ${theme.border}`,
              boxShadow: "0 10px 28px rgba(46,59,78,.14)",
              fontSize: 13,
            }}
          />
          <Area
            type="linear"
            dataKey="totalFait"
            stroke={theme.ink}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill={theme.ink}
            fillOpacity={0.07}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
