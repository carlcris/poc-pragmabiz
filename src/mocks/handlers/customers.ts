import { http, HttpResponse } from "msw";
import type { Customer, CreateCustomerRequest } from "@/types/customer";
import { customers } from "../data/customers";

const customersData = [...customers];

export const customerHandlers = [
  // GET /api/customers
  http.get("/api/customers", ({ request }) => {
    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.toLowerCase();
    const customerType = url.searchParams.get("customerType");
    const isActiveParam = url.searchParams.get("isActive");
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");

    let filtered = [...customersData];

    // Filter by search
    if (search) {
      filtered = filtered.filter(
        (customer) =>
          customer.code.toLowerCase().includes(search) ||
          customer.name.toLowerCase().includes(search) ||
          customer.email.toLowerCase().includes(search) ||
          customer.phone.includes(search) ||
          customer.billingCity.toLowerCase().includes(search)
      );
    }

    // Filter by customer type
    if (customerType && customerType !== "all") {
      filtered = filtered.filter((customer) => customer.customerType === customerType);
    }

    // Filter by active status
    if (isActiveParam !== null) {
      const isActive = isActiveParam === "true";
      filtered = filtered.filter((customer) => customer.isActive === isActive);
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

  // GET /api/customers/:id
  http.get("/api/customers/:id", ({ params }) => {
    const { id } = params;
    const customer = customersData.find((c) => c.id === id);

    if (!customer) {
      return new HttpResponse(null, { status: 404 });
    }

    return HttpResponse.json(customer);
  }),

  // POST /api/customers
  http.post("/api/customers", async ({ request }) => {
    const body = (await request.json()) as CreateCustomerRequest;

    const newCustomer: Customer = {
      id: `cust-${Date.now()}`,
      ...body,
      currentBalance: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    customersData.push(newCustomer);

    return HttpResponse.json(newCustomer, { status: 201 });
  }),

  // PUT /api/customers/:id
  http.put("/api/customers/:id", async ({ params, request }) => {
    const { id } = params;
    const body = await request.json();
    const index = customersData.findIndex((c) => c.id === id);

    if (index === -1) {
      return new HttpResponse(null, { status: 404 });
    }

    const updatedCustomer: Customer = {
      ...customersData[index],
      ...(body as Partial<Customer>),
      updatedAt: new Date().toISOString(),
    };

    customersData[index] = updatedCustomer;

    return HttpResponse.json(updatedCustomer);
  }),

  // DELETE /api/customers/:id
  http.delete("/api/customers/:id", ({ params }) => {
    const { id } = params;
    const index = customersData.findIndex((c) => c.id === id);

    if (index === -1) {
      return new HttpResponse(null, { status: 404 });
    }

    customersData.splice(index, 1);

    return new HttpResponse(null, { status: 204 });
  }),
];
