"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import type { InboundOverview } from "@/types/warehouse-operations-overview";
import { formatQuantity, formatShortDate, parseDashboardDate } from "../dashboard-formatting";
import { OverviewCard } from "./OverviewCard";

type ExpectedArrivalsChartProps = {
  inbound: InboundOverview;
  locale: string;
  className?: string;
};

type ArrivalTooltipProps = {
  active?: boolean;
  label?: unknown;
  payload?: ReadonlyArray<{ value?: unknown }>;
};

const AXIS_TICK = { fontSize: 11, fill: "hsl(var(--muted-foreground))" };

export const ExpectedArrivalsChart = ({
  inbound,
  locale,
  className,
}: ExpectedArrivalsChartProps) => {
  const t = useTranslations("operationsOverview");
  const [showTable, setShowTable] = useState(false);
  const points = inbound.arrivals.map((day) => ({
    label: formatShortDate(parseDashboardDate(day.date), locale),
    count: day.count,
  }));
  const total = points.reduce((sum, point) => sum + point.count, 0);

  const renderTooltip = ({ active, label, payload }: ArrivalTooltipProps) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
        <p className="text-muted-foreground">{String(label ?? "")}</p>
        <p className="flex items-baseline gap-2">
          <span className="text-sm font-semibold tabular-nums">
            {formatQuantity(Number(payload[0]?.value ?? 0), locale)}
          </span>
          <span className="text-muted-foreground">{t("arrivalsColumn")}</span>
        </p>
      </div>
    );
  };

  return (
    <OverviewCard
      titleId="expected-arrivals-title"
      title={t("arrivalsTitle")}
      subtitle={t("arrivalsSubtitle")}
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
      {inbound.overdue > 0 ? (
        <Link
          href="/purchasing/load-lists"
          className="mb-2 inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-red-700 underline-offset-4 hover:underline dark:text-red-400 lg:min-h-8"
        >
          <AlertCircle aria-hidden="true" className="h-4 w-4" />
          {t("overdueCount", { count: inbound.overdue })}
        </Link>
      ) : null}

      {total === 0 && inbound.overdue === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t("noArrivals")}</p>
      ) : showTable ? (
        <div className="max-h-56 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th scope="col" className="py-2 font-medium">
                  {t("dateColumn")}
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  {t("arrivalsColumn")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y border-t">
              {points.map((point) => (
                <tr key={point.label}>
                  <td className="py-2">{point.label}</td>
                  <td className="py-2 text-right tabular-nums">
                    {formatQuantity(point.count, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          role="img"
          aria-label={t("arrivalsAria", { total, overdue: inbound.overdue })}
          className="h-44"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={points} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
              <XAxis
                dataKey="label"
                interval={2}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
                tick={AXIS_TICK}
                tickMargin={8}
              />
              <YAxis
                width={24}
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tick={AXIS_TICK}
              />
              <Tooltip
                content={(props) => renderTooltip(props as ArrivalTooltipProps)}
                cursor={{ fill: "hsl(var(--muted))" }}
                isAnimationActive={false}
              />
              <Bar
                dataKey="count"
                fill="var(--chart-bar)"
                radius={[4, 4, 0, 0]}
                maxBarSize={16}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </OverviewCard>
  );
};
