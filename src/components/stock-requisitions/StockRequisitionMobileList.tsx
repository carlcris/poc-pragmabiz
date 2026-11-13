"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { MoreVertical, Pencil, Printer, Send, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import type { StockRequisition, StockRequisitionStatus } from "@/types/stock-requisition";

type StockRequisitionMobileListProps = {
  stockRequisitions: StockRequisition[];
  canViewTotalAmount: boolean;
  printingId: string | null;
  renderStatus: (status: StockRequisitionStatus) => ReactNode;
  formatDate: (value?: string | null) => string;
  formatAmount: (amount: number | null, currencyCode?: string | null) => string;
  canCancel: (stockRequisition: StockRequisition) => boolean;
  onEdit: (stockRequisition: StockRequisition) => void;
  onSend: (stockRequisition: StockRequisition) => void;
  onPrint: (stockRequisition: StockRequisition) => void;
  onCancel: (stockRequisition: StockRequisition) => void;
  onDelete: (stockRequisition: StockRequisition) => void;
};

/**
 * Phone layout of the stock requisitions list: one stacked row per requisition instead of
 * the 800px table. Every row action, including Send on drafts, lives in the row menu.
 */
export function StockRequisitionMobileList({
  stockRequisitions,
  canViewTotalAmount,
  printingId,
  renderStatus,
  formatDate,
  formatAmount,
  canCancel,
  onEdit,
  onSend,
  onPrint,
  onCancel,
  onDelete,
}: StockRequisitionMobileListProps) {
  const t = useTranslations("stockRequisitionsPage");

  return (
    <ul className="border-t">
      {stockRequisitions.map((sr) => {
        const isDraft = sr.status === "draft";

        return (
          <li key={sr.id} className="flex flex-col gap-2.5 border-b py-3">
            <div className="flex items-start gap-2">
              <Link
                href={`/purchasing/stock-requisitions/${sr.id}`}
                className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span className="font-semibold tabular-nums">{sr.srNumber}</span>
                  {renderStatus(sr.status)}
                </span>
                <span className="truncate text-sm">{sr.supplier?.name ?? t("noValue")}</span>
                <span className="text-xs text-muted-foreground">
                  {[sr.supplier?.code, sr.businessUnit?.code].filter(Boolean).join(" · ")}
                </span>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="-mr-2.5 h-11 w-11 shrink-0 p-0"
                    aria-label={t("moreActions")}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  {isDraft ? (
                    <>
                      <DropdownMenuItem className="min-h-11" onClick={() => onSend(sr)}>
                        <Send className="h-4 w-4" />
                        <span>{t("send")}</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem className="min-h-11" onClick={() => onEdit(sr)}>
                        <Pencil className="h-4 w-4" />
                        <span>{t("edit")}</span>
                      </DropdownMenuItem>
                    </>
                  ) : null}
                  <DropdownMenuItem
                    className="min-h-11"
                    onClick={() => onPrint(sr)}
                    disabled={printingId === sr.id}
                  >
                    <Printer className="h-4 w-4" />
                    <span>{t("print")}</span>
                  </DropdownMenuItem>
                  {canCancel(sr) ? (
                    <DropdownMenuItem
                      className="min-h-11 text-destructive focus:text-destructive"
                      onClick={() => onCancel(sr)}
                    >
                      <XCircle className="h-4 w-4" />
                      <span>{t("cancel")}</span>
                    </DropdownMenuItem>
                  ) : null}
                  {isDraft ? (
                    <DropdownMenuItem
                      className="min-h-11 text-destructive focus:text-destructive"
                      onClick={() => onDelete(sr)}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>{t("delete")}</span>
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <dl className={`grid gap-2 ${canViewTotalAmount ? "grid-cols-3" : "grid-cols-2"}`}>
              <div className="flex flex-col">
                <dt className="text-xs text-muted-foreground">{t("requisitionDate")}</dt>
                <dd className="text-sm">{formatDate(sr.requisitionDate)}</dd>
              </div>
              <div className="flex flex-col">
                <dt className="text-xs text-muted-foreground">{t("requiredBy")}</dt>
                <dd className="text-sm">{formatDate(sr.requiredByDate)}</dd>
              </div>
              {canViewTotalAmount ? (
                <div className="flex flex-col text-right">
                  <dt className="text-xs text-muted-foreground">{t("totalAmount")}</dt>
                  <dd className="text-sm font-semibold tabular-nums">
                    {formatAmount(sr.totalAmount, sr.currency)}
                  </dd>
                </div>
              ) : null}
            </dl>
          </li>
        );
      })}
    </ul>
  );
}

export function StockRequisitionMobileListSkeleton({ rows }: { rows: number }) {
  return (
    <ul className="border-t" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} className="flex flex-col gap-2.5 border-b py-3">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-9 w-full" />
        </li>
      ))}
    </ul>
  );
}
