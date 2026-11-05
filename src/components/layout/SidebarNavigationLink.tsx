"use client";

import Link, { useLinkStatus } from "next/link";
import { createPortal } from "react-dom";
import { LoaderCircle, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

type SidebarNavigationLinkProps = {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
};

function SidebarNavigationContent({
  label,
  icon: Icon,
  active,
  collapsed = false,
}: Omit<SidebarNavigationLinkProps, "href" | "onNavigate">) {
  const { pending } = useLinkStatus();
  const t = useTranslations("navigation");
  const loadingLabel = t("loadingDestination", { destination: label });

  return (
    <>
      <span
        aria-busy={pending}
        className={cn(
          "flex items-center rounded-md transition-colors",
          collapsed ? "h-10 w-10 justify-center" : "gap-3 px-3 py-2 text-sm",
          active
            ? "bg-white/20 font-medium text-white"
            : "text-gray-300 hover:bg-white/10 hover:text-white",
          pending && "text-white ring-1 ring-inset ring-white/30",
          pending && !active && "bg-white/10"
        )}
      >
        {pending ? (
          <LoaderCircle
            role="status"
            className={cn(
              "shrink-0 animate-spin motion-reduce:animate-none",
              collapsed ? "h-5 w-5" : "h-4 w-4"
            )}
          />
        ) : (
          <Icon aria-hidden="true" className={collapsed ? "h-5 w-5" : "h-4 w-4"} />
        )}
        <span className={collapsed ? "sr-only" : undefined}>{label}</span>
        <span role="status" className="sr-only">
          {pending ? loadingLabel : ""}
        </span>
      </span>
      {pending &&
        createPortal(
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-x-0 top-0 z-50 md:hidden"
          >
            <div className="h-1 animate-pulse bg-primary motion-reduce:animate-none" />
            <div className="mx-auto flex w-fit max-w-full items-center gap-2 rounded-b-md bg-background px-3 py-2 text-sm text-foreground shadow-md">
              <LoaderCircle
                aria-hidden="true"
                className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none"
              />
              <span>{loadingLabel}</span>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

export function SidebarNavigationLink({
  href,
  onNavigate,
  ...contentProps
}: SidebarNavigationLinkProps) {
  return (
    <Link
      href={href}
      onNavigate={onNavigate}
      aria-current={contentProps.active ? "page" : undefined}
      title={contentProps.collapsed ? contentProps.label : undefined}
      className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
    >
      <SidebarNavigationContent {...contentProps} />
    </Link>
  );
}
