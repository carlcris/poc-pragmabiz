# Granular Permissions Rollout Rule

This rule extends the current module-level RBAC model with field, widget, section, and operation-level capabilities. Use it as the rollout reference when adding granular authorization to any module.

## Intent

Users may be allowed to access and operate on a module while being denied access to specific sensitive fields, columns, widgets, or derived values.

Example:

- A user can view, create, edit, submit, and approve stock requisitions.
- The same user cannot view stock requisition total amount, unit cost, import cost, profit, margin, or financial summary widgets.

Granular permissions must protect both the UI and the API response. Hiding a field only in the frontend is not sufficient.

## Permission Layers

Use layered permissions instead of replacing the existing CRUD model.

1. Module permissions: page/API access.
   - Example: `stock_requisitions:view`

2. Action permissions: business operations.
   - Example: `stock_requisitions:create`, `stock_requisitions:edit`, `stock_requisitions:approve`

3. Field permissions: sensitive scalar values or columns.
   - Example: `stock_requisitions.field.total_amount.view`
   - Example: `stock_requisitions.field.unit_cost.view`

4. Widget permissions: dashboard cards, report panels, KPIs, summaries.
   - Example: `purchasing_dashboard.widget.total_stock_requisition_amount.view`

5. Section or tab permissions: larger UI/data groupings inside a page.
   - Example: `items.section.costing.view`

6. Data-scope permissions remain separate.
   - Example: company scope, business unit scope, warehouse scope, own-record scope.

## Naming Convention

Use stable capability names that describe what is protected.

Format:

```text
<resource>.<surface>.<name>.<action>
```

Allowed surfaces:

- `field`
- `column`
- `widget`
- `section`
- `tab`
- `operation`

Examples:

```text
stock_requisitions.field.total_amount.view
stock_requisitions.column.unit_cost.view
stock_requisitions.operation.submit.execute
purchasing_dashboard.widget.open_requisition_value.view
items.section.costing.view
```

Do not encode UI labels that may change. Use domain names, not current display text.

## API Contract

Every API route that returns sensitive data must enforce granular permissions server-side.

Rules:

- Check module/action permission first.
- Resolve granular capabilities for the current user.
- Redact forbidden fields before returning JSON.
- Include capability metadata where the frontend needs to decide layout, column visibility, or available controls.
- Do not return sensitive values in hidden fields, nested data, summaries, totals, exports, or metadata.
- Derived values inherit the strictest permission of their source data.

Example response:

```json
{
  "data": {
    "id": "sr-id",
    "srNumber": "SR-2026-0001",
    "totalAmount": null
  },
  "capabilities": {
    "stockRequisitions": {
      "canViewTotalAmount": false,
      "canEdit": true
    }
  }
}
```

`null` in this context means "redacted for display." It must never mean "clear this value" during updates.

## CRUD And Redacted Data Rule

Do not round-trip redacted values through update payloads.

When a user cannot view a field, the frontend must omit that field from mutation payloads. It must not send the redacted `null` value back to the server.

Server update handlers must:

- Accept patch payloads only.
- Apply only fields explicitly submitted by the client.
- Validate edit permission for the module.
- Validate field-level edit permission for every submitted protected field.
- Reject forbidden submitted fields with `403`.
- Keep existing database values for omitted fields.
- Never overwrite hidden fields with `null` because the client received a redacted response.

Bad update payload:

```json
{
  "notes": "Updated",
  "totalAmount": null
}
```

Good update payload:

```json
{
  "notes": "Updated"
}
```

## Create Flow Rule

If a hidden field is required during creation, do not ask an unauthorized user to supply it.

Use one of these patterns:

- Derive the value server-side.
- Default it at the database level.
- Compute it from allowed line inputs.
- Require the granular permission before allowing the create action.

Do not use placeholder values, temporary defaults, or frontend-only calculations to bypass missing authority.

## UI Rule

The UI must render based on capability metadata from the API or shared permission resolver.

Rules:

- Hide forbidden columns, fields, widgets, tabs, and summary values.
- Do not display temporary fallback text such as raw IDs or `0.00` for redacted money values.
- Prefer neutral redacted states such as `--` only when the field position must remain layout-stable.
- Disable or hide controls based on operation permissions.
- Destructive and sensitive operations still follow existing row action rules.

