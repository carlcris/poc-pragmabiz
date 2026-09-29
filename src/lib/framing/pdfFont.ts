import { Font } from "@react-pdf/renderer";

/**
 * Registers the PDF text face once for the whole app.
 *
 * `Font.register` is global to `@react-pdf/renderer`, so two modules declaring
 * the same family race each other: the second registration can replace the
 * first mid-load and the document then fails with "Failed to fetch". Calling
 * this from each PDF component keeps a single registration.
 *
 * Arial Unicode is used because the app renders Chinese as well as English, and
 * the built-in PDF faces have no CJK coverage.
 */
let registered = false;

export function registerPdfFont(): void {
  if (registered) return;
  registered = true;

  // ONE entry, not one per weight. The file is 23 MB, and registering the same
  // src twice made react-pdf fetch it twice concurrently per render — enough to
  // hit net::ERR_CACHE_WRITE_FAILURE, which surfaced as "Failed to fetch" and
  // produced no document at all.
  //
  // The consequence is that this family has no bold face, so bold text would
  // silently fall back to Helvetica and lose CJK coverage. The documents
  // therefore do NOT use fontWeight for emphasis — see RequisitionPDF, which
  // separates headings from body text by size and colour instead.
  Font.register({
    family: "ArialUnicode",
    src: "/fonts/ArialUnicode.ttf",
  });
}
