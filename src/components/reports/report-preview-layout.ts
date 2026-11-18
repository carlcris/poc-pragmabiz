// Shared shell for every report preview dialog: settings panel beside the PDF preview.
// The arbitrary grid tracks are intentional: Tailwind has no preset for a flexible
// sidebar next to a capped PDF viewport. The 66rem (1056px) cap on the preview track
// is sized around the viewer's native 90% zoom: every generated report is landscape
// A4 (841.89pt), so the page renders about 1010 CSS px wide in Chrome, and the
// remaining ~46px covers the browser viewer's page insets, border, and vertical
// scrollbar. Capping the preview there hands the leftover dialog width to the
// settings track, which grows from 18rem (w-72) to about 370px at full width.
// minmax(0,...) lets the preview shrink within narrower side-by-side widths instead
// of overflowing. Phones stack the settings above the preview in two equal bounded
// rows: an auto settings row would claim its full content height and leave the
// preview no space, so each row takes half the dialog body and the settings fields
// scroll inside their own scroll region.
export const REPORT_PREVIEW_GRID_CLASS_NAME =
  "grid h-full min-h-0 grid-cols-1 grid-rows-2 gap-6 md:grid-cols-[minmax(18rem,1fr)_minmax(0,66rem)] md:grid-rows-1";
export const REPORT_PREVIEW_SETTINGS_CLASS_NAME =
  "flex min-h-0 flex-col rounded-lg border bg-muted/20 p-4 md:h-full";
export const REPORT_PREVIEW_ACTIONS_CLASS_NAME = "shrink-0 pt-4 md:pt-6";
export const REPORT_PREVIEW_CONTENT_CLASS_NAME = "flex h-full min-h-0 flex-col gap-4";
// Scrollable settings fields. The 4px inset padding (offset by a negative margin) keeps
// focus rings inside the scroll box, which would otherwise clip them.
export const REPORT_PREVIEW_FIELDS_CLASS_NAME =
  "-mx-1 mt-4 min-h-0 min-w-0 flex-1 space-y-4 overflow-y-auto px-1 py-1";
