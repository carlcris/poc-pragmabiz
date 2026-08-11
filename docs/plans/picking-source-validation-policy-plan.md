# Picking Source Validation Policy Plan

Status: Implemented on 2026-08-10. The implementation includes the BU setting, strict scan preview,
transactional pick enforcement and reservation movement, cancellation/void reconciliation,
actual-source dispatch, generated database contracts, and workflow documentation.

## Goal

Add a business-unit-scoped Inventory picking policy that determines whether mobile picking validates only the planned batch, the planned batch and warehouse, or the planned batch, warehouse, and rack.

The policy must correct wrong-pick detection without weakening inventory integrity. Accepting a valid batch from an alternative warehouse must also reconcile reservations and make dispatch consume stock from the actual picked source.

## Agreed Decisions

- Picking always validates the item and batch identity.
- The batch identity is `item_id + batch_code + received_at`.
- `received_at` remains part of mismatch and acceptance validation.
- `batch_location_sku` remains the scan/manual-entry source identifier.
- The current allocation RPC already saves `suggested_batch_location_sku` on each allocated pick-list line; retain it as the exact planned-source identifier.
- Compare the scanned `batch_location_sku` with `suggested_batch_location_sku` to classify an exact suggested pick versus an alternative source.
- A different SKU is overrideable only after the resolved item, batch identity, fulfilling-BU boundary, configured warehouse/rack policy, and available quantity all pass validation.
- A scanned SKU that resolves to a different item or different batch identity is a hard rejection, not an overrideable wrong-pick warning.
- Do not add `source_item_batch_id` or `source_batch_location_id` to pick execution records.
- Do not require a new scan or manual-entry interaction. The existing input already requires `batch_location_sku`.
- A source warehouse must always belong to the Delivery Note's fulfilling business unit.
- The policy is an Inventory setting scoped to the active business unit.
- Rack enforcement includes warehouse enforcement because a rack belongs to one warehouse.
- The deprecated van-loading `stock_transfers` workflow is excluded.

## Validation Modes

| Policy | Required match |
| --- | --- |
| `batch_only` | Item ID + batch code + received timestamp |
| `batch_and_warehouse` | Item ID + batch code + received timestamp + assigned warehouse |
| `batch_and_rack` | Item ID + batch code + received timestamp + assigned warehouse + assigned rack |

Recommended default for newly seeded business units: `batch_only`.

An enabled warehouse or rack constraint should be enforced as a hard validation failure. It should not be bypassed through the existing generic mismatch acknowledgement.

## Current Source Contract

Keep the existing pick-source fields as the operational contract:

- `batch_location_sku`
- `source_warehouse_id`
- `picked_location_id`
- `picked_batch_code`
- `picked_batch_received_at`

The scanned or manually entered `batch_location_sku` resolves the exact `item_batch_locations` row. The related `item_batches` row supplies the item, batch code, and received timestamp used by policy validation.

The suggested SKU is advisory only after the mandatory rules have passed:

- Scanned SKU equals suggested SKU: classify as the correct suggested pick.
- Scanned SKU differs, but the resolved source satisfies every mandatory rule: classify as a valid alternative source, show a wrong-pick warning, and require explicit confirmation before recording it.
- Scanned SKU resolves to the wrong item, wrong batch identity, source outside the fulfilling BU, a policy-prohibited warehouse/rack, or insufficient stock: hard reject it without offering an override.

The mismatch acknowledgement must never bypass item, batch identity, BU, policy, or availability validation.

## Scope

### In Scope

- BU-scoped Inventory picking-policy setting.
- Inventory settings form, types, validation, and translations.
- Pick-source scan preview validation.
- Transactional pick-progress validation.
- Cross-warehouse reservation reconciliation within the fulfilling BU.
- Dispatch depletion and reservation release by actual picked warehouse.
- Delivery Note void, pick-list cancellation, and completion reconciliation.
- Structured mobile wrong-pick errors.
- Migration/type verification where transactional RPC definitions change.
- Inventory, mobile picking, and QA documentation updates.

### Out of Scope

- Cross-business-unit picking.
- Changing FIFO allocation order.
- Removing `received_at` from inventory history or transfer provenance.
- Replacing `batch_location_sku` with another scanner contract.
- Adding new item-batch or batch-location foreign keys to pick execution rows.
- Redesigning Delivery Note receiving.
- The deprecated van-loading `stock_transfers` workflow.

## Implementation Plan

