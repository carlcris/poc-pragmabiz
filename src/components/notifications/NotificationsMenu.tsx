"use client";

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

function formatTime(value: string) {
  const date = new Date(value);
  return date.toLocaleString();
}

export function NotificationsMenu() {
  const { data } = useNotifications({ unreadOnly: false, limit: 8, offset: 0 });
  const markRead = useMarkNotificationRead();

  const notifications = data?.data || [];
  const unreadCount = notifications.filter((item) => !item.is_read).length;

  const handleMarkRead = async (notification: Notification) => {
    if (notification.is_read || markRead.isPending) return;
    await markRead.mutateAsync(notification.id);
  };

  return (
    <DropdownMenu>
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
          <span>Notifications</span>
          <Link href="/notifications" className="text-xs text-muted-foreground hover:text-foreground">
            View all
          </Link>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-[320px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">
              No notifications yet.
            </div>
          ) : (
            notifications.map((notification) => (
              <div key={notification.id} className="border-b px-4 py-3 last:border-b-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{notification.title}</span>
                      {!notification.is_read && (
                        <Badge className="bg-blue-600 text-[10px] hover:bg-blue-700">New</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{notification.message}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatTime(notification.created_at)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() => handleMarkRead(notification)}
                    title="Mark as read"
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
