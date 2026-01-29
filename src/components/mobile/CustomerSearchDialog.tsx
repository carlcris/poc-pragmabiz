"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, UserPlus, Phone, Mail } from "lucide-react";
import { useCustomers } from "@/hooks/useCustomers";
import { Customer } from "@/types/customer";

interface CustomerSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectCustomer: (customer: Customer) => void;
  onCreateNew: () => void;
}

export function CustomerSearchDialog({
  open,
  onOpenChange,
  onSelectCustomer,
  onCreateNew,
}: CustomerSearchDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const { data: customersData, isLoading } = useCustomers({ search: searchTerm, isActive: true });

  const customers = customersData?.data || [];

  const handleSelect = (customer: Customer) => {
    onSelectCustomer(customer);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Select Customer</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by name, phone, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Create New Customer Button */}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              onCreateNew();
              onOpenChange(false);
            }}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Create New Customer
          </Button>

          {/* Customer List */}
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {isLoading ? (
              <>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="rounded-lg border p-3">
                    <Skeleton className="mb-2 h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ))}
              </>
            ) : customers.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                <p>No customers found</p>
                <p className="mt-1 text-sm">Try a different search or create a new customer</p>
              </div>
            ) : (
              customers.map((customer) => (
                <button
                  key={customer.id}
                  onClick={() => handleSelect(customer)}
                  className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-gray-50"
                >
                  <div className="font-medium">{customer.name}</div>
                  <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
                    {customer.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {customer.phone}
                      </span>
                    )}
                    {customer.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {customer.email}
                      </span>
                    )}
                  </div>
                  {customer.billingCity && (
                    <div className="mt-1 text-xs text-gray-400">
                      {customer.billingCity}, {customer.billingState}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
