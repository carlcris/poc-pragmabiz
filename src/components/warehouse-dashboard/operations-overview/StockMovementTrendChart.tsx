"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import type { StockMovementDay } from "@/types/warehouse-operations-overview";
import { formatQuantity, formatShortDate, parseDashboardDate } from "../dashboard-formatting";
import { OverviewCard } from "./OverviewCard";

type StockMovementTrendChartProps = {
  days: StockMovementDay[];
  rangeDays: number;
  locale: string;
  className?: string;
};

type MovementPoint = { label: string; in: number; out: number };

type TooltipEntry = { dataKey?: unknown; value?: unknown };
type MovementTooltipProps = {
  active?: boolean;
  label?: unknown;
  payload?: ReadonlyArray<TooltipEntry>;
};

const SERIES = [
  { key: "in", color: "var(--chart-stock-in)" },
  { key: "out", color: "var(--chart-stock-out)" },
] as const;

const AXIS_TICK = { fontSize: 11, fill: "hsl(var(--muted-foreground))" };

export const StockMovementTrendChart = ({
  days,
  rangeDays,
  locale,
  className,
}: StockMovementTrendChartProps) => {
  const t = useTranslations("operationsOverview");
  const [showTable, setShowTable] = useState(false);

  const points: MovementPoint[] = days.map((day) => ({
    label: formatShortDate(parseDashboardDate(day.date), locale),
    in: day.in,
    out: day.out,
  }));
  const totals = {
    in: days.reduce((sum, day) => sum + day.in, 0),
    out: days.reduce((sum, day) => sum + day.out, 0),
  };
  const seriesLabels = { in: t("stockIn"), out: t("stockOut") };
  const shortLabels = { in: t("stockInShort"), out: t("stockOutShort") };
  const lastIndex = points.length - 1;
  // Label every Nth day so the axis stays readable at 7, 14 and 30 days.
  const tickInterval = rangeDays === 7 ? 0 : rangeDays === 14 ? 2 : 5;

  const renderEndDot = (
    seriesKey: "in" | "out",
    color: string,
    props: { cx?: number; cy?: number; index?: number }
  ) => {
    const { cx, cy, index } = props;
    if (index !== lastIndex || cx === undefined || cy === undefined) {
      return <g key={`${seriesKey}-${index}`} />;
    }
    const offset = seriesKey === "in" ? -6 : 14;
    const otherKey = seriesKey === "in" ? "out" : "in";
    const crowded = Math.abs(points[lastIndex][seriesKey] - points[lastIndex][otherKey]) < 3;
    return (
      <g key={`${seriesKey}-end`}>
        <circle cx={cx} cy={cy} r={4} fill={color} stroke="hsl(var(--card))" strokeWidth={2} />
        <text
          x={cx + 10}
          y={crowded ? cy + offset : cy + 4}
          fontSize={12}
          fill="hsl(var(--foreground))"
        >
          <tspan fontWeight={600}>{formatQuantity(points[lastIndex][seriesKey], locale)}</tspan>{" "}
          <tspan fill="hsl(var(--muted-foreground))">{shortLabels[seriesKey]}</tspan>
        </text>
      </g>
    );
  };

  const renderTooltip = ({ active, label, payload }: MovementTooltipProps) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="min-w-32 space-y-1 rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
        <p className="text-muted-foreground">{String(label ?? "")}</p>
        {SERIES.map((series) => {
          const entry = payload.find((item) => item.dataKey === series.key);
          return (
            <p key={series.key} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="h-0.5 w-3 rounded-full"
                style={{ background: series.color }}
              />
              <span className="text-sm font-semibold tabular-nums">
                {formatQuantity(Number(entry?.value ?? 0), locale)}
              </span>
              <span className="text-muted-foreground">{seriesLabels[series.key]}</span>
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <OverviewCard
      titleId="stock-movement-trend-title"
      title={t("movementsTitle")}
      subtitle={t("movementsSubtitle", { days: rangeDays })}
      className={className}
      action={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-11 lg:h-8"
          aria-pressed={showTable}
          onClick={() => setShowTable((value) => !value)}
        >
          {showTable ? t("showChart") : t("showTable")}
        </Button>
      }
    >
      <div className="flex flex-wrap gap-x-6 gap-y-1 pb-3">
        {SERIES.map((series) => (
          <span key={series.key} className="flex items-center gap-2 text-sm text-muted-foreground">
            <span
              aria-hidden="true"
              className="h-0.5 w-3.5 rounded-full"
              style={{ background: series.color }}
            />
            {seriesLabels[series.key]}
            <span className="font-semibold text-foreground">
              {formatQuantity(totals[series.key], locale)}
            </span>
          </span>
        ))}
      </div>

      {showTable ? (
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th scope="col" className="py-2 font-medium">
                  {t("dateColumn")}
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  {t("stockIn")}
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  {t("stockOut")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y border-t">
              {[...points].reverse().map((point) => (
                <tr key={point.label}>
                  <td className="py-2">{point.label}</td>
                  <td className="py-2 text-right tabular-nums">
                    {formatQuantity(point.in, locale)}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {formatQuantity(point.out, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          role="img"
          aria-label={t("movementsAria", {
            days: rangeDays,
            inTotal: totals.in,
            outTotal: totals.out,
          })}
          className="h-52"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 56, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
              <XAxis
                dataKey="label"
                interval={tickInterval}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
                tick={AXIS_TICK}
                tickMargin={8}
              />
              <YAxis
                width={32}
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tick={AXIS_TICK}
              />
              <Tooltip
                content={(props) => renderTooltip(props as MovementTooltipProps)}
                cursor={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }}
                isAnimationActive={false}
              />
              {SERIES.map((series) => (
                <Line
                  key={series.key}
                  type="linear"
                  dataKey={series.key}
                  name={seriesLabels[series.key]}
                  stroke={series.color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  dot={(props: { cx?: number; cy?: number; index?: number }) =>
                    renderEndDot(series.key, series.color, props)
                  }
                  activeDot={{ r: 4, stroke: "hsl(var(--card))", strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </OverviewCard>
  );
};
