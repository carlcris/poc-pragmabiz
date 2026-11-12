/// <reference lib="webworker" />

export const dynamic = "force-static";

// This script is served as a static asset. Keep the function self-contained so
// the browser can run its compiled source without the server bundle.
function installReportPdfPreviewWorker(worker: ServiceWorkerGlobalScope) {
  worker.addEventListener("install", (event) => {
    event.waitUntil(worker.skipWaiting());
  });

  worker.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);
    const match = url.pathname.match(
      /^\/report-pdf-preview\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/([^/]+\.pdf)$/i
    );
    if (url.origin !== worker.location.origin || event.request.method !== "GET" || !match) return;

    const [, blobId, encodedName] = match;
    const range = event.request.headers.get("Range");
    event.respondWith(
      fetch(`blob:${worker.location.origin}/${blobId}`, {
        headers: range ? { Range: range } : undefined,
      })
        .then((source) => {
          if (source.headers.get("Content-Type") !== "application/pdf") {
            return new Response(null, { status: 404 });
          }

          const headers = new Headers(source.headers);
          const dispositionName = encodedName.replace(
            /[!'()*]/g,
            (character) => `%${character.charCodeAt(0).toString(16)}`
          );
          headers.set("Content-Disposition", `inline; filename*=UTF-8''${dispositionName}`);
          headers.set("Cache-Control", "no-store");
          return new Response(source.body, { status: source.status, headers });
        })
        .catch(() => new Response(null, { status: 404 }))
    );
  });
}

export function GET() {
  return new Response(`(${installReportPdfPreviewWorker.toString()})(self);`, {
    headers: { "Content-Type": "application/javascript; charset=utf-8" },
  });
}
