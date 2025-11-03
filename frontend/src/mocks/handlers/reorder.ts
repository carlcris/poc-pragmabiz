import { http, HttpResponse } from "msw";
import {
  mockStockLevels,
  mockReorderSuggestions,
  mockReorderRules,
  mockReorderAlerts,
  mockReorderStatistics,
} from "../data/reorder";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";

export const reorderHandlers = [
  // Get Stock Levels
  http.get(`${BASE_URL}/inventory/stock-levels`, () => {
    return HttpResponse.json({
      data: mockStockLevels,
      pagination: {
        total: mockStockLevels.length,
        page: 1,
        limit: 100,
        totalPages: 1,
      },
    });
  }),

  // Get Reorder Suggestions
  http.get(`${BASE_URL}/inventory/reorder-suggestions`, ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");

    let suggestions = mockReorderSuggestions;
    if (status) {
      suggestions = suggestions.filter((s) => s.status === status);
    }

    return HttpResponse.json({
      data: suggestions,
      pagination: {
        total: suggestions.length,
        page: 1,
        limit: 100,
        totalPages: 1,
      },
    });
  }),

  // Get Single Reorder Suggestion
  http.get(`${BASE_URL}/inventory/reorder-suggestions/:id`, ({ params }) => {
    const { id } = params;
    const suggestion = mockReorderSuggestions.find((s) => s.id === id);
    if (!suggestion) {
      return HttpResponse.json({ error: "Reorder suggestion not found" }, { status: 404 });
    }
    return HttpResponse.json(suggestion);
  }),

  // Update Reorder Suggestion
  http.patch(`${BASE_URL}/inventory/reorder-suggestions/:id`, async ({ params, request }) => {
    const { id } = params;
    const suggestion = mockReorderSuggestions.find((s) => s.id === id);
    if (!suggestion) {
      return HttpResponse.json({ error: "Reorder suggestion not found" }, { status: 404 });
    }

    const updates = await request.json();
    const updated = {
      ...suggestion,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    return HttpResponse.json(updated);
  }),

  // Approve Reorder Suggestion
  http.post(`${BASE_URL}/inventory/reorder-suggestions/:id/approve`, ({ params }) => {
    const { id } = params;
    const suggestion = mockReorderSuggestions.find((s) => s.id === id);
    if (!suggestion) {
      return HttpResponse.json({ error: "Reorder suggestion not found" }, { status: 404 });
    }

    const updated = {
      ...suggestion,
      status: "approved" as const,
      approvedBy: "user-1",
      approvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return HttpResponse.json(updated);
  }),

  // Reject Reorder Suggestion
  http.post(`${BASE_URL}/inventory/reorder-suggestions/:id/reject`, ({ params }) => {
    const { id } = params;
    const suggestion = mockReorderSuggestions.find((s) => s.id === id);
    if (!suggestion) {
      return HttpResponse.json({ error: "Reorder suggestion not found" }, { status: 404 });
    }

    const updated = {
      ...suggestion,
      status: "rejected" as const,
      updatedAt: new Date().toISOString(),
    };

    return HttpResponse.json(updated);
  }),

  // Create PO from Suggestion
  http.post(`${BASE_URL}/inventory/reorder-suggestions/:id/create-po`, ({ params }) => {
    const { id } = params;
    const suggestion = mockReorderSuggestions.find((s) => s.id === id);
    if (!suggestion) {
      return HttpResponse.json({ error: "Reorder suggestion not found" }, { status: 404 });
    }

    return HttpResponse.json({
      purchaseOrderId: `po-${Date.now()}`,
    });
  }),

  // Get Reorder Rules
  http.get(`${BASE_URL}/inventory/reorder-rules`, () => {
    return HttpResponse.json({
      data: mockReorderRules,
      pagination: {
        total: mockReorderRules.length,
        page: 1,
        limit: 100,
        totalPages: 1,
      },
    });
  }),

  // Get Single Reorder Rule
  http.get(`${BASE_URL}/inventory/reorder-rules/:id`, ({ params }) => {
    const { id } = params;
    const rule = mockReorderRules.find((r) => r.id === id);
    if (!rule) {
      return HttpResponse.json({ error: "Reorder rule not found" }, { status: 404 });
    }
    return HttpResponse.json(rule);
  }),

  // Create Reorder Rule
  http.post(`${BASE_URL}/inventory/reorder-rules`, async ({ request }) => {
    const data = await request.json();
    const newRule = {
      id: `rr-${Date.now()}`,
      companyId: "company-1",
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return HttpResponse.json(newRule, { status: 201 });
  }),

  // Update Reorder Rule
  http.patch(`${BASE_URL}/inventory/reorder-rules/:id`, async ({ params, request }) => {
    const { id } = params;
    const rule = mockReorderRules.find((r) => r.id === id);
    if (!rule) {
      return HttpResponse.json({ error: "Reorder rule not found" }, { status: 404 });
    }

    const updates = await request.json();
    const updated = {
      ...rule,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    return HttpResponse.json(updated);
  }),

  // Delete Reorder Rule
  http.delete(`${BASE_URL}/inventory/reorder-rules/:id`, ({ params }) => {
    const { id } = params;
    const rule = mockReorderRules.find((r) => r.id === id);
    if (!rule) {
      return HttpResponse.json({ error: "Reorder rule not found" }, { status: 404 });
    }
    return HttpResponse.json({ success: true });
  }),

  // Get Reorder Alerts
  http.get(`${BASE_URL}/inventory/reorder-alerts`, ({ request }) => {
    const url = new URL(request.url);
    const acknowledged = url.searchParams.get("acknowledged");

    let alerts = mockReorderAlerts;
    if (acknowledged !== null) {
      const isAcknowledged = acknowledged === "true";
      alerts = alerts.filter((a) => a.acknowledged === isAcknowledged);
    }

    return HttpResponse.json({
      data: alerts,
      pagination: {
        total: alerts.length,
        page: 1,
        limit: 100,
        totalPages: 1,
      },
    });
  }),

  // Acknowledge Alerts
  http.post(`${BASE_URL}/inventory/reorder-alerts/acknowledge`, async ({ request }) => {
    const data = await request.json() as { alertIds: string[] };
    return HttpResponse.json({
      acknowledged: data.alertIds.length,
    });
  }),

  // Get Reorder Statistics
  http.get(`${BASE_URL}/inventory/reorder-statistics`, () => {
    return HttpResponse.json(mockReorderStatistics);
  }),

  // Generate Reorder Suggestions
  http.post(`${BASE_URL}/inventory/reorder-suggestions/generate`, () => {
    return HttpResponse.json({
      generated: Math.floor(Math.random() * 5) + 1,
    });
  }),
];
