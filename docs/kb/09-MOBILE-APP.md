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
   ├─ Scan Location Barcode (validates correct location)
   ├─ Scan Item Barcode (validates correct item)
   ├─ Enter Quantity Picked
   ├─ Handle Short Picks (if any)
   └─ Confirm Pick
   ↓
4. Review Pick Summary
   ↓
5. Complete Delivery Note
   ↓
6. System Marks Ready for Dispatch
```

**Mobile Features**:
- Item-by-item picking with progress tracking
- Location navigation with warehouse map
- Barcode verification (item + location)
- Quantity validation
- Real-time progress updates
- Exception handling (short picks, wrong location)
- Photo capture for issues

### 3. Mobile GRN Receiving

**GRN Receiving** is the process of checking in goods from suppliers.

**Workflow**:
```
1. View Pending GRNs
   ↓
2. Select GRN
   ↓
3. For Each Box:
   ├─ Scan Box Barcode
   ├─ For Each Item in Box:
   │  ├─ Scan Item Barcode
   │  ├─ Enter Quantity Received
   │  ├─ Enter Quantity Damaged (if any)
   │  ├─ Take Photo of Damage (if any)
   │  └─ Add Notes
   └─ Confirm Box
   ↓
4. Review Total Quantities
   ↓
5. Submit GRN for Approval
   ↓
6. Supervisor Approves (desktop)
   ↓
7. Purchase Receipt Created and Posted
```

**Mobile Features**:
- Multi-box receiving workflow
- Camera integration for damage photos
- Offline draft capability (save locally)
- Damage documentation
- Real-time quantity tracking
- Barcode verification

## Mobile App Features

### Barcode/QR Scanning

```typescript
import { Camera } from 'expo-camera'

function BarcodeScannerScreen() {
  const [hasPermission, setHasPermission] = useState(null)

  // Request camera permission
  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync()
      setHasPermission(status === 'granted')
    })()
  }, [])

  const handleBarCodeScanned = ({ type, data }) => {
    console.log(`Scanned barcode: ${data}`)
    // Look up item by barcode
    // Validate against expected item
    // Add to pick list / receive list
  }

  if (hasPermission === null) {
    return <Text>Requesting camera permission...</Text>
  }

  if (hasPermission === false) {
    return <Text>No access to camera</Text>
  }

  return (
    <Camera
      onBarCodeScanned={handleBarCodeScanned}
      barCodeScannerSettings={{
        barCodeTypes: [
          BarCodeScanner.Constants.BarCodeType.qr,
          BarCodeScanner.Constants.BarCodeType.ean13,
          BarCodeScanner.Constants.BarCodeType.ean8,
          BarCodeScanner.Constants.BarCodeType.code128,
        ],
      }}
      style={StyleSheet.absoluteFillObject}
    />
  )
}
```

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
import * as Location from 'expo-location'

async function getCurrentLocation() {
  // Request permission
  const { status } = await Location.requestForegroundPermissionsAsync()

  if (status !== 'granted') {
    throw new Error('Location permission denied')
  }

  // Get current location
  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High
  })

  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    timestamp: location.timestamp
  }
}

// Use for delivery confirmation
async function confirmDelivery(deliveryNoteId: string) {
  const location = await getCurrentLocation()

  await api.post(`/delivery-notes/${deliveryNoteId}/confirm`, {
    confirmed_at: new Date().toISOString(),
    gps_latitude: location.latitude,
    gps_longitude: location.longitude
  })
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

#### GET /api/mobile/grns/pending
Get GRNs pending receiving.

**Permissions**: `view` on `grns`

#### POST /api/mobile/grns/[id]/receive-box
Receive GRN box on mobile.

**Permissions**: `edit` on `grns`

**Request**:
```json
{
  "box_number": 1,
  "box_barcode": "BOX-001",
  "items": [
    {
      "item_id": "uuid",
      "item_barcode": "123456789",
      "quantity_received": 50,
      "quantity_damaged": 2,
      "damage_photos": [
        "data:image/jpeg;base64,...",
        "data:image/jpeg;base64,..."
      ],
      "notes": "Corner of box crushed, 2 units damaged"
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "box_complete": true,
  "grn_complete": false,
  "progress": {
    "boxes_received": 2,
    "boxes_total": 5
  }
}
```

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
2. **Views list of pending GRNs**
3. **Selects GRN to receive**
4. **For each box**:
   - Scans box barcode
   - **For each item in box**:
     - Scans item barcode
     - Enters quantity received (good)
     - If damaged:
       - Enters quantity damaged
       - **Takes photo** of damage
       - Adds notes describing damage
   - Confirms box complete
5. **Reviews total received quantities**
   - Compares to PO quantities
   - Shows variances
6. **Submits GRN for approval**
7. **Supervisor approves GRN** (on desktop)
8. **Purchase receipt created and posted**

## UI Components

#### PickingList
**Location**: `apps/mobile/app/(tabs)/picking.tsx`
- List delivery notes assigned to user
- Filter by status
- Search by customer
- Navigate to detail

#### PickingDetail
**Location**: `apps/mobile/app/picking/[id].tsx`
- Show items to pick
- Barcode scanning interface
- Item-by-item progress
- Complete button

#### ScannerScreen
**Location**: `apps/mobile/components/ScannerScreen.tsx`
- Camera view for barcode scanning
- Scan feedback (success/error)
- Manual entry fallback

#### GRNReceivingDetail
**Location**: `apps/mobile/app/receiving/[id].tsx`
- Multi-box receiving interface
- Item scanning per box
- Photo capture for damages
- Submit for approval

## Troubleshooting

### Issue: Mobile barcode scanner not working
**Symptoms**: Camera not opening or barcodes not scanned
**Solution**:
1. Check camera permissions granted in app settings
2. Verify device camera works in other apps
3. Test barcode format (QR, EAN13, Code128, etc.)
4. Check lighting conditions (too dark/bright)
5. Update Expo Camera library
6. Clear app cache and restart

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
