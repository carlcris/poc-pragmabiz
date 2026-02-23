import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SidebarState {
  isOpen: boolean;
  toggleSidebar: () => void;
  closeSidebar: () => void;
  openSidebar: () => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      isOpen: true,
      toggleSidebar: () => set((state) => ({ isOpen: !state.isOpen })),
      closeSidebar: () => set({ isOpen: false }),
      openSidebar: () => set({ isOpen: true }),
    }),
    {
      name: "sidebar-storage",
    }
  )
);
