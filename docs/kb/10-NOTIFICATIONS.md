# Notification System Module

## Overview

The Notification System provides real-time workflow notifications to users throughout the ERP system. It enables event-driven communication for critical business processes, ensuring users are alerted to actions requiring their attention (approvals, deliveries, stock transfers, etc.).

## Key Features

- **Workflow-driven notifications** - Automated notifications triggered by business events
- **Business unit broadcasting** - Send notifications to all users in a business unit
- **Read/unread status tracking** - Mark notifications as read/unread
- **User-specific notifications** - Target specific users for notifications
- **Metadata support** - Contextual information (links, IDs, types)
- **Multi-tenant support** - Business unit scoping with company-level fallback
- **Pagination support** - Efficient retrieval of notification lists

## Architecture

```
┌────────────────────────────────────────────────────────┐
│              Business Event Occurs                      │
│  (Pick list created, Stock request submitted, etc.)    │
└────────────────────────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────┐
│         Workflow Notification Service                   │
│  notifyUsers() | notifyBusinessUnits()                 │
└────────────────────────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────┐
│              Notifications Table                        │
│  Store notification with metadata and recipient        │
└────────────────────────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────┐
│                 User Interface                          │
│  Notification badge, list, read/unread status         │
└────────────────────────────────────────────────────────┘
```

## Core Concepts

### 1. Notification Structure

**Database Table**: `notifications`

**Fields**:
- `id` - UUID primary key
- `user_id` - Recipient user (foreign key to users)
- `business_unit_id` - Business unit context (nullable for company-level)
- `title` - Notification title (short summary)
- `message` - Full notification message
- `type` - Notification type classification (info, warning, success, error)
- `read` - Boolean flag for read status
- `metadata` - JSONB field for contextual data (entity IDs, links, etc.)
- `created_at` - Timestamp when notification was created
- `updated_at` - Last update timestamp

### 2. Notification Types

Notifications are categorized by type for UI rendering and filtering:

- **`info`** - Informational notifications (general updates)
- **`warning`** - Warning notifications (attention required)
- **`success`** - Success notifications (action completed)
- **`error`** - Error notifications (action failed)

### 3. Metadata Structure

The `metadata` JSONB field stores contextual information:

```typescript
interface NotificationMetadata {
  entity_type?: string        // Type of entity (e.g., "pick_list", "stock_request")
  entity_id?: string          // UUID of the related entity
  link?: string               // Direct link to the entity in UI
  action?: string             // Action that triggered notification
  additional_data?: any       // Any other contextual information
}
```

**Example**:
```json
{
  "entity_type": "pick_list",
  "entity_id": "uuid-here",
  "link": "/warehouse/pick-lists/uuid-here",
  "action": "created",
  "priority": "high"
}
```

### 4. Workflow Notification Service

**Location**: `src/app/api/_lib/workflow-notifications.ts`

The workflow notification service provides utility functions for creating notifications:

#### `notifyUsers()`
Send notifications to specific users.

**Signature**:
```typescript
async function notifyUsers(params: {
  userIds: string[]
  title: string
  message: string
  type: 'info' | 'warning' | 'success' | 'error'
  businessUnitId?: string | null
  metadata?: Record<string, any>
}): Promise<void>
```

**Usage**:
```typescript
await notifyUsers({
  userIds: ['user-uuid-1', 'user-uuid-2'],
  title: 'New Pick List Assigned',
  message: 'Pick list #PL-001 has been assigned to you',
  type: 'info',
  businessUnitId: 'bu-uuid',
  metadata: {
    entity_type: 'pick_list',
    entity_id: pickListId,
    link: `/warehouse/pick-lists/${pickListId}`
  }
})
```

#### `notifyBusinessUnits()`
Send notifications to all users in business unit(s).

**Signature**:
```typescript
async function notifyBusinessUnits(params: {
  businessUnitIds: string[]
  title: string
  message: string
  type: 'info' | 'warning' | 'success' | 'error'
  metadata?: Record<string, any>
  excludeUserIds?: string[]  // Exclude specific users (e.g., the actor)
}): Promise<void>
```

**Usage**:
```typescript
await notifyBusinessUnits({
  businessUnitIds: ['bu-uuid-1'],
  title: 'Stock Transfer Submitted',
  message: 'Stock transfer #SR-0045 requires approval',
  type: 'warning',
  excludeUserIds: [currentUserId], // Don't notify the person who created it
  metadata: {
    entity_type: 'stock_request',
    entity_id: stockRequestId,
    link: `/warehouse/stock-requests/${stockRequestId}`,
    action: 'submitted_for_approval'
  }
})
```

