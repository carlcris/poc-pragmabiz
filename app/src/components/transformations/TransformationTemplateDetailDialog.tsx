"use client";

import type { TransformationTemplate } from "@/types/transformation-template";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: TransformationTemplate;
};

export function TransformationTemplateDetailDialog({
  open,
  onOpenChange,
  template,
}: Props) {
  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{template.template_name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Template Code</p>
            <p className="font-medium">{template.template_code}</p>
          </div>

          {template.description && (
            <div>
              <p className="text-sm text-muted-foreground">Description</p>
              <p>{template.description}</p>
            </div>
          )}

          <div className="flex gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge className={template.is_active ? "bg-green-500" : "bg-gray-500"}>
                {template.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Usage Count</p>
              <p className="font-medium">{template.usage_count}</p>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Inputs</h3>
            <div className="space-y-2">
              {template.inputs?.map((input: any) => (
                <div key={input.id} className="flex justify-between items-center border p-3 rounded">
                  <div>
                    <p className="font-medium">
                      {input.items?.item_code} - {input.items?.item_name}
                    </p>
                    {input.notes && (
                      <p className="text-sm text-muted-foreground">{input.notes}</p>
                    )}
                  </div>
                  <span className="font-medium whitespace-nowrap ml-4">
                    {input.quantity} {input.uom?.code || input.uom?.name || ""}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Outputs</h3>
            <div className="space-y-2">
              {template.outputs?.map((output: any) => (
                <div key={output.id} className="flex justify-between items-center border p-3 rounded">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">
                        {output.items?.item_code} - {output.items?.item_name}
                      </p>
                      {output.is_scrap && (
                        <Badge variant="outline" className="text-xs">Scrap</Badge>
                      )}
                    </div>
                    {output.notes && (
                      <p className="text-sm text-muted-foreground">{output.notes}</p>
                    )}
                  </div>
                  <span className="font-medium whitespace-nowrap ml-4">
                    {output.quantity} {output.uom?.code || output.uom?.name || ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
