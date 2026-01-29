"use client";

import { format } from "date-fns";
import { ChevronLeft, User, LogOut, Warehouse } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useState, useEffect, useRef } from "react";

interface TabletHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  backHref?: string;
  warehouseName?: string;
  showLogout?: boolean;
}

export function TabletHeader({
  title,
  subtitle,
  showBack = false,
  backHref,
  warehouseName,
  showLogout = true,
}: TabletHeaderProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get user email
  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
      }
    };
    getUser();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDropdown]);

  const handleLogout = async () => {
    if (isLoggingOut) return;

    setIsLoggingOut(true);
    try {
      await supabase.auth.signOut();
      router.push("/tablet/login");
    } catch (error) {
      console.error("Logout failed:", error);
      setIsLoggingOut(false);
      setShowDropdown(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b bg-white shadow-sm">
      {/* Top bar with back button and user info */}
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          {showBack && (
            <button
              onClick={() => (backHref ? router.push(backHref) : router.back())}
              className="-ml-2 flex-shrink-0 rounded-full p-2 transition-colors hover:bg-gray-100 active:scale-90"
              aria-label="Go back"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold text-gray-900">{title}</h1>
            {subtitle && <p className="mt-0.5 truncate text-sm text-gray-500">{subtitle}</p>}
          </div>
        </div>

        {/* User Profile Dropdown */}
        {showLogout && (
          <div className="relative flex-shrink-0" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 rounded-lg p-2 transition-colors hover:bg-gray-100 active:scale-95"
              aria-label="User menu"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary">
                <User className="h-5 w-5 text-primary-foreground" />
              </div>
            </button>

            {showDropdown && (
              <div className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                {/* User Info Section */}
                <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                  <div className="truncate text-sm font-medium text-gray-900">{userEmail}</div>
                  <div className="mt-0.5 text-xs text-gray-500">Warehouse Operator</div>
                </div>

                {/* Menu Items */}
                <div className="py-1">
                  <button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="flex w-full items-center gap-3 px-4 py-3 text-sm text-red-600 transition-colors hover:bg-red-50 active:scale-95 disabled:opacity-50"
                  >
                    <LogOut className="h-5 w-5" />
                    <span>{isLoggingOut ? "Logging out..." : "Log out"}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Info Bar - Warehouse and Date */}
      <div className="border-t border-primary/20 bg-gradient-to-r from-primary/10 to-primary/5 px-6 py-2.5">
        <div className="flex items-center justify-between text-sm">
          {/* Warehouse Info */}
          {warehouseName && (
            <div className="flex items-center gap-2">
              <Warehouse className="h-4 w-4 text-primary" />
              <span className="font-semibold text-gray-700">{warehouseName}</span>
            </div>
          )}

          {/* Date */}
          <div className="flex items-center gap-1.5 text-gray-600">
            <span>📅</span>
            <span className="font-medium">{format(new Date(), "MMM d, yyyy")}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
