# Delivery Note Receiving Implementation Plan

## Overview

Extend the tablet receiving workflow so internal warehouse transfers can be received from Delivery Notes, alongside the existing supplier Load List → GRN flow.

The first implementation should stay behavior-compatible with the current Delivery Note lifecycle: a Delivery Note remains `dispatched` while receiving is in progress and becomes `received` only when receiving is completed. Do not introduce new statuses such as `receiving` or `pending_approval` unless a separate product decision adds an approval workflow.

## Current State

- Supplier receiving uses Load Lists and GRNs.
- Internal transfer fulfillment uses Delivery Notes.
- Delivery Note dispatch consumes stock from the fulfilling warehouse.
- Delivery Note receive posts stock into the requesting warehouse.
- Delivery Note lines are currently stock-request-backed and should remain that way.

## Canonical Warehouse Direction

Use the current schema terminology everywhere:

- `fulfilling_warehouse_id`: source warehouse for dispatch, where stock leaves.
- `requesting_warehouse_id`: destination warehouse for receive, where stock lands.

Do not use old `source_entity_id` or `destination_entity_id` names in this plan, APIs, migrations, indexes, or UI filters.

## Delivery Note Statuses

Current statuses:

- `draft`
- `confirmed`
- `queued_for_picking`
- `picking_in_progress`
- `dispatch_ready`
- `dispatched` - ready for receiving
- `received` - completed
- `voided`

Receiving progress is tracked by receiving fields and scan rows, not by a new status.

## URL Structure

```text
/tablet/receiving
├── Load Lists
└── Delivery Notes
    ├── /tablet/receiving/delivery-notes
    └── /tablet/receiving/delivery-notes/[id]
```

## Receiving Model

### Expected Items

Expected items are existing `delivery_note_items` rows. These rows remain linked to their originating stock request through `sr_id` and `sr_item_id`.

Do not allow `sr_id` or `sr_item_id` to become nullable for normal Delivery Note items.

### Scan Audit Rows

Use a normalized scan table instead of relying on `scanned_boxes JSONB` as the source of truth.

Proposed table:

```sql
CREATE TABLE delivery_note_item_receiving_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  business_unit_id UUID REFERENCES business_units(id),
  dn_id UUID NOT NULL REFERENCES delivery_notes(id) ON DELETE CASCADE,
  dn_item_id UUID NOT NULL REFERENCES delivery_note_items(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id),
  item_unit_option_id UUID REFERENCES item_unit_options(id),
  uom_id UUID NOT NULL REFERENCES units_of_measure(id),
  box_id TEXT NOT NULL,
  qr_code TEXT NOT NULL,
  qr_qty DECIMAL(20, 4) NOT NULL,
  accepted_qty DECIMAL(20, 4) NOT NULL,
  adjustment_reason TEXT,
  notes TEXT,
  scanned_by UUID NOT NULL REFERENCES users(id),
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  voided_at TIMESTAMPTZ,
  voided_by UUID REFERENCES users(id),
  void_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, dn_id, box_id)
);
```

Rules:

- `accepted_qty` is the quantity that should count toward receiving.
- `qr_qty` preserves the original box quantity.
- Manual corrections change `accepted_qty` through an auditable adjustment, not a direct overwrite of received totals.
- Duplicate box scans are rejected by the unique `(company_id, dn_id, box_id)` constraint.
- Voided scan rows do not count toward received quantity.

### Unexpected Items

Unexpected items must be tracked separately from normal Delivery Note lines.

Do not auto-create `delivery_note_items` with `sr_id = null`. That makes one table carry two different meanings and risks breaking stock request fulfillment, receive RPCs, reports, and status sync.

Proposed table:

```sql
CREATE TABLE delivery_note_receiving_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  business_unit_id UUID REFERENCES business_units(id),
  dn_id UUID NOT NULL REFERENCES delivery_notes(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id),
  item_unit_option_id UUID REFERENCES item_unit_options(id),
  uom_id UUID NOT NULL REFERENCES units_of_measure(id),
  box_id TEXT NOT NULL,
  qr_code TEXT NOT NULL,
  qr_qty DECIMAL(20, 4) NOT NULL,
  accepted_qty DECIMAL(20, 4) NOT NULL,
  batch_number TEXT,
  location_id UUID REFERENCES warehouse_locations(id),
  reason TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'accepted', 'rejected', 'resolved')),
  scanned_by UUID NOT NULL REFERENCES users(id),
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, dn_id, box_id)
);
```

