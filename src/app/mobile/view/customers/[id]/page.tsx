"use client";

import { use } from "react";
import { MobileHeader } from "@/components/mobile/MobileHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";
import { useCurrency } from "@/hooks/useCurrency";
import { User, MapPin, Phone, Mail, Globe, CreditCard, FileText } from "lucide-react";

interface Customer {
  id: string;
  code: string;
  name: string;
  customerType: string;
  email: string;
  phone: string;
  website?: string;
  taxId?: string;
  billingAddress: string;
  billingCity: string;
  billingState: string;
  billingPostalCode: string;
  billingCountry: string;
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingPostalCode: string;
  shippingCountry: string;
  contactPersonName?: string;
  contactPersonEmail?: string;
  contactPersonPhone?: string;
  paymentTerms: string;
  creditLimit: number;
  currentBalance: number;
  isActive: boolean;
}

export default function MobileCustomerDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { formatCurrency } = useCurrency();

  const { data: customer, isLoading } = useQuery<Customer>({
    queryKey: ["customer-details", id],
    queryFn: async () => {
      const response = await fetch(`/api/customers/${id}`);
      if (!response.ok) throw new Error("Failed to fetch customer");
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <MobileHeader title="Customer Details" showBack backHref="/mobile/view/customers" />
        <div className="space-y-4 p-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-gray-50">
        <MobileHeader title="Customer Details" showBack backHref="/mobile/view/customers" />
        <div className="p-4">
          <Card>
            <CardContent className="py-8">
              <div className="text-center">
                <User className="mx-auto mb-2 h-12 w-12 text-gray-300" />
                <p className="text-sm text-gray-500">Customer not found</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const billingAddress = [
    customer.billingAddress,
    customer.billingCity,
    customer.billingState,
    customer.billingPostalCode,
    customer.billingCountry,
  ]
    .filter(Boolean)
    .join(", ");

  const shippingAddress = [
    customer.shippingAddress,
    customer.shippingCity,
    customer.shippingState,
    customer.shippingPostalCode,
    customer.shippingCountry,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      <MobileHeader title="Customer Details" showBack backHref="/mobile/view/customers" />

      <div className="space-y-4 p-4">
        {/* Customer Header */}
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-start justify-between">
              <div className="flex-1">
                <div className="mb-1 text-lg font-bold">{customer.name}</div>
                <div className="text-sm text-gray-500">{customer.code}</div>
              </div>
              <Badge variant={customer.isActive ? "default" : "secondary"}>
                {customer.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {customer.customerType === "business" ? "Business" : "Individual"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-base">
              <Phone className="mr-2 h-4 w-4" />
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {customer.email && (
              <div className="flex items-center text-sm">
                <Mail className="mr-3 h-4 w-4 text-gray-400" />
                <a href={`mailto:${customer.email}`} className="text-blue-600">
                  {customer.email}
                </a>
              </div>
            )}
            {customer.phone && (
              <div className="flex items-center text-sm">
                <Phone className="mr-3 h-4 w-4 text-gray-400" />
                <a href={`tel:${customer.phone}`} className="text-blue-600">
                  {customer.phone}
                </a>
              </div>
            )}
            {customer.website && (
              <div className="flex items-center text-sm">
                <Globe className="mr-3 h-4 w-4 text-gray-400" />
                <a
                  href={customer.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600"
                >
                  {customer.website}
                </a>
              </div>
            )}
            {customer.taxId && (
              <div className="flex items-center text-sm">
                <FileText className="mr-3 h-4 w-4 text-gray-400" />
                <span className="text-gray-700">Tax ID: {customer.taxId}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contact Person */}
        {(customer.contactPersonName ||
          customer.contactPersonEmail ||
          customer.contactPersonPhone) && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-base">
                <User className="mr-2 h-4 w-4" />
                Contact Person
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {customer.contactPersonName && (
                <div className="text-sm font-medium">{customer.contactPersonName}</div>
              )}
              {customer.contactPersonEmail && (
                <div className="flex items-center text-sm text-gray-600">
                  <Mail className="mr-2 h-3.5 w-3.5 text-gray-400" />
                  {customer.contactPersonEmail}
                </div>
              )}
              {customer.contactPersonPhone && (
                <div className="flex items-center text-sm text-gray-600">
                  <Phone className="mr-2 h-3.5 w-3.5 text-gray-400" />
                  {customer.contactPersonPhone}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Addresses */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-base">
              <MapPin className="mr-2 h-4 w-4" />
              Addresses
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {billingAddress && (
              <div>
                <div className="mb-1 text-xs font-semibold text-gray-500">Billing Address</div>
                <div className="text-sm text-gray-700">{billingAddress}</div>
              </div>
            )}
            {shippingAddress && (
              <>
                <Separator />
                <div>
                  <div className="mb-1 text-xs font-semibold text-gray-500">Shipping Address</div>
                  <div className="text-sm text-gray-700">{shippingAddress}</div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Payment & Credit */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-base">
              <CreditCard className="mr-2 h-4 w-4" />
              Payment & Credit
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Payment Terms</span>
              <span className="text-sm font-medium capitalize">
                {customer.paymentTerms.replace("_", " ")}
              </span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Credit Limit</span>
              <span className="text-sm font-semibold">{formatCurrency(customer.creditLimit)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Current Balance</span>
              <span
                className={`text-sm font-semibold ${
                  customer.currentBalance > 0 ? "text-orange-600" : "text-green-600"
                }`}
              >
                {formatCurrency(customer.currentBalance)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
