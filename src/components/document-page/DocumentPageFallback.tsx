import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type DocumentPageFallbackProps =
  | { state: "loading"; label: string }
  | {
      state: "message";
      message: string;
      isError?: boolean;
      actionHref: string;
      actionLabel: string;
    };

// Holds the document page footprint while the record loads or cannot be shown.
export function DocumentPageFallback(props: DocumentPageFallbackProps) {
  if (props.state === "loading") {
    return (
      <div className="space-y-6" aria-busy="true" aria-label={props.label}>
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1 space-y-6 rounded-xl border bg-card p-7">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
          <Skeleton className="h-80 w-full rounded-xl lg:w-80" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card px-6 py-12 text-center">
        <p className={props.isError ? "text-destructive" : "text-muted-foreground"}>
          {props.message}
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link href={props.actionHref}>{props.actionLabel}</Link>
        </Button>
      </div>
    </div>
  );
}
