type ValidationError = {
  code: "STOCK_REQUEST_HEADER_INVALID" | "STOCK_REQUEST_ITEMS_INVALID";
  error: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PRIORITIES = new Set(["low", "normal", "high", "urgent"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isOptionalBoundedString = (value: unknown, maxLength: number) =>
  value === undefined || value === null || (typeof value === "string" && value.length <= maxLength);

export const validateStockRequestDraftPayload = (
  body: unknown,
  options: { requireFulfillingBusinessUnit: boolean }
): ValidationError | null => {
  if (!isRecord(body)) {
    return {
      code: "STOCK_REQUEST_HEADER_INVALID",
      error: "Complete the required stock request details before saving.",
    };
  }

  if (
    typeof body.request_date !== "string" ||
    !DATE_PATTERN.test(body.request_date) ||
    typeof body.required_date !== "string" ||
    !DATE_PATTERN.test(body.required_date) ||
    typeof body.priority !== "string" ||
    !PRIORITIES.has(body.priority) ||
    !isOptionalBoundedString(body.department, 100) ||
    !isOptionalBoundedString(body.purpose, 2000) ||
    !isOptionalBoundedString(body.notes, 5000) ||
    (options.requireFulfillingBusinessUnit &&
      (typeof body.fulfilling_business_unit_id !== "string" ||
        !UUID_PATTERN.test(body.fulfilling_business_unit_id)))
  ) {
    return {
      code: "STOCK_REQUEST_HEADER_INVALID",
      error: "Complete the required stock request details before saving.",
    };
  }

  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 200) {
    return {
      code: "STOCK_REQUEST_ITEMS_INVALID",
      error: "Add between 1 and 200 stock request items.",
    };
  }

  const invalidLine = body.items.some(
    (item) =>
      !isRecord(item) ||
      typeof item.item_id !== "string" ||
      !UUID_PATTERN.test(item.item_id) ||
      typeof item.item_unit_option_id !== "string" ||
      !UUID_PATTERN.test(item.item_unit_option_id) ||
      typeof item.uom_id !== "string" ||
      !UUID_PATTERN.test(item.uom_id) ||
      (item.selected_item_batch_id !== undefined &&
        item.selected_item_batch_id !== null &&
        (typeof item.selected_item_batch_id !== "string" ||
          !UUID_PATTERN.test(item.selected_item_batch_id))) ||
      typeof item.requested_qty !== "number" ||
      !Number.isFinite(item.requested_qty) ||
      item.requested_qty <= 0 ||
      !isOptionalBoundedString(item.notes, 1000)
  );

  return invalidLine
    ? {
        code: "STOCK_REQUEST_ITEMS_INVALID",
        error: "One or more stock request items contain invalid values.",
      }
    : null;
};
