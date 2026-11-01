import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { ApiClient } from "@/lib/api";
import { setQueryClient, useAuthStore } from "./authStore";

const mocks = vi.hoisted(() => ({
  setSession: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
  clearBusinessUnit: vi.fn(),
  clearPermissions: vi.fn(),
  hasIntentionalLogoutMarker: vi.fn(),
  markIntentionalLogout: vi.fn(),
  clearIntentionalLogoutMarker: vi.fn(),
  notifySessionInvalid: vi.fn(),
}));
vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    auth: {
      setSession: mocks.setSession,
      signOut: mocks.signOut,
      getSession: mocks.getSession,
      getUser: mocks.getUser,
    },
    from: mocks.from,
  },
}));
vi.mock("./businessUnitStore", () => ({
  useBusinessUnitStore: { getState: () => ({ clearBusinessUnit: mocks.clearBusinessUnit }) },
}));
vi.mock("./permissionStore", () => ({
  usePermissionStore: { getState: () => ({ clearPermissions: mocks.clearPermissions }) },
}));
vi.mock("@/lib/auth/sessionInvalidation", () => ({
  clearIntentionalLogoutMarker: mocks.clearIntentionalLogoutMarker,
  clearSessionInvalidNoticeShown: vi.fn(),
  hasIntentionalLogoutMarker: mocks.hasIntentionalLogoutMarker,
  markIntentionalLogout: mocks.markIntentionalLogout,
  notifySessionInvalid: mocks.notifySessionInvalid,
  isSessionInvalidStatus: (status: number) => status === 401,
}));

const payload = {
  user: {
    id: "user",
    email: "user@example.com",
    name: "operator",
    firstName: "Test",
    lastName: "User",
    companyId: "company",
    role: "user",
  },
  token: "access",
  refreshToken: "refresh",
  landingPage: "/sales/pos",
};
const credentials = { email: "user@example.com", password: "password" };
const accessToken = `header.${Buffer.from(JSON.stringify({ company_id: "company" })).toString("base64url")}.signature`;
const verifiedUser = {
  id: payload.user.id,
  email: payload.user.email,
  user_metadata: { first_name: "Test", last_name: "User", role: "user" },
};
let queryClient: QueryClient;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function authenticate() {
  useAuthStore.getState().hydrateFromServer(payload.user, accessToken);
}

beforeEach(() => {
  vi.resetAllMocks();
  useAuthStore.setState({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: false,
    isLoggingOut: false,
    error: null,
  });
  mocks.setSession.mockResolvedValue({ error: null });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.hasIntentionalLogoutMarker.mockReturnValue(false);
  mocks.markIntentionalLogout.mockImplementation(() => {
    mocks.hasIntentionalLogoutMarker.mockReturnValue(true);
  });
  mocks.clearIntentionalLogoutMarker.mockImplementation(() => {
    mocks.hasIntentionalLogoutMarker.mockReturnValue(false);
  });
  mocks.getSession.mockResolvedValue({ data: { session: { access_token: accessToken } } });
  mocks.getUser.mockResolvedValue({ data: { user: verifiedUser }, error: null });
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  setQueryClient(queryClient);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(payload)));
});
afterEach(() => {
  queryClient.clear();
  vi.unstubAllGlobals();
});

describe("web login profile reuse", () => {
  it("reuses the API profile while preserving Supabase session verification", async () => {
    await expect(useAuthStore.getState().login(credentials)).resolves.toEqual({
      landingPage: "/sales/pos",
    });
    expect(mocks.setSession).toHaveBeenCalledExactlyOnceWith({
      access_token: "access",
      refresh_token: "refresh",
    });
    expect(mocks.from).not.toHaveBeenCalled();
    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: true,
      isLoading: false,
      error: null,
      user: {
        id: "user",
        name: "Test User",
        firstName: "Test",
        lastName: "User",
        companyId: "company",
      },
    });
  });

  it("retains the API display label when profile names are empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ ...payload, user: { ...payload.user, firstName: "", lastName: "" } })
        )
    );
    await useAuthStore.getState().login(credentials);
    expect(useAuthStore.getState().user?.name).toBe("operator");
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("does not mark the user authenticated if session verification fails", async () => {
    mocks.setSession.mockResolvedValue({ error: { message: "private auth details" } });
    await expect(useAuthStore.getState().login(credentials)).rejects.toMatchObject({
      code: "LOGIN_UNAVAILABLE",
    });
    expect(useAuthStore.getState()).toMatchObject({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });
  });

  it("does not establish a session when credential authentication fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(Response.json({ code: "LOGIN_INVALID_CREDENTIALS" }, { status: 401 }))
    );
    await expect(useAuthStore.getState().login(credentials)).rejects.toMatchObject({
      code: "LOGIN_INVALID_CREDENTIALS",
    });
    expect(mocks.setSession).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});

