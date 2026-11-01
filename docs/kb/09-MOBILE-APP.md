# Mobile App Module

## Overview

The Mobile App module provides a native React Native Expo application for warehouse operations including picking, receiving, barcode scanning, and delivery confirmations. The app runs on iOS and Android devices.

## Key Features

- **Cross-platform** (iOS and Android)
- **Warehouse picking** workflows
- **GRN receiving** on mobile devices
- **Barcode/QR code scanning**
- **Photo capture** for damaged items
- **Digital signatures** for deliveries
- **Location-based** warehouse operations
- **Offline capability** (future enhancement)

## Architecture

```
┌────────────────────────────────────────────────────────┐
│          React Native App (Expo) - Native Layer         │
│  Camera | Scanner | GPS | Storage | Notifications      │
└────────────────────────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────┐
│               React Native App - UI Layer               │
│  Picking UI | Receiving UI | Navigation                │
└────────────────────────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────┐
│                    API Layer                            │
│  Mobile-specific Endpoints | Authentication            │
└────────────────────────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────┐
│                  Backend Services                       │
│  Stock Updates | Transaction Recording | Validation    │
└────────────────────────────────────────────────────────┘
```

## Core Concepts

### 1. Mobile App Structure

**App Location**: `apps/mobile/`

**Directory Structure**:

```
apps/mobile/
  ├── app/                  # Expo Router app directory
  │   ├── (tabs)/           # Tab navigation
  │   │   ├── index.tsx     # Home/Dashboard
  │   │   ├── picking.tsx   # Picking list
  │   │   ├── receiving.tsx # GRN receiving list
  │   │   └── profile.tsx   # User profile
  │   ├── picking/
  │   │   └── [id].tsx      # Pick delivery note detail
  │   ├── receiving/
  │   │   └── [id].tsx      # Receive GRN detail
  │   └── _layout.tsx       # Root layout
  ├── components/           # Reusable mobile components
  ├── services/             # API service layer
  ├── hooks/                # Custom hooks
  └── assets/               # Images, fonts, etc.
```

### 2. Mobile Picking Workflow

**Picking** is the warehouse process of collecting items for delivery.

**Workflow**:

```
1. View Assigned Picks
   ↓
2. Select Delivery Note
   ↓
3. For Each Item:
   ├─ Navigate to Item Location
   ├─ Scan or enter the 10-digit batch-location SKU
   ├─ Validate item, batch identity, business unit, and configured location policy
   ├─ Enter Quantity Picked
   ├─ Confirm a permitted alternative source when required
   └─ Confirm Pick
   ↓
4. Review Pick Summary
   ↓
5. Complete Delivery Note
   ↓
6. System Marks Ready for Dispatch
```

**Mobile Features**:

- Pull-to-refresh reloads only the visible screen's operational data. Business-unit choices are
  cached per authenticated user and company. Operational query caches are namespaced by business
  unit. Switching units cancels the previous unit's requests, removes its cached data, and reloads
  the visible screen under the new unit without reloading the unchanged business-unit list. Hidden
  screens wait until focused before loading the new scope.
- Item-by-item picking with progress tracking
- Each mobile pick-list item shows its assigned physical location directly beneath the item name as
  warehouse code > rack code > batch code. The location SKU is omitted, and the separate progress
  row remains the single place showing picked quantity versus total quantity.
- Each pick-list line with an assigned rack exposes **View Map**. The full-screen viewer loads only
  the floor containing the assigned rack in the pick list's fulfilling warehouse, displays its
  floor number and map name, and labels every mapped rack on that floor by name within its
  normalized rectangle, highlights the suggested rack with a blinking red overlay, and supports
  button or pinch-to-zoom from 100–500%, two-axis scrolling, and 90-degree rotation. Labels follow
  each rack's long axis and scale to remain inside its mapped area. The API signs a transformed map
  image with a 2048-pixel maximum edge, and the mobile client caches same-item map responses for
  five minutes while reusing image URLs for the same map version. The viewer keeps its loading state
  until the image itself is ready. The image and rack highlight open at 90 degrees clockwise by
  default, rotate and scale together, and use swapped canvas dimensions so quarter-turns use the
  available portrait space without clipping. The highlight animation stops when the viewer closes
  or the location is cleared. Incomplete click-sized mappings are rejected and must be redrawn by a
  warehouse administrator. When the source warehouse has no configured map, the viewer shows a
  dedicated non-retry map-not-configured state instead of treating it as a transient load failure
