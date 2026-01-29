"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type QuantityStepperProps = {
  value: number;
  max: number;
  min?: number;
  step?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
};

export function QuantityStepper({
  value,
  max,
  min = 0,
  step = 1,
  onChange,
  disabled = false,
  size = "md",
}: QuantityStepperProps) {
  const handleIncrement = () => {
    if (value + step <= max) {
      onChange(value + step);
    }
  };

  const handleDecrement = () => {
    if (value - step >= min) {
      onChange(value - step);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value) || 0;
    if (newValue >= min && newValue <= max) {
      onChange(newValue);
    }
  };

  const sizeClasses = {
    sm: {
      button: "w-10 h-10",
      input: "w-16 h-10 text-base",
      icon: "h-5 w-5",
    },
    md: {
      button: "w-12 h-12",
      input: "w-20 h-12 text-lg",
      icon: "h-6 w-6",
    },
    lg: {
      button: "w-14 h-14",
      input: "w-24 h-14 text-xl",
      icon: "h-7 w-7",
    },
  };

  const sizes = sizeClasses[size];

  return (
    <div className="flex items-center gap-2">
      {/* Decrement Button */}
      <button
        type="button"
        onClick={handleDecrement}
        disabled={disabled || value <= min}
        className={cn(
          sizes.button,
          "flex items-center justify-center rounded-lg border-2 transition-all",
          "active:scale-95",
          disabled || value <= min
            ? "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-300"
            : "border-primary bg-white text-primary hover:bg-primary/5 active:bg-primary/10"
        )}
        aria-label="Decrease quantity"
      >
        <Minus className={sizes.icon} />
      </button>

      {/* Quantity Input */}
      <input
        type="number"
        value={value}
        onChange={handleInputChange}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        className={cn(
          sizes.input,
          "rounded-lg border-2 border-gray-300 text-center font-bold",
          "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
          "transition-all",
          disabled ? "cursor-not-allowed bg-gray-50 text-gray-400" : "bg-white text-gray-900"
        )}
        aria-label="Quantity"
      />

      {/* Increment Button */}
      <button
        type="button"
        onClick={handleIncrement}
        disabled={disabled || value >= max}
        className={cn(
          sizes.button,
          "flex items-center justify-center rounded-lg border-2 transition-all",
          "active:scale-95",
          disabled || value >= max
            ? "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-300"
            : "border-primary bg-white text-primary hover:bg-primary/5 active:bg-primary/10"
        )}
        aria-label="Increase quantity"
      >
        <Plus className={sizes.icon} />
      </button>

      {/* Max Indicator */}
      {max > 0 && (
        <div className="ml-2 flex flex-col items-start">
          <span className="text-xs text-gray-500">Max</span>
          <span className="text-sm font-semibold text-gray-700">{max}</span>
        </div>
      )}
    </div>
  );
}
