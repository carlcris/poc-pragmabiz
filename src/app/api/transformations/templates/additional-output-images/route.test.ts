import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { ADDITIONAL_OUTPUT_IMAGE_MAX_SIZE } from "@/lib/transformations/additional-output-images";
import {
  createAdditionalOutputThumbnail,
  signAdditionalOutputImages,
} from "@/services/transformation-output-image-service";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  permission: vi.fn(),
  context: vi.fn(),
  access: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  sign: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/activity-logging/route-activity-logger", () => ({
  withActivityLogging: (handler: unknown) => handler,
  setActivityContextIfAvailable: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requirePermission: mocks.permission }));
vi.mock("@/lib/supabase/server-with-bu", () => ({ createServerClientWithBU: mocks.context }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: {
      from: () => ({
        upload: mocks.upload,
        remove: mocks.remove,
        createSignedUrls: mocks.sign,
      }),
    },
  }),
}));

const companyId = "10000000-0000-4000-8000-000000000001";
const businessUnitId = "10000000-0000-4000-8000-000000000002";
const userId = "10000000-0000-4000-8000-000000000003";
const imagePath = `${companyId}/${businessUnitId}/${userId}/10000000-0000-4000-8000-000000000004`;

const accessQuery = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  maybeSingle: mocks.access,
};

const imageRequest = (file: File) => {
  const body = new FormData();
  body.set("file", file);
  return new NextRequest(
    "http://localhost/api/transformations/templates/additional-output-images",
    {
      method: "POST",
      body,
    }
  );
};

const png = () =>
  sharp({ create: { width: 640, height: 320, channels: 3, background: "red" } })
    .png()
    .toBuffer();

beforeEach(() => {
  vi.clearAllMocks();
  mocks.permission.mockResolvedValue(null);
  mocks.context.mockResolvedValue({
    userId,
    companyId,
    currentBusinessUnitId: businessUnitId,
    authError: null,
    supabase: { from: () => accessQuery },
  });
  mocks.access.mockResolvedValue({ data: { business_unit_id: businessUnitId }, error: null });
  mocks.upload.mockResolvedValue({ data: {}, error: null });
  mocks.remove.mockResolvedValue({ data: [], error: null });
  mocks.sign.mockImplementation(async (paths: string[]) => ({
    data: paths.map((path) => ({ path, signedUrl: `https://storage.test/${path}`, error: null })),
    error: null,
  }));
});

