import { http, HttpResponse } from "msw";
import type { Supplier, CreateSupplierRequest, UpdateSupplierRequest } from "@/types/supplier";
import { suppliers } from "../data/suppliers";

const suppliersData = [...suppliers];

export const supplierHandlers = [
  // GET /api/suppliers
  http.get("/api/suppliers", ({ request }) => {
    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.toLowerCase();
    const status = url.searchParams.get("status");
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");

    let filtered = [...suppliersData];

    // Filter by search
    if (search) {
      filtered = filtered.filter(
        (supplier) =>
          supplier.code.toLowerCase().includes(search) ||
          supplier.name.toLowerCase().includes(search) ||
          supplier.email.toLowerCase().includes(search) ||
          supplier.phone.includes(search) ||
          supplier.contactPerson.toLowerCase().includes(search) ||
          supplier.billingCity.toLowerCase().includes(search)
      );
    }

    // Filter by status
    if (status && status !== "all") {
      filtered = filtered.filter((supplier) => supplier.status === status);
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

  // GET /api/suppliers/:id
  http.get("/api/suppliers/:id", ({ params }) => {
    const { id } = params;
    const supplier = suppliersData.find((s) => s.id === id);

    if (!supplier) {
      return new HttpResponse(null, { status: 404 });
    }

    return HttpResponse.json(supplier);
  }),

  // POST /api/suppliers
  http.post("/api/suppliers", async ({ request }) => {
    const body = (await request.json()) as CreateSupplierRequest;

    // Check if supplier code already exists
    const existingSupplier = suppliersData.find(
      (s) => s.code.toLowerCase() === body.code.toLowerCase()
    );

    if (existingSupplier) {
      return HttpResponse.json(
        { error: "Supplier code already exists" },
        { status: 400 }
      );
    }

    const newSupplier: Supplier = {
      id: `supp-${Date.now()}`,
      companyId: body.companyId,
      code: body.code,
      name: body.name,
      contactPerson: body.contactPerson,
      email: body.email,
      phone: body.phone,
      mobile: body.mobile,
      website: body.website,
      taxId: body.taxId,
      billingAddress: body.billingAddress,
      billingCity: body.billingCity,
      billingState: body.billingState,
      billingPostalCode: body.billingPostalCode,
      billingCountry: body.billingCountry,
      shippingAddress: body.shippingAddress,
      shippingCity: body.shippingCity,
      shippingState: body.shippingState,
      shippingPostalCode: body.shippingPostalCode,
      shippingCountry: body.shippingCountry,
      paymentTerms: body.paymentTerms,
      creditLimit: body.creditLimit,
      currentBalance: 0,
      bankName: body.bankName,
      bankAccountNumber: body.bankAccountNumber,
      bankAccountName: body.bankAccountName,
      status: body.status,
      notes: body.notes,
      createdBy: body.createdBy,
      createdByName: "Current User",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    suppliersData.push(newSupplier);

    return HttpResponse.json(newSupplier, { status: 201 });
  }),

  // PATCH /api/suppliers/:id
  http.patch("/api/suppliers/:id", async ({ params, request }) => {
    const { id } = params;
    const body = (await request.json()) as UpdateSupplierRequest;
    const index = suppliersData.findIndex((s) => s.id === id);

    if (index === -1) {
      return new HttpResponse(null, { status: 404 });
    }

    // Check if code is being changed and if it already exists
    if (body.code) {
      const existingSupplier = suppliersData.find(
        (s) => s.code.toLowerCase() === body.code.toLowerCase() && s.id !== id
      );

      if (existingSupplier) {
        return HttpResponse.json(
          { error: "Supplier code already exists" },
          { status: 400 }
        );
      }
    }

    const updatedSupplier: Supplier = {
      ...suppliersData[index],
      ...body,
      updatedAt: new Date().toISOString(),
    };

    suppliersData[index] = updatedSupplier;

    return HttpResponse.json(updatedSupplier);
  }),

  // DELETE /api/suppliers/:id
  http.delete("/api/suppliers/:id", ({ params }) => {
    const { id } = params;
    const index = suppliersData.findIndex((s) => s.id === id);

    if (index === -1) {
      return new HttpResponse(null, { status: 404 });
    }

    suppliersData.splice(index, 1);

    return new HttpResponse(null, { status: 204 });
  }),
];