- Picking accepts only a 10-digit batch-location SKU, supplied by scanning its QR payload or manual
  entry. Plain item IDs, item codes, and unit barcodes cannot prove the physical batch/location and
  are rejected instead of falling back to the suggested source
- The SKU must resolve to the pick-list item's item and allocated batch identity, including the
  original received timestamp, and its warehouse must belong to the fulfilling business unit
- The business unit's Inventory picking policy determines whether the allocated warehouse and rack
  are also mandatory: Batch only, Batch and warehouse, or Batch, warehouse, and rack
- The API's authoritative result controls the warning. An exact suggested SKU needs no warning. A
  different SKU is confirmable only when its item, batch identity, business-unit boundary,
  configured warehouse/rack rule, and quantity all pass; all other mismatches are hard failures
- Picking requires Pick Lists access. When `pick_lists.operation.view_only_assigned_pick_lists.view` is enabled, list, detail, claim, and progress operations are restricted to pick lists assigned to the current user; when disabled, the user can access all pick lists in the selected business unit
- Selecting a line creates a two-minute server-enforced claim that is renewed while the picker is entering quantity; other assigned pickers receive claim and progress changes through Supabase Realtime and cannot confirm the claimed line
- Claims are released on cancel, navigation, or successful confirmation; a local nearest-expiry timer and foreground refresh remove expired disconnected-picker claims even when no Realtime event occurs
- Pause and Complete are unavailable while any line has an active claim, and the database rejects completion if a claim appears concurrently
- Confirm Pick persists a quantity increment and scanned source transactionally with a client operation ID, so retries are idempotent while separate physical picks remain distinct
- Pick-list creation reserves the assigned batch and rack in base units. A picker claim owns the
  work temporarily but does not reserve the stock again. Confirming an alternative source moves the
  source reservation to the scanned batch-location SKU and also moves the aggregate reservation
  when the warehouse differs. Cancellation or voiding releases the applicable reservations, and
  dispatch consumes both on-hand and reserved quantities from the recorded source
- The Delivery Note owns the warehouse commitment, while each pick-list line owns a child physical
  allocation for its batch-location SKU. Warehouse, batch, and rack `qty_reserved` values are cached
  projections maintained in the same transaction as those ownership records; mobile never writes
  reservation balances independently
- Completing a pick list with a short quantity releases the unpicked batch/rack reservation from
  the suggested source, allowing a later incremental pick list to allocate that quantity again
- Pick progress is displayed per pick-list line. When the same item is allocated across multiple batches, confirming one batch updates only its matching line; sibling batch lines retain their own independent progress
- Before confirmation, mobile stores the pending payload, business-unit scope, and operation ID locally, renews the claim, and suppresses lease-heartbeat cleanup until the result is resolved. A manual retry, app restart, or foreground resume retries the same operation first; if the original request did not commit and the lease expired, it reacquires the line and retries without changing the operation ID
- Delivery-note picked totals are reconciled from execution rows across all non-deleted pick lists, preserving prior progress when a later pick list is created for the same delivery-note line
- Complete Picking finalizes the already-persisted pick rows instead of replaying mobile-only quantity changes
- When any line is not fully picked, Complete first asks for confirmation and lists the short lines (picked / required, up to five, then a remaining count); a fully picked list completes directly. A failed completion shows the API's safe error message in the picking footer
- The verified-item pick location shows the recorded location, batch, and batch-location SKU only; a missing value is shown as "Not recorded" in warning color rather than a substituted default
- Quantity validation
- Real-time progress updates
- Exception handling (short picks, wrong location)
- Photo capture for issues

### 3. Mobile GRN Receiving

**GRN Receiving** is the process of checking in goods from suppliers.

**Workflow**:

```
1. View inbound load lists
   ↓
2. Select arrived or receiving load list
   ↓
3. Open linked GRN receiving checklist
   ↓
4. Start destination-business-unit receiving
   ↓
5. Enter received and damaged quantities per GRN line
   ↓
6. Save quantities without submitting, or pause the GRN while the load list remains in receiving
   ↓
7. Submit GRN for Approval; any unsaved line changes are saved in the same transaction
   ↓
8. Received stock is staged into Putaway Station
   ↓
9. Supervisor Approves (desktop)
```