describe("additional output image uploads", () => {
  it("accepts exactly 4 MB, generates a small thumbnail, and returns private asset URLs", async () => {
    const bytes = new Uint8Array(ADDITIONAL_OUTPUT_IMAGE_MAX_SIZE);
    bytes.set(await png());
    const response = await POST(
      imageRequest(new File([bytes], "sample.png", { type: "image/png" }))
    );

    expect(response.status).toBe(201);
    const result = await response.json();
    expect(result.data.imagePath).toMatch(new RegExp(`^${companyId}/${businessUnitId}/${userId}/`));
    expect(result.data.imageThumbnailUrl).toContain("/thumbnail.webp");
    expect(mocks.upload).toHaveBeenCalledTimes(2);
    expect(mocks.upload.mock.calls[0][1]).toHaveLength(ADDITIONAL_OUTPUT_IMAGE_MAX_SIZE);
    expect(mocks.upload.mock.calls[0][2]).toEqual({ contentType: "image/png", upsert: false });
    const thumbnail = await sharp(mocks.upload.mock.calls[1][1]).metadata();
    expect(thumbnail.format).toBe("webp");
    expect(thumbnail.width).toBe(192);
    expect(thumbnail.height).toBe(96);
    expect(mocks.sign).toHaveBeenCalledTimes(1);
    expect(accessQuery.eq).toHaveBeenCalledWith("business_unit.company_id", companyId);
    expect(accessQuery.eq).toHaveBeenCalledWith("business_unit.is_active", true);
  });

  it("rejects one byte over 4 MB without writing assets", async () => {
    const file = new File([new Uint8Array(ADDITIONAL_OUTPUT_IMAGE_MAX_SIZE + 1)], "large.png", {
      type: "image/png",
    });
    const response = await POST(imageRequest(file));
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ code: "ADDITIONAL_OUTPUT_IMAGE_TOO_LARGE" });
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it.each([
    ["image/png", "invalid bytes"],
    ["image/svg+xml", "<svg></svg>"],
    ["image/png", ""],
  ])("rejects invalid %s content", async (type, bytes) => {
    const response = await POST(imageRequest(new File([bytes], "invalid", { type })));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "ADDITIONAL_OUTPUT_IMAGE_INVALID" });
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("rejects an image whose bytes differ from its MIME type", async () => {
    const response = await POST(
      imageRequest(new File([new Uint8Array(await png())], "wrong.jpg", { type: "image/jpeg" }))
    );
    expect(response.status).toBe(400);
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("checks transformation create permission before reading uploads", async () => {
    mocks.permission.mockResolvedValue(NextResponse.json({ error: "Forbidden" }, { status: 403 }));
    const response = await POST(imageRequest(new File(["x"], "image.png", { type: "image/png" })));
    expect(response.status).toBe(403);
    expect(mocks.permission).toHaveBeenCalledWith("stock_transformations", "create");
    expect(mocks.context).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("rejects users without active business unit access", async () => {
    mocks.access.mockResolvedValue({ data: null, error: null });
    const response = await POST(imageRequest(new File(["x"], "image.png", { type: "image/png" })));
    expect(response.status).toBe(403);
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("cleans up both asset paths after a thumbnail storage failure", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.upload
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: "internal storage detail" } });

    const response = await POST(
      imageRequest(new File([new Uint8Array(await png())], "image.png", { type: "image/png" }))
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.code).toBe("ADDITIONAL_OUTPUT_IMAGE_UPLOAD_FAILED");
    expect(JSON.stringify(body)).not.toContain("internal storage detail");
    expect(mocks.remove).toHaveBeenCalledWith([
      mocks.upload.mock.calls[0][0],
      mocks.upload.mock.calls[1][0],
    ]);
    log.mockRestore();
  });
});

describe("additional output image presentation", () => {
  it("applies EXIF orientation before generating the thumbnail", async () => {
    const original = await sharp({
      create: { width: 640, height: 320, channels: 3, background: "blue" },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const thumbnail = await createAdditionalOutputThumbnail(original, "image/jpeg");
    expect(await sharp(thumbnail).metadata()).toMatchObject({
      width: 96,
      height: 192,
      format: "webp",
    });
  });

  it("deduplicates signing and excludes foreign-company or invalid paths", async () => {
    const foreignPath = imagePath.replace(companyId, "20000000-0000-4000-8000-000000000001");
    const rows = await signAdditionalOutputImages(
      [
        { image_path: imagePath },
        { image_path: imagePath },
        { image_path: foreignPath },
        { image_path: `${companyId}/../private` },
        { image_path: null },
      ],
      companyId
    );
    expect(mocks.sign).toHaveBeenCalledWith(
      [`${imagePath}/original`, `${imagePath}/thumbnail.webp`],
      3600
    );
    expect(rows[0].image_thumbnail_url).toContain("/thumbnail.webp");
    expect(rows[2].image_url).toBeNull();
    expect(rows[3].image_url).toBeNull();
    expect(rows[4].image_url).toBeNull();
  });

  it("keeps a template readable if its stored asset has gone missing", async () => {
    mocks.sign.mockResolvedValue({
      data: [{ path: `${imagePath}/original`, error: "Object not found", signedUrl: "" }],
      error: null,
    });
    const rows = await signAdditionalOutputImages([{ image_path: imagePath }], companyId);
    expect(rows[0]).toMatchObject({ image_url: null, image_thumbnail_url: null });
  });
});
