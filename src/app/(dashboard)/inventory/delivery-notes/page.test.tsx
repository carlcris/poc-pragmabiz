import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translations } from "@/lib/i18n/translations";
import type { DeliveryNote } from "@/types/delivery-note";
import DeliveryNotesPage from "./page";
import DeliveryNoteDetailPage from "./[id]/page";

const mocks = vi.hoisted(() => ({
  currentBusinessUnitId: "fulfilling-bu",
  availableBusinessUnitIds: ["fulfilling-bu"],
  rows: [] as DeliveryNote[],
  detail: null as DeliveryNote | null,
  isLoading: false,
  locale: "en" as "en" | "zh",
}));

const businessUnits = [
  { id: "requesting-bu", code: "REQ", name: "Requesting Branch" },
  { id: "fulfilling-bu", code: "FUL", name: "Fulfilling Depot" },
];

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ id: "transfer" }),
}));
vi.mock("next-intl", () => ({
  useLocale: () => mocks.locale,
  useTranslations: (namespace: "deliveryNotesPage" | "deliveryNoteDetailPage") => (key: string) =>
    translations[mocks.locale][namespace][key],
}));
vi.mock("@/stores/businessUnitStore", () => ({
  useBusinessUnitStore: <T,>(
    selector: (state: {
      currentBusinessUnit: { id: string };
      availableBusinessUnits: typeof businessUnits;
    }) => T
  ) =>
    selector({
      currentBusinessUnit: { id: mocks.currentBusinessUnitId },
      availableBusinessUnits: businessUnits.filter((unit) =>
        mocks.availableBusinessUnitIds.includes(unit.id)
      ),
    }),
}));
vi.mock("@/hooks/useDeliveryNotes", () => {
  const mutation = () => ({ mutateAsync: vi.fn(), isPending: false });
  return {
    useDeliveryNotes: () => ({ data: { data: mocks.rows }, isLoading: mocks.isLoading }),
    useDeliveryNote: (id: string) => ({
      data: id ? mocks.detail : undefined,
      isLoading: mocks.isLoading,
      error: null,
    }),
    useDeliveryNoteAllocatableItems: () => ({ data: { data: [] }, isLoading: false }),
    useDeliveryNoteAllocationAvailability: () => ({
      data: { data: [] },
      isFetching: false,
      isError: false,
    }),
    useConfirmDeliveryNote: mutation,
    useCreateDeliveryNote: mutation,
    useDispatchDeliveryNote: mutation,
    useStartReceivingDeliveryNote: mutation,
    useVoidDeliveryNote: mutation,
    useAddDeliveryNoteItems: mutation,
    useAdjustDispatchedDeliveryNoteItem: mutation,
    useAcceptDeliveryNoteReceivingException: mutation,
    useAcceptDeliveryNoteReceivingOverage: mutation,
    useReceiveDeliveryNote: mutation,
    useRejectDeliveryNoteReceivingException: mutation,
    useRejectDeliveryNoteReceivingOverage: mutation,
  };
});
vi.mock("@/hooks/usePickLists", () => ({ useCreatePickList: () => ({ isPending: false }) }));
vi.mock("@/hooks/useStockRequests", () => ({ useStockRequests: () => ({ data: { data: [] } }) }));
vi.mock("@/hooks/useUsers", () => ({ useUsers: () => ({ data: { data: [] } }) }));

const deliveryNote: DeliveryNote = {
  id: "transfer",
  company_id: "company",
  business_unit_id: "fulfilling-bu",
  requesting_business_unit_id: "requesting-bu",
  fulfilling_business_unit_id: "fulfilling-bu",
  requesting_business_unit: businessUnits[0],
  fulfilling_business_unit: businessUnits[1],
  dn_no: "DN-TRANSFER-001",
  status: "dispatched",
  requesting_warehouse_id: null,
  fulfilling_warehouse_id: "fulfilling-warehouse",
  confirmed_at: null,
  picking_started_at: null,
  picking_started_by: null,
  picking_completed_at: null,
  picking_completed_by: null,
  dispatched_at: "2026-11-05T00:00:00Z",
  received_at: null,
  voided_at: null,
  void_reason: null,
  driver_name: null,
  driver_signature: null,
  helper_name: null,
  delivery_time: null,
  plate_number: null,
  notes: null,
  created_by: null,
  created_at: "2026-11-05T00:00:00Z",
  updated_by: null,
  updated_at: "2026-11-05T00:00:00Z",
};

const renderTransferCells = (code = deliveryNote.dn_no) => {
  const html = renderToStaticMarkup(<DeliveryNotesPage />);
  const row = html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/g)?.find((value) => value.includes(code));
  return row?.match(/<td\b[^>]*>[\s\S]*?<\/td>/g) ?? [];
};

beforeEach(() => {
  mocks.currentBusinessUnitId = "fulfilling-bu";
  mocks.availableBusinessUnitIds = ["fulfilling-bu"];
  mocks.rows = [deliveryNote];
  mocks.detail = deliveryNote;
  mocks.isLoading = false;
  mocks.locale = "en";
});

