"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type {
  UserPreferences,
  FontSize,
  Theme,
  UpdateUserPreferencesRequest,
} from "@/types/user-preferences";
import { FONT_SIZE_MAP } from "@/types/user-preferences";
import { useAuthStore } from "@/stores/authStore";

type UserPreferencesContextType = {
  preferences: UserPreferences | null;
  loading: boolean;
  updateFontSize: (fontSize: FontSize) => Promise<void>;
  updateTheme: (theme: Theme) => Promise<void>;
  updatePreferences: (updates: UpdateUserPreferencesRequest) => Promise<void>;
};

const UserPreferencesContext = createContext<UserPreferencesContextType | undefined>(undefined);

export function UserPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // Apply font size to document
  const applyFontSize = useCallback((fontSize: FontSize) => {
    if (typeof document !== "undefined") {
      const rootFontSize = FONT_SIZE_MAP[fontSize];
      document.documentElement.style.setProperty("--app-font-size", rootFontSize);
    }
  }, []);

  // Load preferences from API
  const loadPreferences = useCallback(async () => {
    try {
      const response = await fetch("/api/user-preferences");
      if (response.ok) {
        const { data } = await response.json();
        setPreferences(data);
        applyFontSize(data.fontSize);
      }
    } catch (error) {
      console.error("Failed to load user preferences:", error);
    } finally {
      setLoading(false);
    }
  }, [applyFontSize]);

  // Load preferences on mount
  useEffect(() => {
    setMounted(true);
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    loadPreferences();
  }, [isAuthenticated, loadPreferences]);

  // Update preferences on the server
  const updatePreferences = useCallback(
    async (updates: UpdateUserPreferencesRequest) => {
      try {
        const response = await fetch("/api/user-preferences", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updates),
        });

        if (response.ok) {
          const { data } = await response.json();
          setPreferences(data);
          if (updates.fontSize) {
            applyFontSize(updates.fontSize);
          }
        } else {
          console.error("Failed to update preferences");
        }
      } catch (error) {
        console.error("Error updating preferences:", error);
      }
    },
    [applyFontSize]
  );

  // Convenience methods for specific updates
  const updateFontSize = useCallback(
    async (fontSize: FontSize) => {
      await updatePreferences({ fontSize });
    },
    [updatePreferences]
  );

  const updateTheme = useCallback(
    async (theme: Theme) => {
      await updatePreferences({ theme });
    },
    [updatePreferences]
  );

  const contextValue = React.useMemo(
    () => ({
      preferences,
      loading,
      updateFontSize,
      updateTheme,
      updatePreferences,
    }),
    [preferences, loading, updateFontSize, updateTheme, updatePreferences]
  );

  // Prevent hydration mismatch by rendering with defaults on server
  if (!mounted) {
    return (
      <UserPreferencesContext.Provider
        value={{
          preferences: null,
          loading: true,
          updateFontSize,
          updateTheme,
          updatePreferences,
        }}
      >
        {children}
      </UserPreferencesContext.Provider>
    );
  }

  return (
    <UserPreferencesContext.Provider value={contextValue}>
      {children}
    </UserPreferencesContext.Provider>
  );
}

export function useUserPreferences() {
  const context = useContext(UserPreferencesContext);
  if (context === undefined) {
    throw new Error("useUserPreferences must be used within a UserPreferencesProvider");
  }
  return context;
}

/**
 * Hook to get just the font size preference
 * Usage: const fontSize = useFontSize();
 */
export function useFontSize() {
  const { preferences } = useUserPreferences();
  return preferences?.fontSize || "medium";
}

/**
 * Hook to get just the theme preference
 * Usage: const theme = useTheme();
 */
export function useTheme() {
  const { preferences } = useUserPreferences();
  return preferences?.theme || "light";
}
