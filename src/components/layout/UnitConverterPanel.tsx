"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowDownUp, ArrowRight, Calculator, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  UNIT_BASE_FACTORS,
  celsiusToFahrenheit,
  convertLinearMeasurement,
  fahrenheitToCelsius,
} from "@/lib/unit-conversion";
import { cn } from "@/lib/utils";

type MeasurementCategory = "length" | "mass" | "volume" | "temperature";
type MeasurementSystem = "us" | "metric";
type ConversionMode = "imperial" | "metric" | "imperialToMetric" | "metricToImperial";

type UnitDefinition = {
  id: string;
  label: string;
  symbol: string;
  system: MeasurementSystem;
  toBase: (value: number) => number;
  fromBase: (value: number) => number;
};

type CategoryDefinition = {
  label: string;
  defaultUnitIds: Record<MeasurementSystem, [string, string]>;
  units: UnitDefinition[];
};

type UnitConverterPanelProps = {
  open: boolean;
  onClose: () => void;
};

const conversionModeSystems: Record<
  ConversionMode,
  { fromSystem: MeasurementSystem; toSystem: MeasurementSystem }
> = {
  imperial: { fromSystem: "us", toSystem: "us" },
  metric: { fromSystem: "metric", toSystem: "metric" },
  imperialToMetric: { fromSystem: "us", toSystem: "metric" },
  metricToImperial: { fromSystem: "metric", toSystem: "us" },
};

const getDefaultUnitPair = (category: CategoryDefinition, mode: ConversionMode) => {
  const { fromSystem, toSystem } = conversionModeSystems[mode];
  const fromUnitId = category.defaultUnitIds[fromSystem][0];
  const toUnitId =
    fromSystem === toSystem
      ? category.defaultUnitIds[toSystem][1]
      : category.defaultUnitIds[toSystem][0];

  return { fromUnitId, toUnitId };
};

const createLinearUnit = (
  id: string,
  label: string,
  symbol: string,
  system: MeasurementSystem,
  baseFactor: number
): UnitDefinition => ({
  id,
  label,
  symbol,
  system,
  toBase: (value) => convertLinearMeasurement(value, baseFactor, 1),
  fromBase: (value) => convertLinearMeasurement(value, 1, baseFactor),
});

