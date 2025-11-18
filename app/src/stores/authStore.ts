import { create } from "zustand";
import { User, LoginCredentials, AuthResponse } from "@/types/auth";
import { supabase } from "@/lib/supabase/client";

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

export const useAuthStore = create<AuthStore>()((set, get) => ({
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
            console.error('Error fetching user data:', userError);
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

          set({
            user: null,
            token: null,
            isAuthenticated: false,
            error: null,
          });
        } catch (error) {
          console.error("Logout error:", error);
          // Clear state even if API call fails
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            error: null,
          });
        }
      },

      checkAuth: async () => {
        try {
          set({ isLoading: true });

          // Check Supabase session instead of custom token
          const { data: { session }, error } = await supabase.auth.getSession();

          if (error || !session) {
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
            .eq('id', session.user.id)
            .single();

          if (userError) {
            console.error('Error fetching user data:', userError);
          }

          // Map Supabase user to our User type
          const user: User = {
            id: session.user.id,
            email: session.user.email!,
            name: session.user.user_metadata?.full_name || session.user.email!,
            role: session.user.user_metadata?.role || "user",
            companyId: userData?.company_id || "",
          };

          set({
            user,
            token: session.access_token,
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
            error: null,
          });
        }
      },
    }));
