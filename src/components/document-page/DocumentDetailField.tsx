import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type DocumentDetailFieldProps = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  emptyLabel: string;
  numeric?: boolean;
};

export function DocumentDetailField({
  label,
  value,
  hint,
  emptyLabel,
  numeric = false,
}: DocumentDetailFieldProps) {
  const isEmpty = value == null || value === "";

  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "mt-1 text-sm",
          isEmpty ? "text-muted-foreground" : "font-medium",
          numeric && "tabular-nums"
        )}
      >
        {isEmpty ? emptyLabel : value}
        {!isEmpty && hint ? (
          <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{hint}</span>
        ) : null}
      </dd>
    </div>
  );
}