**Mobile Features**:

- Load-list based GRN receiving
- One receiving inbox lists load lists (destination is the current business unit) and delivery notes (requested by the current business unit) together, using shared stages: Expected (load list `confirmed`/`in_transit`), Ready to receive (load list `arrived`; delivery note `dispatched`, receiving not started), In progress (load list `receiving`; delivery note `dispatched` with receiving started), Awaiting approval (load list `pending_approval`) and Completed (`received`). Delivery notes appear only once dispatched.
- The inbox opens on To receive (Ready + In progress), grouped In progress first. Chips switch between To receive and Expected; the Filters sheet offers document type (when the user can receive both kinds) and every stage, each with server-provided counts. Search covers document code, supplier, supplier LL number, container number and source branch, and is debounced. Results page 20 at a time with Show more.
- Rows open the existing detail screens: load lists in Ready or In progress, delivery notes in Ready, In progress or Completed. Expected rows show the ETA and do not open.
- `GET /api/mobile/warehouse-dashboard` returns a bounded Pending Receipts aggregate containing destination-business-unit load lists in `arrived` or `receiving`, plus dispatched delivery notes awaiting receipt by the current business unit; the dashboard action opens the receiving inbox on To receive
- Load-list and delivery-note detail screens share one layout: a header with the document code and its supplier or source branch, a progress summary (shared stage, counted or scanned progress, key facts), and a sticky footer holding the primary actions and the current status or error message
- Load-list detail splits GRN lines into To count, Counted and Variance tabs; a line opens into Received and Damaged steppers with the resulting shortage, overage or damage shown as text. Start receiving sits in the footer; Pause receiving sits in the progress summary, away from Submit. Submit still requires at least one received quantity, and its label shows how many lines are not yet counted
- Delivery-note detail shows a scan field with camera button; every scan adds one unit, as enforced by the database. The latest scan is confirmed inline with Undo, which voids that scan; each line also keeps its remove-one control. Lines are ordered in progress, over, not scanned, then complete, and the footer summarizes short and over lines before Submit receiving opens the discrepancy notes. Confirmed unexpected items appear below the lines under "Not on this delivery note", grouped per item and unit with their scanned count and review status (rejected and voided exceptions are hidden), and the footer counts them too. Their units are included in the summary's units scanned, measured against the dispatched quantity, so the summary matches the inbox row. Undo on an unexpected-item scan, or the remove-one control on a pending unexpected row, voids the most recent exception for that item
- Start and pause controls for user-triggered receiving sessions
- Per-line received and damaged quantity entry
- Save draft receiving quantities without changing workflow status
- Submit to the shared GRN confirmation and putaway-staging workflow, atomically including any unsaved line changes
- Save and submit update the active receiving detail from their responses; receiving inbox and dashboard summaries are marked stale without hidden-screen requests, then refreshed when their screens regain focus
- Real-time quantity tracking
- Variance highlighting

## Mobile App Features

### Barcode/QR Scanning

The shared camera scanner uses `expo-camera` and remains the cross-platform scan path. Its result
is passed directly to the active item lookup, picking verification, or delivery-note receiving
handler instead of being staged in the manual-entry field.

Android builds also include a local Expo module for integrated SUNMI scan heads. A focused
scan-capable screen listens for `com.sunmi.scanner.ACTION_DATA_CODE_RECEIVED` while the camera
scanner is closed. Pressing the physical device scan key therefore processes the broadcast
`data` value through the same handler as a camera scan, without adding SUNMI-specific scan controls
to the UI. The listener pauses while a camera scan, verification request, required confirmation,
receiving discrepancy dialog, or receiving submission is active. It is removed when the screen
loses focus or the app leaves the foreground.

Receiving confirmation and discrepancy dialogs remain open until the user chooses one of the
visible dialog actions. The scan confirmation is rendered in the receiving screen rather than an
Android native modal, and hardware back-key events are consumed while that confirmation is active.

SUNMI devices must be configured with broadcast output enabled, simulated-keyboard/direct-fill
output disabled, and both **Send Enter key** and **Send TAB key** disabled. Key suffixes can still
change focus or activate navigation independently of the broadcast payload. The shared screen
header provides a neutral initial keyboard-focus target so repeated Enter suffixes do not focus
and activate Back; touch navigation, Android Back, and focused manual-entry submission remain
available. This broadcast-only setup prevents the scan head from typing into a focused
manual-entry field. Because the receiver is native Android code, physical scanner testing requires
a development, APK, preview, or production build; Expo Go continues to support only the camera
fallback.

