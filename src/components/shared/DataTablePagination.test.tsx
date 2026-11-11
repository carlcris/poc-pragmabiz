import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DataTablePagination } from "./DataTablePagination";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));

const renderPagination = () =>
  renderToStaticMarkup(
    <DataTablePagination
      currentPage={5}
      totalPages={125}
      pageSize={10}
      totalItems={1248}
      onPageChange={vi.fn()}
      onPageSizeChange={vi.fn()}
    />
  );

it("gives phones labelled 44px Previous and Next buttons and no rows-per-page control", () => {
  const [phone] = renderPagination().split("md:flex md:flex-wrap");
  expect(phone).toContain("md:hidden");
  expect(phone).toContain("previous");
  expect(phone).toContain("next");
  expect(phone.match(/h-11/g)?.length).toBe(2);
  expect(phone).not.toContain(">125<");
  expect(phone).not.toContain("rowsPerPage");
});

it("lets the md+ groups wrap instead of widening the page", () => {
  const html = renderPagination();
  const desktop = html.slice(html.indexOf("md:flex md:flex-wrap"));
  expect(desktop).toContain(">125<");
  expect(desktop).toContain("goToLastPage");
});
