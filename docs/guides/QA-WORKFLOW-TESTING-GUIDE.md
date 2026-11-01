# QA Workflow Testing Guide

## Sign-in Recovery

- On native mobile and web, submit incorrect credentials and confirm the message asks you to check
  the email and password. A temporary service failure must ask you to retry later, without showing
  technical server text or incorrectly claiming the password is wrong.
- Test an unconfirmed email, an unavailable account, and too many attempts. Each should explain
  whether to confirm the email, contact the administrator, or wait before retrying.
- Try signing in with the service unavailable, then with the network disconnected. Both should show
  neutral service guidance asking you to try again later, without blaming your internet connection.
  Simulate a stalled response and confirm the same guidance appears and the form becomes usable
  after the 20-second timeout. A plain-text or HTML server error must also produce readable guidance.
- After a failure, confirm credentials remain entered, editing either field clears the message,
  retrying clears the old message, and repeated taps while signing in send only one attempt.
- Check web guidance in English and Chinese, and native guidance in English. Check long messages
  wrap within the form on a narrow screen and that a screen reader announces the native alert.
- Repeat a successful login to confirm the existing destination and account access remain intact.
- Compare login before and after optimization with accounts that have different roles and access.
  Confirm each still lands on the same screen and sees the same allowed modules and restricted fields.
  Repeat after changing the selected business unit, and with an account that has no accessible modules.
- Measure sign-in through the loaded destination screen, including session setup and fresh dashboard
  data. Record the HTTP request separately, distinguish warm and cold runs, and identify whether
  mobile measurements use a debug emulator or a release build on a physical device.
- On the mobile-browser van-sales login, an account without a van warehouse should be directed to
  its supervisor for assignment.

## Sign-out Cleanup

- From the web dashboard, open the user menu and log out. Confirm the sign-in screen appears and no
  new warehouse-dashboard, business-unit, preferences, permissions, or notification reads start
  after the logout action. Observe beyond the dashboard's 30-second refresh interval.
- Log out while a read is pending. Confirm it is cancelled in the browser and does not retry or
  repopulate the previous account's state. A request already received by the server may still finish
  and appear in server completion logs; distinguish it from a newly started browser request.
- Repeat the logout click and confirm only one sign-out operation runs. Simulate sign-out failure
  and confirm local user, business-unit, permission, and query state still clears.
- Use browser Back after logout and confirm the previous user's dashboard is not restored. Sign in
  again and confirm the normal destination, profile, role, business-unit scope, and permissions are
  retained, with fresh preferences for the signed-in account.

Verified on November 1, 2026, through the real web sign-in and user-menu logout: no protected API
reads started during more than 108 seconds of observation after logout. Only the existing
authentication sign-out and login-page navigation ran; the existing global sign-out scope was
retained. Automated regressions cover pending-read cancellation, repeated logout, failed sign-out
cleanup, stale auth responses, and preservation of the current account's profile and role.

This document explains, module by module, **what the end user does and what happens**, and — for the records everything else depends on — **what's required before it can be created and what happens if it's edited or removed while in use**. It's written for QA to build test scripts from: no code, no file paths, just screens, fields, buttons, and behavior.

The guide has two parts:

- **Part 1 — Master Data & Setup**: the foundational records (Items, Suppliers, Customers, Warehouses, Locations, Users & Roles, etc.) that every transaction is built on top of. These don't move through a multi-stage lifecycle the way orders do, but getting their required fields, validation rules, and "what if I delete this while it's in use" behavior right is just as testable — arguably more likely to hide bugs, since it's assumed to be "just a form."
- **Part 2 — Transactional Workflows**: the order/request/production modules that move through a stage-by-stage lifecycle (the original scope of this guide).

Each **master data** module follows this shape:

- **Purpose** — why this record exists; what breaks or can't happen downstream without it.
- **Entry point** — where in the app you create one.
- **Required fields** — what must be filled in to save it, called out separately from optional fields.
- **Validation rules** — format rules, uniqueness checks, anything that can produce an error message.
- **What must already exist first** — its dependencies.
- **Edit / deactivate / delete behavior** — specifically, what happens if you try to remove or deactivate a record that other things already point to.
- **Things to test**.

Each **transactional workflow** module follows this shape:

- **What it's for** — one-line purpose.
- **What must exist first** — the master data and/or other records this depends on.
- **How a record starts** — the entry point.
- **Stages** — the full lifecycle, in order, ending with the end states.
- **Step-by-step workflow** — numbered, one step per user action, naming the button/action, what has to be true before it's allowed, and what happens after.
- **Who can do it** — the permission gate.
- **Things to test** — edge cases, known gaps, and side effects worth verifying explicitly.

> **Read this first:** a handful of modules have stages, fields, or entire screens that were designed but never fully finished. These are called out explicitly, usually with a note like "not reachable" or "no such screen exists." Don't fail a ticket because you can't find a button or a create-form for one of these — it means the feature was designed but not completed, and it's a product question, not something you're missing. Where this applies, the guide tells you exactly what to do instead (usually: this has to be set up directly in the system by an administrator/developer before testing can start).

---

## Table of contents

**Part 1 — Master Data & Setup**

