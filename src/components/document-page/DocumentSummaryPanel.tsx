import type { ReactNode } from "react";

export type DocumentSummaryRow = {
  key: string;
  label: string;
  value: ReactNode;
};

type DocumentSummaryPanelProps = {
  title: string;
  headerAside?: ReactNode;
  rows: DocumentSummaryRow[];
  totalLabel: string;
  total: string | null;
  actions?: ReactNode;
  footer?: ReactNode;
};

export function DocumentSummaryPanel({
  title,
  headerAside,
  rows,
  totalLabel,
  total,
  actions,
  footer,
}: DocumentSummaryPanelProps) {
  return (
    <aside aria-label={title} className="w-full lg:sticky lg:top-6 lg:w-80 lg:shrink-0">
      <div className="space-y-5 rounded-xl border bg-card p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          {headerAside}
        </div>
        <dl className="space-y-2.5 text-sm">
          {rows.map((row) => (
            <div key={row.key} className="flex items-baseline justify-between gap-4">
              <dt className="shrink-0 text-muted-foreground">{row.label}</dt>
              <dd className="min-w-0 text-right font-medium">{row.value}</dd>
            </div>
          ))}
        </dl>
        {total != null ? (
          <div className="flex items-baseline justify-between gap-3 border-t pt-4">
            <span className="text-sm text-muted-foreground">{totalLabel}</span>
            <span className="text-2xl font-bold tabular-nums tracking-tight">{total}</span>
          </div>
        ) : null}
        {actions ? <div className="flex flex-col gap-2">{actions}</div> : null}
        {footer ? (
          <div className="text-xs leading-relaxed text-muted-foreground">{footer}</div>
        ) : null}
      </div>
    </aside>
  );
}
