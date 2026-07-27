/**
 * Transformation Validation Service
 *
 * Read-only validation helpers for transformation templates, stock availability,
 * state transitions, and template locks.
 */

import { createClient } from "@/lib/supabase/server";
import { validateTransition } from "@/lib/validations/transformation-order";

// ============================================================================
// Template Validation
// ============================================================================

export async function validateTemplate(templateId: string): Promise<{
  isValid: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    // Check template exists and is active
    const { data: template, error: templateError } = await supabase
      .from("transformation_templates")
      .select("id, is_active, usage_count")
      .eq("id", templateId)
      .is("deleted_at", null)
      .single();

    if (templateError || !template) {
      return { isValid: false, error: "Template not found" };
    }

    if (!template.is_active) {
      return { isValid: false, error: "Template is not active" };
    }

    // Check template has inputs
    const { count: inputCount, error: inputError } = await supabase
      .from("transformation_template_inputs")
      .select("id", { count: "exact", head: true })
      .eq("template_id", templateId);

    if (inputError || !inputCount || inputCount === 0) {
      return { isValid: false, error: "Template has no inputs" };
    }

    // Check template has outputs
    const { count: outputCount, error: outputError } = await supabase
      .from("transformation_template_outputs")
      .select("id", { count: "exact", head: true })
      .eq("template_id", templateId);

    if (outputError || !outputCount || outputCount === 0) {
      return { isValid: false, error: "Template has no outputs" };
    }

    return { isValid: true };
  } catch {
    return { isValid: false, error: "Template validation failed" };
  }
}

// ============================================================================
// Stock Availability Check
// ============================================================================

export async function validateStockAvailability(orderId: string): Promise<{
  isAvailable: boolean;
  error?: string;
  insufficientItems?: Array<{
    itemCode: string;
    itemName: string;
    required: number;
    available: number;
  }>;
}> {
  try {
    const supabase = await createClient();

    // Get order with inputs
    const { data: order, error: orderError } = await supabase
      .from("transformation_orders")
      .select(
        `
        id,
        source_warehouse_id,
        planned_quantity,
        inputs:transformation_order_inputs (
          item_id,
          planned_quantity,
          items (item_code, item_name)
        )
      `
      )
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return { isAvailable: false, error: "Order not found" };
    }

    const insufficientItems: Array<{
      itemCode: string;
      itemName: string;
      required: number;
      available: number;
    }> = [];

    // Check each input item's availability
    for (const input of order.inputs || []) {
      const { data: warehouseStock } = await supabase
        .from("item_warehouse")
        .select("current_stock, available_stock")
        .eq("item_id", input.item_id)
        .eq("warehouse_id", order.source_warehouse_id)
        .single();

      const available = warehouseStock ? parseFloat(String(warehouseStock.available_stock)) : 0;
      const required = input.planned_quantity;

      if (available < required) {
        const inputItem = Array.isArray(input.items) ? input.items[0] : input.items;
        insufficientItems.push({
          itemCode: inputItem?.item_code || "Unknown",
          itemName: inputItem?.item_name || "Unknown",
          required,
          available,
        });
      }
    }

    if (insufficientItems.length > 0) {
      return {
        isAvailable: false,
        error: `Insufficient stock for ${insufficientItems.length} item(s)`,
        insufficientItems,
      };
    }

    return { isAvailable: true };
  } catch {
    return {
      isAvailable: false,
      error: "Stock availability validation failed",
    };
  }
}

// ============================================================================
// State Transition Validation
// ============================================================================

export async function validateStateTransition(
  orderId: string,
  toStatus: string
): Promise<{
  isValid: boolean;
  error?: string;
  currentStatus?: string;
}> {
  try {
    const supabase = await createClient();

    // Get current order status
    const { data: order, error: orderError } = await supabase
      .from("transformation_orders")
      .select("status")
      .eq("id", orderId)
      .is("deleted_at", null)
      .single();

    if (orderError || !order) {
      return { isValid: false, error: "Order not found" };
    }

    const currentStatus = order.status;

    // Validate transition using Zod validator
    try {
      validateTransition(currentStatus, toStatus);
      return { isValid: true, currentStatus };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : "Invalid transition",
        currentStatus,
      };
    }
  } catch {
    return { isValid: false, error: "State transition validation failed" };
  }
}

// ============================================================================
// Check Template Lock (Prevent modification when in use)
// ============================================================================

export async function checkTemplateLock(templateId: string): Promise<{
  isLocked: boolean;
  usageCount?: number;
}> {
  try {
    const supabase = await createClient();

    const { data: template, error } = await supabase
      .from("transformation_templates")
      .select("usage_count")
      .eq("id", templateId)
      .is("deleted_at", null)
      .single();

    if (error || !template) {
      return { isLocked: false };
    }

    return {
      isLocked: template.usage_count > 0,
      usageCount: template.usage_count,
    };
  } catch {
    return { isLocked: false };
  }
}
