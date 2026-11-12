import { beforeEach, expect, it, vi } from "vitest";
import { PDFDocument, PDFName, PDFString } from "pdf-lib";
import type { ComponentProps, ReactElement } from "react";
import type {
  ItemLocationBatchReportPDF,
  ItemLocationBatchReportPDFProps,
} from "@/components/reports/ItemLocationBatchReportPDF";
import { buildItemLocationReportPdf } from "./build-item-location-report-pdf";

const state = vi.hoisted(() => ({ render: vi.fn() }));
vi.mock("@react-pdf/renderer", () => ({
  pdf: state.render,
  StyleSheet: { create: (styles: unknown) => styles },
}));
const renderPages = (
  document: ReactElement<ComponentProps<typeof ItemLocationBatchReportPDF>>
) => ({
  toBlob: async () => {
    const { isLastJob, rows } = document.props;
    const rowsOnFirstPage = isLastJob ? rows.length : rows.length - 5;
    const firstPage = await PDFDocument.create();
    const head = firstPage.addPage([100 + rowsOnFirstPage, 200]);
    if (!isLastJob) {
      const tail = firstPage.addPage([105, 200]);
      firstPage.catalog.set(
        PDFName.of("Names"),
        firstPage.context.obj({
          Dests: {
            Names: rows.flatMap((_, index) => [
              PDFString.of(String(index)),
              [index < rowsOnFirstPage ? head.ref : tail.ref, "Fit"],
            ]),
          },
        })
      );
    }
    return new Blob([new Uint8Array(await firstPage.save())]);
  },
});
beforeEach(() => {
  state.render.mockReset();
  state.render.mockImplementation(renderPages);
});
it("carries the last page into the next bounded job and merges only finished pages", async () => {
  const props = {
    title: "Locations",
    rows: Array.from({ length: 251 }, (_, index) => ({ id: String(index) })),
  } as ItemLocationBatchReportPDFProps;
  const blob = await buildItemLocationReportPdf(props);
  expect(state.render.mock.calls.map(([document]) => document.props.rows)).toEqual([
    props.rows.slice(0, 125),
    props.rows.slice(120, 245),
    props.rows.slice(240),
  ]);
  expect(state.render.mock.calls.map(([document]) => document.props.previousRow)).toEqual([
    undefined,
    props.rows[119],
    props.rows[239],
  ]);
  expect(state.render.mock.calls.map(([document]) => document.props.showReportHeader)).toEqual([
    true,
    false,
    false,
  ]);
  const merged = await PDFDocument.load(await blob.arrayBuffer());
  expect(merged.getPages().map((page) => page.getWidth())).toEqual([220, 220, 111]);
  expect(merged.getTitle()).toBe("Locations");
});
it("renders the empty state once", async () => {
  const blob = await buildItemLocationReportPdf({
    title: "Locations",
    rows: [],
  } as unknown as ItemLocationBatchReportPDFProps);
  expect(state.render).toHaveBeenCalledTimes(1);
  expect((await PDFDocument.load(await blob.arrayBuffer())).getPageCount()).toBe(1);
});
it("does not return a partial PDF if a later render job fails", async () => {
  state.render.mockImplementationOnce(renderPages);
  state.render.mockImplementationOnce(() => ({
    toBlob: async () => {
      throw new Error("render failed");
    },
  }));
  await expect(
    buildItemLocationReportPdf({
      title: "Locations",
      rows: Array.from({ length: 126 }, () => ({ id: "row" })),
    } as ItemLocationBatchReportPDFProps)
  ).rejects.toThrow("render failed");
});
