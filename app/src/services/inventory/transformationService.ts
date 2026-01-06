/**
 * Transformation Service
 *
 * Handles the complete transformation order lifecycle:
 * - Template validation and creation
 * - Order creation from templates
 * - State machine transitions
 * - Inventory consumption and production
 * - Cost allocation and redistribution
 * - Lineage tracking
 * - Rollback on failures
 */

import { createClient } from "@/lib/supabase/server";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { validateTransition } from "@/lib/validations/transformation-order";
import type { ExecuteTransformationOrderRequest } from "@/types/transformation-order";
import { normalizeTransactionItems } from "./normalizationService";
import type { StockTransactionItemInput } from "@/types/inventory-normalization";

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
  } catch (error) {

    return { isValid: false, error: "Template validation failed" };
  }
}

// ============================================================================
// Stock Availability Check
// ============================================================================

export async function validateStockAvailability(
  orderId: string
): Promise<{
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

      const available = warehouseStock
        ? parseFloat(String(warehouseStock.available_stock))
        : 0;
      const currentStock = warehouseStock
        ? parseFloat(String(warehouseStock.current_stock))
        : 0;
      const required = input.planned_quantity;

      if (available < required) {
        insufficientItems.push({
          itemCode: input.items?.item_code || "Unknown",
          itemName: input.items?.item_name || "Unknown",
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
  } catch (error) {

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
  } catch (error) {

    return { isValid: false, error: "State transition validation failed" };
  }
}

// ============================================================================
// Execute Transformation (Main Orchestrator)
// ============================================================================

export async function executeTransformation(
  orderId: string,
  userId: string,
  executionData: ExecuteTransformationOrderRequest,
  supabaseClient?: any
): Promise<{
  success: boolean;
  error?: string;
  stockTransactionIds?: {
    inputs: string[];
    outputs: string[];
    waste: string[];
  };
}> {
  try {
    // Use provided client (with BU context) or create a new one
    const supabase = supabaseClient || (await createServerClientWithBU()).supabase;

    // 1. Get order details
    const { data: order, error: orderError } = await supabase
      .from("transformation_orders")
      .select(
        `
        id,
        company_id,
        business_unit_id,
        order_code,
        source_warehouse_id,
        status,
        inputs:transformation_order_inputs (*),
        outputs:transformation_order_outputs (*)
      `
      )
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return { success: false, error: "Order not found" };
    }

    // 2. Validate order is in PREPARING status
    if (order.status !== "PREPARING") {
      return {
        success: false,
        error: `Order must be in PREPARING status. Current status: ${order.status}`,
      };
    }

    // 3. Validate execution data matches order inputs/outputs
    const inputLineIds = new Set(order.inputs.map((i: any) => i.id));
    const outputLineIds = new Set(order.outputs.map((o: any) => o.id));

    for (const input of executionData.inputs) {
      if (!inputLineIds.has(input.inputLineId)) {
        return {
          success: false,
          error: `Invalid input line ID: ${input.inputLineId}`,
        };
      }
    }

    for (const output of executionData.outputs) {
      if (!outputLineIds.has(output.outputLineId)) {
        return {
          success: false,
          error: `Invalid output line ID: ${output.outputLineId}`,
        };
      }
    }

    // 4. Calculate actual quantity from outputs
    const actualQuantity = executionData.outputs.reduce(
      (sum, output) => sum + output.producedQuantity,
      0
    );

    // 5. Update order status to COMPLETED (execute and complete in one step)
    const { error: statusError } = await supabase
      .from("transformation_orders")
      .update({
        status: "COMPLETED",
        execution_date: executionData.executionDate || new Date().toISOString(),
        completion_date: new Date().toISOString(),
        actual_quantity: actualQuantity,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (statusError) {

      return {
        success: false,
        error: `Failed to update order status: ${statusError.message || JSON.stringify(statusError)}`
      };
    }

    // 5. Normalize input quantities from packages to base units
    const inputItemsToNormalize: StockTransactionItemInput[] = executionData.inputs.map((inputData) => {
      const inputLine = order.inputs.find((i: any) => i.id === inputData.inputLineId);
      if (!inputLine) throw new Error(`Input line not found: ${inputData.inputLineId}`);

      return {
        itemId: inputLine.item_id,
        packagingId: inputData.packagingId || null, // null = use base package
        inputQty: inputData.consumedQuantity,
        unitCost: 0, // Will be fetched from item
      };
    });

    const normalizedInputs = await normalizeTransactionItems(order.company_id, inputItemsToNormalize);

    // 6. Consume inputs (create stock transactions type='out')
    const inputTransactionIds: string[] = [];
    const inputCosts: Array<{ inputLineId: string; cost: number }> = [];

    let inputIndex = 0;
    for (const inputData of executionData.inputs) {
      inputIndex++;
      const inputLine = order.inputs.find((i: any) => i.id === inputData.inputLineId);
      if (!inputLine) continue;

      const normalizedInput = normalizedInputs[inputIndex - 1];

      // Get current stock
      const { data: warehouseStock, error: stockError } = await supabase
        .from("item_warehouse")
        .select("current_stock, available_stock")
        .eq("item_id", inputLine.item_id)
        .eq("warehouse_id", order.source_warehouse_id)
        .single();

      // Get item cost
      const { data: itemData } = await supabase
        .from("items")
        .select("cost_price")
        .eq("id", inputLine.item_id)
        .single();

      const currentStock = warehouseStock
        ? parseFloat(String(warehouseStock.current_stock))
        : 0;
      const availableStock = warehouseStock
        ? parseFloat(String(warehouseStock.available_stock))
        : 0;
      const unitCost = itemData?.cost_price ? parseFloat(String(itemData.cost_price)) : 0;

      const newStock = currentStock - normalizedInput.normalizedQty;

      // Validate sufficient stock (using normalized quantity in base units)
      if (newStock < 0) {
        // Rollback: revert order status
        await supabase
          .from("transformation_orders")
          .update({ status: "PREPARING", updated_by: userId })
          .eq("id", orderId);
        return {
          success: false,
          error: `Insufficient stock for item. Available: ${currentStock} (base units), Required: ${normalizedInput.normalizedQty} (base units)`,
        };
      }

      // Calculate costs (based on normalized quantity in base units)
      const totalCost = unitCost * normalizedInput.normalizedQty;

      // Create stock transaction (type='out')
      // Add input index to make transaction code unique for each input
      const { data: stockTransaction, error: transactionError } = await supabase
        .from("stock_transactions")
        .insert({
          company_id: order.company_id,
          business_unit_id: order.business_unit_id,
          transaction_code: `ST-TRANS-IN-${order.order_code}-${inputIndex}`,
          transaction_type: "out",
          transaction_date: executionData.executionDate?.split("T")[0] || new Date().toISOString().split("T")[0],
          warehouse_id: order.source_warehouse_id,
          reference_type: "transformation_order",
          reference_id: orderId,
          reference_code: order.order_code,
          notes: `Transformation input consumption - ${order.order_code}`,
          status: "posted",
          created_by: userId,
          updated_by: userId,
        })
        .select()
        .single();

      if (transactionError || !stockTransaction) {
        // Rollback

        await supabase
          .from("transformation_orders")
          .update({ status: "PREPARING", updated_by: userId })
          .eq("id", orderId);
        return { success: false, error: `Failed to create input stock transaction: ${transactionError?.message || 'Unknown error'}` };
      }

      inputTransactionIds.push(stockTransaction.id);

      // Create stock transaction item
      const now = new Date();
      const postingDate = now.toISOString().split("T")[0];
      const postingTime = now.toTimeString().split(" ")[0];
      const stockValueBefore = currentStock * unitCost;
      const stockValueAfter = newStock * unitCost;

      await supabase.from("stock_transaction_items").insert({
        company_id: order.company_id,
        transaction_id: stockTransaction.id,
        item_id: inputLine.item_id,
        // Normalization fields (NEW)
        input_qty: normalizedInput.inputQty,
        input_packaging_id: normalizedInput.inputPackagingId,
        conversion_factor: normalizedInput.conversionFactor,
        normalized_qty: normalizedInput.normalizedQty,
        base_package_id: normalizedInput.basePackageId,
        // Standard fields
        quantity: normalizedInput.normalizedQty, // Backward compat
        uom_id: normalizedInput.uomId,
        unit_cost: unitCost,
        total_cost: totalCost,
        // Audit fields
        qty_before: currentStock,
        qty_after: newStock,
        valuation_rate: unitCost,
        stock_value_before: stockValueBefore,
        stock_value_after: stockValueAfter,
        posting_date: postingDate,
        posting_time: postingTime,
        created_by: userId,
        updated_by: userId,
      });

      // Update item_warehouse (only update stock quantities, no stock_value column)
      await supabase
        .from("item_warehouse")
        .update({
          current_stock: newStock,
          updated_by: userId,
        })
        .eq("item_id", inputLine.item_id)
        .eq("warehouse_id", order.source_warehouse_id);

      // Update transformation_order_inputs (store normalized quantity)
      await supabase
        .from("transformation_order_inputs")
        .update({
          consumed_quantity: normalizedInput.normalizedQty, // Use normalized quantity
          unit_cost: unitCost,
          total_cost: totalCost,
          stock_transaction_id: stockTransaction.id,
          updated_by: userId,
        })
        .eq("id", inputData.inputLineId);

      inputCosts.push({ inputLineId: inputData.inputLineId, cost: totalCost });
    }

    // 6. Calculate total input cost
    const totalInputCost = inputCosts.reduce((sum, item) => sum + item.cost, 0);

    // 7. Normalize output quantities from packages to base units
    const outputItemsToNormalize: StockTransactionItemInput[] = executionData.outputs.map((outputData) => {
      const outputLine = order.outputs.find((o: any) => o.id === outputData.outputLineId);
      if (!outputLine) throw new Error(`Output line not found: ${outputData.outputLineId}`);

      return {
        itemId: outputLine.item_id,
        packagingId: outputData.packagingId || null, // null = use base package
        inputQty: outputData.producedQuantity,
        unitCost: 0, // Will be allocated from input costs
      };
    });

    const normalizedOutputs = await normalizeTransactionItems(order.company_id, outputItemsToNormalize);

    // 7.5 Normalize waste quantities for cost allocation
    const wasteItemsToNormalize: StockTransactionItemInput[] = executionData.outputs
      .filter(output => output.wastedQuantity && output.wastedQuantity > 0)
      .map((outputData) => {
        const outputLine = order.outputs.find((o: any) => o.id === outputData.outputLineId);
        if (!outputLine) throw new Error(`Output line not found: ${outputData.outputLineId}`);

        return {
          itemId: outputLine.item_id,
          packagingId: outputData.packagingId || null,
          inputQty: outputData.wastedQuantity || 0,
          unitCost: 0,
        };
      });

    const normalizedWastes = wasteItemsToNormalize.length > 0
      ? await normalizeTransactionItems(order.company_id, wasteItemsToNormalize)
      : [];

    // 8. Produce outputs (create stock transactions type='in')
    const outputTransactionIds: string[] = [];
    const wasteTransactionIds: string[] = [];

    // Calculate total normalized quantity (produced + wasted) for cost allocation
    let wasteIndex = 0;
    const totalOutputQuantity = normalizedOutputs.reduce(
      (sum, output, idx) => {
        const hasWaste = executionData.outputs[idx].wastedQuantity && executionData.outputs[idx].wastedQuantity > 0;
        const normalizedWasteQty = hasWaste && normalizedWastes[wasteIndex]
          ? normalizedWastes[wasteIndex++].normalizedQty
          : 0;
        return sum + output.normalizedQty + normalizedWasteQty;
      },
      0
    );

    // Cost allocation strategy: quantity-based (across produced + wasted)
    // Create map of output line ID to normalized waste
    const normalizedWasteMap = new Map<string, typeof normalizedWastes[0]>();
    let wasteMapIndex = 0;
    for (const outputData of executionData.outputs) {
      if (outputData.wastedQuantity && outputData.wastedQuantity > 0) {
        normalizedWasteMap.set(outputData.outputLineId, normalizedWastes[wasteMapIndex++]);
      }
    }

    let outputIndex = 0;
    for (const outputData of executionData.outputs) {
      outputIndex++;
      const outputLine = order.outputs.find((o: any) => o.id === outputData.outputLineId);
      if (!outputLine) continue;

      const normalizedOutput = normalizedOutputs[outputIndex - 1];

      // Allocate cost based on total normalized quantity (produced + wasted)
      // This ensures cost per unit is consistent whether item was good or wasted
      const costPerUnit = totalOutputQuantity > 0
        ? totalInputCost / totalOutputQuantity
        : 0;
      const allocatedCost = outputLine.is_scrap
        ? 0
        : costPerUnit * normalizedOutput.normalizedQty;

      // Get current stock (same warehouse as inputs)
      const { data: warehouseStock } = await supabase
        .from("item_warehouse")
        .select("current_stock, available_stock")
        .eq("item_id", outputLine.item_id)
        .eq("warehouse_id", order.source_warehouse_id)
        .maybeSingle();

      const currentStock = warehouseStock
        ? parseFloat(String(warehouseStock.current_stock))
        : 0;

      const newStock = currentStock + normalizedOutput.normalizedQty;

      // Create stock transaction (type='in') - same warehouse as inputs
      // Add output index to make transaction code unique for each output
      const { data: stockTransaction, error: transactionError } = await supabase
        .from("stock_transactions")
        .insert({
          company_id: order.company_id,
          business_unit_id: order.business_unit_id,
          transaction_code: `ST-TRANS-OUT-${order.order_code}-${outputIndex}`,
          transaction_type: "in",
          transaction_date: executionData.executionDate?.split("T")[0] || new Date().toISOString().split("T")[0],
          warehouse_id: order.source_warehouse_id,
          reference_type: "transformation_order",
          reference_id: orderId,
          reference_code: order.order_code,
          notes: `Transformation output production - ${order.order_code}`,
          status: "posted",
          created_by: userId,
          updated_by: userId,
        })
        .select()
        .single();

      if (transactionError || !stockTransaction) {
        // Rollback would be complex here - better to prevent this with validation

        return { success: false, error: `Failed to create output stock transaction: ${transactionError?.message || 'Unknown error'}` };
      }

      outputTransactionIds.push(stockTransaction.id);

      // Create stock transaction item
      const now = new Date();
      const postingDate = now.toISOString().split("T")[0];
      const postingTime = now.toTimeString().split(" ")[0];
      const stockValueBefore = currentStock * costPerUnit;
      const stockValueAfter = newStock * costPerUnit;

      await supabase.from("stock_transaction_items").insert({
        company_id: order.company_id,
        transaction_id: stockTransaction.id,
        item_id: outputLine.item_id,
        // Normalization fields (NEW)
        input_qty: normalizedOutput.inputQty,
        input_packaging_id: normalizedOutput.inputPackagingId,
        conversion_factor: normalizedOutput.conversionFactor,
        normalized_qty: normalizedOutput.normalizedQty,
        base_package_id: normalizedOutput.basePackageId,
        // Standard fields
        quantity: normalizedOutput.normalizedQty, // Backward compat
        uom_id: normalizedOutput.uomId,
        unit_cost: costPerUnit,
        total_cost: allocatedCost,
        // Audit fields
        qty_before: currentStock,
        qty_after: newStock,
        valuation_rate: costPerUnit,
        stock_value_before: stockValueBefore,
        stock_value_after: stockValueAfter,
        posting_date: postingDate,
        posting_time: postingTime,
        created_by: userId,
        updated_by: userId,
      });

      // Update or insert item_warehouse (no stock_value column) - same warehouse as inputs
      if (warehouseStock) {
        await supabase
          .from("item_warehouse")
          .update({
            current_stock: newStock,
            updated_by: userId,
          })
          .eq("item_id", outputLine.item_id)
          .eq("warehouse_id", order.source_warehouse_id);
      } else {
        await supabase.from("item_warehouse").insert({
          company_id: order.company_id,
          item_id: outputLine.item_id,
          warehouse_id: order.source_warehouse_id,
          current_stock: newStock,
          reserved_stock: 0,
          created_by: userId,
          updated_by: userId,
        });
      }

      // Update transformation_order_outputs
      await supabase
        .from("transformation_order_outputs")
        .update({
          produced_quantity: outputData.producedQuantity,
          wasted_quantity: outputData.wastedQuantity || 0,
          waste_reason: outputData.wasteReason || null,
          allocated_cost_per_unit: costPerUnit,
          total_allocated_cost: allocatedCost,
          stock_transaction_id: stockTransaction.id,
          updated_by: userId,
        })
        .eq("id", outputData.outputLineId);

      // 7b. Create waste transaction if waste quantity > 0
      if (outputData.wastedQuantity && outputData.wastedQuantity > 0) {
        // Get pre-normalized waste quantity
        const normalizedWaste = normalizedWasteMap.get(outputData.outputLineId);
        if (!normalizedWaste) {
          // Should not happen, but skip if missing
          continue;
        }

        const wasteCostPerUnit = costPerUnit; // Same cost allocation as good output
        const wasteTotalCost = wasteCostPerUnit * normalizedWaste.normalizedQty;

        // Create waste stock transaction (type='waste' or 'out' with waste notes)
        const { data: wasteTransaction, error: wasteTransactionError } = await supabase
          .from("stock_transactions")
          .insert({
            company_id: order.company_id,
            business_unit_id: order.business_unit_id,
            transaction_code: `ST-TRANS-WASTE-${order.order_code}-${outputIndex}`,
            transaction_type: "out", // Waste is recorded as outbound from a "virtual" waste location
            transaction_date: executionData.executionDate?.split("T")[0] || new Date().toISOString().split("T")[0],
            warehouse_id: order.source_warehouse_id,
            reference_type: "transformation_order",
            reference_id: orderId,
            reference_code: order.order_code,
            notes: `Transformation waste - ${outputData.wasteReason || 'No reason provided'} - ${order.order_code}`,
            status: "posted",
            created_by: userId,
            updated_by: userId,
          })
          .select()
          .single();

        if (wasteTransactionError || !wasteTransaction) {
          // Don't fail the entire transformation for waste tracking issues, but log it
        } else {
          wasteTransactionIds.push(wasteTransaction.id);

          // Create waste stock transaction item with normalization metadata
          const now = new Date();
          const postingDate = now.toISOString().split("T")[0];
          const postingTime = now.toTimeString().split(" ")[0];

          // Note: Waste doesn't physically exist in inventory, so we don't update qty_before/after
          // This is purely for cost accounting purposes
          await supabase.from("stock_transaction_items").insert({
            company_id: order.company_id,
            transaction_id: wasteTransaction.id,
            item_id: outputLine.item_id,
            // Normalization fields
            input_qty: normalizedWaste.inputQty,
            input_packaging_id: normalizedWaste.inputPackagingId,
            conversion_factor: normalizedWaste.conversionFactor,
            normalized_qty: normalizedWaste.normalizedQty,
            base_package_id: normalizedWaste.basePackageId,
            // Standard fields
            quantity: normalizedWaste.normalizedQty,
            uom_id: normalizedWaste.uomId,
            unit_cost: wasteCostPerUnit,
            total_cost: wasteTotalCost,
            // Audit fields (waste doesn't affect physical inventory)
            qty_before: 0,
            qty_after: 0,
            valuation_rate: wasteCostPerUnit,
            stock_value_before: 0,
            stock_value_after: 0,
            posting_date: postingDate,
            posting_time: postingTime,
            created_by: userId,
            updated_by: userId,
          });

          // Update output record with waste transaction reference
          await supabase
            .from("transformation_order_outputs")
            .update({
              stock_transaction_waste_id: wasteTransaction.id,
              updated_by: userId,
            })
            .eq("id", outputData.outputLineId);
        }
      }

      // 8. Record lineage (N→M relationships)
      for (const inputCost of inputCosts) {
        await supabase.from("transformation_lineage").insert({
          order_id: orderId,
          input_line_id: inputCost.inputLineId,
          output_line_id: outputData.outputLineId,
          input_quantity_used: executionData.inputs.find(
            (i) => i.inputLineId === inputCost.inputLineId
          )?.consumedQuantity || 0,
          output_quantity_from: outputData.producedQuantity,
          cost_attributed: allocatedCost * (inputCost.cost / totalInputCost),
        });
      }
    }

    // 9. Calculate actual total output cost and waste cost (using normalized quantities)
    let totalOutputCost = 0;
    let totalWasteCost = 0;

    for (let idx = 0; idx < executionData.outputs.length; idx++) {
      const output = executionData.outputs[idx];
      const outputLine = order.outputs.find((o: any) => o.id === output.outputLineId);
      if (outputLine?.is_scrap) continue; // Skip scrap items from cost calculation

      const costPerUnit = totalOutputQuantity > 0 ? totalInputCost / totalOutputQuantity : 0;

      // Cost of good output produced (use normalized quantity)
      const normalizedProducedQty = normalizedOutputs[idx]?.normalizedQty || 0;
      totalOutputCost += costPerUnit * normalizedProducedQty;

      // Cost of waste (this is the variance/loss) (use normalized quantity)
      const normalizedWaste = normalizedWasteMap.get(output.outputLineId);
      if (normalizedWaste) {
        totalWasteCost += costPerUnit * normalizedWaste.normalizedQty;
      }
    }

    // 10. Update order with costs and status
    // Cost variance = waste cost (you spent money on inputs that became waste)
    const costVariance = totalWasteCost;

    await supabase
      .from("transformation_orders")
      .update({
        total_input_cost: totalInputCost,
        total_output_cost: totalOutputCost,
        cost_variance: costVariance,
        updated_by: userId,
      })
      .eq("id", orderId);

    return {
      success: true,
      stockTransactionIds: {
        inputs: inputTransactionIds,
        outputs: outputTransactionIds,
        waste: wasteTransactionIds,
      },
    };
  } catch (error) {

    return { success: false, error: "Transformation execution failed" };
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
  } catch (error) {

    return { isLocked: false };
  }
}
