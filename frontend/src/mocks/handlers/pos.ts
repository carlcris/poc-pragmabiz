import { http, HttpResponse } from "msw";
import { mockPOSTransactions } from "../data/pos";
import type { POSTransaction, POSTransactionCreate } from "@/types/pos";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";

let transactions = [...mockPOSTransactions];

export const posHandlers = [
  // Get all POS transactions
  http.get(`${API_BASE}/pos/transactions`, ({ request }) => {
    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.toLowerCase() || "";
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");

    let filtered = transactions.filter((txn) => {
      const searchMatch =
        !search ||
        txn.transactionNumber.toLowerCase().includes(search) ||
        txn.customerName?.toLowerCase().includes(search) ||
        txn.cashierName.toLowerCase().includes(search);

      return searchMatch;
    });

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

  // Get single POS transaction
  http.get(`${API_BASE}/pos/transactions/:id`, ({ params }) => {
    const { id } = params;
    const transaction = transactions.find((t) => t.id === id);

    if (!transaction) {
      return HttpResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    return HttpResponse.json(transaction);
  }),

  // Create POS transaction
  http.post(`${API_BASE}/pos/transactions`, async ({ request }) => {
    const data = (await request.json()) as POSTransactionCreate;

    // Calculate totals
    const subtotal = data.items.reduce((sum, item) => sum + item.lineTotal, 0);
    const totalDiscount = data.items.reduce((sum, item) => sum + item.discount, 0);
    const taxRate = 0.12;
    const totalTax = Math.round((subtotal - totalDiscount) * taxRate);
    const totalAmount = subtotal - totalDiscount + totalTax;
    const amountPaid = data.payments.reduce((sum, payment) => sum + payment.amount, 0);
    const changeAmount = amountPaid - totalAmount;

    const newTransaction: POSTransaction = {
      id: `pos-${transactions.length + 1}`,
      companyId: "company-1",
      transactionNumber: `POS-2025-${String(transactions.length + 1).padStart(4, "0")}`,
      transactionDate: new Date().toISOString(),
      customerId: data.customerId,
      customerName: data.customerId ? "Walk-in Customer" : undefined,
      items: data.items.map((item, index) => ({
        ...item,
        id: `pos-item-${transactions.length + 1}-${index}`,
      })),
      subtotal,
      totalDiscount,
      taxRate,
      totalTax,
      totalAmount,
      payments: data.payments,
      amountPaid,
      changeAmount: changeAmount > 0 ? changeAmount : 0,
      status: "completed",
      cashierId: "user-1",
      cashierName: "Current User",
      notes: data.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    transactions.unshift(newTransaction);
    return HttpResponse.json(newTransaction, { status: 201 });
  }),

  // Void transaction
  http.post(`${API_BASE}/pos/transactions/:id/void`, ({ params }) => {
    const { id } = params;
    const transactionIndex = transactions.findIndex((t) => t.id === id);

    if (transactionIndex === -1) {
      return HttpResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    transactions[transactionIndex] = {
      ...transactions[transactionIndex],
      status: "voided",
      updatedAt: new Date().toISOString(),
    };

    return HttpResponse.json(transactions[transactionIndex]);
  }),

  // Print receipt (mock)
  http.get(`${API_BASE}/pos/transactions/:id/receipt`, ({ params }) => {
    const { id } = params;
    const transaction = transactions.find((t) => t.id === id);

    if (!transaction) {
      return HttpResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // Return a mock PDF blob
    const pdfContent = `Receipt for ${transaction.transactionNumber}`;
    return HttpResponse.arrayBuffer(new TextEncoder().encode(pdfContent).buffer, {
      headers: {
        "Content-Type": "application/pdf",
      },
    });
  }),
];
