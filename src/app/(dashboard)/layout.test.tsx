import { beforeEach, describe, expect, it, vi } from "vitest";
import DashboardLayout from "./layout";

const mocks = vi.hoisted(() => ({ profile: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/components/layout/DashboardShell", () => ({ DashboardShell: () => null }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: {
          user: {
            id: "user",
            email: "user@example.com",
            user_metadata: { first_name: "Old", last_name: "Surname", full_name: "Old Surname" },
          },
        },
        error: null,
      }),
      getSession: async () => ({ data: { session: { access_token: "token" } } }),
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.profile }) }) }),
  }),
}));
vi.mock("@/lib/supabase/server-with-bu", () => ({
  createServerClientWithBU: async () => ({ supabase: {}, currentBusinessUnitId: null }),
}));
vi.mock("@/services/permissions/permissionResolver", () => ({
  getUserPermissions: async () => null,
}));
beforeEach(() => vi.clearAllMocks());

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
