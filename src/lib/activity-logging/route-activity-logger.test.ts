import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { setActivityContextIfAvailable, withActivityLogging } from "./route-activity-logger";

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  capturePayload: vi.fn(),
  append: vi.fn(),
}));

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: mocks.after,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getClaims: async () => ({ data: { claims: null }, error: null }) },
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: mocks.append }),
}));
vi.mock("./activity-data-sanitizer", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./activity-data-sanitizer")>()),
  captureSanitizedRequestPayload: mocks.capturePayload,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.append.mockResolvedValue({ error: null });
  mocks.capturePayload.mockResolvedValue({ payload: { safe: true }, metadata: {} });
});

describe("activity request body capture", () => {
  it("logs binary upload metadata without cloning or parsing the upload", async () => {
    const body = new FormData();
    body.set("file", new File(["binary content"], "private-filename.png", { type: "image/png" }));
    const request = new NextRequest("http://localhost/api/binary-upload", { method: "POST", body });
    const clone = vi.spyOn(request, "clone");
    const handler = withActivityLogging(
      async (request: NextRequest) => {
        const file = (await request.formData()).get("file") as File;
        setActivityContextIfAvailable({
          metadata: { imageContentType: file.type, imageSizeBytes: file.size },
        });
        return NextResponse.json({ success: true });
      },
      {
        action: "create",
        resourceType: "transformations",
        route: "/api/binary-upload",
        captureRequestBody: false,
      }
    );

    expect((await handler(request)).status).toBe(200);
    await mocks.after.mock.calls[0][0]();

    expect(clone).not.toHaveBeenCalled();
    expect(mocks.capturePayload).not.toHaveBeenCalled();
    const event = mocks.append.mock.calls[0][1].p_event;
    expect(event.request_payload).toBeNull();
    expect(event.metadata).toMatchObject({
      requestBodyCaptureDisabled: true,
      imageContentType: "image/png",
      imageSizeBytes: 14,
    });
    expect(JSON.stringify(event)).not.toContain("private-filename");
    expect(JSON.stringify(event)).not.toContain("binary content");
  });

  it("preserves sanitized request capture by default", async () => {
    const request = new NextRequest("http://localhost/api/standard-mutation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ safe: true }),
    });
    const handler = withActivityLogging(
      async (request: NextRequest) => NextResponse.json({ success: request.method === "POST" }),
      {
        action: "create",
        resourceType: "transformations",
        route: "/api/standard-mutation",
      }
    );

    await handler(request);
    await mocks.after.mock.calls[0][0]();

    expect(mocks.capturePayload).toHaveBeenCalledTimes(1);
    expect(mocks.append.mock.calls[0][1].p_event.request_payload).toEqual({ safe: true });
  });
});
