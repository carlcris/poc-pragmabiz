import { NextResponse } from "next/server";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";

export type RequestContext = {
  supabase: Awaited<ReturnType<typeof createServerClientWithBU>>["supabase"];
  userId: string;
  companyId: string;
  currentBusinessUnitId: string | null;
  defaultBusinessUnitId: string | null;
  accessibleBusinessUnitIds: string[];
};

export async function requireRequestContext(): Promise<RequestContext | NextResponse> {
  const {
    supabase,
    userId,
    companyId,
    currentBusinessUnitId,
    defaultBusinessUnitId,
    accessibleBusinessUnitIds,
  } = await createServerClientWithBU();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!companyId) {
    return NextResponse.json({ error: "User company not found" }, { status: 400 });
  }

  return {
    supabase,
    userId,
    companyId,
    currentBusinessUnitId: currentBusinessUnitId ?? null,
    defaultBusinessUnitId,
    accessibleBusinessUnitIds,
  };
}
