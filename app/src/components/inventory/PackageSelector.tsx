'use client';

/**
 * Package Selector Component
 *
 * Reusable component for selecting item packages in transaction forms.
 * Shows package options with conversion factors and provides a preview
 * of the normalized quantity.
 */

import { useActivePackages } from '@/hooks/useItemPackages';
import { useState, useEffect } from 'react';

export type PackageSelectorProps = {
  itemId: string;
  value?: string | null; // Selected package ID
  onChange: (packageId: string | null) => void;
  quantity?: number; // Input quantity to show conversion preview
  disabled?: boolean;
  label?: string;
  error?: string;
  required?: boolean;
};

export function PackageSelector({
  itemId,
  value,
  onChange,
  quantity,
  disabled = false,
  label = 'Package',
  error,
  required = false,
}: PackageSelectorProps) {
  const { data: packages, isLoading } = useActivePackages(itemId);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(value || null);

  // Update selected package when value changes
  useEffect(() => {
    setSelectedPackage(value || null);
  }, [value]);

  // Find the selected package details
  const currentPackage = packages?.find((pkg) => pkg.id === selectedPackage);
  const basePackage = packages?.find((pkg) => pkg.isBasePackage);

  // Calculate normalized quantity for preview
  const normalizedQty =
    quantity && currentPackage ? quantity * currentPackage.qtyPerPack : null;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const packageId = e.target.value || null;
    setSelectedPackage(packageId);
    onChange(packageId);
  };

  if (isLoading) {
    return (
      <div className="space-y-1">
        {label && (
          <label className="block text-sm font-medium text-gray-700">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm text-gray-500">
          Loading packages...
        </div>
      </div>
    );
  }

  if (!packages || packages.length === 0) {
    return (
      <div className="space-y-1">
        {label && (
          <label className="block text-sm font-medium text-gray-700">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <div className="w-full px-3 py-2 border border-red-300 rounded-md bg-red-50 text-sm text-red-600">
          No packages configured for this item
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <select
        value={selectedPackage || ''}
        onChange={handleChange}
        disabled={disabled}
        required={required}
        className={`
          w-full px-3 py-2 border rounded-md shadow-sm text-sm
          focus:outline-none focus:ring-2 focus:ring-blue-500
          disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed
          ${error ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'}
        `}
      >
        <option value="">Select package...</option>
        {packages.map((pkg) => (
          <option key={pkg.id} value={pkg.id}>
            {pkg.packName}
            {pkg.qtyPerPack !== 1 && ` (1 = ${pkg.qtyPerPack} ${basePackage?.packName || 'units'})`}
            {pkg.isBasePackage && ' [Base]'}
          </option>
        ))}
      </select>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {/* Conversion preview */}
      {quantity && currentPackage && normalizedQty !== null && !currentPackage.isBasePackage && (
        <div className="text-xs text-gray-600 bg-blue-50 border border-blue-200 rounded px-2 py-1 mt-1">
          <span className="font-medium">Conversion:</span>{' '}
          {quantity} {currentPackage.packName} = {normalizedQty.toFixed(4)}{' '}
          {basePackage?.packName || 'base units'}
        </div>
      )}
    </div>
  );
}

/**
 * Compact Package Selector (for inline use in tables)
 */
export function CompactPackageSelector({
  itemId,
  value,
  onChange,
  disabled = false,
}: Omit<PackageSelectorProps, 'label' | 'error' | 'required' | 'quantity'>) {
  const { data: packages, isLoading } = useActivePackages(itemId);

  if (isLoading || !packages || packages.length === 0) {
    return (
      <select disabled className="w-full px-2 py-1 text-sm border border-gray-300 rounded bg-gray-50">
        <option>-</option>
      </select>
    );
  }

  // Find the default package (base package or the one marked as default)
  const defaultPackage = packages.find((pkg) => pkg.isDefault) || packages.find((pkg) => pkg.isBasePackage);
  const defaultLabel = defaultPackage ? defaultPackage.packName : 'Default';

  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value || null)}
      disabled={disabled}
      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
    >
      <option value="">{defaultLabel}</option>
      {packages.map((pkg) => (
        <option key={pkg.id} value={pkg.id}>
          {pkg.packName}
          {pkg.isBasePackage && ' [Base]'}
        </option>
      ))}
    </select>
  );
}
