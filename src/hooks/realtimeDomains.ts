import {
  DELIVERY_NOTES_QUERY_KEY,
  GRNS_QUERY_KEY,
  LOAD_LISTS_QUERY_KEY,
  NOTIFICATIONS_QUERY_KEY,
  PICK_LISTS_QUERY_KEY,
  STOCK_REQUISITIONS_QUERY_KEY,
} from "@/hooks/queryKeys";

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
  notifications: {
    tables: ["notifications"],
    queryKeys: [NOTIFICATIONS_QUERY_KEY],
    channelKey: "notifications",
  },
  purchasing: {
    tables: [
      "stock_requisitions",
      "stock_requisition_items",
      "load_lists",
      "load_list_items",
      "load_list_sr_items",
      "grns",
      "grn_items",
      "grn_boxes",
    ],
    queryKeys: [STOCK_REQUISITIONS_QUERY_KEY, LOAD_LISTS_QUERY_KEY, GRNS_QUERY_KEY],
    channelKey: "purchasing",
  },
} satisfies Record<string, RealtimeDomainConfig>;

export type RealtimeDomainName = keyof typeof realtimeDomains;
