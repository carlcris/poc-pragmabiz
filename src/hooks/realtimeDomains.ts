import { DELIVERY_NOTES_QUERY_KEY, PICK_LISTS_QUERY_KEY } from "@/hooks/queryKeys";

export type RealtimeDomainConfig = {
  tables: string[];
  queryKeys: string[];
  schema?: string;
  debounceMs?: number;
  channelKey?: string;
};

export const realtimeDomains = {
  inventory: {
    tables: ["delivery_notes", "delivery_note_items", "pick_lists", "pick_list_items"],
    queryKeys: [DELIVERY_NOTES_QUERY_KEY, PICK_LISTS_QUERY_KEY],
    channelKey: "inventory",
  },
} satisfies Record<string, RealtimeDomainConfig>;

export type RealtimeDomainName = keyof typeof realtimeDomains;
