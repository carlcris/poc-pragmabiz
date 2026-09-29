"use client";

import { useMemo } from "react";
import { useItems } from "@/hooks/useItems";
import type { LSupportSize } from "@/lib/framing/types";

/**
 * Item codes for the fitting hardware billed on chop & join work. Seeded by
 * `supabase/seed.sql`.
 */
export const FRAMING_HARDWARE_CODES = {
  flexipoints: "FIT-FLEXI",
  multipoints: "FIT-MULTI",
  lSupportSmall: "FIT-LSUP-S",
  lSupportBig: "FIT-LSUP-B",
} as const;

export type FramingHardwareItem = {
  itemId: string;
  unitRate: number;
};

export type FramingHardwareCatalogue = {
  flexipoints: FramingHardwareItem | null;
  multipoints: FramingHardwareItem | null;
  lSupport: Record<LSupportSize, FramingHardwareItem | null>;
  /** False while loading, or when the hardware items are missing entirely. */
  isReady: boolean;
};

/**
 * Resolve the hardware items so their prices and ids can be attached to a frame
 * configuration. Without the item id a component cannot be persisted — and the
 * customer would be charged for hardware that never appears on their invoice.
 */
export function useFramingHardware(): FramingHardwareCatalogue {
  const { data, isLoading } = useItems({ search: "FIT-", limit: 20 });

  return useMemo(() => {
    const items = data?.data ?? [];
    const byCode = new Map(items.map((item) => [item.code, item]));

    const resolve = (code: string): FramingHardwareItem | null => {
      const item = byCode.get(code);
      if (!item) return null;
      return { itemId: item.id, unitRate: item.listPrice ?? 0 };
    };

    const flexipoints = resolve(FRAMING_HARDWARE_CODES.flexipoints);
    const multipoints = resolve(FRAMING_HARDWARE_CODES.multipoints);
    const small = resolve(FRAMING_HARDWARE_CODES.lSupportSmall);
    const big = resolve(FRAMING_HARDWARE_CODES.lSupportBig);

    return {
      flexipoints,
      multipoints,
      lSupport: { small, big },
      isReady: !isLoading && Boolean(flexipoints && multipoints && small && big),
    };
  }, [data, isLoading]);
}
