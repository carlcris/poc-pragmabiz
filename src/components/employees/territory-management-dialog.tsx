"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  useEmployeeTerritories,
  useAddEmployeeTerritory,
  useRemoveEmployeeTerritory,
  useUpdateEmployeeTerritory,
} from "@/hooks/useEmployees";
import { toast } from "sonner";
import type { Employee } from "@/types/employee";

const territoryFormSchema = z.object({
  city: z.string().min(1, "City is required"),
  regionState: z.string().min(1, "Region/State is required"),
  isPrimary: z.boolean().default(false),
});

type TerritoryFormInput = z.input<typeof territoryFormSchema>;
type TerritoryFormValues = z.output<typeof territoryFormSchema>;

interface TerritoryManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee;
}

// List of Philippines regions and major cities in Mindanao
const PHILIPPINES_REGIONS = [
  "Davao del Sur",
  "Davao del Norte",
  "Davao Oriental",
  "Davao de Oro",
  "Davao Occidental",
  "South Cotabato",
  "Sultan Kudarat",
  "Sarangani",
  "North Cotabato",
  "Maguindanao",
  "Lanao del Sur",
  "Basilan",
  "Sulu",
  "Tawi-Tawi",
  "Zamboanga del Norte",
  "Zamboanga del Sur",
  "Zamboanga Sibugay",
  "Bukidnon",
  "Camiguin",
  "Lanao del Norte",
  "Misamis Occidental",
  "Misamis Oriental",
  "Agusan del Norte",
  "Agusan del Sur",
  "Dinagat Islands",
  "Surigao del Norte",
  "Surigao del Sur",
];

const MINDANAO_CITIES = [
  "Davao City",
  "General Santos",
  "Cagayan de Oro",
  "Zamboanga City",
  "Butuan",
  "Iligan",
  "Cotabato City",
  "Digos",
  "Kidapawan",
  "Koronadal",
  "Mati",
  "Pagadian",
  "Tagum",
  "Tandag",
  "Marawi",
];

export function TerritoryManagementDialog({
  open,
  onOpenChange,
  employee,
}: TerritoryManagementDialogProps) {
  const [showAddForm, setShowAddForm] = useState(false);

  const { data: territoriesData, isLoading } = useEmployeeTerritories(employee.id);
  const addTerritory = useAddEmployeeTerritory();
  const removeTerritory = useRemoveEmployeeTerritory();
  const updateTerritory = useUpdateEmployeeTerritory();

  const territories = territoriesData?.data || [];

  const form = useForm<TerritoryFormInput>({
    resolver: zodResolver(territoryFormSchema),
    defaultValues: {
      city: "",
      regionState: "",
      isPrimary: false,
    },
  });

  const onSubmit = async (data: TerritoryFormInput) => {
    try {
      const parsed = territoryFormSchema.parse(data);
      await addTerritory.mutateAsync({
        employeeId: employee.id,
        ...parsed,
      });

      toast.success("Territory assigned successfully");

      form.reset();
      setShowAddForm(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add territory");
    }
  };

  const handleRemoveTerritory = async (territoryId: string) => {
    try {
      await removeTerritory.mutateAsync({ employeeId: employee.id, territoryId });

      toast.success("Territory removed successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove territory");
    }
  };

  const handleTogglePrimary = async (territoryId: string, currentIsPrimary: boolean) => {
    try {
      await updateTerritory.mutateAsync({
        employeeId: employee.id,
        territoryId,
        isPrimary: !currentIsPrimary,
      });

      toast.success(`Territory ${!currentIsPrimary ? "set as" : "removed from"} primary`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update territory");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Territories</DialogTitle>
          <DialogDescription>
            Assign territories to {employee.firstName} {employee.lastName} ({employee.employeeCode})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Territories */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-medium">Assigned Territories</h3>
              <Button size="sm" onClick={() => setShowAddForm(!showAddForm)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Territory
              </Button>
            </div>

            {isLoading ? (
              <div className="space-y-2">
                <div className="h-16 animate-pulse rounded bg-muted" />
                <div className="h-16 animate-pulse rounded bg-muted" />
              </div>
            ) : territories.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  <MapPin className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  <p>No territories assigned yet</p>
                  <p className="text-xs">Click &quot;Add Territory&quot; to assign one</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {territories.map((territory) => (
                  <Card key={territory.id}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {territory.city}, {territory.regionState}
                            </span>
                            {territory.isPrimary && (
                              <Badge variant="default" className="text-xs">
                                Primary
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTogglePrimary(territory.id, territory.isPrimary)}
                        >
                          {territory.isPrimary ? "Remove Primary" : "Set as Primary"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveTerritory(territory.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Add Territory Form */}
          {showAddForm && (
            <Card>
              <CardContent className="pt-6">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>City</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select city" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {MINDANAO_CITIES.map((city) => (
                                  <SelectItem key={city} value={city}>
                                    {city}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="regionState"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Region/State</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select region" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {PHILIPPINES_REGIONS.map((region) => (
                                  <SelectItem key={region} value={region}>
                                    {region}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="isPrimary"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel className="text-sm">Primary Territory</FormLabel>
                            <FormDescription className="text-xs">
                              Primary territory is used for auto-assignment
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowAddForm(false);
                          form.reset();
                        }}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={addTerritory.isPending}>
                        {addTerritory.isPending && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Add Territory
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
