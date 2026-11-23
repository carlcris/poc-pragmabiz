import { NextResponse } from "next/server";
import { z } from "zod";

const lineSchema = z
  .object({
    itemId: z.string().uuid(),
    itemUnitOptionId: z.string().uuid().optional(),
    uomId: z.string().uuid().optional(),
    requestedQty: z.number().finite().positive().max(99999999999.9999),
    unitPrice: z.number().finite().nonnegative().max(999999999999.9999).optional(),
    notes: z.string().max(10000).nullish(),
  })
  .strict()
  .refine((line) => Boolean(line.itemUnitOptionId || line.uomId));

const headerShape = {
  supplierId: z.string().uuid(),
  currency: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .pipe(z.string().regex(/^[A-Z]{3}$/))
    .nullish(),
  requisitionDate: z.string().date().optional(),
  requiredByDate: z.union([z.string().date(), z.literal("")]).optional(),
  notes: z.string().max(10000).nullish(),
  items: z.array(lineSchema).min(1).max(500),
};

export const createStockRequisitionRequestSchema = z.object(headerShape).strict();

export const updateStockRequisitionRequestSchema = z.object(headerShape).partial().strict();

type HeaderInput = z.infer<typeof updateStockRequisitionRequestSchema>;

export const buildStockRequisitionHeader = (body: HeaderInput) => ({
  ...(body.supplierId !== undefined ? { supplier_id: body.supplierId } : {}),
  ...(body.currency != null ? { currency: body.currency } : {}),
  ...(body.requisitionDate !== undefined ? { requisition_date: body.requisitionDate } : {}),
  ...(body.requiredByDate !== undefined ? { required_by_date: body.requiredByDate || null } : {}),
  ...(body.notes !== undefined ? { notes: body.notes } : {}),
});

const saveErrors: Record<string, { error: string; status: number; code?: string }> = {
  Unauthorized: { error: "Unauthorized", status: 403 },
  "Stock requisition not found": { error: "Stock requisition not found", status: 404 },
  "Invalid stock requisition": {
    error: "Check the requisition details and try again.",
    status: 400,
    code: "STOCK_REQUISITION_INVALID_REQUEST",
  },
  "Invalid stock requisition lines": {
    error: "Check the item quantities and costs and try again.",
    status: 400,
    code: "STOCK_REQUISITION_INVALID_REQUEST",
  },
  "Selected unit option is unavailable": {
    error: "A selected pack size is unavailable. Select an active pack size and try again.",
    status: 400,
    code: "STOCK_REQUISITION_PACK_UNAVAILABLE",
  },
  "Supplier not found": {
    error: "The supplier is unavailable. Select a supplier and try again.",
    status: 400,
    code: "STOCK_REQUISITION_SUPPLIER_UNAVAILABLE",
  },
  "Only draft requisitions can be edited": {
    error: "Only draft requisitions can be edited",
    status: 409,
    code: "STOCK_REQUISITION_STATUS_CONFLICT",
  },
  "Duplicate stock requisition pack option": {
    error: "This pack size is already listed. Remove its line before adding it again.",
    status: 400,
    code: "STOCK_REQUISITION_DUPLICATE_PACK",
  },
  "Selected items resolve to different cost currencies": {
    error: "Selected items use different cost currencies. Use items with the same currency.",
    status: 400,
    code: "STOCK_REQUISITION_CURRENCY_CONFLICT",
  },
};

export const createStockRequisitionSaveErrorResponse = (message: string) => {
  const safeError = saveErrors[message];
  return NextResponse.json(safeError ?? { error: "Failed to save stock requisition" }, {
    status: safeError?.status ?? 500,
  });
};
