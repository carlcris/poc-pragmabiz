# QA Workflow Testing Guide

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

## 2. Item Categories

**Purpose**: groups items for filtering/searching and reporting.

**Entry point**: **There isn't one.** There is no screen anywhere in the app to create, rename, or remove a category — the only thing the app does with categories is let you *pick* an existing one when creating/editing an Item, and filter by it in lists.

**What this means for testing**: if your test plan calls for "create a new category," that's not something you can do through the product today — categories have to already exist (set up by whoever configures the environment) before testing starts. What you *can* test: that the Item form requires you to pick a category, and that the item list correctly filters by category.

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
- If you're able to deactivate a unit of measure in the environment's setup data, confirm it disappears from the dropdown for *new* items but doesn't break any *existing* item that already uses it.

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

**Things to test**:
- Create an invoice for a customer, then delete that customer, and confirm what happens — expect no error or block, then check whether the existing invoice still displays correctly.
- Set a very low or zero credit limit on a customer with existing unpaid invoices and confirm new sales orders/invoices can still be created for them without any warning.
- Confirm the customer's balance shown on their record updates correctly after recording a payment on one of their invoices.

---

## 6. Warehouses

**Purpose**: the physical or logical stock location that every inventory transaction happens "in" — Stock Requests, Goods Receipts, Pick Lists, Adjustments, and van-sales vehicles are all scoped to a warehouse.

**Entry point**: Inventory → Warehouses → **New Warehouse** (a pop-up form).

**Required fields**: Code (letters/numbers/hyphens only, must be unique), Name.

**Optional fields**: address, city, state, postal code, country, phone, email, manager name.

**Business unit note**: a warehouse is created under whichever business unit/branch is currently active for the user creating it, and **this cannot be changed afterward** — there's no field anywhere to move a warehouse to a different business unit once it exists. If you need a warehouse under a different business unit for testing, you must switch your active business unit *before* creating it.

**Automatic setup**: every new warehouse automatically gets one default storage location called "Main" — a general-purpose bin marked as active, pickable, and storable. Any stock movement that doesn't specify an exact shelf/location lands here by default. You don't create this yourself; it's there the moment the warehouse is.

**What must already exist first**: you must have an active business unit context selected (the app will refuse to create a warehouse otherwise).

**Edit / deactivate / delete behavior**:
- **Delete has no protection at all** — a warehouse can be deleted even while it has current stock, open Stock Requests, or an active pick list pointing at it. This is the same gap as Customers. Worth deliberately testing: put some stock in a warehouse, delete the warehouse, and see what the stock/inventory reports do afterward.
- Deactivating removes it from the warehouse picker on new transactions but doesn't affect anything already scoped to it.
- The warehouse code cannot be changed once created.

**Things to test**:
- Create stock in a warehouse (receive something into it), then delete the warehouse, and check whether stock reports/item detail pages still behave sensibly afterward.
- Confirm a warehouse created while Business Unit A is active cannot later be reassigned to Business Unit B.
- Confirm the automatic "Main" location exists immediately after creating a new warehouse, without any extra setup step.

---

## 7. Warehouse Locations

**Purpose**: sub-divisions within a warehouse (a specific bin, shelf, rack, or staging area) — this is the level of detail used for Putaway placement and for tracking exactly which shelf a batch of stock physically sits on.

**Entry point**: Inventory → Warehouses → open a warehouse → Locations tab → **New Location**.

**Required fields**: Code only.

**Optional fields**: Name, a parent location (for nesting, e.g. a shelf inside a rack), Location Type (Bin, Zone, Aisle, Rack, Shelf, Crate, Staging — defaults to Bin), and three switches that all default to "on": Active, Pickable, Storable.

**Validation rules**: the location code only needs to be unique *within its own warehouse* — the same code (e.g. "A1") can exist in two different warehouses without conflict. A duplicate within the same warehouse is rejected.

