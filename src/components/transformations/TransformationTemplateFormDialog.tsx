"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Pencil, FileText, ArrowDownToLine, ArrowUpFromLine, Image as ImageIcon, AlertCircle } from "lucide-react";
import {
  useCreateTransformationTemplate,
  useUpdateTransformationTemplate,
} from "@/hooks/useTransformationTemplates";
import type {
  CreateTransformationTemplateRequest,
  TransformationTemplateApi,
} from "@/types/transformation-template";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/ui/image-upload";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TransformationItemDialog,
  type TransformationItemFormValues,
} from "./TransformationItemDialog";

// Schema for form validation (only basic fields, not inputs/outputs)
const templateFormSchema = z.object({
  companyId: z.string().optional(), // Optional because it may be set by auth
  templateCode: z.string().min(1, "Template code is required"),
  templateName: z.string().min(1, "Template name is required"),
  description: z.string().optional(),
  imageUrl: z.string().url("Image URL must be valid").optional().or(z.literal("")),
});

type TemplateFormValues = z.infer<typeof templateFormSchema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: TransformationTemplateApi;
};

export function TransformationTemplateFormDialog({ open, onOpenChange, template }: Props) {
  const { user } = useAuthStore();
  const companyId = user?.companyId;

  // Line items state
  const [inputs, setInputs] = useState<TransformationItemFormValues[]>([]);
  const [outputs, setOutputs] = useState<TransformationItemFormValues[]>([]);

  // Dialog state
  const [inputDialogOpen, setInputDialogOpen] = useState(false);
  const [outputDialogOpen, setOutputDialogOpen] = useState(false);
  const [editingInput, setEditingInput] = useState<{
    index: number;
    item: TransformationItemFormValues;
  } | null>(null);
  const [editingOutput, setEditingOutput] = useState<{
    index: number;
    item: TransformationItemFormValues;
  } | null>(null);

  const createTemplate = useCreateTransformationTemplate();
  const updateTemplate = useUpdateTransformationTemplate();
  const canEditMaterials = !template || template.usage_count === 0;

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      companyId: companyId || "",
      templateCode: "",
      templateName: "",
      description: "",
      imageUrl: "",
    },
  });

  useEffect(() => {
    if (template) {
      form.reset({
        companyId: template.company_id,
        templateCode: template.template_code,
        templateName: template.template_name,
        description: template.description || "",
        imageUrl: template.image_url || "",
      });
      setInputs(
        (template.inputs || []).map((input, index) => ({
          itemId: input.item_id || input.items?.id || "",
          itemCode: input.items?.item_code || "",
          itemName: input.items?.item_name || "",
          quantity: Number(input.quantity) || 0,
          uomId: input.uom_id || input.uom?.id || "",
          uom: input.uom?.uom_name || input.uom?.name || input.uom?.code || "",
          sequence: input.sequence || index + 1,
          notes: input.notes || "",
        }))
      );
      setOutputs(
        (template.outputs || []).map((output, index) => ({
          itemId: output.item_id || output.items?.id || "",
          itemCode: output.items?.item_code || "",
          itemName: output.items?.item_name || "",
          quantity: Number(output.quantity) || 0,
          uomId: output.uom_id || output.uom?.id || "",
          uom: output.uom?.uom_name || output.uom?.name || output.uom?.code || "",
          sequence: output.sequence || index + 1,
          isScrap: Boolean(output.is_scrap),
          notes: output.notes || "",
        }))
      );
    } else if (!open) {
      // Reset when closing dialog
      form.reset({
        companyId: companyId || "",
        templateCode: "",
        templateName: "",
        description: "",
        imageUrl: "",
      });
      setInputs([]);
      setOutputs([]);
    }
  }, [template, open, companyId, form]);

  // Handler for adding/editing input items
  const handleSaveInput = (item: TransformationItemFormValues) => {
    if (editingInput !== null) {
      // Update existing item
      const newInputs = [...inputs];
      newInputs[editingInput.index] = item;
      setInputs(newInputs);
      setEditingInput(null);
    } else {
      // Add new item
      setInputs([...inputs, item]);
    }
  };

  // Handler for adding/editing output items
  const handleSaveOutput = (item: TransformationItemFormValues) => {
    if (editingOutput !== null) {
      // Update existing item
      const newOutputs = [...outputs];
      newOutputs[editingOutput.index] = item;
      setOutputs(newOutputs);
      setEditingOutput(null);
    } else {
      // Add new item
      setOutputs([...outputs, item]);
    }
  };

  // Handler for editing items
  const handleEditInput = (index: number) => {
    setEditingInput({ index, item: inputs[index] });
    setInputDialogOpen(true);
  };

  const handleEditOutput = (index: number) => {
    setEditingOutput({ index, item: outputs[index] });
    setOutputDialogOpen(true);
  };

  // Handler for removing items
  const handleRemoveInput = (index: number) => {
    setInputs(inputs.filter((_, i) => i !== index));
  };

  const handleRemoveOutput = (index: number) => {
    setOutputs(outputs.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: TemplateFormValues) => {
    try {
      // Only require inputs/outputs when creating a new template.
      if (canEditMaterials) {
        if (inputs.length === 0) {
          form.setError("root", {
            type: "manual",
            message: "Please add at least one input item",
          });
          return;
        }

        if (outputs.length === 0) {
          form.setError("root", {
            type: "manual",
            message: "Please add at least one output item",
          });
          return;
        }
      }

      // Ensure companyId is set
      const finalCompanyId = data.companyId || companyId;
      if (!finalCompanyId) {
        form.setError("root", {
          type: "manual",
          message: "Company ID is missing. Please try logging in again.",
        });
        return;
      }

      const payload: CreateTransformationTemplateRequest = {
        companyId: finalCompanyId,
        templateCode: data.templateCode,
        templateName: data.templateName,
        description: data.description,
        imageUrl: data.imageUrl || undefined,
        inputs: inputs.map((input, index) => ({
          itemId: input.itemId,
          quantity: input.quantity,
          uomId: input.uomId,
          sequence: index + 1,
          notes: input.notes,
        })),
        outputs: outputs.map((output, index) => ({
          itemId: output.itemId,
          quantity: output.quantity,
          uomId: output.uomId,
          sequence: index + 1,
          isScrap: output.isScrap || false,
          notes: output.notes,
        })),
      };

      if (template) {
        await updateTemplate.mutateAsync({
          id: template.id,
          data: {
            templateName: data.templateName,
            description: data.description,
            imageUrl: data.imageUrl || undefined,
            ...(canEditMaterials
              ? {
                  inputs: inputs.map((input, index) => ({
                    itemId: input.itemId,
                    quantity: input.quantity,
                    uomId: input.uomId,
                    sequence: index + 1,
                    notes: input.notes,
                  })),
                  outputs: outputs.map((output, index) => ({
                    itemId: output.itemId,
                    quantity: output.quantity,
                    uomId: output.uomId,
                    sequence: index + 1,
                    isScrap: output.isScrap || false,
                    notes: output.notes,
                  })),
                }
              : {}),
          },
        });
      } else {
        await createTemplate.mutateAsync(payload);
      }

      onOpenChange(false);
      form.reset();
      setInputs([]);
      setOutputs([]);
    } catch (error) {
      const errorMessage = (() => {
        if (error && typeof error === "object") {
          const errorWithCause = error as {
            cause?: { error?: string; details?: Array<{ message?: string }> };
          };
          if (errorWithCause.cause?.error) return errorWithCause.cause.error;
          const detailsMessage = errorWithCause.cause?.details?.[0]?.message;
          if (detailsMessage) return detailsMessage;
        }
        return error instanceof Error
          ? error.message
          : "Failed to save template. Please try again.";
      })();
      form.setError("root", {
        type: "manual",
        message: errorMessage,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? "Edit Template" : "Create Transformation Template"}</DialogTitle>
          <DialogDescription>
            {template
              ? canEditMaterials
                ? "Update template details, image, and input/output materials"
                : "Update template name and description only (inputs/outputs locked if used)"
              : "Define a reusable transformation recipe with inputs and outputs"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Usage Warning */}
            {template && template.usage_count > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-amber-900">Template In Use</h4>
                    <p className="mt-1 text-sm text-amber-700">
                      This template has been used {template.usage_count} time{template.usage_count > 1 ? 's' : ''}.
                      Input and output materials cannot be modified.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Basic Information Card */}
            <div className="rounded-lg border bg-card">
              <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-3">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Basic Information</h3>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                  {/* Form Fields */}
                  <div className="lg:col-span-2 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="templateCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Template Code *</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g., BREAD-001" disabled={!!template} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="templateName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Template Name *</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g., Bread Production" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea {...field} placeholder="Optional description..." rows={3} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Image Upload */}
                  <div className="lg:col-span-1">
                    <FormField
                      control={form.control}
                      name="imageUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <ImageIcon className="h-3.5 w-3.5" />
                            Template Image
                          </FormLabel>
                          <FormControl>
                            <ImageUpload
                              value={field.value || undefined}
                              onChange={(url) => field.onChange(url || "")}
                              disabled={Boolean(template && template.usage_count > 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>
            </div>

            {canEditMaterials && (
              <>
                {/* Input Materials Card */}
                <div className="rounded-lg border bg-card">
                  <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ArrowDownToLine className="h-4 w-4 text-blue-600" />
                      <h3 className="text-sm font-semibold">Input Materials</h3>
                      <span className="text-xs text-muted-foreground">
                        ({inputs.length} item{inputs.length !== 1 ? 's' : ''})
                      </span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setEditingInput(null);
                        setInputDialogOpen(true);
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Input
                    </Button>
                  </div>

                  {inputs.length === 0 ? (
                    <div className="p-8 text-center">
                      <ArrowDownToLine className="mx-auto h-12 w-12 text-muted-foreground/50" />
                      <p className="mt-2 text-sm font-medium text-muted-foreground">
                        No input materials added yet
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Click &quot;Add Input&quot; to add raw materials required for this transformation
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="font-semibold">Item Code</TableHead>
                            <TableHead className="font-semibold">Item Name</TableHead>
                            <TableHead className="text-right font-semibold">Quantity</TableHead>
                            <TableHead className="font-semibold">UOM</TableHead>
                            <TableHead className="w-[120px] text-center font-semibold">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {inputs.map((input, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-mono text-xs">{input.itemCode}</TableCell>
                              <TableCell className="font-medium">{input.itemName}</TableCell>
                              <TableCell className="text-right font-semibold">{input.quantity}</TableCell>
                              <TableCell>
                                <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">
                                  {input.uom}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => handleEditInput(index)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => handleRemoveInput(index)}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

                {/* Output Products Card */}
                <div className="rounded-lg border bg-card">
                  <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ArrowUpFromLine className="h-4 w-4 text-green-600" />
                      <h3 className="text-sm font-semibold">Output Products</h3>
                      <span className="text-xs text-muted-foreground">
                        ({outputs.length} item{outputs.length !== 1 ? 's' : ''})
                      </span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setEditingOutput(null);
                        setOutputDialogOpen(true);
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Output
                    </Button>
                  </div>

                  {outputs.length === 0 ? (
                    <div className="p-8 text-center">
                      <ArrowUpFromLine className="mx-auto h-12 w-12 text-muted-foreground/50" />
                      <p className="mt-2 text-sm font-medium text-muted-foreground">
                        No output products added yet
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Click &quot;Add Output&quot; to add finished goods or scrap produced
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="font-semibold">Item Code</TableHead>
                            <TableHead className="font-semibold">Item Name</TableHead>
                            <TableHead className="text-right font-semibold">Quantity</TableHead>
                            <TableHead className="font-semibold">UOM</TableHead>
                            <TableHead className="font-semibold">Type</TableHead>
                            <TableHead className="w-[120px] text-center font-semibold">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {outputs.map((output, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-mono text-xs">{output.itemCode}</TableCell>
                              <TableCell className="font-medium">{output.itemName}</TableCell>
                              <TableCell className="text-right font-semibold">{output.quantity}</TableCell>
                              <TableCell>
                                <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">
                                  {output.uom}
                                </span>
                              </TableCell>
                              <TableCell>
                                {output.isScrap ? (
                                  <span className="inline-flex items-center rounded-md bg-orange-50 px-2 py-1 text-xs font-medium text-orange-700">
                                    Scrap
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                                    Product
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => handleEditOutput(index)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => handleRemoveOutput(index)}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </>
            )}

            {form.formState.errors.root && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-destructive">Validation Error</h4>
                    <p className="mt-1 text-sm text-destructive/90">
                      {form.formState.errors.root.message}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createTemplate.isPending || updateTemplate.isPending}>
                {createTemplate.isPending || updateTemplate.isPending
                  ? "Saving..."
                  : template
                    ? "Update Template"
                    : "Create Template"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>

      {/* Input Item Dialog */}
      <TransformationItemDialog
        open={inputDialogOpen}
        onOpenChange={(open) => {
          setInputDialogOpen(open);
          if (!open) setEditingInput(null);
        }}
        onSave={handleSaveInput}
        item={editingInput?.item}
        mode={editingInput ? "edit" : "add"}
        type="input"
      />

      {/* Output Item Dialog */}
      <TransformationItemDialog
        open={outputDialogOpen}
        onOpenChange={(open) => {
          setOutputDialogOpen(open);
          if (!open) setEditingOutput(null);
        }}
        onSave={handleSaveOutput}
        item={editingOutput?.item}
        mode={editingOutput ? "edit" : "add"}
        type="output"
      />
    </Dialog>
  );
}
