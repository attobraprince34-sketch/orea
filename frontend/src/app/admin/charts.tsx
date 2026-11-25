"use client";

/**
 * Graphiques du tableau de bord admin (Recharts).
 * Règles suivies : un seul axe, traits fins (2 px), légende + étiquettes directes
 * pour 2 séries, grille discrète, info-bulle au survol, vue tableau pour
 * l'accessibilité. Couleurs : --chart-1 / --chart-2, validées pour le daltonisme
 * et le contraste en mode clair ET sombre.
 */

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { AdminStats, CountByLabel } from "@/lib/types";

const AXIS = { fontSize: 12, fill: "var(--muted-foreground)" };
const GRID = "var(--border)";

function shortDay(day: string) {
  return new Date(`${day}T12:00:00`).toLocaleDateString("fr-CI", { day: "numeric", month: "short" });
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 text-sm">
      {label && <p className="mb-1 font-semibold">{label.length === 10 ? shortDay(label) : label}</p>}
      {payload.map((item) => (
        <p key={item.name} className="flex items-center gap-2 text-foreground">
          <span className="size-2.5 rounded-full" style={{ background: item.color }} aria-hidden />
          {item.name} : <strong className="tabular">{item.value}</strong>
        </p>
      ))}
    </div>
  );
}

function TableToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} className="text-xs font-semibold text-primary underline-offset-4 hover:underline" aria-pressed={shown}>
      {shown ? "Voir le graphique" : "Voir en tableau"}
    </button>
  );
}

/** Activité quotidienne : pièces signalées vs pièces restituées. */
export function ActivityChart({ timeline }: { timeline: AdminStats["timeline"] }) {
  const [table, setTable] = useState(false);
  const last = timeline[timeline.length - 1];
  const series = [
    { key: "found", name: "Pièces signalées", color: "var(--chart-1)" },
    { key: "returned", name: "Pièces restituées", color: "var(--chart-2)" },
  ] as const;

  return (
    <figure className="surface bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <figcaption>
          <p className="font-heading text-lg font-bold">Activité des 30 derniers jours</p>
          <p className="text-sm text-muted-foreground">Nombre de pièces par jour</p>
        </figcaption>
        <div className="flex items-center gap-4">
          <ul className="flex flex-wrap gap-3 text-sm" aria-label="Légende">
            {series.map((s) => (
              <li key={s.key} className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 rounded" style={{ background: s.color }} aria-hidden /> {s.name}
              </li>
            ))}
          </ul>
          <TableToggle shown={table} onToggle={() => setTable((v) => !v)} />
        </div>
      </div>

      {table ? (
        <div className="mt-4 max-h-72 overflow-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted-foreground"><th className="py-1">Jour</th><th>Signalées</th><th>Déclarées perdues</th><th>Restituées</th></tr></thead>
            <tbody>
              {timeline.map((d) => (
                <tr key={d.day} className="border-t"><td className="py-1">{shortDay(d.day)}</td><td className="tabular">{d.found}</td><td className="tabular">{d.lost}</td><td className="tabular">{d.returned}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-4 h-72" role="img" aria-label={`Activité : ${last?.found ?? 0} pièces signalées et ${last?.returned ?? 0} restituées aujourd'hui.`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timeline} margin={{ top: 10, right: 90, bottom: 0, left: -18 }}>
              <CartesianGrid stroke={GRID} strokeDasharray="3 4" vertical={false} />
              <XAxis dataKey="day" tickFormatter={shortDay} tick={AXIS} axisLine={false} tickLine={false} minTickGap={28} />
              <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "4 4" }} />
              {series.map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.name}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
                  isAnimationActive={false}
                >
                  {/* Étiquette directe en bout de courbe */}
                  <LabelList
                    dataKey={s.key}
                    content={(props) => {
                      const { x, y, index } = props as { x: number; y: number; index: number };
                      if (index !== timeline.length - 1) return null;
                      return (
                        <text x={x + 8} y={y + 4} fontSize={12} fontWeight={600} fill="var(--foreground)">
                          {s.key === "found" ? "Signalées" : "Restituées"}
                        </text>
                      );
                    }}
                  />
                </Line>
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </figure>
  );
}

/** Barres horizontales à une seule série (pas de légende : le titre la nomme). */
export function RankingChart({ title, subtitle, data }: { title: string; subtitle: string; data: CountByLabel[] }) {
  const [table, setTable] = useState(false);
  const rows = data.slice(0, 8);
  return (
    <figure className="surface bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <figcaption>
          <p className="font-heading text-lg font-bold">{title}</p>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </figcaption>
        <TableToggle shown={table} onToggle={() => setTable((v) => !v)} />
      </div>
      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Pas encore de données.</p>
      ) : table ? (
        <table className="mt-4 w-full text-sm">
          <tbody>
            {rows.map((r) => <tr key={r.key} className="border-t"><td className="py-1.5">{r.label}</td><td className="text-right font-semibold tabular">{r.count}</td></tr>)}
          </tbody>
        </table>
      ) : (
        <div className="mt-4" style={{ height: Math.max(160, rows.length * 38) }} role="img" aria-label={`${title} : ${rows.map((r) => `${r.label} ${r.count}`).join(", ")}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 36, bottom: 0, left: 0 }} barCategoryGap={6}>
              <XAxis type="number" hide allowDecimals={false} />
              <YAxis type="category" dataKey="label" width={120} tick={AXIS} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)" }} />
              <Bar dataKey="count" name="Pièces" fill="var(--chart-1)" radius={[0, 4, 4, 0]} maxBarSize={22}>
                <LabelList dataKey="count" position="right" fontSize={12} fontWeight={600} fill="var(--foreground)" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </figure>
  );
}
