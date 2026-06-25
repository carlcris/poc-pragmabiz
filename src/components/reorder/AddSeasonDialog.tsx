"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calendar, AlertTriangle } from "lucide-react";

type AddSeasonDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateSeason: (season: {
    code: string;
    name: string;
    effectiveFrom: string;
    effectiveTo: string;
    priority: number;
    isActive: boolean;
  }) => Promise<void>;
};

type SeasonFormState = {
  code: string;
  name: string;
  effectiveFrom: string;
  effectiveTo: string;
  priority: number;
  isActive: boolean;
};

export function AddSeasonDialog({ open, onOpenChange, onCreateSeason }: AddSeasonDialogProps) {
  const t = useTranslations("reorderManagementPage");
  const today = new Date().toISOString().split("T")[0];

  const [form, setForm] = useState<SeasonFormState>({
    code: "",
    name: "",
    effectiveFrom: today,
    effectiveTo: today,
    priority: 0,
    isActive: true,
  });

  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setForm({
        code: "",
        name: "",
        effectiveFrom: today,
        effectiveTo: today,
        priority: 0,
        isActive: true,
      });
      setError(null);
    }
  }, [open, today]);

  const handleCreate = async () => {
    // Validation
    if (!form.code || !form.name) {
      setError(t("seasonCodeAndNameRequired"));
      return;
    }

    if (form.effectiveFrom > form.effectiveTo) {
      setError(t("seasonEffectiveDateInvalid"));
      return;
    }

    if (form.priority < 0) {
      setError(t("seasonPriorityInvalid"));
      return;
    }

    setIsPending(true);
    setError(null);
    try {
      await onCreateSeason(form);
      onOpenChange(false); // Close dialog on success
    } catch (err) {
      setError(err instanceof Error ? err.message : t("seasonCreateFailed"));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {t("createNewSeason")}
          </DialogTitle>
          <DialogDescription>{t("createNewSeasonDescription")}</DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="season-code">
                {t("seasonCode")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="season-code"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder={t("seasonCodePlaceholder")}
                disabled={isPending}
              />
              <p className="text-xs text-muted-foreground">{t("seasonCodeHelp")}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="season-name">
                {t("seasonName")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="season-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t("seasonNamePlaceholder")}
                disabled={isPending}
              />
              <p className="text-xs text-muted-foreground">{t("seasonNameHelp")}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="season-from">{t("effectiveFrom")}</Label>
              <Input
                id="season-from"
                type="date"
                value={form.effectiveFrom}
                onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
                disabled={isPending}
              />
              <p className="text-xs text-muted-foreground">{t("effectiveFromHelp")}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="season-to">{t("effectiveTo")}</Label>
              <Input
                id="season-to"
                type="date"
                value={form.effectiveTo}
                onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })}
                disabled={isPending}
              />
              <p className="text-xs text-muted-foreground">{t("effectiveToHelp")}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="season-priority">{t("priority")}</Label>
              <Input
                id="season-priority"
                type="number"
                min="0"
                step="1"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: Number(e.target.value) || 0 })}
                disabled={isPending}
              />
              <p className="text-xs text-muted-foreground">{t("priorityHelp")}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="season-active">{t("status")}</Label>
              <div className="flex items-center space-x-2 pt-2">
                <Switch
                  id="season-active"
                  checked={form.isActive}
                  onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
                  disabled={isPending}
                />
                <Label htmlFor="season-active" className="cursor-pointer">
                  {form.isActive ? t("active") : t("inactive")}
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">{t("seasonActiveHelp")}</p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {t("cancel")}
          </Button>
          <Button onClick={handleCreate} disabled={isPending || !form.code || !form.name}>
            {isPending ? t("creating") : t("createSeason")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
