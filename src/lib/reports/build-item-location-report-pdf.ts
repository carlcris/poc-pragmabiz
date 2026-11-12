import { createElement } from "react";
import { pdf } from "@react-pdf/renderer";
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFString,
  rgb,
  StandardFonts,
} from "pdf-lib";
import {
  ITEM_LOCATION_REPORT_PAGE_MARGIN,
  ItemLocationBatchReportPDF,
  type ItemLocationBatchReportPDFProps,
} from "@/components/reports/ItemLocationBatchReportPDF";

const RENDER_BATCH_SIZE = 125;

function firstRowOnLastPage(part: PDFDocument, rowCount: number): number {
  const destinations = part.catalog
    .lookupMaybe(PDFName.of("Names"), PDFDict)
    ?.lookupMaybe(PDFName.of("Dests"), PDFDict)
    ?.lookupMaybe(PDFName.of("Names"), PDFArray);
  if (destinations?.size() !== rowCount * 2) {
    throw new Error("Item location PDF is missing row destinations");
  }

  const lastPage = part.getPage(part.getPageCount() - 1);
  let firstRow = rowCount;
  for (let index = 0; index < destinations.size(); index += 2) {
    if (destinations.lookup(index + 1, PDFArray).get(0) === lastPage.ref) {
      const row = destinations.lookup(index, PDFString, PDFHexString).decodeText();
      firstRow = Math.min(firstRow, Number(row));
    }
  }
  if (!Number.isInteger(firstRow) || firstRow <= 0 || firstRow >= rowCount) {
    throw new Error("Item location PDF could not advance to the next render job");
  }
  return firstRow;
}

// Only imported by the worker (and render tests), never the UI runtime.
export async function buildItemLocationReportPdf(
  props: ItemLocationBatchReportPDFProps
): Promise<Blob> {
  const merged = await PDFDocument.create();
  merged.setTitle(props.title);
  let offset = 0;
  while (true) {
    const end = Math.min(offset + RENDER_BATCH_SIZE, props.rows.length);
    const isLastJob = end === props.rows.length;
    const rows = props.rows.slice(offset, end);
    const blob = await pdf(
      createElement(ItemLocationBatchReportPDF, {
        ...props,
        rows,
        previousRow: props.rows[offset - 1],
        showReportHeader: offset === 0,
        isLastJob,
      })
    ).toBlob();
    const part = await PDFDocument.load(await blob.arrayBuffer());
    const pageIndices = part.getPageIndices();
    if (!isLastJob) {
      // Keep finished pages and start the next job with the provisional last page's rows.
      offset += firstRowOnLastPage(part, rows.length);
      pageIndices.pop();
    }
    const pages = await merged.copyPages(part, pageIndices);
    for (const page of pages) merged.addPage(page);
    if (isLastJob) break;
  }

  // Number the finished pages so the count includes overflow pages and every chunk.
  const pages = merged.getPages();
  const font = await merged.embedFont(StandardFonts.Helvetica);
  const size = 10;
  const color = rgb(0.42, 0.45, 0.5);
  pages.forEach((page, index) => {
    const label = `${index + 1} / ${pages.length}`;
    page.drawText(label, {
      x: page.getWidth() - ITEM_LOCATION_REPORT_PAGE_MARGIN - font.widthOfTextAtSize(label, size),
      y: ITEM_LOCATION_REPORT_PAGE_MARGIN / 2,
      font,
      size,
      color,
    });
  });

  const bytes = await merged.save();
  return new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
}
