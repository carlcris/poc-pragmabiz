"use client";

import { MobileHeader } from "@/components/mobile/MobileHeader";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function EndOfDayPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <MobileHeader
        title="End-of-Day"
        subtitle="Physical count & reconciliation"
        vanName="VAN-001"
      />

      <div className="p-4 space-y-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <CheckCircle className="h-16 w-16 mx-auto text-primary" />
              <div>
                <h3 className="font-bold text-lg mb-2">End-of-Day Count</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Perform physical count to reconcile your van inventory
                </p>
                <Button size="lg" className="w-full">
                  Start Count
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
