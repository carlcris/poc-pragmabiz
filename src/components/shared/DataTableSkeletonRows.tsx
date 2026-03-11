import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";

type DataTableSkeletonRowsProps = {
  columnWidths: string[];
  rowCount?: number;
  rightAlignedColumns?: number[];
  badgeColumns?: number[];
  actionColumnIndex?: number;
};

export const DataTableSkeletonRows = ({
  columnWidths,
  rowCount = 8,
  rightAlignedColumns = [],
  badgeColumns = [],
  actionColumnIndex,
}: DataTableSkeletonRowsProps) => (
  <>
    {Array.from({ length: rowCount }).map((_, rowIndex) => (
      <TableRow key={rowIndex}>
        {columnWidths.map((width, columnIndex) => {
          const isActionColumn = actionColumnIndex === columnIndex;
          const isBadgeColumn = badgeColumns.includes(columnIndex);
          const isRightAligned = rightAlignedColumns.includes(columnIndex);

          return (
            <TableCell key={`${rowIndex}-${columnIndex}`} className={isRightAligned ? "text-right" : undefined}>
              {isActionColumn ? (
                <div className="flex justify-end gap-2">
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-8 w-8" />
                </div>
              ) : (
                <Skeleton
                  className={[
                    isBadgeColumn ? "h-5 rounded-full" : "h-4",
                    width,
                    isRightAligned ? "ml-auto" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                />
              )}
            </TableCell>
          );
        })}
      </TableRow>
    ))}
  </>
);
