import { http, HttpResponse } from "msw";
import { mockItems, Item } from "../data/items";

// In-memory store for items (will reset on page refresh)
const items = [...mockItems];

export const itemHandlers = [
  // Get all items
  http.get("/api/items", ({ request }) => {
    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const itemType = url.searchParams.get("itemType");
    const isActiveParam = url.searchParams.get("isActive");

    // Filter items based on search, type, and status
    let filteredItems = items;

    if (search) {
      filteredItems = filteredItems.filter(
        (item) =>
          item.code.toLowerCase().includes(search.toLowerCase()) ||
          item.name.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (itemType) {
      filteredItems = filteredItems.filter((item) => item.itemType === itemType);
    }

    if (isActiveParam !== null) {
      const isActive = isActiveParam === "true";
      filteredItems = filteredItems.filter((item) => item.isActive === isActive);
    }

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedItems = filteredItems.slice(startIndex, endIndex);

    return HttpResponse.json({
      data: paginatedItems,
      pagination: {
        page,
        limit,
        total: filteredItems.length,
        totalPages: Math.ceil(filteredItems.length / limit),
      },
    });
  }),

  // Get single item
  http.get("/api/items/:id", ({ params }) => {
    const { id } = params;
    const item = items.find((i) => i.id === id);

    if (!item) {
      return HttpResponse.json({ message: "Item not found" }, { status: 404 });
    }

    return HttpResponse.json({ data: item });
  }),

  // Create item
  http.post("/api/items", async ({ request }) => {
    const body = (await request.json()) as Omit<Item, "id" | "createdAt" | "updatedAt">;

    const newItem: Item = {
      ...body,
      id: `item-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    items.push(newItem);

    return HttpResponse.json(
      { data: newItem, message: "Item created successfully" },
      { status: 201 }
    );
  }),

  // Update item
  http.put("/api/items/:id", async ({ params, request }) => {
    const { id } = params;
    const body = (await request.json()) as Partial<Item>;

    const itemIndex = items.findIndex((i) => i.id === id);

    if (itemIndex === -1) {
      return HttpResponse.json({ message: "Item not found" }, { status: 404 });
    }

    items[itemIndex] = {
      ...items[itemIndex],
      ...body,
      updatedAt: new Date().toISOString(),
    };

    return HttpResponse.json({
      data: items[itemIndex],
      message: "Item updated successfully",
    });
  }),

  // Delete item
  http.delete("/api/items/:id", ({ params }) => {
    const { id } = params;
    const itemIndex = items.findIndex((i) => i.id === id);

    if (itemIndex === -1) {
      return HttpResponse.json({ message: "Item not found" }, { status: 404 });
    }

    items.splice(itemIndex, 1);

    return HttpResponse.json({ message: "Item deleted successfully" });
  }),
];
