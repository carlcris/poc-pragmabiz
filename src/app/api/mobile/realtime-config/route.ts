import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

async function GETHandler() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    console.error("Mobile Realtime configuration is unavailable");
    return NextResponse.json({ error: "Realtime is unavailable" }, { status: 503 });
  }

  return NextResponse.json({ url, publishableKey });
}

export const GET = withActivityLogging(GETHandler, {
  action: "view",
  resourceType: "mobile_configuration",
  route: "/api/mobile/realtime-config",
});
