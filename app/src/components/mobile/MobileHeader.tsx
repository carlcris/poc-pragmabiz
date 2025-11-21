"use client";

import { format } from "date-fns";
import { ChevronLeft, User, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useState } from "react";

interface MobileHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  vanName?: string;
  driverName?: string;
  showLogout?: boolean;
}

export function MobileHeader({
  title,
  subtitle,
  showBack = false,
  vanName,
  driverName,
  showLogout = false,
}: MobileHeaderProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) return;

    const confirmed = window.confirm("Are you sure you want to logout?");
    if (!confirmed) return;

    setIsLoggingOut(true);
    try {
      await supabase.auth.signOut();
      router.push("/mobile/login");
    } catch (error) {
      console.error("Logout error:", error);
      alert("Failed to logout. Please try again.");
      setIsLoggingOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
      {/* Top bar with back button and user info */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          {showBack && (
            <button
              onClick={() => router.back()}
              className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Go back"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}
          <div>
            <h1 className="text-lg font-bold text-gray-900">{title}</h1>
            {subtitle && (
              <p className="text-xs text-gray-500">{subtitle}</p>
            )}
          </div>
        </div>

        {/* User/Van info indicator with logout */}
        <div className="flex items-center gap-2">
          {(driverName || vanName) && (
            <div className="flex items-center gap-2 text-xs">
              <User className="h-4 w-4 text-gray-400" />
              <div className="text-right">
                {driverName && (
                  <div className="font-medium text-gray-700">{driverName}</div>
                )}
                {vanName && (
                  <div className="text-gray-500">{vanName}</div>
                )}
              </div>
            </div>
          )}

          {showLogout && (
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="p-2 hover:bg-red-50 rounded-full transition-colors disabled:opacity-50"
              aria-label="Logout"
              title="Logout"
            >
              <LogOut className="h-5 w-5 text-red-600" />
            </button>
          )}
        </div>
      </div>

      {/* Date banner */}
      <div className="px-4 py-2 bg-gray-50 border-t">
        <p className="text-xs text-gray-600 text-center">
          📅 {format(new Date(), "EEEE, MMMM d, yyyy")}
        </p>
      </div>
    </header>
  );
}