#### `getWarehouseBusinessUnitMap()`
Helper function to map warehouses to business units.

**Signature**:
```typescript
async function getWarehouseBusinessUnitMap(
  warehouseIds: string[]
): Promise<Map<string, string>>
```

**Returns**: Map of warehouse_id → business_unit_id

**Usage**:
```typescript
const warehouseBUMap = await getWarehouseBusinessUnitMap([
  'warehouse-1',
  'warehouse-2'
])

const businessUnitId = warehouseBUMap.get('warehouse-1')
```

## Database Schema

### `notifications` Table

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_unit_id UUID REFERENCES business_units(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('info', 'warning', 'success', 'error')),
  read BOOLEAN DEFAULT FALSE,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_business_unit_id ON notifications(business_unit_id);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_user_read ON notifications(user_id, read);
```

**Key Constraints**:
- `user_id` is required (every notification has a recipient)
- `business_unit_id` is nullable (allows company-level notifications)
- `type` must be one of: info, warning, success, error
- `read` defaults to `false`

## API Reference

### GET /api/notifications

Get notifications for the current user.

**Permissions**: Authenticated user (own notifications only)

**Query Parameters**:
- `limit` (optional, default: 20) - Number of notifications to return
- `offset` (optional, default: 0) - Pagination offset
- `unread_only` (optional, boolean) - Filter to unread notifications only

**Response**:
```json
{
  "notifications": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "business_unit_id": "uuid",
      "title": "New Pick List Assigned",
      "message": "Pick list #PL-001 has been assigned to you for warehouse A",
      "type": "info",
      "read": false,
      "metadata": {
        "entity_type": "pick_list",
        "entity_id": "uuid",
        "link": "/warehouse/pick-lists/uuid",
        "action": "assigned"
      },
      "created_at": "2025-06-14T10:30:00Z",
      "updated_at": "2025-06-14T10:30:00Z"
    }
  ],
  "total": 45,
  "unread_count": 12
}
```

**Example Usage**:
```typescript
// Get latest 20 notifications
const response = await fetch('/api/notifications?limit=20&offset=0')

// Get only unread notifications
const unreadResponse = await fetch('/api/notifications?unread_only=true')
```

### PATCH /api/notifications/[id]/read

Mark a notification as read.

**Permissions**: Authenticated user (own notifications only)

**Request Body**: None

**Response**:
```json
{
  "success": true,
  "notification": {
    "id": "uuid",
    "read": true,
    "updated_at": "2025-06-14T10:35:00Z"
  }
}
```

**Example Usage**:
```typescript
await fetch(`/api/notifications/${notificationId}/read`, {
  method: 'PATCH'
})
```

**Security**:
- Users can only mark their own notifications as read
- Backend verifies `user_id` matches authenticated user
- Returns 403 if user attempts to mark another user's notification

## Common Workflows

### Workflow 1: Notify on Pick List Creation

**Trigger**: Pick list is created and assigned to a user

**Implementation**:
```typescript
// In pick list creation logic
import { notifyUsers } from '@/app/api/_lib/workflow-notifications'

// After pick list is created
await notifyUsers({
  userIds: [assignedUserId],
  title: 'New Pick List Assigned',
  message: `Pick list ${pickListNumber} has been assigned to you`,
  type: 'info',
  businessUnitId: pickList.business_unit_id,
  metadata: {
    entity_type: 'pick_list',
    entity_id: pickList.id,
    link: `/warehouse/pick-lists/${pickList.id}`,
    action: 'created',
    priority: 'high'
  }
})
```

### Workflow 2: Notify Business Unit on Stock Transfer Submission

**Trigger**: Stock transfer is submitted for approval

**Implementation**:
```typescript
import { notifyBusinessUnits } from '@/app/api/_lib/workflow-notifications'

// After stock transfer is submitted
await notifyBusinessUnits({
  businessUnitIds: [stockRequest.business_unit_id],
  title: 'Stock Transfer Requires Approval',
  message: `Stock transfer ${stockRequestNumber} submitted by ${userName} requires approval`,
  type: 'warning',
  excludeUserIds: [currentUserId], // Don't notify the submitter
  metadata: {
    entity_type: 'stock_request',
    entity_id: stockRequest.id,
    link: `/warehouse/stock-requests/${stockRequest.id}`,
    action: 'submitted_for_approval',
    submitted_by: currentUserId
  }
})
```

### Workflow 3: Notify on Delivery Note Dispatch

**Trigger**: Delivery note is dispatched for delivery

**Implementation**:
```typescript
import { notifyUsers, getWarehouseBusinessUnitMap } from '@/app/api/_lib/workflow-notifications'

