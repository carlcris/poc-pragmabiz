import { createElement } from "react";
import { pdf } from "@react-pdf/renderer";
import {
  ITEM_LOCATION_REPORT_PAGE_MARGIN,
  ItemLocationBatchReportPDF,
  type ItemLocationBatchReportPDFProps,
} from "@/components/reports/ItemLocationBatchReportPDF";
import { buildContinuousReportPdf } from "./build-continuous-report-pdf";

// Only imported by the worker (and render tests), never the UI runtime.
export async function buildItemLocationReportPdf(
  props: ItemLocationBatchReportPDFProps
): Promise<Blob> {
  return buildContinuousReportPdf({
    title: props.title,
    rows: props.rows,
    pageMargin: ITEM_LOCATION_REPORT_PAGE_MARGIN,
    renderJob: (job) =>
      pdf(createElement(ItemLocationBatchReportPDF, { ...props, ...job })).toBlob(),
  });
}
