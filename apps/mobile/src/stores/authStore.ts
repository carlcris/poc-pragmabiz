import { create } from "zustand";
import type { AuthSession } from "@/contracts/auth";
import { clearSession, loadSession, saveSession } from "@/storage/sessionStorage";
import * as authApi from "@/api/auth";

type AuthState = {
  session: AuthSession | null;
  isRestoring: boolean;
  isSwitchingBusinessUnit: boolean;
  error: string | null;
  restore: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setSession: (session: AuthSession) => Promise<void>;
  setBusinessUnitSwitching: (isSwitching: boolean) => void;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  isRestoring: true,
  isSwitchingBusinessUnit: false,
  error: null,
  restore: async () => {
    const session = await loadSession();
    set({ session, isRestoring: false, isSwitchingBusinessUnit: false });
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
    const session = get().session;
    await authApi.logout(session);
    await clearSession();
    set({ session: null, error: null, isSwitchingBusinessUnit: false });
  },
  setSession: async (session) => {
    const previousSession = get().session;
    set({ session });
    try {
      await saveSession(session);
    } catch (error) {
      set({ session: previousSession });
      throw error;
    }
  },
  setBusinessUnitSwitching: (isSwitching) => {
    set({ isSwitchingBusinessUnit: isSwitching });
  }
}));
