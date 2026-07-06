export type NavigationPageMetadata = {
  pageKey: string;
  title: string;
};

type NavigationPageDefinition = NavigationPageMetadata & {
  match: RegExp;
};

const NAVIGATION_PAGES: NavigationPageDefinition[] = [
  { pageKey: "dashboard", title: "Dashboard", match: /^\/dashboard$/ },
  { pageKey: "inventory.items.create", title: "Create Item", match: /^\/inventory\/items\/create$/ },
  {
    pageKey: "inventory.items.edit",
    title: "Edit Item",
    match: /^\/inventory\/items\/[^/]+\/edit$/,
  },
  { pageKey: "inventory.items.detail", title: "Item Details", match: /^\/inventory\/items\/[^/]+$/ },
  { pageKey: "inventory.items", title: "Item Master", match: /^\/inventory\/items$/ },
  {
    pageKey: "inventory.warehouses.locations",
    title: "Warehouse Locations",
    match: /^\/inventory\/warehouses\/[^/]+\/locations$/,
  },
  { pageKey: "inventory.warehouses", title: "Warehouses", match: /^\/inventory\/warehouses$/ },
  { pageKey: "inventory.stock", title: "Stock Transactions", match: /^\/inventory\/stock$/ },
  {
    pageKey: "inventory.adjustments",
    title: "Stock Adjustments",
    match: /^\/inventory\/adjustments$/,
  },
  {
    pageKey: "inventory.stock_requests",
    title: "Stock Transfers",
    match: /^\/inventory\/stock-requests$/,
  },
  {
    pageKey: "inventory.delivery_notes.detail",
    title: "Delivery Note Details",
    match: /^\/inventory\/delivery-notes\/[^/]+$/,
  },
  {
    pageKey: "inventory.delivery_notes",
    title: "Delivery Notes",
    match: /^\/inventory\/delivery-notes$/,
  },
  { pageKey: "inventory.pick_lists", title: "Pick Lists", match: /^\/inventory\/pick-lists$/ },
  { pageKey: "inventory.reorder", title: "Reorder Management", match: /^\/inventory\/reorder$/ },
  {
    pageKey: "manufacturing.transformations.templates.design",
    title: "Transformation Template Designer",
    match: /^\/manufacturing\/transformations\/templates\/design$/,
  },
  {
    pageKey: "manufacturing.transformations.templates",
    title: "Transformation Templates",
    match: /^\/manufacturing\/transformations\/templates$/,
  },
  {
    pageKey: "manufacturing.transformations.new",
    title: "New Stock Transformation",
    match: /^\/manufacturing\/transformations\/new$/,
  },
  {
    pageKey: "manufacturing.transformations.detail",
    title: "Stock Transformation Details",
    match: /^\/manufacturing\/transformations\/[^/]+$/,
  },
  {
    pageKey: "manufacturing.transformations",
    title: "Stock Transformations",
    match: /^\/manufacturing\/transformations$/,
  },
  { pageKey: "sales.overview", title: "Sales", match: /^\/sales$/ },
  { pageKey: "sales.pos.transactions", title: "POS Transactions", match: /^\/sales\/pos\/transactions$/ },
  { pageKey: "sales.pos", title: "Point of Sale", match: /^\/sales\/pos$/ },
  { pageKey: "sales.customers.detail", title: "Customer Details", match: /^\/sales\/customers\/[^/]+$/ },
  { pageKey: "sales.customers", title: "Customers", match: /^\/sales\/customers$/ },
  {
    pageKey: "sales.quotations.create",
    title: "Create Quotation",
    match: /^\/sales\/quotations\/create$/,
  },
  {
    pageKey: "sales.quotations.edit",
    title: "Edit Quotation",
    match: /^\/sales\/quotations\/[^/]+\/edit$/,
  },
  { pageKey: "sales.quotations", title: "Quotations", match: /^\/sales\/quotations$/ },
  { pageKey: "sales.orders.create", title: "Create Sales Order", match: /^\/sales\/orders\/create$/ },
  { pageKey: "sales.orders", title: "Sales Orders", match: /^\/sales\/orders$/ },
  { pageKey: "sales.invoices", title: "Invoices", match: /^\/sales\/invoices$/ },
  {
    pageKey: "sales.frame_job_orders.detail",
    title: "Job Order Details",
    match: /^\/sales\/frame-job-orders\/[^/]+$/,
  },
  { pageKey: "sales.frame_job_orders", title: "Job Orders", match: /^\/sales\/frame-job-orders$/ },
  { pageKey: "manufacturing.orders", title: "Manufacturing Orders", match: /^\/manufacturing\/orders$/ },
  { pageKey: "manufacturing.floor", title: "Production Floor", match: /^\/manufacturing\/floor$/ },
  { pageKey: "purchasing.overview", title: "Purchasing Overview", match: /^\/purchasing\/overview$/ },
  { pageKey: "purchasing.suppliers.detail", title: "Supplier Details", match: /^\/purchasing\/suppliers\/[^/]+$/ },
  { pageKey: "purchasing.suppliers", title: "Suppliers", match: /^\/purchasing\/suppliers$/ },
  {
    pageKey: "purchasing.stock_requisitions.detail",
    title: "Stock Requisition Details",
    match: /^\/purchasing\/stock-requisitions\/[^/]+$/,
  },
  {
    pageKey: "purchasing.stock_requisitions",
    title: "Stock Requisitions",
    match: /^\/purchasing\/stock-requisitions$/,
  },
  { pageKey: "purchasing.load_lists.detail", title: "Load List Details", match: /^\/purchasing\/load-lists\/[^/]+$/ },
  { pageKey: "purchasing.load_lists", title: "Load Lists", match: /^\/purchasing\/load-lists$/ },
  { pageKey: "purchasing.grns.putaway", title: "GRN Putaway", match: /^\/purchasing\/grns\/putaway$/ },
  { pageKey: "purchasing.grns.detail", title: "GRN Details", match: /^\/purchasing\/grns\/[^/]+$/ },
  { pageKey: "purchasing.grns", title: "Goods Receipt Notes", match: /^\/purchasing\/grns$/ },
  { pageKey: "reports", title: "Reports Directory", match: /^\/reports$/ },
  { pageKey: "reports.commission", title: "Commission Report", match: /^\/reports\/commission$/ },
  { pageKey: "reports.sales_analytics", title: "Sales Analytics Report", match: /^\/reports\/sales-analytics$/ },
  { pageKey: "admin.users", title: "Users", match: /^\/admin\/users$/ },
  { pageKey: "admin.roles", title: "Roles", match: /^\/admin\/roles$/ },
  { pageKey: "admin.activity_logs", title: "Activity Logs", match: /^\/admin\/activity-logs$/ },
  { pageKey: "admin.settings", title: "Settings", match: /^\/admin\/settings(\/[^/]+)?$/ },
  { pageKey: "profile.preferences", title: "Profile Preferences", match: /^\/profile\/preferences$/ },
];

export function resolveNavigationPage(pathname: string): NavigationPageMetadata | null {
  const normalizedPath = pathname.trim().replace(/\/+$/, "") || "/";
  const page = NAVIGATION_PAGES.find((definition) => definition.match.test(normalizedPath));
  return page ? { pageKey: page.pageKey, title: page.title } : null;
}
