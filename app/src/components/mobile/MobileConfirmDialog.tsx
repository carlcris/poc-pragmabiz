"use client";

import { AlertCircle, CheckCircle, Info, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MobileConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  variant?: "default" | "destructive" | "warning" | "success";
  isLoading?: boolean;
}

export function MobileConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  variant = "default",
  isLoading = false,
}: MobileConfirmDialogProps) {
  if (!open) return null;

  const handleConfirm = () => {
    onConfirm();
    if (!isLoading) {
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
    onOpenChange(false);
  };

  const getIcon = () => {
    switch (variant) {
      case "destructive":
        return <XCircle className="h-12 w-12 text-red-500" />;
      case "warning":
        return <AlertCircle className="h-12 w-12 text-orange-500" />;
      case "success":
        return <CheckCircle className="h-12 w-12 text-green-500" />;
      default:
        return <Info className="h-12 w-12 text-blue-500" />;
    }
  };

  const getConfirmButtonClass = () => {
    switch (variant) {
      case "destructive":
        return "bg-red-600 hover:bg-red-700";
      case "warning":
        return "bg-orange-600 hover:bg-orange-700";
      case "success":
        return "bg-green-600 hover:bg-green-700";
      default:
        return "bg-blue-600 hover:bg-blue-700";
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 animate-in fade-in"
        onClick={handleCancel}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-2xl shadow-2xl max-w-sm w-full pointer-events-auto animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Content */}
          <div className="p-6 text-center">
            {/* Icon */}
            <div className="flex justify-center mb-4">
              {getIcon()}
            </div>

            {/* Title */}
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {title}
            </h2>

            {/* Description */}
            <p className="text-sm text-gray-600 mb-6">
              {description}
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
              <Button
                onClick={handleConfirm}
                disabled={isLoading}
                className={`w-full h-12 text-base font-semibold ${getConfirmButtonClass()}`}
              >
                {isLoading ? "Processing..." : confirmText}
              </Button>
              <Button
                onClick={handleCancel}
                disabled={isLoading}
                variant="outline"
                className="w-full h-12 text-base font-semibold"
              >
                {cancelText}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
