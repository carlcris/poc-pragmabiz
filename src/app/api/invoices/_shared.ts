import type { SupabaseClient } from "@supabase/supabase-js";

type SalesOrderInvoiceStatus = "confirmed" | "invoiced";

type SyncSalesOrderInvoiceStatusParams = {
  supabase: SupabaseClient;
  salesOrderId: string;
  userId: string;
};

type SyncSalesOrderInvoiceStatusResult =
  | { ok: true; status: SalesOrderInvoiceStatus }
  | { ok: false; error: string };

export const syncSalesOrderInvoiceStatus = async ({
  supabase,
  salesOrderId,
  userId,
}: SyncSalesOrderInvoiceStatusParams): Promise<SyncSalesOrderInvoiceStatusResult> => {
  const { count, error: invoiceCountError } = await supabase
    .from("sales_invoices")
    .select("id", { count: "exact", head: true })
    .eq("sales_order_id", salesOrderId)
    .is("deleted_at", null)
    .neq("status", "cancelled");

  if (invoiceCountError) {
    console.error("Failed to count active invoices for sales order status sync:", invoiceCountError);
    return { ok: false, error: "Failed to evaluate related invoices" };
  }

  const nextStatus: SalesOrderInvoiceStatus = (count || 0) > 0 ? "invoiced" : "confirmed";

  const { error: orderUpdateError } = await supabase
    .from("sales_orders")
    .update({
      status: nextStatus,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", salesOrderId)
    .neq("status", "cancelled");

  if (orderUpdateError) {
    console.error("Failed to sync sales order invoice status:", orderUpdateError);
    return { ok: false, error: "Failed to update related sales order" };
  }

  return { ok: true, status: nextStatus };
};
