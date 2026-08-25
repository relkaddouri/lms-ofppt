"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  EvolutionPoint,
  GroupeProgression,
} from "@/app/actions/dashboard";
import { theme } from "@/lib/theme";

const gridStroke = `${theme.slate}26`;
const tickStyle = { fontSize: 12, fill: theme.slate };

function BarTooltip({ active, payload }: { active?: boolean; payload?: { value: number; payload: { nom: string } }[] }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-slate">{item.payload.nom}</p>
      <p className="mt-0.5 font-mono text-sm font-semibold text-ink">
        {item.value}%
      </p>
    </div>
  );
}

export default function DashboardCharts({
  groupes,
  evolution,
}: {
  groupes: GroupeProgression[];
  evolution: EvolutionPoint[];
}) {
  const barData = groupes.map((g) => ({ nom: g.nom, avancement: g.pourcentage }));
  const lineData = evolution.map((e) => ({ date: e.label, totalFait: e.totalFait }));

  return (
    <>
      <div className="rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4">
        <h2 className="font-display text-xl font-bold text-ink">
          Avancement par groupe
        </h2>
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData}>
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={theme.forest} />
                  <stop offset="100%" stopColor={theme.forestLight} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis
                dataKey="nom"
                tick={tickStyle}
                tickFormatter={(v: string) =>
                  v.length > 18 ? `${v.slice(0, 16)}…` : v
                }
              />
              <YAxis domain={[0, 100]} unit="%" tick={tickStyle} />
              <Tooltip
                cursor={{ fill: `${theme.forest}14` }}
                content={<BarTooltip />}
              />
              <Bar
                dataKey="avancement"
                fill="url(#barGradient)"
                radius={[4, 4, 0, 0]}
                activeBar={{ fill: theme.forestLight }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4">
        <h2 className="font-display text-xl font-bold text-ink">
          Évolution de la progression
        </h2>
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineData}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="date" tick={tickStyle} />
              <YAxis allowDecimals={false} tick={tickStyle} />
              <Tooltip
                formatter={(value) => [`${value} séance(s)`, "Cumul fait"]}
              />
              <Line
                type="monotone"
                dataKey="totalFait"
                stroke={theme.success}
                strokeWidth={2}
                dot={{ fill: theme.success, r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}
