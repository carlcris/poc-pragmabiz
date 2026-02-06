"use client";

import { useState } from "react";
import { CheckCircle2, Filter } from "lucide-react";
import { useMarkNotificationRead, useNotifications } from "@/hooks/useNotifications";
import type { Notification } from "@/types/notifications";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

function formatTime(value: string) {
  return new Date(value).toLocaleString();
}

export default function NotificationsPage() {
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const { data, isLoading } = useNotifications({
    unreadOnly: filter === "unread",
    limit: 50,
    offset: 0,
  });
  const markRead = useMarkNotificationRead();

  const notifications = data?.data || [];

  const handleMarkRead = async (notification: Notification) => {
    if (notification.is_read || markRead.isPending) return;
    await markRead.mutateAsync(notification.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">Stay updated on important events.</p>
        </div>
        <Select value={filter} onValueChange={(value) => setFilter(value as "all" | "unread")}>
          <SelectTrigger className="w-[180px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="unread">Unread</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-2 p-4">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-80" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No notifications found.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <Card key={notification.id}>
              <CardContent className="flex items-start justify-between gap-4 p-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{notification.title}</span>
                    {!notification.is_read && (
                      <Badge className="bg-blue-600 text-[10px] hover:bg-blue-700">New</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{notification.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatTime(notification.created_at)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => handleMarkRead(notification)}
                  title="Mark as read"
                >
                  <CheckCircle2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
