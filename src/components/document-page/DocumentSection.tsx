import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type DocumentSectionProps = {
  id: string;
  title: string;
  description?: string;
  /**
   * Header treatment below xl (phones and tablets), where the side title column squeezes the
   * fields: "hidden" drops the header, "titleOnly" keeps the title as a label above the fields.
   * Both keep the stacked layout until xl. Omit to show the full header and go side by side at lg.
   */
  headerBelowXl?: "hidden" | "titleOnly";
  children: ReactNode;
};

export function DocumentSection({
  id,
  title,
  description,
  headerBelowXl,
  children,
}: DocumentSectionProps) {
  return (
    <section
      aria-labelledby={id}
      className={cn(
        "flex flex-col border-t px-4 py-6 first:border-t-0 sm:px-7",
        headerBelowXl ? "gap-1.5 xl:flex-row xl:gap-10" : "gap-4 lg:flex-row lg:gap-10"
      )}
    >
      <div
        className={cn(
          headerBelowXl ? "xl:w-56 xl:shrink-0" : "lg:w-56 lg:shrink-0",
          headerBelowXl === "hidden" && "hidden xl:block"
        )}
      >
        <h2 id={id} className="text-sm font-semibold">
          {title}
        </h2>
        {description ? (
          <p
            className={cn(
              "mt-1 text-sm leading-relaxed text-muted-foreground",
              headerBelowXl === "titleOnly" && "hidden xl:block"
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </section>
  );
}
