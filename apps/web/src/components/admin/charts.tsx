'use client';

import { useEffect, useId, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowDownRight, ArrowUpRight, Minus, Table2, LineChart as LineChartIcon } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { cn } from '@/lib/cn';
import type { DailyPoint } from '@/lib/api/admin-dashboard';
import { delta, fmt } from './format';

// ── Theme colors ─────────────────────────────────────────────────────────────
// Recharts writes colors as SVG attributes, so resolve the design tokens to values
// and re-read them when the theme changes (toggle or OS preference).
const COLOR_VARS = { chart1: '--color-chart1', chart2: '--color-chart2', grid: '--color-chart-grid', axis: '--color-fg-subtle', surface: '--color-surface' } as const;
type ChartColors = Record<keyof typeof COLOR_VARS, string>;
const FALLBACK: ChartColors = { chart1: '#2a78d6', chart2: '#eb6834', grid: '#e2e8f0', axis: '#64748b', surface: '#ffffff' };

export function useChartColors(): ChartColors {
  const [colors, setColors] = useState<ChartColors>(FALLBACK);
  useEffect(() => {
    const read = () => {
      const css = getComputedStyle(document.documentElement);
      setColors(
        Object.fromEntries(
          Object.entries(COLOR_VARS).map(([k, v]) => [k, css.getPropertyValue(v).trim() || FALLBACK[k as keyof ChartColors]]),
        ) as ChartColors,
      );
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', read);
    return () => {
      observer.disconnect();
      media.removeEventListener('change', read);
    };
  }, []);
  return colors;
}

// ── Sparkline ────────────────────────────────────────────────────────────────
/**
 * 30-day trend for a stat tile: history in a recessive ink, the current 7 days in the
 * accent, an end dot with a surface ring. Decorative (the tile states the numbers).
 */
export function Sparkline({ series, highlightLast = 7 }: { series: DailyPoint[]; highlightLast?: number }) {
  const w = 120;
  const h = 32;
  const pad = 4;
  if (series.length < 2) return null;
  const max = Math.max(1, ...series.map((p) => p.count));
  const x = (i: number) => pad + (i / (series.length - 1)) * (w - pad * 2);
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2);
  const path = (points: DailyPoint[], offset: number) =>
    points.map((p, i) => `${i ? 'L' : 'M'}${x(i + offset).toFixed(1)},${y(p.count).toFixed(1)}`).join(' ');
  const split = series.length - highlightLast;
  const last = series[series.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-[120px]" aria-hidden style={{ direction: "ltr" }}>
      <path d={path(series.slice(0, split + 1), 0)} fill="none" style={{ stroke: 'var(--color-line-strong)' }} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <path d={path(series.slice(split), split)} fill="none" style={{ stroke: 'var(--color-chart1)' }} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(series.length - 1)} cy={y(last.count)} r={4} style={{ fill: 'var(--color-chart1)', stroke: 'var(--color-surface)' }} strokeWidth={2} />
    </svg>
  );
}

// ── Stat tile ────────────────────────────────────────────────────────────────
interface StatTileProps {
  label: string;
  value: number;
  /** Previous-period value for the delta (same length period). */
  previous?: number;
  /** For reports, fewer is better. */
  upIsGood?: boolean;
  periodLabel?: string;
  trend?: DailyPoint[];
  footnote?: ReactNode;
  href?: string;
  tone?: 'default' | 'attention';
}

