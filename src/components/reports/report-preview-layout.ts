// Shared shell for every report preview dialog: settings panel beside the PDF preview.
// The arbitrary grid tracks are intentional: Tailwind's presets have no fixed-width
// sidebar column, and minmax(0,1fr) lets the preview shrink instead of overflowing
// the dialog. Phones stack the settings above a preview row that fills the rest.
export const REPORT_PREVIEW_GRID_CLASS_NAME =
  "grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-6 md:grid-cols-[280px_minmax(0,1fr)] md:grid-rows-1";
export const REPORT_PREVIEW_SETTINGS_CLASS_NAME =
  "flex min-h-0 flex-col rounded-lg border bg-muted/20 p-4 md:h-full";
export const REPORT_PREVIEW_ACTIONS_CLASS_NAME = "shrink-0 pt-4 md:pt-6";
export const REPORT_PREVIEW_CONTENT_CLASS_NAME = "flex h-full min-h-0 flex-col gap-4";
// Scrollable settings fields. The 4px inset padding (offset by a negative margin) keeps
// focus rings inside the scroll box, which would otherwise clip them.
export const REPORT_PREVIEW_FIELDS_CLASS_NAME =
  "-mx-1 mt-4 min-h-0 min-w-0 flex-1 space-y-4 overflow-y-auto px-1 py-1";
