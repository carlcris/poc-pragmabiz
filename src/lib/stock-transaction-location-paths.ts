import type { SupabaseClient } from "@supabase/supabase-js";

type StockTransactionLocation = {
  id: string;
  name: string | null;
  path_ids: string[];
};

export const fetchStockTransactionLocationPaths = async (
  supabase: SupabaseClient,
  companyId: string,
  locations: StockTransactionLocation[]
): Promise<Map<string, string | null>> => {
  const locationNames = new Map(locations.map((location) => [location.id, location.name]));
  const missingPathIds = [...new Set(locations.flatMap((location) => location.path_ids))].filter(
    (id) => !locationNames.has(id)
  );
  if (missingPathIds.length > 0) {
    const { data: ancestors, error: ancestorError } = await supabase
      .from("warehouse_locations")
      .select("id, name")
      .eq("company_id", companyId)
      .in("id", missingPathIds);
    if (ancestorError) {
      console.error("Error loading stock transaction location paths:", ancestorError);
      throw new Error("Failed to load stock transaction location paths");
    }
    for (const ancestor of ancestors || []) locationNames.set(ancestor.id, ancestor.name);
  }
  return new Map(
    locations.map((location) => [
      location.id,
      location.path_ids
        .map((id) => locationNames.get(id)?.trim())
        .filter(Boolean)
        .join(" / ") || null,
    ])
  );
};
