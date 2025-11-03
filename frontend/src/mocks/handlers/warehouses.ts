import { http, HttpResponse } from "msw";
import type { Warehouse, CreateWarehouseRequest } from "@/types/warehouse";
import { warehouses } from "../data/warehouses";

let warehousesData = [...warehouses];

export const warehouseHandlers = [
  // GET /api/warehouses
  http.get("/api/warehouses", ({ request }) => {
    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.toLowerCase();
    const isActiveParam = url.searchParams.get("isActive");
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");

    let filtered = [...warehousesData];

    // Filter by search
    if (search) {
      filtered = filtered.filter(
        (wh) =>
          wh.code.toLowerCase().includes(search) ||
          wh.name.toLowerCase().includes(search) ||
          wh.city.toLowerCase().includes(search) ||
          wh.state.toLowerCase().includes(search)
      );
    }

    // Filter by active status
    if (isActiveParam !== null) {
      const isActive = isActiveParam === "true";
      filtered = filtered.filter((wh) => wh.isActive === isActive);
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

  // GET /api/warehouses/:id
  http.get("/api/warehouses/:id", ({ params }) => {
    const { id } = params;
    const warehouse = warehousesData.find((wh) => wh.id === id);

    if (!warehouse) {
      return new HttpResponse(null, { status: 404 });
    }

    return HttpResponse.json(warehouse);
  }),

  // POST /api/warehouses
  http.post("/api/warehouses", async ({ request }) => {
    const body = (await request.json()) as CreateWarehouseRequest;

    const newWarehouse: Warehouse = {
      id: `wh-${Date.now()}`,
      ...body,
      managerName: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    warehousesData.push(newWarehouse);

    return HttpResponse.json(newWarehouse, { status: 201 });
  }),

  // PUT /api/warehouses/:id
  http.put("/api/warehouses/:id", async ({ params, request }) => {
    const { id } = params;
    const body = await request.json();
    const index = warehousesData.findIndex((wh) => wh.id === id);

    if (index === -1) {
      return new HttpResponse(null, { status: 404 });
    }

    const updatedWarehouse: Warehouse = {
      ...warehousesData[index],
      ...(body as Partial<Warehouse>),
      updatedAt: new Date().toISOString(),
    };

    warehousesData[index] = updatedWarehouse;

    return HttpResponse.json(updatedWarehouse);
  }),

  // DELETE /api/warehouses/:id
  http.delete("/api/warehouses/:id", ({ params }) => {
    const { id } = params;
    const index = warehousesData.findIndex((wh) => wh.id === id);

    if (index === -1) {
      return new HttpResponse(null, { status: 404 });
    }

    warehousesData.splice(index, 1);

    return new HttpResponse(null, { status: 204 });
  }),
];
