import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageToolbarProps = {
  children: ReactNode;
  className?: string;
};

export const PageToolbar = ({ children, className }: PageToolbarProps) => (
  <div className={cn("flex flex-col gap-3 sm:flex-row sm:gap-4", className)}>{children}</div>
);
