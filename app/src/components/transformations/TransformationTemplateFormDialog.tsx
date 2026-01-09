"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Pencil } from "lucide-react";
import {
  useCreateTransformationTemplate,
  useUpdateTransformationTemplate,
} from "@/hooks/useTransformationTemplates";
import type { TransformationTemplate } from "@/types/transformation-template";
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
});

type TemplateFormValues = z.infer<typeof templateFormSchema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: TransformationTemplate;
};

export function TransformationTemplateFormDialog({
  open,
  onOpenChange,
  template,
}: Props) {
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

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      companyId: companyId || "",
      templateCode: "",
      templateName: "",
      description: "",
    },
  });

  useEffect(() => {
    if (template) {
      form.reset({
        companyId: template.company_id,
        templateCode: template.template_code,
        templateName: template.template_name,
        description: template.description || "",
      });
      // Note: Can't edit inputs/outputs if template is locked
    } else if (!open) {
      // Reset when closing dialog
      form.reset({
        companyId: companyId || "",
        templateCode: "",
        templateName: "",
        description: "",
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
      // Validate inputs
      if (inputs.length === 0) {
        form.setError("root", {
          type: "manual",
          message: "Please add at least one input item",
        });
        return;
      }

      // Validate outputs
      if (outputs.length === 0) {
        form.setError("root", {
          type: "manual",
          message: "Please add at least one output item",
        });
        return;
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

      const payload = {
        companyId: finalCompanyId,
        templateCode: data.templateCode,
        templateName: data.templateName,
        description: data.description,
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
        // Update only name and description (inputs/outputs locked if used)
        await updateTemplate.mutateAsync({
          id: template.id,
          data: {
            templateName: data.templateName,
            description: data.description,
          },
        });
      } else {
        await createTemplate.mutateAsync(payload);
      }

      onOpenChange(false);
      form.reset();
      setInputs([]);
      setOutputs([]);
    } catch (error: any) {

      const errorMessage =
        error?.cause?.error ||
        error?.cause?.details?.[0]?.message ||
        error.message ||
        "Failed to save template. Please try again.";
      form.setError("root", {
        type: "manual",
        message: errorMessage,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {template ? "Edit Template" : "Create Transformation Template"}
          </DialogTitle>
          <DialogDescription>
            {template
              ? "Update template name and description only (inputs/outputs locked if used)"
              : "Define a reusable transformation recipe with inputs and outputs"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="templateCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Template Code *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., BREAD-001"
                        disabled={!!template}
                      />
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
                    <Textarea
                      {...field}
                      placeholder="Optional description..."
                      rows={2}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!template && (
              <>
                {/* Inputs Table */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Input Materials</h3>
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
                    <div className="text-sm text-muted-foreground border rounded-md p-8 text-center">
                      No input materials added yet. Click "Add Input" to get started.
                    </div>
                  ) : (
                    <div className="border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Item Code</TableHead>
                            <TableHead>Item Name</TableHead>
                            <TableHead className="text-right">Quantity</TableHead>
                            <TableHead>UOM</TableHead>
                            <TableHead className="w-[100px]">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {inputs.map((input, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">{input.itemCode}</TableCell>
                              <TableCell>{input.itemName}</TableCell>
                              <TableCell className="text-right">{input.quantity}</TableCell>
                              <TableCell>{input.uom}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditInput(index)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveInput(index)}
                                  >
                                    <Trash2 className="h-4 w-4 text-red-500" />
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

                {/* Outputs Table */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Output Products</h3>
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
                    <div className="text-sm text-muted-foreground border rounded-md p-8 text-center">
                      No output products added yet. Click "Add Output" to get started.
                    </div>
                  ) : (
                    <div className="border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Item Code</TableHead>
                            <TableHead>Item Name</TableHead>
                            <TableHead className="text-right">Quantity</TableHead>
                            <TableHead>UOM</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead className="w-[100px]">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {outputs.map((output, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">{output.itemCode}</TableCell>
                              <TableCell>{output.itemName}</TableCell>
                              <TableCell className="text-right">{output.quantity}</TableCell>
                              <TableCell>{output.uom}</TableCell>
                              <TableCell>
                                {output.isScrap ? (
                                  <span className="text-sm text-muted-foreground">Scrap</span>
                                ) : (
                                  <span className="text-sm">Product</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditOutput(index)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveOutput(index)}
                                  >
                                    <Trash2 className="h-4 w-4 text-red-500" />
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
              <p className="text-sm text-red-500">
                {form.formState.errors.root.message}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createTemplate.isPending || updateTemplate.isPending}
              >
                {template ? "Update Template" : "Create Template"}
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
