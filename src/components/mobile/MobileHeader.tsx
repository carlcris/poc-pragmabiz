"use client";

import { format } from "date-fns";
import { ChevronLeft, User, LogOut, Truck, UserCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useState, useEffect, useRef } from "react";
import { MobileConfirmDialog } from "./MobileConfirmDialog";
import { MobileAlert } from "./MobileAlert";

interface MobileHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  backHref?: string;
  vanName?: string;
  driverName?: string;
  showLogout?: boolean;
}

export function MobileHeader({
  title,
  subtitle,
  showBack = false,
  backHref,
  vanName,
  driverName,
  showLogout = true,
}: MobileHeaderProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showErrorAlert, setShowErrorAlert] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
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

  const handleLogoutClick = () => {
    setShowDropdown(false);
    setShowLogoutConfirm(true);
  };

  const handleLogoutConfirm = async () => {
    if (isLoggingOut) return;

    setIsLoggingOut(true);
    try {
      await supabase.auth.signOut();
      router.push("/mobile/login");
    } catch {
      setErrorMessage("Failed to logout. Please try again.");
      setShowErrorAlert(true);
      setIsLoggingOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b bg-white shadow-sm">
      {/* Top bar with back button and user info */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {showBack && (
            <button
              onClick={() => (backHref ? router.push(backHref) : router.back())}
              className="-ml-2 flex-shrink-0 rounded-full p-2 transition-colors hover:bg-gray-100"
              aria-label="Go back"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold text-gray-900">{title}</h1>
            {subtitle && <p className="truncate text-xs text-gray-500">{subtitle}</p>}
          </div>
        </div>

        {/* User Profile Dropdown */}
        {showLogout && (
          <div className="relative flex-shrink-0" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 rounded-lg p-2 transition-colors hover:bg-gray-100"
              aria-label="User menu"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
                <User className="h-5 w-5 text-primary-foreground" />
              </div>
            </button>

            {showDropdown && (
              <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                {/* User Info Section */}
                <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                  <div className="truncate text-sm font-medium text-gray-900">{userEmail}</div>
                  <div className="truncate text-xs text-gray-500">{userEmail}</div>
                </div>

                {/* Menu Items */}
                <div className="py-1">
                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      // Navigate to profile if needed
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-sm text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    <User className="h-5 w-5 text-gray-600" />
                    <span>Profile</span>
                  </button>

                  <button
                    onClick={handleLogoutClick}
                    disabled={isLoggingOut}
                    className="flex w-full items-center gap-3 px-4 py-3 text-sm text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                  >
                    <LogOut className="h-5 w-5" />
                    <span>Log out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Compact Info Bar */}
      <div className="border-t border-primary/20 bg-gradient-to-r from-primary/10 to-primary/5 px-4 py-2">
        <div className="flex items-center justify-between text-xs">
          {/* Van & Driver Info - Compact */}
          {(vanName || driverName) && (
            <div className="flex items-center gap-3">
              {vanName && (
                <div className="flex items-center gap-1.5">
                  <Truck className="h-3.5 w-3.5 text-primary" />
                  <span className="font-semibold text-gray-700">{vanName}</span>
                </div>
              )}
              {driverName && (
                <div className="flex items-center gap-1.5">
                  <UserCircle className="h-3.5 w-3.5 text-green-600" />
                  <span className="font-medium text-gray-600">{driverName}</span>
                </div>
              )}
            </div>
          )}

          {/* Date - Compact */}
          <div className="flex items-center gap-1 text-gray-600">
            <span>📅</span>
            <span className="font-medium">{format(new Date(), "MMM d, yyyy")}</span>
          </div>
        </div>
      </div>

      {/* Logout Confirmation Dialog */}
      <MobileConfirmDialog
        open={showLogoutConfirm}
        onOpenChange={setShowLogoutConfirm}
        title="Confirm Logout"
        description="Are you sure you want to logout?"
        confirmText="Logout"
        cancelText="Cancel"
        onConfirm={handleLogoutConfirm}
        variant="destructive"
        isLoading={isLoggingOut}
      />

      {/* Error Alert */}
      <MobileAlert
        open={showErrorAlert}
        onOpenChange={setShowErrorAlert}
        title="Logout Failed"
        description={errorMessage}
        variant="destructive"
        duration={4000}
      />
    </header>
  );
}
