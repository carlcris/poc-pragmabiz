import { expect, it, vi } from "vitest";

it("keeps persisted selection blocked until initialization verifies the active scope", async () => {
  const storage = {
    getItem: () =>
      JSON.stringify({
        state: { currentBusinessUnit: { id: "stale-unit", name: "Previous selection" } },
        version: 0,
      }),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  };
  vi.stubGlobal("window", { localStorage: storage });
  try {
    vi.resetModules();
    const { useBusinessUnitStore } = await import("./businessUnitStore");
    expect(useBusinessUnitStore.getState().currentBusinessUnit?.id).toBe("stale-unit");
    expect(useBusinessUnitStore.getState().hasHydrated).toBe(true);
    expect(useBusinessUnitStore.getState().isLoading).toBe(true);
    useBusinessUnitStore.getState().setLoading(false);
    expect(useBusinessUnitStore.getState().isLoading).toBe(false);
  } finally {
    vi.unstubAllGlobals();
    vi.resetModules();
  }
});
