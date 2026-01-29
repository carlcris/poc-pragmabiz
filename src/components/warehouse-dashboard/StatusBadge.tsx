import { Badge } from "@/components/ui/badge";
import type { Priority } from "@/types/warehouse-dashboard";

type StatusBadgeProps = {
  status: string;
  variant?: "default" | "secondary" | "outline" | "destructive";
};

type PriorityBadgeProps = {
  priority: Priority;
};

export const StatusBadge = ({ status, variant = "default" }: StatusBadgeProps) => {
  const statusConfig: Record<
    string,
    { label: string; variant: typeof variant; className?: string }
  > = {
    draft: { label: "Draft", variant: "outline", className: "border-gray-400 text-gray-600" },
    submitted: {
      label: "Submitted",
      variant: "outline",
      className: "border-blue-400 text-blue-600",
    },
    approved: { label: "Approved", variant: "default", className: "bg-green-600" },
    ready_for_pick: { label: "Ready to Pick", variant: "default", className: "bg-blue-600" },
    picking: { label: "Picking", variant: "default", className: "bg-yellow-600" },
    completed: { label: "Completed", variant: "default", className: "bg-green-700" },
    cancelled: { label: "Cancelled", variant: "destructive" },
    in_transit: { label: "In Transit", variant: "default", className: "bg-blue-600" },
    partially_received: {
      label: "Partially Received",
      variant: "default",
      className: "bg-orange-600",
    },
  };

  const config = statusConfig[status] || { label: status, variant, className: "" };

  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  );
};

export const PriorityBadge = ({ priority }: PriorityBadgeProps) => {
  const priorityConfig: Record<Priority, { label: string; className: string }> = {
    low: { label: "Low", className: "bg-gray-500 text-white" },
    normal: { label: "Normal", className: "bg-blue-500 text-white" },
    high: { label: "High", className: "bg-orange-500 text-white" },
    urgent: { label: "Urgent", className: "bg-red-600 text-white" },
  };

  const config = priorityConfig[priority];

  return (
    <Badge variant="default" className={config.className}>
      {config.label}
    </Badge>
  );
};
