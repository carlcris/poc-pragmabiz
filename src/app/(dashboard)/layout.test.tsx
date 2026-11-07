import { beforeEach, describe, expect, it, vi } from "vitest";
import DashboardLayout from "./layout";

const mocks = vi.hoisted(() => ({
  profile: vi.fn(),
  getUser: vi.fn(),
  permissions: vi.fn(),
  access: vi.fn(),
  businessUnitId: null as string | null,
  authError: null as Error | null,
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));
vi.mock("@/components/layout/DashboardShell", () => ({ DashboardShell: () => null }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => {
        mocks.getUser();
        return {
          data: {
            user: {
              id: "user",
              email: "user@example.com",
              user_metadata: { first_name: "Old", last_name: "Surname", full_name: "Old Surname" },
            },
          },
          error: null,
        };
      },
      getSession: async () => ({ data: { session: { access_token: "token" } } }),
    },
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: table === "users" ? mocks.profile : mocks.access,
      };
      return query;
    },
  }),
}));
vi.mock("@/lib/supabase/server-with-bu", () => ({
  createServerClientWithBU: async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return {
      supabase,
      user,
      session,
      authError: mocks.authError,
      currentBusinessUnitId: mocks.businessUnitId,
      sessionBusinessUnitId: mocks.businessUnitId,
    };
  },
}));
vi.mock("@/services/permissions/permissionResolver", () => ({
  getUserPermissions: mocks.permissions,
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.permissions.mockResolvedValue(null);
  mocks.businessUnitId = null;
  mocks.authError = null;
  mocks.access.mockResolvedValue({ data: null });
  mocks.profile.mockResolvedValue({ data: null });
});

describe("dashboard profile hydration", () => {
  it.each(["New surname", null, ""])(
    "uses saved names on reload with surname %s",
    async (lastName) => {
      mocks.profile.mockResolvedValue({
        data: {
          company_id: "company",
          first_name: "New",
          last_name: lastName,
        },
      });
      const result = await DashboardLayout({ children: null });
      expect(result.props.initialUser).toMatchObject({
        firstName: "New",
        lastName: lastName ?? "",
        name: lastName ? `New ${lastName}` : "New",
      });
    }
  );
  it("does not resurrect metadata names when the profile has no names", async () => {
    mocks.profile.mockResolvedValue({
      data: { company_id: "company", first_name: null, last_name: null },
    });
    const result = await DashboardLayout({ children: null });
    expect(result.props.initialUser).toMatchObject({
      firstName: "",
      lastName: "",
      name: "user@example.com",
    });
  });
});

it("authenticates once and starts permissions before the profile resolves", async () => {
  let resolveProfile!: (value: { data: null }) => void;
  mocks.profile.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveProfile = resolve;
      })
  );
  const pending = DashboardLayout({ children: null });
  await vi.waitFor(() => expect(mocks.permissions).toHaveBeenCalledWith("user", null));
  expect(mocks.getUser).toHaveBeenCalledTimes(1);
  resolveProfile({ data: null });
  const result = await pending;
  expect(result.props.initialPermissionScopeKey).toBe("user:all");
});

it("hydrates only the selected user's active membership and preserves permission scope", async () => {
  mocks.businessUnitId = "selected";
  mocks.access.mockResolvedValue({
    data: { role: "staff", is_default: false, business_units: { id: "selected", name: "Branch" } },
  });
  const result = await DashboardLayout({ children: null });
  expect(mocks.permissions).toHaveBeenCalledWith("user", "selected");
  expect(result.props.initialBusinessUnit).toMatchObject({
    id: "selected",
    access: { role: "staff", is_default: false },
  });
  expect(result.props.initialPermissionScopeKey).toBe("user:selected");
});

it("redirects invalid sessions before loading dashboard data", async () => {
  mocks.authError = new Error("Invalid session");
  await expect(DashboardLayout({ children: null })).rejects.toThrow("redirect:/login");
  expect(mocks.profile).not.toHaveBeenCalled();
  expect(mocks.permissions).not.toHaveBeenCalled();
});
