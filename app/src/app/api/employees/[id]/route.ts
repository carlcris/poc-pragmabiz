import { NextRequest, NextResponse } from "next/server";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { requirePermission } from '@/lib/auth';
import { RESOURCES } from '@/constants/resources';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

// Helper function to transform employee data to camelCase
function transformEmployee(emp: any) {
  const territories = (emp.employee_distribution_locations || []).map((loc: any) =>
    loc.city ? `${loc.city}, ${loc.region_state}` : loc.region_state
  );

  return {
    id: emp.id,
    companyId: emp.company_id,
    employeeCode: emp.employee_code,
    firstName: emp.first_name,
    lastName: emp.last_name,
    email: emp.email,
    phone: emp.phone,
    role: emp.role,
    department: emp.department,
    hireDate: emp.hire_date,
    commissionRate: emp.commission_rate,
    addressLine1: emp.address_line1,
    addressLine2: emp.address_line2,
    city: emp.city,
    regionState: emp.region_state,
    country: emp.country,
    postalCode: emp.postal_code,
    emergencyContactName: emp.emergency_contact_name,
    emergencyContactPhone: emp.emergency_contact_phone,
    employmentStatus: emp.employment_status,
    isActive: emp.is_active,
    territories,
    createdAt: emp.created_at,
    updatedAt: emp.updated_at,
    createdBy: emp.created_by,
    updatedBy: emp.updated_by,
  };
}

// GET /api/employees/[id] - Get employee by ID
export const GET = async (
  req: NextRequest,
  context: RouteContext
) => {
  try {
    await requirePermission(RESOURCES.EMPLOYEES, 'view');
    const { id } = await context.params;
    const { supabase } = await createServerClientWithBU();

    const { data, error } = await supabase
      .from("employees")
      .select("*, employee_distribution_locations(*)")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error) {

      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: transformEmployee(data) });
  } catch (error) {

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
};

// PUT /api/employees/[id] - Update employee
export const PUT = async (
  req: NextRequest,
  context: RouteContext
) => {
  try {
    await requirePermission(RESOURCES.EMPLOYEES, 'edit');
    const { id } = await context.params;
    const { supabase } = await createServerClientWithBU();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    // Only include fields that are provided
    if (body.employeeCode !== undefined)
      updateData.employee_code = body.employeeCode;
    if (body.firstName !== undefined) updateData.first_name = body.firstName;
    if (body.lastName !== undefined) updateData.last_name = body.lastName;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.role !== undefined) updateData.role = body.role;
    if (body.department !== undefined) updateData.department = body.department;
    if (body.hireDate !== undefined) updateData.hire_date = body.hireDate;
    if (body.terminationDate !== undefined)
      updateData.termination_date = body.terminationDate;
    if (body.employmentStatus !== undefined)
      updateData.employment_status = body.employmentStatus;
    if (body.commissionRate !== undefined)
      updateData.commission_rate = body.commissionRate;
    if (body.addressLine1 !== undefined)
      updateData.address_line1 = body.addressLine1;
    if (body.addressLine2 !== undefined)
      updateData.address_line2 = body.addressLine2;
    if (body.city !== undefined) updateData.city = body.city;
    if (body.regionState !== undefined)
      updateData.region_state = body.regionState;
    if (body.country !== undefined) updateData.country = body.country;
    if (body.postalCode !== undefined)
      updateData.postal_code = body.postalCode;
    if (body.emergencyContactName !== undefined)
      updateData.emergency_contact_name = body.emergencyContactName;
    if (body.emergencyContactPhone !== undefined)
      updateData.emergency_contact_phone = body.emergencyContactPhone;
    if (body.isActive !== undefined) updateData.is_active = body.isActive;

    // Update employee
    const { data, error } = await supabase
      .from("employees")
      .update(updateData)
      .eq("id", id)
      .is("deleted_at", null)
      .select("*, employee_distribution_locations(*)")
      .single();

    if (error) {

      return NextResponse.json(
        { error: "Failed to update employee", details: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: transformEmployee(data) });
  } catch (error) {

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
};

// DELETE /api/employees/[id] - Soft delete employee
export const DELETE = async (
  req: NextRequest,
  context: RouteContext
) => {
  try {
    await requirePermission(RESOURCES.EMPLOYEES, 'delete');
    const { id } = await context.params;
    const { supabase } = await createServerClientWithBU();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Soft delete by setting deleted_at
    const { data, error } = await supabase
      .from("employees")
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: user.id,
        is_active: false,
      })
      .eq("id", id)
      .is("deleted_at", null)
      .select("*, employee_distribution_locations(*)")
      .single();

    if (error) {

      return NextResponse.json(
        { error: "Failed to delete employee", details: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: transformEmployee(data) });
  } catch (error) {

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
};
