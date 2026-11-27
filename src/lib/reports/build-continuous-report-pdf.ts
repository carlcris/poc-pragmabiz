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

const RENDER_BATCH_SIZE = 125;

type ReportPdfJob<Row> = {
  rows: Row[];
  previousRow: Row | undefined;
  showReportHeader: boolean;
  isLastJob: boolean;
};

function firstRowOnLastPage(part: PDFDocument, rowCount: number): number {
  const destinations = part.catalog
    .lookupMaybe(PDFName.of("Names"), PDFDict)
    ?.lookupMaybe(PDFName.of("Dests"), PDFDict)
    ?.lookupMaybe(PDFName.of("Names"), PDFArray);
  if (destinations?.size() !== rowCount * 2) {
    throw new Error("Report PDF is missing row destinations");
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
    throw new Error("Report PDF could not advance to the next render job");
  }
  return firstRow;
}

export async function buildContinuousReportPdf<Row>({
  title,
  rows,
  pageMargin,
  renderJob,
}: {
  title: string;
  rows: Row[];
  pageMargin: number;
  renderJob: (job: ReportPdfJob<Row>) => Promise<Blob>;
}): Promise<Blob> {
  const merged = await PDFDocument.create();
  merged.setTitle(title);
  let offset = 0;
  while (true) {
    const end = Math.min(offset + RENDER_BATCH_SIZE, rows.length);
    const isLastJob = end === rows.length;
    const window = rows.slice(offset, end);
    const blob = await renderJob({
      rows: window,
      previousRow: rows[offset - 1],
      showReportHeader: offset === 0,
      isLastJob,
    });
    const part = await PDFDocument.load(await blob.arrayBuffer());
    const pageIndices = part.getPageIndices();
    if (!isLastJob) {
      // Keep finished pages and start the next job with the provisional last page's rows.
      offset += firstRowOnLastPage(part, window.length);
      pageIndices.pop();
    }
    const pages = await merged.copyPages(part, pageIndices);
    for (const page of pages) merged.addPage(page);
    if (isLastJob) break;
  }

  // Number the assembled document after all automatic page breaks.
  const pages = merged.getPages();
  const font = await merged.embedFont(StandardFonts.Helvetica);
  const size = 10;
  const color = rgb(0.42, 0.45, 0.5);
  pages.forEach((page, index) => {
    const label = `${index + 1} / ${pages.length}`;
    page.drawText(label, {
      x: page.getWidth() - pageMargin - font.widthOfTextAtSize(label, size),
      y: pageMargin / 2,
      font,
      size,
      color,
    });
  });

  const bytes = await merged.save();
  return new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
}