**What the Pickable/Storable switches actually do — important, and not what you might expect**:
- **Storable** is checked by the screens that let you choose a destination when placing stock (Putaway, and box handling during goods receiving) — turning it off removes the location from those destination pickers **on screen**. However, this has not been confirmed to be enforced anywhere beneath the screen — if there's a way to submit a placement request that bypasses the picker, it's worth testing whether a non-storable location is still silently accepted.
- **Pickable does not currently do anything.** Despite the name and despite it being a real switch on the location form, the actual picking logic used by Pick Lists does not check this flag at all — a location marked "not pickable" is still fully usable as a picking source today. This is a confirmed defect, not a hedge: mark a location not-pickable and it will still be offered and usable in a real Pick List. Report it as a bug if you confirm the same in your test environment; don't treat "not pickable" as meaning what it sounds like it means.

**What must already exist first**: the warehouse it belongs to.

**Edit / deactivate / delete behavior**:
- **There is no delete for a location at all** — only editing, including toggling it inactive. If your test plan calls for "delete a location," that action doesn't exist in this app; deactivating is as close as it gets.
- Deactivating a location that currently holds stock has **no special handling or warning** — nothing stops you, and it's not clear the stock is protected in any way afterward. Worth testing directly: put stock in a location, deactivate the location, and see what shows up in stock views afterward.

**Things to test**:
- Mark a location as not-pickable, try to pick against it in a real Pick List, and confirm it's incorrectly still usable — file this as a defect, since it's already been confirmed to reproduce.
- Mark a location as not-storable and confirm it disappears from the Putaway destination picker; if you have any way to submit a placement directly rather than through the picker, test whether that bypass still succeeds.
- Create two locations with the same code in two different warehouses — should be allowed. Try the same code twice in the *same* warehouse — should be refused.
- Put stock into a location, deactivate it, and see whether the stock is still shown/handled sensibly.

---

## 8. Business Units

**Purpose**: the top-level "branch/division" scope that warehouses, customers, and most permissions sit underneath. Most of what a user sees in the app is implicitly filtered by whichever business unit they currently have active.

**Entry point**: **There isn't one for creating a business unit itself.** The only screen related to business units lets you edit *settings* for the currently active one (Admin → Settings → Business Unit) — it does not create new business units or edit which ones exist. New business units, and which users are allowed into them, must be set up outside the app (by whoever administers the environment) before testing.

**Switching business units**: there is a switcher in the app that lets a user with access to more than one business unit change which one is currently active. This is a genuinely testable action.

**Things to test**:
- Switch your active business unit and confirm that item lists, warehouse lists, etc. immediately reflect the new business unit's data without needing to fully reload the app.
- Try to switch into a business unit you don't have access to (if you can simulate this) and confirm it's refused.
- Confirm a user only ever sees the business units they've actually been granted, not every business unit in the company.

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

**Things to test**:
- Confirm there's genuinely no way to self-register or create a user from inside the app — this should be treated as expected behavior, not a bug to report.
- Build a custom role with a narrow set of permissions, assign it to a test user, and confirm that user only sees the menu items and can only perform the actions that role actually grants — including trying the restricted actions directly, not just checking that buttons are hidden.
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

**What it's for**: requesting stock be moved from one warehouse or branch to another, internally — this is not a customer sale.

> Naming note: this is different from "Stock Requisitions" (section 17b), which is a request to purchase from a supplier. Don't mix them up when writing tickets.

**How a record starts**: click **New** on the Stock Requests list page. Fill in the item(s), quantities, source warehouse, and destination.

**Stages**: Draft → Submitted → Approved → Picking → Picked → Delivered → Received → Completed, or Cancelled / Rejected along the way.

**Step-by-step workflow**:

