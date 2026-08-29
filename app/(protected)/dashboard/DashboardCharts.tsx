"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { theme } from "@/lib/theme";
import type { EvolutionPoint } from "@/app/actions/dashboard";

/**
 * Progression réalisée contre progression attendue.
 *
 * Fidèle à `Tableau de bord formateur v2.dc.html` : aire `--ofppt-ink` à 7 %
 * sous une ligne de 2,5 px, et une ligne pointillée `--muted` de 2 px pour le
 * prévisionnel. Aucun dégradé — les écrans livrés n'en emploient nulle part.
 * L'axe vertical est en pourcentage, de 0 à 100.
 */
export default function DashboardCharts({
  points,
}: {
  points: EvolutionPoint[];
}) {
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid stroke={theme.separator} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: theme.slateLight }}
            axisLine={false}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tick={{ fontSize: 12, fill: theme.slateLight }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ stroke: theme.borderStrong, strokeWidth: 1 }}
            formatter={(valeur, nom) => [
              `${valeur} %`,
              nom === "realise" ? "Réalisé" : "Prévisionnel",
            ]}
            contentStyle={{
              borderRadius: 10,
              border: `1px solid ${theme.border}`,
              boxShadow: "0 10px 28px rgba(46,59,78,.14)",
              fontSize: 13,
            }}
          />
          <Area
            type="linear"
            dataKey="realise"
            stroke={theme.ink}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill={theme.ink}
            fillOpacity={0.07}
            dot={false}
          />
          <Line
            type="linear"
            dataKey="previsionnel"
            stroke={theme.muted}
            strokeWidth={2}
            strokeDasharray="5 5"
            strokeLinecap="round"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
