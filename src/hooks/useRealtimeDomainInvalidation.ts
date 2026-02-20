import {
  realtimeDomains,
  type RealtimeDomainConfig,
  type RealtimeDomainName,
} from "@/hooks/realtimeDomains";
import { useRealtimeQueryInvalidation } from "@/hooks/useRealtimeQueryInvalidation";

type UseRealtimeDomainInvalidationOptions = {
  enabled?: boolean;
  queryKeys?: string[];
};

export const useRealtimeDomainInvalidation = (
  domain: RealtimeDomainName,
  options?: UseRealtimeDomainInvalidationOptions
) => {
  const config: RealtimeDomainConfig = realtimeDomains[domain];

  useRealtimeQueryInvalidation({
    tables: config.tables,
    queryKeys: options?.queryKeys || config.queryKeys,
    schema: config.schema,
    debounceMs: config.debounceMs,
    channelKey: config.channelKey || domain,
    enabled: options?.enabled ?? true,
  });
};
