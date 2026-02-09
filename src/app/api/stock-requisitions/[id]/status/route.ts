import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { sendStockRequisitionEmail } from "@/lib/email";

// PATCH /api/stock-requisitions/[id]/status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(RESOURCES.STOCK_REQUISITIONS, "edit");
    const { id } = await params;
    const { supabase } = await createServerClientWithBU();
    const body = await request.json();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's company
    const { data: userData } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: "User company not found" }, { status: 400 });
    }

    // Validate status
    const validStatuses = ["draft", "submitted", "partially_fulfilled", "fulfilled", "cancelled"];
    if (!body.status || !validStatuses.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    // Check if stock requisition exists
    const { data: existingSR, error: fetchError } = await supabase
      .from("stock_requisitions")
      .select("id, status")
      .eq("id", id)
      .eq("company_id", userData.company_id)
      .is("deleted_at", null)
      .single();

    if (fetchError || !existingSR) {
      return NextResponse.json({ error: "Stock requisition not found" }, { status: 404 });
    }

    // Validate status transition
    const currentStatus = existingSR.status;
    const newStatus = body.status;

    // Status transition rules
    if (currentStatus === "cancelled" && newStatus !== "cancelled") {
      return NextResponse.json(
        { error: "Cannot change status of a cancelled requisition" },
        { status: 400 }
      );
    }

    if (currentStatus === "fulfilled" && newStatus !== "fulfilled" && newStatus !== "cancelled") {
      return NextResponse.json(
        { error: "Cannot change status of a fulfilled requisition" },
        { status: 400 }
      );
    }

    // Update status
    const { data: sr, error: updateError } = await supabase
      .from("stock_requisitions")
      .update({
        status: newStatus,
        updated_by: user.id,
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating stock requisition status:", updateError);
      return NextResponse.json(
        { error: updateError.message || "Failed to update status" },
        { status: 500 }
      );
    }

    // Send email if status is changed to submitted
    if (newStatus === "submitted") {
      try {
        // Fetch complete stock requisition data with all related information
        const { data: srComplete, error: fetchCompleteError } = await supabase
          .from("stock_requisitions")
          .select(`
            id,
            sr_number,
            requisition_date,
            required_by_date,
            total_amount,
            notes,
            supplier:suppliers!stock_requisitions_supplier_id_fkey (
              supplier_name,
              email,
              supplier_code
            ),
            business_units (
              name,
              code
            ),
            users!stock_requisitions_created_by_fkey (
              first_name,
              last_name,
              email
            ),
            stock_requisition_items (
              id,
              requested_qty,
              unit_price,
              total_price,
              items (
                item_code,
                item_name
              )
            )
          `)
          .eq("id", id)
          .single();

        if (fetchCompleteError || !srComplete) {
          console.error("Error fetching complete SR data for email:", fetchCompleteError);
        } else {
          // Check if supplier has email
          const supplier = Array.isArray(srComplete.supplier)
            ? srComplete.supplier[0]
            : srComplete.supplier;
          const supplierEmail = supplier?.email;

          if (!supplierEmail) {
            console.warn(`Supplier for SR ${srComplete.sr_number} does not have an email address`);
          } else {
            // Format data for email
            type SrCreatedByUser = {
              first_name?: string | null;
              last_name?: string | null;
              email?: string | null;
            };
            const createdByUser = srComplete.users as SrCreatedByUser | null;
            const createdByName = [createdByUser?.first_name, createdByUser?.last_name]
              .filter(Boolean)
              .join(" ") || createdByUser?.email || "Unknown";

            const businessUnit = Array.isArray(srComplete.business_units)
              ? srComplete.business_units[0]
              : srComplete.business_units;
            const emailData = {
              srNumber: srComplete.sr_number,
              supplierName: supplier?.supplier_name || "Unknown Supplier",
              supplierEmail: supplierEmail,
              requisitionDate: srComplete.requisition_date
                ? new Date(srComplete.requisition_date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })
                : new Date().toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  }),
              requiredByDate: srComplete.required_by_date
                ? new Date(srComplete.required_by_date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })
                : undefined,
              totalAmount: new Intl.NumberFormat('zh-CN', {
                style: 'currency',
                currency: 'CNY'
              }).format(srComplete.total_amount || 0),
              items: ((
                srComplete.stock_requisition_items as
                  | Array<{
                      requested_qty?: number | string | null;
                      unit_price?: number | string | null;
                      total_price?: number | string | null;
                      items?: { item_code?: string | null; item_name?: string | null } | null;
                    }>
                  | null
              ) || []).map((item) => ({
                itemCode: item.items?.item_code || "N/A",
                itemName: item.items?.item_name || "Unknown Item",
                requestedQty: Number(item.requested_qty ?? 0),
                unitPrice: new Intl.NumberFormat('zh-CN', {
                  style: 'currency',
                  currency: 'CNY'
                }).format(Number(item.unit_price ?? 0)),
                totalPrice: new Intl.NumberFormat('zh-CN', {
                  style: 'currency',
                  currency: 'CNY'
                }).format(Number(item.total_price ?? 0)),
              })),
              notes: srComplete.notes || undefined,
              createdBy: createdByName,
              businessUnit: businessUnit?.name
                ? `${businessUnit.name} (${businessUnit.code || ""})`
                : undefined,
            };

            // Send email
            await sendStockRequisitionEmail(emailData);
            console.log(`Email sent successfully for SR ${srComplete.sr_number} to ${supplierEmail}`);
          }
        }
      } catch (emailError) {
        // Log error but don't fail the status update
        console.error("Failed to send email for stock requisition:", emailError);
        // Continue with the response - email failure shouldn't block the status update
      }
    }

    return NextResponse.json({
      id: sr.id,
      srNumber: sr.sr_number,
      status: sr.status,
      message: "Status updated successfully",
    });
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
