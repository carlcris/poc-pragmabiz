"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { useUserPreferences } from "@/contexts/UserPreferencesContext";
import { type FontSize } from "@/types/user-preferences";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export function FontSizeSettings() {
  const t = useTranslations("fontSizeSettings");
  const { preferences, updateFontSize, loading } = useUserPreferences();

  const handleFontSizeChange = (value: string) => {
    updateFontSize(value as FontSize);
  };

  const fontSizes: FontSize[] = ["small", "medium", "large", "extra-large"];
  const fontSizeKeyMap: Record<
    FontSize,
    "size_small" | "size_medium" | "size_large" | "size_extraLarge"
  > = {
    small: "size_small",
    medium: "size_medium",
    large: "size_large",
    "extra-large": "size_extraLarge",
  };

  if (loading || !preferences) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">{t("title")}</h3>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
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
        <h3 className="text-lg font-medium">{t("title")}</h3>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <RadioGroup
        value={preferences.fontSize}
        onValueChange={handleFontSizeChange}
        className="space-y-2"
      >
        {fontSizes.map((size) => (
          <div key={size} className="flex items-center space-x-2">
            <RadioGroupItem value={size} id={`font-size-${size}`} />
            <Label htmlFor={`font-size-${size}`} className="flex-1 cursor-pointer">
              {t(fontSizeKeyMap[size])}
            </Label>
          </div>
        ))}
      </RadioGroup>

      <div className="mt-4 rounded-lg border bg-muted/50 p-4">
        <p className="text-sm">{t("preview")}</p>
      </div>
    </div>
  );
}