1. [Items](#1-items)
2. [Item Categories](#2-item-categories)
3. [Units of Measure](#3-units-of-measure)
4. [Suppliers](#4-suppliers)
5. [Customers](#5-customers)
6. [Warehouses](#6-warehouses)
7. [Warehouse Locations](#7-warehouse-locations)
8. [Business Units](#8-business-units)
9. [Users, Roles & Permissions](#9-users-roles--permissions)
10. [Transformation Templates (Recipes)](#10-transformation-templates-recipes)
11. [Company & System Settings](#11-company--system-settings)

**Part 2 — Transactional Workflows**

12. [Stock Requests](#12-stock-requests) (internal warehouse-to-warehouse transfer request)
13. [Delivery Notes](#13-delivery-notes) (dispatch & receiving)
14. [Pick Lists](#14-pick-lists) (warehouse picking, web + mobile)
15. [Stock Transformations](#15-stock-transformations) (recipe-based production)
16. [Stock Adjustments](#16-stock-adjustments)
17. [Load Lists](#17-load-lists) (shipment tracking → triggers goods receiving)
18. [Stock Requisitions](#17b-stock-requisitions) (supplier purchase request)
19. [Goods Receipt Notes](#18-goods-receipt-notes) (web + mobile)
20. [Putaway Station](#19-putaway-station) (shared final-placement step)
21. [Reorder Management](#20-reorder-management) (low-stock alerts → requisition)
22. [Sales Quotations](#20b-sales-quotations)
23. [Sales Orders](#21-sales-orders)
24. [Sales Invoices](#22-sales-invoices) (including recording payments)
25. [Frame Job Orders](#23-frame-job-orders) (chop-and-join production)
26. [Manufacturing Orders](#24-manufacturing-orders--manufacturing-floor)
27. [POS Transactions](#25-pos-transactions)

**Part 3 — Accounting & Reporting** (mostly reachable only by direct URL — see the note at the start of that part)

28. [Journal Entries](#26-journal-entries)
29. [Chart of Accounts](#27-chart-of-accounts)
30. [General Ledger & Trial Balance](#28-general-ledger--trial-balance)
31. [Stock Ledger](#29-stock-ledger)
32. [Reports Directory](#30-reports-directory)
33. [Warehouse Dashboard](#31-warehouse-dashboard)
34. [Activity Logs](#32-activity-logs)

35. [Things every tester should check on every module](#things-every-tester-should-check-on-every-module)

---

# Part 1 — Master Data & Setup

These are the records everything else in the app is built on. Before testing any transactional workflow (a Sales Order, a Stock Request, a Load List...), the master data it needs has to already exist and be correctly set up — this section tells you what that is, per record type, and what to check when creating, editing, or trying to remove one.

---

## 1. Items

**Purpose**: the item (product) record is the anchor for everything else — every stock movement, every line on a Purchase Order/Sales Order/Stock Request, every pick, every transformation, and every POS sale refers back to an item. Nothing downstream can be tested without items existing first.

**Entry point**: Inventory → Items → **New Item**.

**Required fields**:

- **Item Code** — you type this yourself; it is **not** auto-generated. Letters, numbers, spaces, and hyphens only — the field automatically converts what you type to uppercase as you go. Must be unique; a duplicate code is rejected with a clear "already exists" error.
- **Item Name**.
- **Item Type** — Raw Material, Finished Good, Asset, or Service. Choosing Service means the item is treated as non-stock (it never carries a quantity).
- **Base Unit of Measure** — must be chosen from the existing list (see Units of Measure, section 3 — these can't be created from the Items screen).
- **Category** — the form requires you to pick one, though technically the system would still accept an item without a category if the request were made a different way (i.e., the requirement is enforced by the screen, not underneath it). Worth testing directly if you have a way to bypass the form.
- **List Price** (the sales price) — required, cannot be negative.

**Optional fields**: supplier's own code for the item, a Chinese name, description, dimensions, purchase price, import cost and import currency, reorder level/quantity, and a "standard order/production quantity" field that's only visible to certain roles (see below).

**Validation rules**:

- If you fill in an Import Cost, Import Currency becomes required too (a 3-letter currency code).
- The "standard order/production quantity" field only appears for users with a specific extra permission — if a tester without that permission is somehow given a value for this field (e.g., by another means), the system will refuse it.

**Extra units / packaging (e.g. "BOX (144)")**:

- Every item automatically gets one "base" unit option the moment it's created — this is just its base unit of measure at a 1:1 ratio, marked as the default.
- From the item's own detail page, you can add more unit options — e.g. add "BOX" with a conversion of 144 to the base unit. The system automatically labels this as something like **"BOX (144 PCS)"** unless you type your own label. This is what lets a purchase be entered "in boxes" while stock is tracked in pieces underneath.
- Only one unit option can be the default at a time — setting a new default un-sets the previous one automatically.
- You cannot add the same unit + conversion combination twice — it's rejected as a duplicate.
- Each unit option can carry its own barcode.
- Note: an older "packaging" feature that used to exist for items has been fully removed — if you find old documentation referring to it, ignore it; that screen/feature no longer works.

**What must already exist first**: a Category and a Unit of Measure both need to already exist in the system before you can create an item (see sections 2 and 3 — neither of these can be created from within the app itself; more on that below).

**What's required before an item can actually be used in a transaction**: nothing extra — as soon as an item is saved with the fields above, it can immediately be added as a line on a Purchase Order, Stock Request, etc. However, a brand-new item will show **zero on-hand and zero available stock** in every warehouse until it's actually received or adjusted into stock somewhere for the first time — there's no separate "activate this item for this warehouse" step; the stock record is created automatically the first time stock actually moves for it.

**Edit / deactivate / delete behavior**:

- Deactivating an item (toggling it off) is instant — **there is no warning shown even if the item has open orders, requests, or existing stock.** Once deactivated, the item stops appearing in new-transaction pickers/search, but anything already referencing it (existing orders, historical transactions) is unaffected and can still be processed normally.
- Deleting an item is also allowed with **no check at all** for whether it's currently in use — you can delete an item that has active stock or open orders referencing it. It disappears from all "create new" flows immediately; existing historical records that reference it should be unaffected, but this is exactly the kind of thing worth deliberately testing (delete an item that has an open Purchase Order line, then check whether that PO still displays/behaves correctly).
- Once created, the item code **cannot be changed**.
- Depending on the tester's role, pricing fields (purchase price, import cost, list price) may show as blank/hidden even when the item actually has values set — this is intentional data-hiding for roles without a pricing-visibility permission, not a bug, but confirm it's actually hidden rather than just visually blank.

**Things to test**:

- Try to save an item code with lowercase letters or punctuation other than a hyphen — should be rejected or auto-corrected.
- Try to create two items with the same code — second one should be refused.
- Add a second unit option to an item (e.g. "BOX" = 144 base units) and confirm the auto-generated label looks right, and that switching the default unit option actually changes which one shows as default elsewhere.
- Deactivate an item that has an open Purchase Order or Stock Request line and confirm the existing order is unaffected, but the item can no longer be picked for anything new.
- Delete an item that has existing stock and/or open orders and see what actually happens to those records — this has no built-in protection, so it's worth deliberately probing for broken displays.
- Log in as a role without pricing visibility and confirm purchase price / list price genuinely don't leak anywhere (exports, printouts, etc.), not just the main screen.

---

### Move Stock from the Item Locations tab

Open an item's **Locations** tab and click **Move Stock**. Choose source and destination
warehouses/racks in the current business unit, then enter a positive quantity in the item's base
unit with at most two decimal places. The move posts immediately. `create` access to both Stock
Transactions and Location Transfers is required; the button is hidden without either permission.

- Move to another warehouse in the same business unit, including a warehouse that does not yet
  hold the item. Confirm source decreases, destination increases, and total on-hand is conserved.
- Move between two racks in the same warehouse and confirm warehouse and batch totals are unchanged.
- Use multiple source batches and confirm FIFO consumption and original batch codes and receipt
  dates. A warehouse move posts linked Out and In entries, with one line per consumed batch at each
  warehouse; confirm both warehouses' ledger totals and closing balances. A rack move posts one
  Transfer entry with no warehouse balance change. Reservations and pending putaway stay at source.
- Confirm warehouse and rack pickers initially load at most five server-filtered options and
  changing a warehouse clears its rack selection. Switching business units clears the open move's
  selections and loads warehouse options for the new unit.
- Try the same source/destination rack, a nonpositive quantity, more than two decimal places, and
  quantities above 1,000,000,000. Submission must remain disabled with applicable validation guidance.
- Submit more than the available source-rack quantity. Confirm actionable inline guidance, an open
  dialog, and no partial movement, destination balance, batch, or stock history.
- Try a destination with the same batch code and a different receipt date. Confirm the move fails
  without merging those batch identities or changing source inventory.
- In direct API checks, reject warehouses from another business unit, inactive warehouses,
  inactive/non-storable racks, racks belonging to the wrong warehouse, client-supplied unit costs,
  and missing Stock Transactions or Location Transfers create permission.
- During a pending move, confirm editing, repeat submission, Cancel, and dialog dismissal cannot
  interrupt or duplicate the request. Confirm balances and movement history refresh after success.

For authenticated database checks and an injected failure after batch writes, run
`supabase/tests/stock-move.sql` against a coordinated seeded local database after applying migrations.
The script rolls back all fixtures and changes. Focused API and dialog checks are in
`src/app/api/stock-transactions/route.test.ts` and
`src/components/items/locations/MoveStockDialog.test.tsx`.

## 2. Item Categories

**Purpose**: groups items for filtering/searching and reporting.

**Entry point**: **There isn't one.** There is no screen anywhere in the app to create, rename, or remove a category — the only thing the app does with categories is let you _pick_ an existing one when creating/editing an Item, and filter by it in lists.

**What this means for testing**: if your test plan calls for "create a new category," that's not something you can do through the product today — categories have to already exist (set up by whoever configures the environment) before testing starts. What you _can_ test: that the Item form requires you to pick a category, and that the item list correctly filters by category.

**Things to test**:

- Confirm the category dropdown on the Item form only lets you pick from existing categories (no free-text/"create new" option).
- Filter the Items list by category and confirm only matching items show.

---

## 3. Units of Measure

**Purpose**: defines the measurement unit every item is tracked in (pieces, kilograms, boxes, etc.) — this is what the item's "extra units/packaging" conversions (section 1) are built on top of.

**Entry point**: **There isn't one, same as Categories.** No screen exists to create/edit/remove a Unit of Measure — they must already exist before item creation can happen, and testers can only select from the existing list.

**Important distinction**: there is no separate "purchase unit" vs. "sales unit" concept at the item level — an item has exactly one base unit. Anything like "buy in boxes, track in pieces" is handled entirely through the item's own unit options (section 1), not through a second unit assigned to the item itself.

**Things to test**:

- Confirm the Unit of Measure dropdown on the Item form only offers existing, active units.
- If you're able to deactivate a unit of measure in the environment's setup data, confirm it disappears from the dropdown for _new_ items but doesn't break any _existing_ item that already uses it.

---

## 4. Suppliers

**Purpose**: the vendor record used on Purchase Orders, Stock Requisitions, and Goods Receipt Notes. A supplier's email address and preferred language specifically matter for one workflow — see below.

**Entry point**: Purchasing → Suppliers → **New Supplier** (a pop-up form).

**Required fields (as enforced by the form)**: Code, Name, Contact Person, Email (must be a valid email format), Phone, full billing address (address/city/state/postal code/country), Payment Terms (Cash on Delivery, or Net 7/15/30/45/60/90), Language (English or Chinese — defaults to English), Status (Active/Inactive/Blacklisted — defaults to Active).

**Optional fields**: mobile number, website, tax ID, a separate shipping address, credit limit, bank details, notes.

**Validation rules**:

- The New Supplier form requires a Code. Leaving it blank prevents submission, so code generation cannot be tested through this pop-up.
- The New Supplier form also requires a valid Email. Blank or malformed email values are rejected before submission.
- **Important gap to test**: the required-field list above is enforced by the on-screen form, but if a request were made a different way (bypassing the form), most of those "required" fields aren't actually double-checked — meaning it may be possible to end up with a supplier missing a contact person or address if something submits data outside the normal screen. Worth flagging if you find a way to reproduce this (e.g. via an import tool, if one exists).

**Why the supplier's email and language matter**: when a Stock Requisition (section 17b) is sent, the app emails that supplier the itemized request, using whichever language is set on the supplier record.

**Bypass-only checks (not New Supplier form tests)**:

- The supplier API contains a fallback that generates a sequential Code when a direct request omits it. Test this only when direct API testing is in scope; the form cannot reach this path.
- A supplier with an empty Email can only be introduced through a direct request or preconfigured test data. With such a supplier, sending a Stock Requisition still succeeds without sending an email or warning the user. Test this only with bypass-created data, not through the form.

**What must already exist first**: nothing — a supplier can be the very first record you create in a fresh environment.

**Edit / deactivate / delete behavior**:

- **Delete is correctly blocked if the supplier has any existing Purchase Orders** — you'll get a clear error telling you to delete/reassign those orders first. This is one of the few master-data types in this app that actually protects itself this way.
- If a supplier has no Purchase Orders at all, deleting it succeeds (and can't be undone from the UI).
- Editing a supplier — including changing payment terms or credit limit — is never blocked, even while it has open orders.
- Once created, a supplier's code cannot be changed.
- Setting status to Inactive or Blacklisted removes it from the normal supplier picker used when creating new Purchase Orders, but has no effect on POs already open against it.

**Things to test**:

- Try to delete a supplier that has an open Purchase Order — confirm it's refused with a clear message.
- Delete a supplier with no orders — confirm it succeeds.
- Set a supplier to Blacklisted and confirm it disappears from the picker on new Purchase Orders, while an already-open PO against it is untouched.

---

## 5. Customers

**Purpose**: the buyer record used on Sales Quotations, Sales Orders, Sales Invoices, and POS.

**Entry point**: Sales → Customers → **New Customer** (a pop-up form).

**Required fields**: Customer Type (Individual, Company, or Government), Code (letters/numbers/hyphens only), Name, Email, Phone, full billing **and** shipping address (both required — unlike Suppliers, where shipping address is optional), Payment Terms (Cash, Net 30/60/90, Due on Receipt, or Cash on Delivery — a different list from Supplier payment terms), and Credit Limit (a number, zero or more).

**Validation rules**:

- Customer Code must be unique — duplicates are rejected.
- Setting a Credit Limit above zero automatically sets Credit Days to 30; a Credit Limit of exactly zero sets Credit Days to 0.
- **Credit Limit is not actually enforced anywhere** — a customer with a $0 limit and existing unpaid invoices can still have new quotations, orders, and invoices created against them with no warning shown. If you expected a credit-limit block, this is a documented gap, not something you're missing.
- Same caveat as Suppliers: the "required" list above is enforced by the on-screen form; a request made a different way may not be double-checked for all of them.

**What must already exist first**: nothing.

**Edit / deactivate / delete behavior**:

- **Delete has no protection at all** — unlike Suppliers, you can delete a customer that has open quotations, orders, or unpaid invoices referencing it, with no warning. This is an inconsistency worth calling out explicitly: Suppliers block deletion when in use, Customers do not.
- Deactivating removes the customer from new-transaction pickers but doesn't affect anything already created against them.
- The customer's running balance shown on their record is calculated live from their unpaid invoices — it isn't something you set directly, and it updates automatically as invoices are paid or added.
- Users with **View Customer Special Prices** can open the customer's **Special Prices** tab. Users with **Manage Customer Special Prices** plus customer edit access can create, edit, deactivate, and delete an item-tier override. Item and tier cannot be changed after creation; create a new record if that identity must change.

**Things to test**:

- Create an invoice for a customer, then delete that customer, and confirm what happens — expect no error or block, then check whether the existing invoice still displays correctly.
- Set a very low or zero credit limit on a customer with existing unpaid invoices and confirm new sales orders/invoices can still be created for them without any warning.
- Configure Customer A with Item A WS 35 and SRP 40, and Customer B with Item A WS 45 and SRP 55. Confirm each customer's Special Prices list is isolated and server-side search/status/tier filters return only matching records.
- Try to create overlapping active date ranges for the same customer, item, and tier; the second record must be rejected. Confirm a future, expired, inactive, or deleted override is not used for today's sale.
- Verify a role with View but not Manage can see the tab without mutation controls. A sales user without View must not see the configuration tab, but customer-specific prices should still resolve in authorized sales entry screens.
- Confirm the customer's balance shown on their record updates correctly after recording a payment on one of their invoices.

---

## 6. Warehouses

**Purpose**: the physical or logical stock location that every inventory transaction happens "in" — Stock Requests, Goods Receipts, Pick Lists, Adjustments, and van-sales vehicles are all scoped to a warehouse.

**Entry point**: Inventory → Warehouses → **New Warehouse** (a pop-up form).

**Required fields**: Code (letters/numbers/hyphens only, must be unique), Name.

**Optional fields**: address, city, state, postal code, country, phone, email, manager name.

**Business unit note**: a warehouse is created under whichever business unit/branch is currently active for the user creating it, and **this cannot be changed afterward** — there's no field anywhere to move a warehouse to a different business unit once it exists. If you need a warehouse under a different business unit for testing, you must switch your active business unit _before_ creating it.

A business unit can own multiple warehouses. The business unit remains the active application and
permission context; warehouse selection only identifies the inventory location. Create at least two
active warehouses under one business unit when testing aggregation and warehouse-specific
workflows.

**Automatic setup**: every new warehouse automatically gets one default storage location called "Main" — a general-purpose rack marked as active, pickable, and storable. Any stock movement that doesn't specify an exact shelf/location lands here by default. You don't create this yourself; it's there the moment the warehouse is.

**What must already exist first**: you must have an active business unit context selected (the app will refuse to create a warehouse otherwise).

**Edit / deactivate / delete behavior**:

- **Delete has no protection at all** — a warehouse can be deleted even while it has current stock, open Stock Requests, or an active pick list pointing at it. This is the same gap as Customers. Worth deliberately testing: put some stock in a warehouse, delete the warehouse, and see what the stock/inventory reports do afterward.
- Deactivating removes it from the warehouse picker on new transactions but doesn't affect anything already scoped to it.
- The warehouse code cannot be changed once created.

**Things to test**:

- Give a user access to Business Unit A and Business Unit B. While A is active, confirm Warehouse
  Management lists only A's warehouses. Switch to B and confirm A's rows disappear immediately and
  B's warehouses are fetched.
- While Business Unit A is active, directly open, edit, or delete the URL/API identifier of a
  Business Unit B warehouse. Confirm the operation returns not found and does not expose or change
  the other unit's warehouse.
- Create stock in a warehouse (receive something into it), then delete the warehouse, and check whether stock reports/item detail pages still behave sensibly afterward.
- Confirm a warehouse created while Business Unit A is active cannot later be reassigned to Business Unit B.
- With two warehouses in Business Unit A, confirm item lists and inventory reports show their combined stock when no warehouse filter is selected.
- Confirm warehouse-specific screens require a warehouse and never silently choose the first warehouse.
- Confirm the automatic "Main" location exists immediately after creating a new warehouse, without any extra setup step.

---

## 7. Warehouse Locations

**Purpose**: sub-divisions within a warehouse (a specific bin, shelf, rack, or staging area) — this is the level of detail used for Putaway placement and for tracking exactly which shelf a batch of stock physically sits on.

**Entry point**: Inventory → Warehouses → open a warehouse → Locations tab → **New Location**.

**Required fields**: Code only.

**Optional fields**: Name, a parent location (for nesting, e.g. a shelf inside a rack), Location Type (Bin, Zone, Aisle, Rack, Shelf, Crate, Staging — defaults to Bin), Maximum Capacity for storable locations, and three switches that all default to "on": Active, Pickable, Storable.

**Validation rules**: the location code only needs to be unique _within its own warehouse_ — the same code (e.g. "A1") can exist in two different warehouses without conflict. A duplicate within the same warehouse is rejected.

**What the Pickable/Storable switches actually do — important, and not what you might expect**:

- **Storable** is checked by the screens that let you choose a destination when placing stock (Putaway, and box handling during goods receiving) — turning it off removes the location from those destination pickers **on screen**. However, this has not been confirmed to be enforced anywhere beneath the screen — if there's a way to submit a placement request that bypasses the picker, it's worth testing whether a non-storable location is still silently accepted.
- **Pickable does not currently do anything.** Despite the name and despite it being a real switch on the location form, the actual picking logic used by Pick Lists does not check this flag at all — a location marked "not pickable" is still fully usable as a picking source today. This is a confirmed defect, not a hedge: mark a location not-pickable and it will still be offered and usable in a real Pick List. Report it as a bug if you confirm the same in your test environment; don't treat "not pickable" as meaning what it sounds like it means.

**What must already exist first**: the warehouse it belongs to.

**Seeded multi-rack scenario**: when imported opening-balance items are available, the first eligible existing whole-quantity `STICK` item in Warehouse B (`WHB-002`) is distributed across Rack A–D while preserving its original total. Rack A receives the whole-unit floor of 40% and remains the preferred rack, Rack B receives the floor of 30%, Rack C receives the floor of 20%, and Rack D receives the remaining whole sticks.

**Edit / deactivate / delete behavior**:

- **There is no delete for a location at all** — only editing, including toggling it inactive. If your test plan calls for "delete a location," that action doesn't exist in this app; deactivating is as close as it gets.
- Deactivating a location that currently holds stock has **no special handling or warning** — nothing stops you, and it's not clear the stock is protected in any way afterward. Worth testing directly: put stock in a location, deactivate the location, and see what shows up in stock views afterward.

**Things to test**:

- Mark a location as not-pickable, try to pick against it in a real Pick List, and confirm it's incorrectly still usable — file this as a defect, since it's already been confirmed to reproduce.
- Mark a location as not-storable and confirm it disappears from the Putaway destination picker; if you have any way to submit a placement directly rather than through the picker, test whether that bypass still succeeds.
- Create two locations with the same code in two different warehouses — should be allowed. Try the same code twice in the _same_ warehouse — should be refused.
- Configure a maximum above the current on-hand quantity and confirm the location is Partially Occupied with the expected percentage. Set it equal to and below on-hand quantity to confirm Full and Over Capacity states.
- Leave a storable location's maximum blank and confirm it is reported as Not Configured and excluded from the dashboard utilization calculation.
- Put stock into a location, deactivate it, and see whether the stock is still shown/handled sensibly.

---

## 8. Business Units

**Purpose**: the top-level "branch/division" scope that warehouses, customers, and most permissions sit underneath. Most of what a user sees in the app is implicitly filtered by whichever business unit they currently have active.

**Entry point**: **There isn't one for creating a business unit itself.** The only screen related to business units lets you edit _settings_ for the currently active one (Admin → Settings → Business Unit) — it does not create new business units or edit which ones exist. New business units must be set up outside the app. An administrator grants an existing user access by assigning that user a role for the business unit under Admin → Users → Manage Roles.

**Switching business units**: there is a switcher in the app that lets a user with access to more than one business unit change which one is currently active. This is a genuinely testable action.

**Things to test**:

- Switch your active business unit and confirm that item lists, warehouse lists, etc. immediately reflect the new business unit's data without needing to fully reload the app.
- Try to switch into a business unit you don't have access to (if you can simulate this) and confirm it's refused.
- Confirm a user only ever sees the business units they've actually been granted, not every business unit in the company.
- Assign the test user its first role in another business unit and confirm that unit immediately becomes available in the switcher.
- Assign two roles in the same business unit, remove one, and confirm access remains because another role is still assigned there.
- Remove the final role for a business unit and confirm that unit disappears from the switcher. If it was current or default, confirm another accessible unit becomes current/default.
- Force or simulate a role-assignment failure and confirm neither the role nor business-unit access is partially saved.

---

## 9. Users, Roles & Permissions

**Purpose**: controls who can see and do what, across every module in this guide. This is directly testable and important — most of the "who can do it" sections throughout this guide depend on getting this right.

**Creating a new user account**: **this cannot be done from within the app.** There is no "Create User" button anywhere. Self-service sign-up is also explicitly turned off — attempting it shows a message saying to contact an administrator. New user accounts have to be provisioned by whoever administers the environment, outside the normal app screens, before a tester can log in as that user. Once an account exists, the Admin → Users screen lets you:

- Search/filter existing users by active/inactive.
- Assign or remove roles for a user.
- View (read-only) exactly what permissions a user currently has, as a result of their role(s).
- Activate or deactivate a user.

**Creating/managing Roles**: Admin → Roles → **New Role**. Only a Name is required; Description and an initial set of permissions to attach are optional.

**Validation rules**:

- Role names must be unique.
- **Built-in system roles cannot be edited or deleted** — the app blocks this both by disabling the buttons and by refusing the action if attempted anyway.
- **A role cannot be deleted while any user still has it assigned** — you'll get a clear error telling you to remove it from all users first. This one is properly protected, unlike several of the master-data types above.
- Every Create, Edit, Delete, or granular permission depends on View access to its parent module. Selecting another module action automatically selects View. Clearing View clears the module's other actions and granular permissions. The server rejects an invalid combination if the screen is bypassed.
- Permission saving is atomic: if any selected permission is invalid or saving fails partway through, the role keeps its complete previous permission set.

**Things to test**:

- Confirm there's genuinely no way to self-register or create a user from inside the app — this should be treated as expected behavior, not a bug to report.
- Build a custom role with a narrow set of permissions, assign it to a test user, and confirm that user only sees the menu items and can only perform the actions that role actually grants — including trying the restricted actions directly, not just checking that buttons are hidden.
- Select Create, Edit, or Delete while View is clear and confirm View is selected automatically. Then clear View and confirm every other module action and granular child is cleared.
- Enable a granular capability and confirm parent View is selected automatically. For capabilities documented as requiring parent Edit, confirm Edit is selected too; least-privilege GRN receiving and load-list operations should retain parent View without broad Edit.
- Force a permission-save failure and confirm the dialog remains open, gives corrective guidance, and leaves the role's previous permission set unchanged.
- Confirm assigning a role also grants access to that role's business unit. Removing the final role in that business unit must revoke access, while removing one of several roles must not.
- Try to delete a system role — should be blocked.
- Try to delete a custom role that's still assigned to at least one user — should be blocked with a clear message.
- Delete a custom role that has no users assigned — should succeed.
- Deactivate a user and confirm they can no longer log in (not just that they look "inactive" somewhere).

---

## 10. Transformation Templates (Recipes)

**Purpose**: the reusable "recipe" that Stock Transformations (section 15) and Manufacturing Orders are built from — e.g., "1 roll of fabric becomes 10 cut pieces, plus some scrap." There are two kinds: a plain **recipe** (a straightforward list of inputs and outputs), and a **sheet layout** (a visual designer for cutting pieces out of a sheet, used for frame/glass-style work).

**Entry point**: Manufacturing → Transformations → Templates → **New Template**, or the visual Designer for sheet-layout templates.

**Required fields**:

- Template Name, always.
- Template Code — you must supply one for a plain recipe; for a sheet-layout template, if you leave it blank the system generates one automatically.
- **For a recipe**: at least one input item (with quantity and unit) and at least one output item (with quantity, unit, and whether it's flagged as scrap).
- **For a sheet layout**: the sheet's width, height, and unit of measurement, plus at least one mapped section in the visual layout. The "input" is the sheet item itself; outputs are built automatically from however you've mapped pieces in the layout.

**Validation rules**:

- The same item cannot appear as both an input and an output on the same template.
- You cannot list the same item twice within inputs, or twice within outputs.
- Template codes must be unique.
- Quantities must be greater than zero.

**What must already exist first**: the items used as inputs/outputs.

**Create-from options**:

- **Blank template** starts with empty template details.
- **Existing template in this business unit** lists active templates of the same kind owned by the
  current business unit.
- **Template from another business unit** lists active templates of the same kind from other
  business units in the same company.
- In the sheet-layout designer, the **Input Material** card is shown only for a blank template.
  Copies retain the source template's input material without showing the selector.
- Selecting a source copies its editable values into the form. A plain recipe requires a new unique
  template code; the sheet-layout designer generates a new code when saved.
- Saving creates a new active template owned by the current business unit. It is independent: later
  edits, deactivation, or deletion of the source do not change the copy, and editing the copy does
  not change the source.
- The existing Stock Transformations `create` permission controls blank creation and both copy
  options. Copying does not grant access to manage the source business unit's template.

**Locking behavior once a template has actually been used**:

- The first time a template is used in an actual Transformation order, it becomes **locked**. From then on, you can no longer change its name, description, image, or its input/output list — attempting to will show a clear message explaining it's locked because it's in use, and telling you how many orders are using it. **The only thing you can still change on a locked template is whether it's active or inactive.**
- **Deleting a template that's been used at least once is blocked outright**, with a message naming how many orders use it.
- A template that has never been used can still be freely edited or deleted.

**Things to test**:

- Create a template, use it once in a real Transformation, then try to edit its input/output list — should be refused with a message explaining it's locked.
- Try to delete that same used template — should be refused, naming how many orders reference it.
- Confirm you can still toggle a used/locked template active/inactive without issue.
- Delete a template that's never been used — should succeed with no restriction.
- Try creating a template with the same item as both an input and an output — should be refused.
- Copy an active current-BU template, modify its name, code, quantities, and materials before saving,
  then confirm the source is unchanged.
- Copy an active template from another BU and confirm the copy is active and owned by the current BU.
- Switch to a non-default BU, copy an active template from the default BU, and confirm it appears
  under **Template from another business unit** even when the session must use the selected-BU
  database fallback.
- Confirm inactive, deleted, and different-company templates never appear as copy sources.
- Edit or deactivate the copied template and confirm the source remains unchanged; then edit the
  source and confirm the copy remains unchanged.
- Confirm a user without Stock Transformations `create` permission cannot list or load copy sources.

---

## 11. Company & System Settings

**Purpose**: company-wide profile information (legal name, tax ID, base currency, etc.), plus a set of module-specific settings groups (inventory behavior, financial, security, POS, workflow) that quietly affect how other modules behave without being part of any individual record.

**Entry point**: Admin → Settings, with separate tabs per settings group (Company, Inventory, Financial, Security, etc.).

**Fields worth knowing about for testing**:

- Company Code cannot be changed once set (same immutable-code pattern as Items/Suppliers/Warehouses).
- The Inventory settings group includes things like a company-wide default unit of measure, low-stock and critical-stock thresholds, how stock is valued, whether negative stock is allowed, and — worth calling out specifically — a **default pricing tier** setting. This setting decides which price actually shows as an item's "list price" when that item has multiple price tiers configured; if there's no matching tier price, it falls back to the item's own plain sales price.
- The **Workflow** settings tab has toggles that look like they should require manager approval before certain documents can proceed — specifically "require approval" switches for Purchase Orders, Stock Requests, and Delivery Notes, plus a numeric approval threshold for Stock Requests. **None of these toggles are actually checked anywhere in the app.** Turning "Stock Request approval required" on or off has no effect on the real Stock Request workflow documented in section 12 — a Stock Request follows the same Submit → Approve path either way. Treat this as a confirmed gap, not something to keep re-testing hoping for a different result.
- The **POS** settings tab (receipt header/footer text, whether to show the logo on receipts, auto-print, discount limits, a manager-approval discount threshold, cash drawer toggle, default payment method) is real and does feed into the POS screens — this one is worth testing for effect, unlike Workflow settings above.

**Things to test**:

- Change the default pricing tier setting and confirm the Items list/detail pages correctly reflect the new tier's price for items that have tiered pricing set up.
- Confirm the Company Code field is genuinely locked/uneditable once a company profile has been saved.
- If negative stock is toggled off, confirm the app actually blocks a transaction that would take an item below zero somewhere; if toggled on, confirm it's actually allowed.
- Toggle each of the Workflow tab's "require approval" switches and confirm they have no observable effect on Stock Requests or Delivery Notes — if you ever find one of them does something, that's new information worth reporting, since it contradicts what's documented here.
- Change a POS setting (e.g. the discount limit or receipt header text) and confirm it actually shows up in the POS sale screen / printed receipt.

---

# Part 2 — Transactional Workflows

## 12. Stock Requests

**What it's for**: requesting stock from another business unit. Warehouses are inventory locations
chosen internally during fulfillment and receiving; this is not a customer sale.

> Naming note: this is different from "Stock Requisitions" (section 17b), which is a request to purchase from a supplier. Don't mix them up when writing tickets.

**How a record starts**: click **New** on the Stock Requests list page, or use **New stock request**
from the desktop quick-action rail. Both paths open the same creation form. Fill in the item(s),
quantities, and fulfilling business unit.

The current business unit is the requesting side. Select a different active business unit as the
fulfilling side; the request does not ask the user to select either warehouse. A request line
defaults to automatic FIFO allocation, or the user can optionally search for and require a specific
batch in the fulfilling business unit. The batch search loads only the first five server-filtered
matches and shows their warehouse, racks, and availability in the selected request unit. Both
business-unit choices are fixed once the draft is created, and saving a draft header plus lines is
atomic.

**Stages**: Draft → Submitted → Approved → Picking → Picked → Delivered → Received → Completed, or Cancelled / Rejected along the way.

**Step-by-step workflow**:

1. **Create** → status Draft. Nothing has moved yet; freely editable.
2. **Submit** → status Submitted. Locks the request for editing and sends it for approval.
3. **Approve** (done by someone in the _fulfilling_ business unit) → status Approved. This is the point where the request becomes actionable.
   - **Reject** is the alternative to Approve at this stage — sends it back, does not delete it.
4. From here, the actual picking and delivery happen through a linked **Delivery Note** (section 13) and **Pick List** (section 14) — not through buttons on the Stock Request itself. The status shown on the Stock Request is a read-out of how far the linked delivery has progressed, not something you click through directly.
5. **Complete** → status Completed automatically once all linked deliveries have been received.
6. **Cancel** is available any time before Completed.

**Who can do it**: the requesting business unit can create, edit, submit, and cancel its requests.
The fulfilling business unit can view submitted requests and approve or reject them. Receiving also
requires the granular delivery-note receiving capability.

**Things to test**:

- Confirm the form selects only a fulfilling business unit and does not expose source or destination
  warehouse selectors.
- Open a line's optional batch selector and confirm it initially loads no more than five eligible
  results. Search by batch, warehouse, and rack text and confirm filtering happens against the
  fulfilling business unit. Confirm each option identifies its source warehouse and displays the
  available quantity in the item's base unit.
- Change the request unit and confirm the available batch results and current batch selection do not
  change. Confirm the insufficiency error appears or clears based on requested quantity multiplied
  by the selected unit's base-unit conversion.
- Leave the batch on automatic, allocate more than one warehouse can supply, and confirm normal FIFO
  splitting across warehouses remains available.
- Select a batch stored across multiple racks, create the delivery note and pick list, and confirm
  the delivery note uses that batch's warehouse while every suggested pick rack belongs to the
  selected batch.
- Reduce the selected batch below the requested quantity before fulfillment and confirm creation
  fails without falling back to another batch or leaving a partial delivery note/reservation.
- Force a line validation error while updating a draft and confirm the previous header and all
  previous lines remain unchanged.
- Confirm a user at the requesting side cannot see or click Approve/Reject.
- Confirm a fulfilling-side user cannot see the request while it is Draft, but can see it after
  submission.
- Confirm the status shown on the Stock Request updates correctly as the linked pick list moves through its own stages (in progress, paused, done).
- Seed stock for one item in at least two warehouses in the fulfilling business unit, allocate more
  than the first warehouse can supply, and confirm the system creates one delivery note and pick
  list per source warehouse.
- Force an insufficient-stock allocation after one warehouse could have supplied part of the
  quantity and confirm no delivery notes or partial reservations remain.

---

## 13. Delivery Notes

**What it's for**: the actual dispatch-and-receive workflow — physically moving goods out of one warehouse and into another warehouse or to a customer.

**How a record starts**: on the Delivery Notes list, click **New**, then select approved Stock Request
lines. The system allocates across active warehouses in the fulfilling business unit and may create
multiple warehouse-specific delivery notes from one action.

**Stages**: Draft → Confirmed → Queued for Picking → Picking in Progress → Dispatch Ready → Dispatched → Received, or Voided.

**Step-by-step workflow**:

1. **Create** from approved Stock Requests → one Draft delivery note per allocated source warehouse.
2. **Confirm** → status Confirmed. Locks the item list.
3. **Queue Picking** → opens a dialog to assign one or more pickers; this creates a linked Pick List (section 14) and the status becomes Queued for Picking, then Picking in Progress once picking actually starts.
4. Once the pick list is fully picked and marked done, the delivery automatically becomes Dispatch Ready — there is no separate button for this.
5. **Confirm Dispatch** → opens a dialog to capture driver name, signature, helper name, plate number, and delivery time. Status becomes Dispatched. This is the point of no return for most edits.
6. **Receiving** — depends on how the delivery is set up:
   - **Business-unit stock fulfillment**: on the receiving side, a user selects an active destination
     warehouse in the requesting business unit when clicking **Start Receiving**, scans each box,
     then clicks **Submit Receiving**. If scanned quantities differ from dispatched quantities, the
     app requires explicit discrepancy acknowledgement before submission.
   - **Customer pickup at the warehouse**: instead of scan-based receiving, there's a direct "confirm the customer picked this up" action — no destination-inventory receipt is posted, because the goods left the warehouse directly into the customer's hands.
7. **Void** — available any time before Dispatched. This is a hard stop; it will refuse if anything has already been dispatched.
8. **Add Items** — even after a delivery is Dispatched, more line items can still be added to it (useful for topping up a delivery in flight). Worth testing as a deliberate edge case.

**Who can do it**: edit access to Delivery Notes covers Confirm/Queue/Dispatch/Void; receiving actions also require the granular Receive Delivery Notes permission in the receiving business unit.

**Things to test**:

- Confirm the cashier must select a warehouse before searching for items, and that the selector is
  locked while the cart contains lines.
- Switch between two warehouses in the same business unit with an empty cart and confirm item
  availability reflects only the selected location.
- Try to dispatch more than what was actually picked — should be blocked.
- Allocate 10 units, dispatch 6, and scan all 6 in mobile receiving. Confirm both the inbox and detail show `6 / 6`, not `6 / 10`. Run `supabase/tests/receiving-inbox-progress.sql` against seeded local Supabase to verify partial, full, fractional, and zero-dispatch totals with authenticated reads; its fixture changes are rolled back.
- Confirm a user cannot Start Receiving on a delivery that isn't Dispatched yet.
- Confirm the delivery-note detail shows the fulfilling business unit as the source business unit
  and the requesting business unit as the destination business unit, without displaying either
  warehouse.
- After creating a delivery note, open its detail from the fulfilling business unit. Once receiving
  scans and unexpected-item exceptions exist, switch to the requesting business unit and verify
  those rows appear only there; a user without requesting-unit membership cannot read them through
  the Data API.
- Confirm the detail page's Unexpected Items table shows Item, Unit, Qty, Status, Scanned At, and
  Reviewed At, with no Box / Batch column or internal box identifiers.
- In Receiving Overages and Unexpected Items, confirm review timestamps appear under Reviewed At,
  with `--` before review. Actions appears only while at least one row is pending review: pending
  rows show Accept/Reject, and reviewed rows show `--` rather than a date. Check all-pending, mixed,
  and fully reviewed tables, including English and Chinese headings.
- Confirm unexpected-item statuses use colored text without badge backgrounds: Pending Review
  (amber), Accepted (green), Rejected (red), and Resolved (blue). Verify proper capitalization in
  English, translated labels in Chinese, and readable colors in light and dark themes.
- Confirm the delivery-note summary status, item line states, and receiving-overage review statuses
  also use colored text with translated, properly capitalized labels and no status badge backgrounds.
  Check all delivery-note statuses, plus Voided Line, Pending Picking, Dispatched, and Dispatch Ready
  line states. Receiving overage reviews use the same Pending Review, Accepted, and Rejected colors
  as unexpected-item reviews.
- Create a delivery note for one request line, then reopen the creation dialog and confirm that the
  fully allocated request line is no longer offered. For a partially allocated request, confirm the
  Allocatable value is capped by both its remaining request quantity and current usable inventory,
  and that the Source BU banner shows the fulfilling business unit.
- Confirm Start Receiving requires a destination warehouse from the requesting business unit and
  rejects a warehouse from any other business unit.
- Confirm the mobile scan and submit controls remain unavailable until Start Receiving succeeds,
  then verify a user in the requesting business unit can scan without a false receiving-unit 403.
- On mobile, enter a box ID that cannot identify a system item. Verify the app asks for the full QR
  code, shows no unexpected-item confirmation, and saves no scan or receiving exception. Scan the
  full QR for an identified item absent from the DN: Cancel must save nothing; Confirm must record
  a pending review exception with a valid item and unit association. A full QR with an unavailable
  item must show corrective guidance and save nothing.
- Scan a system barcode for an item outside the DN and verify identification happens before
  unexpected-item confirmation. Scan a QR that identifies an expected DN item and verify normal
  counting or overage confirmation applies. Other scans and submission must remain disabled while
  item identification is pending.
- Force a scan request to fail and verify its error appears inside the confirmation dialog. Retry
  must remain available, Cancel must clear the error, and repeated taps must not send parallel scans.
- Run `supabase/tests/delivery-note-receiving-scans.sql` against seeded local Supabase to check
  rejection of unidentified items, identified unexpected-item review, expected scan counts, and
  rollback after injected exception-insert and quantity-reconciliation failures.
- Confirm the mobile app automatically selects the receiving warehouse when only one active
  warehouse is available, hides the redundant warehouse field, and enables Start Receiving without
  an extra selection tap.
- Confirm the acknowledgement warning is absent at `0 / expected` and appears only after receiving
  has started and at least one recorded quantity produces a current shortage or overage.
- Scan the same delivery-note item more than once, tap its minus action, and confirm exactly one
  received unit is removed. Confirm Submit and the other scan controls are disabled while the
  removal is pending. Repeat until zero and confirm the minus action is no longer available.
- Test the discrepancy path deliberately: receive fewer (or more, or damaged) units than dispatched and confirm the app requires an acknowledgement/reason before letting the submit go through.
- Cancelling the linked pick list _before_ dispatch should roll the delivery's status back down to Confirmed — test this reversal explicitly.
- Test both receiving paths (scan-based vs. customer-pickup) since they behave very differently.

---

## 14. Pick Lists

**What it's for**: the actual in-warehouse picking work — walking the warehouse and confirming which physical items/batches fulfil a Delivery Note.

**How a record starts**: created automatically from a Delivery Note's "Queue Picking" step (section 13) — never created standalone.

**Stages**: Pending → In Progress → Paused → Done, or Cancelled.

**Step-by-step workflow**:

1. Pick list is created already assigned to one or more pickers, status Pending.
2. Open the web detail dialog and verify every line shows its pick location: warehouse code, rack
   code, batch code, and 10-digit location SKU. The dialog is read-only for picking progress: it
   has no editable picked quantity or Start, Pause, Resume, Complete, or Save control. Cancellation
   remains available for open pick lists.
3. On mobile, **Start Picking** → status In Progress.
   Confirm each item card shows its warehouse code > rack code > batch code path without a location
   SKU or redundant "To Pick" label, while the separate Picked value still shows progress.
4. A picker taps/clicks a line item to **claim** it — this locks the line so a second picker can't work the same item at the same time. Claims expire automatically after a short window if left idle.
5. On mobile, the picker scans or manually enters the 10-digit batch-location SKU, enters the
   quantity, and confirms. The resolved item, batch code, original received timestamp, and
   fulfilling-business-unit boundary always have to match. The active business unit's Inventory
   picking policy may additionally require the allocated warehouse or the allocated warehouse and
   rack. A different SKU shows a confirmable warning only after every mandatory validation passes.
6. **Pause** → status Paused, for stepping away mid-pick. **Resume Picking** brings it back to In Progress.
7. **Complete Picking** → status Done. This is blocked if any line still has an active, unexpired claim, including a claim held by the picker attempting completion — the app will show an error rather than silently completing.
8. **Cancel Pick List** → status Cancelled. A cancellation reason is optional; leaving it blank stores no reason. Cancelling rolls back any picked-quantity progress on the linked Delivery Note, and if the delivery hadn't been dispatched yet, reverts its status too.

**Who can do it**: edit access to Pick Lists; on top of that, some users are restricted to only see/act on pick lists specifically assigned to them (check whether the test user has this restriction before assuming they should see every open pick list).

**Things to test**:

- Pull to refresh on the dashboard, picking list, and pick-list detail screens. Confirm only the
  visible screen's dashboard/list/detail requests run, with no unrelated business-unit, receiving,
  or hidden-screen requests. Switch business units and confirm operational data reloads in the new
  scope while the accessible business-unit list remains available without another request. During
  the switch, confirm no dashboard, receiving, picking, item-info, or floor-map data from the
  previous unit remains visible, and confirm a delayed response from the previous unit cannot
  repopulate the current screen. Navigate to a previously hidden screen and confirm it loads only
  after receiving focus and uses the newly selected unit.
- Two pickers, one line: confirm the second picker sees the line as "claimed by someone else" and cannot pick it themselves.
- Create a first pick list that reserves and picks part of one batch-location SKU without
  dispatching it, then queue another delivery for the same item. Confirm the second pick list sees
  only the unreserved balance at that SKU and allocates any remainder to the next eligible FIFO
  source. Verify `qty_reserved` changes together at batch and rack levels, while claiming or
  renewing the line does not increase either reservation again.
- After Delivery Note creation, confirm one active `delivery_note` ownership record exists for each
  line/source warehouse and no physical child allocation exists yet. After queuing the pick list,
  confirm its batch-location child allocation exists, its active quantity does not exceed the
  parent commitment, and the warehouse, batch, and rack projection balances match the active owned
  quantities.
- Open **Inventory → Reservations** with the fulfilling business unit selected. Confirm the Delivery
  Note commitment appears, filters and sorting are applied by the server, and pagination remains
  bounded to 10, 25, or 50 rows. Expand the commitment and confirm its pick list, batch, rack,
  location SKU, active, consumed, and released allocation values match the workflow. Switch business
  units and confirm the previous unit's rows disappear before the new request completes. A role
  without Inventory Reservations view permission must see neither the menu entry nor either API's
  data, while a view-only role must have no reservation mutation control.
- Let a claim sit idle past its expiry and confirm it becomes available to claim again.
- Try to Complete Picking first while the current picker still holds an active claim, then while another picker holds one — both attempts should be refused with a clear error, not silently completed.
- Cancel a pick list mid-way with a blank reason and confirm cancellation succeeds, no reason is stored, and the Delivery Note's status and picked-quantity totals both roll back correctly.
- Complete a pick list with less than its allocated quantity and confirm the short quantity is
  released from the suggested batch and rack. Create an incremental pick list for the outstanding
  quantity and confirm it can reserve an eligible source. Then cancel or void the completed short
  pick list and confirm the already-released short quantity is not decremented again.
- Confirm an alternative warehouse pick transfers the child allocation and parent commitment only
  once when the same mobile operation is retried. Cancelling that pick list must release the child
  allocation and restore the commitment to the planned warehouse. Dispatch must leave no active
  ownership for the delivered quantity, and voiding must release every remaining active commitment.
- In a database transaction, force a reservation validation failure after an earlier ownership or
  projection update. Confirm the transaction rolls back and both ledger ownership and cached
  `qty_reserved`/`reserved_stock` balances remain unchanged.
- Mobile: test the scan-to-verify flow specifically — the camera-captured value should be processed
  silently without appearing in the manual-entry field. An exact suggested SKU should proceed
  without a warning. A valid alternative same-batch SKU should show the confirmation card, while a
  plain item barcode, wrong item, wrong batch code, or different received timestamp must be rejected
  without an override.
- Configure a warehouse Floor Map by dragging across the suggested rack's complete footprint.
  Confirm a user with `warehouses:view` can view an existing map. Test both sides of the edit gate:
  `warehouses:edit` without `warehouses.operation.manage_floor_map.edit`, and the child capability
  without `warehouses:edit`, must both remain read-only and receive the safe
  `FLOOR_MAP_PERMISSION_DENIED` response from a direct save request. Only a user with both permissions
  can upload, draw, remove mappings, and save. Confirm inactive warehouses do not expose the Floor
  Map action and a direct floor-map URL returns the not-found state before any image upload occurs.
  While a floor-map detail page is open, switch business units and confirm the app returns to the
  warehouse list without retrying the previous warehouse's floor-map request or briefly displaying
  its cached map in the new scope.
  Confirm a click without a meaningful drag is rejected, the editor previews the full rectangle,
  and **View Map** on the mobile pick line highlights the complete rack with a blinking red overlay
  rather than showing a point marker. Confirm both the editor and mobile viewer show each mapped
  rack's name inside the rectangle, run labels along the rack's long axis without overflowing, and
  stop the blinking highlight when the viewer closes. Before saving, map several racks, search for
  and select another rack, and confirm the earlier unsaved rack labels and Mapped racks entries remain
  visible.
  Verify the buttons and two-finger pinch both zoom smoothly between 100% and 500%, one-finger
  horizontal/vertical navigation still works, and the image and highlight remain aligned. Rotate
  through all four 90-degree orientations and confirm the quarter-turn canvas is not clipped and
  opening a different map resets zoom to 100% and orientation to 90 degrees clockwise.
- Configure **Floor 1** and **Floor 2** in the same warehouse with different images and racks.
  Existing map and rack IDs must remain intact on Floor 1. Edit and save Floor 2, then return to
  Floor 1 and confirm its image and mappings are unchanged. Search floors by number and name;
  initial selector requests must use `limit=5`, and invalid or excessive list limits must return 400.
  Add/open an existing floor number and confirm its current map loads. A blank new floor is saved
  only after uploading its image and saving. Unsaved edits must survive a cancelled floor switch
  and background refetch; confirming discard must reset the editor for the selected floor.
  With a save pending, floor selection, image replacement, and map editing must be disabled.
  Open the item Location Map and switch floors; only racks on that floor should be highlighted.
  Confirm the warehouse and floor dropdowns share one row on wider screens and stack on narrow screens.
  The off-floor rack message must suggest selecting another floor rather than implying all such
  racks are unmapped. A mobile pick assigned to a Floor 2 rack must open Floor 2 automatically and
  display its floor number and map name.
  Attempt to map the same rack on another floor: expect safe HTTP 409
  `RACK_ALREADY_MAPPED_ON_ANOTHER_FLOOR` and translated instructions, with no committed changes.
  Save the same map from two editors: the second stale save must return HTTP 409
  `FLOOR_MAP_VERSION_CONFLICT` and offer reload without overwriting the first editor's changes.
  Run `supabase/tests/warehouse-floors.sql` against the seeded local DB for authenticated multi-floor
  success, isolation, conflict, and forced post-write rollback coverage; its fixtures are rolled back.
- Close and reopen the same rack map within five minutes, then open another rack on the same map.
  Confirm the cached map appears without a blocking metadata reload and the shared image does not
  flash blank while the API continues enforcing the same picker and business-unit scope.
- Open one rack map, close it before the request completes, and immediately open another. Confirm a
  late response from the first request never replaces the second rack's map or highlight.
- Replace an existing floor-map image with a malformed file carrying an allowed image MIME type.
  Confirm the decode error is translated, the old dimensions are cleared, and Save remains disabled
  until a valid replacement image is selected and decoded.
- Exercise all three Inventory picking policies with the same item and batch identity. `batch_only`
  must allow an alternative warehouse inside the fulfilling business unit after confirmation;
  `batch_and_warehouse` must reject that warehouse but allow another rack in the allocated
  warehouse; `batch_and_rack` must reject both alternatives. Every mode must reject another
  business unit. For the accepted cross-warehouse case, verify the warehouse, batch, and rack
  reservation moves exactly once; cancellation releases the pick-list source reservation and
  restores the aggregate reservation; and dispatch reduces on-hand and reserved quantities at the
  actual scanned source.
- Remove the rack mapping (or use a warehouse with no map) and confirm **View Map** shows an
  actionable not-configured/not-mapped message without exposing another warehouse's map. A missing
  warehouse map must use the dedicated non-retry state rather than suggesting that retrying will
  create the configuration.

---

## 15. Stock Transformations

**What it's for**: converting one or more input items into different output items using a fixed recipe (e.g. combining raw materials into a finished good).

**How a record starts**: first configure any predetermined non-layout outputs under **Additional Outputs** on the transformation template. Then click **New** on the Transformations list and choose the template, warehouse, and planned quantity.

**Stages**: Draft → Preparing → Completed, or Cancelled. This is a strict lifecycle — once Completed or Cancelled, nothing else can happen to the record.

**Step-by-step workflow**:

1. **Create** → status Draft. Under **Planned Quantity**, the form shows the selected template's input and output item codes. Enter any input, primary output, or additional output quantity and confirm every other quantity recalculates from the template ratios. The order inherits those consistently scaled lines; it cannot add or remove them, and their base UOM comes from each inventory item.
2. **Prepare** → status Preparing. Before allowing this, the app re-checks the recipe is still active and that there's enough stock on hand for every input — if any input is short, it lists exactly which items and by how much, and refuses the transition.
3. **Complete** → status Completed. The user accounts for every primary and additional output line as produced and/or wasted, with a waste reason when waste is greater than zero. On completing:
   - Input stock is deducted.
   - Output stock is produced — but it does **not** immediately become available for picking/sale. It lands in the shared **Putaway** queue (section 19) and a warehouse user has to place it into a real location before it's sellable/pickable.
   - Cost and full input-to-output traceability are recorded.
4. **Cancel Order** → status Cancelled, allowed from Draft or Preparing only (not once Completed).

**Who can do it**: edit access to Stock Transformations.

**Things to test**:

- Try to Prepare an order when stock is insufficient — confirm the exact shortfall is shown per item.
- Create an order and confirm **Inventory → Reservations** shows one Transformation source row per
  input and that warehouse reserved stock increases by the scaled base quantity. Move it to
  Preparing and confirm its expandable allocation details show the FIFO batches and racks selected.
- Cancel a Draft order and a Preparing order separately. Confirm the warehouse commitment returns
  to zero in both cases, and the Preparing case also releases every batch/rack allocation.
- Complete one order with less actual input than planned and confirm the actual quantity is consumed
  while the unused quantity is released. Complete another with permitted extra input and confirm the
  additional commitment/allocation is created only when stock is available; force an insufficiency
  and confirm no partial stock, reservation, or completion records remain.
- Add an additional output while creating a template and confirm the item search is server-side and bounded, primary layout outputs cannot be added, and the base UOM cannot be edited.
- Copy a template with additional outputs and confirm the new template receives independent rows that can be changed before saving without affecting the source.
- Create an order from a template with multiple outputs. Under **Planned Quantity**, enter a whole-number input quantity and confirm every output is scaled to a whole number. Then enter any one whole-number output quantity and confirm all inputs and other outputs are recalculated from the template ratios. Enter an output quantity that would require a fractional input and confirm the form explains that the value is invalid, does not round it, and blocks creation. Submit a valid ratio and confirm the created order quantities match the displayed values.
- Deactivate or soft-delete a template input/output item before creating an order and confirm creation is rejected without leaving an order header or partial lines. Confirm the form explains that the template references an unavailable item/UOM and instructs the user to reactivate or replace it, rather than showing a generic creation failure.
- After creating and preparing an order, deactivate or soft-delete an input or output item and confirm completion is rejected while the order remains Preparing and no inventory, putaway, waste, costing, or lineage records are written. Confirm the completion dialog remains open and explains whether to reactivate the item/UOM or cancel and recreate the order from a corrected template.
- Split an input item's FIFO stock across at least two warehouse locations and batches, complete an order that consumes both, and confirm each consumed batch-location slice creates its own stock-out transaction with the actual source location and batch number. Confirm the transaction-item running balances are sequential and the batch-location, batch, and warehouse totals all decrease by the same aggregate quantity.
- Complete an order containing an additional output and confirm its produced quantity creates its own stock transaction, putaway task, cost allocation, and lineage records.
- Complete an order with a wasted quantity on one output and confirm the wasted portion is excluded from produced inventory, recorded as cost variance, and logged with its reason.
- Confirm output stock shows up in on-hand totals immediately after Complete, but is **not** available for picking/sale until it's placed via Putaway.
- **If the recipe has a scrap output line (an output explicitly marked as scrap, not a normal saleable product): confirm it still creates a putaway task requiring placement today.** This is a known inconsistency — scrap correctly gets zero cost, but it still physically shows up as stock waiting to be put away, which is arguably wrong (scrap shouldn't need a shelf location at all). Log this as a real defect if you find it, not just a "confirm behavior" note — it has been independently verified as still present.
- Try to Cancel a Completed order — should be refused.

---

## 16. Stock Adjustments

**What it's for**: correcting inventory counts (damage, loss, physical count corrections, found stock, etc.) outside of a normal transaction.

**How a record starts**: click **New Adjustment**, pick a reason (physical count, damage, loss, found, quality issue, other), and enter current vs. adjusted quantity per line.

**Stages, as designed**: Draft → Pending → Approved → Posted, or Rejected.
**Stages, as actually usable today**: Draft → Posted. That's it.

**Step-by-step workflow**:

1. **Create** → status Draft. Freely editable.
2. **Post** → records a stock movement, updates stock levels and the stock ledger, then changes the status to Posted. It does not create an accounting journal or General Ledger entry. This directly changes on-hand inventory — there is no approval step in between today.

For each line, choose either **Existing Batch** or **Create New Batch**. Creating a new batch requires a selected adjustment location, a unique batch code at that location, and a positive stock increase. Saving the draft creates the zero-quantity batch/location identity transactionally; posting applies the entered increase to inventory.

**Who can do it**: edit access to Stock Adjustments (posting uses the same permission as editing).

**Things to test**:

- Confirm Post only ever appears as an option while status is Draft.
- **Do not test for an approval step.** Pending, Approved, and Rejected exist as filter options and as designed stages, but there is no button anywhere in the app that sets them. If you find a status filter for "Pending Approval" and can't get a record into that state, this is why — flag it to the product team as a design-vs-implementation gap, not a bug you need to chase.
- Confirm posting correctly updates the item's on-hand quantity by exactly the adjusted amount, and that a corresponding stock transaction appears in the stock ledger.
- With other batches already present, create a different batch code and confirm the draft creates its batch/location identity and Post applies the increase.
- Try creating a batch without a location, with zero quantity, with Decrease Stock, and with a code already present at the selected location; each case should remain in the form with actionable guidance.
- From both an editable adjustment and its read-only details view, print multiple QR labels for a persisted batch. Confirm the dialog defaults to the item's default unit (then base, then first active option), accepts another active unit selection, accepts only whole-number copy counts from 1–100, and produces exactly that many labels with the selected unit's `qtyPerUnit` and the same batch-location SKU.

---

## 17. Load Lists

**What it's for**: tracking an inbound shipment/container from a supplier before it becomes a formal goods receipt.

**How a record starts**: click **New** on the Load Lists list.

**Stages**: Draft → Confirmed → In Transit → Arrived → Receiving → Pending Approval → Received, or Cancelled.

**Step-by-step workflow**:

1. **Create** → status Draft. Select the destination business unit; there is no warehouse field.
2. **Confirm** → status Confirmed.
3. **Link Stock Requisitions** (optional) — attaches one or more purchasing requisitions (section 17b) to this shipment's line items, marking those requisitions as fully or partially fulfilled.
4. **Mark In Transit** → status In Transit. Captures an estimated arrival date and carrier name.
5. In the destination business-unit context, **Mark Arrived** → status Arrived. **This is the key trigger: it automatically creates the linked Goods Receipt Note** (section 18) without assigning a warehouse — you never manually create one from scratch. The confirmation will show the new receipt's number.
   - **Reverse Arrival** is available to the destination business unit immediately after, to undo an accidental click — puts it back to In Transit.
6. From here, Receiving and Pending Approval are driven entirely by progress on the linked Goods Receipt Note, not by any button on the Load List itself.
7. **Received** can only happen by confirming the linked Goods Receipt Note — trying to set a Load List straight to Received from this screen is explicitly refused with a message pointing you to the receipt.
8. **Cancel** — only available to the source business unit up through In Transit. Once Arrived or later, the destination business unit must reverse arrival first; no warehouse inventory has been assigned before receiving starts.

**Who can do it**: edit access to Load Lists; Mark In Transit and Mark Arrived each require their own separate, more specific permission on top of that.

**Things to test**:

- Confirm Mark Arrived actually creates a receipt and that its number matches what appears in the receipts list.
- Create a Load List for a business unit with multiple warehouses and confirm creation asks only for the destination business unit.
- Partially clear Load Date or Estimated Arrival Date, then save from General and from Items: saving should be blocked, General should open, and the affected date should receive focus with a translated inline error. Test entering part of an initially blank date too. Complete the date or clear all its parts and confirm the error clears and saving is allowed. Closing/reopening must clear stale date errors.
- From Items, save with the supplier or destination business unit missing: General should open and the first invalid selector should receive keyboard focus. With both filled and no line items, save from General: Items should open and the item selector should receive focus.
- Click Add Item with required values missing and confirm focus moves to the first missing item, unit, quantity, or visible unit cost. When no active unit is available, confirm focus returns to the item selector instead of the disabled unit selector. Repeat validation on the active tab and after closing/reopening the dialog; no stale focus should remain.
- Confirm Add Items validation messages stay visible in a full-width row below the inputs, retain the affected field's invalid indicator, and clear when that value changes. Check long English and Chinese messages at desktop and mobile widths: text should use the available row width and wrap only when needed, without overflowing. Test zero/negative quantities, quantities with more than two decimal places, and a negative visible unit cost: each should show an inline message without a toast or browser validation bubble. A failed save should leave the dialog open with an error above its footer; a retry or edit should clear that message.
- Confirm the destination business unit can see the inbound Load List while an unrelated business unit cannot.
- Try to cancel an Arrived Load List directly — should be refused with guidance to reverse first.
- Test Reverse Arrival and confirm it doesn't leave a duplicate/orphaned receipt behind.
- Confirm a user with base Load List edit access but _not_ the Mark Arrived permission cannot see/click that button.

---

## 17b. Stock Requisitions

**What it's for**: a purchasing-side request to source specific items — the internal ask that eventually gets fulfilled by a supplier shipment (Load List). Not to be confused with "Stock Requests" (section 12), which is a warehouse-to-warehouse transfer.

**How a record starts**: click **New** on the Stock Requisitions list, or use **New stock
requisition** from the desktop quick-action rail. Both paths open the same creation form.

**Stages**: Draft → Submitted → Partially Fulfilled → Fulfilled, or Cancelled.

**Step-by-step workflow**:

1. **Create** → status Draft.
2. **Send** → status Submitted. This actually emails the supplier the itemized request, in the supplier's preferred language.
3. Partially Fulfilled and Fulfilled are set automatically as Load Lists get linked against this requisition (section 17, step 3) — not by any button on the requisition itself.
4. **Cancel** — allowed any time except once already Fulfilled or Cancelled.

**Who can do it**: edit access to Stock Requisitions.

**Things to test**:

- Send a requisition and verify the supplier actually receives an email with the correct line items, in the expected language.
- Link a Load List that only partially covers the requisitioned quantity and confirm it becomes Partially Fulfilled, not Fulfilled.
- Try to cancel a Fulfilled requisition — should be refused.

---

## 18. Goods Receipt Notes

**What it's for**: the formal record of physically receiving and counting a shipment, including any damage.

**How a record starts**: automatically, when a Load List is marked **Arrived** (section 17, step 5). There is no manual "create receipt" button.

**Stages**: Draft → Receiving ↔ Paused → Pending Approval → Approved, or Rejected / Cancelled.

**Step-by-step workflow**:

1. Created automatically in Draft when its Load List arrives.
2. In the destination business unit, select **Start Receiving** → status Receiving. No warehouse is selected or assigned during receiving. Starting is blocked when the acting business unit is not the destination business unit or the linked Load List is not Arrived.
3. While receiving, **Save Changes** lets you record received/damaged quantities and box counts as you go, without changing status — useful for a long receiving session done in stages.
4. Receiving can be **paused** and resumed later without losing progress. Pausing changes only the GRN to Paused; its Load List remains Receiving.
5. **Submit for Approval** → status Pending Approval. On mobile, Submit also saves any unsaved line changes in the same transaction; a submission failure must leave those edits unsaved and must not leave stock or putaway records behind. Submit requires at least one item to actually have a received quantity greater than zero. This is the point where received stock is staged at business-unit level into **Putaway** (section 19); it does not count in any warehouse until putaway is posted.
6. **Confirm** → status Approved. Notifies whoever created the Load List that it's been received.
7. Damaged items reported during receiving have their own small lifecycle (reported → being processed → resolved) tracked separately.

**Who can do it**: base view access, plus separate specific permissions for starting, saving, submitting, and confirming — a user could have some of these and not others, so buttons may appear/disappear per user.

**Things to test**:

- Confirm Start Receiving is blocked if the Load List isn't actually Arrived yet.
- Confirm Start Receiving accepts no warehouse input, succeeds only in the destination business unit, and does not change warehouse-level stock.
- Try to Submit for Approval with every line at zero received quantity — should be refused.
- On mobile, change a line without tapping Save and then Submit; confirm the line and submission commit together. Repeat with a forced submission failure and confirm neither the line change nor any stock/putaway write is committed.
- After Submit, confirm the received quantity appears as a business-unit-level Putaway task but does **not** appear in any warehouse's on-hand or available stock until Putaway (section 19) is completed.
- Test with a user who has, say, Start and Save permissions but not Confirm — confirm the Confirm button/action is genuinely unavailable to them, not just hidden but still triggerable another way.
- Report a damaged item during receiving and follow it through its own lifecycle.
- Mobile: use the mobile receiving screens for the same shipment and confirm behavior matches the web version (Start Receiving → enter received/damaged quantities → Save/Submit).

---

## 19. Putaway Station

**What it's for**: the final, shared "where does this stock physically go" step. Any workflow that produces stock before a final shelf/bin location is chosen — goods receiving, transformation output, and (eventually) other production types — feeds into this one shared queue instead of each having its own separate placement step.

**How a record starts**: automatically — a task appears here whenever a goods receipt is submitted or a transformation is completed. There's no manual "create a putaway task" button.

**Stages**: Pending → Partial → Completed, or Cancelled.

**Step-by-step workflow**:

1. A task appears in the queue, showing the item, quantity, and where it came from.
2. The user selects a task, chooses a destination location and a batch code (a suggested batch code may already be filled in — see "things to test" below), sets a quantity, and clicks **Post**.
3. Posting can be **partial** — posting less than the full pending quantity leaves the task open, still showing the remainder; posting the rest later completes it.
4. Once completed, labels for the box/location can still be reprinted at any time — so a missed or misprinted label doesn't require redoing the whole putaway.

**Who can do it**: edit access to Warehouses.

**Things to test**:

- Confirm warehouse-bound production stock sitting in Putaway shows in that warehouse's on-hand total but remains excluded from available stock. Confirm supplier GRN stock remains business-unit staged and absent from every warehouse total until the operator selects a warehouse and rack and posts the Putaway task.
- Post a task partially, confirm the remaining quantity is correct and the task stays open, then post the remainder and confirm it completes.
- Try to post more than the pending quantity — should be refused.
- For a receiving-sourced task, check whether a batch code is pre-filled/suggested from the receiving batch, and confirm the destination _location_ can still be freely chosen regardless.
- Confirm the posting field uses the task's source unit rather than its base unit (for example, entering 5 BOX for a task with 144 STICK per box posts 720 STICK). Change the source-unit posting quantity for a partial putaway and verify the label default follows it, then enter a different whole-number copy count and verify each applicable posted batch/location label prints exactly that many copies while every label's quantity remains the task's quantity per unit.
- Print and reprint multiple putaway labels on 4 × 2-inch die-cut stock with a 3 mm gap. Set the printer media to 4 inches wide across the print head by 2 inches long in the feed direction (not 2 × 4-inch portrait), with gap sensing enabled; in Chrome, select the matching landscape paper size and actual size (100% scaling). Confirm each PDF page is landscape, has no visible border, and fits within the cut area. The enlarged QR should begin near the top edge, and the larger right-hand text should remain readable; Qty must sit directly beneath the warehouse/location line without overlapping wrapped item names or locations. The printer must advance to the next gap without rotating or scaling the label. If Chrome previews a horizontal label but paper prints vertically, check the driver's separate rotation setting. If the physical print has a large blank band above the QR while the PDF preview does not, check the selected printer's scaling and vertical position adjustment. If a single FEED press without a print job skips past the next gap, verify the roll path, gap media mode, and sensor before retrying. Repeat from GRN box, item batch-location, and stock-adjustment label actions, which use the same PDF generator.
- For a transformation with only wasted/scrap output, see whether a putaway task still gets created for it (cross-reference the note under Stock Transformations, section 15 — this is a known area of concern).

---

## 20. Reorder Management

**What it's for**: keeping stock at healthy levels — the system watches on-hand stock against a reorder point per item/warehouse, raises an alert when stock falls too low, and gives a path to turn that into a Stock Requisition (section 17b) so it actually gets reordered from a supplier.

**What must exist first**: a Reorder Rule for the item/warehouse combination (section below) — without a rule, an item is never evaluated for reordering at all.

**How a record starts**: Reorder Rules are created manually (Inventory → Reorder Management → Rules tab → **New Rule**). Alerts are **not** created by a button — they appear automatically whenever stock for a ruled item/warehouse falls below its reorder point. Suggestions are not currently generated.

**This screen has three tabs, and they behave very differently — read carefully before testing:**

### Reorder Rules (setup)

A rule ties one item to one warehouse with a reorder point, a min/max quantity, a reorder quantity, and a lead time in days. Only Item and Warehouse are actually required — every numeric field defaults to zero if left blank. You cannot create a second rule for the same item + warehouse combination; the second attempt is refused.

### Alerts tab — real and working

When an item/warehouse with a rule drops below its reorder point, an alert appears here automatically. This tab is fully functional:

- **Acknowledge** — dismisses an active alert (moves it to the "acknowledged" list). **Unacknowledge** reverses this.
- **Create Stock Requisition** — select one or more alerts with the checkboxes, then click this button. It opens the Stock Requisition form pre-filled with a line per selected item, using the rule's reorder quantity (or a calculated fallback if that's zero) as the requested quantity. This is the real, working path from "stock is low" to "an order request exists" — use this, not the Suggestions tab, for that flow.

### Suggestions tab — **unimplemented; do not test as a workflow**

The Suggestions endpoint currently returns an empty list unconditionally, so stock changes never create pending suggestions and the Approve/Reject workflow cannot be reached. Treat the entire tab as a placeholder, not as a partially working workflow. Use the Alerts tab for the supported low-stock-to-requisition flow.

**Who can do it**: edit access to Reorder Management for rules and alerts. The Suggestions workflow is not implemented.

**Things to test**:

- Create a rule for an item/warehouse, drop that item's stock below the reorder point (via a Stock Adjustment, for example), and confirm an alert appears on the Alerts tab.
- Try to create a second rule for the same item + warehouse — should be refused.
- Acknowledge an alert, confirm it moves to the acknowledged list, then unacknowledge it and confirm it reappears as active.
- Select one or more active alerts and click Create Stock Requisition — confirm the requisition form opens pre-filled with the correct item(s) and a sensible quantity, and that submitting it creates a real requisition.

---

## 20b. Sales Quotations

**What it's for**: a price quote sent to a customer, before there's a firm order.

**How a record starts**: click **New Quotation**.

**Stages**: Draft → Sent → Accepted → Partially Ordered / Ordered, or Rejected / Expired.

**Step-by-step workflow**:

1. **Create** → status Draft.
2. A status-change menu (not individual buttons) lets you move a Draft quotation to Sent, Accepted, or Rejected; a Sent quotation can move to Accepted, Rejected, or Expired. You cannot manually set a quotation to Ordered — the app explicitly refuses this and tells you it has to happen through actually creating a Sales Order.
3. A Sent quotation remains editable until it is confirmed. Saving a change atomically returns it to Draft, so the revised version must be sent again before acceptance. Accepted and later workflow states cannot be edited.
4. **Confirm quotation** is a separate action from the status menu — it records the accepting person's name, acceptance channel, and waiver evidence, then marks the quotation Accepted (optionally reserving stock at a chosen warehouse). The acceptance record and waiver metadata are committed together. Confirming does **not** automatically create a Sales Order; that's a deliberate, separate manual step.
5. Partially Ordered / Ordered get set automatically as Sales Orders are created that draw down the quotation's remaining line quantities.

**Who can do it**: edit access to Sales Quotations.

**Things to test**:

- Try to manually set a quotation's status to Ordered via the status menu — should be refused with a clear message.
- Add and edit a raw-material quotation line. Confirm there is no job-order toggle, frame dimensions, component picker, cut planner, or service-fee control; quantity, selling price, discount, and tax must still save normally. Separately add Chop & Join and Framing lines and reopen each to confirm their dedicated configuration dialogs remain available. Repeat raw-material validation with English and Chinese selected.
- Save a Chop & Join or Framing line with a fixed whole-line discount, leave the quotation, and reopen it for editing. Verify the size dialog retains that discount and the net total (for example, 459.67 before discount minus 50.00 equals 409.67). Apply and save without changes, then reopen again; the discount must remain. Switch to an undiscounted line and confirm its discount is zero.
- In the quotation editor, add an ordinary line with quantity 2, unit price 100, and 5% discount. Its Discount cell must show the currency amount and rate (10.00 (5%)), consistent with configured-frame lines. Save and reopen; the same amount and rate must remain, including when tax is nonzero.
- With the fitting catalogue already loaded, add a second Chop & Join size and select Flexipoints, Multipoints, and L-support. Save and reopen the quotation; verify each fitting, its fractions/support size, and its charge remain. Repeat after cancelling and reopening the size editor. Selected fittings without resolved inventory items must block Apply with an English/Chinese explanation rather than silently disappear.
- Mark a quotation Sent, edit and save it, and confirm the changes persist while its status returns to Draft. Open an Accepted quotation's edit URL directly and confirm the form is not shown. Also verify that a Sent quotation confirmed by another user while its edit form is open produces a conflict message instead of overwriting the accepted quotation.
- Open a quotation and confirm its lines use the compact table view. A configured-frame description must lead with the finished outside frame size, not the artwork/opening size (for example, a 21 × 16 artwork in a 25 × 20 frame displays 25 × 20). Only Chop & Join lines should have an expand control revealing the component table with quantity, unit, description, unit price, discount, and amount; matting appears in that same list. Configured parent rows must show an em dash for selling price and the saved discount amount with its effective percentage. Framing lines retain their quantity and pre-discount, pre-tax amount, with no drilldown. A plain item should likewise have no empty expand control. Apply a discount to one Chop & Join component and confirm the summary subtotal is before that discount, the Discount row includes it, and the Total Amount remains equal to the net component amounts.
- Add that accepted configured-frame quotation line to a Sales Order and confirm the read-only quantity dialog repeats the finished outside size in both the line description and each size row, using length × width order (25 × 20, not the 21 × 16 artwork/opening and not 20 × 25). After fully ordering one size from a multi-size quotation, reopen the line picker and confirm that exhausted size is absent, contributes nothing to the order quantity or total, and does not trigger an exceeds-remaining error.
- Print that quotation and confirm the PDF uses an A4 portrait layout with one continuous six-column line-item table. Chop & Join lines should appear as a bold group row followed directly by regular-weight component rows, without a nested card or second table. Plain inventory and Framing lines should use the same bold top-level treatment so they are visibly separate from the preceding component breakdown. Confirm discounts and totals agree with the on-screen quotation, and that the quotation number, generated timestamp, and page count remain clear without overlapping the document body.
- Confirming without an accepting person's name, channel, or waiver evidence should be refused without changing the quotation status or saving partial waiver metadata.
- Confirm a quotation, then create a Sales Order referencing only some of its lines/quantities, and confirm the quotation becomes Partially Ordered, not Ordered.
- Fully draw down all quotation lines via Sales Orders and confirm it then becomes Ordered.
- Select a customer before adding a line, then select an item and WS/SRP tiers. Confirm a matching customer override is used and an unconfigured tier falls back to the standard item-tier price. Repeat on a standalone Sales Order and Sales Invoice.
- Confirm an already saved line keeps its captured price when the customer or special-price setup later changes; explicitly reselecting the item or tier should resolve the current customer's effective price.
- Accept a quotation containing a customer-specific tier price, add that quotation line to a Sales Order, and confirm the tier code, tier name, and quoted unit price are copied unchanged rather than recalculated from current pricing.
- Accept a framing or chop-and-join quotation line containing at least two sizes with different quantities and components. Add it to a Sales Order and confirm all quotation fields and configuration details are read-only, with only a quantity input for each quoted size; confirm there is no "Configure as job order" option for direct inventory items. For a quoted total of 10, order only 5 split across the two sizes, save, then reopen the draft. Confirm the line quantity is 5, every selected size retains its own dimensions and partial quantity, and each size shows only its own mat layers and components. Create another Sales Order and confirm only the unallocated per-size quantities remain available. Attempt to exceed one size's remaining quantity and confirm the whole save is rejected without a partial order. After confirmation, create the Frame Job Order and confirm every selected size/component is copied without selecting a warehouse or creating an inventory reservation.
- Accept an unfulfilled quotation containing multiple normal lines plus a multi-size chop-and-join line, then choose **Convert to Sales Order**. Confirm one draft Sales Order is created, every quotation line is present, each frame size retains its own quantity/components, monetary totals exactly match the quotation, and the quotation becomes Ordered. Confirm the action is absent for Partially Ordered and Ordered quotations. Force an invalid later frame size and confirm no Sales Order, line, configuration, or fulfillment update remains committed.

---

## 21. Sales Orders

**What it's for**: a firm, confirmed order from a customer, which can be invoiced and/or trigger production.

**How a record starts**: click **New** — either standalone or referencing lines from an accepted Sales Quotation.

**Stages**: Draft → Confirmed → In Progress → Shipped → Delivered → Invoiced, or Cancelled.

**Step-by-step workflow**:

1. **Create** → status Draft.
2. **Confirm** → choose a fulfillment warehouse, then move to Confirmed. Every ordinary
   stock-managed line is reserved in base units in that warehouse. Confirmation is all-or-nothing.
   Confirmed inventory demand is read-only; cancel/delete and recreate the order to change it.
3. **Invoice** (available once Confirmed or In Progress) — opens a dialog to choose a warehouse, then creates a linked Sales Invoice (section 22) as a draft, validating and reserving/deducting stock at that warehouse.
4. **Create Job Order** — only appears for orders that actually contain items requiring production (e.g. custom framing). Creates the linked Frame Job Order without choosing a warehouse or checking inventory (section 23). Once a job order exists, this button becomes **View Job Order** instead, linking straight to it.
5. **Cancel Order** — blocked once the order has already been invoiced; the app is explicit that invoiced orders cannot be cancelled.
6. In Progress, Shipped, Delivered, and Invoiced are set automatically as invoicing/shipment progresses, not via direct buttons on this screen.

**Who can do it**: edit access to Sales Orders (this also covers creating a linked Frame Job Order — no separate manufacturing permission is needed for that step).

**Things to test**:

- Try to cancel an already-invoiced order — should be refused.
- Test the **editable** Sales Order form, not only its read-only details view: import a quotation
  line priced at 647.67 with a fixed 100 discount. The row must show Discount 100.00 (15.44%),
  pre-discount Total 647.67, and an em dash for a configured item's selling price. The summary
  must show Discount 100.00 and payable Total 547.67. Save, reopen the draft for editing, and open
  its quantity dialog; verify all three surfaces retain the discount. Repeat in English and Chinese.
- In that form, select different quantities of differently priced frame sizes. Verify component
  discounts and the proportional whole-line deduction match the saved order, including an already
  partially ordered quotation, zero/deselected sizes, nonzero tax, and repeated quantity changes.
  Ordinary inventory percentage discounts must still respond to quantity, price, and discount edits.
- Convert a quotation with a component priced at 100 less a 10 discount and no parent discount.
  Confirm quotation and order both show subtotal 100, discount 10, and payable 90. Reopen and
  save the draft twice; the values and expanded component discount must remain unchanged. Repeat
  with multiple sizes, a parent fixed discount, and tax. For a partial size, confirm the copied
  discount scales with its selected quantity and is rounded to cents.
- Select size A with quantity 1 and size B with quantity 0. Save and reopen: only A is ordered,
  and B remains available for a later order. Repeat while editing a draft to remove one size.
  Selecting zero for every size, a negative quantity, or a fractional frame count must still fail.
- Open an ordinary saved line with quantity 7 for editing. Confirm it still shows 7 and can be
  saved unchanged; repeat with an ordinary line imported from a quotation.
- Print quotations and sales orders, and view/print invoices, containing two units at 100,
  a 10% discount, and 12% tax. The discount must be 20 (10%), tax 21.60, and payable total 201.60.
  Repeat with a fixed 20 discount, no tax, and a 100% discount (200 discount, zero payable).
- Check the local database definitions for new frame, mat, glazing, and backing rates and
  component discount amounts: each must have numeric scale 2. A rate saved as 1.2345 must store
  as 1.23. Reopen affected frame configurations and confirm their rates retain cent precision.
- Edit a draft containing configured-frame and ordinary inventory lines, add another ordinary item,
  and save. Existing and new ordinary lines must omit `frameSizeSelections`; configured lines retain
  their quotation configuration IDs and positive whole-frame quantities. Reopen and verify all lines
  remain. Invalid request payloads return `SALES_ORDER_VALIDATION_FAILED` with translated guidance
  to review dates and item details, rather than incorrectly reporting that the order has no items.
- Confirm an order with multiple stock-managed lines and verify **Inventory → Reservations** shows
  one Sales Order source row per line and that warehouse reserved stock rises by the same base-unit
  quantities. Repeat with one insufficient line and confirm no reservation or status change remains.
- Cancel and delete confirmed orders in separate tests and confirm their active reservations and
  warehouse projections are released exactly once.
- Convert a confirmed order directly to an invoice and confirm its Sales Order commitments become
  consumed while the invoice itself creates no duplicate reservation.
- Confirm the "Create Job Order" button only shows for orders that actually need production, and correctly flips to "View Job Order" once one exists.
- Invoice an order and confirm stock is correctly reserved/deducted at the chosen warehouse, and that the resulting invoice is linked back to this order.
- From the Sales Orders list, use **View** to open the combined view/edit dialog (not an isolated
  table preview). Test Sales Order Details with Chop & Join at 500.67 less a fixed 200.00 discount, Framing at
  1,025.00 less 100.00, and seven inventory units at 118.00. Both configured selling prices must
  show an em dash; discounts must show 200.00 (39.95%) and 100.00 (9.76%); line totals must be
  500.67, 1,025.00, and 826.00 before discount and tax. The inventory selling price remains 118.00, and the order total
  remains 2,051.67 with a 300.00 discount. Close, reopen, and refresh to verify persistence.
  Compare with quotation details, expand Chop & Join components, and confirm Framing stays a
  summary row and production statuses remain associated with the correct lines. Repeat with
  percentage discounts, nonzero tax, multiple sizes, and English/Chinese locales.
- In both quotation and Sales Order Details, verify an ordinary line with quantity 2, price 100,
  and 5% discount shows row total 200.00 and discount 10.00 (5%). With 12% tax, the summary should
  show subtotal 200.00, discount 10.00, tax 22.80, and payable total 212.80. For Chop & Join with
  component discounts, parent and expanded component amounts must show their pre-discount amounts;
  the parent discount includes component and whole-line deductions without changing the payable total.
- Print a Sales Order containing Chop & Join, Framing, and ordinary inventory lines. Confirm
  Chop & Join shows its moulding, mat, glazing, backing, and hardware components as the actual table
  rows with no separate Chop & Join parent row. Confirm Framing and ordinary inventory each remain
  one line, multi-size Chop & Join groups remain distinguishable by size, and the displayed component
  amounts reconcile to the order totals.

---

## 22. Sales Invoices

**What it's for**: billing the customer for a confirmed sale.

**How a record starts**: automatically, as a draft, when a Sales Order is invoiced (section 21, step 3).

**Stages**: Draft → Sent → Partially Paid / Paid, with Overdue as a display state based on due date, or Cancelled.

**Step-by-step workflow**:

1. Invoice exists as Draft, linked to its originating Sales Order.
2. **Send to Customer** → status Sent. If a warehouse is attached, this step validates stock and records an outbound stock movement.
   - There appear to be two very similar actions in this area that both move a draft invoice to Sent but differ in exactly what accounting entries they post behind the scenes. Confirm with the team which one the visible "Send to Customer" button actually triggers before writing precise assertions about what should hit the ledger.
3. **Record Payment** (available once Sent, Partially Paid, or Overdue) — see the dedicated subsection below; this is how an invoice actually gets closed out.
4. **Cancel Invoice** — available on anything not already Paid or Cancelled. Also updates the linked Sales Order's cached invoice status.
5. **Delete** — only available while still Draft. This is a soft delete: the invoice and its related item, payment, and commission rows are timestamped as deleted rather than physically removed.

**Who can do it**: edit access to Sales Invoices; recording payments may require a separate payments-specific permission.

### Recording a payment

Clicking **Record Payment** opens a dialog with the amount pre-filled to the _full remaining balance due_ — a tester has to deliberately change it to test a partial payment, so don't assume the default behavior tests partial payments for you. Required fields: Amount (must be greater than zero and cannot exceed the amount currently due — both enforced), Payment Date, and Payment Method (a dropdown, e.g. bank transfer). Reference and Notes are optional.

What happens when you submit:

- A payment record is saved against the invoice, and the invoice's Amount Paid / Amount Due are recalculated.
- If the new Amount Due reaches exactly zero, the invoice becomes **Paid**. If some but not all of the total has been paid, it becomes **Partially Paid**.
- The payment is also posted to the accounting ledger as an AR (accounts receivable) entry.
- **Important gap to test**: if that ledger posting fails for any reason, the payment is still recorded successfully and the invoice status still updates — the failure is swallowed silently with no error shown to the user. This means it's possible for an invoice to show as Paid while its corresponding accounting entry never actually made it into the ledger. If you have a way to force this failure (or a way to check the ledger independently), this is worth a deliberate test.
- A full payment history for the invoice (each individual payment, its date, method, and amount) is available and worth checking after multiple partial payments to confirm they all show up correctly rather than only the most recent one.

**Things to test**:

- Try to cancel a Paid invoice — should be refused.
- Record a partial payment and confirm the invoice correctly shows Partially Paid, not Paid, until the full amount is covered.
- Try to record a payment for more than the current amount due — should be refused.
- Try to record a payment of zero or a negative amount — should be refused.
- Record two or three partial payments in sequence and confirm the payment history shows all of them, and that the running Amount Due is correct after each one.
- Confirm cancelling an invoice correctly updates the status shown back on its originating Sales Order.
- Confirm the Overdue display only appears once the due date has actually passed on an unpaid invoice, and disappears once paid.
- Delete a Draft invoice and confirm it disappears from active views while the invoice and related rows remain persisted with deletion timestamps for audit purposes.
- Open and print an invoice converted from a Sales Order with Chop & Join work. Confirm the invoice
  fetches the originating order's component snapshot and displays each component as a normal invoice
  line with quantity, unit, description, selling price, discount, tax, and amount. The Chop & Join
  parent must not appear, while Framing and ordinary inventory still appear as single lines. Confirm
  the component amounts and invoice totals match the Sales Order.
- If possible, verify the "payment succeeds but ledger posting silently fails" gap described above — this is a real, confirmed behavior, not a hypothetical.

---

## 23. Frame Job Orders

**What it's for**: production for custom framing/chop-and-join items, triggered from a Sales Order.

**How a record starts**: only via a Sales Order's "Create Job Order" button (section 21, step 4) — never created standalone.

**Stages**: Pending → Queued → In Progress → On Hold → Completed, or Cancelled.

For a sales order containing both Chop & Join and Framing, push each job to production.
Both must succeed with separate manufacturing orders. Repeating a push for the same job must
not create a duplicate. Direct sales-order production without a frame job still permits only
one non-cancelled, non-deleted manufacturing order per sales order. Database regression check:
run `supabase/tests/manufacturing-order-uniqueness.sql` inside a transaction after migrations.

**Step-by-step workflow**:

1. Created from a Sales Order with no warehouse selection, stock check, reservation, or deduction.
2. Open a job order to see the saved Chop and Join / Job Requisition Form in the same paper layout used by the framing dialog. The detail view includes **Print** and **Download PDF** actions. **Print JO** on the Job Orders list opens the same saved form directly as a printable PDF. The form includes the customer and delivery address, FJO transaction number, every configured frame size and quantity, mat/glazing/backing/hardware specifications, instructions, sales total, and signature lines.
3. **Create Material Request** → choose the issuing warehouse. Draft creation records demand only.
4. **Approve and Reserve** → atomically validates availability and reserves every material line. A failure on any line leaves the request draft with no partial reservation.
5. **Issue to Production** → atomically creates the outbound stock transaction, consumes every reservation, deducts inventory, and marks the job materials issued.
6. **Push to Production** → creates a linked Manufacturing Order (section 24). From this point, the job order's status is largely driven automatically by the linked manufacturing order's progress. Starting production is blocked until step 5 is complete.
7. **Complete** — the linked manufacturing order must finish, but no material request or full issue is required when residual materials are used. Completion preserves actual issued quantities, cancels unissued requests, releases unused reservations, and does not deduct inventory again.

**Who can do it**: pushing to production requires manufacturing or transformation-level create access. Completing the job requires edit access to either manufacturing or transformations. Creating a material request requires Stock Requests create access; approving, issuing, or cancelling it requires Stock Requests edit access.

**Things to test**:

- Open single-size and multi-size jobs and confirm the on-screen paper view matches the framing dialog. Print and download each form, then confirm both PDFs match the saved quantities, dimensions, materials, instructions, FJO number, customer address, and Sales Order total.
- Try to Complete a job order while its linked manufacturing order is still In Progress — should be refused.
- Create a draft material request and confirm on-hand and reserved stock do not change. Approve it and confirm only reserved stock changes. Issue it and confirm both the reservation and on-hand stock are consumed exactly once.
- Force insufficient stock on a later request line and confirm approval rolls back any earlier line reservations. Cancel an approved request and confirm every reservation is released.
- Start and finish production without a material request, then repeat with partial issued quantities; both must succeed without inventing stock consumption. Repeat with an approved unissued request and confirm completion releases its reservations. Force a completion failure and verify all changes roll back.
- Deactivate one required material before creating a request: the whole request must fail with actionable guidance, not silently omit that material. Reactivate it and retry.
- For two job orders on one sales order, finish only one and verify each line shows its own job code and production status.
- Push a job order to production and confirm a Manufacturing Order actually gets created and linked correctly.
- Confirm status changes on the manufacturing side (hold, resume, complete a step) are reflected back on the job order's own status.
- Confirm quotation-edit access alone cannot complete a job order, while a user with manufacturing or transformation edit access can complete it after production and material issue are finished.

---

## 24. Manufacturing Orders / Manufacturing Floor

**What it's for**: the shop-floor production tracking that backs Frame Job Orders (and potentially other production sources).

**How a record starts**: automatically from a Frame Job Order's "Push to Production" step (section 23) — a manual creation path may also exist for standalone production.

**Stages**: Queued → Ready → In Progress → On Hold → Quality Check → Completed, or Cancelled. Each order also has individual production steps with their own progress (pending/in-progress/completed/blocked), and materials tracked as required/reserved/issued/short/consumed.

**Step-by-step workflow**:

Each production card leads with the Frame Job Order number and customer. Standalone production orders without a linked frame job order fall back to the Manufacturing Order number. Long item/size descriptions and the per-card materials viewer are intentionally omitted; the due date, exceptional priority, workstation, active operation, status, queue time, material-shortage warning, and valid workflow actions remain visible. Normal priority is hidden to reduce visual noise. **View JO** opens the saved requisition paper in a production-only dialog without Print, Download, sales totals, total cuts, or prepared/received signature details.

The shop-floor screen shows one dynamic primary button per order, depending on current stage:

1. Queued/Ready → **Start**.
2. Once started, the current step shows **Complete Step**; if it's the last step, the button instead reads **Complete Job**.
3. While In Progress or Quality Check, **Hold** moves the order to On Hold. Queued or Ready orders cannot be held because the order must be started first.
4. On Hold → **Resume** brings it back to where it left off.
5. The direct **Complete** action is available only while the order is On Hold. In Progress and Quality Check orders instead show **Hold** alongside the current step-completion action.

**Who can do it**: manufacturing or transformation-level edit access (either is sufficient).

**Things to test**:

- Confirm linked frame production cards show the FJO number rather than the MO number, with the customer directly below it. Confirm standalone production orders still show their MO number.
- Confirm cards omit the item/size description and **View Materials** action, hide Normal priority, show exceptional priorities, and display the auto-refresh indicator once in the page header rather than once per card.
- Open **View JO** from a production card and confirm the dialog shows the saved requisition header and work specification table, with no Print, Download, total cuts, sales amount, Prepared by, or Received by / Date details. Confirm the full Job Order page and its printable PDF still include the complete footer. Confirm Manufacturing and Transformation viewers can load the preview without requiring Sales Quotations access.
- Try to Hold a Queued order that was never started — should be refused.
- Step through a multi-step order and confirm the button label correctly changes from "Complete Step" to "Complete Job" on the final step.
- Confirm the direct **Complete** action is absent while In Progress or Quality Check, then appears after the order is placed On Hold.
- Try to act on a Completed or Cancelled order — every action should be refused.
- Reserve materials, mark some as short (insufficient), and confirm the order correctly reflects a blocked/short state.

---

## 25. POS Transactions

**What it's for**: in-store point-of-sale checkout. Much simpler than the other modules — a transaction is created already complete.

**Stages supported by the current UI and API**: Completed, then optionally Voided.

**Things to test**:

- Void a completed transaction and confirm stock/payment are correctly reversed.
- Add Item A to a walk-in cart, select Customer A, then Customer B, then return to walk-in. Confirm the open cart reprices from the standard tier to each customer's matching override and finally restores the standard tier, including correct line and transaction totals.
- Add more than one item where only some item-tier combinations have customer overrides. Confirm overridden tiers and standard fallback tiers can be selected independently and that checkout persists the displayed price.
- Refunds and register/cash-drawer session opening or closing are not wired into the current UI or API. Record them as product gaps rather than executable QA paths.

---

# Part 3 — Accounting & Reporting

> **Read this before testing anything in this part.** The entire Accounting area (Journal Entries, Chart of Accounts, General Ledger, Trial Balance) is **not linked from the app's navigation menu at all** — it's fully built and functional, but a user can only reach it by typing the exact page address directly into the browser. This looks like a deliberate "not ready to show users yet" state rather than a bug, but it means: if you were given this guide to test the app by clicking around, you will never stumble onto these screens on your own. Confirm with whoever assigned your test scope whether these are actually in scope for this cycle before spending time on them. The Stock Ledger page (not the same as the Accounting ledger) has the same "works fine, but nothing links to it" situation — see its section below.

---

## 26. Journal Entries

**What it's for**: the underlying double-entry bookkeeping record behind other modules' financial activity (invoice payments, stock adjustments, etc. all ultimately produce or reference entries here), plus a way to enter one manually.

**Entry point**: (direct URL only — see the note above) **New Journal Entry**, opened from the journal list.

**Stages**: Draft → Posted, or Cancelled.

**Required fields / rules to create a valid entry**:

- A posting date and at least **two lines**.
- Each line must have either a debit amount or a credit amount — never both on the same line, and never neither.
- Debit and credit amounts on every line must be positive.
- Every line must reference a real, active account (see Chart of Accounts, section 27).
- **The entry's total debits must exactly equal its total credits** — this is the core double-entry rule, and it's enforced both when you try to save and again when you try to post.

**Step-by-step workflow**:

1. **Create** → always saved as Draft, regardless of anything you might try to set otherwise. A draft can still be freely viewed; there is no separate edit action confirmed in this build, so treat a draft as something you'd typically get right before saving rather than something you go back and revise.
2. **Post** → this button lives inside the entry's detail/view screen, and is **disabled unless the entry is currently balanced** (debits = credits). Posting is permanent — once posted, the fields above note the entry is meant to be immutable, and re-posting an already-posted entry is refused. There is no "unpost" or "void" action found in this build — a posted entry cannot currently be reversed from the UI.
3. Attempting to post an entry with fewer than two lines, or one that isn't balanced, is refused with the specific imbalance shown (total debits vs. total credits).

**Who can do it**: separate view/create/edit permissions specifically for Journal Entries.

**Things to test**:

- Try to save an entry with only one line — should be refused.
- Try to save a line with both a debit and a credit amount filled in — should be refused.
- Try to save an unbalanced entry (debits ≠ credits) — should be refused, and the message should show both totals.
- Create a valid, balanced draft, then post it, then try to post it again — the second attempt should be refused as already posted.
- Try to reference a deleted or inactive account on a line — should be refused.
- Confirm there is genuinely no way to undo/reverse a posted entry from the UI — if you find one, that contradicts what's documented here and is worth flagging either way.

---

## 27. Chart of Accounts

**What it's for**: the list of accounts (assets, liabilities, revenue, expense, etc.) that Journal Entries post against.

**Required fields**: Account Number, Account Name, Account Type.

**Edit / delete behavior — one of the better-protected master-data types in this app**:

- **System accounts cannot be deleted at all** — refused outright, regardless of whether they're in use.
- **A non-system account cannot be deleted if it has any posted transactions against it** — refused with a clear message. This is a real, enforced check, not just a UI warning.
- An account with no posted transactions and that isn't a system account can be deleted normally.

**Things to test**:

- Try to delete a system account — should be refused regardless of use.
- Try to delete a regular account that has at least one posted Journal Entry line against it — should be refused.
- Delete a regular, never-used account — should succeed.
- Try to set an account as its own parent account — should be refused.

---

## 28. General Ledger & Trial Balance

**What these are for**: read-only financial reports. The General Ledger lets you drill into all the posted activity for a specific account over a date range; the Trial Balance shows every account's running balance at a point in time (the classic "do total debits equal total credits across the whole company" check).

**Nature of these screens**: both are pure reporting — there's no workflow, no stages, no buttons that change data. Testing here is about correctness of the numbers shown (do they reconcile against what you'd expect from the Journal Entries you've posted) and correctness of the filters (date range, account selection).

**Things to test**:

- Post a few Journal Entries, then confirm they appear correctly in the General Ledger drill-down for the accounts involved.
- Confirm the Trial Balance's total debits equal total credits company-wide (this should always be true if every posted entry was itself balanced).
- Filter the General Ledger by a date range that excludes a transaction you just posted and confirm it correctly disappears from the view.

---

## 29. Stock Ledger

**What it's for**: a complete, filterable audit trail of every stock movement (in, out, transfer, adjustment) per item and warehouse. This is less a "workflow to test" and more a tool _you'll use constantly_ to verify other modules did what they claimed — e.g. after completing a Stock Transformation or posting a Goods Receipt, this is where you'd go to confirm the exact quantity and cost actually moved as expected.

**Reachability note**: this page exists, works, and is not a placeholder — but like the Accounting section, **nothing in the app's navigation links to it**; it's reachable only by direct URL. This is a different page from the "Stock Transactions" item that does appear in the Inventory menu — don't assume they're the same screen, and confirm which one your test scope actually expects you to use.

**Things to test**:

- After completing any stock-moving action elsewhere (a Goods Receipt, a Transformation, an Adjustment, a Putaway posting), confirm the corresponding entry shows up here with the correct item, warehouse, quantity, and direction.
- Complete a transformation output and post its putaway task. Confirm both rows retain their handled
  quantities, the transformation output has a positive stock effect, and the zero-delta putaway is
  shown as an internal transfer without increasing Total In or Total Out.
- Confirm Total In and Total Out remain unchanged when paging through the same filtered ledger.
- Filter by item, warehouse, and voucher/transaction type and confirm the results narrow correctly.

---

## 30. Reports Directory

**What it's for**: a catalog of business reports, reachable from the main Reports menu. The directory displays implemented reports and hides report definitions that are still marked as coming soon.

**Reports that are actually implemented (safe to test as real features)**: Stock Reports, Stock Aging, Inventory Report, Fast-Moving Products, Slow-Moving Products, Item-Location-Batch report, Customer Ledger, AR Aging, Shipments Report, Delivery Performance, Picking Efficiency, Transformation Efficiency.

**Things to test**:

- Confirm every report marked "implemented" actually opens and renders data, not just the catalog tile.
- Confirm report definitions marked "coming soon" are absent from report cards, category tabs, search results, and directory totals.
- Some reports are gated behind extra permissions beyond basic Reports access (e.g. certain financial figures require a pricing/valuation-visibility permission) — test with a restricted role to confirm those specific numbers are hidden rather than the whole report failing.

---

## 31. Warehouse Dashboard

**What it's for**: the landing page every user sees after logging in — summary cards (incoming shipments, open stock requests, active pick lists), an inventory health panel, and a recent stock-movements list.

**Nature of this screen**: read-only, and every widget on it is independently permission-gated — a user might see some cards and not others depending on their role.

**Things to test**:

- Log in as users with different roles and confirm each only sees the summary widgets their permissions actually allow, rather than either seeing everything or seeing a broken/empty dashboard.
- Confirm the numbers shown (open stock requests, active pick lists, etc.) match what you can independently count from those modules' own list screens.
- On a desktop viewport, confirm the right-side quick-action rail shows only creation shortcuts for
  resources where the user has both view and create permission. Confirm each visible icon has a
  translated hover/focus label and opens its creation page or dialog directly.
- Confirm the quick-action rail is absent on smaller viewports and on the manufacturing floor's
  fullscreen mode.
- Open the Unit converter from the rail's Utilities group and confirm its panel slides in from the
  right without a backdrop or focus trap. Verify the current page remains interactive while the panel
  is open, Escape and the close button dismiss it, and the rail button reflects its expanded state.
- Verify length, mass, volume, and temperature conversions in both US-to-metric and metric-to-US
  directions, including decimal and negative temperature values. Confirm Swap units preserves the
  represented measurement and that English and Chinese labels remain in parity.
- Verify the conversion-mode selector supports Imperial-only (US customary), Metric-only,
  Imperial-to-Metric, and Metric-to-Imperial modes. Confirm the From and To selectors only show units
  allowed by the selected mode, and that Swap units reverses cross-system modes.

---

## 32. Activity Logs

**What it's for**: an admin-only audit trail of user actions across the app (who did what, when) — useful for confirming that actions you've tested elsewhere in this guide were actually logged.

**Things to test**:

- Perform a few actions elsewhere in the app (e.g. approve a Stock Request, post a Stock Adjustment) and confirm each shows up here with the correct user, action, and timestamp.
- Confirm this screen itself is only reachable by users with the appropriate admin permission.

---

## Things every tester should check on every module

These apply across _every_ module above, so check them once per module rather than assuming they were covered elsewhere:

1. **Two layers of permission.** Most actions first check a broad "can this user use this module at all" permission, and some actions then check a second, narrower permission on top (e.g. a user might be able to edit receipts generally but specifically lack the ability to Confirm one). When testing with a restricted-permission user, check that the specific button is actually blocked, not just that it's hidden.
2. **Warehouse/branch matters.** Several transitions require the acting user to belong to a _specific_ warehouse or branch relative to the transaction — e.g. only the fulfilling side can approve a Stock Request, only the receiving side can start receiving a delivery. A good negative test for almost every module is: "log in as a user on the _wrong_ side of the transaction and confirm the action is refused."
3. **Known placeholder screens — don't test these as real workflows:**
   - The "pick" screen reachable from Stock Requests — it uses sample data and isn't connected to anything real.
   - Older receiving screens that exist in the app but aren't reachable from any real navigation path.
4. **Known designed-but-not-wired stages — flag as product gaps, not bugs you introduced:**
   - Stock Adjustment's Pending/Approved/Rejected stages.
   - Stock Request's Complete action not moving any inventory.
   - Frame Job Order's Complete action checking the wrong permission.
   - Stock Transformation scrap output still creating a putaway task instead of being excluded entirely.
   - A Warehouse Location's "Pickable" switch having no effect on real picking — confirmed reproducible, should be logged as a defect wherever you find it, not just noted in passing.
   - Reorder Management's Suggestions tab is entirely unimplemented: its list endpoint always returns an empty array, so suggestions and their Approve/Reject workflow cannot be tested.
   - The Workflow settings tab's approval-requirement toggles (Purchase Order, Stock Request, Delivery Note) having no effect on the actual workflows they claim to gate.
   - A Sales Invoice payment can be recorded successfully, and the invoice marked Paid, even if the corresponding accounting-ledger entry silently fails to post — no error is surfaced to the user either way.
5. **No consistent "in use" protection across master data.** Suppliers and Roles correctly block deletion when something else depends on them; Items, Customers, Warehouses, and Warehouse Locations do not — treat every master-data delete as its own test rather than assuming the app protects itself consistently.
6. **Several master-data types can't be created from inside the app at all** — Item Categories, Units of Measure, Business Units, and new User accounts all have to be set up ahead of time by whoever administers the test environment. Confirm this setup is done before test cycles start, since there's no in-app fallback if one is missing.
7. **Newer vs. older modules behave differently on failure.** The newer modules (goods receiving, load lists, deliveries, transformations, job orders, manufacturing, putaway) are built so a failure partway through leaves nothing half-done. Some older modules (legacy purchase-order receiving and invoice sending) do their work in several separate steps — these are worth extra stress-testing for partial-failure states, e.g. what happens if the connection drops mid-action.