### 1. Add the Inventory Picking Policy

- Add a typed policy union:
  - `batch_only`
  - `batch_and_warehouse`
  - `batch_and_rack`
- Add the setting key to `src/types/settings.ts`.
- Extend `src/lib/validations/settings/inventory.ts` with strict enum validation.
- Add a Picking Policy section to `src/components/settings/forms/InventorySettingsForm.tsx`.
- Explain in the UI that item, batch code, and received timestamp are always checked.
- Add English and Chinese translations through `src/lib/i18n/translations.ts`.
- Seed the recommended default in `supabase/seed.sql` for active development environments.
- Continue using the existing `company_settings` permission for viewing and editing Inventory settings; do not introduce a new granular permission unless separately requested.

### 2. Centralize Server-Side Policy Resolution

- Resolve the active BU's Inventory picking policy on the server.
- Treat a missing value as the selected documented default.
- Avoid trusting a policy value supplied by the mobile client.
- Ensure both scan preview and pick mutation use the same policy semantics.
- Keep the transactional RPC as the final authority even if the preview endpoint has already accepted the scan.

### 3. Refactor Scan Preview Validation

Update `src/app/api/pick-lists/[id]/scan-source/route.ts` to:

1. Resolve `batch_location_sku` to the exact batch-location row.
2. Load its item ID, batch code, received timestamp, warehouse, rack, and available quantity.
3. Reject an unknown, deleted, incomplete, inactive, non-pickable, or unavailable source.
4. Find incomplete pick-list lines for the resolved item and hard reject the scan when the item has no eligible line.
5. Prefer an incomplete line whose `suggested_batch_location_sku` exactly matches the scanned SKU.
6. When there is no exact SKU match, consider only incomplete same-item lines whose suggested batch code and received timestamp match the resolved batch identity.
7. Select among multiple qualifying lines deterministically; do not bind an alternative SKU to the first arbitrary same-item line.
8. Reject sources outside the Delivery Note's fulfilling BU.
9. Apply the configured warehouse or rack constraint as a hard rule.
10. Compare the resolved SKU with the selected line's suggested SKU only after all mandatory validation passes.
11. Return `isMismatch: false` for an exact suggested SKU and `isMismatch: true` plus a structured alternative-source warning for a valid different SKU.
12. Return the actual warehouse and rack for an accepted alternative source.
13. Preserve bounded and explicitly projected Supabase queries.

Remove the unconditional different-warehouse rejection. A different warehouse is valid only in `batch_only` mode and only when it belongs to the fulfilling BU.

Do not treat every same-item SKU as overrideable. A different SKU that resolves to another batch code or received timestamp must be rejected because it violates FIFO/selected-batch allocation.

### 4. Enforce the Same Policy Transactionally

Update the latest effective `record_pick_list_item_progress` definition in a new migration so it:

1. Locks the pick list, pick-list line, claim, and relevant inventory rows.
2. Resolves the supplied `batch_location_sku` inside the transaction.
3. Revalidates company, BU, item, batch code, received timestamp, warehouse, and rack according to the active policy.
4. Validates base-unit availability at the actual source.
5. Classifies SKU inequality as an overrideable mismatch only after every mandatory validation succeeds.
6. Requires mismatch acknowledgement only for a valid alternative source; never use acknowledgement to bypass a hard validation failure.
7. Persists the actual source warehouse, rack, batch-location SKU, batch code, and received timestamp.
8. Persists the mismatch acknowledgement and reason for an alternative-source pick so it remains auditable.
9. Rejects stale or policy-invalid scan previews without committing any pick progress.

The client-provided location, batch code, and received timestamp must not override the values resolved from `batch_location_sku`.

### 5. Reconcile Cross-Warehouse Reservations

When `batch_only` accepts a source outside the planned warehouse:

- Convert the picked quantity to base units.
- Lock the planned and actual `item_warehouse` rows in deterministic order.
- Release the corresponding reserved quantity from the planned warehouse.
- Validate unreserved stock in the actual warehouse.
- Add the reservation to the actual warehouse.
- Record pick progress only after the reservation move succeeds.
- Keep the operation inside `record_pick_list_item_progress` so a failure rolls back the reservation move and pick row together.

For picks from the planned warehouse, retain the existing reservation without moving it.

The existing `delivery_note_item_picks` rows provide the actual picked-source distribution; no new source-ID columns are required.

### 6. Correct Void and Cancellation

