import { create } from "zustand";
import type { AuthSession } from "@/contracts/auth";
import { clearSession, loadSession, saveSession } from "@/storage/sessionStorage";
import * as authApi from "@/api/auth";

type AuthState = {
  session: AuthSession | null;
  isRestoring: boolean;
  error: string | null;
  restore: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setSession: (session: AuthSession) => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  isRestoring: true,
  error: null,
  restore: async () => {
    const session = await loadSession();
    set({ session, isRestoring: false });
  },
  login: async (email, password) => {
    set({ error: null });
    try {
      const session = await authApi.login(email, password);
      await saveSession(session);
      set({ session });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sign in failed";
      set({ error: message });
      throw error;
    }
  },
  logout: async () => {
    await authApi.logout();
    await clearSession();
    set({ session: null, error: null });
  },
  setSession: async (session) => {
    await saveSession(session);
    set({ session });
  }
}));
