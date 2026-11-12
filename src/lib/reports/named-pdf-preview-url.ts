const PREVIEW_SCOPE = "/report-pdf-preview/";

export function getNamedPdfPreviewUrl(blobUrl: string, fileName: string): Promise<string> {
  if (!navigator.serviceWorker) return Promise.resolve(blobUrl);

  const blobId = blobUrl.slice(blobUrl.lastIndexOf("/") + 1);
  const namedUrl = `${PREVIEW_SCOPE}${blobId}/${encodeURIComponent(fileName)}`;

  return new Promise((resolve) => {
    let worker: ServiceWorker | null = null;
    let settled = false;
    const finish = (url: string) => {
      settled = true;
      window.clearTimeout(timeout);
      worker?.removeEventListener("statechange", checkState);
      resolve(url);
    };
    const checkState = () => {
      if (worker?.state === "activated") finish(namedUrl);
      if (worker?.state === "redundant") finish(blobUrl);
    };
    const timeout = window.setTimeout(() => finish(blobUrl), 3000);

    navigator.serviceWorker.register(`${PREVIEW_SCOPE}worker.js`).then(
      (registration) => {
        if (settled) return;
        worker = registration.active ?? registration.installing ?? registration.waiting;
        if (!worker) {
          finish(blobUrl);
          return;
        }
        worker.addEventListener("statechange", checkState);
        checkState();
      },
      () => finish(blobUrl)
    );
  });
}
