"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { Bell, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMarkNotificationRead, useNotifications } from "@/hooks/useNotifications";
import type { Notification } from "@/types/notifications";
import { Skeleton } from "@/components/ui/skeleton";

export function NotificationsMenu() {
  const t = useTranslations("notificationsPage");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { data } = useNotifications({ unreadOnly: false, limit: 8, offset: 0, enabled: true });
  const markRead = useMarkNotificationRead();

  useEffect(() => {
    setMounted(true);
  }, []);

  const notifications = data?.data || [];
  const unreadCount = notifications.filter((item) => !item.is_read).length;

  const handleMarkRead = async (notification: Notification) => {
    if (notification.is_read || markRead.isPending) return;
    await markRead.mutateAsync(notification.id);
  };

  if (!mounted) {
    return <Skeleton className="h-10 w-10 rounded-full" />;
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
              {unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>{t("title")}</span>
          <Link href="/notifications" className="text-xs text-muted-foreground hover:text-foreground">
            {t("viewAll")}
          </Link>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-[320px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">
              {t("emptyMenu")}
            </div>
          ) : (
            notifications.map((notification) => (
              <div key={notification.id} className="border-b px-4 py-3 last:border-b-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{notification.title}</span>
                      {!notification.is_read && (
                        <Badge className="bg-blue-600 text-[10px] hover:bg-blue-700">
                          {t("new")}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{notification.message}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(notification.created_at).toLocaleString(locale)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() => handleMarkRead(notification)}
                    title={t("markAsRead")}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
