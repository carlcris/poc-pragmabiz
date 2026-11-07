# Reduce inventory quantity to one

Run the entire `scripts/reduce-inventory-quantity-to-one.sql` file as a database
administrator during an inventory maintenance window. No company or user mapping
is required. It covers all companies and warehouses and reduces every non-deleted
item/warehouse balance above 1 to **1 base unit**. Quantities already at or below 1
are unchanged; it does not add stock to empty rows.

For batch-tracked stock, reserved units are retained first and any remaining unit
is retained in the oldest batch/location stock. Other batch/location quantities
become zero, and batch totals are recomputed. Warehouse-only balances are reduced
directly without inventing batch or location records. Costs, reservations,
in-transit quantities, and putaway quantities remain unchanged.

This is direct administrative balance maintenance. It does not create stock
adjustment documents, stock ledger entries, or API activity-log entries; historical
ledger quantities therefore do not reconcile to the reset balances. Use the app's
stock adjustment workflow when ledger reconciliation is required.

The complete operation runs in one database transaction and locks all three stock
balance tables against concurrent writes. Reservations above the target or
inconsistent existing batch/location totals stop the operation and roll it back.
Warehouse-only stock is supported and is not treated as a batch discrepancy.
PostgreSQL notices report reduced item counts and old/new totals by warehouse.

The file is one atomic `DO` statement, including temporary table creation, updates,
reporting, and cleanup. Run the entire statement together. Successful execution
commits automatically unless your session is already inside an explicit transaction.
For a rehearsal, run `BEGIN;`, the complete file, and `ROLLBACK;` in the same session.
After an error in an explicit transaction, run `ROLLBACK;` before retrying.
No permanent schema changes are installed.