### Camera for Damage Photos

```typescript
import { Camera } from 'expo-camera'

function DamagePhotoCapture() {
  const [camera, setCamera] = useState(null)
  const [photos, setPhotos] = useState([])

  const takePicture = async () => {
    if (camera) {
      const photo = await camera.takePictureAsync({
        quality: 0.8,
        base64: true,
        exif: true
      })

      setPhotos([...photos, photo])

      // Upload to server or store locally
      await uploadPhoto(photo.base64)

      return photo.base64
    }
  }

  return (
    <View>
      <Camera ref={setCamera} style={{ flex: 1 }} />
      <Button title="Capture Damage Photo" onPress={takePicture} />
      <Text>{photos.length} photos captured</Text>
    </View>
  )
}
```

### GPS Location Tracking

```typescript
import * as Location from "expo-location";

async function getCurrentLocation() {
  // Request permission
  const { status } = await Location.requestForegroundPermissionsAsync();

  if (status !== "granted") {
    throw new Error("Location permission denied");
  }

  // Get current location
  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    timestamp: location.timestamp,
  };
}

// Use for delivery confirmation
async function confirmDelivery(deliveryNoteId: string) {
  const location = await getCurrentLocation();

  await api.post(`/delivery-notes/${deliveryNoteId}/confirm`, {
    confirmed_at: new Date().toISOString(),
    gps_latitude: location.latitude,
    gps_longitude: location.longitude,
  });
}
```

### Digital Signature Capture

```typescript
import SignatureScreen from 'react-native-signature-canvas'

function SignatureCaptureScreen() {
  const handleSignature = (signature) => {
    // signature is base64 string
    console.log(signature)

    // Save signature for delivery confirmation
    saveDeliverySignature(deliveryNoteId, signature)
  }

  return (
    <SignatureScreen
      onOK={handleSignature}
      descriptionText="Customer Signature"
      clearText="Clear"
      confirmText="Confirm"
    />
  )
}
```

## API Reference

### Mobile Endpoints

#### GET /api/mobile/delivery-notes/pending

Get delivery notes pending picking.

**Permissions**: `view` on `delivery_notes`

**Response**:

```json
{
  "delivery_notes": [
    {
      "id": "uuid",
      "delivery_number": "DN-001",
      "customer": "Acme Corp",
      "customer_address": "123 Main St",
      "status": "picking",
      "items_count": 5,
      "items_picked": 2,
      "priority": "high",
      "expected_delivery_date": "2025-06-14"
    }
  ]
}
```

#### GET /api/mobile/delivery-notes/[id]

Get delivery note details for picking.

**Permissions**: `view` on `delivery_notes`

**Response**:

```json
{
  "id": "uuid",
  "delivery_number": "DN-001",
  "customer": "Acme Corp",
  "items": [
    {
      "id": "uuid",
      "item": {
        "code": "ITEM-001",
        "name": "Widget ABC",
        "barcode": "123456789"
      },
      "location": {
        "code": "A-01-01",
        "barcode": "LOC-A0101"
      },
      "quantity_required": 50,
      "quantity_picked": 25,
      "unit": "piece",
      "status": "partial"
    }
  ]
}
```

#### POST /api/mobile/delivery-notes/[id]/pick-item

Record item picked.

**Permissions**: `edit` on `delivery_notes`

**Request**:

```json
{
  "delivery_note_item_id": "uuid",
  "quantity_picked": 50,
  "location_barcode": "LOC-A0101",
  "item_barcode": "123456789"
}
```

**Validation**:

- Barcode matches expected item
- Location barcode matches expected location
- Quantity doesn't exceed required

**Response**:

```json
{
  "success": true,
  "item_complete": true,
  "delivery_note_complete": false,
  "progress": {
    "items_picked": 3,
    "items_total": 5
  }
}
```

#### POST /api/mobile/delivery-notes/[id]/complete

Complete picking.

**Permissions**: `edit` on `delivery_notes`

**Effect**:

- Marks delivery note as ready for dispatch
- Locks picking (no more changes)
- Notifies dispatch team

#### GET /api/mobile/receiving/inbox