1. **Create** → status Draft. Nothing has moved yet; freely editable.
2. **Submit** → status Submitted. Locks the request for editing and sends it for approval.
3. **Approve** (done by someone at the *fulfilling* warehouse/branch) → status Approved. This is the point where the request becomes actionable.
   - **Reject** is the alternative to Approve at this stage — sends it back, does not delete it.
4. From here, the actual picking and delivery happen through a linked **Delivery Note** (section 13) and **Pick List** (section 14) — not through buttons on the Stock Request itself. The status shown on the Stock Request is a read-out of how far the linked delivery has progressed, not something you click through directly.
5. **Complete** → status Completed, once the linked delivery has been received.
6. **Cancel** is available any time before Completed.

**Who can do it**: users with edit access to Stock Requests; Approve additionally requires the approving user to belong to the *fulfilling* warehouse/branch (a user at the *requesting* side cannot approve their own request).

**Things to test**:
- **Completing a Stock Request does not move any inventory.** Test that stock quantities are unaffected by clicking Complete — this action currently only changes the status. If your test expects Complete to actually deduct/transfer stock, that's a documented gap, not something you're missing.
- Confirm a user at the requesting side cannot see or click Approve/Reject.
- Confirm the status shown on the Stock Request updates correctly as the linked pick list moves through its own stages (in progress, paused, done).
- There is a "pick" screen reachable from this module that is a placeholder with sample data and does not actually do anything — do not use it as the real picking flow (that's section 14, Pick Lists).

---

## 13. Delivery Notes

**What it's for**: the actual dispatch-and-receive workflow — physically moving goods out of one warehouse and into another warehouse or to a customer.

**How a record starts**: on the Delivery Notes list, click **New**, then select one or more *approved* Stock Requests to bundle into it.

**Stages**: Draft → Confirmed → Queued for Picking → Picking in Progress → Dispatch Ready → Dispatched → Received, or Voided.

**Step-by-step workflow**:

1. **Create** from approved Stock Requests → status Draft.
2. **Confirm** → status Confirmed. Locks the item list.
3. **Queue Picking** → opens a dialog to assign one or more pickers; this creates a linked Pick List (section 14) and the status becomes Queued for Picking, then Picking in Progress once picking actually starts.
4. Once the pick list is fully picked and marked done, the delivery automatically becomes Dispatch Ready — there is no separate button for this.
5. **Confirm Dispatch** → opens a dialog to capture driver name, signature, helper name, plate number, and delivery time. Status becomes Dispatched. This is the point of no return for most edits.
6. **Receiving** — depends on how the delivery is set up:
   - **Warehouse-to-warehouse transfer**: on the *receiving* side, a user (usually on a tablet) clicks **Start Receiving**, then scans each box as it arrives, then clicks **Submit Receiving**. If what's scanned doesn't match what was dispatched (short, over, or damaged), the app requires the user to explicitly acknowledge the discrepancy before it lets them submit.
   - **Customer pickup at the warehouse**: instead of scan-based receiving, there's a direct "confirm the customer picked this up" action — no destination-inventory receipt is posted, because the goods left the warehouse directly into the customer's hands.
7. **Void** — available any time before Dispatched. This is a hard stop; it will refuse if anything has already been dispatched.
8. **Add Items** — even after a delivery is Dispatched, more line items can still be added to it (useful for topping up a delivery in flight). Worth testing as a deliberate edge case.

**Who can do it**: edit access to Stock Requests covers Confirm/Queue/Dispatch/Void; receiving actions require a separate receiving permission scoped to whichever warehouse/branch is actually receiving the goods.

**Things to test**:
- Try to dispatch more than what was actually picked — should be blocked.
- Confirm a user cannot Start Receiving on a delivery that isn't Dispatched yet.
- Test the discrepancy path deliberately: receive fewer (or more, or damaged) units than dispatched and confirm the app requires an acknowledgement/reason before letting the submit go through.
- Cancelling the linked pick list *before* dispatch should roll the delivery's status back down to Confirmed — test this reversal explicitly.
- Test both receiving paths (scan-based vs. customer-pickup) since they behave very differently.

---

## 14. Pick Lists

**What it's for**: the actual in-warehouse picking work — walking the warehouse and confirming which physical items/batches fulfil a Delivery Note.

**How a record starts**: created automatically from a Delivery Note's "Queue Picking" step (section 13) — never created standalone.

**Stages**: Pending → In Progress → Paused → Done, or Cancelled.

**Step-by-step workflow**:

1. Pick list is created already assigned to one or more pickers, status Pending.
2. **Start Picking** → status In Progress.
3. A picker taps/clicks a line item to **claim** it — this locks the line so a second picker can't work the same item at the same time. Claims expire automatically after a short window if left idle.
4. Picker scans (mobile) or selects (web) the batch/location being picked from, enters the quantity, and confirms — this is done per line, not a whole-list action. If the scanned batch doesn't match what's expected, the app shows a mismatch warning that has to be explicitly acknowledged before the pick can be recorded.
5. **Pause** → status Paused, for stepping away mid-pick. **Resume Picking** brings it back to In Progress.
6. **Complete Picking** → status Done. This is blocked if any line still has an active, unexpired claim, including a claim held by the picker attempting completion — the app will show an error rather than silently completing.
7. **Cancel Pick List** → status Cancelled. A cancellation reason is optional; leaving it blank stores no reason. Cancelling rolls back any picked-quantity progress on the linked Delivery Note, and if the delivery hadn't been dispatched yet, reverts its status too.

**Who can do it**: edit access to Stock Requests; on top of that, some users are restricted to only see/act on pick lists specifically assigned to them (check whether the test user has this restriction before assuming they should see every open pick list).

**Things to test**:
- Two pickers, one line: confirm the second picker sees the line as "claimed by someone else" and cannot pick it themselves.
- Let a claim sit idle past its expiry and confirm it becomes available to claim again.
- Try to Complete Picking first while the current picker still holds an active claim, then while another picker holds one — both attempts should be refused with a clear error, not silently completed.
- Cancel a pick list mid-way with a blank reason and confirm cancellation succeeds, no reason is stored, and the Delivery Note's status and picked-quantity totals both roll back correctly.
- Mobile: test the scan-to-verify flow specifically — the camera-captured value should be processed silently without appearing in the manual-entry field. A correct scan should sail straight through, while a mismatched scan should show the confirmation/warning card before allowing the pick.

---

## 15. Stock Transformations

**What it's for**: converting one or more input items into different output items using a fixed recipe (e.g. combining raw materials into a finished good).

**How a record starts**: click **New** on the Transformations list, choose a recipe, a warehouse, and a planned quantity.

**Stages**: Draft → Preparing → Completed, or Cancelled. This is a strict lifecycle — once Completed or Cancelled, nothing else can happen to the record.

**Step-by-step workflow**:

1. **Create** → status Draft. The system calculates expected input consumption and output quantities from the recipe.
2. **Prepare** → status Preparing. Before allowing this, the app re-checks the recipe is still active and that there's enough stock on hand for every input — if any input is short, it lists exactly which items and by how much, and refuses the transition.
3. **Complete** → status Completed. The user enters the *actual* consumed input quantities and *actual* produced output quantities (which can differ from planned), plus an optional wasted quantity and reason per output line. On completing:
   - Input stock is deducted.
   - Output stock is produced — but it does **not** immediately become available for picking/sale. It lands in the shared **Putaway** queue (section 19) and a warehouse user has to place it into a real location before it's sellable/pickable.
   - Cost and full input-to-output traceability are recorded.
4. **Cancel Order** → status Cancelled, allowed from Draft or Preparing only (not once Completed).

**Who can do it**: edit access to Stock Transformations.

**Things to test**:
- Try to Prepare an order when stock is insufficient — confirm the exact shortfall is shown per item.
- Complete an order with a wasted quantity on one output and confirm the wasted portion is excluded from cost/inventory but still logged with its reason.
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

**Who can do it**: edit access to Stock Adjustments (posting uses the same permission as editing).

**Things to test**:
- Confirm Post only ever appears as an option while status is Draft.
- **Do not test for an approval step.** Pending, Approved, and Rejected exist as filter options and as designed stages, but there is no button anywhere in the app that sets them. If you find a status filter for "Pending Approval" and can't get a record into that state, this is why — flag it to the product team as a design-vs-implementation gap, not a bug you need to chase.
- Confirm posting correctly updates the item's on-hand quantity by exactly the adjusted amount, and that a corresponding stock transaction appears in the stock ledger.

---

## 17. Load Lists

**What it's for**: tracking an inbound shipment/container from a supplier before it becomes a formal goods receipt.

**How a record starts**: click **New** on the Load Lists list.

**Stages**: Draft → Confirmed → In Transit → Arrived → Receiving → Pending Approval → Received, or Cancelled.

**Step-by-step workflow**:

1. **Create** → status Draft.
2. **Confirm** → status Confirmed.
3. **Link Stock Requisitions** (optional) — attaches one or more purchasing requisitions (section 17b) to this shipment's line items, marking those requisitions as fully or partially fulfilled.
4. **Mark In Transit** → status In Transit. Captures an estimated arrival date and carrier name.
5. **Mark Arrived** → status Arrived. **This is the key trigger: it automatically creates the linked Goods Receipt Note** (section 18) — you never manually create one from scratch. The confirmation will show the new receipt's number.
   - **Reverse Arrival** is available immediately after, to undo an accidental click — puts it back to In Transit.
6. From here, Receiving and Pending Approval are driven entirely by progress on the linked Goods Receipt Note, not by any button on the Load List itself.
7. **Received** can only happen by confirming the linked Goods Receipt Note — trying to set a Load List straight to Received from this screen is explicitly refused with a message pointing you to the receipt.
8. **Cancel** — only available up through In Transit. Once Arrived or later, it must be reversed step-by-step first; the app will explain this if you try. Cancelling correctly rolls back any "in transit" stock quantity that had been reserved.

**Who can do it**: edit access to Load Lists; Mark In Transit and Mark Arrived each require their own separate, more specific permission on top of that.

**Things to test**:
- Confirm Mark Arrived actually creates a receipt and that its number matches what appears in the receipts list.
- Try to cancel an Arrived Load List directly — should be refused with guidance to reverse first.
- Test Reverse Arrival and confirm it doesn't leave a duplicate/orphaned receipt behind.
- Confirm a user with base Load List edit access but *not* the Mark Arrived permission cannot see/click that button.

---

## 17b. Stock Requisitions

**What it's for**: a purchasing-side request to source specific items — the internal ask that eventually gets fulfilled by a supplier shipment (Load List). Not to be confused with "Stock Requests" (section 12), which is a warehouse-to-warehouse transfer.

**How a record starts**: click **New** on the Stock Requisitions list.

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

**Stages**: Draft → Receiving → Pending Approval → Approved, or Rejected / Cancelled.

**Step-by-step workflow**:

1. Created automatically in Draft when its Load List arrives.
2. **Start Receiving** → status Receiving. Requires the linked Load List to actually be Arrived.
3. While receiving, **Save Changes** lets you record received/damaged quantities and box counts as you go, without changing status — useful for a long receiving session done in stages.
4. Receiving can be **paused** and resumed later without losing progress.
5. **Submit for Approval** → status Pending Approval. Requires at least one item to actually have a received quantity greater than zero. This is the point where received stock is staged into **Putaway** (section 19) — it counts as on-hand but isn't sellable/pickable yet.
6. **Confirm** → status Approved. Notifies whoever created the Load List that it's been received.
7. Damaged items reported during receiving have their own small lifecycle (reported → being processed → resolved) tracked separately.

**Who can do it**: base view access, plus separate specific permissions for starting, saving, submitting, and confirming — a user could have some of these and not others, so buttons may appear/disappear per user.

**Things to test**:
- Confirm Start Receiving is blocked if the Load List isn't actually Arrived yet.
- Try to Submit for Approval with every line at zero received quantity — should be refused.
- After Submit, confirm the received quantity shows up in on-hand stock but **not** in available/sellable stock, until Putaway (section 19) is completed for it.
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
- Confirm stock that's sitting in Putaway (not yet posted) shows up in on-hand totals but is genuinely excluded from available-to-sell/available-to-pick stock everywhere this is shown (item detail, inventory reports, reorder calculations) — this is called out as not fully verified yet, so it's a good area to spend extra time on.
- Post a task partially, confirm the remaining quantity is correct and the task stays open, then post the remainder and confirm it completes.
- Try to post more than the pending quantity — should be refused.
- For a receiving-sourced task, check whether a batch code is pre-filled/suggested from the receiving batch, and confirm the destination *location* can still be freely chosen regardless.
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
3. **Confirm quotation** is a separate action from the status menu — it marks the quotation Accepted (optionally reserving stock at a chosen warehouse). Confirming does **not** automatically create a Sales Order; that's a deliberate, separate manual step.
4. Partially Ordered / Ordered get set automatically as Sales Orders are created that draw down the quotation's remaining line quantities.

**Who can do it**: edit access to Sales Quotations.

**Things to test**:
- Try to manually set a quotation's status to Ordered via the status menu — should be refused with a clear message.
- Confirm a quotation, then create a Sales Order referencing only some of its lines/quantities, and confirm the quotation becomes Partially Ordered, not Ordered.
- Fully draw down all quotation lines via Sales Orders and confirm it then becomes Ordered.

---

## 21. Sales Orders

**What it's for**: a firm, confirmed order from a customer, which can be invoiced and/or trigger production.

**How a record starts**: click **New** — either standalone or referencing lines from an accepted Sales Quotation.

**Stages**: Draft → Confirmed → In Progress → Shipped → Delivered → Invoiced, or Cancelled.

**Step-by-step workflow**:

1. **Create** → status Draft.
2. **Confirm** → status Confirmed. Only available while Draft.
3. **Invoice** (available once Confirmed or In Progress) — opens a dialog to choose a warehouse, then creates a linked Sales Invoice (section 22) as a draft, validating and reserving/deducting stock at that warehouse.
4. **Create Job Order** — only appears for orders that actually contain items requiring production (e.g. custom framing). Opens a warehouse dialog, then creates a linked Frame Job Order (section 23). Once a job order exists, this button becomes **View Job Order** instead, linking straight to it.
5. **Cancel Order** — blocked once the order has already been invoiced; the app is explicit that invoiced orders cannot be cancelled.
6. In Progress, Shipped, Delivered, and Invoiced are set automatically as invoicing/shipment progresses, not via direct buttons on this screen.

**Who can do it**: edit access to Sales Orders (this also covers creating a linked Frame Job Order — no separate manufacturing permission is needed for that step).

**Things to test**:
- Try to cancel an already-invoiced order — should be refused.
- Confirm the "Create Job Order" button only shows for orders that actually need production, and correctly flips to "View Job Order" once one exists.
- Invoice an order and confirm stock is correctly reserved/deducted at the chosen warehouse, and that the resulting invoice is linked back to this order.

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

Clicking **Record Payment** opens a dialog with the amount pre-filled to the *full remaining balance due* — a tester has to deliberately change it to test a partial payment, so don't assume the default behavior tests partial payments for you. Required fields: Amount (must be greater than zero and cannot exceed the amount currently due — both enforced), Payment Date, and Payment Method (a dropdown, e.g. bank transfer). Reference and Notes are optional.

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
- If possible, verify the "payment succeeds but ledger posting silently fails" gap described above — this is a real, confirmed behavior, not a hypothetical.

---

## 23. Frame Job Orders

**What it's for**: production for custom framing/chop-and-join items, triggered from a Sales Order.

**How a record starts**: only via a Sales Order's "Create Job Order" button (section 21, step 4) — never created standalone.

**Stages**: Pending → Queued → In Progress → On Hold → Completed, or Cancelled.

**Step-by-step workflow**:

1. Created from a Sales Order, materials reserved at the chosen warehouse.
2. **Push to Production** → creates a linked Manufacturing Order (section 24). From this point, the job order's status is largely driven automatically by the linked manufacturing order's progress.
3. **Complete** — this is blocked until the linked manufacturing order has itself fully finished; trying to complete a job order while production is still ongoing should fail with a clear message.

**Who can do it**: pushing to production requires manufacturing or transformation-level create access. There is a known permission mix-up on the Complete action — its endpoint currently requires Sales Quotations edit permission rather than a job-order or manufacturing permission. Test the mismatch in both reachable directions: a user with quotation edit access but without the intended job/manufacturing access may be allowed to complete, while an intended job/manufacturing operator without quotation edit access is denied. Either result exposes the permission defect; it is not expected behavior to validate.

**Things to test**:
- Try to Complete a job order while its linked manufacturing order is still In Progress — should be refused.
- Push a job order to production and confirm a Manufacturing Order actually gets created and linked correctly.
- Confirm status changes on the manufacturing side (hold, resume, complete a step) are reflected back on the job order's own status.
- Test job-order completion with quotation edit but without the intended job/manufacturing permission, then with the intended job/manufacturing permission but without quotation edit; the current mismatch may allow the first user and denies the second.

---

## 24. Manufacturing Orders / Manufacturing Floor

**What it's for**: the shop-floor production tracking that backs Frame Job Orders (and potentially other production sources).

**How a record starts**: automatically from a Frame Job Order's "Push to Production" step (section 23) — a manual creation path may also exist for standalone production.

**Stages**: Queued → Ready → In Progress → On Hold → Quality Check → Completed, or Cancelled. Each order also has individual production steps with their own progress (pending/in-progress/completed/blocked), and materials tracked as required/reserved/issued/short/consumed.

**Step-by-step workflow**:

The shop-floor screen shows one dynamic primary button per order, depending on current stage:

1. Queued/Ready → **Start**.
2. Once started, the current step shows **Complete Step**; if it's the last step, the button instead reads **Complete Job**.
3. While In Progress or Quality Check, **Hold** moves the order to On Hold. Queued or Ready orders cannot be held because the order must be started first.
4. On Hold → **Resume** brings it back to where it left off.
5. The direct **Complete** action is available only while the order is On Hold. In Progress and Quality Check orders instead show **Hold** alongside the current step-completion action.

**Who can do it**: manufacturing or transformation-level edit access (either is sufficient).

**Things to test**:
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

**What it's for**: a complete, filterable audit trail of every stock movement (in, out, transfer, adjustment) per item and warehouse. This is less a "workflow to test" and more a tool *you'll use constantly* to verify other modules did what they claimed — e.g. after completing a Stock Transformation or posting a Goods Receipt, this is where you'd go to confirm the exact quantity and cost actually moved as expected.

**Reachability note**: this page exists, works, and is not a placeholder — but like the Accounting section, **nothing in the app's navigation links to it**; it's reachable only by direct URL. This is a different page from the "Stock Transactions" item that does appear in the Inventory menu — don't assume they're the same screen, and confirm which one your test scope actually expects you to use.

**Things to test**:
- After completing any stock-moving action elsewhere (a Goods Receipt, a Transformation, an Adjustment, a Putaway posting), confirm the corresponding entry shows up here with the correct item, warehouse, quantity, and direction.
- Filter by item, warehouse, and voucher/transaction type and confirm the results narrow correctly.

---

## 30. Reports Directory

**What it's for**: a catalog of business reports, reachable from the main Reports menu. Not every report listed here is actually built — the screen itself distinguishes "implemented" reports from "coming soon" placeholders, and testers should treat that distinction as authoritative rather than assuming everything on the page works.

**Reports that are actually implemented (safe to test as real features)**: Stock Reports, Stock Aging, Inventory Report, Fast-Moving Products, Slow-Moving Products, Item-Location-Batch report, Customer Ledger, AR Aging, Shipments Report, Picking Efficiency, Transformation Efficiency.

**Reports explicitly marked "coming soon" (do not file bugs against these — they're not built yet)**: Stock Turnover, Reorder Analysis, Warehouse Utilization, Stock Variance, Batch Traceability, Profit & Loss Statement, Balance Sheet, Cash Flow, AP Aging, Sales Profitability, COGS Analysis, Supplier Scorecard, PO Variance, Supplier Spend, Price Variance, Delivery Performance, Stock Transfer report, Return-to-Supplier Analysis, Executive Summary, Period Comparison, Budget vs. Actual, Audit Trail, Document Status, User Activity, Demand Forecast, What-If Analysis.

**Things to test**:
- Confirm every report marked "implemented" actually opens and renders data, not just the catalog tile.
- Confirm reports marked "coming soon" show a clear "not yet available" state rather than a broken/blank screen if clicked.
- Some reports are gated behind extra permissions beyond basic Reports access (e.g. certain financial figures require a pricing/valuation-visibility permission) — test with a restricted role to confirm those specific numbers are hidden rather than the whole report failing.

---

## 31. Warehouse Dashboard

**What it's for**: the landing page every user sees after logging in — summary cards (incoming shipments, open stock requests, active pick lists), an inventory health panel, and a recent stock-movements list.

**Nature of this screen**: read-only, and every widget on it is independently permission-gated — a user might see some cards and not others depending on their role.

**Things to test**:
- Log in as users with different roles and confirm each only sees the summary widgets their permissions actually allow, rather than either seeing everything or seeing a broken/empty dashboard.
- Confirm the numbers shown (open stock requests, active pick lists, etc.) match what you can independently count from those modules' own list screens.

---

## 32. Activity Logs

**What it's for**: an admin-only audit trail of user actions across the app (who did what, when) — useful for confirming that actions you've tested elsewhere in this guide were actually logged.

**Things to test**:
- Perform a few actions elsewhere in the app (e.g. approve a Stock Request, post a Stock Adjustment) and confirm each shows up here with the correct user, action, and timestamp.
- Confirm this screen itself is only reachable by users with the appropriate admin permission.

---

## Things every tester should check on every module

These apply across *every* module above, so check them once per module rather than assuming they were covered elsewhere:

1. **Two layers of permission.** Most actions first check a broad "can this user use this module at all" permission, and some actions then check a second, narrower permission on top (e.g. a user might be able to edit receipts generally but specifically lack the ability to Confirm one). When testing with a restricted-permission user, check that the specific button is actually blocked, not just that it's hidden.
2. **Warehouse/branch matters.** Several transitions require the acting user to belong to a *specific* warehouse or branch relative to the transaction — e.g. only the fulfilling side can approve a Stock Request, only the receiving side can start receiving a delivery. A good negative test for almost every module is: "log in as a user on the *wrong* side of the transaction and confirm the action is refused."
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
7. **Newer vs. older modules behave differently on failure.** The newer modules (goods receiving, load lists, deliveries, transformations, job orders, manufacturing, putaway) are built so a failure partway through leaves nothing half-done. Some older modules (legacy purchase-order receiving, invoice sending, stock-transfer confirmation) do their work in several separate steps — these are worth extra stress-testing for partial-failure states, e.g. what happens if the connection drops mid-action.