describe("web logout lifecycle", () => {
  it("preserves the current API profile and role when hydrating the same server user", () => {
    const user = { ...payload.user, name: "Existing Operator", role: "sales_operator" };
    useAuthStore.setState({ user, isAuthenticated: true });
    useAuthStore.getState().hydrateFromServer(payload.user, accessToken);
    expect(useAuthStore.getState().user).toBe(user);
    expect(useAuthStore.getState().token).toBe(accessToken);
  });

  it("pauses consumers immediately and preserves the existing Supabase sign-out call", async () => {
    authenticate();
    const signOut = deferred<{ error: null }>();
    mocks.signOut.mockReturnValue(signOut.promise);
    queryClient.setQueryData(["permissions", "user"], { allowed: true });

    const logout = useAuthStore.getState().logout();
    expect(useAuthStore.getState().isLoggingOut).toBe(true);
    await vi.waitFor(() => expect(mocks.signOut).toHaveBeenCalledExactlyOnceWith());
    expect(mocks.clearBusinessUnit).not.toHaveBeenCalled();

    signOut.resolve({ error: null });
    await logout;
    expect(useAuthStore.getState()).toMatchObject({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      isLoggingOut: false,
    });
    expect(mocks.clearBusinessUnit).toHaveBeenCalledTimes(1);
    expect(mocks.clearPermissions).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryCache().getAll()).toEqual([]);
  });

  it("blocks stale server hydration both during and after sign-out", async () => {
    authenticate();
    const signOut = deferred<{ error: null }>();
    mocks.signOut.mockReturnValue(signOut.promise);
    const logout = useAuthStore.getState().logout();
    useAuthStore.getState().hydrateFromServer({ ...payload.user, id: "stale" }, "old-token");
    expect(useAuthStore.getState().user?.id).toBe("user");

    signOut.resolve({ error: null });
    await logout;
    useAuthStore.getState().hydrateFromServer(payload.user, accessToken);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().token).toBeNull();
  });

  it("coalesces repeated logout calls", async () => {
    const signOut = deferred<{ error: null }>();
    mocks.signOut.mockReturnValue(signOut.promise);
    const first = useAuthStore.getState().logout();
    const second = useAuthStore.getState().logout();
    expect(second).toBe(first);
    await vi.waitFor(() => expect(mocks.signOut).toHaveBeenCalledTimes(1));
    signOut.resolve({ error: null });
    await Promise.all([first, second]);
    expect(mocks.clearPermissions).toHaveBeenCalledTimes(1);
  });

  it("retains local cleanup when Supabase sign-out throws", async () => {
    authenticate();
    mocks.signOut.mockRejectedValue(new Error("network unavailable"));
    await expect(useAuthStore.getState().logout()).resolves.toBeUndefined();
    expect(mocks.clearBusinessUnit).toHaveBeenCalledTimes(1);
    expect(mocks.clearPermissions).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState()).toMatchObject({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      isLoggingOut: false,
    });
  });

  it("preserves cleanup if recording intentional logout fails", async () => {
    authenticate();
    queryClient.setQueryData(["private-data"], { account: "previous" });
    mocks.markIntentionalLogout.mockImplementation(() => {
      throw new Error("Session storage unavailable");
    });
    await expect(useAuthStore.getState().logout()).resolves.toBeUndefined();
    expect(mocks.clearBusinessUnit).toHaveBeenCalledTimes(1);
    expect(mocks.clearPermissions).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryCache().getAll()).toEqual([]);
    expect(useAuthStore.getState()).toMatchObject({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      isLoggingOut: false,
    });
  });

  it("aborts pending reads before sign-out and never restarts them during cache cleanup", async () => {
    authenticate();
    const signals: AbortSignal[] = [];
    const fetch = vi.fn((_input: RequestInfo | URL, options?: RequestInit) => {
      const signal = options?.signal;
      if (!signal) throw new Error("Missing request cancellation signal");
      signals.push(signal);
      return new Promise<Response>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), {
          once: true,
        });
      });
    });
    vi.stubGlobal("fetch", fetch);
    const client = new ApiClient("");
    const options = {
      queryKey: ["business-units"],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        client.get("/api/business-units", { signal }),
      retry: 2,
    };
    const observer = new QueryObserver(queryClient, { ...options, enabled: true });
    const unsubscribeQuery = observer.subscribe(() => undefined);
    const unsubscribeAuth = useAuthStore.subscribe((auth) => {
      observer.setOptions({ ...options, enabled: auth.isAuthenticated && !auth.isLoggingOut });
    });
    try {
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
      mocks.signOut.mockImplementation(async () => {
        expect(signals[0].aborted).toBe(true);
        return { error: null };
      });
      await useAuthStore.getState().logout();
      useAuthStore.getState().hydrateFromServer(payload.user, accessToken);
      await queryClient.refetchQueries();
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(signals[0].aborted).toBe(true);
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    } finally {
      unsubscribeAuth();
      unsubscribeQuery();
      observer.destroy();
    }
  });

  it("allows a subsequent login after logout without restoring the previous user", async () => {
    authenticate();
    await useAuthStore.getState().logout();
    await useAuthStore.getState().login(credentials);
    expect(mocks.setSession).toHaveBeenCalledExactlyOnceWith({
      access_token: payload.token,
      refresh_token: payload.refreshToken,
    });
    expect(mocks.hasIntentionalLogoutMarker()).toBe(false);
    expect(useAuthStore.getState()).toMatchObject({ isAuthenticated: true, isLoggingOut: false });
  });
});

