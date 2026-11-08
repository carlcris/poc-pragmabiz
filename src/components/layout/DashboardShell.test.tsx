import { beforeEach, expect, it, vi } from "vitest";
import { DashboardShell } from "./DashboardShell";
import type { User } from "@/types/auth";
import { LogoutBackdrop } from "@/components/auth/LogoutBackdrop";

const mocks = vi.hoisted(() => ({
  userId: "second" as string | undefined,
  isLoggingOut: false,
  refresh: vi.fn(),
  ref: { current: false },
  logoutRef: { current: false },
  refCalls: 0,
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useEffect: (effect: () => void) => effect(),
  useRef: () => (mocks.refCalls++ % 2 === 0 ? mocks.ref : mocks.logoutRef),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: (
    select: (state: { user: { id: string } | null; isLoggingOut: boolean }) => unknown
  ) =>
    select({ user: mocks.userId ? { id: mocks.userId } : null, isLoggingOut: mocks.isLoggingOut }),
}));
vi.mock("@/components/layout/Sidebar", () => ({ Sidebar: () => null }));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));
vi.mock("@/components/layout/QuickActionSidebar", () => ({ QuickActionSidebar: () => null }));
vi.mock("@/components/layout/UnitConverterPanel", () => ({ UnitConverterPanel: () => null }));
vi.mock("@/components/activity-logging/NavigationActivityLogger", () => ({
  NavigationActivityLogger: () => null,
}));
vi.mock("@/components/business-unit/BusinessUnitProvider", () => ({
  BusinessUnitProvider: () => null,
}));
vi.mock("@/hooks/usePermissions", () => ({ useLoadPermissions: vi.fn() }));
const first: User = {
  id: "first",
  name: "First User",
  email: "first@example.com",
  role: "user",
  companyId: "company",
};
const props = {
  children: "private first-account page",
  initialUser: first,
  initialToken: "first-token",
  initialBusinessUnit: null,
  initialBusinessUnitId: "first-unit",
  sessionBusinessUnitId: "first-unit",
  initialPermissions: null,
  initialPermissionScopeKey: "first:first-unit",
  initialBusinessUnitName: "First unit",
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.userId = "second";
  mocks.isLoggingOut = false;
  mocks.ref.current = false;
  mocks.logoutRef.current = false;
  mocks.refCalls = 0;
});

it("does not mount another account's page, permissions, or business-unit provider", () => {
  expect(DashboardShell(props)).toBeNull();
  expect(mocks.refresh).toHaveBeenCalledTimes(1);
  expect(DashboardShell(props)).toBeNull();
  expect(mocks.refresh).toHaveBeenCalledTimes(1);
});
it("mounts a new account-scoped shell when the refreshed server snapshot matches", () => {
  DashboardShell(props);
  const result = DashboardShell({ ...props, initialUser: { ...first, id: "second" } });
  expect(result?.props.children[0]?.key).toBe("second");
  expect(mocks.ref.current).toBe(false);
});
it("allows server hydration on a fresh page load", () => {
  mocks.userId = undefined;
  expect(DashboardShell(props)?.props.children[0]?.key).toBe("first");
  expect(mocks.refresh).not.toHaveBeenCalled();
});
it("does not mount a stale account or refresh during logout", () => {
  mocks.isLoggingOut = true;
  expect(DashboardShell(props)?.props.children[1]?.type).toBe(LogoutBackdrop);
  expect(mocks.refresh).not.toHaveBeenCalled();
});

it("retains the page under a backdrop until cleanup, then unmounts protected consumers", () => {
  mocks.userId = "first";
  mocks.isLoggingOut = true;
  const pending = DashboardShell(props);
  expect(pending?.props.children[0]?.key).toBe("first");
  expect(pending?.props.children[1]?.type).toBe(LogoutBackdrop);
  mocks.userId = undefined;
  mocks.isLoggingOut = false;
  const completed = DashboardShell(props);
  expect(completed?.props.children[0]).toBeNull();
  expect(completed?.props.children[1]?.type).toBe(LogoutBackdrop);
  expect(mocks.refresh).not.toHaveBeenCalled();
});
