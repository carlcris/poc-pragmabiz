import { NextRequest, NextResponse } from "next/server";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

type PickListReportRow = {
  id: string;
  pick_list_no: string | null;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  delivery_notes?:
    | {
        id: string;
        dn_no: string | null;
        fulfilling_warehouse_id: string | null;
      }
    | {
        id: string;
        dn_no: string | null;
        fulfilling_warehouse_id: string | null;
      }[]
    | null;
  pick_list_items?:
    | {
        id: string;
        dn_item_id: string;
        allocated_qty: number | string | null;
        picked_qty: number | string | null;
        short_qty: number | string | null;
      }[]
    | null;
  pick_list_assignees?:
    | {
        user_id: string;
        users?:
          | {
              id: string;
              email: string | null;
              first_name: string | null;
              last_name: string | null;
            }
          | {
              id: string;
              email: string | null;
              first_name: string | null;
              last_name: string | null;
            }[]
          | null;
      }[]
    | null;
  delivery_note_item_picks?:
    | {
        id: string;
        delivery_note_item_id: string;
        item_id: string;
        picked_qty: number | string | null;
        picker_user_id: string | null;
        picked_at: string | null;
        mismatch_reason: string | null;
        deleted_at?: string | null;
      }[]
    | null;
};

type UserRow = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
};

type WarehouseRow = {
  id: string;
  warehouse_code: string | null;
  warehouse_name: string | null;
};

type AggregatedGroup = {
  groupKey: string;
  groupType: "picker" | "warehouse";
  pickerUserId: string | null;
  pickerName: string | null;
  warehouseId: string | null;
  warehouseCode: string | null;
  warehouseName: string | null;
  pickListCount: number;
  lineCount: number;
  shortLineCount: number;
  allocatedQty: number;
  pickedQty: number;
  shortQty: number;
  totalPickSeconds: number;
  cycleCount: number;
  firstStartedAt: string | null;
  lastCompletedAt: string | null;
  lineIds: Set<string>;
};

const CHUNK_SIZE = 200;

const toNumber = (value: number | string | null | undefined) => {
  if (value == null) return 0;
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

const asArray = <T,>(value: T | T[] | null | undefined): T[] => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const pickOne = <T,>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

const dateKey = (value: string) => value.slice(0, 10);

const diffSeconds = (start: string | null, end: string | null) => {
  if (!start || !end) return 0;
  const startTs = new Date(start).getTime();
  const endTs = new Date(end).getTime();
  if (!Number.isFinite(startTs) || !Number.isFinite(endTs) || endTs <= startTs) return 0;
  return (endTs - startTs) / 1000;
};

const pct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : 0);

const formatName = (user: UserRow | null | undefined) => {
  if (!user) return "Unknown";
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  return fullName || user.email || "Unknown";
};

