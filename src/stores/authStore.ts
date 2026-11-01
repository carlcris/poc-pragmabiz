import { create } from "zustand";
import type { AuthResponse, LoginCredentials, User } from "@/types/auth";
import { supabase } from "@/lib/supabase/client";
import { useBusinessUnitStore } from "./businessUnitStore";
import { usePermissionStore } from "./permissionStore";
import type { QueryClient } from "@tanstack/react-query";
import {
  getLoginErrorCode,
  LoginError,
  requestLogin,
  type LoginErrorCode,
} from "@/lib/auth/login-errors";
import {
  clearIntentionalLogoutMarker,
  clearSessionInvalidNoticeShown,
  hasIntentionalLogoutMarker,
  markIntentionalLogout,
  notifySessionInvalid,
} from "@/lib/auth/sessionInvalidation";

// Get the query client instance - will be initialized by provider
let queryClientInstance: QueryClient | null = null;
let authOperationVersion = 0;
let logoutPromise: Promise<void> | null = null;

export function setQueryClient(queryClient: QueryClient) {
  queryClientInstance = queryClient;
}

type JwtClaims = {
  company_id?: string;
};

function decodeCompanyIdFromToken(token: string | null | undefined): string {
  if (!token) return "";
  try {
    const [, payload] = token.split(".");
    if (!payload) return "";
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const parsed = JSON.parse(atob(padded)) as JwtClaims;
    return parsed.company_id || "";
  } catch {
    return "";
  }
}

type AuthStore = {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isLoggingOut: boolean;
  error: LoginErrorCode | null;

  // Actions
  hydrateFromServer: (user: User, token: string | null) => void;
  setToken: (token: string | null) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: LoginErrorCode | null) => void;
  login: (credentials: LoginCredentials) => Promise<{ landingPage: string }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
};

export const useAuthStore = create<AuthStore>()((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true, // Start as true to prevent premature redirects
  isLoggingOut: false,
  error: null,

  hydrateFromServer: (user, token) => {
    if (get().isLoggingOut || hasIntentionalLogoutMarker()) return;
    const currentUser = get().user;
    set({
      user: currentUser?.id === user.id ? currentUser : user,
      token,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });
  },
  setToken: (token) => set({ token }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  login: async (credentials) => {
    if (logoutPromise) await logoutPromise;
    authOperationVersion += 1;
    try {
      set({ isLoading: true, error: null });

      const payload = await requestLogin<AuthResponse>("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });

      if (!payload.user || !payload.token || !payload.refreshToken) {
        throw new LoginError("LOGIN_UNAVAILABLE");
      }

      // Sync browser Supabase session for BU refresh and client auth APIs
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: payload.token,
        refresh_token: payload.refreshToken,
      });

      if (sessionError) {
        throw new LoginError("LOGIN_UNAVAILABLE");
      }

      const firstName = payload.user.firstName || "";
      const lastName = payload.user.lastName || "";
      const fullName = [firstName, lastName].filter(Boolean).join(" ");

      const user: User = {
        id: payload.user.id,
        email: payload.user.email,
        name: fullName || payload.user.name,
        firstName,
        lastName,
        role: payload.user.role,
        companyId: payload.user.companyId,
      };

      set({
        user,
        token: payload.token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      clearIntentionalLogoutMarker();
      clearSessionInvalidNoticeShown();
      return { landingPage: payload.landingPage || "/dashboard" };
    } catch (error) {
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: getLoginErrorCode(error),
      });
      throw new LoginError(getLoginErrorCode(error));
    }
  },

  logout: () => {
    if (logoutPromise) return logoutPromise;

    authOperationVersion += 1;
    // Pause protected consumers before cookies or query keys change.
    set({ isLoggingOut: true });

    logoutPromise = (async () => {
      try {
        markIntentionalLogout();
        await queryClientInstance?.cancelQueries();
        await supabase.auth.signOut();
      } catch {
        // Preserve local cleanup and navigation if sign-out fails.
      } finally {
        useBusinessUnitStore.getState().clearBusinessUnit();
        usePermissionStore.getState().clearPermissions();
        queryClientInstance?.clear();
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
          isLoggingOut: false,
          error: null,
        });
      }
    })().finally(() => {
      logoutPromise = null;
    });

    return logoutPromise;
  },

  checkAuth: async () => {
    if (get().isLoggingOut || hasIntentionalLogoutMarker()) return;
    const operationVersion = authOperationVersion;
    try {
      set({ isLoading: true });

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (operationVersion !== authOperationVersion) return;
      if (!session) {
        if (get().isAuthenticated || get().token) {
          notifySessionInvalid();
        }
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
        return;
      }

      // SECURITY: Use getUser() to verify JWT authenticity with Supabase Auth server
      // Do NOT use getSession() as it reads from cookies without verification
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (operationVersion !== authOperationVersion) return;
      if (error || !user) {
        if (get().isAuthenticated || get().token) {
          notifySessionInvalid();
        }
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
        return;
      }

      const tokenCompanyId = decodeCompanyIdFromToken(session.access_token);
      let firstName = user.user_metadata?.first_name || "";
      let lastName = user.user_metadata?.last_name || "";
      let companyId = tokenCompanyId;

      if (!companyId || (!firstName && !lastName)) {
        const { data: userData } = await supabase
          .from("users")
          .select("company_id, first_name, last_name")
          .eq("id", user.id)
          .maybeSingle();

        if (operationVersion !== authOperationVersion) return;
        companyId = companyId || userData?.company_id || "";
        firstName = firstName || userData?.first_name || "";
        lastName = lastName || userData?.last_name || "";
      }

      // Map Supabase user to our User type
      const fullName =
        [firstName, lastName].filter(Boolean).join(" ") ||
        user.user_metadata?.full_name ||
        user.email!;

      const mappedUser: User = {
        id: user.id,
        email: user.email!,
        name: fullName,
        firstName,
        lastName,
        role: user.user_metadata?.role || "user",
        companyId,
      };

      set({
        user: mappedUser,
        token: session?.access_token || null,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch {
      if (operationVersion !== authOperationVersion) return;
      if (get().isAuthenticated || get().token) {
        notifySessionInvalid();
      }
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  },
}));
