"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AsyncSearchCombobox } from "@/components/shared/AsyncSearchCombobox";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useWarehouseFloors } from "@/hooks/useWarehouseFloorMap";
import type { WarehouseFloorSummary } from "@/types/warehouse-floor-map";

type Props = {
  businessUnitId: string;
  warehouseId: string;
  value: WarehouseFloorSummary | null;
  onChange: (floor: WarehouseFloorSummary) => void;
  disabled?: boolean;
};

export const WarehouseFloorSelect = ({
  businessUnitId,
  warehouseId,
  value,
  onChange,
  disabled,
}: Props) => {
  const t = useTranslations("warehouseFloorMap");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const floors = useWarehouseFloors(businessUnitId, warehouseId, debouncedSearch);
  const options = floors.data?.data ?? [];

  useEffect(() => {
    if (!value && !debouncedSearch && floors.data?.data[0]) onChange(floors.data.data[0]);
  }, [debouncedSearch, floors.data, onChange, value]);

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{t("floor")}</p>
      <AsyncSearchCombobox
        value={value ? String(value.floorNumber) : ""}
        selectedOption={value}
        options={options}
        onValueChange={(number) => {
          const floor = options.find((option) => String(option.floorNumber) === number);
          if (floor) onChange(floor);
        }}
        getOptionValue={(floor) => String(floor.floorNumber)}
        getOptionLabel={(floor) => floor.name || t("floorLabel", { number: floor.floorNumber })}
        searchValue={search}
        onSearchValueChange={setSearch}
        placeholder={t("selectFloor")}
        searchPlaceholder={t("searchFloors")}
        emptyMessage={floors.isError ? t("loadError") : t("noFloors")}
        loadingMessage={t("loadingFloors")}
        isLoading={floors.isFetching}
        disabled={disabled}
      />
    </div>
  );
};
