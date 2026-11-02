import type { ReactNode } from "react";

type LoadListSectionProps = {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
};

export function LoadListSection({ id, title, description, children }: LoadListSectionProps) {
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-4 border-t px-5 py-6 first:border-t-0 sm:px-7 lg:flex-row lg:gap-10"
    >
      <div className="lg:w-56 lg:shrink-0">
        <h2 id={id} className="text-sm font-semibold">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </section>
  );
}
