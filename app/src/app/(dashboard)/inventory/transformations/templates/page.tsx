"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Eye, Pencil, Trash2, Power, PowerOff, ArrowLeft } from "lucide-react";
import {
  useTransformationTemplates,
  useDeleteTransformationTemplate,
  useActivateTransformationTemplate,
  useDeactivateTransformationTemplate,
} from "@/hooks/useTransformationTemplates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { TransformationTemplateFormDialog } from "@/components/transformations/TransformationTemplateFormDialog";
import { TransformationTemplateDetailDialog } from "@/components/transformations/TransformationTemplateDetailDialog";
import type { TransformationTemplate } from "@/types/transformation-template";

export default function TransformationTemplatesPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TransformationTemplate | null>(null);
  const [viewTemplate, setViewTemplate] = useState<TransformationTemplate | null>(null);
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);

  const limit = 20;

  // Fetch templates
  const { data: templatesData, isLoading } = useTransformationTemplates({
    search,
    page,
    limit,
  });

  const deleteTemplate = useDeleteTransformationTemplate();
  const activateTemplate = useActivateTransformationTemplate();
  const deactivateTemplate = useDeactivateTransformationTemplate();

  const handleDelete = async () => {
    if (deleteTemplateId) {
      await deleteTemplate.mutateAsync(deleteTemplateId);
      setDeleteTemplateId(null);
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    if (isActive) {
      await deactivateTemplate.mutateAsync(id);
    } else {
      await activateTemplate.mutateAsync(id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/inventory/transformations")}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-3xl font-bold">Transformation Templates</h1>
          </div>
          <p className="text-muted-foreground ml-10">
            Manage reusable transformation recipes
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Template
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by template code or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Templates Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Template Code</TableHead>
              <TableHead>Template Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Inputs</TableHead>
              <TableHead>Outputs</TableHead>
              <TableHead>Usage Count</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : templatesData?.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  No transformation templates found
                </TableCell>
              </TableRow>
            ) : (
              templatesData?.data.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">
                    {template.template_code}
                  </TableCell>
                  <TableCell>{template.template_name}</TableCell>
                  <TableCell>
                    <Badge
                      className={
                        template.is_active ? "bg-green-500" : "bg-gray-500"
                      }
                    >
                      {template.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>{template.inputs?.length || 0}</TableCell>
                  <TableCell>{template.outputs?.length || 0}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{template.usage_count}</Badge>
                    {template.usage_count > 0 && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (locked)
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(template.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewTemplate(template)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {template.usage_count === 0 && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedTemplate(template)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTemplateId(template.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleToggleActive(template.id, template.is_active)
                        }
                      >
                        {template.is_active ? (
                          <PowerOff className="h-4 w-4" />
                        ) : (
                          <Power className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {templatesData && templatesData.total > limit && (
        <DataTablePagination
          page={page}
          totalPages={Math.ceil(templatesData.total / limit)}
          onPageChange={setPage}
        />
      )}

      {/* Create/Edit Dialog */}
      <TransformationTemplateFormDialog
        open={isCreateOpen || !!selectedTemplate}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateOpen(false);
            setSelectedTemplate(null);
          }
        }}
        template={selectedTemplate || undefined}
      />

      {/* View Dialog */}
      <TransformationTemplateDetailDialog
        open={!!viewTemplate}
        onOpenChange={(open) => !open && setViewTemplate(null)}
        template={viewTemplate || undefined}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteTemplateId}
        onOpenChange={() => setDeleteTemplateId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transformation Template?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              transformation template.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