## Permission Settings UI Rule

Permission settings must expose granular permissions through a grouped, hierarchical editor. Do not render granular permissions as one large flat checkbox list.

Keep the current module/action matrix as the top-level control:

```text
Stock Requisitions

[Module Access]
[ ] View   [ ] Create   [ ] Edit   [ ] Delete
```

Then show child capability groups inside the module:

```text
Stock Requisitions

[Workflow]
[ ] Submit
[ ] Approve
[ ] Cancel

[Sensitive Fields]
[ ] Total Amount
[ ] Unit Cost
[ ] Import Cost
[ ] Profit / Margin

[Widgets]
[ ] Total Requisition Value
[ ] Requisition Count
[ ] Pending Approval Count
```

Admins should see friendly labels by default. Technical permission keys may be shown in a tooltip, details drawer, or advanced view.

The effective permission rule is:

```text
module/action permission AND granular capability permission
```

Example:

```text
stock_requisitions:view = true
stock_requisitions.field.total_amount.view = false
```

Result:

- User can open and operate on stock requisitions according to their CRUD permissions.
- User cannot see stock requisition total amount.

If the parent module permission is denied, child permissions do not grant access by themselves:

```text
stock_requisitions:view = false
stock_requisitions.field.total_amount.view = true
```

Result:

- User cannot access stock requisitions.
- Total amount remains inaccessible because the parent module is denied.

Granular permissions should be stored as normal permission catalog entries with metadata that allows the settings UI to group them.

Suggested metadata shape:

```text
resource: stock_requisitions
surface: field
key: total_amount
action: view
label: Total Amount
group: Sensitive Fields
description: Allows viewing stock requisition total amount in lists, details, reports, and exports.
```

Recommended groups:

- `Module Access`
- `Workflow`
- `Sensitive Fields`
- `Widgets`
- `Sections`
- `Reports / Exports`
- `Advanced Operations`

Use permission presets to reduce setup errors for common roles:

- `Operational User`: CRUD allowed, financial fields hidden.
- `Supervisor`: CRUD plus workflow approvals, limited financial visibility.
- `Finance User`: financial fields, summaries, reports, and exports visible.
- `Admin`: all module and granular capabilities.

Presets must only assign explicit permission records. They must not bypass normal permission evaluation.

## Exports And Reports

Exports, print views, PDFs, report APIs, dashboards, and aggregate endpoints must apply the same granular permissions.

If a user cannot view `unit_cost`, they also cannot view:

- total cost
- margin
- profit
- stock value derived from cost
- CSV/PDF columns containing those values
- dashboard widgets derived from those values

## Implementation Pattern

Each module rollout should add:

1. A capability map for protected fields/widgets/operations.
2. A server-side resolver that returns effective granular capabilities for the current user.
3. API mappers that redact forbidden fields.
4. UI rendering that consumes capability metadata.
5. Patch-based mutation contracts that omit forbidden or unloaded fields.
6. Regression checks for allowed and denied roles.

Suggested helper names:

```ts
resolveCapabilities(context, resource)
redactStockRequisition(row, capabilities)
assertCanSubmitFields(payload, capabilities)
```

Keep the implementation generic, but keep each module's protected field list explicit. Avoid dynamic string guesses for sensitive fields.

## Rollout Checklist

For each module:

- Identify sensitive fields, columns, widgets, summaries, exports, and derived values.
- Add granular permission names and seed them.
- Update the role permission UI to assign them.
- Update list/detail/report APIs to redact protected values.
- Update create/edit APIs to validate submitted protected fields.
- Update UI tables, cards, forms, and export buttons to use capabilities.
- Verify denied users cannot see the value in DevTools network responses.
- Verify denied users can still perform allowed CRUD operations without sending redacted fields.
- Verify allowed users still see and edit the protected values where appropriate.
- Run lint and build before rollout.

## Deny By Default

Granular permissions are deny-by-default. If a field, widget, or operation is declared protected and the user's capability is missing, the system must treat it as denied.

Do not add temporary compatibility fallbacks that expose protected data when permissions are missing, stale, or not yet seeded.
