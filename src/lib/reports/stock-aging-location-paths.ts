import type { SupabaseClient } from "@supabase/supabase-js";

type StockAgingLocation = { id: string; name: string | null; path_ids: string[] };

// Resolve only ancestors needed by this report, not the entire warehouse tree.
export async function fetchStockAgingLocationPaths(
  supabase: SupabaseClient,
  companyId: string,
  locations: StockAgingLocation[]
) {
  const names = new Map(locations.map((location) => [location.id, location.name]));
  const missingIds = [...new Set(locations.flatMap((location) => location.path_ids))].filter(
    (id) => !names.has(id)
  );
  for (let start = 0; start < missingIds.length; start += 200) {
    const ids = missingIds.slice(start, start + 200);
    let loaded = 0;
    while (loaded < ids.length) {
      const { data, error } = await supabase
        .from("warehouse_locations")
        .select("id, name")
        .eq("company_id", companyId)
        .in("id", ids)
        .order("id")
        .range(loaded, ids.length - 1);
      if (error) throw error;
      if (!data?.length) throw new Error("Stock aging location ancestors are unavailable");
      for (const location of data) names.set(location.id, location.name);
      loaded += data.length;
    }
  }
  return new Map(
    locations.map((location) => [
      location.id,
      location.path_ids.map((id) => names.get(id)?.trim() || "--").join(" / "),
    ])
  );
}
