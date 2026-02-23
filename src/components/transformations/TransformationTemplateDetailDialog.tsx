"use client";

import { useState } from "react";
import type { TransformationTemplateApi } from "@/types/transformation-template";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: TransformationTemplateApi;
};

export function TransformationTemplateDetailDialog({ open, onOpenChange, template }: Props) {
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  if (!template) return null;

  const inputs = template.inputs ?? [];
  const outputs = template.outputs ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template.template_name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4 rounded-lg border bg-card p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Template Code
                  </p>
                  <p className="mt-1 font-medium">{template.template_code}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                  <div className="mt-1">
                    <Badge className={template.is_active ? "bg-green-500" : "bg-gray-500"}>
                      {template.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Usage Count
                  </p>
                  <p className="mt-1 font-medium">{template.usage_count}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Materials
                  </p>
                  <p className="mt-1 font-medium">
                    {inputs.length} input{inputs.length !== 1 ? "s" : ""} / {outputs.length} output
                    {outputs.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Description</p>
                <p className="mt-1 min-h-10 text-sm">
                  {template.description?.trim() || "No description provided"}
                </p>
              </div>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <p className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">
                Template Image
              </p>
              {template.image_url ? (
                <button
                  type="button"
                  className="block w-full overflow-hidden rounded-md border bg-muted/30 text-left transition hover:opacity-95"
                  onClick={() => setImagePreviewOpen(true)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={template.image_url}
                    alt={`${template.template_name} template`}
                    className="h-64 w-full object-contain bg-white"
                  />
                </button>
              ) : (
                <div className="flex h-64 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                  No image uploaded
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold">Input Materials</h3>
            <div className="space-y-2">
              {inputs.length === 0 && (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  No input materials configured.
                </div>
              )}
              {inputs.map((input) => (
                <div
                  key={input.id}
                  className="flex items-start justify-between gap-4 rounded-lg border bg-card p-3"
                >
                  <div>
                    <p className="font-medium leading-tight">
                      {input.items?.item_code}{" "}
                      <span className="text-muted-foreground">•</span> {input.items?.item_name}
                    </p>
                    {input.notes && <p className="text-sm text-muted-foreground">{input.notes}</p>}
                  </div>
                  <span className="whitespace-nowrap font-medium">
                    {input.quantity}{" "}
                    {input.uom?.uom_name || input.uom?.name || input.uom?.code || ""}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold">Output Products</h3>
            <div className="space-y-2">
              {outputs.length === 0 && (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  No output products configured.
                </div>
              )}
              {outputs.map((output) => (
                <div
                  key={output.id}
                  className="flex items-start justify-between gap-4 rounded-lg border bg-card p-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium leading-tight">
                        {output.items?.item_code}{" "}
                        <span className="text-muted-foreground">•</span> {output.items?.item_name}
                      </p>
                      {output.is_scrap && (
                        <Badge variant="outline" className="text-xs">
                          Scrap
                        </Badge>
                      )}
                    </div>
                    {output.notes && (
                        <p className="text-sm text-muted-foreground">{output.notes}</p>
                      )}
                    </div>
                  <span className="whitespace-nowrap font-medium">
                    {output.quantity}{" "}
                    {output.uom?.uom_name || output.uom?.name || output.uom?.code || ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>

      {template.image_url && (
        <Dialog open={imagePreviewOpen} onOpenChange={setImagePreviewOpen}>
          <DialogContent className="max-h-[92vh] max-w-6xl overflow-hidden p-4">
            <DialogHeader>
              <DialogTitle>{template.template_name} Image Preview</DialogTitle>
            </DialogHeader>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={template.image_url}
              alt={`${template.template_name} full preview`}
              className="mx-auto max-h-[75vh] w-auto max-w-full object-contain bg-white"
            />
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}
