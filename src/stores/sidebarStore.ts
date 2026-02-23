import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SidebarState {
  isOpen: boolean;
  openMenus: Record<string, boolean>;
  toggleSidebar: () => void;
  closeSidebar: () => void;
  openSidebar: () => void;
  toggleMenu: (title: string) => void;
  setMenuOpen: (title: string, isOpen: boolean) => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      isOpen: true,
      openMenus: {},
      toggleSidebar: () => set((state) => ({ isOpen: !state.isOpen })),
      closeSidebar: () => set({ isOpen: false }),
      openSidebar: () => set({ isOpen: true }),
      toggleMenu: (title) =>
        set((state) => ({
          openMenus: {
            ...state.openMenus,
            [title]: !state.openMenus[title],
          },
        })),
      setMenuOpen: (title, isOpen) =>
        set((state) => ({
          openMenus: {
            ...state.openMenus,
            [title]: isOpen,
          },
        })),
    }),
    {
      name: "sidebar-storage",
    }
  )
);
