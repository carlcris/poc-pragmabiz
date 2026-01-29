"use client";

/**
 * Item Package Manager Component
 *
 * Comprehensive UI for managing all packages for an item.
 * Used in the item details/edit page.
 */

import { useState } from "react";
import {
  useItemPackages,
  useCreateItemPackage,
  useUpdateItemPackage,
  useDeleteItemPackage,
  type ItemPackage,
  type CreatePackageInput,
} from "@/hooks/useItemPackages";
import { Input } from "@/components/ui/input";

type ItemPackageManagerProps = {
  itemId: string;
  itemCode?: string;
  itemName?: string;
};

export function ItemPackageManager({ itemId, itemCode, itemName }: ItemPackageManagerProps) {
  const { data: packages, isLoading } = useItemPackages(itemId);
  const deletePackage = useDeleteItemPackage(itemId);

  const [isAddingPackage, setIsAddingPackage] = useState(false);
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);

  if (isLoading) {
    return <div className="p-4 text-center text-gray-500">Loading packages...</div>;
  }

  const basePackage = packages?.find((pkg) => pkg.isBasePackage);
  const otherPackages = packages?.filter((pkg) => !pkg.isBasePackage) || [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Item Packages</h3>
          <p className="text-sm text-gray-500">
            Manage how this item can be packaged and transacted
          </p>
          {(itemName || itemCode) && (
            <p className="mt-1 text-xs text-gray-400">
              {itemName || "Item"}
              {itemCode ? ` • ${itemCode}` : ""}
            </p>
          )}
        </div>
        <button
          onClick={() => setIsAddingPackage(true)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Add Package
        </button>
      </div>

      {/* Base Package (read-only, always shown) */}
      {basePackage && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="rounded bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700">
                  BASE PACKAGE
                </span>
                {basePackage.isDefault && (
                  <span className="rounded bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">
                    DEFAULT
                  </span>
                )}
              </div>
              <h4 className="mt-2 text-base font-medium text-gray-900">{basePackage.packName}</h4>
              <div className="mt-1 space-y-1 text-sm text-gray-600">
                <p>
                  <span className="font-medium">Type:</span> {basePackage.packType}
                </p>
                <p>
                  <span className="font-medium">Quantity per pack:</span> {basePackage.qtyPerPack}{" "}
                  (must be 1.0 for base)
                </p>
                {basePackage.uom && (
                  <p>
                    <span className="font-medium">Unit:</span> {basePackage.uom.name} (
                    {basePackage.uom.code})
                  </p>
                )}
                {basePackage.barcode && (
                  <p>
                    <span className="font-medium">Barcode:</span> {basePackage.barcode}
                  </p>
                )}
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs text-blue-600">
            ℹ️ This is the base storage unit. All inventory is stored in this unit. It cannot be
            deleted.
          </p>
        </div>
      )}

      {/* Other Packages */}
      <div className="space-y-3">
        {otherPackages.length === 0 && !isAddingPackage ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 py-8 text-center">
            <p className="text-sm text-gray-500">No additional packages configured.</p>
            <p className="mt-1 text-xs text-gray-400">
              Add packages to allow transactions in different units (e.g., boxes, cartons, pallets)
            </p>
          </div>
        ) : (
          otherPackages.map((pkg) => (
            <PackageCard
              key={pkg.id}
              package={pkg}
              basePackage={basePackage}
              isEditing={editingPackageId === pkg.id}
              onEdit={() => setEditingPackageId(pkg.id)}
              onCancelEdit={() => setEditingPackageId(null)}
              onDelete={() => {
                if (confirm(`Delete package "${pkg.packName}"?`)) {
                  deletePackage.mutate(pkg.id);
                }
              }}
              itemId={itemId}
            />
          ))
        )}

        {/* Add Package Form */}
        {isAddingPackage && (
          <PackageForm
            itemId={itemId}
            basePackage={basePackage}
            onCancel={() => setIsAddingPackage(false)}
            onSave={() => setIsAddingPackage(false)}
          />
        )}
      </div>
    </div>
  );
}

