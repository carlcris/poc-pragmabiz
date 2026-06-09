import { apiRequest } from "@/api/client";
import type { ScannedItemInfo, ScannedItemInfoResponse } from "@/contracts/itemInfo";

export const getScannedItemInfo = async (payload: string): Promise<ScannedItemInfo | null> => {
  const response = await apiRequest<ScannedItemInfoResponse>("/api/mobile/items/scan", {
    query: { payload }
  });
  return response.data;
};
