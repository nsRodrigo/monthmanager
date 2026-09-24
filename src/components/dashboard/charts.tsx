import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/format";

/**
 * Gráficos do painel. Cores vêm dos tokens `--series-*` (entrada / fatura /
 * débito / investimento — ordem e significado fixos, validados no escuro) e
 * texto/grade dos tokens do tema, então acompanham qualquer tema.
 */

/** Eixo: "8k" em vez de "8 mil" — cabe numa linha só na coluna estreita do eixo. */
const axisMoney = (v: number) =>
  Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k` : String(Math.round(v));

const TICK = { fill: "var(--color-muted-foreground)", fontSize: 11.5 } as const;
const GRID = { stroke: "var(--color-border)", strokeOpacity: 0.7, vertical: false } as const;

export type TipRow = { color: string; label: string; value: string; strong?: boolean };

/** Caixa de tooltip: valor em destaque, nome do item em cinza (valores primeiro). */
export function TipBox({ title, rows }: { title: ReactNode; rows: TipRow[] }) {
  return (
    <div className="min-w-36 rounded-xl border border-border bg-popover/95 px-3 py-2 text-xs shadow-elevated backdrop-blur">
      <p className="mb-1 text-[11px] text-muted-foreground">{title}</p>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-4 leading-6">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <i className="inline-block h-[3px] w-2.5 rounded-full" style={{ background: r.color }} />
            {r.label}
          </span>
          <b className={`tabular-nums ${r.strong ? "text-foreground" : "font-semibold"}`}>{r.value}</b>
        </div>
      ))}
    </div>
  );
}

/* ───────── saldo: realizado + projeção ───────── */

export type TrendPoint = { label: string; full: string; value: number };

export function BalanceTrendChart({
  points,
  currentIndex,
  height = 250,
}: {
  points: TrendPoint[];
  currentIndex: number;
  height?: number;
}) {
  const data = points.map((p, i) => ({
    ...p,
    real: i <= currentIndex ? p.value : null,
    proj: i >= currentIndex ? p.value : null,
  }));
  const cur = points[currentIndex];
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 28, right: 18, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="label" tick={TICK} tickLine={false} axisLine={false} interval={0} />
          <YAxis
            width={44}
            tick={TICK}
            tickLine={false}
            axisLine={false}
            tickFormatter={axisMoney}
            domain={[(min: number) => Math.min(0, min), "auto"]}
          />
          <Tooltip
            cursor={{ stroke: "var(--color-muted-foreground)", strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as (typeof data)[number];
              const idx = data.findIndex((d) => d.label === p.label);
              return (
                <TipBox
                  title={`${p.full}${idx > currentIndex ? " · projeção" : ""}`}
                  rows={[{ color: "var(--color-primary)", label: "Saldo", value: formatCurrency(p.value), strong: true }]}
                />
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="real"
            stroke="var(--color-primary)"
            strokeWidth={2.4}
            fill="url(#trend-fill)"
            isAnimationActive={false}
            dot={false}
            activeDot={{ r: 5, stroke: "var(--color-card)", strokeWidth: 2.5, fill: "var(--color-primary)" }}
          />
          <Area
            type="monotone"
            dataKey="proj"
            stroke="var(--color-primary)"
            strokeWidth={2.4}
            strokeDasharray="2 6"
            strokeLinecap="round"
            fill="none"
            isAnimationActive={false}
            dot={false}
            activeDot={{ r: 5, stroke: "var(--color-card)", strokeWidth: 2.5, fill: "var(--color-primary)" }}
          />
          {cur && (
            <ReferenceDot
              x={cur.label}
              y={cur.value}
              r={5}
              fill="var(--color-primary)"
              stroke="var(--color-card)"
              strokeWidth={2.5}
              ifOverflow="visible"
              label={{
                value: formatCurrency(cur.value),
                position: "top",
                fill: "var(--color-foreground)",
                fontSize: 12,
                fontWeight: 600,
              }}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ───────── entradas × saídas por mês ───────── */

export type FlowPoint = {
  label: string;
  full: string;
  income: number;
  debit: number;
  credit: number;
  invest: number;
};

export function FlowChart({ data, height = 250 }: { data: FlowPoint[]; height?: number }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="label" tick={TICK} tickLine={false} axisLine={false} />
          <YAxis
            width={44}
            tick={TICK}
            tickLine={false}
            axisLine={false}
            tickFormatter={axisMoney}
          />
          <Tooltip
            cursor={{ fill: "var(--color-muted)", opacity: 0.6, radius: 8 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as FlowPoint;
              const out = d.debit + d.credit + d.invest;
              const bal = d.income - out;
              return (
                <TipBox
                  title={d.full}
                  rows={[
                    { color: "var(--series-income)", label: "Recebíveis", value: formatCurrency(d.income) },
                    { color: "var(--series-debit)", label: "Débitos", value: formatCurrency(d.debit) },
                    { color: "var(--series-credit)", label: "Faturas", value: formatCurrency(d.credit) },
                    { color: "var(--series-invest)", label: "Investimentos", value: formatCurrency(d.invest) },
                    {
                      color: bal >= 0 ? "var(--color-success)" : "var(--color-destructive)",
                      label: "Saldo do mês",
                      value: formatCurrency(bal),
                      strong: true,
                    },
                  ]}
                />
              );
            }}
          />
          {/* 2px de "respiro" entre segmentos = traço na cor da superfície. */}
          <Bar dataKey="debit" stackId="out" fill="var(--series-debit)" stroke="var(--color-card)" strokeWidth={2} barSize={34} isAnimationActive={false} />
          <Bar dataKey="credit" stackId="out" fill="var(--series-credit)" stroke="var(--color-card)" strokeWidth={2} barSize={34} isAnimationActive={false} />
          <Bar dataKey="invest" stackId="out" fill="var(--series-invest)" stroke="var(--color-card)" strokeWidth={2} barSize={34} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          <Line
            type="linear"
            dataKey="income"
            stroke="var(--series-income)"
            strokeWidth={2.4}
            isAnimationActive={false}
            dot={{ r: 4.5, fill: "var(--series-income)", stroke: "var(--color-card)", strokeWidth: 2 }}
            activeDot={{ r: 5.5, fill: "var(--series-income)", stroke: "var(--color-card)", strokeWidth: 2 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ───────── composição das saídas ───────── */

export type DonutSlice = { name: string; value: number; color: string };

export function SpendDonut({ data, size = 168 }: { data: DonutSlice[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as DonutSlice;
              return (
                <TipBox
                  title={d.name}
                  rows={[
                    {
                      color: d.color,
                      label: total > 0 ? `${Math.round((d.value / total) * 100)}% das saídas` : "",
                      value: formatCurrency(d.value),
                      strong: true,
                    },
                  ]}
                />
              );
            }}
          />
          <Pie
            data={total > 0 ? data : [{ name: "Sem saídas", value: 1, color: "var(--color-border)" }]}
            dataKey="value"
            nameKey="name"
            innerRadius="72%"
            outerRadius="100%"
            paddingAngle={total > 0 ? 3 : 0}
            stroke="none"
            startAngle={90}
            endAngle={-270}
            isAnimationActive={false}
          >
            {(total > 0 ? data : [{ color: "var(--color-border)" }]).map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Saídas</span>
        <span className="font-display text-base font-semibold tabular-nums">{formatCurrency(total)}</span>
      </div>
    </div>
  );
}
