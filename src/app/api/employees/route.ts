import { NextRequest, NextResponse } from "next/server";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { requirePermission, requireLookupDataAccess } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

type EmployeeLocationRow = {
  city: string | null;
  region_state: string | null;
};

type EmployeeRow = {
  id: string;
  company_id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  role: string;
  department: string | null;
  hire_date: string;
  commission_rate: number | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  region_state: string | null;
  country: string;
  postal_code: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  employment_status: string;
  is_active: boolean;
  employee_distribution_locations?: EmployeeLocationRow[] | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
};

// Helper function to transform employee data to camelCase
function transformEmployee(emp: EmployeeRow) {
  const territories = (emp.employee_distribution_locations || []).map((loc) =>
    loc.city ? `${loc.city}, ${loc.region_state}` : loc.region_state || ""
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

// GET /api/employees - List employees with filters
export const GET = async (req: NextRequest) => {
  try {
    // Check permission using Lookup Data Access Pattern
    // User can access if they have EITHER:
    // 1. Direct 'employees' view permission, OR
    // 2. Permission to a feature that depends on employees (sales_orders, sales_quotations, sales_invoices)
    const unauthorized = await requireLookupDataAccess(RESOURCES.EMPLOYEES);
    if (unauthorized) return unauthorized;
    const { supabase } = await createServerClientWithBU();

    // Get query parameters
    const searchParams = req.nextUrl.searchParams;
    const search = searchParams.get("search");
    const role = searchParams.get("role");
    const employmentStatus = searchParams.get("employmentStatus");
    const city = searchParams.get("city");
    const regionState = searchParams.get("regionState");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    // Start building query
    let query = supabase
      .from("employees")
      .select("*, employee_distribution_locations(*)", { count: "exact" })
      .is("deleted_at", null)
      .order("employee_code", { ascending: true });

    // Apply filters
    if (search) {
      query = query.or(
        `employee_code.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`
      );
    }

    if (role) {
      query = query.eq("role", role);
    }

    if (employmentStatus) {
      query = query.eq("employment_status", employmentStatus);
    }

    if (city) {
      query = query.eq("city", city);
    }

    if (regionState) {
      query = query.eq("region_state", regionState);
    }

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch employees", details: error.message },
        { status: 500 }
      );
    }

    // Transform data to camelCase and format territories
    const transformedData = (data || []).map(transformEmployee);

    return NextResponse.json({
      data: transformedData,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
};

// POST /api/employees - Create new employee
export const POST = async (req: NextRequest) => {
  try {
    await requirePermission(RESOURCES.EMPLOYEES, "create");
    const { supabase } = await createServerClientWithBU();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's company_id
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();

    // Validate required fields
    if (
      !body.employeeCode ||
      !body.firstName ||
      !body.lastName ||
      !body.email ||
      !body.role ||
      !body.hireDate
    ) {
      return NextResponse.json(
        {
          error: "Missing required fields",
          required: ["employeeCode", "firstName", "lastName", "email", "role", "hireDate"],
        },
        { status: 400 }
      );
    }

    // Check for duplicate employee code
    const { data: existing } = await supabase
      .from("employees")
      .select("id")
      .eq("company_id", userData.company_id)
      .eq("employee_code", body.employeeCode)
      .is("deleted_at", null)
      .single();

    if (existing) {
      return NextResponse.json({ error: "Employee code already exists" }, { status: 409 });
    }

    // Insert employee
    const { data, error } = await supabase
      .from("employees")
      .insert({
        company_id: userData.company_id,
        employee_code: body.employeeCode,
        first_name: body.firstName,
        last_name: body.lastName,
        email: body.email,
        phone: body.phone || null,
        role: body.role,
        department: body.department || null,
        hire_date: body.hireDate,
        commission_rate: body.commissionRate || 5.0,
        address_line1: body.addressLine1 || null,
        address_line2: body.addressLine2 || null,
        city: body.city || null,
        region_state: body.regionState || null,
        country: body.country || "Philippines",
        postal_code: body.postalCode || null,
        emergency_contact_name: body.emergencyContactName || null,
        emergency_contact_phone: body.emergencyContactPhone || null,
        employment_status: body.employmentStatus || "active",
        is_active: body.isActive !== undefined ? body.isActive : true,
        created_by: user.id,
        updated_by: user.id,
      })
      .select("*, employee_distribution_locations(*)")
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to create employee", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: transformEmployee(data) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
};
