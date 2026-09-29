"use client";

import { useMemo } from "react";
import { useItems } from "@/hooks/useItems";
import { FRAME_SERVICE_ITEM_CODES, type FrameServiceItem } from "@/lib/framing/toLineItem";
import type { BillingMode } from "@/lib/framing/types";

/**
 * The reference items a configured line is headed by, seeded by
 * `supabase/seed.sql`.
 *
 * A line may carry several sizes with different mouldings, so no moulding can
 * stand for the whole job — and `item_id` is NOT NULL. These name the line
 * instead. They hold no stock: the line sets `skipInventory`, and material is
 * drawn later through the job order's requisitions.
 */
export function useFrameServiceItems(): {
  resolve: (billingMode: BillingMode) => FrameServiceItem | null;
  isReady: boolean;
} {
  const { data, isLoading } = useItems({ search: "SVC-", limit: 20 });

  return useMemo(() => {
    const byCode = new Map((data?.data ?? []).map((item) => [item.code, item]));

    const resolve = (billingMode: BillingMode): FrameServiceItem | null => {
      const item = byCode.get(FRAME_SERVICE_ITEM_CODES[billingMode]);
      return item ? { id: item.id, code: item.code, name: item.name } : null;
    };

    return {
      resolve,
      isReady:
        !isLoading &&
        Object.values(FRAME_SERVICE_ITEM_CODES).every((code) => byCode.has(code)),
    };
  }, [data, isLoading]);
}
