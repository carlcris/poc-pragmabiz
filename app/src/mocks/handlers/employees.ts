import { http, HttpResponse } from "msw";
import type {
  Employee,
  CreateEmployeeRequest,
  UpdateEmployeeRequest,
  EmployeeDistributionLocation,
  CreateTerritoryRequest,
  UpdateTerritoryRequest,
} from "@/types/employee";
import {
  employees,
  employeeDistributionLocations,
} from "../data/employees";

let employeesData = [...employees];
let territoriesData = [...employeeDistributionLocations];

export const employeeHandlers = [
  // GET /api/employees
  http.get("/api/employees", ({ request }) => {
    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.toLowerCase();
    const role = url.searchParams.get("role");
    const employmentStatus = url.searchParams.get("employmentStatus");
    const city = url.searchParams.get("city");
    const regionState = url.searchParams.get("regionState");
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");

    let filtered = [...employeesData];

    // Filter by search (code, name, email)
    if (search) {
      filtered = filtered.filter(
        (employee) =>
          employee.employeeCode.toLowerCase().includes(search) ||
          employee.firstName.toLowerCase().includes(search) ||
          employee.lastName.toLowerCase().includes(search) ||
          employee.email.toLowerCase().includes(search) ||
          `${employee.firstName} ${employee.lastName}`.toLowerCase().includes(search)
      );
    }

    // Filter by role
    if (role) {
      filtered = filtered.filter((employee) => employee.role === role);
    }

    // Filter by employment status
    if (employmentStatus) {
      filtered = filtered.filter((employee) => employee.employmentStatus === employmentStatus);
    }

    // Filter by city
    if (city) {
      filtered = filtered.filter((employee) => employee.city === city);
    }

    // Filter by region/state
    if (regionState) {
      filtered = filtered.filter((employee) => employee.regionState === regionState);
    }

    // Sort by updatedAt (newest first)
    filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    // Pagination
    const total = filtered.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedData = filtered.slice(start, end);

    return HttpResponse.json({
      data: paginatedData,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    });
  }),

  // GET /api/employees/:id
  http.get("/api/employees/:id", ({ params }) => {
    const { id } = params;
    const employee = employeesData.find((e) => e.id === id);

    if (!employee) {
      return new HttpResponse(null, { status: 404 });
    }

    return HttpResponse.json(employee);
  }),

  // POST /api/employees
  http.post("/api/employees", async ({ request }) => {
    const body = (await request.json()) as CreateEmployeeRequest;

    const newEmployee: Employee = {
      id: `emp-${Date.now()}`,
      companyId: "company-1",
      ...body,
      employmentStatus: body.employmentStatus || "active",
      commissionRate: body.commissionRate || 5.0,
      country: body.country || "Philippines",
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    employeesData.push(newEmployee);

    return HttpResponse.json(newEmployee, { status: 201 });
  }),

  // PUT /api/employees/:id
  http.put("/api/employees/:id", async ({ params, request }) => {
    const { id } = params;
    const body = (await request.json()) as UpdateEmployeeRequest;
    const index = employeesData.findIndex((e) => e.id === id);

    if (index === -1) {
      return new HttpResponse(null, { status: 404 });
    }

    const updatedEmployee: Employee = {
      ...employeesData[index],
      ...body,
      updatedAt: new Date().toISOString(),
    };

    employeesData[index] = updatedEmployee;

    return HttpResponse.json(updatedEmployee);
  }),

  // DELETE /api/employees/:id
  http.delete("/api/employees/:id", ({ params }) => {
    const { id } = params;
    const index = employeesData.findIndex((e) => e.id === id);

    if (index === -1) {
      return new HttpResponse(null, { status: 404 });
    }

    employeesData.splice(index, 1);

    return new HttpResponse(null, { status: 204 });
  }),

  // GET /api/employees/:id/territories
  http.get("/api/employees/:employeeId/territories", ({ params }) => {
    const { employeeId } = params;
    const territories = territoriesData.filter((t) => t.employeeId === employeeId);

    return HttpResponse.json({
      data: territories,
    });
  }),

  // POST /api/employees/:id/territories
  http.post("/api/employees/:employeeId/territories", async ({ params, request }) => {
    const { employeeId } = params;
    const body = (await request.json()) as CreateTerritoryRequest;

    // Check if employee exists
    const employee = employeesData.find((e) => e.id === employeeId);
    if (!employee) {
      return new HttpResponse(null, { status: 404 });
    }

    // If isPrimary is true, set other territories for this employee to false
    if (body.isPrimary) {
      territoriesData = territoriesData.map((t) =>
        t.employeeId === employeeId ? { ...t, isPrimary: false } : t
      );
    }

    const newTerritory: EmployeeDistributionLocation = {
      id: `edl-${Date.now()}`,
      companyId: "company-1",
      employeeId: employeeId as string,
      ...body,
      isPrimary: body.isPrimary || false,
      assignedDate: new Date().toISOString().split("T")[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    territoriesData.push(newTerritory);

    return HttpResponse.json(newTerritory, { status: 201 });
  }),

  // PUT /api/employees/:employeeId/territories/:territoryId
  http.put("/api/employees/:employeeId/territories/:territoryId", async ({ params, request }) => {
    const { employeeId, territoryId } = params;
    const body = (await request.json()) as UpdateTerritoryRequest;
    const index = territoriesData.findIndex((t) => t.id === territoryId && t.employeeId === employeeId);

    if (index === -1) {
      return new HttpResponse(null, { status: 404 });
    }

    // If isPrimary is true, set other territories for this employee to false
    if (body.isPrimary) {
      territoriesData = territoriesData.map((t) =>
        t.employeeId === employeeId && t.id !== territoryId
          ? { ...t, isPrimary: false }
          : t
      );
    }

    const updatedTerritory: EmployeeDistributionLocation = {
      ...territoriesData[index],
      ...body,
      updatedAt: new Date().toISOString(),
    };

    territoriesData[index] = updatedTerritory;

    return HttpResponse.json(updatedTerritory);
  }),

  // DELETE /api/employees/:employeeId/territories/:territoryId
  http.delete("/api/employees/:employeeId/territories/:territoryId", ({ params }) => {
    const { employeeId, territoryId } = params;
    const index = territoriesData.findIndex((t) => t.id === territoryId && t.employeeId === employeeId);

    if (index === -1) {
      return new HttpResponse(null, { status: 404 });
    }

    territoriesData.splice(index, 1);

    return new HttpResponse(null, { status: 204 });
  }),

  // GET /api/employees/:id/performance
  http.get("/api/employees/:employeeId/performance", ({ params, request }) => {
    const { employeeId } = params;
    const url = new URL(request.url);
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");

    const employee = employeesData.find((e) => e.id === employeeId);
    if (!employee) {
      return new HttpResponse(null, { status: 404 });
    }

    // Mock performance data
    const performance = {
      employee,
      totalSales: 450000.0,
      totalCommission: 22500.0,
      transactionCount: 25,
      averageOrderValue: 18000.0,
      period: {
        startDate: startDate || "2025-10-01",
        endDate: endDate || "2025-10-31",
      },
    };

    return HttpResponse.json(performance);
  }),
];
