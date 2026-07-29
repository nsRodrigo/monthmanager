import { useId } from "react";
import { AreaChart, Area, CartesianGrid, ResponsiveContainer } from "recharts";

/** Sparkline de tendência com área preenchida e ponto final em destaque. */
export function Sparkline({ points, className = "" }: { points: number[]; className?: string }) {
  const gradientId = useId();
  const data = points.map((value, i) => ({ i, value }));
  const lastIndex = data.length - 1;
  return (
    <div className={`h-11 w-full ${className}`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 3, bottom: 2, left: 3 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--color-border)" strokeOpacity={0.5} />
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--color-primary)"
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
            dot={({ cx, cy, index }: { cx?: number; cy?: number; index?: number }) =>
              index === lastIndex ? (
                <circle key="trend-end" cx={cx} cy={cy} r={3.5} fill="var(--color-primary)" />
              ) : (
                <circle key={`trend-${index}`} cx={cx} cy={cy} r={0} />
              )
            }
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
