"use client";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronRight, LucideIcon } from "lucide-react";
import Link from "next/link";

interface SettingsCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
}

export function SettingsCard({ title, description, icon: Icon, href }: SettingsCardProps) {
  return (
    <Link href={href} className="block transition-transform hover:scale-[1.02]">
      <Card className="h-full cursor-pointer border-2 border-transparent transition-colors hover:border-primary/20 hover:bg-accent/5">
        <CardHeader className="pb-4">
          <div className="mb-3 flex items-start justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
          <CardTitle className="text-lg">{title}</CardTitle>
          <CardDescription className="line-clamp-2">{description}</CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}
