import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { expect, it, vi } from "vitest";
import { StatusText } from "@/components/shared/StatusText";
import { translations } from "@/lib/i18n/translations";
import { getDocumentLineColumns } from "./document-line-columns";
import { DocumentLinesTable, type DocumentLinesTableRow } from "./DocumentLinesTable";

const mocks = vi.hoisted(() => ({ isStackedLayout: false as boolean | undefined }));

vi.mock("@/hooks/useMediaQuery", () => ({ useMediaQuery: () => mocks.isStackedLayout }));

const LINKED_LABEL = translations.en.loadListPage.itemLinked;
const LINKED_STATUS_NODE = `>${LINKED_LABEL}</span>`;

const baseRow = {
  unitLabel: "Carton",
  uomCode: "CTN",
  qtyPerUnit: 12,
  quantity: 4,
  unitPrice: null,
  lineTotal: null,
} satisfies Omit<DocumentLinesTableRow, "key" | "itemCode" | "itemName">;

// Mirrors how LoadListDetails flags only the lines a stock requisition already claims.
const rows: DocumentLinesTableRow[] = [
  {
    ...baseRow,
    key: "linked-line",
    itemCode: "ITEM-LINKED",
    itemName: "Galvanized Steel Sheet",
    itemStatus: <StatusText tone="green">{LINKED_LABEL}</StatusText>,
  },
  {
    ...baseRow,
    key: "unlinked-line",
    itemCode: "ITEM-UNLINKED",
    itemName: "Copper Wire Spool",
  },
];

const renderLines = (isStackedLayout: boolean, itemNameFirst?: boolean) => {
  mocks.isStackedLayout = isStackedLayout;
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={translations.en} timeZone="Asia/Manila">
      <DocumentLinesTable
        rows={rows}
        columns={getDocumentLineColumns({
          trackingColumns: [],
          showUnitCost: false,
          showLineTotal: false,
          showAction: false,
        })}
        currency="PHP"
        totalAmount={null}
        emptyTitle="No items"
        emptyDescription="No items to show."
        itemNameFirst={itemNameFirst}
      />
    </NextIntlClientProvider>
  );
};

it.each([
  ["table", false],
  ["stacked", true],
] as const)(
  "renders itemStatus only for the rows that provide one in the %s layout",
  (_, stacked) => {
    const html = renderLines(stacked);

    expect(html.indexOf("ITEM-LINKED")).toBeLessThan(html.indexOf("Galvanized Steel Sheet"));
    // One status node total: present on the linked row, absent from the unlinked one.
    expect(html.split(LINKED_STATUS_NODE)).toHaveLength(2);
    expect(html.slice(html.indexOf("ITEM-LINKED"), html.indexOf("ITEM-UNLINKED"))).toContain(
      LINKED_STATUS_NODE
    );
    expect(html.slice(html.indexOf("ITEM-UNLINKED"))).not.toContain(LINKED_STATUS_NODE);
    // The green tone travels with the caller-supplied node in both layouts.
    expect(html).toContain("text-green-700");
  }
);

it.each([
  ["table", false],
  ["stacked", true],
] as const)("puts the code below the name with its status in the %s layout", (_, stacked) => {
  const html = renderLines(stacked, true);

  expect(html).toMatch(
    /Galvanized Steel Sheet<\/div><div class="[^"]*text-xs text-muted-foreground[^"]*">ITEM-LINKED/
  );
  expect(html).toMatch(/Copper Wire Spool<\/div><div[^>]*>ITEM-UNLINKED<\/div>/);
  expect(html.slice(html.indexOf("ITEM-LINKED"), html.indexOf("Copper Wire Spool"))).toContain(
    LINKED_STATUS_NODE
  );
});
