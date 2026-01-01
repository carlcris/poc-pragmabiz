"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useCreateCustomer } from "@/hooks/useCustomers";
import { toast } from "sonner";

interface QuickCustomerFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCustomerCreated: (customer: any) => void;
}

export function QuickCustomerForm({
  open,
  onOpenChange,
  onCustomerCreated,
}: QuickCustomerFormProps) {
  const createCustomer = useCreateCustomer();
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    city: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.phone) {
      toast.error("Please fill in name and phone");
      return;
    }

    try {
      const customerData = {
        customerType: "individual" as const,
        code: `CUST-${Date.now()}`, // Auto-generate code
        name: formData.name,
        email: formData.email || "",
        phone: formData.phone,
        mobile: formData.phone,
        billingAddress: formData.address || "",
        billingCity: formData.city || "",
        billingState: "",
        billingPostalCode: "",
        billingCountry: "Philippines",
        shippingAddress: formData.address || "",
        shippingCity: formData.city || "",
        shippingState: "",
        shippingPostalCode: "",
        shippingCountry: "Philippines",
        paymentTerms: "cod" as const,
        creditLimit: 0,
        notes: "Created via mobile van sales",
        isActive: true,
      };

      const result = await createCustomer.mutateAsync(customerData as any);

      toast.success("Customer created successfully");
      onCustomerCreated(result);
      onOpenChange(false);

      // Reset form
      setFormData({
        name: "",
        phone: "",
        email: "",
        address: "",
        city: "",
      });
    } catch (error) {

      toast.error("Failed to create customer");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Quick Add Customer</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter customer name"
              required
            />
          </div>

          <div>
            <Label htmlFor="phone">Phone *</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="09123456789"
              required
            />
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="customer@example.com"
            />
          </div>

          <div>
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Street address"
            />
          </div>

          <div>
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              placeholder="City"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={createCustomer.isPending}
            >
              {createCustomer.isPending ? "Creating..." : "Create Customer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
