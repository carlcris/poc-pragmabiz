"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";

import { FrameJobOrderRequisitionView } from "@/components/frame-job-orders/FrameJobOrderRequisitionView";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { FrameJobOrderRequisitionResponse } from "@/lib/frame-job-orders/requisition";

export type ProductionJobOrderPreview = {
  id: string;
  code: string;
};

type ProductionJobOrderDialogProps = {
  jobOrder: ProductionJobOrderPreview | null;
  onClose: () => void;
};

const fetchJobOrderRequisition = async (
  jobOrderId: string
): Promise<FrameJobOrderRequisitionResponse> => {
  const response = await fetch(`/api/frame-job-orders/${jobOrderId}/requisition`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("FAILED_TO_LOAD_JOB_REQUISITION");
  }

  return response.json() as Promise<FrameJobOrderRequisitionResponse>;
};

export function ProductionJobOrderDialog({ jobOrder, onClose }: ProductionJobOrderDialogProps) {
  const t = useTranslations("manufacturingFloorPage");
  const jobOrderId = jobOrder?.id || "";
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["frame-job-order", jobOrderId, "requisition"],
    queryFn: () => fetchJobOrderRequisition(jobOrderId),
    enabled: Boolean(jobOrderId),
  });

  return (
    <Dialog
      open={Boolean(jobOrder)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="flex max-h-screen max-w-6xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b p-6 pr-12">
          <DialogTitle>{jobOrder?.code || t("jobOrder")}</DialogTitle>
          <DialogDescription>{t("jobOrderPreviewDescription")}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-96 w-full" />
            </div>
          ) : error ? (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
              <AlertTriangle className="mb-3 h-10 w-10 text-destructive" />
              <p className="font-semibold text-destructive">{t("jobOrderLoadError")}</p>
              <Button className="mt-4" variant="outline" onClick={() => void refetch()}>
                {t("retryJobOrder")}
              </Button>
            </div>
          ) : data ? (
            <FrameJobOrderRequisitionView
              requisition={data.data}
              showDocumentActions={false}
              showPaperFooter={false}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
