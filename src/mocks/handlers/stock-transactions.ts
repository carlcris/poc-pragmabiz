import { http, HttpResponse } from "msw";
import type { CreateStockTransactionRequest, StockTransaction } from "@/types/stock-transaction";
import { stockTransactions } from "../data/stock-transactions";
import { mockItems as items } from "../data/items";
import { warehouses } from "../data/warehouses";

const transactionsData = [...stockTransactions];

export const stockTransactionHandlers = [
  // GET /api/stock-transactions
  http.get("/api/stock-transactions", ({ request }) => {
    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.toLowerCase();
    const transactionType = url.searchParams.get("transactionType");
    const itemId = url.searchParams.get("itemId");
    const warehouseId = url.searchParams.get("warehouseId");
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");

    let filtered = [...transactionsData];

    // Filter by search
    if (search) {
      filtered = filtered.filter(
        (txn) =>
          txn.itemCode.toLowerCase().includes(search) ||
          txn.itemName.toLowerCase().includes(search) ||
          txn.warehouseCode.toLowerCase().includes(search) ||
          txn.referenceNumber?.toLowerCase().includes(search)
      );
    }

    // Filter by transaction type
    if (transactionType && transactionType !== "all") {
      filtered = filtered.filter((txn) => txn.transactionType === transactionType);
    }

    // Filter by item
    if (itemId) {
      filtered = filtered.filter((txn) => txn.itemId === itemId);
    }

    // Filter by warehouse
    if (warehouseId) {
      filtered = filtered.filter(
        (txn) => txn.warehouseId === warehouseId || txn.toWarehouseId === warehouseId
      );
    }

    // Filter by date range
    if (startDate) {
      filtered = filtered.filter((txn) => txn.transactionDate >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter((txn) => txn.transactionDate <= endDate);
    }

    // Sort by transactionDate (newest first)
    filtered.sort(
      (a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime()
    );

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

  // GET /api/stock-transactions/:id
  http.get("/api/stock-transactions/:id", ({ params }) => {
    const { id } = params;
    const transaction = transactionsData.find((txn) => txn.id === id);

    if (!transaction) {
      return new HttpResponse(null, { status: 404 });
    }

    return HttpResponse.json(transaction);
  }),

  // POST /api/stock-transactions
  http.post("/api/stock-transactions", async ({ request }) => {
    const body = (await request.json()) as CreateStockTransactionRequest;

    // Find item and warehouse details
    const item = items.find((i) => i.id === body.itemId);
    const warehouse = warehouses.find((w) => w.id === body.warehouseId);
    const toWarehouse = body.toWarehouseId
      ? warehouses.find((w) => w.id === body.toWarehouseId)
      : undefined;

    if (!item) {
      return HttpResponse.json({ error: "Item not found" }, { status: 400 });
    }

    if (!warehouse) {
      return HttpResponse.json({ error: "Warehouse not found" }, { status: 400 });
    }

    // Validate stock for "out" and "transfer" transactions
    if (body.transactionType === "out" || body.transactionType === "transfer") {
      // Calculate current stock balance
      let currentBalance = 0;

      transactionsData.forEach((txn) => {
        if (txn.itemId === body.itemId && txn.warehouseId === body.warehouseId) {
          if (txn.transactionType === "in" || txn.transactionType === "adjustment") {
            currentBalance += txn.quantity;
          } else if (txn.transactionType === "out") {
            currentBalance -= txn.quantity;
          } else if (txn.transactionType === "transfer") {
            currentBalance -= txn.quantity;
          }
        }
        // Add incoming transfers
        if (
          txn.transactionType === "transfer" &&
          txn.toWarehouseId === body.warehouseId &&
          txn.itemId === body.itemId
        ) {
          currentBalance += txn.quantity;
        }
      });

      // Check if sufficient stock available
      if (currentBalance < body.quantity) {
        return HttpResponse.json(
          {
            error: `Insufficient stock. Available: ${currentBalance} ${item.uom}, Requested: ${body.quantity} ${item.uom}`,
          },
          { status: 400 }
        );
      }
    }

    const newTransaction: StockTransaction = {
      id: `st-${Date.now()}`,
      ...body,
      itemCode: item.code,
      itemName: item.name,
      warehouseCode: warehouse.code,
      warehouseName: warehouse.name,
      toWarehouseCode: toWarehouse?.code,
      toWarehouseName: toWarehouse?.name,
      uom: item.uom,
      createdByName: "Current User",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    transactionsData.unshift(newTransaction);

    return HttpResponse.json(newTransaction, { status: 201 });
  }),

  // GET /api/stock-balances
  http.get("/api/stock-balances", ({ request }) => {
    const url = new URL(request.url);
    const warehouseId = url.searchParams.get("warehouseId");
    const itemId = url.searchParams.get("itemId");

    // Calculate stock balances from transactions
    const balances = new Map<
      string,
      {
        quantity: number;
        itemId: string;
        itemCode: string;
        itemName: string;
        warehouseId: string;
        warehouseCode: string;
        warehouseName: string;
        uom: string;
      }
    >();

    transactionsData.forEach((txn) => {
      const key = `${txn.itemId}-${txn.warehouseId}`;

      if (!balances.has(key)) {
        balances.set(key, {
          quantity: 0,
          itemId: txn.itemId,
          itemCode: txn.itemCode,
          itemName: txn.itemName,
          warehouseId: txn.warehouseId,
          warehouseCode: txn.warehouseCode,
          warehouseName: txn.warehouseName,
          uom: txn.uom,
        });
      }

      const balance = balances.get(key)!;

      if (txn.transactionType === "in" || txn.transactionType === "adjustment") {
        balance.quantity += txn.quantity;
      } else if (txn.transactionType === "out") {
        balance.quantity -= txn.quantity;
      } else if (txn.transactionType === "transfer") {
        balance.quantity -= txn.quantity;

        // Add to destination warehouse
        if (txn.toWarehouseId) {
          const toKey = `${txn.itemId}-${txn.toWarehouseId}`;
          if (!balances.has(toKey)) {
            balances.set(toKey, {
              quantity: 0,
              itemId: txn.itemId,
              itemCode: txn.itemCode,
              itemName: txn.itemName,
              warehouseId: txn.toWarehouseId,
              warehouseCode: txn.toWarehouseCode || "",
              warehouseName: txn.toWarehouseName || "",
              uom: txn.uom,
            });
          }
          balances.get(toKey)!.quantity += txn.quantity;
        }
      }
    });

    let result = Array.from(balances.values()).map((b) => ({
      ...b,
      lastUpdated: new Date().toISOString(),
    }));

    // Filter by warehouse
    if (warehouseId) {
      result = result.filter((b) => b.warehouseId === warehouseId);
    }

    // Filter by item
    if (itemId) {
      result = result.filter((b) => b.itemId === itemId);
    }

    return HttpResponse.json(result);
  }),
];
