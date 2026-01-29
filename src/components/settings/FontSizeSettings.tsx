"use client";

import React from "react";
import { useUserPreferences } from "@/contexts/UserPreferencesContext";
import { FONT_SIZE_LABELS, type FontSize } from "@/types/user-preferences";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export function FontSizeSettings() {
  const { preferences, updateFontSize, loading } = useUserPreferences();

  const handleFontSizeChange = (value: string) => {
    updateFontSize(value as FontSize);
  };

  if (loading || !preferences) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">Font Size</h3>
          <p className="text-sm text-muted-foreground">
            Adjust the text size throughout the application
          </p>
        </div>
        <div className="animate-pulse">
          <div className="h-10 w-full rounded bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Font Size</h3>
        <p className="text-sm text-muted-foreground">
          Adjust the text size throughout the application
        </p>
      </div>

      <RadioGroup
        value={preferences.fontSize}
        onValueChange={handleFontSizeChange}
        className="space-y-2"
      >
        {(Object.keys(FONT_SIZE_LABELS) as FontSize[]).map((size) => (
          <div key={size} className="flex items-center space-x-2">
            <RadioGroupItem value={size} id={`font-size-${size}`} />
            <Label htmlFor={`font-size-${size}`} className="flex-1 cursor-pointer">
              {FONT_SIZE_LABELS[size]}
            </Label>
          </div>
        ))}
      </RadioGroup>

      <div className="mt-4 rounded-lg border bg-muted/50 p-4">
        <p className="text-sm">Preview: This is how text will appear at the selected size.</p>
      </div>
    </div>
  );
}