Unexpected item flow:

1. User scans a box.
2. System tries to match the item to an existing non-voided DN line.
3. If matched, create a receiving scan row for the expected DN item.
4. If not matched, create a receiving exception row.
5. UI shows the exception in an "Unexpected Items" section with warning styling.
6. Completing receiving can proceed for expected lines.
7. Exception stock is not posted by the normal DN receive submit.
8. Exceptions are reviewed separately:
   - `accepted`: post through a dedicated inventory adjustment or receiving-exception RPC.
   - `rejected`: no stock movement.
   - `resolved`: linked or corrected through an intentional repair path.

## Schema Changes

### `delivery_notes`

```sql
ALTER TABLE delivery_notes
  ADD COLUMN IF NOT EXISTS receiving_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS receiving_started_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS receiving_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS receiving_completed_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS received_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS receiving_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_dn_receiving_status
  ON delivery_notes(status, requesting_warehouse_id, receiving_started_at)
  WHERE deleted_at IS NULL AND status IN ('dispatched', 'received');
```

### `delivery_note_items`

Keep `delivery_note_items` as expected, stock-request-backed lines. Add only receiving summary fields if useful for faster UI reads:

```sql
ALTER TABLE delivery_note_items
  ADD COLUMN IF NOT EXISTS received_qty DECIMAL(20, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS receiving_discrepancy_flag BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS receiving_notes TEXT;
```

`received_qty` should be maintained only inside receiving RPCs from scan rows. It must not be directly edited by the UI.

Do not drop `NOT NULL` from `sr_id` or `sr_item_id`.

## API and RPC Design

### API Endpoints

```typescript
GET /api/delivery-notes?status=dispatched&requestingWarehouseId=...
GET /api/delivery-notes/[id]

POST /api/delivery-notes/[id]/start-receiving
POST /api/delivery-notes/[id]/receiving-scans
POST /api/delivery-notes/[id]/receiving-scans/[scanId]/void
POST /api/delivery-notes/[id]/submit-receiving

GET /api/delivery-notes/[id]/receiving-exceptions
POST /api/delivery-notes/[id]/receiving-exceptions/[exceptionId]/accept
POST /api/delivery-notes/[id]/receiving-exceptions/[exceptionId]/reject
```

### RPCs

Use database RPCs for scan confirmation and final submit so duplicate checks, quantity updates, status checks, and audit writes are atomic.

Recommended RPCs:

- `record_delivery_note_receiving_scan(...)`
- `void_delivery_note_receiving_scan(...)`
- `submit_delivery_note_receiving(...)`
- `accept_delivery_note_receiving_exception(...)`

`submit_delivery_note_receiving(...)` should:

1. Lock the DN header.
2. Validate status is `dispatched`.
3. Validate expected DN item scan totals.
4. Set `received_qty` and discrepancy flags from non-voided scan rows.
5. Call or reuse `post_delivery_note_receive` for expected DN items only.
6. Set `received_at`, `received_by`, `receiving_completed_at`, `receiving_completed_by`, and `receiving_notes`.
7. Sync related stock request statuses.

Unexpected exceptions must not be posted by normal DN receiving submit.

## QR Code Handling

Expected QR payload:

```json
{
  "itemId": "uuid",
  "qty": 100,
  "boxId": "unique-box-id",
  "batchNumber": "optional",
  "locationId": "optional"
}
```

Parsing should reuse the picking scanner behavior:

- URI decode.
- Try JSON parse first.
- Support known keys: `id`, `itemId`, `item`, `itemCode`, `code`, `barcode`.
- Support delimiter splitting for plain text inputs.
- Normalize trim/lowercase for matching.

Validation:

- `boxId` is required.
- `qty` must be positive.
- DN must be `dispatched`.
- DN must not already be `received` or `voided`.
- Duplicate `boxId` for the DN is rejected.
- Manual accepted quantity must be positive and must include a reason when it differs from QR quantity.

## Tablet Workflow

### List Page

Location: `/tablet/receiving/delivery-notes`

Features:

- Filter by `dispatched` and `received`.
- Filter by `requestingWarehouseId` when warehouse context is available.
- Search by DN number.
- Cards show:
  - DN number.
  - Fulfilling warehouse -> requesting warehouse.
  - Expected item count.
  - Scan progress.
  - Exception count.
  - Status.

### Receiving Detail Page

Location: `/tablet/receiving/delivery-notes/[id]`

