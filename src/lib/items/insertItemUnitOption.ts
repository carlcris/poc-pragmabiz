import type { Database } from "@/types/database.types";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";

const ITEM_UNIT_OPTION_BARCODE_CONSTRAINT = "ux_item_unit_options_company_barcode";
const MAX_ITEM_UNIT_OPTION_INSERT_ATTEMPTS = 5;

type SupabaseClient = Awaited<ReturnType<typeof createServerClientWithBU>>["supabase"];

type ItemUnitOptionInsertPayload = Omit<
  Database["public"]["Tables"]["item_unit_options"]["Insert"],
  "barcode"
> & {
  barcode?: string;
};

type ItemUnitOptionInsertError = {
  code?: string;
  details?: string;
  message: string;
};

const isItemUnitOptionBarcodeCollision = (error: ItemUnitOptionInsertError | null): boolean => {
  if (!error || error.code !== "23505") {
    return false;
  }

  return `${error.message} ${error.details ?? ""}`.includes(ITEM_UNIT_OPTION_BARCODE_CONSTRAINT);
};

export const insertItemUnitOptionWithRetry = async <TData>({
  payload,
  select,
  supabase,
}: {
  payload: ItemUnitOptionInsertPayload;
  select?: string;
  supabase: SupabaseClient;
}): Promise<{ data: TData | null; error: ItemUnitOptionInsertError | null }> => {
  let lastError: ItemUnitOptionInsertError | null = null;

  for (let attempt = 0; attempt < MAX_ITEM_UNIT_OPTION_INSERT_ATTEMPTS; attempt += 1) {
    if (select) {
      const { data, error } = await supabase
        .from("item_unit_options")
        .insert(payload)
        .select(select)
        .single();

      if (!error) {
        return { data: data as TData, error: null };
      }

      lastError = {
        code: error.code,
        details: error.details ?? undefined,
        message: error.message,
      };
    } else {
      const { error } = await supabase.from("item_unit_options").insert(payload);

      if (!error) {
        return { data: null, error: null };
      }

      lastError = {
        code: error.code,
        details: error.details ?? undefined,
        message: error.message,
      };
    }

    if (!isItemUnitOptionBarcodeCollision(lastError)) {
      break;
    }
  }

  return { data: null, error: lastError };
};
