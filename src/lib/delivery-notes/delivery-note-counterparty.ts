import type { DeliveryNote, DeliveryNoteBusinessUnitSummary } from "@/types/delivery-note";

type DeliveryNoteCounterparty = {
  side: "requesting" | "fulfilling";
  businessUnit: DeliveryNoteBusinessUnitSummary | null;
};

export const resolveDeliveryNoteCounterparty = (
  note: Pick<
    DeliveryNote,
    | "requesting_business_unit_id"
    | "fulfilling_business_unit_id"
    | "requesting_business_unit"
    | "fulfilling_business_unit"
  >,
  currentBusinessUnitId: string | null | undefined
): DeliveryNoteCounterparty | null => {
  if (
    !currentBusinessUnitId ||
    note.requesting_business_unit_id === note.fulfilling_business_unit_id
  ) {
    return null;
  }
  if (currentBusinessUnitId === note.requesting_business_unit_id) {
    return { side: "fulfilling", businessUnit: note.fulfilling_business_unit ?? null };
  }
  if (currentBusinessUnitId === note.fulfilling_business_unit_id) {
    return { side: "requesting", businessUnit: note.requesting_business_unit ?? null };
  }
  return null;
};
