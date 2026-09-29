"use client";

import { Fragment, useEffect, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCurrency } from "@/hooks/useCurrency";
import {
  componentDescription,
  CUT_UNIT,
  formatLineDiscount,
  showsComponentBreakdown,
  type InvoicePresentableLine,
} from "@/lib/framing/invoicePresenter";
import { frameLineDescription } from "@/lib/framing/description";
import { quotationTotals } from "@/lib/quotations/quotation-totals";
import type { FrameQuotationSize } from "@/types/quotation";

type SalesDocumentLineItem = InvoicePresentableLine & {
  itemCode?: string;
  orderedQuantity?: number;
};

type SalesDocumentLineItemsTableProps<T extends SalesDocumentLineItem> = {
  documentId: string;
  items: T[];
  showFulfilled: boolean;
  productionColumn?: { label: string; render: (item: T) => ReactNode };
};

function getFrameSizes(item: SalesDocumentLineItem): FrameQuotationSize[] {
  if (item.frameSizes && item.frameSizes.length > 0) return item.frameSizes;
  if (!item.frameConfiguration) return [];

  return [
    {
      frameConfiguration: item.frameConfiguration,
      frameComponents: item.frameComponents ?? [],
      matLayers: item.matLayers ?? [],
    },
  ];
}

export function SalesDocumentLineItemsTable<T extends SalesDocumentLineItem>({
  documentId,
  items,
  showFulfilled,
  productionColumn,
}: SalesDocumentLineItemsTableProps<T>) {
  const t = useTranslations("quotationViewDialog");
  const locale = useLocale();
  const { formatCurrency } = useCurrency();
  const [expandedLineId, setExpandedLineId] = useState<string | null>(null);

  useEffect(() => {
    setExpandedLineId(null);
  }, [documentId]);

  const columnCount = 7 + Number(showFulfilled) + Number(Boolean(productionColumn));

  const formatNumber = (value: number | null | undefined) => {
    if (value == null || !Number.isFinite(value)) return "—";
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table className="table-fixed">
        <colgroup>
          <col className="w-12" />
          <col />
          {productionColumn ? <col className="w-36" /> : null}
          <col className="w-24" />
          {showFulfilled ? <col className="w-0 md:w-24" /> : null}
          <col className="w-0 lg:w-28" />
          <col className="w-0 md:w-32" />
          <col className="w-0 lg:w-20" />
          <col className="w-28" />
        </colgroup>
        <TableHeader className="bg-muted/40">
          <TableRow>
            <TableHead className="px-2">
              <span className="sr-only">{t("lineDetails")}</span>
            </TableHead>
            <TableHead>{t("item")}</TableHead>
            {productionColumn ? <TableHead>{productionColumn.label}</TableHead> : null}
            <TableHead className="text-right">{t("quantity")}</TableHead>
            {showFulfilled ? (
              <TableHead className="hidden text-right md:table-cell">{t("fulfilled")}</TableHead>
            ) : null}
            <TableHead className="hidden text-right lg:table-cell">{t("unitPrice")}</TableHead>
            <TableHead className="hidden text-right md:table-cell">{t("discount")}</TableHead>
            <TableHead className="hidden text-right lg:table-cell">{t("tax")}</TableHead>
            <TableHead className="text-right">{t("total")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columnCount} className="py-10 text-center text-muted-foreground">
                {t("noLineItems")}
              </TableCell>
            </TableRow>
          ) : (
            items.map((item, index) => {
              const sizes = getFrameSizes(item);
              const detailSizes = sizes.filter((size) =>
                showsComponentBreakdown(size.frameConfiguration)
              );
              const hasDetails = detailSizes.some((size) => size.frameComponents.length > 0);
              const lineId = item.id || `${documentId}-${index}`;
              const isExpanded = expandedLineId === lineId;
              const unit = item.uomCode || item.uomName || "";
              // Match the document subtotal: expose gross amounts here, then
              // apply component/line discounts and tax in the summary only.
              const amounts = quotationTotals([item]);
              const lineDiscount = formatLineDiscount(
                amounts.totalDiscount,
                amounts.subtotal > 0 ? (amounts.totalDiscount / amounts.subtotal) * 100 : 0,
                formatCurrency
              );
              const description = frameLineDescription(item);

              return (
                <Fragment key={lineId}>
                  <TableRow className={isExpanded ? "bg-muted/20 hover:bg-muted/20" : undefined}>
                    <TableCell className="px-2 py-3">
                      {hasDetails ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setExpandedLineId(isExpanded ? null : lineId)}
                          aria-expanded={isExpanded}
                          aria-label={isExpanded ? t("hideLineDetails") : t("showLineDetails")}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      ) : null}
                    </TableCell>
                    <TableCell className="min-w-48 py-3">
                      <div className="font-medium">{item.itemName || item.description || "—"}</div>
                      {item.itemCode ? (
                        <div className="text-xs text-muted-foreground">{item.itemCode}</div>
                      ) : null}
                      {item.itemName && description ? (
                        <div className="mt-1 max-w-md text-xs text-muted-foreground">
                          {description}
                        </div>
                      ) : null}
                    </TableCell>
                    {productionColumn ? (
                      <TableCell className="py-3">{productionColumn.render(item)}</TableCell>
                    ) : null}
                    <TableCell className="whitespace-nowrap py-3 text-right">
                      {formatNumber(item.quantity)} {unit}
                    </TableCell>
                    {showFulfilled ? (
                      <TableCell className="hidden whitespace-nowrap py-3 text-right md:table-cell">
                        {formatNumber(item.orderedQuantity ?? 0)} {unit}
                      </TableCell>
                    ) : null}
                    <TableCell className="hidden whitespace-nowrap py-3 text-right lg:table-cell">
                      {sizes.length > 0 ? "—" : formatCurrency(item.unitPrice)}
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap py-3 text-right md:table-cell">
                      {lineDiscount || "—"}
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap py-3 text-right lg:table-cell">
                      {item.taxRate ? `${formatNumber(item.taxRate)}%` : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap py-3 text-right font-semibold">
                      {formatCurrency(amounts.subtotal)}
                    </TableCell>
                  </TableRow>

                  {isExpanded ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={columnCount} className="bg-muted/10 p-0">
                        <div className="border-t p-4">
                          <div className="overflow-hidden rounded-md border bg-background">
                            <Table className="min-w-max">
                              <TableHeader className="bg-muted/40">
                                <TableRow>
                                  <TableHead className="text-right">{t("qty")}</TableHead>
                                  <TableHead className="text-center">{t("unit")}</TableHead>
                                  <TableHead>{t("descriptionColumn")}</TableHead>
                                  <TableHead className="text-right">{t("unitPrice")}</TableHead>
                                  <TableHead className="text-right">{t("discountRate")}</TableHead>
                                  <TableHead className="text-right">{t("amount")}</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {detailSizes.flatMap((size, sizeIndex) =>
                                  size.frameComponents.map((component, componentIndex) => (
                                    <TableRow
                                      key={
                                        component.id ||
                                        `${lineId}-${sizeIndex}-${component.itemId}-${componentIndex}`
                                      }
                                    >
                                      <TableCell className="text-right">
                                        {formatNumber(component.totalQuantity)}
                                      </TableCell>
                                      <TableCell className="text-center">
                                        {component.uomCode || CUT_UNIT}
                                      </TableCell>
                                      <TableCell className="min-w-80">
                                        {componentDescription(component)}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {formatCurrency(component.unitRate)}
                                      </TableCell>
                                      <TableCell className="whitespace-nowrap text-right">
                                        {formatLineDiscount(
                                          component.discountAmount ?? 0,
                                          component.discountPercent ?? 0,
                                          formatCurrency
                                        ) || "—"}
                                      </TableCell>
                                      <TableCell className="text-right font-medium">
                                        {formatCurrency(
                                          component.totalAmount + (component.discountAmount ?? 0)
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  ))
                                )}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
