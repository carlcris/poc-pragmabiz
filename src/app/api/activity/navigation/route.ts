import { NextRequest, NextResponse } from "next/server";
import {
  setActivityContext,
  withActivityLogging,
} from "@/lib/activity-logging/route-activity-logger";
import { resolveNavigationPage } from "@/lib/activity-logging/navigation-pages";
import { requireRequestContext } from "@/lib/auth/requestContext";

type NavigationActivityBody = {
  fromPath?: unknown;
  path?: unknown;
};

async function POSTHandler(request: NextRequest) {
  const context = await requireRequestContext();
  if ("status" in context) return context;

  const body = (await request.json().catch(() => ({}))) as NavigationActivityBody;
  const path = typeof body.path === "string" ? body.path : "";
  const fromPath = typeof body.fromPath === "string" ? body.fromPath : null;
  const page = resolveNavigationPage(path);

  if (!page) {
    setActivityContext({ skip: true });
    return NextResponse.json({ ok: true, logged: false });
  }

  setActivityContext({
    action: "navigate",
    resourceType: "navigation",
    entityCode: page.pageKey,
    entityLabel: page.title,
    metadata: {
      pageKey: page.pageKey,
      path,
      ...(fromPath ? { fromPath } : {}),
    },
  });

  return NextResponse.json({ ok: true, logged: true });
}

export const POST = withActivityLogging(POSTHandler, {
  action: "navigate",
  resourceType: "navigation",
  route: "/api/activity/navigation",
});
