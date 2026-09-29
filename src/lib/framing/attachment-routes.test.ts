import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  wrap: vi.fn((handler: unknown, config: unknown) => ({ handler, config })),
  upload: vi.fn(),
  sign: vi.fn(),
}));
vi.mock("@/lib/activity-logging/route-activity-logger", () => ({
  withActivityLogging: mocks.wrap,
}));
vi.mock("@/lib/auth", () => ({ requirePermission: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "user" } } }) },
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: { company_id: "company" } }) }) }),
    }),
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: { from: () => ({ upload: mocks.upload, createSignedUrl: mocks.sign }) },
  }),
}));

import * as attachments from "@/app/api/frame-attachments/route";
import * as waivers from "@/app/api/quotation-waivers/route";

type WrappedHandler = {
  handler: (request: NextRequest) => Promise<Response>;
  config: { action: string; route: string };
};

describe.each([
  ["frame-attachments", attachments],
  ["quotation-waivers", waivers],
] as const)("%s storage routes", (name, routes) => {
  beforeEach(() => {
    mocks.upload.mockReset();
    mocks.sign.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("logs internal upload errors without returning backend details", async () => {
    mocks.upload.mockResolvedValue({ error: { message: "private bucket credentials detail" } });
    const body = new FormData();
    body.append("file", new File(["image"], "frame.png", { type: "image/png" }));
    const post = routes.POST as unknown as WrappedHandler;
    const response = await post.handler(
      new NextRequest(`http://localhost/api/${name}`, { method: "POST", body })
    );
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Failed to upload file" });
    expect(console.error).toHaveBeenCalledWith(expect.any(String), {
      message: "private bucket credentials detail",
    });
  });

  it("wraps signed URL reads and only signs the caller's company paths", async () => {
    mocks.sign.mockResolvedValue({ data: { signedUrl: "signed-url" } });
    const get = routes.GET as unknown as WrappedHandler;
    expect(get.config).toMatchObject({ action: "view", route: `/api/${name}` });
    const response = await get.handler(
      new NextRequest(`http://localhost/api/${name}?path=company/file.png&path=another/file.png`)
    );
    expect(await response.json()).toEqual({ urls: { "company/file.png": "signed-url" } });
    expect(mocks.sign).toHaveBeenCalledTimes(1);
  });
});
