import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { WAREHOUSE_DASHBOARD_QUERY_KEY } from "@/hooks/queryKeys";
import type { BusinessUnitWithAccess } from "@/types/business-unit";
import { useSetBusinessUnitContext } from "./useBusinessUnits";

const state = vi.hoisted(() => ({
  client: null as QueryClient | null,
  switchBusinessUnit: undefined as ((id: string) => Promise<unknown>) | undefined,
  currentBusinessUnit: { id: "unit-a" },
  isSwitching: false,
  post: vi.fn(),
  setSession: vi.fn(),
  reload: vi.fn(),
}));

vi.mock("@tanstack/react-query", async (load) => ({
  ...(await load<typeof import("@tanstack/react-query")>()),
  useQueryClient: () => state.client,
  useMutation: (options: { mutationFn: typeof state.switchBusinessUnit }) => {
    state.switchBusinessUnit = options.mutationFn;
  },
}));
vi.mock("@/lib/api", () => ({ apiClient: { post: state.post } }));
vi.mock("@/lib/supabase/client", () => ({
  supabase: { auth: { setSession: state.setSession } },
}));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: { getState: () => ({ setToken: vi.fn() }) },
}));
vi.mock("@/stores/businessUnitStore", () => ({
  useBusinessUnitStore: {
    getState: () => ({
      isSwitching: state.isSwitching,
      availableBusinessUnits: [],
      setSwitching: (value: boolean) => {
        state.isSwitching = value;
      },
      setCurrentBusinessUnit: (unit: BusinessUnitWithAccess) => {
        state.currentBusinessUnit = unit;
      },
    }),
  },
}));

beforeEach(() => {
  state.client = new QueryClient();
  state.currentBusinessUnit = { id: "unit-a" };
  state.isSwitching = false;
  state.post.mockReset();
  state.setSession.mockReset();
  state.reload.mockReset();
  vi.stubGlobal("window", { location: { reload: state.reload } });
});

afterEach(() => {
  state.client?.clear();
  vi.unstubAllGlobals();
});

it("enters the switching state before submitting the request and discards cached dashboard data", async () => {
  const oldDashboard = [WAREHOUSE_DASHBOARD_QUERY_KEY, "unit-a"];
  const destinationDashboard = [WAREHOUSE_DASHBOARD_QUERY_KEY, "unit-b"];
  state.client!.setQueryData(oldDashboard, "old dashboard");
  state.client!.setQueryData(destinationDashboard, "cached destination dashboard");
  state.client!.setQueryData(["unrelated"], "keep");
  state.post.mockImplementationOnce(async () => {
    expect(state.isSwitching).toBe(true);
    expect(state.currentBusinessUnit.id).toBe("unit-a");
    return { business_unit: { id: "unit-b" }, token: "token", refreshToken: "refresh" };
  });
  state.setSession.mockResolvedValueOnce({
    data: { session: { access_token: "token" } },
    error: null,
  });
  useSetBusinessUnitContext({ silent: true });

  const switching = state.switchBusinessUnit!("unit-b");
  expect(state.isSwitching).toBe(true);
  await switching;

  expect(state.currentBusinessUnit.id).toBe("unit-b");
  expect(state.isSwitching).toBe(false);
  expect(state.client!.getQueryData(oldDashboard)).toBeUndefined();
  expect(state.client!.getQueryData(destinationDashboard)).toBeUndefined();
  expect(state.client!.getQueryData(["unrelated"])).toBe("keep");
  expect(state.reload).not.toHaveBeenCalled();
});

it("clears the switching state if the context request is rejected", async () => {
  state.post.mockRejectedValueOnce(new Error("Access denied"));
  useSetBusinessUnitContext();

  await expect(state.switchBusinessUnit!("unit-b")).rejects.toThrow("Access denied");
  expect(state.currentBusinessUnit.id).toBe("unit-a");
  expect(state.isSwitching).toBe(false);
  expect(state.reload).not.toHaveBeenCalled();
});

it.each(["returned error", "thrown error", "missing session"] as const)(
  "keeps the dashboard gated while reloading after session sync fails with %s",
  async (failure) => {
    const dashboard = [WAREHOUSE_DASHBOARD_QUERY_KEY, "unit-a"];
    const overview = [WAREHOUSE_DASHBOARD_QUERY_KEY, "operations-overview", "unit-b"];
    state.client!.setQueryData(dashboard, "old data");
    state.client!.setQueryData(overview, "previously cached overview");
    state.post.mockResolvedValueOnce({
      business_unit: { id: "unit-b" },
      token: "token",
      refreshToken: "refresh",
    });
    if (failure === "thrown error") {
      state.setSession.mockRejectedValueOnce(new Error("Session sync unavailable"));
    } else {
      state.setSession.mockResolvedValueOnce({
        data: { session: null },
        error: failure === "returned error" ? new Error("Session sync unavailable") : null,
      });
    }
    state.reload.mockImplementationOnce(() => {
      expect(state.isSwitching).toBe(true);
      expect(state.client!.getQueryData(dashboard)).toBeUndefined();
      expect(state.client!.getQueryData(overview)).toBeUndefined();
    });
    useSetBusinessUnitContext();

    await expect(state.switchBusinessUnit!("unit-b")).rejects.toThrow(
      "Failed to sync authentication session"
    );
    expect(state.reload).toHaveBeenCalledTimes(1);
    expect(state.isSwitching).toBe(true);
    expect(state.currentBusinessUnit.id).toBe("unit-a");
    expect(state.post).toHaveBeenCalledTimes(1);
  }
);
