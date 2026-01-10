import { create } from "zustand";
import { User, LoginCredentials } from "@/types/auth";
import { supabase } from "@/lib/supabase/client";
import { useBusinessUnitStore } from "./businessUnitStore";
import { usePermissionStore } from "./permissionStore";
import { QueryClient } from "@tanstack/react-query";

// Get the query client instance - will be initialized by provider
let queryClientInstance: QueryClient | null = null;

export function setQueryClient(queryClient: QueryClient) {
  queryClientInstance = queryClient;
}

interface AuthStore {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>()((set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true, // Start as true to prevent premature redirects
      error: null,

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setToken: (token) => set({ token }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),

      login: async (credentials) => {
        try {
          set({ isLoading: true, error: null });

          // Sign in with Supabase directly
          const { data, error: authError } = await supabase.auth.signInWithPassword({
            email: credentials.email,
            password: credentials.password,
          });

          if (authError || !data.session) {
            throw new Error(authError?.message || "Login failed");
          }

          // Fetch company_id from public.users table
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('company_id')
            .eq('id', data.user.id)
            .single();

          if (userError) {

          }

          // Map Supabase user to our User type
          const user: User = {
            id: data.user.id,
            email: data.user.email!,
            name: data.user.user_metadata?.full_name || data.user.email!,
            role: data.user.user_metadata?.role || "user",
            companyId: userData?.company_id || "",
          };

          set({
            user,
            token: data.session.access_token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: error instanceof Error ? error.message : "Login failed",
          });
          throw error;
        }
      },

      logout: async () => {
        try {
          // Sign out from Supabase
          await supabase.auth.signOut();

          // Clear auth state
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            error: null,
          });

          // Clear business unit context from previous user
          useBusinessUnitStore.getState().clearBusinessUnit();

          // Clear permissions from previous user
          usePermissionStore.getState().clearPermissions();

          // Clear React Query cache to prevent data from previous user
          if (queryClientInstance) {
            queryClientInstance.clear();
          }
        } catch {
          // Clear state even if API call fails
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            error: null,
          });

          // Clear business unit and permissions even on error
          useBusinessUnitStore.getState().clearBusinessUnit();
          usePermissionStore.getState().clearPermissions();

          // Clear React Query cache even on error
          if (queryClientInstance) {
            queryClientInstance.clear();
          }
        }
      },

      checkAuth: async () => {
        try {
          set({ isLoading: true });

          // SECURITY: Use getUser() to verify JWT authenticity with Supabase Auth server
          // Do NOT use getSession() as it reads from cookies without verification
          const { data: { user }, error } = await supabase.auth.getUser();

          if (error || !user) {
            set({
              user: null,
              token: null,
              isAuthenticated: false,
              isLoading: false,
              error: null,
            });
            return;
          }

          // Fetch company_id from public.users table
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('company_id')
            .eq('id', user.id)
            .single();

          if (userError) {

          }

          // Get session to access the access token (safe to use for token only)
          const { data: { session } } = await supabase.auth.getSession();

          // Map Supabase user to our User type
          const mappedUser: User = {
            id: user.id,
            email: user.email!,
            name: user.user_metadata?.full_name || user.email!,
            role: user.user_metadata?.role || "user",
            companyId: userData?.company_id || "",
          };

          set({
            user: mappedUser,
            token: session?.access_token || null,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch {
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