// Get destination warehouse's business unit
const warehouseBUMap = await getWarehouseBusinessUnitMap([
  deliveryNote.destination_warehouse_id
])

const businessUnitId = warehouseBUMap.get(deliveryNote.destination_warehouse_id)

// Notify warehouse manager or receiving team
await notifyUsers({
  userIds: receivingTeamUserIds,
  title: 'Delivery En Route',
  message: `Delivery note ${deliveryNoteNumber} is en route to your warehouse`,
  type: 'info',
  businessUnitId,
  metadata: {
    entity_type: 'delivery_note',
    entity_id: deliveryNote.id,
    link: `/warehouse/receiving/${deliveryNote.id}`,
    action: 'dispatched',
    expected_arrival: deliveryNote.expected_delivery_date
  }
})
```

### Workflow 4: Mark Multiple Notifications as Read

**Use Case**: User clicks "Mark all as read"

**Implementation**:
```typescript
// Frontend
const unreadNotifications = notifications.filter(n => !n.read)

await Promise.all(
  unreadNotifications.map(notification =>
    fetch(`/api/notifications/${notification.id}/read`, {
      method: 'PATCH'
    })
  )
)

// Refresh notifications list
await refetchNotifications()
```

## UI Components

### NotificationBadge

**Location**: `src/components/layout/NotificationBadge.tsx`

Displays unread notification count in header.

**Features**:
- Real-time unread count
- Click to open notification dropdown
- Visual indicator (red dot/number)

**Usage**:
```tsx
import { NotificationBadge } from '@/components/layout/NotificationBadge'

<NotificationBadge />
```

### NotificationList

**Location**: `src/components/notifications/NotificationList.tsx`

Displays list of notifications with pagination.

**Features**:
- Unread/read status indicators
- Click to mark as read
- Click notification to navigate to entity
- Infinite scroll pagination
- Filter by unread only

**Usage**:
```tsx
import { NotificationList } from '@/components/notifications/NotificationList'

<NotificationList
  limit={20}
  unreadOnly={false}
/>
```

### NotificationItem

**Location**: `src/components/notifications/NotificationItem.tsx`

Individual notification display.

**Features**:
- Type-based icon (info, warning, success, error)
- Title and message display
- Timestamp (relative: "2 hours ago")
- Read/unread visual state
- Click handler for navigation
- Mark as read button

**Props**:
```typescript
interface NotificationItemProps {
  notification: {
    id: string
    title: string
    message: string
    type: 'info' | 'warning' | 'success' | 'error'
    read: boolean
    metadata?: Record<string, any>
    created_at: string
  }
  onMarkAsRead: (id: string) => void
  onClick?: () => void
}
```

## Integration Points

### 1. Pick List Workflows
- Pick list created → Notify assigned user
- Pick list status changed → Notify warehouse team
- Pick list completed → Notify dispatch team

### 2. Stock Transfer Workflows
- Stock transfer submitted → Notify approvers in business unit
- Stock transfer approved → Notify requester
- Stock transfer rejected → Notify requester with reason
- Stock transfer fulfilled → Notify requester

### 3. Delivery Note Workflows
- Delivery note dispatched → Notify receiving warehouse
- Delivery note arrived → Notify receiving team
- Delivery note received → Notify sender (confirmation)

### 4. GRN/Purchase Receipt Workflows
- GRN submitted → Notify approvers
- GRN approved → Notify receiving team
- GRN rejected → Notify submitter
- Purchase receipt posted → Notify purchasing team

### 5. Approval Workflows
- Any approval request → Notify approvers in business unit
- Approval granted → Notify requester
- Approval denied → Notify requester with reason

## Best Practices

### 1. Don't Notify the Actor

Always exclude the user who performed the action:

```typescript
await notifyBusinessUnits({
  businessUnitIds: [buId],
  title: 'Action Required',
  message: 'Please review the submission',
  excludeUserIds: [currentUserId], // Don't notify yourself
  type: 'warning'
})
```

### 2. Include Actionable Links

Always provide a direct link in metadata:

```typescript
metadata: {
  entity_type: 'stock_request',
  entity_id: stockRequestId,
  link: `/warehouse/stock-requests/${stockRequestId}`, // Direct link
  action: 'submitted_for_approval'
}
```

### 3. Use Appropriate Notification Types

- `info` - General updates, status changes
- `warning` - Actions required, approvals needed
- `success` - Confirmations, completions
- `error` - Failures, rejections

### 4. Keep Messages Concise

- **Title**: Short summary (max 50 characters)
- **Message**: Clear action or information (max 200 characters)
- Use metadata for detailed information

### 5. Business Unit Scoping

Always provide business unit context when available:

```typescript
await notifyUsers({
  userIds: [userId],
  businessUnitId: entity.business_unit_id, // Always include
  // ...
})
```

### 6. Batch Notifications

When notifying multiple users about the same event, use `notifyBusinessUnits()` instead of multiple `notifyUsers()` calls:

```typescript
// Good
await notifyBusinessUnits({
  businessUnitIds: [buId],
  // ...
})

