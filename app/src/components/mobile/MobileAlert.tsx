"use client";

import { AlertCircle, CheckCircle, Info, XCircle, X } from "lucide-react";
import { useEffect } from "react";

interface MobileAlertProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  variant?: "default" | "destructive" | "warning" | "success";
  duration?: number; // Auto-close after duration (ms), 0 means no auto-close
}

export function MobileAlert({
  open,
  onOpenChange,
  title,
  description,
  variant = "default",
  duration = 3000,
}: MobileAlertProps) {
  useEffect(() => {
    if (open && duration > 0) {
      const timer = setTimeout(() => {
        onOpenChange(false);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [open, duration, onOpenChange]);

  if (!open) return null;

  const getIcon = () => {
    switch (variant) {
      case "destructive":
        return <XCircle className="h-6 w-6 text-red-500" />;
      case "warning":
        return <AlertCircle className="h-6 w-6 text-orange-500" />;
      case "success":
        return <CheckCircle className="h-6 w-6 text-green-500" />;
      default:
        return <Info className="h-6 w-6 text-blue-500" />;
    }
  };

  const getBgColor = () => {
    switch (variant) {
      case "destructive":
        return "bg-red-50 border-red-200";
      case "warning":
        return "bg-orange-50 border-orange-200";
      case "success":
        return "bg-green-50 border-green-200";
      default:
        return "bg-blue-50 border-blue-200";
    }
  };

  const getTextColor = () => {
    switch (variant) {
      case "destructive":
        return "text-red-900";
      case "warning":
        return "text-orange-900";
      case "success":
        return "text-green-900";
      default:
        return "text-blue-900";
    }
  };

  return (
    <div className="fixed top-4 left-4 right-4 z-50 animate-in slide-in-from-top duration-300">
      <div className={`${getBgColor()} border-2 rounded-xl shadow-lg p-4`}>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            {getIcon()}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className={`font-semibold ${getTextColor()} text-base`}>
              {title}
            </h3>
            {description && (
              <p className={`mt-1 text-sm ${getTextColor()} opacity-80`}>
                {description}
              </p>
            )}
          </div>

          <button
            onClick={() => onOpenChange(false)}
            className={`flex-shrink-0 ${getTextColor()} opacity-60 hover:opacity-100 transition-opacity`}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
