import { beforeEach, expect, it, vi } from "vitest";
import { LogoutCleanup } from "./LogoutCleanup";

const mocks = vi.hoisted(() => ({ pathname: "/dashboard", ready: false, completeLogout: vi.fn() }));
vi.mock("react", () => ({ useEffect: (effect: () => void) => effect() }));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname }));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: (
    select: (state: { isLogoutReady: boolean; completeLogout: () => void }) => unknown
  ) => select({ isLogoutReady: mocks.ready, completeLogout: mocks.completeLogout }),
}));
beforeEach(() => {
  mocks.pathname = "/dashboard";
  mocks.ready = false;
  vi.clearAllMocks();
});
it("does not erase the dashboard while login navigation is pending", () => {
  mocks.ready = true;
  LogoutCleanup();
  expect(mocks.completeLogout).not.toHaveBeenCalled();
});
it("clears private state only when login is committed and remote sign-out has settled", () => {
  mocks.pathname = "/login";
  LogoutCleanup();
  expect(mocks.completeLogout).not.toHaveBeenCalled();
  mocks.ready = true;
  LogoutCleanup();
  expect(mocks.completeLogout).toHaveBeenCalledOnce();
});
