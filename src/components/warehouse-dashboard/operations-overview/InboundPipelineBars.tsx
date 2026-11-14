"use client";

import { useTranslations } from "next-intl";
import type { InboundOverview, InboundPipelineStatus } from "@/types/warehouse-operations-overview";
import { formatQuantity } from "../dashboard-formatting";
import { OverviewCard } from "./OverviewCard";

type InboundPipelineBarsProps = {
  inbound: InboundOverview;
  locale: string;
  className?: string;
};

const STAGES: InboundPipelineStatus[] = [
  "confirmed",
  "in_transit",
  "arrived",
  "receiving",
  "pending_approval",
];

export const InboundPipelineBars = ({ inbound, locale, className }: InboundPipelineBarsProps) => {
  const t = useTranslations("operationsOverview");
  const stageLabels: Record<InboundPipelineStatus, string> = {
    confirmed: t("stage_confirmed"),
    in_transit: t("stage_in_transit"),
    arrived: t("stage_arrived"),
    receiving: t("stage_receiving"),
    pending_approval: t("stage_pending_approval"),
  };
  const counts = STAGES.map((stage) => inbound.pipeline[stage]);
  const total = counts.reduce((sum, count) => sum + count, 0);
  const max = Math.max(1, ...counts);

  return (
    <OverviewCard
      titleId="inbound-pipeline-title"
      title={t("pipelineTitle")}
      subtitle={t("pipelineSubtitle", { total })}
      className={className}
    >
      {total === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t("noInbound")}</p>
      ) : (
        <ul className="flex flex-col gap-3 pt-1">
          {STAGES.map((stage) => {
            const count = inbound.pipeline[stage];
            return (
              <li key={stage} className="flex flex-col gap-1">
                <span className="text-sm text-muted-foreground">{stageLabels[stage]}</span>
                <span className="flex items-center gap-2">
                  <span className="flex h-5 flex-1 items-center">
                    {count > 0 ? (
                      <span
                        className="h-full rounded-r"
                        style={{ width: `${(count / max) * 100}%`, background: "var(--chart-bar)" }}
                      />
                    ) : null}
                  </span>
                  <span className="w-8 text-right text-sm font-semibold tabular-nums">
                    {formatQuantity(count, locale)}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </OverviewCard>
  );
};
