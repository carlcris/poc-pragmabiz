import { Archive, Layers, LayoutGrid, Package, Route, Rows3, type LucideIcon } from "lucide-react";
import { isWarehouseLocationType, type WarehouseLocationType } from "@/lib/warehouse-location-form";
import { cn } from "@/lib/utils";

// Hues group the levels by role (layout, storage frame, container) and avoid the red/green
// status colors used elsewhere for workflow state.
const warehouseLocationTypeIcons: Record<
  WarehouseLocationType,
  { icon: LucideIcon; className: string }
> = {
  zone: { icon: LayoutGrid, className: "text-indigo-600 dark:text-indigo-400" },
  aisle: { icon: Route, className: "text-sky-600 dark:text-sky-400" },
  rack: { icon: Rows3, className: "text-violet-600 dark:text-violet-400" },
  shelf: { icon: Layers, className: "text-teal-600 dark:text-teal-400" },
  bin: { icon: Archive, className: "text-orange-600 dark:text-orange-400" },
  crate: { icon: Package, className: "text-amber-700 dark:text-amber-400" },
};

type WarehouseLocationTypeIconProps = {
  locationType: string;
  className?: string;
};

// Decorative: the row's text already names the location, so the icon is hidden from assistive tech.
export function WarehouseLocationTypeIcon({
  locationType,
  className,
}: WarehouseLocationTypeIconProps) {
  if (!isWarehouseLocationType(locationType)) return null;
  const { icon: Icon, className: colorClassName } = warehouseLocationTypeIcons[locationType];
  return <Icon className={cn("h-4 w-4 shrink-0", colorClassName, className)} aria-hidden />;
}
