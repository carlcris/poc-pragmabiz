import type { SupabaseClient } from "@supabase/supabase-js";

type WarehouseLocationPathRow = {
  id: string;
  code: string;
  name: string | null;
  path_ids: string[];
};

type WarehouseLocationLabel = { code: string; name: string | null };

const getLocationLabel = (location: WarehouseLocationLabel) =>
  location.name?.trim() || location.code;

// Names-only addresses such as "Rack A / Bin 9", keyed by location id.
// Ancestors of every given location are read in one batched query.
export const fetchWarehouseLocationNamePaths = async (
  supabase: SupabaseClient,
  companyId: string,
  locations: ReadonlyArray<WarehouseLocationPathRow>
): Promise<{ data: Map<string, string>; error: unknown }> => {
  const ancestorIds = [
    ...new Set(
      locations.flatMap((location) => location.path_ids.filter((id) => id !== location.id))
    ),
  ];
  const labelsById = new Map<string, WarehouseLocationLabel>(
    locations.map((location) => [location.id, location])
  );
  const missingIds = ancestorIds.filter((id) => !labelsById.has(id));
  if (missingIds.length > 0) {
    const { data: ancestors, error } = await supabase
      .from("warehouse_locations")
      .select("id, code, name")
      .eq("company_id", companyId)
      .in("id", missingIds);
    if (error) return { data: new Map(), error };
    for (const ancestor of ancestors ?? []) labelsById.set(ancestor.id, ancestor);
  }

  const namePaths = new Map<string, string>();
  for (const location of locations) {
    namePaths.set(
      location.id,
      location.path_ids
        .map((id) => labelsById.get(id))
        .filter((label): label is WarehouseLocationLabel => Boolean(label))
        .map(getLocationLabel)
        .join(" / ")
    );
  }
  return { data: namePaths, error: null };
};