describe("delivery-note transfer business-unit labels", () => {
  it.each(["requesting-bu", "fulfilling-bu"])(
    "shows only the other branch with access only to %s",
    (businessUnitId) => {
      mocks.currentBusinessUnitId = businessUnitId;
      mocks.availableBusinessUnitIds = [businessUnitId];
      const cells = renderTransferCells();
      const isRequesting = businessUnitId === "requesting-bu";
      expect(cells).toHaveLength(5);
      expect(cells[1]).toContain(isRequesting ? "Fulfilling Depot" : "Requesting Branch");
      expect(cells[1]).toContain(isRequesting ? "FUL" : "REQ");
      expect(cells[1]).toContain(isRequesting ? "Fulfilled By" : "Requested By");
      expect(cells[1]).not.toContain(isRequesting ? "Requesting Branch" : "Fulfilling Depot");
      expect(cells[1]).not.toContain(isRequesting ? "Requested By" : "Fulfilled By");
    }
  );

  it("uses document labels even before the business-unit switcher list is loaded", () => {
    mocks.availableBusinessUnitIds = [];
    const cells = renderTransferCells();
    expect(cells[1]).toContain("Requesting Branch");
    expect(cells[1]).not.toContain("Fulfilling Depot");
  });

  it("uses the translated empty value when a related summary is unavailable", () => {
    mocks.rows = [
      { ...deliveryNote, requesting_business_unit: null, fulfilling_business_unit: null },
    ];
    const cells = renderTransferCells();
    expect(cells[1]).toContain(translations.en.deliveryNotesPage.noValue);
    expect(cells[1]).not.toContain("Requesting Branch");
    expect(cells[1]).not.toContain("Fulfilling Depot");
  });

  it("uses the selected BU's perspective even when both memberships are available", () => {
    mocks.availableBusinessUnitIds = businessUnits.map((unit) => unit.id);
    expect(renderTransferCells()[1]).toContain("Requested By");
    mocks.currentBusinessUnitId = "requesting-bu";
    expect(renderTransferCells()[1]).toContain("Fulfilled By");
  });

  it("supports incoming and outgoing transfers in the same list", () => {
    mocks.rows = [
      deliveryNote,
      {
        ...deliveryNote,
        id: "incoming-transfer",
        dn_no: "DN-INCOMING-001",
        requesting_business_unit_id: "fulfilling-bu",
        fulfilling_business_unit_id: "another-bu",
        requesting_business_unit: businessUnits[1],
        fulfilling_business_unit: { id: "another-bu", code: "OTHER", name: "Other Supplier" },
      },
    ];
    const outgoing = renderTransferCells()[1];
    const incoming = renderTransferCells("DN-INCOMING-001")[1];
    expect(outgoing).toContain("Requested By");
    expect(outgoing).toContain("Requesting Branch");
    expect(incoming).toContain("Fulfilled By");
    expect(incoming).toContain("Other Supplier");
    expect(incoming).not.toContain("Fulfilling Depot");
  });

  it("keeps the loading table at the same five-column footprint", () => {
    mocks.isLoading = true;
    const html = renderToStaticMarkup(<DeliveryNotesPage />);
    expect(html.match(/<th\b/g)).toHaveLength(5);
    expect(html.match(/<td\b/g)).toHaveLength(8 * 5);
    expect(html).toContain(translations.en.deliveryNotesPage.otherBusinessUnit);
  });
});

describe("delivery-note detail business-unit perspective", () => {
  it.each(["requesting-bu", "fulfilling-bu"])(
    "hides the current business unit's card when selected BU is %s",
    (businessUnitId) => {
      mocks.currentBusinessUnitId = businessUnitId;
      const html = renderToStaticMarkup(<DeliveryNoteDetailPage />);
      const isRequesting = businessUnitId === "requesting-bu";
      expect(html).toContain(
        isRequesting ? "Fulfilling Business Unit" : "Requesting Business Unit"
      );
      expect(html).toContain(isRequesting ? "Fulfilling Depot" : "Requesting Branch");
      expect(html).not.toContain(
        isRequesting ? "Requesting Business Unit" : "Fulfilling Business Unit"
      );
      expect(html).not.toContain(isRequesting ? "Requesting Branch" : "Fulfilling Depot");
    }
  );

  it("follows the selected BU rather than the full membership list", () => {
    mocks.availableBusinessUnitIds = businessUnits.map((unit) => unit.id);
    expect(renderToStaticMarkup(<DeliveryNoteDetailPage />)).toContain("Requesting Business Unit");
    mocks.currentBusinessUnitId = "requesting-bu";
    const html = renderToStaticMarkup(<DeliveryNoteDetailPage />);
    expect(html).toContain("Fulfilling Business Unit");
    expect(html).not.toContain("Requesting Business Unit");
  });

  it("keeps the detail shell while data is loading", () => {
    mocks.detail = null;
    mocks.isLoading = true;
    const html = renderToStaticMarkup(<DeliveryNoteDetailPage />);
    expect(html).toContain(translations.en.deliveryNoteDetailPage.otherBusinessUnit);
    expect(html).toContain(translations.en.deliveryNoteDetailPage.linkedPickList);
    expect(html).not.toContain("Requesting Branch");
    expect(html).not.toContain("Fulfilling Depot");
  });

  it("translates the counterpart role and card label in Chinese", () => {
    mocks.locale = "zh";
    expect(renderTransferCells()[1]).toContain(translations.zh.deliveryNotesPage.requestedBy);
    const html = renderToStaticMarkup(<DeliveryNoteDetailPage />);
    expect(html).toContain(translations.zh.deliveryNoteDetailPage.requestingBusinessUnit);
    expect(html).not.toContain(translations.zh.deliveryNoteDetailPage.fulfillingBusinessUnit);
  });
});