export function StatTile({ label, value, previous, upIsGood = true, periodLabel = 'عن الأيام السبعة السابقة', trend, footnote, href, tone = 'default' }: StatTileProps) {
  const d = previous === undefined ? null : delta(value, previous);
  const good = d && d.direction !== 'flat' ? (d.direction === 'up') === upIsGood : null;
  const Icon = !d || d.direction === 'flat' ? Minus : d.direction === 'up' ? ArrowUpRight : ArrowDownRight;

  const body = (
    <>
      <p className="text-sm font-medium text-fg-muted">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="text-3xl font-semibold text-fg">{fmt.compact(value)}</p>
        {trend && <Sparkline series={trend} />}
      </div>
      {d && (
        <p className="mt-2 flex flex-wrap items-center gap-1 text-sm text-fg-muted">
          <span
            className={cn(
              'inline-flex items-center gap-0.5 font-semibold',
              good === null ? 'text-fg-muted' : good ? 'text-success' : 'text-danger',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {d.ratio === null ? 'جديد' : d.direction === 'flat' ? 'دون تغيير' : `${d.direction === 'up' ? '+' : '−'}${fmt.percent(Math.abs(d.ratio))}`}
          </span>
          <span>{periodLabel}</span>
          <span className="sr-only">({fmt.int(previous!)} في الفترة السابقة)</span>
        </p>
      )}
      {footnote && <p className="mt-2 text-sm text-fg-muted">{footnote}</p>}
    </>
  );

  const className = cn(
    'block rounded-card border bg-surface p-5',
    tone === 'attention' ? 'border-warning' : 'border-line',
    href && 'transition-colors hover:border-line-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
  );
  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

// ── Chart card with table view ───────────────────────────────────────────────
export function ChartCard({
  title,
  subtitle,
  table,
  children,
}: {
  title: string;
  subtitle?: string;
  /** The same numbers as a table: reachable without hover, for screen readers and low-contrast hues. */
  table: ReactNode;
  children: ReactNode;
}) {
  const [asTable, setAsTable] = useState(false);
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="rounded-card border border-line bg-surface p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 id={headingId} className="font-semibold text-fg">{title}</h2>
          {subtitle && <p className="text-sm text-fg-muted">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={() => setAsTable((v) => !v)}
          aria-pressed={asTable}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-control px-3 text-sm text-fg-muted hover:bg-surface-muted hover:text-fg"
        >
          {asTable ? <LineChartIcon className="h-4 w-4" aria-hidden /> : <Table2 className="h-4 w-4" aria-hidden />}
          {asTable ? 'عرض كرسم' : 'عرض كجدول'}
        </button>
      </div>
      {asTable ? <div className="max-h-80 overflow-auto">{table}</div> : children}
    </section>
  );
}

// ── Daily trend (≤ 3 series, one axis) ───────────────────────────────────────
export interface TrendSeries {
  key: string;
  label: string;
  color: 'chart1' | 'chart2';
  data: DailyPoint[];
}

export function TrendChart({ series }: { series: TrendSeries[] }) {
  const colors = useChartColors();
  const days = series[0]?.data.map((p) => p.day) ?? [];
  const rows = days.map((day, i) => ({ day, ...Object.fromEntries(series.map((s) => [s.key, s.data[i]?.count ?? 0])) }));
  const lastIndex = rows.length - 1;

  return (
    <div>
      {/* Legend: always present for ≥ 2 series; line keys mirror the marks. */}
      <ul className="mb-3 flex flex-wrap gap-4 text-sm text-fg-muted">
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <span className="h-0.5 w-4 rounded-pill" style={{ background: colors[s.color] }} aria-hidden />
            {s.label}
            <span className="font-semibold text-fg">{fmt.int(s.data.reduce((t, p) => t + p.count, 0))}</span>
          </li>
        ))}
      </ul>
      <div dir="ltr" className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 36, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={colors.grid} strokeWidth={1} />
            <XAxis
              dataKey="day"
              tickFormatter={fmt.day}
              interval="preserveStartEnd"
              minTickGap={40}
              tick={{ fill: colors.axis, fontSize: 12 }}
              axisLine={{ stroke: colors.grid }}
              tickLine={false}
            />
            <YAxis allowDecimals={false} width={36} tickFormatter={fmt.int} tick={{ fill: colors.axis, fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ stroke: colors.axis, strokeWidth: 1 }}
              isAnimationActive={false}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <div dir="rtl" className="rounded-control border border-line bg-surface px-3 py-2 text-sm shadow-md">
                    <p className="mb-1 text-fg-muted">{fmt.fullDay(String(label))}</p>
                    {series.map((s) => (
                      <p key={s.key} className="flex items-center gap-2">
                        <span className="h-0.5 w-3 rounded-pill" style={{ background: colors[s.color] }} aria-hidden />
                        <span className="font-semibold text-fg">{fmt.int(Number(payload.find((p) => p.dataKey === s.key)?.value ?? 0))}</span>
                        <span className="text-fg-muted">{s.label}</span>
                      </p>
                    ))}
                  </div>
                ) : null
              }
            />
            {series.map((s) => (
              <Line
                key={s.key}
                dataKey={s.key}
                name={s.label}
                type="monotone"
                stroke={colors[s.color]}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                isAnimationActive={false}
                activeDot={{ r: 5, stroke: colors.surface, strokeWidth: 2 }}
                // Direct label on the last point only: the endpoint is the story.
                dot={(props: { cx?: number; cy?: number; index?: number; value?: number }) =>
                  props.index === lastIndex && props.cx != null && props.cy != null ? (
                    <g key={`end-${s.key}`}>
                      <circle cx={props.cx} cy={props.cy} r={4} fill={colors[s.color]} stroke={colors.surface} strokeWidth={2} />
                      <text x={props.cx + 8} y={props.cy + 4} fontSize={12} fill={colors.axis}>
                        {fmt.int(Number(props.value ?? 0))}
                      </text>
                    </g>
                  ) : (
                    <g key={`dot-${s.key}-${props.index}`} />
                  )
                }
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function TrendTable({ series }: { series: TrendSeries[] }) {
  const days = series[0]?.data.map((p) => p.day) ?? [];
  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 bg-surface text-fg-muted">
        <tr>
          <th scope="col" className="py-2 text-start font-medium">اليوم</th>
          {series.map((s) => (
            <th key={s.key} scope="col" className="py-2 text-end font-medium">{s.label}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-line tabular-nums">
        {[...days].reverse().map((day) => (
          <tr key={day}>
            <th scope="row" className="py-1.5 text-start font-normal text-fg-muted">{fmt.fullDay(day)}</th>
            {series.map((s) => (
              <td key={s.key} className="py-1.5 text-end text-fg">{fmt.int(s.data.find((p) => p.day === day)?.count ?? 0)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Ranked bars (single series) ──────────────────────────────────────────────
/**
 * Horizontal bars in HTML: they grow from the reading start (right in RTL), carry the
 * value at the tip, and show the share on hover/focus. One series, so no legend.
 */
export function BarList({ items, valueLabel }: { items: Array<{ id: string; label: string; value: number; href?: string }>; valueLabel: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const total = items.reduce((t, i) => t + i.value, 0);
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => {
        const share = total ? item.value / total : 0;
        const bar = (
          <span className="group relative flex items-center gap-3 rounded-control py-1 focus-within:outline-none">
            <span className="w-28 shrink-0 truncate text-sm text-fg">{item.label}</span>
            <span className="flex flex-1 items-center gap-2">
              <span
                className="h-3 max-h-6 rounded-e-[4px] bg-chart1 transition-opacity group-hover:opacity-80"
                style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }}
                aria-hidden
              />
              <span className="shrink-0 text-sm font-semibold text-fg tabular-nums">{fmt.int(item.value)}</span>
            </span>
            <span
              role="tooltip"
              className="pointer-events-none absolute -top-8 start-28 z-10 hidden whitespace-nowrap rounded-control border border-line bg-surface px-2 py-1 text-xs text-fg shadow-md group-hover:block group-focus-within:block"
            >
              <span className="font-semibold">{fmt.percent(share)}</span> من {valueLabel} في هذه القائمة
            </span>
          </span>
        );
        return (
          <li key={item.id}>
            {item.href ? (
              <Link href={item.href} className="block rounded-control focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring">
                {bar}
              </Link>
            ) : (
              <span tabIndex={0} className="block rounded-control focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring">
                {bar}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
