"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Plus, Trash2, Edit, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  useDamagedItems,
  useCreateDamagedItem,
  useUpdateDamagedItem,
  useDeleteDamagedItem,
} from "@/hooks/useGRNs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { DamagedItem, DamageType, DamagedItemStatus, GRNItem } from "@/types/grn";

interface DamagedItemsSectionProps {
  grnId: string;
  grnItems: GRNItem[];
  isEditable: boolean;
}

export function DamagedItemsSection({ grnId, grnItems, isEditable }: DamagedItemsSectionProps) {
  const t = useTranslations("grnDamagedItemsSection");
  const locale = useLocale();
  const { data: damagedItemsData, isLoading } = useDamagedItems(grnId);
  const createMutation = useCreateDamagedItem();
  const updateMutation = useUpdateDamagedItem();
  const deleteMutation = useDeleteDamagedItem();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<DamagedItem | null>(null);

  const [formData, setFormData] = useState({
    itemId: "",
    qty: 0,
    damageType: "broken" as DamageType,
    description: "",
  });

  const [updateData, setUpdateData] = useState({
    actionTaken: "",
    status: "reported" as DamagedItemStatus,
  });

  const damagedItems = damagedItemsData?.data || [];

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return t("noValue");
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }).format(new Date(dateString));
  };

  const getDamageTypeBadge = (type: DamageType) => {
    switch (type) {
      case "broken":
        return <Badge variant="destructive">{t("broken")}</Badge>;
      case "defective":
        return <Badge variant="destructive">{t("defective")}</Badge>;
      case "missing":
        return (
          <Badge variant="outline" className="border-orange-600 text-orange-700">
            {t("missing")}
          </Badge>
        );
      case "expired":
        return <Badge variant="destructive">{t("expired")}</Badge>;
      case "wrong_item":
        return (
          <Badge variant="outline" className="border-orange-600 text-orange-700">
            {t("wrongItem")}
          </Badge>
        );
      case "other":
        return <Badge variant="secondary">{t("other")}</Badge>;
      default:
        return <Badge>{type}</Badge>;
    }
  };

  const getStatusBadge = (status: DamagedItemStatus) => {
    switch (status) {
      case "reported":
        return (
          <Badge variant="outline" className="border-yellow-600 text-yellow-700">
            {t("reported")}
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="outline" className="border-blue-600 text-blue-700">
            {t("processing")}
          </Badge>
        );
      case "resolved":
        return (
          <Badge variant="outline" className="border-green-600 text-green-700">
            {t("resolved")}
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const handleCreate = async () => {
    if (!formData.itemId || formData.qty <= 0) {
      toast.error(t("validationError"));
      return;
    }

    try {
      await createMutation.mutateAsync({
        grnId,
        data: formData,
      });
      toast.success(t("createSuccess"));
      setDialogOpen(false);
      setFormData({
        itemId: "",
        qty: 0,
        damageType: "broken",
        description: "",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("createError"));
    }
  };

  const handleUpdate = async () => {
    if (!selectedItem) return;

    try {
      await updateMutation.mutateAsync({
        id: selectedItem.id,
        data: updateData,
      });
      toast.success(t("updateSuccess"));
      setUpdateDialogOpen(false);
      setSelectedItem(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("updateError"));
    }
  };

  const handleDelete = async () => {
    if (!selectedItem) return;

    try {
      await deleteMutation.mutateAsync(selectedItem.id);
      toast.success(t("deleteSuccess"));
      setDeleteDialogOpen(false);
      setSelectedItem(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("deleteError"));
    }
  };

  const openUpdateDialog = (item: DamagedItem) => {
    setSelectedItem(item);
    setUpdateData({
      actionTaken: item.actionTaken || "",
      status: item.status,
    });
    setUpdateDialogOpen(true);
  };

  const openDeleteDialog = (item: DamagedItem) => {
    setSelectedItem(item);
    setDeleteDialogOpen(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            {t("title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                {t("title")}
              </CardTitle>
              <CardDescription>{t("description")}</CardDescription>
            </div>
            {isEditable && (
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {t("reportDamage")}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {damagedItems.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">{t("empty")}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("item")}</TableHead>
                  <TableHead className="text-right">{t("quantity")}</TableHead>
                  <TableHead>{t("damageType")}</TableHead>
                  <TableHead>{t("descriptionLabel")}</TableHead>
                  <TableHead>{t("reportedBy")}</TableHead>
                  <TableHead>{t("reportedDate")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("actionTaken")}</TableHead>
                  {isEditable && <TableHead className="text-right">{t("actions")}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {damagedItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{item.item?.code || t("noValue")}</div>
                        <div className="text-sm text-muted-foreground">
                          {item.item?.name || t("noValue")}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{item.qty}</TableCell>
                    <TableCell>{getDamageTypeBadge(item.damageType)}</TableCell>
                    <TableCell>
                      <div className="max-w-xs truncate text-sm">{item.description || t("noValue")}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {item.reportedByUser
                          ? `${item.reportedByUser.firstName} ${item.reportedByUser.lastName}`
                          : t("noValue")}
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(item.reportedDate)}</TableCell>
                    <TableCell>{getStatusBadge(item.status)}</TableCell>
                    <TableCell>
                      <div className="max-w-xs truncate text-sm">{item.actionTaken || t("noValue")}</div>
                    </TableCell>
                    {isEditable && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openUpdateDialog(item)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openDeleteDialog(item)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("createTitle")}</DialogTitle>
            <DialogDescription>{t("createDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="item">{t("itemLabel")}</Label>
              <Select
                value={formData.itemId}
                onValueChange={(value) => setFormData({ ...formData, itemId: value })}
              >
                <SelectTrigger id="item">
                  <SelectValue placeholder={t("selectItem")} />
                </SelectTrigger>
                <SelectContent>
                  {grnItems.map((item) => (
                    <SelectItem key={item.id} value={item.itemId}>
                      {item.item?.code} - {item.item?.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="qty">{t("quantityLabel")}</Label>
              <Input
                id="qty"
                type="number"
                min="0"
                step="0.01"
                value={formData.qty}
                onChange={(e) =>
                  setFormData({ ...formData, qty: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
            <div>
              <Label htmlFor="damageType">{t("damageTypeLabel")}</Label>
              <Select
                value={formData.damageType}
                onValueChange={(value) =>
                  setFormData({ ...formData, damageType: value as DamageType })
                }
              >
                <SelectTrigger id="damageType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="broken">{t("broken")}</SelectItem>
                  <SelectItem value="defective">{t("defective")}</SelectItem>
                  <SelectItem value="missing">{t("missing")}</SelectItem>
                  <SelectItem value="expired">{t("expired")}</SelectItem>
                  <SelectItem value="wrong_item">{t("wrongItem")}</SelectItem>
                  <SelectItem value="other">{t("other")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="description">{t("descriptionLabel")}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t("descriptionPlaceholder")}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? t("reporting") : t("report")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("updateTitle")}</DialogTitle>
            <DialogDescription>{t("updateDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="status">{t("statusLabel")}</Label>
              <Select
                value={updateData.status}
                onValueChange={(value) =>
                  setUpdateData({ ...updateData, status: value as DamagedItemStatus })
                }
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reported">{t("reported")}</SelectItem>
                  <SelectItem value="processing">{t("processing")}</SelectItem>
                  <SelectItem value="resolved">{t("resolved")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="actionTaken">{t("actionTakenLabel")}</Label>
              <Textarea
                id="actionTaken"
                value={updateData.actionTaken}
                onChange={(e) => setUpdateData({ ...updateData, actionTaken: e.target.value })}
                placeholder={t("actionTakenPlaceholder")}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdateDialogOpen(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? t("updating") : t("update")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? t("deleting") : t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