Fetch the unified mobile receiving inbox for the current business unit. Backed by the `SECURITY INVOKER` database function `list_receiving_inbox`, which unions load lists and delivery notes, maps them to shared stages, filters, sorts (stage, then completion date for completed rows, then expected date) and paginates in one round trip. Line counts and progress are computed only for the returned page.

Delivery-note progress measures scanned units against dispatched units, including partial dispatches. Allocating 10 units but dispatching and scanning 6 shows `6 / 6` in both the inbox and detail. Unshipped allocations do not increase the expected total; pending, accepted, and resolved unexpected-item quantities remain included in scanned units.

**Query**: `stage` (`to_receive` default, `ready`, `in_progress`, `expected`, `awaiting_approval`, `completed`, `all`), `kind` (`all` default, `load_list`, `delivery_note`), `search` (max 100 characters, matched literally), `page` (default 1), `limit` (default 20, max 50).

**Permissions**: Load lists are included with `view` on Load Lists or Goods Receipt Notes; delivery notes with `view` on Delivery Notes plus capability `delivery_notes.operation.receive_delivery_notes.edit`. With neither, the route returns 403. The function also rejects business units the caller has no access to.

**Response**:

```json
{
  "data": [
    {
      "kind": "load_list",
      "id": "uuid",
      "code": "LL-000000001",
      "counterpartyName": "Supplier or source branch name",
      "status": "receiving",
      "stage": "in_progress",
      "expectedAt": "2026-10-19T00:00:00+00:00",
      "completedAt": null,
      "lineCount": 12,
      "doneQty": 4,
      "totalQty": 12
    }
  ],
  "stageCounts": [{ "stage": "in_progress", "kind": "load_list", "count": 1 }],
  "access": { "loadLists": true, "deliveryNotes": true },
  "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

`stageCounts` covers every permitted kind and stage with the search applied, independent of the `stage` and `kind` filters, so filter controls can show counts for every choice. For load lists in progress, `doneQty`/`totalQty` are GRN lines with an entry over all lines on the latest GRN; for delivery notes `doneQty` is scanned units, including confirmed unexpected items that were not rejected or voided, and `totalQty` is allocated units. Other load-list rows return `null` progress.

#### GET /api/load-lists?receivingOnly=true

Fetch native mobile load-list receiving candidates whose destination is the current business unit. Used by app builds released before the receiving inbox; current builds use `GET /api/mobile/receiving/inbox`.

**Permissions**: `view` on either Load Lists or Goods Receipt Notes. Goods Receipt Notes access grants only the business-unit-scoped load-list context required by the receiving workflow; ordinary load-list APIs still require Load Lists access.

#### GET /api/load-lists/[id]/receiving-detail?includeGrn=true

Get the business-unit-scoped load-list context and its linked GRN in one bounded native-mobile request. The GRN line collection is limited to 500 explicit records; oversized receipts return an error instead of an unbounded payload.

**Permissions**: `view` on either Load Lists or Goods Receipt Notes for load-list context; `includeGrn=true` also requires `view` on Goods Receipt Notes

#### PUT /api/grns/[id]

Save native mobile GRN receiving quantities. The GRN must already be in `receiving`; bounded header and line patches are applied atomically by the database. The response includes the authoritative updated GRN, so the mobile client updates its detail cache without a follow-up detail request.

**Permissions**: `view` on Goods Receipt Notes and granular capability `goods_receipt_notes.operation.save_receiving.edit`

**Request**:

```json
{
  "receivingDate": "2026-07-07",
  "items": [
    {
      "id": "grn-item-uuid",
      "receivedQty": 50,
      "damagedQty": 2,
      "notes": "Optional receiving notes"
    }
  ]
}
```

#### POST /api/grns/[id]/start-receiving

Start native mobile GRN receiving for the current destination business unit. The request has no body and transitions the GRN plus linked arrived load list into `receiving` without selecting or assigning a warehouse.

**Permissions**: `view` on Goods Receipt Notes and granular capability `goods_receipt_notes.operation.start_receiving.edit`

#### POST /api/grns/[id]/pause-receiving

Pause native mobile GRN receiving. This saves the session state by moving the GRN to `paused` while leaving the linked load list in `receiving`; entered quantities remain on the GRN lines. Starting receiving again resumes the paused GRN.

**Permissions**: `view` on Goods Receipt Notes and granular capability `goods_receipt_notes.operation.start_receiving.edit`

#### POST /api/grns/[id]/submit

Submit native mobile GRN receiving for confirmation. The request may include an optional `receivingPatch`; when present, the database saves that patch and stages the received good quantities into Putaway Station in one transaction. A submission failure rolls back the optional save and all staging writes. When no unsaved lines exist, the client submits without a patch. Final batch/location placement happens when putaway is posted.

**Permissions**: `view` on Goods Receipt Notes and granular capability `goods_receipt_notes.operation.submit_receiving.edit`

#### GET /api/delivery-notes?receivingOnly=true

Fetch delivery notes available to the current business unit for native mobile receiving.

**Permissions**: `view` on Delivery Notes and granular capability `delivery_notes.operation.receive_delivery_notes.edit`

#### GET /api/delivery-notes/[id]?receivingOnly=true

Get a delivery note for native mobile receiving.

**Permissions**: `view` on Delivery Notes and granular capability `delivery_notes.operation.receive_delivery_notes.edit`

#### Delivery-note receiving mutations

The following operations require `edit` on Delivery Notes and granular capability `delivery_notes.operation.receive_delivery_notes.edit`:

- `POST /api/delivery-notes/[id]/start-receiving`
- `POST /api/delivery-notes/[id]/receiving-scans`
- `POST /api/delivery-notes/[id]/receiving-scans/[scanId]/void`
- `POST /api/delivery-notes/[id]/receiving-exceptions/[exceptionId]/void`
- `POST /api/delivery-notes/[id]/receiving-exceptions/[exceptionId]/accept`
- `POST /api/delivery-notes/[id]/receiving-exceptions/[exceptionId]/reject`
- `POST /api/delivery-notes/[id]/receiving-overages/[itemId]/accept`
- `POST /api/delivery-notes/[id]/receiving-overages/[itemId]/reject`
- `POST /api/delivery-notes/[id]/submit-receiving`

Starting delivery-note receiving requires the receiver to select an active destination warehouse in
the delivery note's requesting business unit. The database assigns that warehouse to the delivery
note and all of its lines atomically before scanning begins. Receiving authorization uses the
delivery note's requesting business unit directly; it does not infer authorization from the
destination warehouse. Mobile scan and submit controls remain unavailable until Start Receiving
succeeds. When the destination business unit has exactly one active warehouse, the mobile app
selects it automatically without showing a redundant warehouse field; business units with multiple
warehouses still require an explicit choice. The variance acknowledgement warning is hidden before
receiving and appears only after at least one received quantity creates a current shortage or
overage. Each delivery-note item with an active receiving scan shows a minus action. The action
voids the most recent active scan for that item and uses the server-recalculated delivery note to
reduce the displayed received quantity by one. Scan controls and final submission remain disabled
while a scan is being recorded or voided.

Voiding a receiving exception undoes a mistaken unexpected-item scan. The
`void_delivery_note_receiving_exception` function locks the delivery note, takes the caller from
`auth.uid()`, requires the caller's current business unit to be the note's requesting business unit
with an access grant, and requires receiving to be in progress. Only `pending_review` exceptions
can be voided; voiding an already voided exception is a no-op. The row is kept for audit with
status `voided`, `voided_at`, `voided_by`, and an optional `void_reason` (the body accepts
`{ "reason"?: string }`, max 200 characters). Voided exceptions cannot be accepted or rejected and
are excluded from delivery-note detail responses. The route returns the updated delivery note, or
a translated error with code `DELIVERY_NOTE_NOT_FOUND` (404),
`DELIVERY_NOTE_RECEIVING_EXCEPTION_NOT_FOUND` (404), `DELIVERY_NOTE_RECEIVING_EXCEPTION_REVIEWED`
(409), `DELIVERY_NOTE_RECEIVING_CLOSED` (409), or `DELIVERY_NOTE_RECEIVING_EXCEPTION_VOID_FAILED`
(500).

When a scan does not match a loaded delivery-note line, mobile first calls
`POST /api/delivery-notes/[id]/resolve-receiving-item` with the scan payload. This lookup requires
receiving access in the requesting business unit and an active receiving session. It resolves
company-scoped item IDs, item codes, and unit barcodes using bounded queries and returns the item
identity without writing receiving records. If a box ID cannot identify an item, the API returns
HTTP 400 with `DELIVERY_NOTE_RECEIVING_FULL_QR_REQUIRED` and asks the user to scan the full QR code
on the box, which contains the item details. A full QR referring to an unavailable catalog item
returns `DELIVERY_NOTE_RECEIVING_ITEM_NOT_FOUND`; no unidentified exception is saved.

An identified item absent from the delivery note still opens the unexpected-item confirmation.
Cancel saves nothing; Confirm records it through the existing transactional receiving-scans
operation as a pending review exception with a required item and unit association. Expected items
and overages retain their existing scan-count behavior. Scans already matched to a loaded line
skip the lookup. Scan controls and submission stay blocked during identification or recording.
Errors remain visible inside an open confirmation dialog, which stays available for retry.

The native mobile app stores the permission and capability maps returned by login and business-unit
switching. Bottom navigation keeps Receiving and Picking visible in fixed positions but disables
destinations the current role cannot access. Dashboard quick actions, list queries, detail queries,
and receiving mutations are gated from the stored session so roles without the matching parent and
granular permissions do not call the protected APIs. Picking requires Pick Lists `view`; the
`pick_lists.operation.view_only_assigned_pick_lists.view` toggle optionally narrows server-side
list, detail, and mutation access to current-user assignments. With the toggle disabled, results
remain restricted to the selected business unit. Picking rights alone do not grant delivery-note
receiving access.

#### GET /api/mobile/items/search

Search items for mobile (autocomplete).

**Permissions**: `view` on `items`

**Query Parameters**:

- `q` - Search term (code or name)
- `warehouse_id` - Filter by warehouse
- `limit` - Results limit (default: 10)

**Response**:

```json
{
  "items": [
    {
      "id": "uuid",
      "code": "ITEM-001",
      "name": "Widget ABC",
      "barcode": "123456789",
      "on_hand": 150,
      "available": 125,
      "location": "A-01-01"
    }
  ]
}
```

## Workflows

### Workflow 1: Mobile Picking

1. **Warehouse worker opens mobile app**
2. **Views list of delivery notes pending picking**
   - Sorted by priority
   - Shows customer, item count, status
3. **Selects delivery note to pick**
4. **For each item**:
   - App shows item details and location
   - Worker navigates to location
   - **Scans location barcode** (validates correct location)
   - **Scans item barcode** (validates correct item)
   - Enters quantity picked
   - If short pick: Enters reason and quantity
   - Confirms pick
5. **Repeats for all items**
6. **Reviews pick summary**
   - Shows all items picked
   - Highlights short picks
   - Shows total quantities
7. **Completes delivery note**
8. **System marks delivery note as ready for dispatch**

### Workflow 2: Mobile GRN Receiving

1. **Warehouse worker opens mobile app**
2. **Views inbound load lists**
3. **Selects an arrived or receiving load list**
4. **Opens the linked GRN**
5. **Starts receiving for the destination business unit**
   - GRN status changes to `receiving`
   - Linked load list status changes to `receiving`
   - No warehouse or rack is selected until Putaway Station
6. **For each GRN line**:
   - Enters received quantity
   - Enters damaged quantity when applicable
   - Reviews line variance
7. **Reviews total received quantities**
   - Compares to expected load-list quantities
   - Shows variances
8. **Saves receiving quantities**
   - Save remains a save-only action and keeps the GRN in `receiving`
   - Can pause the GRN before submit; the load list remains `receiving`
9. **Submits GRN for confirmation**
   - If line edits are still unsaved, Submit saves and submits them atomically in one request
10. **Received good stock is staged into Putaway Station**
11. **Supervisor confirms GRN** (on desktop)

## UI Components

#### PickingList

**Location**: `apps/mobile/app/(tabs)/picking.tsx`

- List delivery notes assigned to user
- Filter by status
- Search by customer
- Navigate to detail

#### PickingDetail

**Location**: `apps/mobile/app/picking/[id].tsx`

- Scan-first layout: status text and line progress ("7 of 12 lines") replace unit totals, because units differ per line
- A scanner bar shows whether the Sunmi hardware scanner is ready (blue with a spinner while a scan is being checked), with icon-only camera and keypad buttons as fallbacks (keypad opens 10-digit entry on a number pad); scan errors stay in a banner until the next scan
- A Next pick card shows the first remaining unreserved line in location-code order (natural sort of zone/aisle/bay codes as a walking-path proxy), with its location code as the largest text; Up next lists the rest in the same order, and picked lines collapse behind "N picked"
- After a valid scan the screen shows a match banner (or an amber different-batch banner with assigned vs scanned values), the scanned location, and a quantity stepper; Cancel and Confirm are pinned in the footer above the keyboard
- Scan results vibrate: one short pulse for a match, two pulses for a different batch, one long pulse for an error. Re-scanning the verified QR code confirms an exact-match pick at the shown quantity; a different-batch pick must be confirmed with the button
- Pause and Finish (or Start/Resume picking) sit in the pinned footer, whose note shows open lines, who holds a blocking reservation, or the last status/completion error

#### ScannerScreen

**Location**: `apps/mobile/components/ScannerScreen.tsx`

- Camera view for barcode scanning
- Scan feedback (success/error)
- Manual entry fallback

#### GRNReceivingDetail

**Location**: `apps/mobile/app/receiving/load-lists/[id].tsx`

- Load-list linked GRN receiving interface
- Mobile receiving list includes load lists whose destination is the current business unit
- Start and pause receiving controls
- Per-line received and damaged quantity entry
- Save receiving quantities without submitting
- Submit for confirmation and putaway staging, including unsaved quantities atomically
- Delivery-note receiving is inbound-only: the mobile receiving queue shows dispatched delivery
  notes whose requesting business unit is the current business unit. The receiver selects the
  destination warehouse when receiving starts.

## Troubleshooting

### Issue: Installed Android app shows a generic icon

The native launcher icon is configured by `expo.icon` in `apps/mobile/app.json`, which references
the 1024×1024 `assets/achlers_logo.png`. A logo displayed inside the app does not configure its
launcher icon. The complete square artwork uses the standard icon configuration; custom adaptive
icons require separate artwork padded for Android's adaptive-icon safe area.

From `apps/mobile`, run `npm run build:android:apk:local`, install the rebuilt APK, and verify the
home-screen and app-drawer icons. A Metro reload or JavaScript update cannot replace the icon
resources embedded in an existing installation. See `apps/mobile/README.md` for build profiles.

### Issue: Mobile barcode scanner not working

**Symptoms**: Camera not opening, SUNMI scan key has no effect, barcodes are typed into an input,
or scanning returns an open pick list to the overview
**Solution**:

1. Check camera permissions granted in app settings
2. Verify device camera works in other apps
3. Test barcode format (QR, EAN13, Code128, etc.)
4. Check lighting conditions (too dark/bright)
5. Update Expo Camera library
6. Clear app cache and restart
7. On SUNMI hardware, verify ScannerHead broadcast output is enabled
8. Disable SUNMI simulated-keyboard/direct-fill output to keep hardware scans silent
9. Disable **Send Enter key** and **Send TAB key** in ScannerHead; an Enter suffix can otherwise
   activate a focused Back button and return to the overview
10. Install a native Android build instead of Expo Go when testing the SUNMI scan head

### Issue: Mobile app offline mode issues

**Symptoms**: App crashes when offline
**Solution**:

1. Implement proper offline detection
2. Queue operations for when online
3. Show offline indicator to user
4. Cache necessary data locally
5. Test offline scenarios thoroughly

### Issue: Photos not uploading

**Symptoms**: Damage photos not saving
**Solution**:

1. Check network connection
2. Verify file size not too large (compress images)
3. Check upload endpoint working
4. Retry failed uploads automatically
5. Store locally until upload succeeds

### Issue: GPS location inaccurate

**Symptoms**: Wrong location recorded
**Solution**:

1. Check GPS permissions granted
2. Ensure device has GPS enabled
3. Wait for location accuracy to improve
4. Use high accuracy mode
5. Verify not in GPS-blocked area (indoor)

## Related Documentation

- **Mobile Expo Migration Plan**: `docs/plans/mobile-expo-migration-plan.md`
- **Delivery Note Receiving Plan**: `docs/plans/delivery-note-receiving-implementation-plan.md`

## Future Enhancements

- **Full offline mode** with local database and sync
- **Push notifications** for new picks/receives
- **Voice commands** for hands-free operation
- **AR navigation** to guide to warehouse locations
- **Mobile inventory counts** for cycle counting
- **Mobile stock adjustments** for field adjustments
- **Multi-language** support
- **Dark mode** for mobile app
