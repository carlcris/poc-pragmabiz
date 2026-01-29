import { createClient } from "@/lib/supabase/server";

type CommissionCalculationResult = {
  success: boolean;
  commissionTotal: number;
  employeeId: string | null;
  error?: string;
};

/**
 * Calculate and create commission records for an invoice
 * This function is called when:
 * 1. An invoice is created/posted
 * 2. An invoice employee assignment is made
 */
export const calculateInvoiceCommission = async (
  invoiceId: string,
  employeeId?: string
): Promise<CommissionCalculationResult> => {
  try {
    const supabase = await createClient();

    // Get invoice details
    const { data: invoice, error: invoiceError } = await supabase
      .from("sales_invoices")
      .select("id, company_id, total_amount, primary_employee_id, customer_id")
      .eq("id", invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return {
        success: false,
        commissionTotal: 0,
        employeeId: null,
        error: "Invoice not found",
      };
    }

    // Determine which employee to use
    const targetEmployeeId = employeeId || invoice.primary_employee_id;

    if (!targetEmployeeId) {
      // Try to auto-assign based on customer location
      const assigned = await autoAssignEmployeeToInvoice(
        invoiceId,
        invoice.customer_id,
        invoice.company_id,
        supabase
      );
      if (!assigned.success) {
        return {
          success: false,
          commissionTotal: 0,
          employeeId: null,
          error: "No employee assigned and auto-assignment failed",
        };
      }
      return assigned;
    }

    // Get employee commission rate
    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .select("id, commission_rate")
      .eq("id", targetEmployeeId)
      .is("deleted_at", null)
      .single();

    if (employeeError || !employee) {
      return {
        success: false,
        commissionTotal: 0,
        employeeId: null,
        error: "Employee not found",
      };
    }

    // Calculate commission
    const commissionRate = Number(employee.commission_rate) / 100; // Convert percentage to decimal
    const totalAmount = Number(invoice.total_amount);
    const commissionAmount = totalAmount * commissionRate;

    // Check if commission record already exists
    const { data: existing } = await supabase
      .from("invoice_employees")
      .select("id")
      .eq("invoice_id", invoiceId)
      .eq("employee_id", targetEmployeeId)
      .single();

    if (existing) {
      // Update existing commission record
      await supabase
        .from("invoice_employees")
        .update({
          commission_split_percentage: 100.0,
          commission_amount: commissionAmount,
        })
        .eq("id", existing.id);
    } else {
      // Create new commission record
      const { data: userData } = await supabase.auth.getUser();

      await supabase.from("invoice_employees").insert({
        company_id: invoice.company_id,
        invoice_id: invoiceId,
        employee_id: targetEmployeeId,
        commission_split_percentage: 100.0,
        commission_amount: commissionAmount,
        created_by: userData.user?.id || null,
      });
    }

    // Update invoice with commission total and primary employee
    await supabase
      .from("sales_invoices")
      .update({
        primary_employee_id: targetEmployeeId,
        commission_total: commissionAmount,
        commission_split_count: 1,
      })
      .eq("id", invoiceId);

    return {
      success: true,
      commissionTotal: commissionAmount,
      employeeId: targetEmployeeId,
    };
  } catch (error) {
    return {
      success: false,
      commissionTotal: 0,
      employeeId: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

/**
 * Auto-assign employee to invoice based on customer location
 */
const autoAssignEmployeeToInvoice = async (
  invoiceId: string,
  customerId: string,
  companyId: string,
  supabase: ReturnType<typeof createClient>
): Promise<CommissionCalculationResult> => {
  try {
    // Get customer location
    const { data: customer } = await supabase
      .from("customers")
      .select("billing_city, billing_state")
      .eq("id", customerId)
      .single();

    if (!customer || (!customer.billing_city && !customer.billing_state)) {
      return {
        success: false,
        commissionTotal: 0,
        employeeId: null,
        error: "Customer location not found",
      };
    }

    // Find employee assigned to this territory (prioritize primary territory)
    let query = supabase
      .from("employee_distribution_locations")
      .select("employee_id, employees!inner(id, commission_rate, is_active)")
      .eq("company_id", companyId)
      .is("deleted_at", null);

    if (customer.billing_city) {
      query = query.eq("city", customer.billing_city);
    } else if (customer.billing_state) {
      query = query.eq("region_state", customer.billing_state);
    }

    query = query.order("is_primary", { ascending: false }).limit(1);

    const { data: territories } = await query;

    if (!territories || territories.length === 0) {
      // No employee found for this territory, assign to first active sales agent
      const { data: defaultEmployee } = await supabase
        .from("employees")
        .select("id, commission_rate")
        .eq("company_id", companyId)
        .eq("role", "sales_agent")
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(1)
        .single();

      if (!defaultEmployee) {
        return {
          success: false,
          commissionTotal: 0,
          employeeId: null,
          error: "No active sales agents found",
        };
      }

      // Calculate commission and create record
      return await calculateInvoiceCommission(invoiceId, defaultEmployee.id);
    }

    const assignedEmployee = territories[0].employees;
    if (!assignedEmployee.is_active) {
      return {
        success: false,
        commissionTotal: 0,
        employeeId: null,
        error: "Assigned employee is not active",
      };
    }

    // Calculate commission for the assigned employee
    return await calculateInvoiceCommission(invoiceId, territories[0].employee_id);
  } catch (error) {
    return {
      success: false,
      commissionTotal: 0,
      employeeId: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

/**
 * Split commission between multiple employees
 */
export const splitCommission = async (
  invoiceId: string,
  splits: Array<{ employeeId: string; percentage: number }>
): Promise<CommissionCalculationResult> => {
  try {
    const supabase = await createClient();

    // Validate percentages sum to 100
    const totalPercentage = splits.reduce((sum, split) => sum + split.percentage, 0);
    if (Math.abs(totalPercentage - 100) > 0.01) {
      return {
        success: false,
        commissionTotal: 0,
        employeeId: null,
        error: "Commission split percentages must sum to 100%",
      };
    }

    // Get invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from("sales_invoices")
      .select("id, company_id, total_amount")
      .eq("id", invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return {
        success: false,
        commissionTotal: 0,
        employeeId: null,
        error: "Invoice not found",
      };
    }

    const totalAmount = Number(invoice.total_amount);
    let totalCommission = 0;

    const { data: userData } = await supabase.auth.getUser();

    // Delete existing commission records
    await supabase.from("invoice_employees").delete().eq("invoice_id", invoiceId);

    // Create commission records for each split
    for (const split of splits) {
      // Get employee commission rate
      const { data: employee } = await supabase
        .from("employees")
        .select("id, commission_rate")
        .eq("id", split.employeeId)
        .is("deleted_at", null)
        .single();

      if (!employee) continue;

      const commissionRate = Number(employee.commission_rate) / 100;
      const splitAmount = totalAmount * (split.percentage / 100);
      const commissionAmount = splitAmount * commissionRate;
      totalCommission += commissionAmount;

      await supabase.from("invoice_employees").insert({
        company_id: invoice.company_id,
        invoice_id: invoiceId,
        employee_id: split.employeeId,
        commission_split_percentage: split.percentage,
        commission_amount: commissionAmount,
        created_by: userData.user?.id || null,
      });
    }

    // Update invoice
    await supabase
      .from("sales_invoices")
      .update({
        primary_employee_id: splits[0].employeeId,
        commission_total: totalCommission,
        commission_split_count: splits.length,
      })
      .eq("id", invoiceId);

    return {
      success: true,
      commissionTotal: totalCommission,
      employeeId: splits[0].employeeId,
    };
  } catch (error) {
    return {
      success: false,
      commissionTotal: 0,
      employeeId: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};
