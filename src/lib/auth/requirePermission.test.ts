import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireLookupDataAccess } from "./requirePermission";

const mocks = vi.hoisted(() => ({ user: vi.fn(), check: vi.fn(), checkForUser: vi.fn() }));
vi.mock("./checkPermission", () => ({
  getAuthenticatedUser: mocks.user,
  checkPermission: mocks.check,
  checkPermissionForUser: mocks.checkForUser,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue({ id: "actor", companyId: "company", businessUnitId: "unit" });
  mocks.check.mockResolvedValue(false);
  mocks.checkForUser.mockResolvedValue(true);
});

describe("Move Stock warehouse lookup access", () => {
  it("preserves direct warehouse view access without extra move permission checks", async () => {
    mocks.check.mockImplementation(async (resource: string) => resource === "warehouses");
    expect(await requireLookupDataAccess("warehouses")).toBeNull();
    expect(mocks.checkForUser).not.toHaveBeenCalled();
  });

  it("preserves lookup access through an existing inventory workflow", async () => {
    mocks.check.mockImplementation(async (resource: string) => resource === "stock_requests");
    mocks.checkForUser.mockResolvedValue(false);
    expect(await requireLookupDataAccess("warehouses")).toBeNull();
  });

  it("allows warehouse and rack lookups with both move actions without warehouse management access", async () => {
    expect(await requireLookupDataAccess("warehouses")).toBeNull();
    expect(mocks.checkForUser).toHaveBeenCalledWith(
      { id: "actor", companyId: "company", businessUnitId: "unit" },
      "stock_transactions",
      "create"
    );
    expect(mocks.checkForUser).toHaveBeenCalledWith(
      { id: "actor", companyId: "company", businessUnitId: "unit" },
      "transfer_between_locations",
      "create"
    );
    expect(mocks.user).toHaveBeenCalledTimes(1);
  });

  it.each(["stock_transactions", "transfer_between_locations"])(
    "denies implicit move lookup access without %s",
    async (missingResource) => {
      mocks.checkForUser.mockImplementation(
        async (_actor: unknown, resource: string) => resource !== missingResource
      );
      expect((await requireLookupDataAccess("warehouses"))?.status).toBe(403);
    }
  );

  it("does not extend access to other lookup resources", async () => {
    expect((await requireLookupDataAccess("suppliers"))?.status).toBe(403);
    expect(mocks.checkForUser).not.toHaveBeenCalled();
  });

  it("requires an active business-unit context for move lookup access", async () => {
    mocks.user.mockResolvedValue({ id: "actor", companyId: "company", businessUnitId: null });
    expect((await requireLookupDataAccess("warehouses"))?.status).toBe(403);
    expect(mocks.checkForUser).not.toHaveBeenCalled();
  });
});
