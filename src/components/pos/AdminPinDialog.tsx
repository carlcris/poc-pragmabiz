"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AdminPinDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerify: (pin: string) => Promise<boolean>;
  title?: string;
  description?: string;
};

export function AdminPinDialog({
  open,
  onOpenChange,
  onVerify,
  title,
  description,
}: AdminPinDialogProps) {
  const t = useTranslations("adminPinDialog");
  const [pin, setPin] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState("");

  const handleVerify = async () => {
    if (!pin) {
      setError(t("pinRequired"));
      return;
    }

    setIsVerifying(true);
    setError("");

    try {
      const isValid = await onVerify(pin);
      if (isValid) {
        setPin("");
      } else {
        setError(t("invalidPin"));
      }
    } catch {
      setError(t("verifyFailed"));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCancel = () => {
    setPin("");
    setError("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-orange-600" />
            {title || t("defaultTitle")}
          </DialogTitle>
          <DialogDescription>{description || t("defaultDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="admin-pin">{t("pinLabel")}</Label>
            <Input
              id="admin-pin"
              type="password"
              placeholder={t("pinPlaceholder")}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void handleVerify();
                }
              }}
              autoFocus
              disabled={isVerifying}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isVerifying}>{t("cancel")}</Button>
          <Button onClick={handleVerify} disabled={isVerifying || !pin}>
            {isVerifying ? t("verifying") : t("verify")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
