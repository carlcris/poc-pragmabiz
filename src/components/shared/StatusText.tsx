import { cn } from "@/lib/utils";

type StatusTextTone =
  | "muted"
  | "blue"
  | "green"
  | "yellow"
  | "amber"
  | "orange"
  | "purple"
  | "indigo"
  | "red"
  | "slate";

type StatusTextProps = {
  children: React.ReactNode;
  tone?: StatusTextTone;
  className?: string;
};

const toneClassName: Record<StatusTextTone, string> = {
  muted: "text-muted-foreground",
  blue: "text-blue-700 dark:text-blue-400",
  green: "text-green-700 dark:text-green-400",
  yellow: "text-yellow-700 dark:text-yellow-400",
  amber: "text-amber-700 dark:text-amber-400",
  orange: "text-orange-700 dark:text-orange-400",
  purple: "text-purple-700 dark:text-purple-400",
  indigo: "text-indigo-700 dark:text-indigo-400",
  red: "text-red-700 dark:text-red-400",
  slate: "text-slate-600 dark:text-slate-400",
};

export const StatusText = ({ children, tone = "muted", className }: StatusTextProps) => (
  <span className={cn("text-sm font-medium", toneClassName[tone], className)}>{children}</span>
);