type PackageCardProps = {
  package: ItemPackage;
  basePackage?: ItemPackage;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  itemId: string;
};

function PackageCard({
  package: pkg,
  basePackage,
  isEditing,
  onEdit,
  onCancelEdit,
  onDelete,
  itemId,
}: PackageCardProps) {
  if (isEditing) {
    return (
      <PackageForm
        itemId={itemId}
        packageId={pkg.id}
        initialData={pkg}
        basePackage={basePackage}
        onCancel={onCancelEdit}
        onSave={onCancelEdit}
      />
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-gray-300">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {pkg.isDefault && (
              <span className="rounded bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">
                DEFAULT
              </span>
            )}
            {!pkg.isActive && (
              <span className="rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-500">
                INACTIVE
              </span>
            )}
          </div>
          <h4 className="mt-2 text-base font-medium text-gray-900">{pkg.packName}</h4>
          <div className="mt-1 space-y-1 text-sm text-gray-600">
            <p>
              <span className="font-medium">Type:</span> {pkg.packType}
            </p>
            <p>
              <span className="font-medium">Conversion:</span> 1 {pkg.packName} = {pkg.qtyPerPack}{" "}
              {basePackage?.packName || "base units"}
            </p>
            {pkg.uom && (
              <p>
                <span className="font-medium">Unit:</span> {pkg.uom.name}
              </p>
            )}
            {pkg.barcode && (
              <p>
                <span className="font-medium">Barcode:</span> {pkg.barcode}
              </p>
            )}
          </div>
        </div>
        <div className="ml-4 flex gap-2">
          <button
            onClick={onEdit}
            className="rounded px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 hover:text-blue-700"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="rounded px-3 py-1 text-sm text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

type PackageFormProps = {
  itemId: string;
  packageId?: string;
  initialData?: ItemPackage;
  basePackage?: ItemPackage;
  onCancel: () => void;
  onSave: () => void;
};

function PackageForm({
  itemId,
  packageId,
  initialData,
  basePackage,
  onCancel,
  onSave,
}: PackageFormProps) {
  const createPackage = useCreateItemPackage(itemId);
  const updatePackage = useUpdateItemPackage(itemId, packageId || "");

  const [formData, setFormData] = useState<CreatePackageInput>({
    packType: initialData?.packType || "",
    packName: initialData?.packName || "",
    qtyPerPack: initialData?.qtyPerPack || 1,
    uomId: initialData?.uomId,
    barcode: initialData?.barcode,
    isDefault: initialData?.isDefault || false,
    isActive: initialData?.isActive !== false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (packageId) {
        await updatePackage.mutateAsync(formData);
      } else {
        await createPackage.mutateAsync(formData);
      }
      onSave();
    } catch (error) {
      console.error("Failed to save package:", error);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-gray-300 bg-gray-50 p-4"
    >
      <h4 className="text-sm font-medium text-gray-900">
        {packageId ? "Edit Package" : "Add New Package"}
      </h4>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Package Type <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.packType}
            onChange={(e) => setFormData({ ...formData, packType: e.target.value })}
            placeholder="e.g., box, carton, pallet"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Package Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.packName}
            onChange={(e) => setFormData({ ...formData, packName: e.target.value })}
            placeholder="e.g., Box of 12"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Quantity per Pack <span className="text-red-500">*</span>
          </label>
          <Input
            type="number"
            required
            step="0.0001"
            min="0.0001"
            value={formData.qtyPerPack}
            onChange={(e) => setFormData({ ...formData, qtyPerPack: parseFloat(e.target.value) })}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {basePackage && formData.qtyPerPack && (
            <p className="mt-1 text-xs text-gray-500">
              1 pack = {formData.qtyPerPack} {basePackage.packName}
            </p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Barcode</label>
          <input
            type="text"
            value={formData.barcode || ""}
            onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
            placeholder="Optional"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={formData.isDefault || false}
            onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Set as default package
        </label>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={formData.isActive !== false}
            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Active
        </label>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={createPackage.isPending || updatePackage.isPending}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {createPackage.isPending || updatePackage.isPending ? "Saving..." : "Save Package"}
        </button>
      </div>
    </form>
  );
}
