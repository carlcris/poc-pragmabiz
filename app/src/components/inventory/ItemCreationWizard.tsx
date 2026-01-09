'use client';

/**
 * Item Creation Wizard
 *
 * Multi-step wizard for creating items with packages.
 * Uses the create_item_with_packages() database function for atomic creation.
 */

import { useState } from 'react';
import { useCreateItemWithPackages, type CreateItemWithPackagesInput } from '@/hooks/useCreateItemWithPackages';
import { useRouter } from 'next/navigation';

type WizardStep = 'basic' | 'base-package' | 'additional-packages' | 'review';

type ItemCreationWizardProps = {
  onSuccess?: (itemId: string) => void;
  onCancel?: () => void;
};

export function ItemCreationWizard({ onSuccess, onCancel }: ItemCreationWizardProps) {
  const router = useRouter();
  const createItem = useCreateItemWithPackages();

  const [currentStep, setCurrentStep] = useState<WizardStep>('basic');
  const [formData, setFormData] = useState<CreateItemWithPackagesInput>({
    itemCode: '',
    itemName: '',
    itemNameCn: '',
    itemDescription: '',
    itemType: 'finished_good',
    basePackage: {
      packName: '',
      packType: 'base',
    },
    standardCost: 0,
    listPrice: 0,
    additionalPackages: [],
  });

  const steps: Array<{ id: WizardStep; title: string; description: string }> = [
    { id: 'basic', title: 'Basic Information', description: 'Item details' },
    { id: 'base-package', title: 'Base Package', description: 'Storage unit' },
    { id: 'additional-packages', title: 'Additional Packages', description: 'Optional' },
    { id: 'review', title: 'Review', description: 'Confirm details' },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  const canGoNext = () => {
    switch (currentStep) {
      case 'basic':
        return formData.itemCode && formData.itemName;
      case 'base-package':
        return formData.basePackage.packName;
      case 'additional-packages':
        return true; // Optional step
      case 'review':
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStep(steps[currentStepIndex + 1].id);
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStep(steps[currentStepIndex - 1].id);
    }
  };

  const handleSubmit = async () => {
    try {
      const result = await createItem.mutateAsync(formData);

      if (onSuccess) {
        onSuccess(result.item.id);
      } else {
        router.push(`/items/${result.item.id}`);
      }
    } catch (error) {
      console.error('Failed to create item:', error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium
                    ${
                      index === currentStepIndex
                        ? 'bg-blue-600 text-white'
                        : index < currentStepIndex
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }
                  `}
                >
                  {index < currentStepIndex ? '✓' : index + 1}
                </div>
                <div className="mt-2 text-center">
                  <div className="text-sm font-medium text-gray-900">{step.title}</div>
                  <div className="text-xs text-gray-500">{step.description}</div>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`h-1 flex-1 mx-4 ${
                    index < currentStepIndex ? 'bg-green-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {currentStep === 'basic' && (
          <BasicInfoStep formData={formData} setFormData={setFormData} />
        )}

        {currentStep === 'base-package' && (
          <BasePackageStep formData={formData} setFormData={setFormData} />
        )}

        {currentStep === 'additional-packages' && (
          <AdditionalPackagesStep formData={formData} setFormData={setFormData} />
        )}

        {currentStep === 'review' && <ReviewStep formData={formData} />}

        {/* Error Display */}
        {createItem.isError && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">
              Failed to create item. Please try again.
            </p>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="mt-6 flex justify-between">
        <button
          onClick={onCancel || (() => router.back())}
          className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Cancel
        </button>

        <div className="flex gap-3">
          {currentStepIndex > 0 && (
            <button
              onClick={handleBack}
              disabled={createItem.isPending}
              className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Back
            </button>
          )}

          {currentStepIndex < steps.length - 1 ? (
            <button
              onClick={handleNext}
              disabled={!canGoNext()}
              className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!canGoNext() || createItem.isPending}
              className="px-4 py-2 text-sm text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {createItem.isPending ? 'Creating...' : 'Create Item'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Step Components

function BasicInfoStep({
  formData,
  setFormData,
}: {
  formData: CreateItemWithPackagesInput;
  setFormData: (data: CreateItemWithPackagesInput) => void;
}) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-gray-900">Basic Item Information</h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Item Code <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.itemCode}
            onChange={(e) => setFormData({ ...formData, itemCode: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., ITM-001"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Item Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.itemName}
            onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., Widget A"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Chinese Name
        </label>
        <input
          type="text"
          value={formData.itemNameCn}
          onChange={(e) => setFormData({ ...formData, itemNameCn: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Optional Chinese name"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          value={formData.itemDescription}
          onChange={(e) => setFormData({ ...formData, itemDescription: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Optional description"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Item Type
          </label>
          <select
            value={formData.itemType}
            onChange={(e) => setFormData({ ...formData, itemType: e.target.value as any })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="finished_good">Finished Good</option>
            <option value="raw_material">Raw Material</option>
            <option value="asset">Asset</option>
            <option value="service">Service</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Standard Cost
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={formData.standardCost}
            onChange={(e) =>
              setFormData({ ...formData, standardCost: parseFloat(e.target.value) || 0 })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            List Price
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={formData.listPrice}
            onChange={(e) =>
              setFormData({ ...formData, listPrice: parseFloat(e.target.value) || 0 })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>
  );
}

function BasePackageStep({
  formData,
  setFormData,
}: {
  formData: CreateItemWithPackagesInput;
  setFormData: (data: CreateItemWithPackagesInput) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900">Base Storage Package</h3>
        <p className="mt-1 text-sm text-gray-500">
          This defines the base unit for storing inventory. All quantities will be converted to this unit.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <p className="text-sm text-blue-800">
          <strong>Important:</strong> The base package always has a conversion factor of 1.0.
          All other packages will be defined relative to this unit.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Package Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.basePackage.packName}
            onChange={(e) =>
              setFormData({
                ...formData,
                basePackage: { ...formData.basePackage, packName: e.target.value },
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., Piece, Kilogram, Liter"
          />
          <p className="mt-1 text-xs text-gray-500">
            Examples: Piece, Each, Kilogram, Meter, Liter
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Package Type
          </label>
          <input
            type="text"
            value={formData.basePackage.packType || 'base'}
            onChange={(e) =>
              setFormData({
                ...formData,
                basePackage: { ...formData.basePackage, packType: e.target.value },
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="base"
          />
          <p className="mt-1 text-xs text-gray-500">
            Usually "base" - this identifies it as the base storage unit
          </p>
        </div>
      </div>
    </div>
  );
}

function AdditionalPackagesStep({
  formData,
  setFormData,
}: {
  formData: CreateItemWithPackagesInput;
  setFormData: (data: CreateItemWithPackagesInput) => void;
}) {
  const addPackage = () => {
    setFormData({
      ...formData,
      additionalPackages: [
        ...(formData.additionalPackages || []),
        {
          packType: '',
          packName: '',
          qtyPerPack: 1,
          isActive: true,
        },
      ],
    });
  };

  const removePackage = (index: number) => {
    const packages = [...(formData.additionalPackages || [])];
    packages.splice(index, 1);
    setFormData({ ...formData, additionalPackages: packages });
  };

  const updatePackage = (index: number, updates: any) => {
    const packages = [...(formData.additionalPackages || [])];
    packages[index] = { ...packages[index], ...updates };
    setFormData({ ...formData, additionalPackages: packages });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900">Additional Packages (Optional)</h3>
        <p className="mt-1 text-sm text-gray-500">
          Add other ways this item can be packaged. For example: boxes, cartons, pallets.
        </p>
      </div>

      <div className="space-y-4">
        {formData.additionalPackages && formData.additionalPackages.length > 0 ? (
          formData.additionalPackages.map((pkg, index) => (
            <div key={index} className="p-4 bg-gray-50 border border-gray-200 rounded-md">
              <div className="flex items-start justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-900">Package {index + 1}</h4>
                <button
                  onClick={() => removePackage(index)}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  Remove
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Type <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={pkg.packType}
                    onChange={(e) => updatePackage(index, { packType: e.target.value })}
                    placeholder="e.g., box"
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={pkg.packName}
                    onChange={(e) => updatePackage(index, { packName: e.target.value })}
                    placeholder="e.g., Box of 12"
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Qty per Pack <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    step="0.0001"
                    min="0.0001"
                    value={pkg.qtyPerPack}
                    onChange={(e) =>
                      updatePackage(index, { qtyPerPack: parseFloat(e.target.value) || 1 })
                    }
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
                  />
                </div>
              </div>

              {formData.basePackage.packName && pkg.qtyPerPack && (
                <p className="mt-2 text-xs text-gray-600">
                  1 {pkg.packName || 'pack'} = {pkg.qtyPerPack} {formData.basePackage.packName}
                </p>
              )}
            </div>
          ))
        ) : (
          <div className="text-center py-8 bg-gray-50 border border-gray-200 rounded-md">
            <p className="text-sm text-gray-500">No additional packages added yet.</p>
          </div>
        )}
      </div>

      <button
        onClick={addPackage}
        className="w-full px-4 py-2 text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100"
      >
        + Add Package
      </button>
    </div>
  );
}

function ReviewStep({ formData }: { formData: CreateItemWithPackagesInput }) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-gray-900">Review & Confirm</h3>

      <div className="space-y-4">
        {/* Basic Info */}
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Basic Information</h4>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-gray-600">Item Code:</dt>
            <dd className="font-medium">{formData.itemCode}</dd>
            <dt className="text-gray-600">Item Name:</dt>
            <dd className="font-medium">{formData.itemName}</dd>
            {formData.itemNameCn ? (
              <>
                <dt className="text-gray-600">Chinese Name:</dt>
                <dd className="font-medium">{formData.itemNameCn}</dd>
              </>
            ) : null}
            <dt className="text-gray-600">Item Type:</dt>
            <dd className="font-medium capitalize">{formData.itemType?.replace('_', ' ')}</dd>
            <dt className="text-gray-600">Standard Cost:</dt>
            <dd className="font-medium">${formData.standardCost?.toFixed(2) || '0.00'}</dd>
            <dt className="text-gray-600">List Price:</dt>
            <dd className="font-medium">${formData.listPrice?.toFixed(2) || '0.00'}</dd>
          </dl>
        </div>

        {/* Base Package */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
          <h4 className="text-sm font-medium text-gray-900 mb-3">
            Base Package (Storage Unit)
          </h4>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-gray-600">Package Name:</dt>
            <dd className="font-medium">{formData.basePackage.packName}</dd>
            <dt className="text-gray-600">Package Type:</dt>
            <dd className="font-medium">{formData.basePackage.packType || 'base'}</dd>
            <dt className="text-gray-600">Conversion Factor:</dt>
            <dd className="font-medium">1.0 (base unit)</dd>
          </dl>
        </div>

        {/* Additional Packages */}
        {formData.additionalPackages && formData.additionalPackages.length > 0 && (
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
            <h4 className="text-sm font-medium text-gray-900 mb-3">
              Additional Packages ({formData.additionalPackages.length})
            </h4>
            <div className="space-y-2">
              {formData.additionalPackages.map((pkg, index) => (
                <div key={index} className="text-sm p-2 bg-white border border-gray-200 rounded">
                  <div className="font-medium">{pkg.packName}</div>
                  <div className="text-gray-600 text-xs">
                    1 {pkg.packName} = {pkg.qtyPerPack} {formData.basePackage.packName}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
