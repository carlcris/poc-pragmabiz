/**
 * Reference files attached to one configured frame size.
 *
 * The bucket is private, so nothing here ever returns a bucket URL: reads mint a
 * short-lived signed URL, and the durable reference stored in the row is the
 * path. Objects are written with the admin client — the same pattern as
 * `warehouses/[id]/floor-map` — with authorisation enforced in the route rather
 * than by storage policies.
 *
 * A file may be uploaded before its configuration exists (the operator attaches
 * a sketch while first filling in the dialog), so upload takes no configuration
 * id. It returns a path the caller carries in form state and the save RPC
 * persists, which is why `POST` writes an object but no row.
 */

import { NextRequest, NextResponse } from "next/server";
import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

const BUCKET = "frame-attachments";
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];

/** Signed URLs are read-time only; an hour outlives any dialog session. */
const SIGNED_URL_TTL_SECONDS = 3600;

/**
 * Strip anything that could escape the company prefix or confuse a Content-
 * Disposition header, while keeping the name recognisable to the operator.
 */
function safeFileName(name: string): string {
  return name.replace(/[/\\?%*:|"<>\x00-\x1F]/g, "_").slice(0, 120);
}

async function POSTHandler(request: NextRequest) {
  const unauthorized = await requirePermission(RESOURCES.SALES_QUOTATIONS, "edit");
  if (unauthorized) return unauthorized;

  const supabase = await createClient();
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

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Invalid file type. Only JPEG, PNG, WebP and PDF are allowed." },
      { status: 400 }
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large. Maximum size is 10MB." }, { status: 400 });
  }

  const fileName = safeFileName(file.name);
  // Company prefix keeps one tenant's objects out of another's namespace even
  // though the admin client bypasses RLS.
  const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const storagePath = `${userData.company_id}/${unique}_${fileName}`;

  const admin = createAdminClient();
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error("Error uploading frame attachment:", uploadError);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }

  const { data: signed } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  return NextResponse.json({
    storagePath,
    fileName,
    mimeType: file.type,
    fileSizeBytes: file.size,
    previewUrl: signed?.signedUrl ?? null,
  });
}

/**
 * Mint signed URLs for already-stored paths, so a reopened quotation can preview
 * its files. Paths are checked against the caller's company prefix — the admin
 * client would otherwise happily sign another tenant's object.
 */
async function GETHandler(request: NextRequest) {
  const unauthorized = await requirePermission(RESOURCES.SALES_QUOTATIONS, "view");
  if (unauthorized) return unauthorized;

  const supabase = await createClient();
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

  const paths = request.nextUrl.searchParams.getAll("path");
  if (paths.length === 0) {
    return NextResponse.json({ urls: {} });
  }

  const prefix = `${userData.company_id}/`;
  const owned = paths.filter((path) => path.startsWith(prefix));

  const admin = createAdminClient();
  const urls: Record<string, string> = {};

  await Promise.all(
    owned.map(async (path) => {
      const { data } = await admin.storage
        .from(BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
      if (data?.signedUrl) urls[path] = data.signedUrl;
    })
  );

  return NextResponse.json({ urls });
}

export const POST = withActivityLogging(POSTHandler, {
  action: "create",
  resourceType: "sales_quotations",
  route: "/api/frame-attachments",
});
export const GET = withActivityLogging(GETHandler, {
  action: "view",
  resourceType: "sales_quotations",
  route: "/api/frame-attachments",
});