- Reverse any alternative-warehouse reservation movement atomically when a pick list is cancelled before dispatch.
- Restore the reservation to the planned warehouse only if sufficient stock can still support it; otherwise return an actionable conflict and leave the pick list unchanged.
- Release outstanding reservations from their current source distribution when a pick list or Delivery Note is cancelled or voided.
- Ensure idempotent operation IDs cannot move the same reservation twice.

### 7. Dispatch from Actual Pick Sources

Update the latest effective Delivery Note dispatch RPC so it:

- Groups dispatched quantities by actual `delivery_note_item_picks.source_warehouse_id`.
- Resolves the exact batch using item ID, batch code, and received timestamp.
- Resolves the exact location using warehouse, rack, and batch-location SKU.
- Decrements `item_batch_locations` and `item_batches` at the actual picked source.
- Decrements `item_warehouse.current_stock` and `reserved_stock` in the same actual warehouse.
- Stops decrementing aggregate stock only from `delivery_note_items.fulfilling_warehouse_id` when picks came from another accepted warehouse.
- Keeps all stock, reservation, pick-row, transaction, and Delivery Note status updates atomic.

Receiving may continue using batch code and received timestamp to preserve the transferred batch's identity and FIFO history at the destination.

### 8. Preserve Actionable Mobile Errors

Keep structured validation codes through `apps/mobile/src/api/picking.ts` and the picking detail screen instead of collapsing them into a generic invalid-source message.

Required outcomes include:

- Batch-location SKU not found.
- Item not included in the pick list.
- Scanned item does not match the batch source.
- Batch code or received timestamp does not match.
- Warehouse does not match the configured policy.
- Rack does not match the configured policy.
- Source warehouse is outside the fulfilling BU.
- Source quantity is insufficient.
- Valid alternative source requires explicit confirmation.
- Reservation changed concurrently.

Do not change the scanner/manual-input control: both continue supplying `batch_location_sku`.

### 9. Translation and Contract Updates

- Add translated settings labels, descriptions, policy names, validation errors, and recovery guidance.
- Keep English and Chinese translation keys in parity.
- Update shared TypeScript contracts for the policy and structured scan response.
- Regenerate `src/types/database.types.ts` after applying RPC/schema migrations locally.
- Update all current callers together; do not add legacy request or response fallbacks.

### 10. Verification

Validate at minimum:

- Correct item, batch code, and received timestamp in all modes.
- Exact suggested SKU is accepted without a warning.
- Different SKU for the same item and batch identity produces a warning and requires explicit confirmation when permitted by the active policy.
- Cancelling the alternative-source confirmation records no pick progress.
- Acknowledging a valid alternative source records its actual SKU, warehouse, rack, batch code, received timestamp, and mismatch audit fields.
- Different SKU resolving to another item is hard rejected.
- Different SKU resolving to the same item but another batch code is hard rejected.
- Different SKU resolving to the same item and batch code but another received timestamp is hard rejected.
- Multiple incomplete lines for the same item select the exact suggested SKU first, then a deterministic same-batch line; an alternative source is never attached to an arbitrary line.
- Same batch in another warehouse accepted only by `batch_only`.
- Different rack in the assigned warehouse accepted by `batch_and_warehouse`.
- Different rack rejected by `batch_and_rack`.
- Same batch code belonging to another item rejected.
- Same item and batch code with a different received timestamp rejected.
- Source outside the fulfilling BU rejected in every mode.
- Insufficient actual-source stock rejected without reservation changes.
- Alternative-warehouse pick moves the reservation exactly once.
- Pick-list cancellation reverses the reservation movement exactly once.
- Dispatch decrements the actual warehouse, batch, and rack.
- Cancellation releases reservations from all actual source warehouses.
- Concurrent scans cannot over-allocate stock.
- A forced failure after a reservation update rolls back all writes.

Run:

- Targeted migration/RPC success and rollback checks.
- `supabase db lint`
- Supabase type generation after local migration application.
- Web and mobile TypeScript validation.
- Mobile linting.
- `npm run lint`
- `npm run activity-logging:check`
- `npm run build`

## Documentation Updates During Implementation

Update:

- `docs/kb/02-INVENTORY-MANAGEMENT.md`
- `docs/kb/09-MOBILE-APP.md`
- `docs/guides/QA-WORKFLOW-TESTING-GUIDE.md`

Document the policy matrix, mandatory batch identity, BU boundary, reservation behavior, dispatch behavior, and user-visible validation results.
