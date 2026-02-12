import { LucideIcon } from "lucide-react";

type WidgetEmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  variant?: "default" | "success" | "warning";
};

export function WidgetEmptyState({
  icon: Icon,
  title,
  description,
  variant = "default",
}: WidgetEmptyStateProps) {
  const iconColor =
    variant === "success"
      ? "text-green-500/50"
      : variant === "warning"
        ? "text-amber-500/50"
        : "text-muted-foreground/40";

  const titleColor =
    variant === "success"
      ? "text-green-600"
      : variant === "warning"
        ? "text-amber-600"
        : "text-muted-foreground";

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Icon className={`mb-4 h-16 w-16 ${iconColor}`} strokeWidth={1.5} />
      <p className={`text-base font-medium ${titleColor}`}>{title}</p>
      {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}
