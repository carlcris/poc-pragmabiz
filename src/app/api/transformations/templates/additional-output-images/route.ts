import { NextRequest, NextResponse } from "next/server";
import { RESOURCES } from "@/constants/resources";
import { requirePermission } from "@/lib/auth";
import {
  setActivityContextIfAvailable,
  withActivityLogging,
} from "@/lib/activity-logging/route-activity-logger";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import {
  ADDITIONAL_OUTPUT_IMAGE_MAX_SIZE,
  ADDITIONAL_OUTPUT_IMAGE_MIME_TYPES,
} from "@/lib/transformations/additional-output-images";
import {
  createAdditionalOutputThumbnail,
  uploadAdditionalOutputImage,
} from "@/services/transformation-output-image-service";

export const runtime = "nodejs";

const MAX_MULTIPART_SIZE = ADDITIONAL_OUTPUT_IMAGE_MAX_SIZE + 64 * 1024;

const invalidImage = () =>
  NextResponse.json(
    {
      error: "Choose a valid JPEG, PNG, WebP, or GIF image.",
      code: "ADDITIONAL_OUTPUT_IMAGE_INVALID",
    },
    { status: 400 }
  );

const imageTooLarge = () =>
  NextResponse.json(
    { error: "Choose an image of 4 MB or less.", code: "ADDITIONAL_OUTPUT_IMAGE_TOO_LARGE" },
    { status: 413 }
  );

async function POSTHandler(request: NextRequest) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_TRANSFORMATIONS, "create");
    if (unauthorized) return unauthorized;

    const { supabase, userId, companyId, currentBusinessUnitId, authError } =
      await createServerClientWithBU();
    if (authError || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!companyId || !currentBusinessUnitId) {
      return NextResponse.json({ error: "Business unit context required" }, { status: 400 });
    }

    const { data: access, error: accessError } = await supabase
      .from("user_business_unit_access")
      .select("business_unit_id, business_unit:business_units!inner(id)")
      .eq("user_id", userId)
      .eq("business_unit_id", currentBusinessUnitId)
      .eq("business_unit.company_id", companyId)
      .eq("business_unit.is_active", true)
      .maybeSingle();

    if (accessError) throw accessError;
    if (!access) {
      return NextResponse.json({ error: "Business unit access required" }, { status: 403 });
    }

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("multipart/form-data;") || !request.body) {
      return invalidImage();
    }
    if (Number(request.headers.get("content-length")) > MAX_MULTIPART_SIZE) {
      return imageTooLarge();
    }

    // Bound the stream as well as File.size, including requests without Content-Length.
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.byteLength;
        if (totalBytes > MAX_MULTIPART_SIZE) {
          void reader.cancel();
          return imageTooLarge();
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }

    let formData: FormData;
    try {
      formData = await new Response(Buffer.concat(chunks), {
        headers: { "content-type": contentType },
      }).formData();
    } catch {
      return invalidImage();
    }

    const file = formData.get("file");
    if (!(file instanceof File) || formData.getAll("file").length !== 1 || file.size === 0) {
      return invalidImage();
    }
    if (file.size > ADDITIONAL_OUTPUT_IMAGE_MAX_SIZE) return imageTooLarge();
    if (!ADDITIONAL_OUTPUT_IMAGE_MIME_TYPES.some((mimeType) => mimeType === file.type)) {
      return invalidImage();
    }

    const mimeType = file.type === "image/jpg" ? "image/jpeg" : file.type;
    setActivityContextIfAvailable({
      metadata: { imageContentType: mimeType, imageSizeBytes: file.size },
    });
    const buffer = Buffer.from(await file.arrayBuffer());
    let thumbnail: Buffer;
    try {
      thumbnail = await createAdditionalOutputThumbnail(buffer, mimeType);
    } catch {
      return invalidImage();
    }

    const image = await uploadAdditionalOutputImage({
      buffer,
      thumbnail,
      mimeType,
      companyId,
      businessUnitId: currentBusinessUnitId,
      userId,
    });

    return NextResponse.json({ data: image }, { status: 201 });
  } catch (error) {
    console.error("Failed to upload transformation additional output image", error);
    return NextResponse.json(
      {
        error: "The image could not be uploaded. Please try again.",
        code: "ADDITIONAL_OUTPUT_IMAGE_UPLOAD_FAILED",
      },
      { status: 500 }
    );
  }
}

export const POST = withActivityLogging(POSTHandler, {
  action: "create",
  resourceType: "transformations",
  route: "/api/transformations/templates/additional-output-images",
  captureRequestBody: false,
});
