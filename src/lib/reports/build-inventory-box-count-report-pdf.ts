import { createElement } from "react";
import { pdf } from "@react-pdf/renderer";
import {
  INVENTORY_BOX_COUNT_PAGE_MARGIN,
  InventoryBoxCountReportPDF,
  type InventoryBoxCountReportPDFProps,
} from "@/components/reports/InventoryBoxCountReportPDF";
import { buildContinuousReportPdf } from "./build-continuous-report-pdf";

export function buildInventoryBoxCountReportPdf(
  props: InventoryBoxCountReportPDFProps
): Promise<Blob> {
  return buildContinuousReportPdf({
    title: props.title,
    rows: props.rows,
    pageMargin: INVENTORY_BOX_COUNT_PAGE_MARGIN,
    renderJob: ({ rows, showReportHeader, isLastJob }) =>
      pdf(
        createElement(InventoryBoxCountReportPDF, {
          ...props,
          rows,
          showReportHeader,
          isLastJob,
        })
      ).toBlob(),
  });
}