// Avoid
for (const userId of userIds) {
  await notifyUsers({ userIds: [userId], ... }) // Multiple DB calls
}
```

## Performance Considerations

### 1. Pagination

Always paginate notification lists:

```typescript
// Frontend
const [offset, setOffset] = useState(0)
const limit = 20

const { data } = useQuery({
  queryKey: ['notifications', offset],
  queryFn: () => fetch(`/api/notifications?limit=${limit}&offset=${offset}`)
})
```

### 2. Indexing

The `notifications` table has composite indexes for efficient queries:
- `(user_id, read)` - Fast filtering of unread notifications per user
- `created_at DESC` - Fast ordering by recency

### 3. Cleanup Strategy

**Recommendation**: Archive or delete old read notifications after 90 days:

```sql
-- Periodic cleanup (run via cron/scheduled job)
DELETE FROM notifications
WHERE read = TRUE
  AND created_at < NOW() - INTERVAL '90 days';
```

## Troubleshooting

### Issue: Notifications not appearing

**Symptoms**: User doesn't see expected notifications

**Solution**:
1. Check user is in the correct business unit
2. Verify `business_unit_id` matches user's BU
3. Check `excludeUserIds` doesn't include the target user
4. Verify user has active session
5. Check browser console for API errors

### Issue: Duplicate notifications

**Symptoms**: Same notification appears multiple times

**Solution**:
1. Ensure notification logic isn't called multiple times
2. Check for race conditions in async code
3. Use transaction wrappers to prevent duplicate inserts
4. Add deduplication logic based on metadata

### Issue: Notification links broken

**Symptoms**: Clicking notification doesn't navigate correctly

**Solution**:
1. Verify `metadata.link` format is correct
2. Check route exists in Next.js app router
3. Ensure entity ID in link is valid UUID
4. Verify user has permission to view linked entity

### Issue: Business unit notifications missing users

**Symptoms**: Not all users in BU receive notifications

**Solution**:
1. Check users are active (`deleted_at IS NULL`)
2. Verify users have business unit assignments
3. Check `excludeUserIds` list
4. Verify business unit ID is correct

## Future Enhancements

- **Real-time push notifications** via WebSockets or Server-Sent Events
- **Email digests** for unread notifications
- **Notification preferences** per user (enable/disable by type)
- **Notification grouping** (combine similar notifications)
- **Rich media support** in notifications (images, attachments)
- **Notification templates** for common workflows
- **Analytics** on notification engagement (read rates, click-through)
- **Snooze functionality** - Remind me later
- **Priority levels** - High/medium/low priority notifications

## Related Documentation

- **Authentication & Authorization**: [01-AUTHENTICATION-AUTHORIZATION.md](01-AUTHENTICATION-AUTHORIZATION.md)
- **Business Units**: [01-AUTHENTICATION-AUTHORIZATION.md#business-units](01-AUTHENTICATION-AUTHORIZATION.md#business-units)
- **Warehouse Operations**: [02-INVENTORY-MANAGEMENT.md](02-INVENTORY-MANAGEMENT.md)
- **Purchasing Workflows**: [04-PURCHASING-MANAGEMENT.md](04-PURCHASING-MANAGEMENT.md)

## Migration History

- **Initial notifications table**: `supabase/migrations/[timestamp]_create_notifications_table.sql`
- **Add metadata support**: `supabase/migrations/[timestamp]_add_notifications_metadata.sql`
- **Add business unit scoping**: `supabase/migrations/[timestamp]_add_notifications_business_unit.sql`

---

**Last Updated**: June 14, 2025
