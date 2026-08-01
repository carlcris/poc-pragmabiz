import { NextRequest, NextResponse } from "next/server";
import { RESOURCES } from "@/constants/resources";
import { checkPermissionForUser } from "@/lib/auth/checkPermission";
import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCompleteRackRectangle } from "@/lib/warehouse-floor-map-geometry";
import { ensurePickListActorAuthorized, getPickListAuthContext } from "../../../../_lib";

type RouteContext = {
  params: Promise<{ id: string; itemId: string }>;
};

const BUCKET = "warehouse-floor-maps";
const MOBILE_MAP_MAX_EDGE = 2048;

const safeError = (error: string, code: string, status: number) =>
  NextResponse.json({ error, code }, { status });

async function GETHandler(_request: NextRequest, context: RouteContext) {
  try {
    const auth = await getPickListAuthContext();
    if (auth instanceof NextResponse) return auth;

    const hasPermission = await checkPermissionForUser(
      {
        id: auth.userId,
        companyId: auth.companyId,
        businessUnitId: auth.currentBusinessUnitId,
      },
      RESOURCES.STOCK_REQUESTS,
      "edit"
    );
    if (!hasPermission) {
      return NextResponse.json(
        {
          error: "Forbidden",
          details: `You do not have permission to edit ${RESOURCES.STOCK_REQUESTS}`,
          resource: RESOURCES.STOCK_REQUESTS,
          action: "edit",
        },
        { status: 403 }
      );
    }

    const { id, itemId } = await context.params;
    const { data: pickItem, error: pickItemError } = await auth.supabase
      .from("pick_list_items")
      .select(
        `
          id,
          pick_list_id,
          suggested_pick_location_id,
          pick_list:pick_lists!pick_list_items_pick_list_id_fkey(
            id,
            business_unit_id,
            dn_id
          )
        `
      )
      .eq("company_id", auth.companyId)
      .eq("pick_list_id", id)
      .eq("id", itemId)
      .maybeSingle();

    if (pickItemError) {
      console.error("Failed to load pick location map source", pickItemError);
      return safeError("Failed to load pick location", "PICK_LOCATION_LOAD_FAILED", 500);
    }
    if (!pickItem) {
      return safeError("Pick-list item not found", "PICK_LIST_ITEM_NOT_FOUND", 404);
    }

    const pickList = Array.isArray(pickItem.pick_list) ? pickItem.pick_list[0] : pickItem.pick_list;
    if (!pickList) {
      return safeError("Pick list not found", "PICK_LIST_NOT_FOUND", 404);
    }

    const [permission, { data: deliveryNote, error: dnError }] = await Promise.all([
      ensurePickListActorAuthorized(
        auth.supabase,
        auth.companyId,
        pickList.business_unit_id,
        id,
        auth.userId
      ),
      auth.supabase
        .from("delivery_notes")
        .select("id, fulfilling_warehouse_id")
        .eq("company_id", auth.companyId)
        .eq("id", pickList.dn_id)
        .is("deleted_at", null)
        .maybeSingle(),
    ]);
    if (!permission.ok) {
      return safeError("You cannot access this pick list", "PICK_LIST_ACCESS_DENIED", 403);
    }
    if (dnError) {
      console.error("Failed to load pick location delivery note", dnError);
      return safeError("Failed to load pick location", "PICK_LOCATION_LOAD_FAILED", 500);
    }
    if (!pickItem.suggested_pick_location_id) {
      return safeError("No rack is assigned to this pick item", "PICK_LOCATION_NOT_ASSIGNED", 404);
    }
    if (!deliveryNote?.fulfilling_warehouse_id) {
      return safeError("No picking warehouse is assigned", "PICK_WAREHOUSE_NOT_ASSIGNED", 404);
    }

    const admin = createAdminClient();
    const [{ data: location, error: locationError }, { data: map, error: mapError }] =
      await Promise.all([
        admin
          .from("warehouse_locations")
          .select("id, warehouse_id, code, name")
          .eq("company_id", auth.companyId)
          .eq("warehouse_id", deliveryNote.fulfilling_warehouse_id)
          .eq("id", pickItem.suggested_pick_location_id)
          .is("deleted_at", null)
          .maybeSingle(),
        admin
          .from("warehouse_floor_maps")
          .select(
            `
              id,
              warehouse_id,
              name,
              image_path,
              image_width,
              image_height,
              version,
              warehouse:warehouses!warehouse_floor_maps_warehouse_id_fkey(
                id,
                warehouse_name,
                deleted_at
              )
            `
          )
          .eq("company_id", auth.companyId)
          .eq("warehouse_id", deliveryNote.fulfilling_warehouse_id)
          .maybeSingle(),
      ]);

    if (locationError || mapError) {
      console.error("Failed to resolve warehouse floor map", {
        locationError,
        mapError,
      });
      return safeError("Failed to load pick location", "PICK_LOCATION_LOAD_FAILED", 500);
    }
    if (!location) {
      return safeError("Pick location not found", "PICK_LOCATION_NOT_FOUND", 404);
    }
    if (!map) {
      return safeError(
        "No floor map is configured for this warehouse",
        "WAREHOUSE_FLOOR_MAP_NOT_CONFIGURED",
        404
      );
    }
    const warehouse = Array.isArray(map.warehouse) ? map.warehouse[0] : map.warehouse;
    if (!warehouse || warehouse.deleted_at) {
      return safeError("Pick location not found", "PICK_LOCATION_NOT_FOUND", 404);
    }

    const [{ data: racks, error: racksError }, { data: signedUrl, error: signedUrlError }] =
      await Promise.all([
        admin
          .from("warehouse_floor_map_racks")
          .select(
            `
              warehouse_location_id,
              x_basis_points,
              y_basis_points,
              width_basis_points,
              height_basis_points,
              warehouse_location:warehouse_locations!warehouse_floor_map_racks_warehouse_location_id_fkey(
                code,
                name
              )
            `
          )
          .eq("company_id", auth.companyId)
          .eq("floor_map_id", map.id)
          .order("warehouse_location_id", { ascending: true })
          .limit(500),
        admin.storage.from(BUCKET).createSignedUrl(map.image_path, 3600, {
          transform:
            map.image_width >= map.image_height
              ? { width: MOBILE_MAP_MAX_EDGE, resize: "contain", quality: 85 }
              : { height: MOBILE_MAP_MAX_EDGE, resize: "contain", quality: 85 },
        }),
      ]);

    if (racksError || signedUrlError) {
      console.error("Failed to load mapped rack asset", { racksError, signedUrlError });
      return safeError("Failed to load pick location", "PICK_LOCATION_LOAD_FAILED", 500);
    }

    const mappedRacks = racks || [];
    const rack = mappedRacks.find((candidate) => candidate.warehouse_location_id === location.id);

    if (!rack) {
      return safeError(
        "This rack is not marked on the warehouse map",
        "WAREHOUSE_RACK_NOT_MAPPED",
        404
      );
    }
    if (
      !isCompleteRackRectangle({
        widthBasisPoints: rack.width_basis_points,
        heightBasisPoints: rack.height_basis_points,
      })
    ) {
      return safeError(
        "This rack needs to be redrawn over its full area on the warehouse map",
        "WAREHOUSE_RACK_MAPPING_INCOMPLETE",
        409
      );
    }
    if (!signedUrl?.signedUrl) {
      return safeError("Floor map image is unavailable", "FLOOR_MAP_IMAGE_UNAVAILABLE", 500);
    }

    const rackOverlays = mappedRacks
      .filter((mappedRack) =>
        isCompleteRackRectangle({
          widthBasisPoints: mappedRack.width_basis_points,
          heightBasisPoints: mappedRack.height_basis_points,
        })
      )
      .map((mappedRack) => {
        const rackLocation = Array.isArray(mappedRack.warehouse_location)
          ? mappedRack.warehouse_location[0]
          : mappedRack.warehouse_location;

        return {
          warehouseLocationId: mappedRack.warehouse_location_id,
          code: rackLocation?.code || "",
          name: rackLocation?.name || null,
          xBasisPoints: mappedRack.x_basis_points,
          yBasisPoints: mappedRack.y_basis_points,
          widthBasisPoints: mappedRack.width_basis_points,
          heightBasisPoints: mappedRack.height_basis_points,
        };
      });

    return NextResponse.json({
      data: {
        warehouse: {
          id: warehouse.id,
          name: warehouse.warehouse_name,
        },
        location: {
          id: location.id,
          code: location.code,
          name: location.name,
        },
        map: {
          id: map.id,
          name: map.name,
          imageUrl: signedUrl.signedUrl,
          imageWidth: map.image_width,
          imageHeight: map.image_height,
          version: map.version,
        },
        racks: rackOverlays,
        highlight: {
          xBasisPoints: rack.x_basis_points,
          yBasisPoints: rack.y_basis_points,
          widthBasisPoints: rack.width_basis_points,
          heightBasisPoints: rack.height_basis_points,
        },
      },
    });
  } catch (error) {
    console.error("Unexpected pick location map error", error);
    return safeError("Failed to load pick location", "PICK_LOCATION_LOAD_FAILED", 500);
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "view",
  resourceType: "pick_lists",
  route: "/api/pick-lists/[id]/items/[itemId]/location-map",
});
