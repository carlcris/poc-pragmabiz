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
            <UserPlus className="h-4 w-4 mr-2" />
            Create New Customer
          </Button>

          {/* Customer List */}
          <div className="max-h-96 overflow-y-auto space-y-2">
            {isLoading ? (
              <>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-3 border rounded-lg">
                    <Skeleton className="h-5 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ))}
              </>
            ) : customers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No customers found</p>
                <p className="text-sm mt-1">Try a different search or create a new customer</p>
              </div>
            ) : (
              customers.map((customer) => (
                <button
                  key={customer.id}
                  onClick={() => handleSelect(customer)}
                  className="w-full text-left p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="font-medium">{customer.name}</div>
                  <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
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
                    <div className="text-xs text-gray-400 mt-1">
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