export async function GET(request: NextRequest) {
  try {
    await requirePermission(RESOURCES.REPORTS, "view");
    const { supabase } = await createServerClientWithBU();
    const { searchParams } = new URL(request.url);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single();
    if (!userData?.company_id) {
      return NextResponse.json({ error: "User company not found" }, { status: 400 });
    }

    const startDate =
      searchParams.get("startDate") ||
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const endDate = searchParams.get("endDate") || new Date().toISOString().slice(0, 10);
    const warehouseId = searchParams.get("warehouseId") || undefined;
    const pickerUserId = searchParams.get("pickerUserId") || undefined;
    const groupBy = (searchParams.get("groupBy") || "picker") as "picker" | "warehouse";

    const completedStart = `${startDate}T00:00:00.000Z`;
    const completedEnd = `${endDate}T23:59:59.999Z`;

    const pickLists: PickListReportRow[] = [];
    let from = 0;

    while (true) {
      let query = supabase
        .from("pick_lists")
        .select(
          `
          id,
          pick_list_no,
          status,
          started_at,
          completed_at,
          created_at,
          delivery_notes!inner(id, dn_no, fulfilling_warehouse_id),
          pick_list_items(id, dn_item_id, allocated_qty, picked_qty, short_qty),
          pick_list_assignees(
            user_id,
            users:users!pick_list_assignees_user_id_fkey(id, email, first_name, last_name)
          ),
          delivery_note_item_picks(
            id,
            delivery_note_item_id,
            item_id,
            picked_qty,
            picker_user_id,
            picked_at,
            mismatch_reason,
            deleted_at
          )
        `
        )
        .eq("company_id", userData.company_id)
        .is("deleted_at", null)
        .in("status", ["done"])
        .gte("completed_at", completedStart)
        .lte("completed_at", completedEnd)
        .order("completed_at", { ascending: false })
        .range(from, from + CHUNK_SIZE - 1);

      if (warehouseId) {
        query = query.eq("delivery_notes.fulfilling_warehouse_id", warehouseId);
      }

      const { data, error } = await query;
      if (error) {
        return NextResponse.json({ error: "Failed to fetch picking efficiency data" }, { status: 500 });
      }

      const chunk = (data || []) as PickListReportRow[];
      if (chunk.length === 0) break;
      pickLists.push(...chunk);
      if (chunk.length < CHUNK_SIZE) break;
      from += CHUNK_SIZE;
    }

    const warehouseIds = new Set<string>();
    const userIds = new Set<string>();

    for (const pl of pickLists) {
      const dn = pickOne(pl.delivery_notes);
      if (dn?.fulfilling_warehouse_id) warehouseIds.add(dn.fulfilling_warehouse_id);
      for (const assignee of pl.pick_list_assignees || []) {
        if (assignee.user_id) userIds.add(assignee.user_id);
        const assigneeUser = pickOne(assignee.users);
        if (assigneeUser?.id) userIds.add(assigneeUser.id);
      }
      for (const row of pl.delivery_note_item_picks || []) {
        if (!row.deleted_at && row.picker_user_id) userIds.add(row.picker_user_id);
      }
    }

    const [warehouseResp, usersResp] = await Promise.all([
      warehouseIds.size
        ? supabase
            .from("warehouses")
            .select("id, warehouse_code, warehouse_name")
            .in("id", Array.from(warehouseIds))
        : Promise.resolve({ data: [] as WarehouseRow[], error: null }),
      userIds.size
        ? supabase
            .from("users")
            .select("id, email, first_name, last_name")
            .in("id", Array.from(userIds))
        : Promise.resolve({ data: [] as UserRow[], error: null }),
    ]);

    if (warehouseResp.error || usersResp.error) {
      return NextResponse.json({ error: "Failed to resolve report dimensions" }, { status: 500 });
    }

    const warehouseMap = new Map((warehouseResp.data || []).map((w) => [w.id, w as WarehouseRow]));
    const userMap = new Map((usersResp.data || []).map((u) => [u.id, u as UserRow]));

    const dailyTrendMap = new Map<
      string,
      {
        date: string;
        pickListCount: number;
        lineCount: number;
        shortLineCount: number;
        allocatedQty: number;
        pickedQty: number;
        shortQty: number;
        totalPickSeconds: number;
        cycleCount: number;
      }
    >();
    const shortReasonMap = new Map<string, number>();
    const pickerMap = new Map<string, AggregatedGroup>();
    const warehouseGroupMap = new Map<string, AggregatedGroup>();

    let totalLines = 0;
    let totalShortLines = 0;
    let totalAllocatedQty = 0;
    let totalPickedQty = 0;
    let totalShortQty = 0;
    let totalPickLists = 0;
    let totalPickSeconds = 0;
    let cycleCount = 0;

    for (const pl of pickLists) {
      const dn = pickOne(pl.delivery_notes);
      const plWarehouseId = dn?.fulfilling_warehouse_id || null;
      const plWarehouse = plWarehouseId ? warehouseMap.get(plWarehouseId) : null;
      const plItems = asArray(pl.pick_list_items);
      const pickRows = asArray(pl.delivery_note_item_picks).filter((r) => !r.deleted_at);
      const lineByDnItemId = new Map(
        plItems.map((i) => [i.dn_item_id, i] as const)
      );

      // Apply picker filter at pick-list inclusion level when pick rows exist
      if (pickerUserId) {
        const matchingPickRow = pickRows.some((r) => r.picker_user_id === pickerUserId);
        const assigneeMatch = asArray(pl.pick_list_assignees).some((a) => a.user_id === pickerUserId);
        if (!matchingPickRow && !assigneeMatch) continue;
      }

      totalPickLists += 1;

      const listDurationSeconds = diffSeconds(pl.started_at, pl.completed_at);
      if (listDurationSeconds > 0) {
        totalPickSeconds += listDurationSeconds;
        cycleCount += 1;
      }

      const completedAt = pl.completed_at || pl.created_at;
      const trendKey = dateKey(completedAt);
      const trend = dailyTrendMap.get(trendKey) || {
        date: trendKey,
        pickListCount: 0,
        lineCount: 0,
        shortLineCount: 0,
        allocatedQty: 0,
        pickedQty: 0,
        shortQty: 0,
        totalPickSeconds: 0,
        cycleCount: 0,
      };
      trend.pickListCount += 1;
      if (listDurationSeconds > 0) {
        trend.totalPickSeconds += listDurationSeconds;
        trend.cycleCount += 1;
      }

      let listAllocatedQty = 0;
      let listPickedQty = 0;
      let listShortQty = 0;
      let listLineCount = 0;
      let listShortLineCount = 0;

      for (const line of plItems) {
        const allocated = toNumber(line.allocated_qty);
        const picked = toNumber(line.picked_qty);
        const shortQty = toNumber(line.short_qty);
        const isShort = shortQty > 0;

        totalLines += 1;
        totalAllocatedQty += allocated;
        totalPickedQty += picked;
        totalShortQty += shortQty;
        listLineCount += 1;
        listAllocatedQty += allocated;
        listPickedQty += picked;
        listShortQty += shortQty;

        if (isShort) {
          totalShortLines += 1;
          listShortLineCount += 1;
        }
      }

      trend.lineCount += listLineCount;
      trend.shortLineCount += listShortLineCount;
      trend.allocatedQty += listAllocatedQty;
      trend.pickedQty += listPickedQty;
      trend.shortQty += listShortQty;
      dailyTrendMap.set(trendKey, trend);

      // Warehouse grouping (list-level metrics)
      const warehouseKey = plWarehouseId || "unknown";
      const warehouseAgg = warehouseGroupMap.get(warehouseKey) || {
        groupKey: warehouseKey,
        groupType: "warehouse" as const,
        pickerUserId: null,
        pickerName: null,
        warehouseId: plWarehouseId,
        warehouseCode: plWarehouse?.warehouse_code || null,
        warehouseName: plWarehouse?.warehouse_name || "Unknown Warehouse",
        pickListCount: 0,
        lineCount: 0,
        shortLineCount: 0,
        allocatedQty: 0,
        pickedQty: 0,
        shortQty: 0,
        totalPickSeconds: 0,
        cycleCount: 0,
        firstStartedAt: null,
        lastCompletedAt: null,
        lineIds: new Set<string>(),
      };
      warehouseAgg.pickListCount += 1;
      warehouseAgg.lineCount += listLineCount;
      warehouseAgg.shortLineCount += listShortLineCount;
      warehouseAgg.allocatedQty += listAllocatedQty;
      warehouseAgg.pickedQty += listPickedQty;
      warehouseAgg.shortQty += listShortQty;
      if (listDurationSeconds > 0) {
        warehouseAgg.totalPickSeconds += listDurationSeconds;
        warehouseAgg.cycleCount += 1;
      }
      if (pl.started_at && (!warehouseAgg.firstStartedAt || pl.started_at < warehouseAgg.firstStartedAt)) {
        warehouseAgg.firstStartedAt = pl.started_at;
      }
      if (
        pl.completed_at &&
        (!warehouseAgg.lastCompletedAt || pl.completed_at > warehouseAgg.lastCompletedAt)
      ) {
        warehouseAgg.lastCompletedAt = pl.completed_at;
      }
      warehouseGroupMap.set(warehouseKey, warehouseAgg);

      // Picker grouping (prefer actual pick rows; fallback to assignee if no pick rows)
      const pickerLineIdsMap = new Map<string, Set<string>>();
      const pickerQtyMap = new Map<string, number>();
      for (const row of pickRows) {
        const pickerId = row.picker_user_id;
        if (!pickerId) continue;
        const set = pickerLineIdsMap.get(pickerId) || new Set<string>();
        set.add(row.delivery_note_item_id);
        pickerLineIdsMap.set(pickerId, set);
        pickerQtyMap.set(pickerId, (pickerQtyMap.get(pickerId) || 0) + toNumber(row.picked_qty));

        const reason = (row.mismatch_reason || "").trim();
        if (reason) shortReasonMap.set(reason, (shortReasonMap.get(reason) || 0) + 1);
      }

      if (pickerLineIdsMap.size === 0) {
        const assignee = asArray(pl.pick_list_assignees)[0];
        if (assignee?.user_id) {
          pickerLineIdsMap.set(assignee.user_id, new Set(plItems.map((i) => i.dn_item_id)));
          pickerQtyMap.set(assignee.user_id, listPickedQty);
        }
      }

      for (const [pickerId, lineIds] of pickerLineIdsMap.entries()) {
        if (pickerUserId && pickerId !== pickerUserId) continue;
        const userRow = userMap.get(pickerId);
        const pickerKey = pickerId;
        const pickerAgg = pickerMap.get(pickerKey) || {
          groupKey: pickerKey,
          groupType: "picker" as const,
          pickerUserId: pickerId,
          pickerName: formatName(userRow),
          warehouseId: null,
          warehouseCode: null,
          warehouseName: null,
          pickListCount: 0,
          lineCount: 0,
          shortLineCount: 0,
          allocatedQty: 0,
          pickedQty: 0,
          shortQty: 0,
          totalPickSeconds: 0,
          cycleCount: 0,
          firstStartedAt: null,
          lastCompletedAt: null,
          lineIds: new Set<string>(),
        };

        pickerAgg.pickListCount += 1;
        if (pl.started_at && (!pickerAgg.firstStartedAt || pl.started_at < pickerAgg.firstStartedAt)) {
          pickerAgg.firstStartedAt = pl.started_at;
        }
        if (pl.completed_at && (!pickerAgg.lastCompletedAt || pl.completed_at > pickerAgg.lastCompletedAt)) {
          pickerAgg.lastCompletedAt = pl.completed_at;
        }
        if (listDurationSeconds > 0) {
          pickerAgg.totalPickSeconds += listDurationSeconds;
          pickerAgg.cycleCount += 1;
        }

        let pickerAllocated = 0;
        let pickerShort = 0;
        let pickerShortLines = 0;
        for (const dnItemId of lineIds) {
          if (pickerAgg.lineIds.has(dnItemId)) continue;
          pickerAgg.lineIds.add(dnItemId);
          const line = lineByDnItemId.get(dnItemId);
          if (!line) continue;
          const allocated = toNumber(line.allocated_qty);
          const shortQty = toNumber(line.short_qty);
          pickerAllocated += allocated;
          pickerShort += shortQty;
          if (shortQty > 0) pickerShortLines += 1;
        }

        pickerAgg.lineCount = pickerAgg.lineIds.size;
        pickerAgg.allocatedQty += pickerAllocated;
        pickerAgg.pickedQty += pickerQtyMap.get(pickerId) || 0;
        pickerAgg.shortQty += pickerShort;
        pickerAgg.shortLineCount += pickerShortLines;
        pickerMap.set(pickerKey, pickerAgg);
      }
    }

    const toOutputRow = (agg: AggregatedGroup) => {
      const activeHours = agg.totalPickSeconds / 3600;
      const avgPickSeconds = agg.cycleCount > 0 ? agg.totalPickSeconds / agg.cycleCount : 0;
      const spanSeconds = diffSeconds(agg.firstStartedAt, agg.lastCompletedAt);
      const utilizationPct = spanSeconds > 0 ? Math.min(100, pct(agg.totalPickSeconds, spanSeconds)) : 0;
      const lineAccuracyPct = 100 - pct(agg.shortLineCount, Math.max(agg.lineCount, 1));
      const qtyFillRatePct = pct(agg.pickedQty, Math.max(agg.allocatedQty, 1));

      return {
        groupKey: agg.groupKey,
        groupType: agg.groupType,
        pickerUserId: agg.pickerUserId,
        pickerName: agg.pickerName,
        warehouseId: agg.warehouseId,
        warehouseCode: agg.warehouseCode,
        warehouseName: agg.warehouseName,
        pickListCount: agg.pickListCount,
        lineCount: agg.lineCount,
        shortLineCount: agg.shortLineCount,
        allocatedQty: agg.allocatedQty,
        pickedQty: agg.pickedQty,
        shortQty: agg.shortQty,
        activePickSeconds: agg.totalPickSeconds,
        activePickHours: activeHours,
        pickLinesPerHour: activeHours > 0 ? agg.lineCount / activeHours : 0,
        averagePickSeconds: avgPickSeconds,
        shortPickRatePct: pct(agg.shortLineCount, Math.max(agg.lineCount, 1)),
        pickAccuracyPct: lineAccuracyPct,
        quantityFillRatePct: qtyFillRatePct,
        pickerUtilizationPct: utilizationPct,
      };
    };

    const pickerRows = Array.from(pickerMap.values())
      .map(toOutputRow)
      .sort((a, b) => b.pickLinesPerHour - a.pickLinesPerHour);
    const warehouseRows = Array.from(warehouseGroupMap.values())
      .map(toOutputRow)
      .sort((a, b) => b.pickLinesPerHour - a.pickLinesPerHour);

    const selectedRows = groupBy === "warehouse" ? warehouseRows : pickerRows;

    const dailyTrend = Array.from(dailyTrendMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((row) => {
        const activeHours = row.totalPickSeconds / 3600;
        return {
          date: row.date,
          pickListCount: row.pickListCount,
          lineCount: row.lineCount,
          shortLineCount: row.shortLineCount,
          allocatedQty: row.allocatedQty,
          pickedQty: row.pickedQty,
          shortQty: row.shortQty,
          pickLinesPerHour: activeHours > 0 ? row.lineCount / activeHours : 0,
          averagePickSeconds: row.cycleCount > 0 ? row.totalPickSeconds / row.cycleCount : 0,
          shortPickRatePct: pct(row.shortLineCount, Math.max(row.lineCount, 1)),
          pickAccuracyPct: 100 - pct(row.shortLineCount, Math.max(row.lineCount, 1)),
        };
      });

    const summaryActiveHours = totalPickSeconds / 3600;
    const summary = {
      totalPickLists,
      totalLines,
      totalAllocatedQty,
      totalPickedQty,
      totalShortQty,
      totalShortLines,
      pickLinesPerHour: summaryActiveHours > 0 ? totalLines / summaryActiveHours : 0,
      averagePickSeconds: cycleCount > 0 ? totalPickSeconds / cycleCount : 0,
      shortPickRatePct: pct(totalShortLines, Math.max(totalLines, 1)),
      pickAccuracyPct: 100 - pct(totalShortLines, Math.max(totalLines, 1)),
      quantityFillRatePct: pct(totalPickedQty, Math.max(totalAllocatedQty, 1)),
      activePickHours: summaryActiveHours,
      pickerCount: pickerRows.length,
      warehouseCount: warehouseRows.length,
    };

    const shortReasons = Array.from(shortReasonMap.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      data: selectedRows,
      pickerLeaderboard: pickerRows.slice(0, 20),
      warehousePerformance: warehouseRows,
      dailyTrend,
      shortReasons,
      summary,
      filters: {
        startDate,
        endDate,
        warehouseId: warehouseId || null,
        pickerUserId: pickerUserId || null,
        groupBy,
      },
    });
  } catch (error) {
    console.error("Error generating picking efficiency report:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