describe("authentication checks across logout", () => {
  it("still verifies the session with Supabase for normal authentication checks", async () => {
    await useAuthStore.getState().checkAuth();
    expect(mocks.getSession).toHaveBeenCalledTimes(1);
    expect(mocks.getUser).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: true,
      token: accessToken,
      user: { id: "user", companyId: "company" },
    });
  });

  it("does not start a new auth check while or after intentionally signing out", async () => {
    const signOut = deferred<{ error: null }>();
    mocks.signOut.mockReturnValue(signOut.promise);
    const logout = useAuthStore.getState().logout();
    await useAuthStore.getState().checkAuth();
    signOut.resolve({ error: null });
    await logout;
    await useAuthStore.getState().checkAuth();
    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it("discards a session lookup that completes after logout", async () => {
    const session = deferred<{ data: { session: { access_token: string } } }>();
    mocks.getSession.mockReturnValue(session.promise);
    const check = useAuthStore.getState().checkAuth();
    await useAuthStore.getState().logout();
    session.resolve({ data: { session: { access_token: accessToken } } });
    await check;
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(useAuthStore.getState()).toMatchObject({ isAuthenticated: false, isLoading: false });
  });

  it.each(["resolve", "reject"] as const)(
    "discards a user verification that %ss after logout",
    async (outcome) => {
      const user = deferred<{ data: { user: typeof verifiedUser }; error: null }>();
      mocks.getUser.mockReturnValue(user.promise);
      const check = useAuthStore.getState().checkAuth();
      await vi.waitFor(() => expect(mocks.getUser).toHaveBeenCalledTimes(1));
      await useAuthStore.getState().logout();
      if (outcome === "resolve") user.resolve({ data: { user: verifiedUser }, error: null });
      else user.reject(new Error("verification failed"));
      await check;
      expect(mocks.from).not.toHaveBeenCalled();
      expect(mocks.notifySessionInvalid).not.toHaveBeenCalled();
      expect(useAuthStore.getState()).toMatchObject({ user: null, isAuthenticated: false });
    }
  );

  it("discards a profile lookup that completes after logout", async () => {
    const profile = deferred<{
      data: { company_id: string; first_name: string; last_name: string };
    }>();
    mocks.getUser.mockResolvedValue({
      data: { user: { ...verifiedUser, user_metadata: {} } },
      error: null,
    });
    const maybeSingle = vi.fn().mockReturnValue(profile.promise);
    mocks.from.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle }) }) });
    const check = useAuthStore.getState().checkAuth();
    await vi.waitFor(() => expect(maybeSingle).toHaveBeenCalledTimes(1));
    await useAuthStore.getState().logout();
    profile.resolve({ data: { company_id: "company", first_name: "Old", last_name: "User" } });
    await check;
    expect(useAuthStore.getState()).toMatchObject({
      user: null,
      token: null,
      isAuthenticated: false,
    });
  });
});
