"use client";

import { useMemo } from "react";
import { useItems } from "@/hooks/useItems";
import type { BackingType, GlazingType } from "@/lib/framing/types";

/**
 * Item codes for the glass and backing types, seeded by
 * `supabase/seed.sql`.
 *
 * These exist so a configured glass/backing can be written as a component row —
 * `item_id` is NOT NULL, and without an item the line would bill for glass and
 * backing that never appear on the customer's invoice.
 */
export const GLAZING_ITEM_CODES: Record<GlazingType, string> = {
  clear: "GLZ-CLEAR",
  double: "GLZ-DOUBLE",
  acrylic: "GLZ-ACRYLIC",
  non_glare: "GLZ-NONGLR",
  octagon: "GLZ-OCTAGON",
};

export const BACKING_ITEM_CODES: Record<BackingType, string> = {
  mdf: "BCK-MDF",
  plywood: "BCK-PLY",
  sintra: "BCK-SINTRA",
  foam: "BCK-FOAM",
};

export type FramingMaterialsCatalogue = {
  glazingItemId: (type: GlazingType) => string | null;
  backingItemId: (type: BackingType) => string | null;
  /** False while loading, or when the seeded items are missing entirely. */
  isReady: boolean;
};

/** Resolve the glass and backing type items so their ids can be persisted. */
export function useFramingMaterials(): FramingMaterialsCatalogue {
  const glazing = useItems({ search: "GLZ-", limit: 20 });
  const backing = useItems({ search: "BCK-", limit: 20 });

  return useMemo(() => {
    const byCode = new Map<string, string>();
    [...(glazing.data?.data ?? []), ...(backing.data?.data ?? [])].forEach((item) => {
      byCode.set(item.code, item.id);
    });

    const glazingCodes = Object.values(GLAZING_ITEM_CODES);
    const backingCodes = Object.values(BACKING_ITEM_CODES);
    const allPresent = [...glazingCodes, ...backingCodes].every((code) => byCode.has(code));

    return {
      glazingItemId: (type: GlazingType) => byCode.get(GLAZING_ITEM_CODES[type]) ?? null,
      backingItemId: (type: BackingType) => byCode.get(BACKING_ITEM_CODES[type]) ?? null,
      isReady: !glazing.isLoading && !backing.isLoading && allPresent,
    };
  }, [glazing.data, glazing.isLoading, backing.data, backing.isLoading]);
}