Sections:

1. Header: DN number, status, warehouse route, receiving start time.
2. Scan input: manual QR/barcode field and camera button.
3. Verification card: item, QR quantity, accepted quantity, adjustment reason.
4. Expected items list: expected, scanned, remaining, discrepancy state.
5. Scan history: box ID, accepted quantity, timestamp, scanned by, void action.
6. Unexpected items: exception records and review state.
7. Footer action: "Complete Receiving".

## Session Management

- First valid scan starts receiving by setting `receiving_started_at` and `receiving_started_by`.
- DN status remains `dispatched` during in-progress receiving.
- Every confirmed scan is saved immediately through the scan RPC.
- Offline mode is out of scope.
- If a scan save fails, the UI must show that it was not saved.
- Users can leave and resume because progress is stored in scan rows.

## Error Handling

Required user-safe errors:

- Delivery note is not dispatched.
- Delivery note is already received.
- Delivery note is voided.
- Duplicate box already scanned.
- QR code is invalid.
- Item does not exist.
- Expected item quantity would exceed allowed receive quantity.
- Manual quantity adjustment requires a reason.
- Unexpected item was recorded as an exception and has not been stocked.
- Network error: scan not saved, retry required.

## Type and API Client Updates

Update these areas before building UI:

- `src/types/delivery-note.ts`
- `src/lib/api/delivery-notes.ts`
- `src/hooks/useDeliveryNotes.ts`
- `src/app/api/delivery-notes/_lib.ts`

Add explicit types for:

- Receiving session fields.
- Receiving scan rows.
- Receiving exception rows.
- Scan request/result.
- Submit receiving request/result.

## Implementation Phases

### Phase 1: Database Foundation

- Add receiving fields to `delivery_notes`.
- Add receiving summary fields to `delivery_note_items`.
- Create `delivery_note_item_receiving_scans`.
- Create `delivery_note_receiving_exceptions`.
- Add indexes and uniqueness constraints.
- Validate migration with `supabase db reset` or transaction dry-run.

### Phase 2: RPC and API Foundation

- Implement scan recording RPC.
- Implement scan void RPC.
- Implement submit receiving RPC.
- Implement exception accept/reject RPCs or defer acceptance to a clearly documented later phase.
- Add API route wrappers with permission checks and user-safe errors.

### Phase 3: Types and Hooks

- Extend delivery note types.
- Extend API client.
- Extend hooks for list/detail, scan, void scan, submit, and exception review.
- Keep hook behavior data-focused; pages own toasts and dialogs.

### Phase 4: Tablet UI

- Add Delivery Notes tab to tablet receiving.
- Add delivery note list cards.
- Add scan detail page.
- Reuse `CameraScannerDialog`.
- Add scan history and exception sections.

### Phase 5: Receiving Completion

- Complete expected line receiving through RPC.
- Exclude unexpected exceptions from normal receive posting.
- Sync stock request status cache.
- Notify relevant business units.

### Phase 6: Validation and Regression

- Migration reset/dry-run.
- API smoke tests for start, scan, duplicate scan, exception, void scan, submit.
- UI smoke test on tablet viewport.
- Regression for existing Delivery Note dispatch, receive, void, and direct customer pickup.
- Regression for Load List/GRN receiving.

## Success Criteria

1. Can view dispatched delivery notes on tablet receiving.
2. Can start receiving on first valid scan.
3. Can scan QR codes with camera and manual input.
4. Duplicate boxes are rejected.
5. Expected scan quantities accumulate correctly.
6. Manual quantity adjustment is audited.
7. Unexpected items are tracked as exceptions, not normal DN items.
8. Completing receiving posts only expected DN items into inventory.
9. Related stock request status updates remain correct.
10. Existing DN dispatch, receive, void, and direct pickup flows still work.

## Follow-Up Product Decisions

These should not be silently added in the first implementation:

- Whether receiving requires approval before stock posting.
- Whether accepted unexpected items should post as inventory adjustments, new receiving transactions, or corrected stock requests.
- Whether partial receiving should be allowed as a final state.
- Whether tablet receiving needs offline capture.
- Whether box-level scans need a dedicated reporting page.

## References

- Existing picking implementation: `/tablet/picking/[id]/page.tsx`
- Existing supplier receiving: `/tablet/receiving/[id]/page.tsx`
- Camera scanner: `/components/tablet/CameraScannerDialog.tsx`
- Delivery note API: `/src/app/api/delivery-notes`
