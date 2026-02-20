import { useRealtimeDomainInvalidation } from "@/hooks/useRealtimeDomainInvalidation";

export const useInventoryRealtimeInvalidation = (queryKeys: string[], enabled = true) => {
  useRealtimeDomainInvalidation("inventory", { queryKeys, enabled });
};
