"use client";

import { useState } from "react";
import { MobileHeader } from "@/components/mobile/MobileHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { User, MapPin, Phone, Search, ChevronRight } from "lucide-react";
import Link from "next/link";

interface Customer {
  id: string;
  name: string;
  phone: string;
  billingCity: string;
  billingState: string;
}

export default function MobileCustomersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<string>("true"); // Default to active customers

  const { data, isLoading } = useQuery({
    queryKey: ["mobile-customers", searchQuery, filter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) {
        params.set("search", searchQuery);
      }
      if (filter !== "all") {
        params.set("isActive", filter);
      }
      params.set("limit", "100");

      const response = await fetch(`/api/customers?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch customers");
      return response.json();
    },
  });

  const customers: Customer[] = data?.data || [];

  const filters = [
    { label: "All", value: "all" },
    { label: "Active", value: "true" },
    { label: "Inactive", value: "false" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileHeader title="Customers" showBack backHref="/mobile/view" />

      {/* Search Bar */}
      <div className="sticky top-0 z-10 space-y-3 border-b bg-white p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search customers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Filters */}
        <div className="scrollbar-hide flex gap-2 overflow-x-auto">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                filter === f.value
                  ? "bg-primary text-white"
                  : "bg-gray-100 text-gray-700 active:bg-gray-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Customer List */}
      <div className="space-y-3 p-4">
        {isLoading ? (
          <>
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="mb-2 h-5 w-48" />
                  <Skeleton className="mb-2 h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : customers.length === 0 ? (
          <div className="py-12 text-center">
            <User className="mx-auto mb-3 h-12 w-12 text-gray-300" />
            <p className="text-gray-500">No customers found</p>
          </div>
        ) : (
          customers.map((customer) => (
            <Link key={customer.id} href={`/mobile/view/customers/${customer.id}`}>
              <Card className="active:scale-98 cursor-pointer transition-shadow hover:shadow-md">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-2 text-base font-semibold">{customer.name}</div>

                      {customer.phone && (
                        <div className="mb-1 flex items-center text-sm text-gray-600">
                          <Phone className="mr-2 h-3.5 w-3.5 text-gray-400" />
                          {customer.phone}
                        </div>
                      )}

                      {(customer.billingCity || customer.billingState) && (
                        <div className="flex items-center text-sm text-gray-600">
                          <MapPin className="mr-2 h-3.5 w-3.5 text-gray-400" />
                          {[customer.billingCity, customer.billingState].filter(Boolean).join(", ")}
                        </div>
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 flex-shrink-0 text-gray-400" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
