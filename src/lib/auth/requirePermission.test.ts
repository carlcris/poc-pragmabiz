import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireLookupDataAccess } from "./requirePermission";

const mocks = vi.hoisted(() => ({ user: vi.fn(), check: vi.fn(), checkForUser: vi.fn() }));
vi.mock("./checkPermission", () => ({
  getAuthenticatedUser: mocks.user,
  checkPermission: mocks.check,
  checkPermissionForUser: mocks.checkForUser,
}));
const actor = { id: "actor", companyId: "company", businessUnitId: "unit" };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue(actor);
  mocks.checkForUser.mockResolvedValue(false);
});

describe("lookup access with one verified actor", () => {
  it("preserves direct warehouse view access", async () => {
    mocks.checkForUser.mockImplementation(
      async (_actor: unknown, resource: string) => resource === "warehouses"
    );
    expect(await requireLookupDataAccess("warehouses")).toBeNull();
    expect(mocks.checkForUser).toHaveBeenCalledTimes(1);
  });
  it("preserves dependent workflow access", async () => {
    mocks.checkForUser.mockImplementation(
      async (_actor: unknown, resource: string) => resource === "stock_requests"
    );
    expect(await requireLookupDataAccess("warehouses")).toBeNull();
    expect(mocks.user).toHaveBeenCalledTimes(1);
  });
  it("allows Move Stock only with both create actions", async () => {
    mocks.checkForUser.mockImplementation(
      async (_actor: unknown, resource: string, action: string) =>
        action === "create" &&
        ["stock_transactions", "transfer_between_locations"].includes(resource)
    );
    expect(await requireLookupDataAccess("warehouses")).toBeNull();
    expect(mocks.user).toHaveBeenCalledTimes(1);
  });
  it.each(["stock_transactions", "transfer_between_locations"])(
    "denies Move Stock missing %s",
    async (missingResource) => {
      mocks.checkForUser.mockImplementation(
        async (_actor: unknown, resource: string, action: string) =>
          action === "create" && resource !== missingResource
      );
      expect((await requireLookupDataAccess("warehouses"))?.status).toBe(403);
    }
  );
  it("does not extend Move Stock access to other lookups", async () => {
    mocks.checkForUser.mockImplementation(
      async (_actor: unknown, _resource: string, action: string) => action === "create"
    );
    expect((await requireLookupDataAccess("suppliers"))?.status).toBe(403);
  });
  it("requires BU context for Move Stock", async () => {
    mocks.user.mockResolvedValue({ ...actor, businessUnitId: null });
    mocks.checkForUser.mockImplementation(
      async (_actor: unknown, _resource: string, action: string) => action === "create"
    );
    expect((await requireLookupDataAccess("warehouses"))?.status).toBe(403);
  });
  it("reuses category request context and preserves dependent feature access", async () => {
    mocks.checkForUser.mockImplementation(
      async (_actor: unknown, resource: string) => resource === "pos"
    );
    expect(await requireLookupDataAccess("item_categories", actor)).toBeNull();
    expect(mocks.user).not.toHaveBeenCalled();
    expect(mocks.check).not.toHaveBeenCalled();
    expect(mocks.checkForUser.mock.calls.every(([user]) => user === actor)).toBe(true);
  });
  it("denies category access without direct or dependent permission", async () => {
    expect((await requireLookupDataAccess("item_categories", actor))?.status).toBe(403);
  });
  it("rejects unauthenticated callers", async () => {
    mocks.user.mockResolvedValue(null);
    expect((await requireLookupDataAccess("item_categories"))?.status).toBe(401);
    expect(mocks.checkForUser).not.toHaveBeenCalled();
  });
});
