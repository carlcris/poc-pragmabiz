"use client";

import { useState } from "react";
import { Plus, Trash2, Edit, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
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

  const getDamageTypeBadge = (type: DamageType) => {
    switch (type) {
      case "broken":
        return <Badge variant="destructive">Broken</Badge>;
      case "defective":
        return <Badge variant="destructive">Defective</Badge>;
      case "missing":
        return (
          <Badge variant="outline" className="border-orange-600 text-orange-700">
            Missing
          </Badge>
        );
      case "expired":
        return <Badge variant="destructive">Expired</Badge>;
      case "wrong_item":
        return (
          <Badge variant="outline" className="border-orange-600 text-orange-700">
            Wrong Item
          </Badge>
        );
      case "other":
        return <Badge variant="secondary">Other</Badge>;
      default:
        return <Badge>{type}</Badge>;
    }
  };

  const getStatusBadge = (status: DamagedItemStatus) => {
    switch (status) {
      case "reported":
        return (
          <Badge variant="outline" className="border-yellow-600 text-yellow-700">
            Reported
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="outline" className="border-blue-600 text-blue-700">
            Processing
          </Badge>
        );
      case "resolved":
        return (
          <Badge variant="outline" className="border-green-600 text-green-700">
            Resolved
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const handleCreate = async () => {
    if (!formData.itemId || formData.qty <= 0) {
      toast.error("Please select an item and enter a valid quantity");
      return;
    }

    try {
      await createMutation.mutateAsync({
        grnId,
        data: formData,
      });
      toast.success("Damaged item reported successfully");
      setDialogOpen(false);
      setFormData({
        itemId: "",
        qty: 0,
        damageType: "broken",
        description: "",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to report damaged item");
    }
  };

  const handleUpdate = async () => {
    if (!selectedItem) return;

    try {
      await updateMutation.mutateAsync({
        id: selectedItem.id,
        data: updateData,
      });
      toast.success("Damaged item updated successfully");
      setUpdateDialogOpen(false);
      setSelectedItem(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update damaged item");
    }
  };

  const handleDelete = async () => {
    if (!selectedItem) return;

    try {
      await deleteMutation.mutateAsync(selectedItem.id);
      toast.success("Damaged item deleted successfully");
      setDeleteDialogOpen(false);
      setSelectedItem(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete damaged item");
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
            Damaged Items
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
                Damaged Items
              </CardTitle>
              <CardDescription>Report and track damaged or defective items</CardDescription>
            </div>
            {isEditable && (
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Report Damage
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {damagedItems.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No damaged items reported
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>Damage Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Reported By</TableHead>
                  <TableHead>Reported Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action Taken</TableHead>
                  {isEditable && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {damagedItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{item.item?.code || "-"}</div>
                        <div className="text-sm text-muted-foreground">{item.item?.name || "-"}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{item.qty}</TableCell>
                    <TableCell>{getDamageTypeBadge(item.damageType)}</TableCell>
                    <TableCell>
                      <div className="max-w-xs truncate text-sm">{item.description || "-"}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {item.reportedByUser
                          ? `${item.reportedByUser.firstName} ${item.reportedByUser.lastName}`
                          : "-"}
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.reportedDate
                        ? format(new Date(item.reportedDate), "MMM dd, yyyy")
                        : "-"}
                    </TableCell>
                    <TableCell>{getStatusBadge(item.status)}</TableCell>
                    <TableCell>
                      <div className="max-w-xs truncate text-sm">{item.actionTaken || "-"}</div>
                    </TableCell>
                    {isEditable && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openUpdateDialog(item)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDeleteDialog(item)}
                          >
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

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report Damaged Item</DialogTitle>
            <DialogDescription>
              Record a damaged or defective item from this GRN
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="item">Item *</Label>
              <Select
                value={formData.itemId}
                onValueChange={(value) => setFormData({ ...formData, itemId: value })}
              >
                <SelectTrigger id="item">
                  <SelectValue placeholder="Select an item" />
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
              <Label htmlFor="qty">Quantity *</Label>
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
              <Label htmlFor="damageType">Damage Type *</Label>
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
                  <SelectItem value="broken">Broken</SelectItem>
                  <SelectItem value="defective">Defective</SelectItem>
                  <SelectItem value="missing">Missing</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="wrong_item">Wrong Item</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the damage..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Reporting..." : "Report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Dialog */}
      <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Damaged Item</DialogTitle>
            <DialogDescription>Update the action taken and status</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="status">Status</Label>
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
                  <SelectItem value="reported">Reported</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="actionTaken">Action Taken</Label>
              <Textarea
                id="actionTaken"
                value={updateData.actionTaken}
                onChange={(e) => setUpdateData({ ...updateData, actionTaken: e.target.value })}
                placeholder="Describe the action taken..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Updating..." : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Damaged Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this damaged item record? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