export function UnitConverterPanel({ open, onClose }: UnitConverterPanelProps) {
  const t = useTranslations("unitConverter");
  const locale = useLocale();
  const categories = useMemo<Record<MeasurementCategory, CategoryDefinition>>(
    () => ({
      length: {
        label: t("length"),
        defaultUnitIds: {
          us: ["inch", "foot"],
          metric: ["centimeter", "meter"],
        },
        units: [
          createLinearUnit("inch", t("inch"), "in", "us", UNIT_BASE_FACTORS.inch),
          createLinearUnit("foot", t("foot"), "ft", "us", UNIT_BASE_FACTORS.foot),
          createLinearUnit("yard", t("yard"), "yd", "us", UNIT_BASE_FACTORS.yard),
          createLinearUnit("mile", t("mile"), "mi", "us", UNIT_BASE_FACTORS.mile),
          createLinearUnit(
            "millimeter",
            t("millimeter"),
            "mm",
            "metric",
            UNIT_BASE_FACTORS.millimeter
          ),
          createLinearUnit(
            "centimeter",
            t("centimeter"),
            "cm",
            "metric",
            UNIT_BASE_FACTORS.centimeter
          ),
          createLinearUnit("meter", t("meter"), "m", "metric", UNIT_BASE_FACTORS.meter),
          createLinearUnit(
            "kilometer",
            t("kilometer"),
            "km",
            "metric",
            UNIT_BASE_FACTORS.kilometer
          ),
        ],
      },
      mass: {
        label: t("mass"),
        defaultUnitIds: {
          us: ["pound", "ounce"],
          metric: ["kilogram", "gram"],
        },
        units: [
          createLinearUnit("ounce", t("ounce"), "oz", "us", UNIT_BASE_FACTORS.ounce),
          createLinearUnit("pound", t("pound"), "lb", "us", UNIT_BASE_FACTORS.pound),
          createLinearUnit("gram", t("gram"), "g", "metric", UNIT_BASE_FACTORS.gram),
          createLinearUnit("kilogram", t("kilogram"), "kg", "metric", UNIT_BASE_FACTORS.kilogram),
        ],
      },
      volume: {
        label: t("volume"),
        defaultUnitIds: {
          us: ["gallon", "fluidOunce"],
          metric: ["liter", "milliliter"],
        },
        units: [
          createLinearUnit("teaspoon", t("teaspoon"), "tsp", "us", UNIT_BASE_FACTORS.teaspoon),
          createLinearUnit(
            "tablespoon",
            t("tablespoon"),
            "tbsp",
            "us",
            UNIT_BASE_FACTORS.tablespoon
          ),
          createLinearUnit(
            "fluidOunce",
            t("fluidOunce"),
            "fl oz",
            "us",
            UNIT_BASE_FACTORS.fluidOunce
          ),
          createLinearUnit("cup", t("cup"), "cup", "us", UNIT_BASE_FACTORS.cup),
          createLinearUnit("pint", t("pint"), "pt", "us", UNIT_BASE_FACTORS.pint),
          createLinearUnit("quart", t("quart"), "qt", "us", UNIT_BASE_FACTORS.quart),
          createLinearUnit("gallon", t("gallon"), "gal", "us", UNIT_BASE_FACTORS.gallon),
          createLinearUnit(
            "milliliter",
            t("milliliter"),
            "mL",
            "metric",
            UNIT_BASE_FACTORS.milliliter
          ),
          createLinearUnit("liter", t("liter"), "L", "metric", UNIT_BASE_FACTORS.liter),
        ],
      },
      temperature: {
        label: t("temperature"),
        defaultUnitIds: {
          us: ["fahrenheit", "fahrenheit"],
          metric: ["celsius", "celsius"],
        },
        units: [
          {
            id: "fahrenheit",
            label: t("fahrenheit"),
            symbol: "°F",
            system: "us",
            toBase: fahrenheitToCelsius,
            fromBase: celsiusToFahrenheit,
          },
          {
            id: "celsius",
            label: t("celsius"),
            symbol: "°C",
            system: "metric",
            toBase: (value) => value,
            fromBase: (value) => value,
          },
        ],
      },
    }),
    [t]
  );

  const initialMode: ConversionMode = "imperialToMetric";
  const initialUnits = getDefaultUnitPair(categories.length, initialMode);
  const [conversionMode, setConversionMode] = useState<ConversionMode>(initialMode);
  const [categoryId, setCategoryId] = useState<MeasurementCategory>("length");
  const [fromUnitId, setFromUnitId] = useState(initialUnits.fromUnitId);
  const [toUnitId, setToUnitId] = useState(initialUnits.toUnitId);
  const [inputValue, setInputValue] = useState("1");

  const category = categories[categoryId];
  const { fromSystem, toSystem } = conversionModeSystems[conversionMode];
  const fromUnits = category.units.filter((unit) => unit.system === fromSystem);
  const toUnits = category.units.filter((unit) => unit.system === toSystem);
  const fromUnit = fromUnits.find((unit) => unit.id === fromUnitId) ?? fromUnits[0];
  const toUnit = toUnits.find((unit) => unit.id === toUnitId) ?? toUnits[0];
  const parsedInput = inputValue.trim() === "" ? null : Number(inputValue);
  const convertedValue =
    parsedInput !== null && Number.isFinite(parsedInput)
      ? toUnit.fromBase(fromUnit.toBase(parsedInput))
      : null;
  const formattedResult =
    convertedValue === null
      ? null
      : new Intl.NumberFormat(locale, {
          maximumFractionDigits: 8,
        }).format(convertedValue);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  const handleCategoryChange = (value: string) => {
    const nextCategoryId = value as MeasurementCategory;
    const nextCategory = categories[nextCategoryId];
    const nextUnits = getDefaultUnitPair(nextCategory, conversionMode);
    setCategoryId(nextCategoryId);
    setFromUnitId(nextUnits.fromUnitId);
    setToUnitId(nextUnits.toUnitId);
  };

  const handleConversionModeChange = (value: string) => {
    const nextMode = value as ConversionMode;
    const nextUnits = getDefaultUnitPair(category, nextMode);
    setConversionMode(nextMode);
    setFromUnitId(nextUnits.fromUnitId);
    setToUnitId(nextUnits.toUnitId);
  };

  const handleSwapUnits = () => {
    if (convertedValue !== null) {
      setInputValue(String(Number(convertedValue.toPrecision(12))));
    }
    if (conversionMode === "imperialToMetric") {
      setConversionMode("metricToImperial");
    } else if (conversionMode === "metricToImperial") {
      setConversionMode("imperialToMetric");
    }
    setFromUnitId(toUnit.id);
    setToUnitId(fromUnit.id);
  };

  const conversionModeOptions: Array<{ value: ConversionMode; label: string; icon: string }> = [
    { value: "imperial", label: t("imperialSystem"), icon: "US → US" },
    { value: "metric", label: t("metricSystem"), icon: "SI → SI" },
    { value: "imperialToMetric", label: t("imperialToMetric"), icon: "US → SI" },
    { value: "metricToImperial", label: t("metricToImperial"), icon: "SI → US" },
  ];

  const currentModeOption = conversionModeOptions.find((opt) => opt.value === conversionMode);

  return (
    <aside
      id="unit-converter-panel"
      aria-label={t("title")}
      aria-hidden={!open}
      inert={!open}
      className={cn(
        "absolute inset-y-0 right-16 z-20 hidden w-80 flex-col border-l border-border bg-card shadow-xl transition-all duration-300 ease-out lg:flex",
        open ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-full opacity-0"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Calculator className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">{t("title")}</h2>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8 shrink-0 hover:bg-background"
          aria-label={t("close")}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {/* Conversion Mode & Measurement Type */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="unit-converter-mode" className="text-xs font-medium text-muted-foreground">
                {t("conversionMode")}
              </Label>
              <Select value={conversionMode} onValueChange={handleConversionModeChange}>
                <SelectTrigger id="unit-converter-mode" className="h-9">
                  <SelectValue>
                    <span className="flex items-center gap-2 text-sm truncate">
                      <span className="font-mono text-xs font-semibold text-primary shrink-0">
                        {currentModeOption?.icon}
                      </span>
                      <span className="truncate">{currentModeOption?.label}</span>
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {conversionModeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-primary shrink-0">
                          {option.icon}
                        </span>
                        <span className="truncate">{option.label}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="unit-converter-category" className="text-xs font-medium text-muted-foreground">
                {t("measurementType")}
              </Label>
              <Select value={categoryId} onValueChange={handleCategoryChange}>
                <SelectTrigger id="unit-converter-category" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(categories) as [MeasurementCategory, CategoryDefinition][]).map(
                    ([id, definition]) => (
                      <SelectItem key={id} value={id}>
                        {definition.label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Conversion Flow */}
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            {/* From */}
            <div className="space-y-2">
              <Label htmlFor="unit-converter-from" className="text-xs font-medium text-muted-foreground">
                {t("from")}
              </Label>
              <Select value={fromUnit.id} onValueChange={setFromUnitId}>
                <SelectTrigger id="unit-converter-from" className="h-9 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fromUnits.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      <span className="flex items-center gap-1.5">
                        <span>{unit.label}</span>
                        <span className="text-xs text-muted-foreground">({unit.symbol})</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                id="unit-converter-value"
                type="number"
                inputMode="decimal"
                step="any"
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                placeholder="0"
                className="h-12 bg-background text-lg font-medium"
              />
            </div>

            {/* Swap Button */}
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleSwapUnits}
                  className="h-8 w-8 rounded-full bg-background shadow-sm hover:shadow-md"
                  aria-label={t("swapUnits")}
                >
                  <ArrowDownUp className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* To */}
            <div className="space-y-2">
              <Label htmlFor="unit-converter-to" className="text-xs font-medium text-muted-foreground">
                {t("to")}
              </Label>
              <Select value={toUnit.id} onValueChange={setToUnitId}>
                <SelectTrigger id="unit-converter-to" className="h-9 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {toUnits.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      <span className="flex items-center gap-1.5">
                        <span>{unit.label}</span>
                        <span className="text-xs text-muted-foreground">({unit.symbol})</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Result */}
          <div
            aria-live="polite"
            className={cn(
              "rounded-lg border p-4 transition-colors",
              formattedResult === null
                ? "border-border bg-muted/20"
                : "border-primary/20 bg-primary/5"
            )}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("result")}
            </p>
            {formattedResult === null ? (
              <p className="mt-3 text-sm text-muted-foreground">{t("invalidValue")}</p>
            ) : (
              <div className="mt-2 space-y-2">
                <p className="break-words text-3xl font-bold tracking-tight text-foreground">
                  {formattedResult}
                  <span className="ml-2 text-xl font-medium text-muted-foreground">
                    {toUnit.symbol}
                  </span>
                </p>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="font-medium">{inputValue}</span>
                  <span>{fromUnit.symbol}</span>
                  <ArrowRight className="h-3 w-3" />
                  <span className="font-medium">{formattedResult}</span>
                  <span>{toUnit.symbol}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
