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
      const { data: { user } } = await supabase.auth.getUser();
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
    <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
      {/* Top bar with back button and user info */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {showBack && (
            <button
              onClick={() => backHref ? router.push(backHref) : router.back()}
              className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
              aria-label="Go back"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-900 truncate">{title}</h1>
            {subtitle && (
              <p className="text-xs text-gray-500 truncate">{subtitle}</p>
            )}
          </div>
        </div>

        {/* User Profile Dropdown */}
        {showLogout && (
          <div className="relative flex-shrink-0" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="User menu"
            >
              <div className="flex items-center justify-center w-8 h-8 bg-primary rounded-full">
                <User className="h-5 w-5 text-primary-foreground" />
              </div>
            </button>

            {showDropdown && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-50">
                {/* User Info Section */}
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {userEmail}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {userEmail}
                  </div>
                </div>

                {/* Menu Items */}
                <div className="py-1">
                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      // Navigate to profile if needed
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <User className="h-5 w-5 text-gray-600" />
                    <span>Profile</span>
                  </button>

                  <button
                    onClick={handleLogoutClick}
                    disabled={isLoggingOut}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
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
      <div className="px-4 py-2 bg-gradient-to-r from-primary/10 to-primary/5 border-t border-primary/20">
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
