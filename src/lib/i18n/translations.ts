/**
 * Translation dictionaries for all supported languages
 *
 * Structure: translations[locale][namespace][key]
 */

import type { Locale } from "./index";

export type TranslationKeys = {
  common: {
    loading: string;
    error: string;
    success: string;
    confirm: string;
    yes: string;
    no: string;
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    create: string;
    search: string;
    filter: string;
    export: string;
    import: string;
    actions: string;
    status: string;
    name: string;
    code: string;
    description: string;
    notes: string;
    date: string;
    quantity: string;
    price: string;
    total: string;
    submit: string;
    close: string;
    add: string;
    item: string;
    items: string;
    warehouse: string;
    select: string;
    search_: string;
    view: string;
    allStatuses: string;
    draft: string;
    preparing: string;
    completed: string;
    cancelled: string;
    active: string;
    inactive: string;
    usageCount: string;
    locked: string;
  };
  forms: {
    required: string;
    invalid: string;
    saveSuccess: string;
    saveError: string;
    deleteConfirm: string;
    deleteSuccess: string;
    deleteError: string;
    noResults: string;
    selectItem: string;
    noDataFound: string;
  };
  transformation: {
    transformations: string;
    transformation: string;
    template: string;
    templates: string;
    order: string;
    orders: string;
    newTransformation: string;
    newTemplate: string;
    transformationOrder: string;
    transformationTemplate: string;
    inputMaterials: string;
    outputProducts: string;
    totalInputCost: string;
    totalOutputCost: string;
    costVariance: string;
    orderDate: string;
    plannedQuantity: string;
    actualQuantity: string;
    planned: string;
    consumed: string;
    produced: string;
    unitCost: string;
    totalCost: string;
    scrap: string;
    prepare: string;
    complete: string;
    cancelOrder: string;
    prepareOrder: string;
    completeOrder: string;
    preparing: string;
    orderPrepared: string;
    orderCompleted: string;
    orderCancelled: string;
    notFound: string;
    prepareConfirmation: string;
    completeConfirmation: string;
    cancelConfirmation: string;
    manageTemplates: string;
    manageMaterialTransformations: string;
    orderCode: string;
    searchOrdersPlaceholder: string;
    noOrdersFound: string;
    createNewOrder: string;
    orderDetails: string;
    selectTemplate: string;
    selectWarehouse: string;
    plannedExecutionDate: string;
    pickDate: string;
    createFromTemplate: string;
    executeTransformation: string;
    actualConsumed: string;
    actualProduced: string;
    enterActualQuantities: string;
    difference: string;
    exceedsPlanned: string;
    wastedQuantity: string;
    wasteReason: string;
    enterWasteDetails: string;
    optional: string;
    tryAdjustingSearchOrStatus: string;
    notAvailable: string;
    dash: string;
    templateRequired: string;
    noTemplatesTitle: string;
    noTemplatesDescription: string;
    warehouseRequired: string;
    orderDateRequired: string;
    plannedQuantityGreaterThanZero: string;
    companyIdMissing: string;
    failedCreateTransformationOrder: string;
    failedExecuteTransformation: string;
    failedOrderAction: string;
    noReasonProvided: string;
    totalExceedsPlanned: string;
    totalLessThanPlanned: string;
    wasteReasonRequired: string;
    totalAccounted: string;
  };
  pagination: {
    rowsPerPage: string;
    pageOf: string;
    showing: string;
    goToFirstPage: string;
    goToPreviousPage: string;
    goToNextPage: string;
    goToLastPage: string;
  };
  navigation: Record<string, string>;
  warehousesPage: {
    title: string;
    subtitle: string;
    createWarehouse: string;
    searchPlaceholder: string;
    statusPlaceholder: string;
    allStatus: string;
    loadingError: string;
    empty: string;
    location: string;
    manager: string;
    contact: string;
    locations: string;
    deleteTitle: string;
    deleteDescription: string;
    deleteDescriptionWithName: string;
    deleteSuccess: string;
    deleteError: string;
  };
  warehouseForm: {
    createTitle: string;
    editTitle: string;
    createDescription: string;
    editDescription: string;
    codeLabel: string;
    nameLabel: string;
    descriptionLabel: string;
    locationInformation: string;
    contactInformation: string;
    addressLabel: string;
    cityLabel: string;
    stateLabel: string;
    postalCodeLabel: string;
    countryLabel: string;
    phoneLabel: string;
    emailLabel: string;
    activeStatusLabel: string;
    activeStatusDescription: string;
    codePlaceholder: string;
    namePlaceholder: string;
    descriptionPlaceholder: string;
    addressPlaceholder: string;
    cityPlaceholder: string;
    statePlaceholder: string;
    postalCodePlaceholder: string;
    countryPlaceholder: string;
    phonePlaceholder: string;
    emailPlaceholder: string;
    saving: string;
    createAction: string;
    updateAction: string;
    createSuccess: string;
    updateSuccess: string;
    createError: string;
    updateError: string;
    missingCompany: string;
  };
  warehouseValidation: {
    codeRequired: string;
    codeMax: string;
    codeFormat: string;
    nameRequired: string;
    nameMax: string;
    descriptionMax: string;
    addressMax: string;
    cityMax: string;
    stateMax: string;
    postalCodeMax: string;
    countryMax: string;
    phoneMax: string;
    emailInvalid: string;
    emailMax: string;
  };
  dashboardPage: {
    goodMorning: string;
    goodNoon: string;
    goodAfternoon: string;
    goodEvening: string;
    fallbackUser: string;
    subtitle: string;
    loadError: string;
    retry: string;
    incomingShipments: string;
    inTransit: string;
    stockRequests: string;
    pending: string;
    pickList: string;
    toPick: string;
  };
  warehouseDashboard: {
    lowStocks: string;
    outOfStocks: string;
    noLowStockItems: string;
    noOutOfStockItems: string;
    locationLabel: string;
    reorderLabel: string;
    lastLabel: string;
    viewAllInventory: string;
    operationalQueue: string;
    pickListTab: string;
    incomingTab: string;
    requestsTab: string;
    noItemsToPick: string;
    noIncomingDeliveries: string;
    noPendingRequests: string;
    itemsCount: string;
    dueLabel: string;
    byLabel: string;
    etaLabel: string;
    requiredLabel: string;
    status_draft: string;
    status_submitted: string;
    status_approved: string;
    status_picking: string;
    status_picked: string;
    status_delivered: string;
    status_completed: string;
    status_cancelled: string;
    status_in_transit: string;
    status_partially_received: string;
    priority_low: string;
    priority_normal: string;
    priority_high: string;
    priority_urgent: string;
    lastStockMovements: string;
    noRecentStockMovements: string;
    justNow: string;
    minutesAgo: string;
    hoursAgo: string;
    byUser: string;
  };
  notificationsPage: {
    title: string;
    subtitle: string;
    filter: string;
    all: string;
    unread: string;
    empty: string;
    emptyMenu: string;
    new: string;
    markAsRead: string;
    viewAll: string;
  };
  userMenu: {
    myProfile: string;
    myPreferences: string;
    changePassword: string;
    logOut: string;
  };
  preferencesPage: {
    title: string;
    subtitle: string;
    displayTitle: string;
    displayDescription: string;
  };
  fontSizeSettings: {
    title: string;
    description: string;
    size_small: string;
    size_medium: string;
    size_large: string;
    size_extraLarge: string;
    preview: string;
  };
  accessDeniedPage: {
    title: string;
    resourceNeedAll: string;
    resourceNeedOne: string;
    resourceNeedView: string;
    noPermission: string;
    supportMessage: string;
    goBack: string;
    goHome: string;
    logout: string;
    loading: string;
    errorCode: string;
  };
  chartOfAccountsPage: {
    title: string;
    subtitle: string;
    newAccount: string;
    searchPlaceholder: string;
    accountType: string;
    allTypes: string;
    allStatus: string;
    totalAccounts: string;
    assets: string;
    liabilities: string;
    revenue: string;
    accountNumber: string;
    accountName: string;
    type: string;
    level: string;
    system: string;
    systemAccount: string;
    loading: string;
    empty: string;
    unknown: string;
    viewActions: string;
    active: string;
    inactive: string;
    asset: string;
    liability: string;
    equity: string;
    expense: string;
    cogs: string;
  };
  journalsPage: {
    title: string;
    subtitle: string;
    newJournalEntry: string;
    searchPlaceholder: string;
    source: string;
    allSources: string;
    totalEntries: string;
    posted: string;
    draft: string;
    totalDebits: string;
    journalCode: string;
    date: string;
    reference: string;
    debit: string;
    credit: string;
    loading: string;
    empty: string;
    viewJournalEntry: string;
    printJournalEntry: string;
    ar: string;
    ap: string;
    inventory: string;
    manual: string;
  };
  journalEntryFormDialog: {
    loadAccountsError: string;
    minLinesError: string;
    unbalancedError: string;
    unbalancedDescription: string;
    accountRequiredError: string;
    debitCreditRequiredError: string;
    createError: string;
    createSuccess: string;
    createSuccessDescription: string;
    title: string;
    description: string;
    postingDate: string;
    referenceCode: string;
    referencePlaceholder: string;
    descriptionLabel: string;
    descriptionPlaceholder: string;
    journalLines: string;
    addLine: string;
    account: string;
    selectAccount: string;
    lineDescriptionPlaceholder: string;
    debit: string;
    credit: string;
    totals: string;
    totalDebit: string;
    totalCredit: string;
    difference: string;
    balanced: string;
    notBalanced: string;
    creating: string;
    createAction: string;
  };
  journalEntryViewDialog: {
    postError: string;
    postSuccess: string;
    postSuccessDescription: string;
    title: string;
    noDescription: string;
    postingDate: string;
    sourceModule: string;
    referenceCode: string;
    postedAt: string;
    journalLines: string;
    lineNumber: string;
    account: string;
    descriptionLabel: string;
    debit: string;
    credit: string;
    totals: string;
    balanced: string;
    outOfBalance: string;
    difference: string;
    createdAt: string;
    lastUpdated: string;
    posting: string;
    postToGl: string;
  };
  generalLedgerPage: {
    title: string;
    subtitle: string;
    export: string;
    print: string;
    account: string;
    selectAccount: string;
    fromDate: string;
    toDate: string;
    loading: string;
    viewLedger: string;
    openingBalance: string;
    closingBalance: string;
    totalDebits: string;
    totalCredits: string;
    netChange: string;
    date: string;
    journalCode: string;
    descriptionLabel: string;
    source: string;
    reference: string;
    debit: string;
    credit: string;
    balance: string;
    noTransactions: string;
    notAvailable: string;
  };
  trialBalancePage: {
    title: string;
    subtitle: string;
    export: string;
    print: string;
    asOfDate: string;
    loading: string;
    generateReport: string;
    asOf: string;
    balanced: string;
    notBalanced: string;
    totalDebits: string;
    totalCredits: string;
    difference: string;
    accountNumber: string;
    accountName: string;
    type: string;
    debit: string;
    credit: string;
    noActivity: string;
    total: string;
    notAvailable: string;
  };
  adminUsersPage: {
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    all: string;
    active: string;
    inactive: string;
    user: string;
    username: string;
    created: string;
    loadError: string;
    emptyTitle: string;
    emptyDescription: string;
    manageRoles: string;
    viewPermissions: string;
    deactivate: string;
    activate: string;
    statusUpdatedActive: string;
    statusUpdatedInactive: string;
    statusUpdateError: string;
  };
  adminUserRolesDialog: {
    title: string;
    description: string;
    currentRoles: string;
    noRoles: string;
    unknownBusinessUnit: string;
    assignNewRole: string;
    role: string;
    businessUnit: string;
    selectRole: string;
    selectBusinessUnit: string;
    system: string;
    assignRole: string;
    assigning: string;
    selectRoleAndBusinessUnit: string;
    roleAssignedSuccess: string;
    roleAssignedError: string;
    roleRemovedSuccess: string;
    roleRemovedError: string;
  };
  adminUserPermissionsDialog: {
    title: string;
    description: string;
    activePermissions: string;
    searchPlaceholder: string;
    noSearchResults: string;
    noPermissions: string;
    resource: string;
    showingSummary: string;
  };
  adminRolesPage: {
    title: string;
    subtitle: string;
    createRole: string;
    searchPlaceholder: string;
    role: string;
    type: string;
    created: string;
    loadError: string;
    emptyTitle: string;
    emptyDescription: string;
    noDescription: string;
    system: string;
    custom: string;
    permissions: string;
    cannotDeleteSystemRoles: string;
    roleDeletedSuccess: string;
    roleDeletedError: string;
    deleteTitle: string;
    deleteDescription: string;
    deleting: string;
  };
  adminRolePermissionsDialog: {
    title: string;
    description: string;
    systemRole: string;
    searchPlaceholder: string;
    noSearchResults: string;
    noPermissionsInSystem: string;
    available: string;
    assignedSummary: string;
    shownSummary: string;
    saving: string;
    saveChanges: string;
    permissionsUpdatedSuccess: string;
    permissionsUpdatedError: string;
  };
  adminCreateRoleDialog: {
    title: string;
    description: string;
    roleName: string;
    roleNamePlaceholder: string;
    descriptionLabel: string;
    descriptionPlaceholder: string;
    copyPermissionsFrom: string;
    selectRolePlaceholder: string;
    system: string;
    copySummary: string;
    creating: string;
    createRole: string;
    roleNameRequired: string;
    roleCreatedSuccess: string;
    roleCreatedWithCopySuccess: string;
    roleCreateError: string;
  };
  adminEditRoleDialog: {
    title: string;
    description: string;
    roleName: string;
    roleNamePlaceholder: string;
    descriptionLabel: string;
    descriptionPlaceholder: string;
    updating: string;
    updateRole: string;
    roleNameRequired: string;
    roleUpdatedSuccess: string;
    roleUpdateError: string;
  };
  salesPage: {
    title: string;
    subtitle: string;
    totalCustomers: string;
    totalCustomersDescription: string;
    totalRevenue: string;
    totalRevenueDescription: string;
    outstandingCredit: string;
    outstandingCreditDescription: string;
    pendingOrders: string;
    pendingOrdersDescription: string;
    quickAccess: string;
    pointOfSale: string;
    pointOfSaleDescription: string;
    customers: string;
    customersDescription: string;
    quotations: string;
    quotationsDescription: string;
    salesOrders: string;
    salesOrdersDescription: string;
    invoices: string;
    invoicesDescription: string;
    goTo: string;
  };
  customersPage: {
    title: string;
    subtitle: string;
    createCustomer: string;
    searchPlaceholder: string;
    typePlaceholder: string;
    allTypes: string;
    customer: string;
    contact: string;
    location: string;
    creditLimit: string;
    balance: string;
    typeCompany: string;
    typeGovernment: string;
    typeIndividual: string;
    loadError: string;
    empty: string;
    deleteTitle: string;
    deleteDescription: string;
    deleteDescriptionWithName: string;
    deleteSuccess: string;
    deleteError: string;
  };
  customerForm: {
    editTitle: string;
    createTitle: string;
    editDescription: string;
    createDescription: string;
    generalTab: string;
    billingTab: string;
    shippingTab: string;
    paymentTab: string;
    customerCode: string;
    customerCodePlaceholder: string;
    customerType: string;
    selectType: string;
    typeIndividual: string;
    typeCompany: string;
    typeGovernment: string;
    customerName: string;
    customerNamePlaceholder: string;
    email: string;
    emailPlaceholder: string;
    phone: string;
    phonePlaceholder: string;
    mobile: string;
    mobilePlaceholder: string;
    website: string;
    websitePlaceholder: string;
    taxId: string;
    taxIdPlaceholder: string;
    contactPersonOptional: string;
    name: string;
    contactNamePlaceholder: string;
    contactEmailPlaceholder: string;
    contactPhonePlaceholder: string;
    address: string;
    addressPlaceholder: string;
    city: string;
    cityPlaceholder: string;
    state: string;
    statePlaceholder: string;
    postalCode: string;
    postalCodePlaceholder: string;
    country: string;
    selectCountry: string;
    sameAsBilling: string;
    paymentTerms: string;
    selectPaymentTerms: string;
    paymentCash: string;
    paymentDueOnReceipt: string;
    paymentNet30: string;
    paymentNet60: string;
    paymentNet90: string;
    paymentCod: string;
    creditLimit: string;
    creditLimitPlaceholder: string;
    notes: string;
    notesPlaceholder: string;
    activeCustomer: string;
    missingCompany: string;
    createSuccess: string;
    updateSuccess: string;
    createError: string;
    updateError: string;
    saving: string;
    updateCustomer: string;
    createCustomer: string;
  };
  customerValidation: {
    customerCodeRequired: string;
    customerCodeFormat: string;
    customerNameRequired: string;
    invalidEmail: string;
    phoneRequired: string;
    billingAddressRequired: string;
    billingCityRequired: string;
    billingStateRequired: string;
    billingPostalCodeRequired: string;
    billingCountryRequired: string;
    shippingAddressRequired: string;
    shippingCityRequired: string;
    shippingStateRequired: string;
    shippingPostalCodeRequired: string;
    shippingCountryRequired: string;
    creditLimitMin: string;
  };
  employeesPage: {
    title: string;
    subtitle: string;
    addEmployee: string;
    totalEmployees: string;
    activeEmployees: string;
    avgCommissionRate: string;
    avgCommissionRateDescription: string;
    territoriesCovered: string;
    territoriesCoveredDescription: string;
    employees: string;
    employeesDescription: string;
    searchPlaceholder: string;
    firstName: string;
    lastName: string;
    role: string;
    commissionRate: string;
    territories: string;
    noEmployeesFound: string;
    noTerritories: string;
    moreCount: string;
    manageTerritories: string;
    showingEmployees: string;
    previous: string;
    next: string;
    pageOf: string;
    salesAgent: string;
    salesManager: string;
    territoryManager: string;
  };
  employeeForm: {
    createTitle: string;
    editTitle: string;
    createDescription: string;
    editDescription: string;
    employeeCode: string;
    employeeCodePlaceholder: string;
    role: string;
    selectRole: string;
    firstName: string;
    firstNamePlaceholder: string;
    lastName: string;
    lastNamePlaceholder: string;
    email: string;
    emailPlaceholder: string;
    phone: string;
    phonePlaceholder: string;
    commissionRate: string;
    commissionRatePlaceholder: string;
    commissionRateDescription: string;
    activeStatus: string;
    activeStatusDescription: string;
    creatingSuccess: string;
    updatingSuccess: string;
    saveError: string;
    createAction: string;
    saveChanges: string;
    creating: string;
    employeeCodeRequired: string;
    firstNameRequired: string;
    lastNameRequired: string;
    invalidEmail: string;
    commissionRateRange: string;
  };
  territoryManagementDialog: {
    title: string;
    description: string;
    assignedTerritories: string;
    addTerritory: string;
    noTerritories: string;
    noTerritoriesDescription: string;
    primary: string;
    removePrimary: string;
    setAsPrimary: string;
    city: string;
    selectCity: string;
    regionState: string;
    selectRegion: string;
    primaryTerritory: string;
    primaryTerritoryDescription: string;
    territoryAssignedSuccess: string;
    territoryAssignError: string;
    territoryRemovedSuccess: string;
    territoryRemoveError: string;
    territoryPrimaryAdded: string;
    territoryPrimaryRemoved: string;
    territoryPrimaryError: string;
    cityRequired: string;
    regionStateRequired: string;
  };
  salesOrdersPage: {
    title: string;
    subtitle: string;
    createOrder: string;
    searchPlaceholder: string;
    orderNumber: string;
    customer: string;
    orderDate: string;
    expectedDelivery: string;
    amount: string;
    loadError: string;
    empty: string;
    fromQuotation: string;
    overdue: string;
    itemsCount: string;
    confirm: string;
    invoice: string;
    selectWarehouseTitle: string;
    selectWarehouseDescription: string;
    selectWarehouse: string;
    selectLocationOptional: string;
    selectWarehouseFirst: string;
    converting: string;
    createInvoice: string;
    draft: string;
    confirmed: string;
    inProgress: string;
    shipped: string;
    delivered: string;
    invoiced: string;
    cancelled: string;
  };
  salesOrderForm: {
    customerRequired: string;
    orderDateRequired: string;
    expectedDeliveryDateRequired: string;
    addLineItemRequired: string;
    editTitle: string;
    createTitle: string;
    editDescription: string;
    createDescription: string;
    generalTab: string;
    lineItemsTab: string;
    shippingTab: string;
    termsTab: string;
    customer: string;
    searchCustomer: string;
    customerSearchPlaceholder: string;
    noCustomerFound: string;
    orderDate: string;
    expectedDelivery: string;
    lineItemsTitle: string;
    lineItemsDescription: string;
    addItem: string;
    noItems: string;
    noItemsDescription: string;
    qty: string;
    unit: string;
    price: string;
    discountPct: string;
    taxPct: string;
    totals: string;
    subtotal: string;
    discount: string;
    tax: string;
    total: string;
    address: string;
    addressPlaceholder: string;
    city: string;
    cityPlaceholder: string;
    stateProvince: string;
    statePlaceholder: string;
    postalCode: string;
    postalCodePlaceholder: string;
    country: string;
    countryPlaceholder: string;
    paymentTerms: string;
    internalNotes: string;
    saving: string;
    updateOrder: string;
    createOrder: string;
  };
  salesOrderViewDialog: {
    title: string;
    description: string;
    customerInformation: string;
    name: string;
    email: string;
    quotation: string;
    orderDetails: string;
    orderDate: string;
    expectedDelivery: string;
    deliveryAddress: string;
    lineItems: string;
    quantity: string;
    unit: string;
    unitPrice: string;
    discount: string;
    tax: string;
    total: string;
    subtotal: string;
    totalAmount: string;
    paymentSummary: string;
    totalInvoiced: string;
    totalPaid: string;
    balanceDue: string;
    payments: string;
    invoiceTotalSummary: string;
    ref: string;
    termsConditions: string;
    notes: string;
    generatingPdf: string;
    downloadPdf: string;
    preparingPrint: string;
    printOrder: string;
    draft: string;
    confirmed: string;
    inProgress: string;
    shipped: string;
    delivered: string;
    invoiced: string;
    cancelled: string;
    sent: string;
    partiallyPaid: string;
    paid: string;
    overdue: string;
  };
  quotationsPage: {
    title: string;
    subtitle: string;
    createQuotation: string;
    searchPlaceholder: string;
    quotationNumber: string;
    date: string;
    validUntil: string;
    amount: string;
    loadError: string;
    empty: string;
    expiringSoon: string;
    itemsCount: string;
    changeStatus: string;
    markAsSent: string;
    markAsAccepted: string;
    markAsRejected: string;
    convertToOrder: string;
    converted: string;
    convertTitle: string;
    convertDescription: string;
    convertWillLabel: string;
    convertBulletCreateOrder: string;
    convertBulletCopyItems: string;
    convertBulletStatus: string;
    convertBulletLink: string;
    convertCannotUndo: string;
    converting: string;
    convertAction: string;
    draft: string;
    sent: string;
    accepted: string;
    rejected: string;
    expired: string;
    ordered: string;
  };
  quotationForm: {
    customerRequired: string;
    quotationDateRequired: string;
    validUntilRequired: string;
    addLineItemRequired: string;
    editTitle: string;
    createTitle: string;
    editDescription: string;
    createDescription: string;
    generalTab: string;
    lineItemsTab: string;
    termsTab: string;
    customer: string;
    selectCustomer: string;
    quotationDate: string;
    validUntil: string;
    lineItemsTitle: string;
    lineItemsDescription: string;
    addItem: string;
    noItems: string;
    noItemsDescription: string;
    qty: string;
    unit: string;
    price: string;
    discountPct: string;
    taxPct: string;
    totals: string;
    subtotal: string;
    discount: string;
    tax: string;
    total: string;
    termsConditions: string;
    internalNotes: string;
    saving: string;
    updateQuotation: string;
    createQuotation: string;
  };
  quotationLineItemDialog: {
    itemRequired: string;
    quantityRequired: string;
    unitPriceRequired: string;
    uomRequired: string;
    editTitle: string;
    createTitle: string;
    editDescription: string;
    createDescription: string;
    item: string;
    searchItem: string;
    itemSearchPlaceholder: string;
    noItemFound: string;
    stockLabel: string;
    description: string;
    quantity: string;
    unitPrice: string;
    discountRate: string;
    taxRate: string;
    subtotal: string;
    discount: string;
    tax: string;
    lineTotal: string;
    updateItem: string;
    addItem: string;
  };
  quotationViewDialog: {
    title: string;
    description: string;
    customerInformation: string;
    name: string;
    email: string;
    salesOrder: string;
    quotationDetails: string;
    quotationDate: string;
    validUntil: string;
    paymentTerms: string;
    billingAddress: string;
    lineItems: string;
    quantity: string;
    unit: string;
    unitPrice: string;
    discount: string;
    tax: string;
    total: string;
    subtotal: string;
    totalAmount: string;
    termsConditions: string;
    notes: string;
    printQuotation: string;
    draft: string;
    sent: string;
    accepted: string;
    rejected: string;
    expired: string;
    ordered: string;
  };
  invoicesPage: {
    title: string;
    subtitle: string;
    createInvoice: string;
    searchPlaceholder: string;
    statusPlaceholder: string;
    allStatus: string;
    invoiceNumber: string;
    customer: string;
    invoiceDate: string;
    dueDate: string;
    amount: string;
    paid: string;
    due: string;
    status: string;
    actions: string;
    loadError: string;
    empty: string;
    fromSalesOrder: string;
    overdue: string;
    itemsCount: string;
    view: string;
    printInvoice: string;
    edit: string;
    sendToCustomer: string;
    deleteInvoice: string;
    recordPayment: string;
    cancelInvoice: string;
    sendTitle: string;
    sendDescription: string;
    sendDescriptionBody: string;
    sending: string;
    sendAction: string;
    cancel: string;
    cancelTitle: string;
    cancelDescription: string;
    cancelling: string;
    cancelAction: string;
    deleteTitle: string;
    deleteDescription: string;
    deleteLinkedSalesOrderNotice: string;
    deleting: string;
    deleteAction: string;
    draft: string;
    sent: string;
    paidStatus: string;
    partiallyPaid: string;
    overdueStatus: string;
    cancelledStatus: string;
    sendSuccess: string;
    sendError: string;
    cancelSuccess: string;
    cancelError: string;
    deleteSuccess: string;
    deleteError: string;
  };
  invoiceForm: {
    customerRequired: string;
    invoiceDateRequired: string;
    dueDateRequired: string;
    dueDateAfterInvoiceDate: string;
    addLineItemRequired: string;
    missingCustomerDetails: string;
    editTitle: string;
    createTitle: string;
    editDescription: string;
    createDescription: string;
    generalTab: string;
    lineItemsTab: string;
    termsTab: string;
    customer: string;
    selectCustomer: string;
    warehouseOptional: string;
    selectWarehouse: string;
    none: string;
    warehouseHelp: string;
    location: string;
    selectLocation: string;
    selectWarehouseFirst: string;
    invoiceDate: string;
    dueDate: string;
    lineItemsTitle: string;
    lineItemsDescription: string;
    addItem: string;
    noItems: string;
    noItemsDescription: string;
    item: string;
    qty: string;
    unit: string;
    price: string;
    actions: string;
    discountPct: string;
    taxPct: string;
    totals: string;
    subtotal: string;
    discount: string;
    tax: string;
    total: string;
    termsConditions: string;
    internalNotes: string;
    saving: string;
    updateInvoice: string;
    createInvoice: string;
    createSuccess: string;
    createError: string;
    updateSuccess: string;
    updateError: string;
  };
  invoiceLineItemDialog: {
    itemRequired: string;
    itemCodeRequired: string;
    itemNameRequired: string;
    quantityRequired: string;
    unitPriceRequired: string;
    discountMin: string;
    discountMax: string;
    taxMin: string;
    taxMax: string;
    uomRequired: string;
    editTitle: string;
    createTitle: string;
    editDescription: string;
    createDescription: string;
    item: string;
    selectItem: string;
    description: string;
    quantity: string;
    unitPrice: string;
    discountRate: string;
    taxRate: string;
    subtotal: string;
    discount: string;
    tax: string;
    lineTotal: string;
    cancel: string;
    updateItem: string;
    addItem: string;
  };
  invoiceViewDialog: {
    title: string;
    description: string;
    customerInformation: string;
    name: string;
    email: string;
    salesOrder: string;
    invoiceDetails: string;
    invoiceDate: string;
    dueDate: string;
    warehouse: string;
    location: string;
    paymentTerms: string;
    defaultPaymentTerms: string;
    billingAddress: string;
    lineItems: string;
    quantity: string;
    unit: string;
    unitPrice: string;
    discount: string;
    tax: string;
    total: string;
    subtotal: string;
    totalAmount: string;
    amountPaid: string;
    amountDue: string;
    paymentHistory: string;
    date: string;
    paymentNumber: string;
    method: string;
    balanceRemaining: string;
    reference: string;
    termsConditions: string;
    notes: string;
    generatingPdf: string;
    downloadPdf: string;
    preparingPrint: string;
    printInvoice: string;
    notAvailable: string;
    draft: string;
    sent: string;
    paidStatus: string;
    partiallyPaid: string;
    overdue: string;
    cancelled: string;
  };
  recordPaymentDialog: {
    invoiceIdRequired: string;
    amountRequired: string;
    paymentDateRequired: string;
    paymentMethodRequired: string;
    title: string;
    description: string;
    totalAmount: string;
    amountPaid: string;
    amountDue: string;
    paymentAmount: string;
    paymentDate: string;
    paymentMethod: string;
    selectPaymentMethod: string;
    bankTransfer: string;
    check: string;
    cash: string;
    creditCard: string;
    wireTransfer: string;
    other: string;
    referenceNumber: string;
    referencePlaceholder: string;
    notes: string;
    notesPlaceholder: string;
    cancel: string;
    recording: string;
    recordPayment: string;
    recordSuccess: string;
    recordError: string;
  };
  posPage: {
    title: string;
    subtitle: string;
    searchAndAddItems: string;
    searchItems: string;
    noItemsFound: string;
    outOfStock: string;
    lowStock: string;
    stockLabel: string;
    clear: string;
    itemNumber: string;
    item: string;
    unit: string;
    price: string;
    qty: string;
    discount: string;
    total: string;
    noItemsInCart: string;
    noItemsInCartDescription: string;
    customer: string;
    walkInCustomer: string;
    billSummary: string;
    items: string;
    subtotal: string;
    vat: string;
    proceedToPayment: string;
    paymentMethod: string;
    cash: string;
    card: string;
    gcash: string;
    maya: string;
    amountReceived: string;
    change: string;
    cancel: string;
    completeSale: string;
    transactionSuccess: string;
    transactionError: string;
    outOfStockError: string;
    outOfStockDescription: string;
    insufficientStockError: string;
    insufficientStockDescription: string;
    checkoutStockError: string;
  };
  posTransactionsPage: {
    title: string;
    subtitle: string;
    totalTransactions: string;
    completed: string;
    voided: string;
    totalSales: string;
    searchPlaceholder: string;
    statusPlaceholder: string;
    allStatus: string;
    allCashiers: string;
    clearFilters: string;
    transactionNumber: string;
    dateTime: string;
    customer: string;
    cashier: string;
    items: string;
    amount: string;
    status: string;
    actions: string;
    loading: string;
    emptyFiltered: string;
    empty: string;
    walkInCustomer: string;
    itemsCount: string;
    printReceipt: string;
    voidTransaction: string;
    adminPinTitle: string;
    adminPinDescription: string;
    cancel: string;
    voidTitle: string;
    voidDescription: string;
    voidAction: string;
    voidSuccess: string;
    voidError: string;
    completedStatus: string;
    voidedStatus: string;
  };
  adminPinDialog: {
    defaultTitle: string;
    defaultDescription: string;
    pinRequired: string;
    invalidPin: string;
    verifyFailed: string;
    pinLabel: string;
    pinPlaceholder: string;
    cancel: string;
    verifying: string;
    verify: string;
  };
  receiptPanel: {
    title: string;
    print: string;
    download: string;
    generating: string;
    failed: string;
    previewTitle: string;
  };
  posTransactionDetailsDialog: {
    title: string;
    printReceipt: string;
    transactionNumber: string;
    dateTime: string;
    cashier: string;
    customer: string;
    walkInCustomer: string;
    status: string;
    items: string;
    item: string;
    quantity: string;
    unitPrice: string;
    discount: string;
    total: string;
    subtotal: string;
    tax: string;
    totalAmount: string;
    payment: string;
    amountPaid: string;
    change: string;
    notes: string;
    completed: string;
    voided: string;
    notAvailable: string;
  };
  itemsPage: {
    title: string;
    subtitle: string;
    exportCsv: string;
    createItem: string;
    totalItems: string;
    totalItemsDescription: string;
    totalAvailableValue: string;
    totalAvailableValueDescription: string;
    lowStock: string;
    lowStockDescription: string;
    outOfStock: string;
    outOfStockDescription: string;
    searchPlaceholder: string;
    categoryPlaceholder: string;
    allCategories: string;
    image: string;
    itemCode: string;
    itemName: string;
    category: string;
    uom: string;
    onHand: string;
    allocated: string;
    inTransitQty: string;
    available: string;
    normal: string;
    overstock: string;
    discontinued: string;
    unknown: string;
    errorLoadingTitle: string;
    unauthorizedMessage: string;
    loadErrorMessage: string;
    retry: string;
    empty: string;
    deleteTitle: string;
    deleteDescription: string;
    deleteDescriptionWithName: string;
    deleteSuccess: string;
    deleteError: string;
    noDataToExport: string;
    exportSuccess: string;
    editAriaLabel: string;
    deleteAriaLabel: string;
    moreActions: string;
  };
  inventoryItemPage: {
    rawMaterial: string;
    finishedGood: string;
    asset: string;
    service: string;
    loadingTitle: string;
    loadingDescription: string;
    errorLoadingTitle: string;
    itemNotFound: string;
    itemDetails: string;
    editItem: string;
    addItemDetails: string;
    createNewItem: string;
    itemDetailsDescription: string;
    editItemDescription: string;
    addItemDetailsDescription: string;
    createNewItemDescription: string;
    createPageDescription: string;
    updatePageDescription: string;
    generalTab: string;
    overviewTab: string;
    pricesTab: string;
    locationsTab: string;
    basicInformation: string;
    itemCodeLabel: string;
    itemTypeLabel: string;
    selectItemType: string;
    itemNameLabel: string;
    chineseNameLabel: string;
    descriptionLabel: string;
    itemImageLabel: string;
    classificationAndUnit: string;
    categoryLabel: string;
    selectCategory: string;
    unitOfMeasureLabel: string;
    selectUom: string;
    pricingInformation: string;
    standardCostLabel: string;
    listPriceLabel: string;
    availableQtyLabel: string;
    reservedQtyLabel: string;
    onHandLabel: string;
    inventoryManagement: string;
    reorderLevelLabel: string;
    reorderLevelDescription: string;
    reorderQtyLabel: string;
    reorderQtyDescription: string;
    itemInformationTitle: string;
    itemInformationDescription: string;
    itemInformationCreateDescription: string;
    itemInformationEditDescription: string;
    itemCodeImmutableDescription: string;
    itemCodeAutoGenerateDescription: string;
    activeStatusLabel: string;
    activeStatusDescription: string;
    editItemAction: string;
    backToItems: string;
    noCategory: string;
    uncategorized: string;
    perUnitPrefix: string;
    marginLabel: string;
    reorderQtyShortLabel: string;
    baseUomLabel: string;
    noImage: string;
    qrCodeLabel: string;
    noQrCode: string;
    pricingDetailsTitle: string;
    pricingDetailsDescription: string;
    profitMarginLabel: string;
    reorderSettingsDescription: string;
    inTransitLabel: string;
    itemImageDescription: string;
    qrCodeReadonlyDescription: string;
    noQrCodeAvailable: string;
    workflowInfo: string;
    close: string;
    cancel: string;
    edit: string;
    saving: string;
    updateItem: string;
    saveAndContinue: string;
    itemCodePlaceholder: string;
    itemNamePlaceholder: string;
    chineseNamePlaceholder: string;
    descriptionPlaceholder: string;
    standardCostPlaceholder: string;
    listPricePlaceholder: string;
    reorderLevelPlaceholder: string;
    reorderQtyPlaceholder: string;
    updateSuccess: string;
    missingCompany: string;
    createSuccess: string;
    createSuccessDescription: string;
    updateError: string;
    createError: string;
  };
  itemValidation: {
    codeRequired: string;
    codeMax: string;
    codeFormat: string;
    nameRequired: string;
    nameMax: string;
    chineseNameMax: string;
    descriptionMax: string;
    uomRequired: string;
    categoryRequired: string;
    standardCostMin: string;
    listPriceMin: string;
    reorderLevelMin: string;
    reorderQtyMin: string;
  };
  itemLocationsTab: {
    title: string;
    description: string;
    moveStock: string;
    loadError: string;
    empty: string;
    warehouse: string;
    location: string;
    type: string;
    onHand: string;
    reserved: string;
    available: string;
    inTransit: string;
    estArrival: string;
    defaultBadge: string;
    setDefault: string;
    defaultUpdated: string;
    updateDefaultError: string;
    selectWarehouseAndLocations: string;
    selectDifferentLocations: string;
    enterValidQuantity: string;
    stockMoved: string;
    moveStockError: string;
    batchCode: string;
    receivedDate: string;
    moveDialogTitle: string;
    moveDialogDescription: string;
    warehouseLabel: string;
    selectWarehouse: string;
    fromLocationLabel: string;
    selectSourceLocation: string;
    toLocationLabel: string;
    selectDestinationLocation: string;
    quantityLabel: string;
    quantityPlaceholder: string;
    unnamed: string;
    availableShort: string;
    cancel: string;
    moving: string;
  };
  itemPricesTab: {
    title: string;
    description: string;
    addPrice: string;
    deleteSuccess: string;
    deleteError: string;
    empty: string;
    emptyDescription: string;
    priceTier: string;
    tierName: string;
    price: string;
    effectiveFrom: string;
    effectiveTo: string;
    status: string;
    active: string;
    inactive: string;
    actions: string;
    deleteTitle: string;
    deleteDescription: string;
    deleteDescriptionWithName: string;
  };
  priceFormDialog: {
    editTitle: string;
    createTitle: string;
    editDescription: string;
    createDescription: string;
    priceTierCodeLabel: string;
    priceTierCodeRequired: string;
    priceTierCodePlaceholder: string;
    commonTiers: string;
    priceTierNameLabel: string;
    priceTierNameRequired: string;
    priceTierNamePlaceholder: string;
    priceLabel: string;
    priceRequired: string;
    priceMin: string;
    pricePlaceholder: string;
    currencyCodeLabel: string;
    currencyCodePlaceholder: string;
    currencyCodeDescription: string;
    effectiveFromLabel: string;
    effectiveFromRequired: string;
    effectiveToLabel: string;
    effectiveToDescription: string;
    activeLabel: string;
    cancel: string;
    updateAction: string;
    createAction: string;
    createSuccess: string;
    createError: string;
    updateSuccess: string;
    updateError: string;
    noPriceSelected: string;
  };
  stockTransactionsPage: {
    title: string;
    subtitle: string;
    newTransaction: string;
    searchPlaceholder: string;
    typePlaceholder: string;
    allTypes: string;
    stockIn: string;
    stockOut: string;
    transfer: string;
    adjustment: string;
    date: string;
    type: string;
    item: string;
    warehouse: string;
    location: string;
    quantity: string;
    reference: string;
    reason: string;
    createdBy: string;
    loadingError: string;
    emptyTitle: string;
    emptyDescription: string;
    badgeIn: string;
    badgeOut: string;
    badgeTransfer: string;
    badgeAdjustment: string;
  };
  stockTransactionForm: {
    title: string;
    description: string;
    transactionDateLabel: string;
    transactionTypeLabel: string;
    selectType: string;
    warehouseLabel: string;
    fromWarehouseLabel: string;
    toWarehouseLabel: string;
    selectWarehouse: string;
    selectDestinationWarehouse: string;
    fromLocationLabel: string;
    toLocationLabel: string;
    destinationLocationLabel: string;
    sourceLocationLabel: string;
    selectLocation: string;
    selectWarehouseFirst: string;
    selectDestinationWarehouseFirst: string;
    itemLabel: string;
    selectWarehouseFirstItem: string;
    searchItem: string;
    searchItemByCodeOrName: string;
    noItemFound: string;
    stockLabel: string;
    quantityLabel: string;
    quantityPlaceholder: string;
    referenceNumberLabel: string;
    referenceNumberPlaceholder: string;
    reasonLabel: string;
    selectReason: string;
    notesLabel: string;
    notesPlaceholder: string;
    cancel: string;
    createAction: string;
    creating: string;
    invalidItem: string;
    transferCreated: string;
    transferCreatedDescription: string;
    createSuccess: string;
    createError: string;
    reasonPurchaseReceipt: string;
    reasonProductionOutput: string;
    reasonCustomerReturn: string;
    reasonOther: string;
    reasonSalesOrder: string;
    reasonProductionConsumption: string;
    reasonDamageLoss: string;
    reasonStockRebalancing: string;
    reasonCustomerRequest: string;
    reasonWarehouseConsolidation: string;
    reasonPhysicalCountAdjustment: string;
    reasonDamagedGoods: string;
    reasonSystemCorrection: string;
  };
  stockTransactionValidation: {
    transactionDateRequired: string;
    itemRequired: string;
    warehouseRequired: string;
    quantityMin: string;
    uomRequired: string;
    reasonRequired: string;
    destinationWarehouseRequired: string;
  };
  stockTransactionDetail: {
    titleDescription: string;
    transactionInformation: string;
    transactionCode: string;
    type: string;
    status: string;
    transactionDate: string;
    reference: string;
    notes: string;
    warehouseInformation: string;
    sourceLocation: string;
    destinationLocation: string;
    location: string;
    createdBy: string;
    createdAt: string;
    transactionItems: string;
    itemCode: string;
    itemName: string;
    qtyBefore: string;
    quantity: string;
    qtyAfter: string;
    unitCost: string;
    totalCost: string;
    stockValueChanges: string;
    item: string;
    valuationRate: string;
    valueBefore: string;
    valueAfter: string;
    change: string;
    totalCostLabel: string;
    stockIn: string;
    stockOut: string;
    transfer: string;
    adjustment: string;
    statusPosted: string;
    statusDraft: string;
    statusCompleted: string;
    statusCancelled: string;
    loadError: string;
  };
  stockAdjustmentsPage: {
    title: string;
    subtitle: string;
    createAdjustment: string;
    searchPlaceholder: string;
    statusPlaceholder: string;
    typePlaceholder: string;
    allStatus: string;
    allTypes: string;
    draft: string;
    pending: string;
    approved: string;
    posted: string;
    rejected: string;
    physicalCount: string;
    damage: string;
    loss: string;
    found: string;
    qualityIssue: string;
    other: string;
    adjustmentNumber: string;
    type: string;
    date: string;
    warehouse: string;
    location: string;
    reason: string;
    totalValue: string;
    status: string;
    actions: string;
    loadingError: string;
    emptyTitle: string;
    emptyDescription: string;
    itemsCount: string;
    post: string;
    deleteTitle: string;
    deleteDescription: string;
    deleting: string;
    postTitle: string;
    postDescription: string;
    postStepCreateTransaction: string;
    postStepUpdateStock: string;
    postStepUpdateLedger: string;
    summaryLabel: string;
    postActionWarning: string;
    posting: string;
    postAction: string;
    noLocation: string;
  };
  stockAdjustmentForm: {
    editTitle: string;
    createTitle: string;
    editDescription: string;
    createDescription: string;
    generalInformation: string;
    adjustmentTypeLabel: string;
    selectType: string;
    adjustmentDateLabel: string;
    warehouseLabel: string;
    selectWarehouse: string;
    locationLabel: string;
    selectLocation: string;
    selectWarehouseFirst: string;
    reasonLabel: string;
    reasonPlaceholder: string;
    notesLabel: string;
    notesPlaceholder: string;
    lineItemsTitle: string;
    lineItemsDescription: string;
    addItem: string;
    selectWarehouseBeforeItems: string;
    noItems: string;
    noItemsDescription: string;
    item: string;
    currentQty: string;
    adjustedQty: string;
    difference: string;
    unitCost: string;
    totalValue: string;
    actions: string;
    summary: string;
    totalAdjustmentValue: string;
    cancel: string;
    saving: string;
    updateAction: string;
    createAction: string;
    lineItemRequired: string;
  };
  stockAdjustmentValidation: {
    adjustmentDateRequired: string;
    warehouseRequired: string;
    reasonRequired: string;
  };
  stockAdjustmentLineItemDialog: {
    editTitle: string;
    createTitle: string;
    editDescription: string;
    createDescription: string;
    selectItemStep: string;
    adjustmentDetailsStep: string;
    summaryStep: string;
    itemLabel: string;
    chooseItem: string;
    searchByCodeOrName: string;
    currentStockOnHand: string;
    units: string;
    typeLabel: string;
    selectType: string;
    increaseStock: string;
    decreaseStock: string;
    quantityLabel: string;
    quantityPlaceholder: string;
    unitCostLabel: string;
    summary: string;
    newStockLevel: string;
    currentStock: string;
    adjustment: string;
    newStock: string;
    valueImpact: string;
    valueImpactFormula: string;
    cancel: string;
    updateAction: string;
    createAction: string;
  };
  stockAdjustmentLineItemValidation: {
    itemRequired: string;
    uomRequired: string;
    currentQtyMin: string;
    adjustedQtyMin: string;
    unitCostMin: string;
  };
  deliveryNotesPage: Record<string, string>;
  deliveryNoteDetailPage: Record<string, string>;
  pickListsPage: Record<string, string>;
  reorderManagementPage: Record<string, string>;
  purchasingOverviewPage: Record<string, string>;
  purchasingOverviewWidgets: Record<string, string>;
  suppliersPage: Record<string, string>;
  supplierForm: Record<string, string>;
  supplierValidation: Record<string, string>;
  stockRequisitionsPage: Record<string, string>;
  stockRequisitionForm: Record<string, string>;
  stockRequisitionValidation: Record<string, string>;
  stockRequisitionDetailPage: Record<string, string>;
  purchaseOrdersPage: Record<string, string>;
  purchaseOrderForm: Record<string, string>;
  purchaseOrderLineItemDialog: Record<string, string>;
  purchaseOrderViewDialog: Record<string, string>;
  receiveGoodsDialog: Record<string, string>;
  purchaseOrderValidation: Record<string, string>;
  purchaseReceiptsPage: Record<string, string>;
  purchaseReceiptViewDialog: Record<string, string>;
  purchaseReceiptDetailPage: Record<string, string>;
  reportsPage: Record<string, string>;
  stockReportsPage: Record<string, string>;
  stockAgingReportPage: Record<string, string>;
  shipmentsReportPage: Record<string, string>;
  salesAnalyticsPage: Record<string, string>;
  analyticsFilters: Record<string, string>;
  analyticsDateRangePicker: Record<string, string>;
  analyticsOverviewTab: Record<string, string>;
  analyticsByTimeTab: Record<string, string>;
  analyticsByEmployeeTab: Record<string, string>;
  analyticsByLocationTab: Record<string, string>;
  commissionReportsPage: Record<string, string>;
  commissionSummary: Record<string, string>;
  commissionDetails: Record<string, string>;
  commissionByPeriod: Record<string, string>;
  pickingEfficiencyReportPage: Record<string, string>;
  transformationEfficiencyReportPage: Record<string, string>;
  itemLocationBatchReportPage: Record<string, string>;
  loadListsPage: Record<string, string>;
  loadListForm: Record<string, string>;
  linkStockRequisitionsDialog: Record<string, string>;
  loadListDetailPage: Record<string, string>;
  loadListValidation: Record<string, string>;
  grnsPage: Record<string, string>;
  grnDetailPage: Record<string, string>;
  grnDamagedItemsSection: Record<string, string>;
  grnBoxManagementSection: Record<string, string>;
  grnPutawayPage: Record<string, string>;
  stockRequestsPage: {
    title: string;
    subtitle: string;
    deliveryNotes: string;
    createRequest: string;
    searchPlaceholder: string;
    statusPlaceholder: string;
    priorityPlaceholder: string;
    allStatus: string;
    allPriority: string;
    draft: string;
    submitted: string;
    approved: string;
    picking: string;
    picked: string;
    dispatched: string;
    received: string;
    allocating: string;
    partiallyAllocated: string;
    allocated: string;
    partiallyFulfilled: string;
    fulfilled: string;
    completed: string;
    cancelled: string;
    low: string;
    normal: string;
    high: string;
    urgent: string;
    requestNumber: string;
    requestDate: string;
    requiredDate: string;
    requestedByWarehouse: string;
    requestedToWarehouse: string;
    priority: string;
    status: string;
    receivedDate: string;
    requestedByUser: string;
    actions: string;
    loadingError: string;
    emptyTitle: string;
    emptyDescription: string;
    edit: string;
    delete: string;
    submit: string;
    approve: string;
    reject: string;
    dispatch: string;
    receive: string;
    cancel: string;
    noActions: string;
    noWarehouse: string;
    deleteTitle: string;
    deleteDescription: string;
    deleting: string;
    actionRequestLabel: string;
    reasonPlaceholder: string;
    processing: string;
    submitTitle: string;
    submitDescription: string;
    approveTitle: string;
    approveDescription: string;
    rejectTitle: string;
    rejectDescription: string;
    dispatchTitle: string;
    dispatchDescription: string;
    completeTitle: string;
    completeDescription: string;
    cancelTitle: string;
    cancelDescription: string;
  };
  stockRequestForm: {
    editTitle: string;
    createTitle: string;
    editDescription: string;
    createDescription: string;
    requestDateLabel: string;
    requiredDateLabel: string;
    priorityLabel: string;
    selectPriority: string;
    requestedByLabel: string;
    selectRequestedBy: string;
    autoAssignedWarehouseUnavailable: string;
    requestedToLabel: string;
    selectRequestedTo: string;
    purposeLabel: string;
    purposePlaceholder: string;
    notesLabel: string;
    notesPlaceholder: string;
    lineItemsTitle: string;
    lineItemsDescription: string;
    addItem: string;
    noItems: string;
    noItemsDescription: string;
    item: string;
    qty: string;
    unit: string;
    notes: string;
    actions: string;
    cancel: string;
    saving: string;
    updateAction: string;
    createAction: string;
    lineItemRequired: string;
    noValue: string;
  };
  stockRequestValidation: {
    requestDateRequired: string;
    requiredDateRequired: string;
    requestedByRequired: string;
    requestedToRequired: string;
    requestingAndFulfillingMustDiffer: string;
  };
  stockRequestLineItemDialog: {
    editTitle: string;
    createTitle: string;
    editDescription: string;
    createDescription: string;
    itemLabel: string;
    selectItem: string;
    searchItem: string;
    loadingItems: string;
    noItemFound: string;
    onHand: string;
    available: string;
    requestedQuantityLabel: string;
    requestedQuantityPlaceholder: string;
    notesLabel: string;
    notesPlaceholder: string;
    quantityToRequest: string;
    cancel: string;
    updateAction: string;
    addAction: string;
  };
  stockRequestLineItemValidation: {
    itemRequired: string;
    uomRequired: string;
    requestedQtyMin: string;
  };
  receiveStockRequestDialog: {
    title: string;
    description: string;
    from: string;
    to: string;
    requiredDate: string;
    status: string;
    receivedDateLabel: string;
    itemsToReceive: string;
    item: string;
    requested: string;
    dispatched: string;
    received: string;
    receiveNow: string;
    location: string;
    selectLocation: string;
    selectWarehouseFirst: string;
    notesLabel: string;
    notesPlaceholder: string;
    cancel: string;
    receiving: string;
    receiveAction: string;
    noWarehouse: string;
    receiveQtyRequired: string;
    receiveSuccess: string;
    receiveError: string;
  };
  receiveStockRequestValidation: {
    receivedDateRequired: string;
    receivedQtyMin: string;
  };
  stockRequestViewDialog: {
    title: string;
    requestNumber: string;
    requestedByWarehouse: string;
    requestedToWarehouse: string;
    requestedByUser: string;
    requestDate: string;
    requiredDate: string;
    receivedDate: string;
    receivedBy: string;
    priority: string;
    purpose: string;
    notes: string;
    lineItems: string;
    item: string;
    quantity: string;
    deliveredQty: string;
    unit: string;
    noItems: string;
    fulfillmentSummary: string;
    totalRequested: string;
    totalDelivered: string;
    remainingQty: string;
    fulfillingDeliveryNotes: string;
    noLinkedDeliveryNotes: string;
    noValue: string;
  };
};

export const translations: Record<Locale, TranslationKeys> = {
  en: {
    common: {
      loading: "Loading...",
      error: "An error occurred",
      success: "Success",
      confirm: "Confirm",
      yes: "Yes",
      no: "No",
      save: "Save",
      cancel: "Cancel",
      delete: "Delete",
      edit: "Edit",
      create: "Create",
      search: "Search",
      filter: "Filter",
      export: "Export",
      import: "Import",
      actions: "Actions",
      status: "Status",
      name: "Name",
      code: "Code",
      description: "Description",
      notes: "Notes",
      date: "Date",
      quantity: "Quantity",
      price: "Price",
      total: "Total",
      submit: "Submit",
      close: "Close",
      add: "Add",
      item: "Item",
      items: "Items",
      warehouse: "Warehouse",
      select: "Select",
      search_: "Search...",
      view: "View",
      allStatuses: "All Statuses",
      draft: "Draft",
      preparing: "Preparing",
      completed: "Completed",
      cancelled: "Cancelled",
      active: "Active",
      inactive: "Inactive",
      usageCount: "Usage Count",
      locked: "(locked)",
    },
    forms: {
      required: "This field is required",
      invalid: "Invalid value",
      saveSuccess: "Saved successfully",
      saveError: "Failed to save",
      deleteConfirm: "Are you sure you want to delete this?",
      deleteSuccess: "Deleted successfully",
      deleteError: "Failed to delete",
      noResults: "No results found",
      selectItem: "Select an item...",
      noDataFound: "No data found",
    },
    transformation: {
      transformations: "Transformations",
      transformation: "Transformation",
      template: "Template",
      templates: "Templates",
      order: "Order",
      orders: "Orders",
      newTransformation: "New Transformation",
      newTemplate: "New Template",
      transformationOrder: "Transformation Order",
      transformationTemplate: "Transformation Template",
      inputMaterials: "Input Materials",
      outputProducts: "Output Products",
      totalInputCost: "Total Input Cost",
      totalOutputCost: "Total Output Cost",
      costVariance: "Cost Variance",
      orderDate: "Order Date",
      plannedQuantity: "Planned Quantity",
      actualQuantity: "Actual Quantity",
      planned: "Planned",
      consumed: "Consumed",
      produced: "Produced",
      unitCost: "Unit Cost",
      totalCost: "Total Cost",
      scrap: "Scrap",
      prepare: "Prepare",
      complete: "Complete",
      cancelOrder: "Cancel Order",
      prepareOrder: "Prepare Order?",
      completeOrder: "Complete Order?",
      preparing: "Preparing",
      orderPrepared: "Order prepared successfully",
      orderCompleted: "Order completed successfully",
      orderCancelled: "Order cancelled successfully",
      notFound: "not found",
      prepareConfirmation: "This will prepare the order and make it ready for completion.",
      completeConfirmation:
        "This will complete the transformation, consuming input materials and producing output products.",
      cancelConfirmation: "This will cancel the order. This action cannot be undone.",
      manageTemplates: "Manage Templates",
      manageMaterialTransformations: "Manage material and product transformations",
      orderCode: "Order Code",
      searchOrdersPlaceholder: "Search by order code or notes...",
      noOrdersFound: "No transformation orders found",
      createNewOrder: "Create a new transformation order from a template",
      orderDetails: "Order Details",
      selectTemplate: "Select a template",
      selectWarehouse: "Select warehouse",
      plannedExecutionDate: "Planned Execution Date",
      pickDate: "Pick a date",
      createFromTemplate: "Create from Template",
      executeTransformation: "Execute Transformation",
      actualConsumed: "Actual Consumed",
      actualProduced: "Actual Produced",
      enterActualQuantities: "Enter actual quantities for inputs consumed and outputs produced",
      difference: "Difference",
      exceedsPlanned: "Cannot exceed planned quantity",
      wastedQuantity: "Wasted Quantity",
      wasteReason: "Waste Reason",
      enterWasteDetails: "Enter waste details if applicable",
      optional: "Optional",
      tryAdjustingSearchOrStatus: "Try adjusting your search or status filter.",
      notAvailable: "N/A",
      dash: "-",
      templateRequired: "Template is required",
      noTemplatesTitle: "No transformation templates yet",
      noTemplatesDescription:
        "Create a template to define input materials and output products for future transformation orders.",
      warehouseRequired: "Warehouse is required",
      orderDateRequired: "Order date is required",
      plannedQuantityGreaterThanZero: "Planned quantity must be greater than 0",
      companyIdMissing: "Company ID is missing. Please try logging in again.",
      failedCreateTransformationOrder: "Failed to create transformation order",
      failedExecuteTransformation: "Failed to execute transformation",
      failedOrderAction: "Failed to process order action",
      noReasonProvided: "No reason provided",
      totalExceedsPlanned: "Total exceeds planned",
      totalLessThanPlanned: "Total less than planned",
      wasteReasonRequired: "Waste reason is required",
      totalAccounted: "Total Accounted",
    },
    pagination: {
      rowsPerPage: "Rows per page",
      pageOf: "Page {currentPage} of {totalPages}",
      showing: "Showing {startItem} to {endItem} of {totalItems} items",
      goToFirstPage: "Go to first page",
      goToPreviousPage: "Go to previous page",
      goToNextPage: "Go to next page",
      goToLastPage: "Go to last page",
    },
    navigation: {
      Home: "Home",
      Dashboard: "Dashboard",
      Inventory: "Inventory",
      "Item Master": "Item Master",
      "Create Item": "Create Item",
      "Edit Item": "Edit Item",
      Warehouse: "Warehouse",
      Location: "Location",
      Warehouses: "Warehouses",
      "Stock Transactions": "Stock Transactions",
      "Stock Adjustments": "Stock Adjustments",
      "Stock Requests": "Stock Requests",
      "Delivery Notes": "Delivery Notes",
      "Pick Lists": "Pick Lists",
      "Stock Transformations": "Stock Transformations",
      "Reorder Management": "Reorder Management",
      Purchasing: "Purchasing",
      Overview: "Overview",
      Suppliers: "Suppliers",
      "Stock Requisitions": "Stock Requisitions",
      "Load Lists": "Load Lists",
      "Goods Receipt Notes": "Goods Receipt Notes",
      Reports: "Reports",
      "Reports Directory": "Reports Directory",
      "Stock Reports": "Stock Reports",
      Admin: "Admin",
      Users: "Users",
      Roles: "Roles",
      "Company Settings": "Company Settings",
      "Business Units": "Business Units",
      dashboard: "Dashboard",
      inventory: "Inventory",
      items: "Item Master",
      warehouses: "Warehouses",
      stock: "Stock Transactions",
      adjustments: "Stock Adjustments",
      "stock-requests": "Stock Requests",
      "delivery-notes": "Delivery Notes",
      "pick-lists": "Pick Lists",
      transformations: "Stock Transformations",
      templates: "Templates",
      reorder: "Reorder Management",
      purchasing: "Purchasing",
      overview: "Overview",
      suppliers: "Suppliers",
      "stock-requisitions": "Stock Requisitions",
      "load-lists": "Load Lists",
      grns: "Goods Receipt Notes",
      reports: "Reports",
      admin: "Admin",
      users: "Users",
      roles: "Roles",
      settings: "Company Settings",
      "business-units": "Business Units",
      "Delivery Note": "Delivery Note",
      "Delivery Note Details": "Delivery Note Details",
      "Stock Requisition Details": "Stock Requisition Details",
      "Load List Details": "Load List Details",
      "GRN Details": "GRN Details",
    },
    warehousesPage: {
      title: "Warehouse Management",
      subtitle: "Manage warehouse locations and storage facilities",
      createWarehouse: "Create Warehouse",
      searchPlaceholder: "Search warehouses...",
      statusPlaceholder: "Status",
      allStatus: "All Status",
      loadingError: "Error loading warehouses. Please try again.",
      empty: "No warehouses found",
      location: "Location",
      manager: "Manager",
      contact: "Contact",
      locations: "Locations",
      deleteTitle: "Delete Warehouse",
      deleteDescription: "Are you sure you want to delete this warehouse?",
      deleteDescriptionWithName:
        "Are you sure you want to delete \"{name}\"? This action cannot be undone.",
      deleteSuccess: "Warehouse deleted successfully",
      deleteError: "Failed to delete warehouse",
    },
    warehouseForm: {
      createTitle: "Create New Warehouse",
      editTitle: "Edit Warehouse",
      createDescription: "Fill in the warehouse details below to create a new warehouse",
      editDescription: "Update the warehouse information below",
      codeLabel: "Warehouse Code *",
      nameLabel: "Warehouse Name *",
      descriptionLabel: "Description",
      locationInformation: "Location Information",
      contactInformation: "Contact Information",
      addressLabel: "Address",
      cityLabel: "City",
      stateLabel: "State/Province",
      postalCodeLabel: "Postal Code",
      countryLabel: "Country",
      phoneLabel: "Phone",
      emailLabel: "Email",
      activeStatusLabel: "Active Status",
      activeStatusDescription: "Set whether this warehouse is active and available for use",
      codePlaceholder: "WH-001",
      namePlaceholder: "Enter warehouse name",
      descriptionPlaceholder: "Enter description",
      addressPlaceholder: "Street address",
      cityPlaceholder: "City",
      statePlaceholder: "State or Province",
      postalCodePlaceholder: "Postal code",
      countryPlaceholder: "Country",
      phonePlaceholder: "+1 234 567 8900",
      emailPlaceholder: "warehouse@example.com",
      saving: "Saving...",
      createAction: "Create Warehouse",
      updateAction: "Update Warehouse",
      createSuccess: "Warehouse created successfully",
      updateSuccess: "Warehouse updated successfully",
      createError: "Failed to create warehouse",
      updateError: "Failed to update warehouse",
      missingCompany: "User company information not available",
    },
    warehouseValidation: {
      codeRequired: "Warehouse code is required",
      codeMax: "Warehouse code must be less than 50 characters",
      codeFormat: "Warehouse code must contain only uppercase letters, numbers, and hyphens",
      nameRequired: "Warehouse name is required",
      nameMax: "Warehouse name must be less than 200 characters",
      descriptionMax: "Description must be less than 1000 characters",
      addressMax: "Address must be less than 500 characters",
      cityMax: "City must be less than 100 characters",
      stateMax: "State must be less than 100 characters",
      postalCodeMax: "Postal code must be less than 20 characters",
      countryMax: "Country must be less than 100 characters",
      phoneMax: "Phone must be less than 50 characters",
      emailInvalid: "Invalid email address",
      emailMax: "Email must be less than 255 characters",
    },
    dashboardPage: {
      goodMorning: "Good morning",
      goodNoon: "Good noon",
      goodAfternoon: "Good afternoon",
      goodEvening: "Good evening",
      fallbackUser: "User",
      subtitle: "Here's what's happening in your warehouse today",
      loadError: "Failed to load dashboard data. Please try again.",
      retry: "Retry",
      incomingShipments: "Incoming Shipments",
      inTransit: "In Transit",
      stockRequests: "Stock Requests",
      pending: "Pending",
      pickList: "Pick List",
      toPick: "To Pick",
    },
    warehouseDashboard: {
      lowStocks: "Low Stocks",
      outOfStocks: "Out of Stocks",
      noLowStockItems: "No low stock items",
      noOutOfStockItems: "No out of stock items",
      locationLabel: "Location",
      reorderLabel: "Reorder",
      lastLabel: "Last",
      viewAllInventory: "View all inventory",
      operationalQueue: "Operational Queue",
      pickListTab: "Pick List ({count})",
      incomingTab: "Incoming ({count})",
      requestsTab: "Requests ({count})",
      noItemsToPick: "No items to pick",
      noIncomingDeliveries: "No incoming deliveries",
      noPendingRequests: "No pending requests",
      itemsCount: "{count} items",
      dueLabel: "Due",
      byLabel: "By",
      etaLabel: "ETA",
      requiredLabel: "Required",
      status_draft: "Draft",
      status_submitted: "Submitted",
      status_approved: "Approved",
      status_picking: "Picking",
      status_picked: "Picked",
      status_delivered: "Dispatched",
      status_completed: "Completed",
      status_cancelled: "Cancelled",
      status_in_transit: "In Transit",
      status_partially_received: "Partially Received",
      priority_low: "Low",
      priority_normal: "Normal",
      priority_high: "High",
      priority_urgent: "Urgent",
      lastStockMovements: "Last 5 Stock Movements",
      noRecentStockMovements: "No recent stock movements",
      justNow: "Just now",
      minutesAgo: "{count}m ago",
      hoursAgo: "{count}h ago",
      byUser: "by {user}",
    },
    notificationsPage: {
      title: "Notifications",
      subtitle: "Stay updated on important events.",
      filter: "Filter",
      all: "All",
      unread: "Unread",
      empty: "No notifications found.",
      emptyMenu: "No notifications yet.",
      new: "New",
      markAsRead: "Mark as read",
      viewAll: "View all",
    },
    userMenu: {
      myProfile: "My Profile",
      myPreferences: "My Preferences",
      changePassword: "Change Password",
      logOut: "Log out",
    },
    preferencesPage: {
      title: "My Preferences",
      subtitle: "Customize your application preferences and display settings",
      displayTitle: "Display",
      displayDescription: "Customize how the application looks and feels",
    },
    fontSizeSettings: {
      title: "Font Size",
      description: "Adjust the text size throughout the application",
      size_small: "Small",
      size_medium: "Medium",
      size_large: "Large",
      size_extraLarge: "Extra Large",
      preview: "Preview: This is how text will appear at the selected size.",
    },
    accessDeniedPage: {
      title: "Access Denied",
      resourceNeedAll: "You need permission to access all of the following resources: {resources}",
      resourceNeedOne: "You need permission to access at least one of the following resources: {resources}",
      resourceNeedView: "You need view permission for {resource}",
      noPermission: "You do not have permission to access this resource",
      supportMessage: "If you believe this is an error, please contact your system administrator to request access.",
      goBack: "Go Back",
      goHome: "Go to Home",
      logout: "Logout",
      loading: "Loading...",
      errorCode: "Error Code: 403 - Forbidden",
    },
    chartOfAccountsPage: {
      title: "Chart of Accounts",
      subtitle: "Manage your general ledger accounts",
      newAccount: "New Account",
      searchPlaceholder: "Search by account number or name...",
      accountType: "Account Type",
      allTypes: "All Types",
      allStatus: "All Status",
      totalAccounts: "Total Accounts",
      assets: "Assets",
      liabilities: "Liabilities",
      revenue: "Revenue",
      accountNumber: "Account Number",
      accountName: "Account Name",
      type: "Type",
      level: "Level",
      system: "System",
      systemAccount: "System",
      loading: "Loading accounts...",
      empty: "No accounts found",
      unknown: "Unknown",
      viewActions: "Actions",
      active: "Active",
      inactive: "Inactive",
      asset: "Asset",
      liability: "Liability",
      equity: "Equity",
      expense: "Expense",
      cogs: "COGS",
    },
    journalsPage: {
      title: "Journal Entries",
      subtitle: "View and manage general ledger journal entries",
      newJournalEntry: "New Journal Entry",
      searchPlaceholder: "Search by journal code, description, or reference...",
      source: "Source",
      allSources: "All Sources",
      totalEntries: "Total Entries",
      posted: "Posted",
      draft: "Draft",
      totalDebits: "Total Debits",
      journalCode: "Journal Code",
      date: "Date",
      reference: "Reference",
      debit: "Debit",
      credit: "Credit",
      loading: "Loading journals...",
      empty: "No journal entries found",
      viewJournalEntry: "View journal entry",
      printJournalEntry: "Print journal entry",
      ar: "AR",
      ap: "AP",
      inventory: "Inventory",
      manual: "Manual",
    },
    journalEntryFormDialog: {
      loadAccountsError: "Failed to load accounts",
      minLinesError: "Journal entry must have at least 2 lines",
      unbalancedError: "Journal entry is not balanced",
      unbalancedDescription: "Debits: {debits}, Credits: {credits}",
      accountRequiredError: "All lines must have an account selected",
      debitCreditRequiredError: "Journal entry must have both debits and credits",
      createError: "Failed to create journal entry",
      createSuccess: "Journal entry created successfully",
      createSuccessDescription: "Journal Code: {journalCode}",
      title: "New Manual Journal Entry",
      description: "Create a manual journal entry with debit and credit lines",
      postingDate: "Posting Date",
      referenceCode: "Reference Code",
      referencePlaceholder: "e.g., REF-001",
      descriptionLabel: "Description",
      descriptionPlaceholder: "Enter description",
      journalLines: "Journal Lines",
      addLine: "Add Line",
      account: "Account",
      selectAccount: "Select account",
      lineDescriptionPlaceholder: "Line description",
      debit: "Debit",
      credit: "Credit",
      totals: "Totals",
      totalDebit: "Total Debit",
      totalCredit: "Total Credit",
      difference: "Difference",
      balanced: "Balanced",
      notBalanced: "Not Balanced",
      creating: "Creating...",
      createAction: "Create Journal Entry",
    },
    journalEntryViewDialog: {
      postError: "Failed to post journal entry",
      postSuccess: "Journal entry posted successfully",
      postSuccessDescription: "{journalCode} has been posted to the General Ledger",
      title: "Journal Entry: {journalCode}",
      noDescription: "No description",
      postingDate: "Posting Date",
      sourceModule: "Source Module",
      referenceCode: "Reference Code",
      postedAt: "Posted At",
      journalLines: "Journal Lines",
      lineNumber: "Line #",
      account: "Account",
      descriptionLabel: "Description",
      debit: "Debit",
      credit: "Credit",
      totals: "Totals:",
      balanced: "Balanced",
      outOfBalance: "Out of Balance",
      difference: "Difference: {amount}",
      createdAt: "Created At",
      lastUpdated: "Last Updated",
      posting: "Posting...",
      postToGl: "Post to GL",
    },
    generalLedgerPage: {
      title: "General Ledger",
      subtitle: "View detailed account transactions",
      export: "Export",
      print: "Print",
      account: "Account",
      selectAccount: "Select account...",
      fromDate: "From Date",
      toDate: "To Date",
      loading: "Loading...",
      viewLedger: "View Ledger",
      openingBalance: "Opening Balance",
      closingBalance: "Closing Balance",
      totalDebits: "Total Debits",
      totalCredits: "Total Credits",
      netChange: "Net Change",
      date: "Date",
      journalCode: "Journal Code",
      descriptionLabel: "Description",
      source: "Source",
      reference: "Reference",
      debit: "Debit",
      credit: "Credit",
      balance: "Balance",
      noTransactions: "No transactions found for the selected period",
      notAvailable: "-",
    },
    trialBalancePage: {
      title: "Trial Balance",
      subtitle: "Verify that debits equal credits",
      export: "Export",
      print: "Print",
      asOfDate: "As of Date",
      loading: "Loading...",
      generateReport: "Generate Report",
      asOf: "As of",
      balanced: "Balanced",
      notBalanced: "Not Balanced",
      totalDebits: "Total Debits",
      totalCredits: "Total Credits",
      difference: "Difference",
      accountNumber: "Account Number",
      accountName: "Account Name",
      type: "Type",
      debit: "Debit",
      credit: "Credit",
      noActivity: "No account activity found for the selected period",
      total: "Total",
      notAvailable: "-",
    },
    adminUsersPage: {
      title: "User Management",
      subtitle: "Manage users and assign roles",
      searchPlaceholder: "Search users by email, username, or name...",
      all: "All",
      active: "Active",
      inactive: "Inactive",
      user: "User",
      username: "Username",
      created: "Created",
      loadError: "Error loading users. Please try again.",
      emptyTitle: "No users found",
      emptyDescription: "Try adjusting your search or filters.",
      manageRoles: "Manage Roles",
      viewPermissions: "View Permissions",
      deactivate: "Deactivate",
      activate: "Activate",
      statusUpdatedActive: "User {email} activated",
      statusUpdatedInactive: "User {email} deactivated",
      statusUpdateError: "Failed to update user status",
    },
    adminUserRolesDialog: {
      title: "Manage Roles - {name}",
      description: "Assign or remove roles for this user across different business units",
      currentRoles: "Current Roles",
      noRoles: "No roles assigned yet",
      unknownBusinessUnit: "Unknown Business Unit",
      assignNewRole: "Assign New Role",
      role: "Role",
      businessUnit: "Business Unit",
      selectRole: "Select role",
      selectBusinessUnit: "Select business unit",
      system: "System",
      assignRole: "Assign Role",
      assigning: "Assigning...",
      selectRoleAndBusinessUnit: "Please select both a role and business unit",
      roleAssignedSuccess: "Role assigned successfully",
      roleAssignedError: "Failed to assign role",
      roleRemovedSuccess: "Role removed successfully",
      roleRemovedError: "Failed to remove role",
    },
    adminUserPermissionsDialog: {
      title: "Effective Permissions - {name}",
      description: "Aggregated permissions from all roles assigned to this user",
      activePermissions: "{count} active permissions",
      searchPlaceholder: "Search permissions by resource...",
      noSearchResults: "No permissions match your search \"{query}\"",
      noPermissions: "This user has no permissions assigned.",
      resource: "Resource",
      showingSummary: "Showing {filtered} of {total} permissions",
    },
    adminRolesPage: {
      title: "Role Management",
      subtitle: "Manage roles and their permissions",
      createRole: "Create Role",
      searchPlaceholder: "Search roles by name or description...",
      role: "Role",
      type: "Type",
      created: "Created",
      loadError: "Error loading roles. Please try again.",
      emptyTitle: "No roles found",
      emptyDescription: "Try adjusting your search terms.",
      noDescription: "No description",
      system: "System",
      custom: "Custom",
      permissions: "Permissions",
      cannotDeleteSystemRoles: "Cannot delete system roles",
      roleDeletedSuccess: "Role \"{name}\" deleted successfully",
      roleDeletedError: "Failed to delete role",
      deleteTitle: "Are you sure?",
      deleteDescription:
        "This will permanently delete the role \"{name}\". This action cannot be undone.",
      deleting: "Deleting...",
    },
    adminRolePermissionsDialog: {
      title: "Manage Permissions - {name}",
      description:
        "Select permissions and customize which actions this role can perform for each resource.",
      systemRole: "System Role",
      searchPlaceholder: "Search permissions by resource or description...",
      noSearchResults: "No permissions match your search \"{query}\"",
      noPermissionsInSystem: "No permissions found in the system.",
      available: "Available:",
      assignedSummary: "{assigned} of {total} permissions assigned",
      shownSummary: "({count} shown)",
      saving: "Saving...",
      saveChanges: "Save Changes",
      permissionsUpdatedSuccess: "Permissions updated successfully",
      permissionsUpdatedError: "Failed to update permissions",
    },
    adminCreateRoleDialog: {
      title: "Create New Role",
      description: "Create a new role with optional permissions copied from an existing role",
      roleName: "Role Name",
      roleNamePlaceholder: "e.g., Warehouse Manager",
      descriptionLabel: "Description",
      descriptionPlaceholder: "Describe the role's purpose and responsibilities",
      copyPermissionsFrom: "Copy Permissions From (Optional)",
      selectRolePlaceholder: "Select a role to copy permissions from",
      system: "(System)",
      copySummary: "Will copy {count} permissions from \"{name}\"",
      creating: "Creating...",
      createRole: "Create Role",
      roleNameRequired: "Role name is required",
      roleCreatedSuccess: "Role \"{name}\" created successfully",
      roleCreatedWithCopySuccess:
        "Role \"{name}\" created with permissions copied from \"{source}\"",
      roleCreateError: "Failed to create role",
    },
    adminEditRoleDialog: {
      title: "Edit Role",
      description: "Update the role name and description",
      roleName: "Role Name",
      roleNamePlaceholder: "e.g., Warehouse Manager",
      descriptionLabel: "Description",
      descriptionPlaceholder: "Describe the role's purpose and responsibilities",
      updating: "Updating...",
      updateRole: "Update Role",
      roleNameRequired: "Role name is required",
      roleUpdatedSuccess: "Role \"{name}\" updated successfully",
      roleUpdateError: "Failed to update role",
    },
    salesPage: {
      title: "Sales Management",
      subtitle: "Manage customers, orders, quotations, and invoices",
      totalCustomers: "Total Customers",
      totalCustomersDescription: "Active customer accounts",
      totalRevenue: "Total Revenue",
      totalRevenueDescription: "This month",
      outstandingCredit: "Outstanding Credit",
      outstandingCreditDescription: "Customer balances",
      pendingOrders: "Pending Orders",
      pendingOrdersDescription: "Awaiting fulfillment",
      quickAccess: "Quick Access",
      pointOfSale: "Point of Sale",
      pointOfSaleDescription: "Quick checkout for walk-in customers",
      customers: "Customers",
      customersDescription: "Manage customer accounts",
      quotations: "Quotations",
      quotationsDescription: "Create and manage quotations",
      salesOrders: "Sales Orders",
      salesOrdersDescription: "Process sales orders",
      invoices: "Invoices",
      invoicesDescription: "Generate and track invoices",
      goTo: "Go to",
    },
    customersPage: {
      title: "Customer Master",
      subtitle: "Manage your customer accounts",
      createCustomer: "Create Customer",
      searchPlaceholder: "Search customers...",
      typePlaceholder: "Type",
      allTypes: "All Types",
      customer: "Customer",
      contact: "Contact",
      location: "Location",
      creditLimit: "Credit Limit",
      balance: "Balance",
      typeCompany: "Company",
      typeGovernment: "Government",
      typeIndividual: "Individual",
      loadError: "Error loading customers. Please try again.",
      empty: "No customers found. Create your first customer to get started.",
      deleteTitle: "Delete Customer",
      deleteDescription: "Are you sure you want to delete this customer?",
      deleteDescriptionWithName:
        "Are you sure you want to delete \"{name}\"? This action cannot be undone.",
      deleteSuccess: "Customer deleted successfully",
      deleteError: "Failed to delete customer",
    },
    customerForm: {
      editTitle: "Edit Customer",
      createTitle: "Create New Customer",
      editDescription: "Update the customer information below",
      createDescription: "Fill in the customer details below to create a new customer",
      generalTab: "General",
      billingTab: "Billing",
      shippingTab: "Shipping",
      paymentTab: "Payment",
      customerCode: "Customer Code",
      customerCodePlaceholder: "CUST-001",
      customerType: "Customer Type",
      selectType: "Select type",
      typeIndividual: "Individual",
      typeCompany: "Company",
      typeGovernment: "Government",
      customerName: "Customer Name",
      customerNamePlaceholder: "Enter customer name",
      email: "Email",
      emailPlaceholder: "customer@email.com",
      phone: "Phone",
      phonePlaceholder: "+1-555-0000",
      mobile: "Mobile",
      mobilePlaceholder: "+1-555-0001",
      website: "Website",
      websitePlaceholder: "www.customer.com",
      taxId: "Tax ID",
      taxIdPlaceholder: "TAX-12345678",
      contactPersonOptional: "Contact Person (Optional)",
      name: "Name",
      contactNamePlaceholder: "John Doe",
      contactEmailPlaceholder: "john@email.com",
      contactPhonePlaceholder: "+1-555-0002",
      address: "Address",
      addressPlaceholder: "Street address",
      city: "City",
      cityPlaceholder: "City",
      state: "State",
      statePlaceholder: "State",
      postalCode: "Postal Code",
      postalCodePlaceholder: "Postal code",
      country: "Country",
      selectCountry: "Select country",
      sameAsBilling: "Same as billing address",
      paymentTerms: "Payment Terms",
      selectPaymentTerms: "Select payment terms",
      paymentCash: "Cash",
      paymentDueOnReceipt: "Due on Receipt",
      paymentNet30: "Net 30",
      paymentNet60: "Net 60",
      paymentNet90: "Net 90",
      paymentCod: "Cash on Delivery",
      creditLimit: "Credit Limit",
      creditLimitPlaceholder: "0.00",
      notes: "Notes",
      notesPlaceholder: "Additional notes",
      activeCustomer: "Active Customer",
      missingCompany: "User company information not available",
      createSuccess: "Customer created successfully",
      updateSuccess: "Customer updated successfully",
      createError: "Failed to create customer",
      updateError: "Failed to update customer",
      saving: "Saving...",
      updateCustomer: "Update Customer",
      createCustomer: "Create Customer",
    },
    customerValidation: {
      customerCodeRequired: "Customer code is required",
      customerCodeFormat:
        "Code must contain only uppercase letters, numbers, and hyphens",
      customerNameRequired: "Customer name is required",
      invalidEmail: "Invalid email address",
      phoneRequired: "Phone is required",
      billingAddressRequired: "Billing address is required",
      billingCityRequired: "Billing city is required",
      billingStateRequired: "Billing state is required",
      billingPostalCodeRequired: "Billing postal code is required",
      billingCountryRequired: "Billing country is required",
      shippingAddressRequired: "Shipping address is required",
      shippingCityRequired: "Shipping city is required",
      shippingStateRequired: "Shipping state is required",
      shippingPostalCodeRequired: "Shipping postal code is required",
      shippingCountryRequired: "Shipping country is required",
      creditLimitMin: "Credit limit must be 0 or greater",
    },
    employeesPage: {
      title: "Sales Employees",
      subtitle: "Manage sales agents, territories, and commission rates",
      addEmployee: "Add Employee",
      totalEmployees: "Total Employees",
      activeEmployees: "{count} active",
      avgCommissionRate: "Avg Commission Rate",
      avgCommissionRateDescription: "Across all employees",
      territoriesCovered: "Territories Covered",
      territoriesCoveredDescription: "Unique locations",
      employees: "Employees",
      employeesDescription: "View and manage sales employees",
      searchPlaceholder: "Search by name, code, or email...",
      firstName: "First Name",
      lastName: "Last Name",
      role: "Role",
      commissionRate: "Commission Rate",
      territories: "Territories",
      noEmployeesFound: "No employees found",
      noTerritories: "No territories",
      moreCount: "+{count} more",
      manageTerritories: "Territories",
      showingEmployees: "Showing {from} to {to} of {total} employees",
      previous: "Previous",
      next: "Next",
      pageOf: "Page {page} of {totalPages}",
      salesAgent: "Sales Agent",
      salesManager: "Sales Manager",
      territoryManager: "Territory Manager",
    },
    employeeForm: {
      createTitle: "Add New Employee",
      editTitle: "Edit Employee",
      createDescription: "Create a new sales employee account",
      editDescription: "Update employee information",
      employeeCode: "Employee Code",
      employeeCodePlaceholder: "EMP-001",
      role: "Role",
      selectRole: "Select role",
      firstName: "First Name",
      firstNamePlaceholder: "John",
      lastName: "Last Name",
      lastNamePlaceholder: "Doe",
      email: "Email",
      emailPlaceholder: "john@example.com",
      phone: "Phone",
      phonePlaceholder: "+63 912 345 6789",
      commissionRate: "Commission Rate (%)",
      commissionRatePlaceholder: "5.00",
      commissionRateDescription:
        "Percentage of sales this employee will earn as commission",
      activeStatus: "Active Status",
      activeStatusDescription: "Inactive employees cannot be assigned to new invoices",
      creatingSuccess: "Employee created successfully",
      updatingSuccess: "Employee updated successfully",
      saveError: "Failed to save employee",
      createAction: "Create Employee",
      saveChanges: "Save Changes",
      creating: "Creating...",
      employeeCodeRequired: "Employee code is required",
      firstNameRequired: "First name is required",
      lastNameRequired: "Last name is required",
      invalidEmail: "Invalid email address",
      commissionRateRange: "Commission rate must be between 0 and 100",
    },
    territoryManagementDialog: {
      title: "Manage Territories",
      description: "Assign territories to {name} ({code})",
      assignedTerritories: "Assigned Territories",
      addTerritory: "Add Territory",
      noTerritories: "No territories assigned yet",
      noTerritoriesDescription: "Click \"Add Territory\" to assign one",
      primary: "Primary",
      removePrimary: "Remove Primary",
      setAsPrimary: "Set as Primary",
      city: "City",
      selectCity: "Select city",
      regionState: "Region/State",
      selectRegion: "Select region",
      primaryTerritory: "Primary Territory",
      primaryTerritoryDescription: "Primary territory is used for auto-assignment",
      territoryAssignedSuccess: "Territory assigned successfully",
      territoryAssignError: "Failed to add territory",
      territoryRemovedSuccess: "Territory removed successfully",
      territoryRemoveError: "Failed to remove territory",
      territoryPrimaryAdded: "Territory set as primary",
      territoryPrimaryRemoved: "Territory removed from primary",
      territoryPrimaryError: "Failed to update territory",
      cityRequired: "City is required",
      regionStateRequired: "Region/State is required",
    },
    salesOrdersPage: {
      title: "Sales Orders",
      subtitle: "Process and manage customer orders",
      createOrder: "Create Order",
      searchPlaceholder: "Search orders...",
      orderNumber: "Order #",
      customer: "Customer",
      orderDate: "Order Date",
      expectedDelivery: "Expected Delivery",
      amount: "Amount",
      loadError: "Error loading sales orders. Please try again.",
      empty: "No sales orders found. Create your first order to get started.",
      fromQuotation: "From {number}",
      overdue: "Overdue",
      itemsCount: "{count} items",
      confirm: "Confirm",
      invoice: "Invoice",
      selectWarehouseTitle: "Select Warehouse",
      selectWarehouseDescription:
        "Choose the warehouse from which stock will be deducted for this invoice.",
      selectWarehouse: "Select a warehouse",
      selectLocationOptional: "Select a location (optional)",
      selectWarehouseFirst: "Select warehouse first",
      converting: "Converting...",
      createInvoice: "Create Invoice",
      draft: "Draft",
      confirmed: "Confirmed",
      inProgress: "In Progress",
      shipped: "Shipped",
      delivered: "Delivered",
      invoiced: "Invoiced",
      cancelled: "Cancelled",
    },
    salesOrderForm: {
      customerRequired: "Customer is required",
      orderDateRequired: "Order date is required",
      expectedDeliveryDateRequired: "Expected delivery date is required",
      addLineItemRequired: "Please add at least one line item",
      editTitle: "Edit Sales Order",
      createTitle: "Create New Sales Order",
      editDescription: "Update sales order details and line items.",
      createDescription: "Fill in the sales order details and add line items.",
      generalTab: "General",
      lineItemsTab: "Line Items ({count})",
      shippingTab: "Shipping",
      termsTab: "Terms & Notes",
      customer: "Customer",
      searchCustomer: "Search customer...",
      customerSearchPlaceholder: "Search by code or name...",
      noCustomerFound: "No customer found.",
      orderDate: "Order Date",
      expectedDelivery: "Expected Delivery",
      lineItemsTitle: "Line Items",
      lineItemsDescription: "Manage products or services in this order",
      addItem: "Add Item",
      noItems: "No items added yet.",
      noItemsDescription: "Click \"Add Item\" to get started.",
      qty: "Qty",
      unit: "Unit",
      price: "Price",
      discountPct: "Disc %",
      taxPct: "Tax %",
      totals: "Totals",
      subtotal: "Subtotal",
      discount: "Discount",
      tax: "Tax",
      total: "Total",
      address: "Address",
      addressPlaceholder: "Street address",
      city: "City",
      cityPlaceholder: "City",
      stateProvince: "State/Province",
      statePlaceholder: "State",
      postalCode: "Postal Code",
      postalCodePlaceholder: "Postal code",
      country: "Country",
      countryPlaceholder: "Country",
      paymentTerms: "Payment Terms",
      internalNotes: "Internal Notes",
      saving: "Saving...",
      updateOrder: "Update Order",
      createOrder: "Create Order",
    },
    salesOrderViewDialog: {
      title: "Sales Order Details",
      description: "Order #{number}",
      customerInformation: "Customer Information",
      name: "Name",
      email: "Email",
      quotation: "Quotation",
      orderDetails: "Order Details",
      orderDate: "Order Date",
      expectedDelivery: "Expected Delivery",
      deliveryAddress: "Delivery Address",
      lineItems: "Line Items",
      quantity: "Quantity",
      unit: "Unit",
      unitPrice: "Unit Price",
      discount: "Discount",
      tax: "Tax",
      total: "Total",
      subtotal: "Subtotal",
      totalAmount: "Total Amount",
      paymentSummary: "Payment Summary",
      totalInvoiced: "Total Invoiced",
      totalPaid: "Total Paid",
      balanceDue: "Balance Due",
      payments: "Payments ({count})",
      invoiceTotalSummary: "Total: {total} | Paid: {paid} | Due: {due}",
      ref: "Ref",
      termsConditions: "Terms & Conditions",
      notes: "Notes",
      generatingPdf: "Generating PDF...",
      downloadPdf: "Download PDF",
      preparingPrint: "Preparing Print...",
      printOrder: "Print Order",
      draft: "Draft",
      confirmed: "Confirmed",
      inProgress: "In Progress",
      shipped: "Shipped",
      delivered: "Delivered",
      invoiced: "Invoiced",
      cancelled: "Cancelled",
      sent: "Sent",
      partiallyPaid: "Partially Paid",
      paid: "Paid",
      overdue: "Overdue",
    },
    quotationsPage: {
      title: "Quotations",
      subtitle: "Create and manage sales quotations",
      createQuotation: "Create Quotation",
      searchPlaceholder: "Search quotations...",
      quotationNumber: "Quotation #",
      date: "Date",
      validUntil: "Valid Until",
      amount: "Amount",
      loadError: "Error loading quotations. Please try again.",
      empty: "No quotations found. Create your first quotation to get started.",
      expiringSoon: "Expiring Soon",
      itemsCount: "{count} items",
      changeStatus: "Change Status",
      markAsSent: "Mark as Sent",
      markAsAccepted: "Mark as Accepted",
      markAsRejected: "Mark as Rejected",
      convertToOrder: "Convert to Order",
      converted: "Converted",
      convertTitle: "Convert Quotation to Sales Order",
      convertDescription: "Are you sure you want to convert quotation {number} to a sales order?",
      convertWillLabel: "This will:",
      convertBulletCreateOrder: "Create a new sales order with all quotation details",
      convertBulletCopyItems: "Copy all line items to the sales order",
      convertBulletStatus: "Update the quotation status to \"Ordered\"",
      convertBulletLink: "Link the quotation to the new sales order",
      convertCannotUndo: "This action cannot be undone.",
      converting: "Converting...",
      convertAction: "Convert to Sales Order",
      draft: "Draft",
      sent: "Sent",
      accepted: "Accepted",
      rejected: "Rejected",
      expired: "Expired",
      ordered: "Ordered",
    },
    quotationForm: {
      customerRequired: "Customer is required",
      quotationDateRequired: "Quotation date is required",
      validUntilRequired: "Valid until date is required",
      addLineItemRequired: "Please add at least one line item",
      editTitle: "Edit Quotation",
      createTitle: "Create New Quotation",
      editDescription: "Update quotation details and line items.",
      createDescription: "Fill in the quotation details and add line items.",
      generalTab: "General",
      lineItemsTab: "Line Items ({count})",
      termsTab: "Terms & Notes",
      customer: "Customer",
      selectCustomer: "Select a customer",
      quotationDate: "Quotation Date",
      validUntil: "Valid Until",
      lineItemsTitle: "Line Items",
      lineItemsDescription: "Manage products or services in this quotation",
      addItem: "Add Item",
      noItems: "No items added yet.",
      noItemsDescription: "Click \"Add Item\" to get started.",
      qty: "Qty",
      unit: "Unit",
      price: "Price",
      discountPct: "Disc %",
      taxPct: "Tax %",
      totals: "Totals",
      subtotal: "Subtotal",
      discount: "Discount",
      tax: "Tax",
      total: "Total",
      termsConditions: "Terms & Conditions",
      internalNotes: "Internal Notes",
      saving: "Saving...",
      updateQuotation: "Update Quotation",
      createQuotation: "Create Quotation",
    },
    quotationLineItemDialog: {
      itemRequired: "Item is required",
      quantityRequired: "Quantity must be greater than 0",
      unitPriceRequired: "Unit price cannot be negative",
      uomRequired: "Unit of measure is required",
      editTitle: "Edit Line Item",
      createTitle: "Add Line Item",
      editDescription: "Update the line item details.",
      createDescription: "Fill in the details for the new line item.",
      item: "Item",
      searchItem: "Search item...",
      itemSearchPlaceholder: "Search by code or name...",
      noItemFound: "No item found.",
      stockLabel: "Stock",
      description: "Description",
      quantity: "Quantity",
      unitPrice: "Unit Price",
      discountRate: "Discount %",
      taxRate: "Tax Rate %",
      subtotal: "Subtotal",
      discount: "Discount",
      tax: "Tax",
      lineTotal: "Line Total",
      updateItem: "Update Item",
      addItem: "Add Item",
    },
    quotationViewDialog: {
      title: "Quotation Details",
      description: "Quotation #{number}",
      customerInformation: "Customer Information",
      name: "Name",
      email: "Email",
      salesOrder: "Sales Order",
      quotationDetails: "Quotation Details",
      quotationDate: "Quotation Date",
      validUntil: "Valid Until",
      paymentTerms: "Payment Terms",
      billingAddress: "Billing Address",
      lineItems: "Line Items",
      quantity: "Quantity",
      unit: "Unit",
      unitPrice: "Unit Price",
      discount: "Discount",
      tax: "Tax",
      total: "Total",
      subtotal: "Subtotal",
      totalAmount: "Total Amount",
      termsConditions: "Terms & Conditions",
      notes: "Notes",
      printQuotation: "Print Quotation",
      draft: "Draft",
      sent: "Sent",
      accepted: "Accepted",
      rejected: "Rejected",
      expired: "Expired",
      ordered: "Ordered",
    },
    invoicesPage: {
      title: "Invoices",
      subtitle: "Create and manage sales invoices",
      createInvoice: "Create Invoice",
      searchPlaceholder: "Search invoices...",
      statusPlaceholder: "Status",
      allStatus: "All Status",
      invoiceNumber: "Invoice #",
      customer: "Customer",
      invoiceDate: "Invoice Date",
      dueDate: "Due Date",
      amount: "Amount",
      paid: "Paid",
      due: "Due",
      status: "Status",
      actions: "Actions",
      loadError: "Error loading invoices. Please try again.",
      empty: "No invoices found. Create your first invoice to get started.",
      fromSalesOrder: "From {number}",
      overdue: "Overdue",
      itemsCount: "{count} {count, plural, one {item} other {items}}",
      view: "View",
      printInvoice: "Print Invoice",
      edit: "Edit",
      sendToCustomer: "Send to Customer",
      deleteInvoice: "Delete Invoice",
      recordPayment: "Record Payment",
      cancelInvoice: "Cancel Invoice",
      sendTitle: "Send Invoice to Customer",
      sendDescription: "Are you sure you want to send invoice {invoiceNumber} to {customerName}?",
      sendDescriptionBody:
        "This will update the invoice status to \"Sent\" and the customer will be able to view and pay the invoice.",
      sending: "Sending...",
      sendAction: "Send Invoice",
      cancel: "Cancel",
      cancelTitle: "Cancel Invoice",
      cancelDescription:
        "Are you sure you want to cancel invoice {invoiceNumber}? This will mark the invoice as cancelled and it cannot be sent or paid. This action cannot be undone.",
      cancelling: "Cancelling...",
      cancelAction: "Cancel Invoice",
      deleteTitle: "Delete Draft Invoice",
      deleteDescription:
        "Are you sure you want to delete invoice {invoiceNumber}? This will permanently delete the draft invoice and all its line items.",
      deleteLinkedSalesOrderNotice:
        "The linked sales order will be reverted back to \"Confirmed\" status so it can be converted to a new invoice.",
      deleting: "Deleting...",
      deleteAction: "Delete Invoice",
      draft: "Draft",
      sent: "Sent",
      paidStatus: "Paid",
      partiallyPaid: "Partially Paid",
      overdueStatus: "Overdue",
      cancelledStatus: "Cancelled",
      sendSuccess: "Invoice sent successfully",
      sendError: "Failed to send invoice",
      cancelSuccess: "Invoice cancelled",
      cancelError: "Failed to cancel invoice",
      deleteSuccess: "Invoice deleted successfully",
      deleteError: "Failed to delete invoice",
    },
    invoiceForm: {
      customerRequired: "Customer is required",
      invoiceDateRequired: "Invoice date is required",
      dueDateRequired: "Due date is required",
      dueDateAfterInvoiceDate: "Due date must be on or after invoice date",
      addLineItemRequired: "Please add at least one line item",
      missingCustomerDetails: "Selected customer details not found.",
      editTitle: "Edit Invoice",
      createTitle: "Create New Invoice",
      editDescription: "Update invoice details and line items.",
      createDescription: "Fill in the invoice details and add line items.",
      generalTab: "General",
      lineItemsTab: "Line Items ({count})",
      termsTab: "Terms & Notes",
      customer: "Customer",
      selectCustomer: "Select a customer",
      warehouseOptional: "Warehouse (Optional)",
      selectWarehouse: "Select a warehouse (for stock validation)",
      none: "None",
      warehouseHelp: "Select a warehouse to validate and deduct stock when sending",
      location: "Location",
      selectLocation: "Select a location (optional)",
      selectWarehouseFirst: "Select warehouse first",
      invoiceDate: "Invoice Date",
      dueDate: "Due Date",
      lineItemsTitle: "Line Items",
      lineItemsDescription: "Manage products or services in this invoice",
      addItem: "Add Item",
      noItems: "No items added yet.",
      noItemsDescription: "Click \"Add Item\" to get started.",
      item: "Item",
      qty: "Qty",
      unit: "Unit",
      price: "Price",
      actions: "Actions",
      discountPct: "Disc %",
      taxPct: "Tax %",
      totals: "Totals",
      subtotal: "Subtotal",
      discount: "Discount",
      tax: "Tax",
      total: "Total",
      termsConditions: "Terms & Conditions",
      internalNotes: "Internal Notes",
      saving: "Saving...",
      updateInvoice: "Update Invoice",
      createInvoice: "Create Invoice",
      createSuccess: "Invoice created successfully",
      createError: "Failed to create invoice",
      updateSuccess: "Invoice updated successfully",
      updateError: "Failed to update invoice",
    },
    invoiceLineItemDialog: {
      itemRequired: "Item is required",
      itemCodeRequired: "Item code is required",
      itemNameRequired: "Item name is required",
      quantityRequired: "Quantity must be greater than 0",
      unitPriceRequired: "Unit price must be non-negative",
      discountMin: "Discount cannot be negative",
      discountMax: "Discount cannot exceed 100%",
      taxMin: "Tax rate cannot be negative",
      taxMax: "Tax rate cannot exceed 100%",
      uomRequired: "Unit of measure is required",
      editTitle: "Edit Line Item",
      createTitle: "Add Line Item",
      editDescription: "Update the line item details.",
      createDescription: "Fill in the details for the new line item.",
      item: "Item",
      selectItem: "Select an item",
      description: "Description",
      quantity: "Quantity",
      unitPrice: "Unit Price",
      discountRate: "Discount %",
      taxRate: "Tax Rate %",
      subtotal: "Subtotal",
      discount: "Discount",
      tax: "Tax",
      lineTotal: "Line Total",
      cancel: "Cancel",
      updateItem: "Update Item",
      addItem: "Add Item",
    },
    invoiceViewDialog: {
      title: "Invoice Details",
      description: "Invoice #{number}",
      customerInformation: "Customer Information",
      name: "Name",
      email: "Email",
      salesOrder: "Sales Order",
      invoiceDetails: "Invoice Details",
      invoiceDate: "Invoice Date",
      dueDate: "Due Date",
      warehouse: "Warehouse",
      location: "Location",
      paymentTerms: "Payment Terms",
      defaultPaymentTerms: "Net 30",
      billingAddress: "Billing Address",
      lineItems: "Line Items",
      quantity: "Quantity",
      unit: "Unit",
      unitPrice: "Unit Price",
      discount: "Discount",
      tax: "Tax",
      total: "Total",
      subtotal: "Subtotal",
      totalAmount: "Total Amount",
      amountPaid: "Amount Paid",
      amountDue: "Amount Due",
      paymentHistory: "Payment History ({count})",
      date: "Date",
      paymentNumber: "Payment #",
      method: "Method",
      balanceRemaining: "Balance Remaining",
      reference: "Ref: {value}",
      termsConditions: "Terms & Conditions",
      notes: "Notes",
      generatingPdf: "Generating PDF...",
      downloadPdf: "Download PDF",
      preparingPrint: "Preparing Print...",
      printInvoice: "Print Invoice",
      notAvailable: "N/A",
      draft: "Draft",
      sent: "Sent",
      paidStatus: "Paid",
      partiallyPaid: "Partially Paid",
      overdue: "Overdue",
      cancelled: "Cancelled",
    },
    recordPaymentDialog: {
      invoiceIdRequired: "Invoice ID is required",
      amountRequired: "Amount must be greater than 0",
      paymentDateRequired: "Payment date is required",
      paymentMethodRequired: "Payment method is required",
      title: "Record Payment",
      description: "Record a payment for invoice {invoiceNumber}",
      totalAmount: "Total Amount",
      amountPaid: "Amount Paid",
      amountDue: "Amount Due",
      paymentAmount: "Payment Amount",
      paymentDate: "Payment Date",
      paymentMethod: "Payment Method",
      selectPaymentMethod: "Select payment method",
      bankTransfer: "Bank Transfer",
      check: "Check",
      cash: "Cash",
      creditCard: "Credit Card",
      wireTransfer: "Wire Transfer",
      other: "Other",
      referenceNumber: "Reference Number",
      referencePlaceholder: "Check number, transaction ID, etc.",
      notes: "Notes",
      notesPlaceholder: "Additional payment details...",
      cancel: "Cancel",
      recording: "Recording...",
      recordPayment: "Record Payment",
      recordSuccess: "Payment recorded successfully",
      recordError: "Failed to record payment",
    },
    posPage: {
      title: "Point of Sale",
      subtitle: "Quick checkout for walk-in customers",
      searchAndAddItems: "Search and add items...",
      searchItems: "Search items...",
      noItemsFound: "No items found.",
      outOfStock: "Out of Stock",
      lowStock: "Low Stock",
      stockLabel: "Stock: {count}",
      clear: "Clear",
      itemNumber: "#",
      item: "Item",
      unit: "Unit",
      price: "Price",
      qty: "Qty",
      discount: "Discount",
      total: "Total",
      noItemsInCart: "No items in cart.",
      noItemsInCartDescription: "Search and add items to begin.",
      customer: "Customer",
      walkInCustomer: "Walk-in Customer",
      billSummary: "Bill Summary",
      items: "Items",
      subtotal: "Subtotal",
      vat: "VAT (12%)",
      proceedToPayment: "Proceed to Payment",
      paymentMethod: "Payment Method",
      cash: "Cash",
      card: "Card",
      gcash: "GCash",
      maya: "Maya",
      amountReceived: "Amount Received",
      change: "Change",
      cancel: "Cancel",
      completeSale: "Complete Sale",
      transactionSuccess: "Transaction completed successfully",
      transactionError: "Failed to complete transaction",
      outOfStockError: "{name} is out of stock",
      outOfStockDescription: "Cannot add items with zero or negative stock",
      insufficientStockError: "Insufficient stock for {name}",
      insufficientStockDescription:
        "Only {available} units available. Currently in cart: {current}",
      checkoutStockError: "Cannot complete checkout - Insufficient stock",
    },
    posTransactionsPage: {
      title: "POS Transactions",
      subtitle: "View and manage point of sale transactions",
      totalTransactions: "Total Transactions",
      completed: "Completed",
      voided: "Voided",
      totalSales: "Total Sales",
      searchPlaceholder: "Search by transaction number, customer, or cashier (3+ chars)",
      statusPlaceholder: "Status",
      allStatus: "All Status",
      allCashiers: "All Cashiers",
      clearFilters: "Clear Filters",
      transactionNumber: "Transaction #",
      dateTime: "Date & Time",
      customer: "Customer",
      cashier: "Cashier",
      items: "Items",
      amount: "Amount",
      status: "Status",
      actions: "Actions",
      loading: "Loading transactions...",
      emptyFiltered: "No transactions found matching your filters",
      empty: "No transactions yet",
      walkInCustomer: "Walk-in Customer",
      itemsCount: "{count} items",
      printReceipt: "Print Receipt",
      voidTransaction: "Void Transaction",
      adminPinTitle: "Administrator Verification Required",
      adminPinDescription: "Please enter administrator PIN to void this transaction.",
      cancel: "Cancel",
      voidTitle: "Void Transaction",
      voidDescription:
        "Are you sure you want to void transaction {transactionNumber}? This action cannot be undone.",
      voidAction: "Void Transaction",
      voidSuccess: "Transaction voided successfully",
      voidError: "Failed to void transaction",
      completedStatus: "Completed",
      voidedStatus: "Voided",
    },
    adminPinDialog: {
      defaultTitle: "Administrator Verification Required",
      defaultDescription: "Please enter administrator PIN to proceed with this action.",
      pinRequired: "Please enter PIN",
      invalidPin: "Invalid PIN. Please try again.",
      verifyFailed: "Verification failed. Please try again.",
      pinLabel: "Administrator PIN",
      pinPlaceholder: "Enter PIN",
      cancel: "Cancel",
      verifying: "Verifying...",
      verify: "Verify",
    },
    receiptPanel: {
      title: "Receipt",
      print: "Print",
      download: "Download",
      generating: "Generating receipt...",
      failed: "Failed to generate receipt",
      previewTitle: "Receipt Preview",
    },
    posTransactionDetailsDialog: {
      title: "Transaction Details",
      printReceipt: "Print Receipt",
      transactionNumber: "Transaction Number",
      dateTime: "Date & Time",
      cashier: "Cashier",
      customer: "Customer",
      walkInCustomer: "Walk-in Customer",
      status: "Status",
      items: "Items",
      item: "Item",
      quantity: "Quantity",
      unitPrice: "Unit Price",
      discount: "Discount",
      total: "Total",
      subtotal: "Subtotal",
      tax: "Tax ({rate}%)",
      totalAmount: "Total Amount",
      payment: "Payment",
      amountPaid: "Amount Paid",
      change: "Change",
      notes: "Notes",
      completed: "Completed",
      voided: "Voided",
      notAvailable: "-",
    },
    itemsPage: {
      title: "Inventory Master",
      subtitle: "Manage items with real-time stock levels",
      exportCsv: "Export CSV",
      createItem: "Create Item",
      totalItems: "Total Items",
      totalItemsDescription: "In inventory",
      totalAvailableValue: "Total Available Value",
      totalAvailableValueDescription: "Current sellable stock",
      lowStock: "Low Stock",
      lowStockDescription: "At or below reorder point",
      outOfStock: "Out of Stock",
      outOfStockDescription: "No available inventory",
      searchPlaceholder: "Search by item code or name...",
      categoryPlaceholder: "Category",
      allCategories: "All Categories",
      image: "Image",
      itemCode: "Item Code",
      itemName: "Item Name",
      category: "Category",
      uom: "UOM",
      onHand: "On Hand",
      allocated: "Allocated",
      inTransitQty: "In Transit Qty",
      available: "Available",
      normal: "Normal",
      overstock: "Overstock",
      discontinued: "Discontinued",
      unknown: "Unknown",
      errorLoadingTitle: "Error Loading Items",
      unauthorizedMessage: "Please log in to view inventory items.",
      loadErrorMessage: "Unable to load inventory data. Please try again.",
      retry: "Retry",
      empty: "No items found. Create your first item to get started.",
      deleteTitle: "Delete Item",
      deleteDescription: "Are you sure you want to delete this item?",
      deleteDescriptionWithName:
        "Are you sure you want to delete \"{name}\"? This action cannot be undone.",
      deleteSuccess: "Item deleted successfully",
      deleteError: "Failed to delete item",
      noDataToExport: "No data to export",
      exportSuccess: "Inventory exported to CSV",
      editAriaLabel: "Edit",
      deleteAriaLabel: "Delete",
      moreActions: "More",
    },
    inventoryItemPage: {
      rawMaterial: "Raw Material",
      finishedGood: "Finished Good",
      asset: "Asset",
      service: "Service",
      loadingTitle: "Loading Item...",
      loadingDescription: "Please wait while we load the item details...",
      errorLoadingTitle: "Error Loading Item",
      itemNotFound: "Item not found",
      itemDetails: "Item Details",
      editItem: "Edit Item",
      addItemDetails: "Add Item Details",
      createNewItem: "Create New Item",
      itemDetailsDescription: "Review item information, pricing tiers, and stock locations.",
      editItemDescription: "Update item information and manage pricing tiers across tabs.",
      addItemDetailsDescription:
        "Item created successfully! Continue to the Prices and Locations tabs to complete setup.",
      createNewItemDescription:
        "Create a new item by filling in the basic information. You will be able to add pricing and locations after saving.",
      createPageDescription: "Add a new item to your inventory",
      updatePageDescription: "Update item information",
      generalTab: "General",
      overviewTab: "Overview",
      pricesTab: "Prices",
      locationsTab: "Locations",
      basicInformation: "Basic Information",
      itemCodeLabel: "Item Code *",
      itemTypeLabel: "Item Type *",
      selectItemType: "Select item type",
      itemNameLabel: "Item Name *",
      chineseNameLabel: "Chinese Name",
      descriptionLabel: "Description",
      itemImageLabel: "Item Image",
      classificationAndUnit: "Classification & Unit of Measure",
      categoryLabel: "Category *",
      selectCategory: "Select category",
      unitOfMeasureLabel: "Unit of Measure *",
      selectUom: "Select UOM",
      pricingInformation: "Pricing Information",
      standardCostLabel: "Unit Cost",
      listPriceLabel: "Selling Price *",
      availableQtyLabel: "Available Qty",
      reservedQtyLabel: "Reserved Qty",
      onHandLabel: "On Hand",
      inventoryManagement: "Inventory Management",
      reorderLevelLabel: "Reorder Level",
      reorderLevelDescription: "Alert when stock falls below this level",
      reorderQtyLabel: "Reorder Quantity",
      reorderQtyDescription: "Suggested quantity to reorder",
      itemInformationTitle: "Item Information",
      itemInformationDescription: "Basic details about this item",
      itemInformationCreateDescription: "Fill in the details below to create a new item.",
      itemInformationEditDescription: "Update the item details below.",
      itemCodeImmutableDescription: "Item code cannot be changed",
      itemCodeAutoGenerateDescription: "Leave empty to auto-generate",
      activeStatusLabel: "Active Status",
      activeStatusDescription: "Set whether this item is active and available for use",
      editItemAction: "Edit Item",
      backToItems: "Back to Items",
      noCategory: "No category",
      uncategorized: "Uncategorized",
      perUnitPrefix: "Per",
      marginLabel: "Margin",
      reorderQtyShortLabel: "Reorder Qty",
      baseUomLabel: "Base UOM",
      noImage: "No image",
      qrCodeLabel: "QR Code",
      noQrCode: "No QR code",
      pricingDetailsTitle: "Pricing Details",
      pricingDetailsDescription: "Cost and pricing information",
      profitMarginLabel: "Profit Margin",
      reorderSettingsDescription: "Reorder settings and thresholds",
      inTransitLabel: "In Transit",
      itemImageDescription: "Upload or update the item image",
      qrCodeReadonlyDescription: "SKU QR code is generated automatically and cannot be edited here.",
      noQrCodeAvailable: "No QR code available",
      workflowInfo:
        "Fill in the basic item information below. After saving, you will be able to add pricing tiers and location details.",
      close: "Close",
      cancel: "Cancel",
      edit: "Edit",
      saving: "Saving...",
      updateItem: "Update Item",
      saveAndContinue: "Save & Continue",
      itemCodePlaceholder: "ITEM-001",
      itemNamePlaceholder: "Enter item name",
      chineseNamePlaceholder: "Optional Chinese name",
      descriptionPlaceholder: "Enter description",
      standardCostPlaceholder: "0.00",
      listPricePlaceholder: "0.00",
      reorderLevelPlaceholder: "0",
      reorderQtyPlaceholder: "0",
      updateSuccess: "Item updated successfully",
      missingCompany: "User company information not available",
      createSuccess: "Item created successfully!",
      createSuccessDescription: "You can now add pricing and locations",
      updateError: "Failed to update item",
      createError: "Failed to create item",
    },
    itemValidation: {
      codeRequired: "Item code is required",
      codeMax: "Item code must be less than 50 characters",
      codeFormat: "Item code must contain only uppercase letters, numbers, spaces, and hyphens",
      nameRequired: "Item name is required",
      nameMax: "Item name must be less than 200 characters",
      chineseNameMax: "Chinese name must be less than 200 characters",
      descriptionMax: "Description must be less than 1000 characters",
      uomRequired: "Unit of measure is required",
      categoryRequired: "Category is required",
      standardCostMin: "Standard cost must be 0 or greater",
      listPriceMin: "List price must be 0 or greater",
      reorderLevelMin: "Reorder level must be 0 or greater",
      reorderQtyMin: "Reorder quantity must be 0 or greater",
    },
    itemLocationsTab: {
      title: "Locations",
      description: "Stock by warehouse location",
      moveStock: "Move Stock",
      loadError: "Failed to load item locations.",
      empty: "No location stock found.",
      warehouse: "Warehouse",
      location: "Location",
      type: "Type",
      onHand: "On Hand",
      reserved: "Reserved",
      available: "Available",
      inTransit: "In Transit",
      estArrival: "Est Arrival",
      defaultBadge: "Default",
      setDefault: "Set Default",
      defaultUpdated: "Default location updated",
      updateDefaultError: "Failed to update default location",
      selectWarehouseAndLocations: "Select warehouse and locations to move stock.",
      selectDifferentLocations: "Select two different locations.",
      enterValidQuantity: "Enter a valid quantity to move.",
      stockMoved: "Stock moved successfully",
      moveStockError: "Failed to move stock",
      batchCode: "Batch Code",
      receivedDate: "Received Date",
      moveDialogTitle: "Move Stock",
      moveDialogDescription: "Transfer stock between locations in the same warehouse.",
      warehouseLabel: "Warehouse",
      selectWarehouse: "Select warehouse",
      fromLocationLabel: "From Location",
      selectSourceLocation: "Select source location",
      toLocationLabel: "To Location",
      selectDestinationLocation: "Select destination location",
      quantityLabel: "Quantity",
      quantityPlaceholder: "Enter quantity to move",
      unnamed: "Unnamed",
      availableShort: "Avail",
      cancel: "Cancel",
      moving: "Moving...",
    },
    itemPricesTab: {
      title: "Item Prices",
      description: "Manage multi-tier pricing for this item (e.g., Factory Cost, Wholesale, SRP)",
      addPrice: "Add Price",
      deleteSuccess: "Price deleted successfully",
      deleteError: "Failed to delete price",
      empty: "No prices found for this item.",
      emptyDescription: "Add your first price tier to get started.",
      priceTier: "Price Tier",
      tierName: "Tier Name",
      price: "Price",
      effectiveFrom: "Effective From",
      effectiveTo: "Effective To",
      status: "Status",
      active: "Active",
      inactive: "Inactive",
      actions: "Actions",
      deleteTitle: "Delete Price",
      deleteDescription: "Are you sure you want to delete this price?",
      deleteDescriptionWithName:
        "Are you sure you want to delete the price ₱{price} for \"{name}\"? This action cannot be undone.",
    },
    priceFormDialog: {
      editTitle: "Edit Price",
      createTitle: "Create Price",
      editDescription: "Update price tier information",
      createDescription: "Add a new price tier for this item",
      priceTierCodeLabel: "Price Tier Code",
      priceTierCodeRequired: "Price tier code is required",
      priceTierCodePlaceholder: "e.g., fc, ws, srp",
      commonTiers: "Common tiers",
      priceTierNameLabel: "Price Tier Name",
      priceTierNameRequired: "Price tier name is required",
      priceTierNamePlaceholder: "e.g., Factory Cost, Wholesale",
      priceLabel: "Price",
      priceRequired: "Price is required",
      priceMin: "Price must be 0 or greater",
      pricePlaceholder: "0.0000",
      currencyCodeLabel: "Currency Code",
      currencyCodePlaceholder: "PHP",
      currencyCodeDescription: "Default: PHP (Philippine Peso)",
      effectiveFromLabel: "Effective From",
      effectiveFromRequired: "Effective from date is required",
      effectiveToLabel: "Effective To (Optional)",
      effectiveToDescription: "Leave empty for no expiry",
      activeLabel: "Active",
      cancel: "Cancel",
      updateAction: "Update Price",
      createAction: "Create Price",
      createSuccess: "Price created successfully",
      createError: "Failed to create price",
      updateSuccess: "Price updated successfully",
      updateError: "Failed to update price",
      noPriceSelected: "No price selected",
    },
    stockTransactionsPage: {
      title: "Stock Transactions",
      subtitle: "Track all inventory movements and adjustments",
      newTransaction: "New Transaction",
      searchPlaceholder: "Search transactions...",
      typePlaceholder: "Type",
      allTypes: "All Types",
      stockIn: "Stock In",
      stockOut: "Stock Out",
      transfer: "Transfer",
      adjustment: "Adjustment",
      date: "Date",
      type: "Type",
      item: "Item",
      warehouse: "Warehouse",
      location: "Location",
      quantity: "Quantity",
      reference: "Reference",
      reason: "Reason",
      createdBy: "Created By",
      loadingError: "Error loading stock transactions. Please try again.",
      emptyTitle: "No stock transactions found",
      emptyDescription: "Try adjusting your search or filters.",
      badgeIn: "IN",
      badgeOut: "OUT",
      badgeTransfer: "TRANSFER",
      badgeAdjustment: "ADJUSTMENT",
    },
    stockTransactionForm: {
      title: "New Stock Transaction",
      description: "Record a new inventory movement or adjustment",
      transactionDateLabel: "Transaction Date *",
      transactionTypeLabel: "Transaction Type *",
      selectType: "Select type",
      warehouseLabel: "Warehouse *",
      fromWarehouseLabel: "From Warehouse *",
      toWarehouseLabel: "To Warehouse *",
      selectWarehouse: "Select warehouse",
      selectDestinationWarehouse: "Select destination",
      fromLocationLabel: "From Location",
      toLocationLabel: "To Location",
      destinationLocationLabel: "Destination Location",
      sourceLocationLabel: "Source Location",
      selectLocation: "Select location",
      selectWarehouseFirst: "Select warehouse first",
      selectDestinationWarehouseFirst: "Select destination warehouse",
      itemLabel: "Item *",
      selectWarehouseFirstItem: "Select warehouse first...",
      searchItem: "Search item...",
      searchItemByCodeOrName: "Search by code or name...",
      noItemFound: "No item found.",
      stockLabel: "Stock",
      quantityLabel: "Quantity *",
      quantityPlaceholder: "0",
      referenceNumberLabel: "Reference Number",
      referenceNumberPlaceholder: "PO-2024-001, SO-2024-001, etc.",
      reasonLabel: "Reason *",
      selectReason: "Select reason",
      notesLabel: "Notes",
      notesPlaceholder: "Additional notes...",
      cancel: "Cancel",
      createAction: "Create Transaction",
      creating: "Creating...",
      invalidItem: "Invalid item selected or item has no unit of measure",
      transferCreated: "Stock transfer created successfully",
      transferCreatedDescription: "Driver must confirm receipt.",
      createSuccess: "Stock transaction created successfully",
      createError: "Failed to create stock transaction",
      reasonPurchaseReceipt: "Purchase receipt",
      reasonProductionOutput: "Production output",
      reasonCustomerReturn: "Customer return",
      reasonOther: "Other",
      reasonSalesOrder: "Sales order",
      reasonProductionConsumption: "Production consumption",
      reasonDamageLoss: "Damage/Loss",
      reasonStockRebalancing: "Stock rebalancing",
      reasonCustomerRequest: "Customer request",
      reasonWarehouseConsolidation: "Warehouse consolidation",
      reasonPhysicalCountAdjustment: "Physical count adjustment",
      reasonDamagedGoods: "Damaged goods",
      reasonSystemCorrection: "System correction",
    },
    stockTransactionValidation: {
      transactionDateRequired: "Transaction date is required",
      itemRequired: "Item is required",
      warehouseRequired: "Warehouse is required",
      quantityMin: "Quantity must be greater than 0",
      uomRequired: "Unit of measure is required",
      reasonRequired: "Reason is required",
      destinationWarehouseRequired: "Destination warehouse is required for transfers",
    },
    stockTransactionDetail: {
      titleDescription: "Stock Transaction Details",
      transactionInformation: "Transaction Information",
      transactionCode: "Transaction Code",
      type: "Type",
      status: "Status",
      transactionDate: "Transaction Date",
      reference: "Reference",
      notes: "Notes",
      warehouseInformation: "Warehouse Information",
      sourceLocation: "Source Location",
      destinationLocation: "Destination Location",
      location: "Location",
      createdBy: "Created By",
      createdAt: "Created At",
      transactionItems: "Transaction Items",
      itemCode: "Item Code",
      itemName: "Item Name",
      qtyBefore: "Qty Before",
      quantity: "Quantity",
      qtyAfter: "Qty After",
      unitCost: "Unit Cost",
      totalCost: "Total Cost",
      stockValueChanges: "Stock Value Changes",
      item: "Item",
      valuationRate: "Valuation Rate",
      valueBefore: "Value Before",
      valueAfter: "Value After",
      change: "Change",
      totalCostLabel: "Total Cost",
      stockIn: "Stock In",
      stockOut: "Stock Out",
      transfer: "Transfer",
      adjustment: "Adjustment",
      statusPosted: "Posted",
      statusDraft: "Draft",
      statusCompleted: "Completed",
      statusCancelled: "Cancelled",
      loadError: "Failed to load stock transaction",
    },
    stockAdjustmentsPage: {
      title: "Stock Adjustments",
      subtitle: "Manage stock corrections and adjustments",
      createAdjustment: "Create Adjustment",
      searchPlaceholder: "Search adjustments...",
      statusPlaceholder: "Status",
      typePlaceholder: "Type",
      allStatus: "All Status",
      allTypes: "All Types",
      draft: "Draft",
      pending: "Pending",
      approved: "Approved",
      posted: "Posted",
      rejected: "Rejected",
      physicalCount: "Physical Count",
      damage: "Damage",
      loss: "Loss",
      found: "Found",
      qualityIssue: "Quality Issue",
      other: "Other",
      adjustmentNumber: "Adjustment #",
      type: "Type",
      date: "Date",
      warehouse: "Warehouse",
      location: "Location",
      reason: "Reason",
      totalValue: "Total Value",
      status: "Status",
      actions: "Actions",
      loadingError: "Error loading stock adjustments. Please try again.",
      emptyTitle: "No stock adjustments found",
      emptyDescription: "Create your first adjustment to get started.",
      itemsCount: "{count, plural, one {# item} other {# items}}",
      post: "Post",
      deleteTitle: "Delete Stock Adjustment",
      deleteDescription:
        "Are you sure you want to delete adjustment {code}? This action cannot be undone.",
      deleting: "Deleting...",
      postTitle: "Post Stock Adjustment",
      postDescription: "Are you sure you want to post adjustment {code}?",
      postStepCreateTransaction: "Create a stock transaction",
      postStepUpdateStock: "Update stock levels in the warehouse",
      postStepUpdateLedger: "Update the stock ledger",
      summaryLabel: "This will",
      postActionWarning: "This action cannot be undone.",
      posting: "Posting...",
      postAction: "Post Adjustment",
      noLocation: "--",
    },
    stockAdjustmentForm: {
      editTitle: "Edit Stock Adjustment",
      createTitle: "Create Stock Adjustment",
      editDescription: "Edit adjustment {code}",
      createDescription: "Create a new stock adjustment",
      generalInformation: "General Information",
      adjustmentTypeLabel: "Adjustment Type",
      selectType: "Select type",
      adjustmentDateLabel: "Adjustment Date",
      warehouseLabel: "Warehouse",
      selectWarehouse: "Select warehouse",
      locationLabel: "Location",
      selectLocation: "Select location",
      selectWarehouseFirst: "Select warehouse first",
      reasonLabel: "Reason",
      reasonPlaceholder: "Enter reason for adjustment",
      notesLabel: "Notes (Optional)",
      notesPlaceholder: "Additional notes...",
      lineItemsTitle: "Line Items",
      lineItemsDescription: "Add items to adjust stock levels",
      addItem: "Add Item",
      selectWarehouseBeforeItems: "Please select a warehouse before adding items",
      noItems: "No items added yet.",
      noItemsDescription: 'Click "Add Item" to get started.',
      item: "Item",
      currentQty: "Current Qty",
      adjustedQty: "Adjusted Qty",
      difference: "Difference",
      unitCost: "Unit Cost",
      totalValue: "Total Value",
      actions: "Actions",
      summary: "Summary",
      totalAdjustmentValue: "Total Adjustment Value",
      cancel: "Cancel",
      saving: "Saving...",
      updateAction: "Update Adjustment",
      createAction: "Create Adjustment",
      lineItemRequired: "Please add at least one line item",
    },
    stockAdjustmentValidation: {
      adjustmentDateRequired: "Adjustment date is required",
      warehouseRequired: "Warehouse is required",
      reasonRequired: "Reason is required",
    },
    stockAdjustmentLineItemDialog: {
      editTitle: "Edit Stock Adjustment",
      createTitle: "New Stock Adjustment",
      editDescription: "Update the adjustment details below",
      createDescription: "Adjust inventory levels for a specific item",
      selectItemStep: "Select Item",
      adjustmentDetailsStep: "Adjustment Details",
      summaryStep: "Summary",
      itemLabel: "Inventory Item",
      chooseItem: "Choose an item to adjust",
      searchByCodeOrName: "Search by code or name...",
      currentStockOnHand: "Current Stock on Hand",
      units: "units",
      typeLabel: "Type",
      selectType: "Select type",
      increaseStock: "Increase Stock",
      decreaseStock: "Decrease Stock",
      quantityLabel: "Quantity",
      quantityPlaceholder: "0.00",
      unitCostLabel: "Unit Cost",
      summary: "Summary",
      newStockLevel: "New Stock Level",
      currentStock: "Current Stock",
      adjustment: "Adjustment",
      newStock: "New Stock",
      valueImpact: "Value Impact",
      valueImpactFormula: "{quantity} {uom} x {unitCost}",
      cancel: "Cancel",
      updateAction: "Update Adjustment",
      createAction: "Add Adjustment",
    },
    stockAdjustmentLineItemValidation: {
      itemRequired: "Item is required",
      uomRequired: "Unit of measure is required",
      currentQtyMin: "Current quantity cannot be negative",
      adjustedQtyMin: "Adjusted quantity cannot be negative",
      unitCostMin: "Unit cost cannot be negative",
    },
    deliveryNotesPage: {
      title: "Delivery Notes",
      subtitle: "Manage DN lifecycle for stock request fulfillment",
      createDn: "Create DN",
      searchPlaceholder: "Search delivery notes or warehouses...",
      statusPlaceholder: "Status",
      allStatus: "All Status",
      draft: "Draft",
      confirmed: "Confirmed",
      queuedForPicking: "Queued for Picking",
      pickingInProgress: "Picking in Progress",
      dispatchReady: "Dispatch Ready",
      dispatched: "Dispatched",
      received: "Received",
      voided: "Voided",
      dnNo: "DN No",
      requestedBy: "Requested By",
      fulfilledBy: "Fulfilled By",
      pickList: "Pick List",
      status: "Status",
      actions: "Actions",
      emptyTitle: "No delivery notes found",
      emptyFilteredDescription: "Try adjusting your search or filters.",
      emptyDescription: "Create your first delivery note to get started.",
      noValue: "--",
      view: "View",
      generatingPdf: "Generating PDF...",
      printPdf: "Print PDF",
      confirm: "Confirm",
      queuePicking: "Queue Picking",
      dispatch: "Dispatch",
      receive: "Receive",
      void: "Void",
      createDialogTitle: "Create Delivery Note",
      createDialogDescription: "Select source business unit, then choose stock-request lines for allocation.",
      requestSourceBusinessUnit: "Request Source Business Unit",
      selectSourceBusinessUnit: "Select source business unit",
      fulfillmentMode: "Fulfillment Mode",
      selectFulfillmentMode: "Select fulfillment mode",
      transferToStore: "Transfer to Store",
      customerPickupWarehouse: "Customer Pickup (Warehouse)",
      fulfillmentModeHint: "Customer pickup skips destination inventory receive posting and uses direct pickup completion.",
      notes: "Notes",
      sourceBuLabel: "Source BU:",
      eligibleLabel: "Eligible:",
      selectedLabel: "Selected:",
      selectSourceBuHint: "Select a source business unit to load stock request lines",
      use: "Use",
      sr: "SR",
      item: "Item",
      requested: "Requested",
      allocatable: "Allocatable",
      allocated: "Allocated",
      availableLabel: "Available:",
      insufficientInventory: "Insufficient inventory for this allocation.",
      noEligibleLines: "No eligible stock request lines found for this source business unit",
      cancel: "Cancel",
      create: "Create",
      action: "Action",
      actionDescriptionFallback: "Review details and confirm action.",
      loadingDetails: "Loading details...",
      loadDetailsError: "Unable to load delivery note details.",
      source: "Source",
      destination: "Destination",
      request: "Request",
      unit: "Unit",
      picked: "Picked",
      dispatchedQty: "Dispatched",
      assignPickers: "Assign Pickers",
      searchNameOrEmail: "Search name or email...",
      noPickersFound: "No pickers found",
      pickersSelected: "{count} picker(s) selected",
      pickingInstructions: "Picking Instructions",
      optionalPickingInstructions: "Optional picking instructions...",
      driverName: "Driver Name",
      enterDriverName: "Enter driver name",
      dispatchNotes: "Dispatch Notes",
      optionalDispatchNotes: "Optional dispatch notes...",
      receiveNotes: "Receive Notes",
      optionalReceiveNotes: "Optional receive notes...",
      voidReason: "Void Reason",
      voidReasonPlaceholder: "Please provide a reason for voiding this delivery note...",
      confirmCreatePickList: "Confirm Create Pick List",
      confirmDispatch: "Confirm Dispatch",
      confirmReceive: "Confirm Receive",
      confirmVoid: "Confirm Void",
      unknownWarehouse: "Unknown warehouse",
      createError: "Unable to create delivery note. Please review allocated quantities and try again.",
      confirmTitle: "Confirm Delivery Note",
      queuePickingTitle: "Queue Picking",
      dispatchTitle: "Dispatch Delivery Note",
      receiveTitle: "Receive Delivery Note",
      voidTitle: "Void Delivery Note",
      confirmDescription: "Review the details below, then confirm this delivery note.",
      queuePickingDescription: "Review this delivery note, assign pickers, then create the pick list.",
      dispatchDescription: "Review the details and confirm dispatch. Dispatched quantities will use picked quantities.",
      receiveDescription: "Review the details and confirm receive.",
      voidDescription: "Review the details and confirm void.",
    },
    deliveryNoteDetailPage: {
      loading: "Loading...",
      loadError: "Failed to load delivery note.",
      title: "Delivery Note",
      confirm: "Confirm",
      queuePicking: "Queue Picking",
      void: "Void",
      status: "Status",
      sourceWarehouse: "Source Warehouse",
      destinationWarehouse: "Destination Warehouse",
      linkedPickList: "Linked Pick List",
      noValue: "--",
      totalItems: "Total Items",
      totalAllocated: "Total Allocated",
      totalShort: "Total Short",
      itemDetails: "Item Details",
      stockRequest: "Stock Request",
      item: "Item",
      uom: "UOM",
      allocated: "Allocated",
      picked: "Picked",
      short: "Short",
      dispatchedQty: "Dispatched",
      actions: "Actions",
      pickingControl: "Picking Control",
      pickingControlDescription: "Picking progress and status transitions are managed on the Pick Lists page.",
      openPickLists: "Open Pick Lists",
      dispatchInformation: "Dispatch Information",
      driverName: "Driver Name",
      enterDriverName: "Enter driver name",
      driverSignature: "Driver Signature",
      required: "Required",
      dispatchNotes: "Dispatch Notes",
      optionalNotes: "Optional notes",
      dispatching: "Dispatching...",
      confirmDispatch: "Confirm Dispatch",
      receiveDelivery: "Receive Delivery",
      receiveNotes: "Receive Notes",
      receivedQuantities: "Received Quantities",
      qty: "Qty:",
      receiving: "Receiving...",
      confirmReceive: "Confirm Receive",
      voidInformation: "Void Information",
      voidReason: "Void Reason",
      voidDeliveryNote: "Void Delivery Note",
      reasonForVoidingOptional: "Reason for voiding (optional)",
      timeline: "Timeline",
      byUser: "by {user}",
      createPickList: "Create Pick List",
      createPickListDescription: "Assign pickers for {code}. Picker assignment is owned by the pick list.",
      assignPickers: "Assign Pickers",
      searchNameOrEmail: "Search name or email...",
      noMatchingUsers: "No matching users",
      pickersSelected: "{count} picker(s) selected",
      pickingInstructions: "Picking Instructions",
      optionalPickingInstructions: "Optional picking instructions...",
      cancel: "Cancel",
      creating: "Creating...",
      created: "Created",
      confirmed: "Confirmed",
      pickingStarted: "Picking Started",
      pickingCompleted: "Picking Completed",
      dispatched: "Dispatched",
      received: "Received",
      voided: "Voided",
      draft: "Draft",
      confirmedStatus: "Confirmed",
      queuedForPicking: "Queued for Picking",
      pickingInProgress: "Picking in Progress",
      dispatchReady: "Dispatch Ready",
      dispatchedStatus: "Dispatched",
      receivedStatus: "Received",
      voidedStatus: "Voided",
      lineState: "Line State",
      editQty: "Edit Qty",
      voidItem: "Void Item",
      addItems: "Add Items",
      addItemsDescription: "Add allocatable stock-request items to this delivery note and create a new pick list.",
      adjustItem: "Adjust Dispatched Item",
      adjustItemDescription: "Reduce the dispatched quantity or set it to zero to void the line and reverse inventory.",
      newDispatchedQty: "New Dispatched Quantity",
      reason: "Reason",
      reasonOptional: "Reason (optional)",
      saveAdjustment: "Save Adjustment",
      savingAdjustment: "Saving...",
      pendingPicking: "Pending Picking",
      lineVoided: "Voided Line",
      searchItems: "Search stock requests or items...",
      noAllocatableItems: "No allocatable stock-request items available.",
      requestedQty: "Requested",
      availableQty: "Available",
      selectQtyToAdd: "Qty to Add",
      addSelectedItems: "Add Items and Create Pick List",
      creatingReplacementPickList: "Creating pick list...",
      unknownSourceWarehouse: "Unknown source warehouse",
      unknownDestinationWarehouse: "Unknown destination warehouse",
      unknownItem: "Unknown item",
      unknownUnit: "Unknown unit",
      unknownStockRequest: "Unknown stock request",
    },
    pickListsPage: {
      title: "Pick Lists",
      subtitle: "Manage picker assignments, picking quantities, and status flow",
      searchPlaceholder: "Search pick lists, delivery notes, or assignees...",
      filterStatus: "Filter status",
      allStatuses: "All Statuses",
      pending: "Pending",
      inProgress: "In Progress",
      paused: "Paused",
      done: "Done",
      cancelled: "Cancelled",
      pickListNumber: "Pick List #",
      deliveryNote: "Delivery Note",
      status: "Status",
      assignees: "Assignees",
      created: "Created",
      actions: "Actions",
      emptyTitle: "No pick lists found",
      emptyFilteredDescription: "Try adjusting your search or filters.",
      emptyDescription: "Pick lists will appear here once created from delivery notes.",
      noValue: "--",
      noAssignees: "No assignees",
      viewDetails: "View Details",
      pickListDetails: "Pick List Details",
      deliveryNoteLabel: "Delivery Note:",
      statusLabel: "Status:",
      assignedPickers: "Assigned Pickers",
      unknown: "Unknown",
      pickListItems: "Pick List Items",
      item: "Item",
      uom: "UOM",
      allocated: "Allocated",
      picked: "Picked",
      short: "Short",
      saving: "Saving...",
      savePickedQuantities: "Save Picked Quantities",
      statusActions: "Status Actions",
      startPicking: "Start Picking",
      pause: "Pause",
      completePicking: "Complete Picking",
      resumePicking: "Resume Picking",
      cancelThisPickList: "Cancel this pick list",
      cancelReasonPlaceholder: "Cancel reason (optional)",
      cancelPickList: "Cancel Pick List",
      close: "Close",
    },
    reorderManagementPage: {
      title: "Reorder Management",
      subtitle: "Monitor stock levels, manage reorder suggestions, and configure automated restocking",
      noMatchingItemsForAlerts: "No matching items found for the selected alerts.",
      highPriority: "High Priority",
      mediumPriority: "Medium Priority",
      lowPriority: "Low Priority",
      pending: "Pending",
      approved: "Approved",
      rejected: "Rejected",
      ordered: "Ordered",
      critical: "Critical",
      warning: "Warning",
      info: "Info",
      itemsOk: "Items OK",
      adequatelyStocked: "Adequately stocked",
      lowStock: "Low Stock",
      belowReorderPoint: "Below reorder point",
      belowMinimumLevel: "Below minimum level",
      pendingOrders: "Pending Orders",
      awaitingApproval: "Awaiting approval",
      estimatedCost: "Est. Cost",
      totalReorderValue: "Total reorder value",
      reorderSuggestionsTab: "Reorder Suggestions ({count})",
      activeAlertsTab: "Active Alerts ({count})",
      reorderSuggestions: "Reorder Suggestions",
      reorderSuggestionsDescription: "Review and approve automatic reorder suggestions based on stock levels",
      noReorderSuggestions: "No reorder suggestions at this time",
      allItemsAdequatelyStocked: "All items are adequately stocked",
      itemCode: "Item Code",
      warehouse: "Warehouse",
      currentStock: "Current Stock",
      reorderPoint: "Reorder Point",
      suggestedQty: "Suggested Qty",
      estimatedCostShort: "Est. Cost",
      supplier: "Supplier",
      leadTime: "Lead Time",
      leadTimeDays: "{count} days",
      reason: "Reason",
      approve: "Approve",
      reject: "Reject",
      stockLevelAlerts: "Stock Level Alerts",
      stockLevelAlertsDescription: "Critical and warning alerts for items requiring immediate attention",
      createPurchaseOrder: "Create Purchase Order",
      severity: "Severity",
      item: "Item",
      stockLevel: "Stock Level",
      message: "Message",
      action: "Action",
      noActiveAlerts: "No active alerts",
      allStockLevelsAcceptable: "All stock levels are within acceptable ranges",
      selectAllAlerts: "Select all alerts",
      selectAlertFor: "Select alert for {itemName}",
      minLabel: "Min",
      reorderShort: "Reorder",
      acknowledge: "Acknowledge",
    },
    purchasingOverviewPage: {
      title: "Overview",
      subtitle: "Strategic and operational overview of purchasing",
      allWarehouses: "All Warehouses",
      refresh: "Refresh",
      warehouseOperations: "Warehouse Operations",
      warehouseOperationsDescription: "Live operational queues and capacity status",
      footerAutoRefresh:
        "Dashboard auto-refreshes every 2-5 minutes depending on the widget. Click refresh for immediate updates.",
    },
    purchasingOverviewWidgets: {
      anErrorOccurred: "An error occurred",
      notAvailable: "N/A",
      unknown: "Unknown",
      unknownSupplier: "Unknown Supplier",
      count: "Count",
      totalValue: "Total Value",
      pending: "Pending",
      approved: "Approved",
      rejected: "Rejected",
      ordered: "Ordered",
      submitted: "Submitted",
      fulfilled: "Fulfilled",
      cancelled: "Cancelled",
      partiallyFulfilled: "Partially Fulfilled",
      pendingDraft: "Draft",
      critical: "Critical",
      warning: "Warning",
      good: "Good",
      poor: "Poor",
      excellent: "Excellent",
      queue: "Queue",
      outstandingRequisitionsTitle: "Outstanding Requisitions",
      outstandingRequisitionsDescription: "Active stock requisitions pending fulfillment",
      failedLoadRequisitionsData: "Failed to load requisitions data",
      noOutstandingRequisitions: "No outstanding requisitions",
      allStockRequisitionsFulfilled: "All stock requisitions have been fulfilled",
      recentRequisitions: "Recent Requisitions",
      partial: "Partial",
      viewAllRequisitions: "View All Requisitions",
      expectedArrivalsThisWeekTitle: "Expected Arrivals This Week",
      upcomingDeliveriesSchedule: "Upcoming deliveries schedule",
      failedLoadArrivalsData: "Failed to load arrivals data",
      noExpectedArrivalsThisWeek: "No expected arrivals this week",
      checkBackLaterForUpdates: "Check back later for updates",
      totalDeliveries: "Total Deliveries",
      weeklySchedule: "Weekly Schedule",
      noDeliveries: "No deliveries",
      viewAllLoadLists: "View All Load Lists",
      incomingDeliveriesTitle: "Incoming Deliveries",
      deliveriesLinkedToStockRequisitions: "Deliveries linked to stock requisitions",
      failedLoadDeliveriesData: "Failed to load deliveries data",
      noIncomingDeliveries: "No incoming deliveries",
      noLoadListsWithLinkedRequisitions: "No load lists with linked requisitions",
      deliveries: "Deliveries",
      expectedDeliveries: "Expected Deliveries",
      sr: "SR",
      srs: "SRs",
      eta: "ETA",
      viewAllDeliveries: "View All Deliveries",
      delayedShipmentsTitle: "Delayed Shipments",
      shipmentsPastEstimatedArrivalDate: "Shipments past estimated arrival date",
      failedLoadDelayedShipments: "Failed to load delayed shipments",
      noDelayedShipments: "No delayed shipments",
      allDeliveriesOnTrack: "All deliveries are on track!",
      criticalDelaysAlert: "{count} critical delays (7+ days overdue). Immediate attention required.",
      overdueShipments: "Overdue Shipments",
      mostOverdueFirst: "Most Overdue First",
      expected: "Expected",
      daysLate: "{count} days late",
      viewAllDelayedShipments: "View All Delayed Shipments",
      todaysReceivingQueueTitle: "Today's Receiving Queue",
      loadListsArrivedToday: "Load lists that arrived today",
      failedLoadReceivingQueue: "Failed to load receiving queue",
      noItemsInReceivingQueue: "No items in receiving queue",
      noLoadListsArrivedToday: "No load lists arrived today",
      toReceive: "To Receive",
      arrived: "Arrived",
      start: "Start",
      resume: "Resume",
      viewAllReceiving: "View All Receiving",
      pendingApprovalsTitle: "Pending Approvals",
      grnsAwaitingApproval: "GRNs awaiting approval",
      failedLoadPendingApprovals: "Failed to load pending approvals",
      allCaughtUp: "All caught up!",
      noGrnsAwaitingApproval: "No GRNs awaiting approval",
      overdueGrnsAlert: "{count} GRNs have been pending for more than 24 hours",
      awaitingApprovalLabel: "Awaiting Approval",
      grns: "GRNs",
      loadList: "Load List",
      hoursShort: "{count} hrs",
      overdue: "Overdue",
      viewAllGrns: "View All GRNs",
      boxAssignmentQueueTitle: "Box Assignment Queue",
      itemsAwaitingBoxAssignment: "Items awaiting box assignment",
      failedLoadBoxAssignmentQueue: "Failed to load box assignment queue",
      allItemsAssigned: "All items assigned!",
      noItemsAwaitingBoxAssignment: "No items awaiting box assignment",
      itemsPending: "Items Pending",
      unitsReceived: "{count} units received",
      assign: "Assign",
      viewAllItems: "View All Items",
      warehouseCapacityTitle: "Warehouse Capacity",
      spaceUtilizationMetrics: "Space utilization metrics",
      failedLoadCapacityData: "Failed to load capacity data",
      noCapacityDataAvailable: "No capacity data available",
      warehouseAtCapacityAlert: "Warehouse is at {value}% capacity. Consider expanding or optimizing storage.",
      utilization: "Utilization",
      total: "Total",
      occupied: "Occupied",
      available: "Available",
      capacityUsed: "Capacity Used",
      spaceRemaining: "Space Remaining",
      locationsRemaining: "{count} locations",
      recommendations: "Recommendations",
      reviewSlowMovingInventory: "Review slow-moving inventory",
      optimizeBinAssignments: "Optimize bin assignments",
      considerWarehouseExpansion: "Consider warehouse expansion",
      damagedItemsThisMonthTitle: "Damaged Items This Month",
      qualityIssuesAndValueImpact: "Quality issues and value impact",
      failedLoadDamagedItemsData: "Failed to load damaged items data",
      noDamagedItemsThisMonth: "No damaged items this month",
      excellentQualityRecord: "Excellent quality record!",
      highDamageCountDetected: "High damage count detected ({count} items). Review quality with suppliers.",
      bySupplier: "By Supplier",
      byType: "By Type",
      broken: "Broken",
      defective: "Defective",
      missing: "Missing",
      expired: "Expired",
      wrongItem: "Wrong Item",
      other: "Other",
      viewDamageReports: "View Damage Reports",
      activeRequisitionsTitle: "Active Requisitions",
      requisitionStatusBreakdown: "Requisition status breakdown",
      noActiveRequisitions: "No active requisitions",
      totalRequisitions: "Total Requisitions",
      statusDistribution: "Status Distribution",
      byStatus: "By Status",
      activeContainersTitle: "Active Containers",
      containersCurrentlyInTransit: "Containers currently in transit",
      failedLoadContainersData: "Failed to load containers data",
      noActiveContainers: "No active containers",
      allContainersReceived: "All containers have been received",
      inTransit: "In Transit",
      trackedContainers: "Tracked Containers",
      overdueLabel: "Overdue",
      confirmed: "Confirmed",
      viewAllContainers: "View All Containers",
      locationAssignmentTitle: "Location Assignment",
      warehouseLocationAssignmentStatus: "Warehouse location assignment status",
      failedLoadLocationData: "Failed to load location data",
      noBoxesInSystem: "No boxes in system",
      noLocationDataAvailable: "No location data available",
      boxesAssignedAlert:
        "Only {value}% of boxes have locations assigned. Please assign locations to improve tracking.",
      assignmentRate: "Assignment Rate",
      assigned: "Assigned",
      unassigned: "Unassigned",
      locationsAssigned: "Locations Assigned",
      needAssignment: "Need Assignment",
      boxesCount: "{count} boxes",
      viewUnassignedBoxes: "View Unassigned Boxes ({count})",
      assignLocationsImproveTracking: "Assign locations to improve inventory tracking",
      useBatchAssignmentForEfficiency: "Use batch assignment for efficiency",
      reviewWarehouseLayoutOptimization: "Review warehouse layout optimization",
    },
    suppliersPage: {
      title: "Supplier Master",
      subtitle: "Manage your supplier accounts and vendor relationships",
      createSupplier: "Create Supplier",
      searchPlaceholder: "Search suppliers...",
      statusPlaceholder: "Status",
      allStatus: "All Status",
      statusActive: "Active",
      statusInactive: "Inactive",
      statusBlacklisted: "Blacklisted",
      code: "Code",
      supplier: "Supplier",
      contactPerson: "Contact Person",
      contactInfo: "Contact Info",
      location: "Location",
      paymentTerms: "Payment Terms",
      creditLimit: "Credit Limit",
      balance: "Balance",
      status: "Status",
      actions: "Actions",
      loadError: "Error loading suppliers. Please try again.",
      emptyTitle: "No suppliers found",
      emptyDescription: "Create your first supplier to get started.",
      paymentCod: "COD",
      paymentNet7: "Net 7",
      paymentNet15: "Net 15",
      paymentNet30: "Net 30",
      paymentNet45: "Net 45",
      paymentNet60: "Net 60",
      paymentNet90: "Net 90",
      editSupplier: "Edit supplier",
      deleteSupplier: "Delete supplier",
      deleteTitle: "Delete Supplier",
      deleteDescription:
        "Are you sure you want to delete {name}? This action cannot be undone. The supplier will be permanently removed from the system.",
      cancel: "Cancel",
      deleting: "Deleting...",
      delete: "Delete",
      deleteSuccess: "Supplier deleted successfully",
      deleteError: "Failed to delete supplier",
    },
    supplierForm: {
      editTitle: "Edit Supplier",
      createTitle: "Create New Supplier",
      editDescription: "Update the supplier information below",
      createDescription: "Fill in the supplier details below to create a new supplier",
      generalTab: "General",
      billingTab: "Billing",
      shippingTab: "Shipping",
      paymentTab: "Payment",
      bankTab: "Bank Details",
      supplierCodeLabel: "Supplier Code *",
      supplierCodePlaceholder: "SUPP-001",
      languageLabel: "Language *",
      selectLanguage: "Select language",
      statusLabel: "Status *",
      selectStatus: "Select status",
      supplierNameLabel: "Supplier Name *",
      supplierNamePlaceholder: "Enter supplier name",
      contactPersonLabel: "Contact Person *",
      contactPersonPlaceholder: "Enter contact person name",
      emailLabel: "Email *",
      emailPlaceholder: "supplier@email.com",
      phoneLabel: "Phone *",
      phonePlaceholder: "+63-2-8123-4567",
      mobileLabel: "Mobile",
      mobilePlaceholder: "+63-917-123-4567",
      websiteLabel: "Website",
      websitePlaceholder: "www.supplier.com",
      taxIdLabel: "Tax ID",
      taxIdPlaceholder: "TIN-123-456-789-000",
      billingAddressLabel: "Address *",
      shippingAddressLabel: "Address",
      addressPlaceholder: "Street address",
      cityLabel: "City *",
      cityPlaceholder: "City",
      stateLabel: "State/Province *",
      statePlaceholder: "State",
      postalCodeLabel: "Postal Code *",
      postalCodePlaceholder: "Postal code",
      countryLabel: "Country *",
      selectCountry: "Select country",
      sameAsBilling: "Same as billing address",
      paymentTermsLabel: "Payment Terms *",
      selectPaymentTerms: "Select payment terms",
      creditLimitLabel: "Credit Limit",
      creditLimitPlaceholder: "0.00",
      notesLabel: "Notes",
      notesPlaceholder: "Additional notes about this supplier",
      bankNameLabel: "Bank Name",
      bankNamePlaceholder: "Bank name",
      bankAccountNameLabel: "Account Name",
      bankAccountNamePlaceholder: "Account holder name",
      bankAccountNumberLabel: "Account Number",
      bankAccountNumberPlaceholder: "Account number",
      cancel: "Cancel",
      saving: "Saving...",
      updateAction: "Update Supplier",
      createAction: "Create Supplier",
      updateSuccess: "Supplier updated successfully",
      createSuccess: "Supplier created successfully",
      updateError: "Failed to update supplier",
      createError: "Failed to create supplier",
      missingCompanyInfo: "User company information not available",
      statusActive: "Active",
      statusInactive: "Inactive",
      statusBlacklisted: "Blacklisted",
      languageEnglish: "English",
      languageChinese: "Chinese",
      paymentCod: "Cash on Delivery",
      paymentNet7: "Net 7",
      paymentNet15: "Net 15",
      paymentNet30: "Net 30",
      paymentNet45: "Net 45",
      paymentNet60: "Net 60",
      paymentNet90: "Net 90",
      countryPhilippines: "Philippines",
      countryUsa: "USA",
      countryChina: "China",
      countryJapan: "Japan",
      countrySingapore: "Singapore",
      countryMalaysia: "Malaysia",
      countryThailand: "Thailand",
    },
    supplierValidation: {
      codeRequired: "Supplier code is required",
      nameRequired: "Supplier name is required",
      contactPersonRequired: "Contact person is required",
      invalidEmail: "Invalid email address",
      phoneRequired: "Phone number is required",
      billingAddressRequired: "Billing address is required",
      cityRequired: "City is required",
      stateRequired: "State is required",
      postalCodeRequired: "Postal code is required",
      countryRequired: "Country is required",
      creditLimitMin: "Credit limit must be zero or greater",
    },
    stockRequisitionsPage: {
      title: "Stock Requisitions",
      subtitle: "Manage stock requisitions for your suppliers",
      createAction: "Create Stock Requisition",
      searchPlaceholder: "Search by SR number or notes...",
      statusPlaceholder: "Status",
      supplierPlaceholder: "Supplier",
      allStatus: "All Status",
      allSuppliers: "All Suppliers",
      draft: "Draft",
      submitted: "Submitted",
      partiallyFulfilled: "Partially Fulfilled",
      fulfilled: "Fulfilled",
      cancelled: "Cancelled",
      srNumber: "SR Number",
      supplier: "Supplier",
      requisitionDate: "Requisition Date",
      requiredBy: "Required By",
      totalAmount: "Total Amount",
      status: "Status",
      createdBy: "Created By",
      actions: "Actions",
      loadError: "Error loading stock requisitions. Please try again.",
      emptyTitle: "No stock requisitions found",
      emptyDescription: "Create your first stock requisition to get started.",
      view: "View",
      edit: "Edit",
      delete: "Delete",
      deleteTitle: "Delete Stock Requisition",
      deleteDescription:
        "Are you sure you want to delete {number}? This action cannot be undone. The stock requisition will be permanently removed from the system.",
      cancel: "Cancel",
      deleting: "Deleting...",
      deleteSuccess: "Stock Requisition deleted successfully",
      deleteError: "Failed to delete stock requisition",
      noValue: "--",
    },
    stockRequisitionForm: {
      editTitle: "Edit Stock Requisition",
      createTitle: "New Stock Requisition",
      editDescription: "Update requisition details and modify line items",
      createDescription:
        "Create a new requisition by filling in supplier details and adding items",
      generalTab: "General",
      itemsTab: "Items",
      basicInformation: "Basic Information",
      supplierLabel: "Supplier *",
      selectSupplier: "Select supplier",
      requisitionDateLabel: "Requisition Date *",
      requiredByDateLabel: "Required By Date",
      notesLabel: "Notes",
      notesPlaceholder: "Add any additional notes or comments...",
      addItemsTitle: "Add Items to Stock Requisition",
      itemLabel: "Item *",
      selectItem: "Select an item",
      searchItemPlaceholder: "Search item...",
      searchItemByCodeOrName: "Search by code or name...",
      noItemFound: "No item found.",
      quantityLabel: "Quantity *",
      quantityPlaceholder: "0",
      unitPriceLabel: "Unit Price *",
      unitPricePlaceholder: "0.00",
      addItem: "Add Item",
      addItemMissingFields: "Please select an item and enter quantity and price",
      itemNotFound: "Item not found",
      itemAddedSuccess: "Item added successfully",
      lineItemsRequired: "Please add at least one line item",
      saveError: "Failed to save stock requisition",
      itemsTitle: "Stock Requisition Items",
      itemSingular: "item",
      itemPlural: "items",
      totalAmount: "Total Amount",
      itemCode: "ITEM CODE",
      itemName: "ITEM NAME",
      qty: "QTY",
      unitPrice: "UNIT PRICE",
      total: "TOTAL",
      noItemsTitle: "No items added yet",
      noItemsDescription:
        "Start by selecting an item, entering quantity and price, then click \"Add Item\"",
      footerSummary: "{count} {label} • Total: {total}",
      saving: "Saving...",
      cancel: "Cancel",
      updateAction: "Update Stock Requisition",
      createAction: "Create Stock Requisition",
      updateSuccess: "Stock Requisition updated successfully",
      createSuccess: "Stock Requisition created successfully",
      noActiveItems: "No active items available",
    },
    stockRequisitionValidation: {
      supplierRequired: "Supplier is required",
      requisitionDateRequired: "Requisition date is required",
    },
    stockRequisitionDetailPage: {
      title: "Stock Requisition",
      downloadPdf: "Download PDF",
      edit: "Edit",
      send: "Send",
      cancel: "Cancel",
      loadError: "Failed to load stock requisition.",
      notFound: "Stock requisition not found.",
      requisitionDetails: "Requisition Details",
      status: "Status:",
      supplier: "Supplier:",
      contact: "Contact:",
      businessUnit: "Business Unit:",
      createdBy: "Created By:",
      requisitionDate: "Requisition Date:",
      requiredByDate: "Required By Date:",
      totalAmount: "Total Amount:",
      notes: "Notes:",
      lineItems: "Line Items",
      itemCode: "Item Code",
      itemName: "Item Name",
      requestedQty: "Requested Qty",
      fulfilledQty: "Fulfilled Qty",
      outstandingQty: "Outstanding Qty",
      unitPrice: "Unit Price",
      total: "Total",
      noLineItems: "No line items found",
      sendTitle: "Send Stock Requisition",
      sendDescription:
        "Are you sure you want to send this stock requisition? Once sent, it cannot be edited.",
      sending: "Sending...",
      cancelTitle: "Cancel Stock Requisition",
      cancelDescription:
        "Are you sure you want to cancel this stock requisition? This action cannot be undone.",
      cancelBack: "No, go back",
      cancelling: "Cancelling...",
      confirmCancel: "Yes, cancel",
      submitSuccess: "Stock Requisition submitted successfully",
      submitError: "Failed to submit stock requisition",
      cancelSuccess: "Stock Requisition cancelled successfully",
      cancelError: "Failed to cancel stock requisition",
      pdfSuccess: "PDF downloaded successfully",
      pdfError: "Failed to generate PDF",
      unknownSupplier: "Unknown Supplier",
      unknownItem: "Unknown Item",
      na: "N/A",
      draft: "Draft",
      submitted: "Submitted",
      partiallyFulfilled: "Partially Fulfilled",
      fulfilled: "Fulfilled",
      cancelled: "Cancelled",
      noValue: "--",
    },
    purchaseOrdersPage: {
      title: "Purchase Orders",
      subtitle: "Manage purchase orders from suppliers",
      createAction: "Create Purchase Order",
      searchPlaceholder: "Search purchase orders...",
      statusPlaceholder: "Status",
      allStatus: "All Status",
      draft: "Draft",
      submitted: "Submitted",
      approved: "Approved",
      inTransit: "In Transit",
      partiallyReceived: "Partially Received",
      received: "Received",
      cancelled: "Cancelled",
      loadError: "Error loading purchase orders. Please try again.",
      emptyTitle: "No purchase orders found",
      emptyDescription: "Create your first purchase order to get started.",
      poNumber: "PO Number",
      supplier: "Supplier",
      orderDate: "Order Date",
      expectedDelivery: "Expected Delivery",
      status: "Status",
      totalAmount: "Total Amount",
      actions: "Actions",
      view: "View",
      edit: "Edit",
      submit: "Submit",
      approve: "Approve",
      cancel: "Cancel",
      delete: "Delete",
      receiveGoods: "Receive Goods",
      complete: "Complete",
      submitTitle: "Submit Purchase Order",
      submitDescription:
        "Are you sure you want to submit {code}? Once submitted, the order will require approval before processing.",
      submitting: "Submitting...",
      approveTitle: "Approve Purchase Order",
      approveDescription:
        "Are you sure you want to approve {code}? Once approved, the order can be processed and received.",
      approving: "Approving...",
      cancelTitle: "Cancel Purchase Order",
      cancelDescription:
        "Are you sure you want to cancel {code}? This action cannot be undone and the order will be marked as cancelled.",
      goBack: "Go Back",
      cancelling: "Cancelling...",
      cancelOrder: "Cancel Order",
      completeTitle: "Complete Purchase Order",
      completeDescription:
        "Mark {code} as received? This will close the order even if it is partially received.",
      completing: "Completing...",
      deleteTitle: "Delete Purchase Order",
      deleteDescription:
        "Are you sure you want to delete {code}? This action cannot be undone and the order will be permanently removed from the system.",
      deleting: "Deleting...",
      submitSuccess: "Purchase order submitted successfully",
      submitError: "Failed to submit purchase order",
      approveSuccess: "Purchase order approved successfully",
      approveError: "Failed to approve purchase order",
      cancelSuccess: "Purchase order cancelled successfully",
      cancelError: "Failed to cancel purchase order",
      completeSuccess: "Purchase order marked as received",
      completeError: "Failed to complete purchase order",
      deleteSuccess: "Purchase order deleted successfully",
      deleteError: "Failed to delete purchase order",
    },
    purchaseOrderForm: {
      editTitle: "Edit Purchase Order",
      createTitle: "Create New Purchase Order",
      editDescription: "Update purchase order details and line items.",
      createDescription: "Fill in the purchase order details and add line items.",
      generalTab: "General",
      itemsTab: "Line Items ({count})",
      notesTab: "Notes",
      generalTabError: "Please fill in all required fields in the General tab",
      supplierLabel: "Supplier *",
      selectSupplier: "Select a supplier",
      orderDateLabel: "Order Date *",
      expectedDeliveryDateLabel: "Expected Delivery Date *",
      deliveryAddressTitle: "Delivery Address",
      streetAddressLabel: "Street Address *",
      streetAddressPlaceholder: "Street address",
      cityLabel: "City *",
      cityPlaceholder: "City",
      stateLabel: "State/Province *",
      statePlaceholder: "State",
      postalCodeLabel: "Postal Code *",
      postalCodePlaceholder: "Postal code",
      countryLabel: "Country *",
      countryPlaceholder: "Country",
      lineItemsTitle: "Line Items",
      lineItemsDescription: "Manage items to purchase in this order",
      addItem: "Add Item",
      noItemsTitle: "No items added yet.",
      noItemsDescription: "Click \"Add Item\" to get started.",
      item: "Item",
      qty: "Qty",
      unit: "Unit",
      rate: "Rate",
      discount: "Disc %",
      tax: "Tax %",
      total: "Total",
      actions: "Actions",
      totalsTitle: "Totals",
      subtotal: "Subtotal:",
      discountAmount: "Discount:",
      taxAmount: "Tax:",
      totalAmount: "Total:",
      internalNotes: "Internal Notes",
      cancel: "Cancel",
      saving: "Saving...",
      updateAction: "Update Purchase Order",
      createAction: "Create Purchase Order",
      lineItemsRequired: "Please add at least one line item",
      updateSuccess: "Purchase order updated successfully",
      createSuccess: "Purchase order created successfully",
      updateError: "Failed to update purchase order",
      createError: "Failed to create purchase order",
      noUnit: "—",
    },
    purchaseOrderLineItemDialog: {
      editTitle: "Edit Line Item",
      createTitle: "Add Line Item",
      editDescription: "Update the line item details.",
      createDescription: "Fill in the details for the new line item.",
      itemLabel: "Item *",
      selectItem: "Select an item",
      searchItem: "Search item...",
      searchByCodeOrName: "Search by code or name...",
      noItemFound: "No item found.",
      onHand: "On hand",
      available: "Available",
      quantityLabel: "Quantity *",
      rateLabel: "Rate *",
      discountLabel: "Discount %",
      taxLabel: "Tax %",
      subtotal: "Subtotal:",
      discount: "Discount:",
      tax: "Tax:",
      lineTotal: "Line Total:",
      cancel: "Cancel",
      updateAction: "Update Item",
      createAction: "Add Item",
    },
    purchaseOrderViewDialog: {
      title: "Purchase Order Details",
      orderCode: "PO #{code}",
      supplierInformation: "Supplier Information",
      name: "Name:",
      code: "Code:",
      email: "Email:",
      phone: "Phone:",
      orderDetails: "Order Details",
      orderDate: "Order Date:",
      expectedDelivery: "Expected Delivery:",
      approvedOn: "Approved On:",
      na: "N/A",
      deliveryAddress: "Delivery Address",
      lineItems: "Line Items",
      item: "Item",
      quantity: "Quantity",
      unit: "Unit",
      rate: "Rate",
      discount: "Discount",
      tax: "Tax",
      total: "Total",
      received: "Received",
      subtotal: "Subtotal:",
      taxAmount: "Tax:",
      discountAmount: "Discount:",
      totalAmount: "Total:",
      notes: "Notes",
      goodsReceived: "Goods Received ({count})",
      receivedOn: "Received on {date}",
      atWarehouse: " at {warehouse}",
      supplierInvoice: "Supplier Invoice: {number}",
      supplierInvoiceWithDate: "Supplier Invoice: {number} ({date})",
      ordered: "Ordered",
      close: "Close",
      print: "Print",
      draft: "Draft",
      submitted: "Submitted",
      approved: "Approved",
      inTransit: "In Transit",
      partiallyReceived: "Partially Received",
      receivedStatus: "Received",
      cancelled: "Cancelled",
      noUnit: "—",
    },
    receiveGoodsDialog: {
      title: "Receive Goods",
      description: "Receive items from Purchase Order {code}",
      supplier: "Supplier",
      orderDate: "Order Date",
      expectedDelivery: "Expected Delivery",
      status: "Status",
      warehouseLabel: "Warehouse *",
      selectWarehouse: "Select warehouse",
      locationLabel: "Location",
      selectLocation: "Select location",
      selectWarehouseFirst: "Select warehouse first",
      receiptDateLabel: "Receipt Date *",
      supplierInvoiceNumberLabel: "Supplier Invoice Number",
      supplierInvoiceNumberPlaceholder: "INV-001",
      supplierInvoiceDateLabel: "Supplier Invoice Date",
      batchLabel: "Batch",
      batchPlaceholder: "Batch reference",
      itemsToReceive: "Items to Receive",
      item: "Item",
      ordered: "Ordered",
      alreadyReceived: "Already Received",
      remaining: "Remaining",
      receiveNow: "Receive Now *",
      notesLabel: "Notes",
      notesPlaceholder: "Any notes about the receipt...",
      fixErrors: "Please fix the following errors:",
      itemError: "Item {index}: {message}",
      receiveAction: "Receive Goods",
      receiving: "Receiving...",
      cancel: "Cancel",
      lineItemRequired: "Please enter quantities to receive for at least one item",
      success: "Goods received successfully! Stock levels updated.",
      error: "Failed to receive goods",
      draft: "Draft",
      submitted: "Submitted",
      approved: "Approved",
      inTransit: "In Transit",
      partiallyReceived: "Partially Received",
      received: "Received",
      cancelled: "Cancelled",
    },
    purchaseOrderValidation: {
      supplierRequired: "Supplier is required",
      orderDateRequired: "Order date is required",
      expectedDeliveryDateRequired: "Expected delivery date is required",
      deliveryAddressRequired: "Delivery address is required",
      cityRequired: "City is required",
      stateRequired: "State is required",
      countryRequired: "Country is required",
      postalCodeRequired: "Postal code is required",
      itemRequired: "Item is required",
      quantityMin: "Quantity must be greater than 0",
      rateMin: "Rate cannot be negative",
      uomRequired: "Unit of measure is required",
      warehouseRequired: "Warehouse is required",
      receiptDateRequired: "Receipt date is required",
      quantityNonNegative: "Quantity cannot be negative",
    },
    purchaseReceiptsPage: {
      title: "Purchase Receipts",
      subtitle: "Receive and manage incoming goods from purchase orders",
      searchPlaceholder: "Search receipts...",
      statusPlaceholder: "Status",
      allStatus: "All Status",
      draft: "Draft",
      received: "Received",
      cancelled: "Cancelled",
      receiptCode: "Receipt Code",
      purchaseOrder: "Purchase Order",
      supplier: "Supplier",
      warehouse: "Warehouse",
      batch: "Batch",
      receiptDate: "Receipt Date",
      totalValue: "Total Value",
      status: "Status",
      actions: "Actions",
      loadError: "Error loading purchase receipts. Please try again.",
      emptyTitle: "No purchase receipts found",
      emptyDescription: "Receive goods from approved purchase orders to get started.",
      batchPrefix: "Batch: {batch}",
      noValue: "--",
      view: "View",
      delete: "Delete",
      deleteTitle: "Delete Receipt",
      deleteDescription:
        "Are you sure you want to delete {code}? This action cannot be undone. The receipt will be permanently removed from the system.",
      cancel: "Cancel",
      deleting: "Deleting...",
      deleteSuccess: "Receipt deleted successfully",
      deleteError: "Failed to delete receipt",
    },
    purchaseReceiptViewDialog: {
      title: "Purchase Receipt Details",
      receiptCode: "GRN #{code}",
      supplierInformation: "Supplier Information",
      name: "Name:",
      code: "Code:",
      receiptDetails: "Receipt Details",
      purchaseOrder: "Purchase Order:",
      receiptDate: "Receipt Date:",
      batch: "Batch:",
      warehouse: "Warehouse:",
      supplierInvoice: "Supplier Invoice",
      invoiceNumber: "Invoice Number:",
      invoiceDate: "Invoice Date:",
      receivedItems: "Received Items",
      item: "Item",
      ordered: "Ordered",
      received: "Received",
      unit: "Unit",
      rate: "Rate",
      totalValue: "Total Value",
      notes: "Notes",
      close: "Close",
      print: "Print GRN",
      draft: "Draft",
      receivedStatus: "Received",
      cancelled: "Cancelled",
      noUnit: "—",
      noValue: "—",
    },
    purchaseReceiptDetailPage: {
      receiptNotFound: "Receipt Not Found",
      receiptNotFoundDescription: "The goods receipt you're looking for doesn't exist.",
      goodsReceiptDetails: "Goods Receipt Details",
      print: "Print",
      export: "Export",
      receiptInformation: "Receipt Information",
      receiptId: "Receipt ID",
      status: "Status",
      purchaseOrder: "Purchase Order",
      receivedBy: "Received By",
      receiptDate: "Receipt Date",
      deliveryDate: "Delivery Date",
      batch: "Batch",
      warehouse: "Warehouse",
      notes: "Notes",
      supplierInformation: "Supplier Information",
      supplierName: "Supplier Name",
      supplierCode: "Supplier Code",
      address: "Address",
      contact: "Contact",
      totalItems: "Total Items",
      orderedQuantity: "Ordered Quantity",
      receivedQuantity: "Received Quantity",
      ofTotal: "of total",
      totalValue: "Total Value",
      receiptItems: "Receipt Items",
      receiptItemsDescription: "Items included in this goods receipt",
      productCode: "Product Code",
      productName: "Product Name",
      orderedQty: "Ordered Qty",
      receivedQty: "Received Qty",
      unit: "Unit",
      unitPrice: "Unit Price",
      totalPrice: "Total Price",
      completed: "Completed",
      partial: "Partial",
      pending: "Pending",
      received: "Received",
      noValue: "—",
    },
    reportsPage: {
      title: "Reports Directory",
      subtitle: "Comprehensive reporting suite for business intelligence and operational insights",
      totalReports: "Total Reports",
      totalReportsDescription: "Across {count} categories",
      availableNow: "Available Now",
      availableNowDescription: "Ready to use",
      comingSoon: "Coming Soon",
      comingSoonDescription: "In our roadmap",
      searchPlaceholder: "Search reports...",
      allReports: "All Reports",
      available: "Available",
      inDevelopment: "In Development",
      openReport: "Open Report",
      valueLabel: "Value",
      noReportsFound: "No reports found",
      noReportsFoundDescription: "Try adjusting your search query",
      roadmapTitle: "Report Development Roadmap",
      roadmapDescription:
        "We're continuously expanding our reporting capabilities. Reports marked as \"Coming Soon\" are prioritized based on business impact and will be delivered in phases over the next 12-15 months. Critical and high-priority reports will be implemented first.",
      inventoryName: "Inventory & Warehouse",
      inventoryDescription: "Optimize stock levels, reduce waste, and improve warehouse efficiency",
      stockReportsName: "Stock Reports",
      stockReportsDescription:
        "Stock movement and valuation analysis with comprehensive inventory metrics",
      stockReportsValue: "Complete inventory visibility",
      stockAgingName: "Stock Aging Report",
      stockAgingDescription:
        "Identify slow-moving and obsolete inventory to optimize working capital",
      stockAgingValue: "15-25% reduction in obsolete inventory",
      abcAnalysisName: "ABC Analysis Report",
      abcAnalysisDescription: "Classify inventory by value contribution using Pareto principle",
      abcAnalysisValue: "20-30% improvement in inventory management efficiency",
      stockTurnoverName: "Stock Turnover Report",
      stockTurnoverDescription:
        "Measure inventory efficiency and identify capital utilization opportunities",
      stockTurnoverValue: "10-15% improvement in cash flow",
      reorderAnalysisName: "Reorder Point Analysis",
      reorderAnalysisDescription:
        "Optimize reorder levels to prevent stockouts while minimizing excess inventory",
      reorderAnalysisValue: "30-50% reduction in stockouts",
      warehouseUtilizationName: "Warehouse Space Utilization",
      warehouseUtilizationDescription:
        "Optimize warehouse layout, capacity planning, and picking efficiency",
      warehouseUtilizationValue: "15-20% improvement in picking efficiency",
      stockVarianceName: "Stock Variance Report (Cycle Count)",
      stockVarianceDescription:
        "Track accuracy between system and physical stock, identify shrinkage",
      stockVarianceValue: "95%+ inventory accuracy",
      batchTraceabilityName: "Batch/Serial Traceability",
      batchTraceabilityDescription:
        "Full lineage tracking for recalls, quality control, and compliance",
      batchTraceabilityValue: "Critical for quality control and regulatory compliance",
      itemLocationBatchName: "Item Location (Location + Batch)",
      itemLocationBatchDescription:
        "Exact stock balances by warehouse location and batch, including location batch SKU",
      itemLocationBatchValue:
        "Operational visibility for picking, putaway, and batch control",
      financialName: "Financial & Profitability",
      financialDescription: "Complete financial statements and profitability analysis",
      plStatementName: "Profit & Loss Statement",
      plStatementDescription: "Standard financial performance report showing profitability",
      plStatementValue: "Core financial reporting requirement",
      balanceSheetName: "Balance Sheet",
      balanceSheetDescription:
        "Financial position snapshot showing assets, liabilities, and equity",
      balanceSheetValue: "Financial health assessment",
      cashFlowName: "Cash Flow Statement",
      cashFlowDescription: "Track cash movements and liquidity management",
      cashFlowValue: "Liquidity management and funding planning",
      arAgingName: "Accounts Receivable Aging",
      arAgingDescription: "Track customer payment performance and manage collections",
      arAgingValue: "20-30% reduction in DSO",
      apAgingName: "Accounts Payable Aging",
      apAgingDescription:
        "Manage supplier payment obligations and optimize payment timing",
      apAgingValue: "5-10% improvement in working capital",
      salesProfitabilityName: "Sales Profitability Report",
      salesProfitabilityDescription:
        "True profit analysis by invoice, customer, item, and employee",
      salesProfitabilityValue: "15-25% improvement in overall margin",
      cogsAnalysisName: "COGS Analysis Report",
      cogsAnalysisDescription:
        "Detailed cost of goods sold breakdown and variance analysis",
      cogsAnalysisValue: "Better cost control and pricing decisions",
      purchasingName: "Purchasing & Suppliers",
      purchasingDescription: "Supplier performance tracking and procurement optimization",
      supplierScorecardName: "Supplier Performance Scorecard",
      supplierScorecardDescription:
        "Evaluate supplier reliability and performance for better sourcing",
      supplierScorecardValue: "10-20% improvement in supplier reliability",
      poVarianceName: "PO vs Receipt Variance",
      poVarianceDescription: "Track order fulfillment accuracy and pricing compliance",
      poVarianceValue: "Better supplier accountability",
      supplierSpendName: "Supplier Spend Analysis",
      supplierSpendDescription:
        "Understand purchasing patterns and optimize supplier relationships",
      supplierSpendValue: "5-15% reduction in procurement costs",
      priceVarianceName: "Purchase Price Variance",
      priceVarianceDescription: "Monitor cost changes and control procurement budget",
      priceVarianceValue: "Cost control and budgeting",
      shipmentsReportName: "Shipments Report",
      shipmentsReportDescription:
        "Track inbound shipments by incoming, in transit, and arrived status within purchasing",
      shipmentsReportValue: "Real-time visibility across supplier deliveries",
      operationsName: "Operations & Logistics",
      operationsDescription: "Operational efficiency and delivery performance metrics",
      deliveryPerformanceName: "Delivery Performance Dashboard",
      deliveryPerformanceDescription: "Monitor logistics efficiency and delivery reliability",
      deliveryPerformanceValue: "20-35% improvement in delivery performance",
      pickingEfficiencyName: "Picking Efficiency Report",
      pickingEfficiencyDescription:
        "Measure warehouse picking productivity and accuracy",
      pickingEfficiencyValue: "25-40% improvement in picking productivity",
      stockTransferName: "Stock Transfer Analysis",
      stockTransferDescription:
        "Understand inter-warehouse movements and optimize stocking levels",
      stockTransferValue: "20-40% reduction in inter-warehouse transfers",
      transformationEfficiencyName: "Transformation Efficiency",
      transformationEfficiencyDescription:
        "Monitor manufacturing/processing operations and optimize yields",
      transformationEfficiencyValue: "10-25% improvement in yield",
      rtsAnalysisName: "Return to Supplier Analysis",
      rtsAnalysisDescription:
        "Track quality issues and manage supplier accountability",
      rtsAnalysisValue: "Improve supplier quality",
      executiveName: "Executive Dashboards",
      executiveDescription: "High-level business overview and strategic insights",
      executiveSummaryName: "Executive Summary Dashboard",
      executiveSummaryDescription:
        "One-page business overview for executive decision-making",
      executiveSummaryValue: "Quick executive decision-making",
      periodComparisonName: "Period-over-Period Comparison",
      periodComparisonDescription: "Track business growth and identify trends",
      periodComparisonValue: "Understand business trajectory",
      budgetActualName: "Budget vs Actual Report",
      budgetActualDescription:
        "Financial planning and control through budget tracking",
      budgetActualValue: "Financial discipline and control",
      auditName: "Audit & Compliance",
      auditDescription: "System activity tracking and compliance reporting",
      auditTrailName: "Audit Trail Report",
      auditTrailDescription:
        "Track all system changes for security, compliance, and investigation",
      auditTrailValue: "Security monitoring and compliance",
      documentStatusName: "Document Status Tracking",
      documentStatusDescription:
        "Monitor document workflow compliance and identify bottlenecks",
      documentStatusValue: "Process efficiency improvement",
      userActivityName: "User Activity Report",
      userActivityDescription:
        "Monitor system usage for license optimization and security",
      userActivityValue: "License optimization and security",
      predictiveName: "Predictive Analytics",
      predictiveDescription:
        "Forecasting and scenario planning for strategic decisions",
      demandForecastName: "Demand Forecasting Report",
      demandForecastDescription:
        "Predict future sales for proactive inventory planning",
      demandForecastValue: "20-30% inventory optimization",
      whatIfName: "What-If Analysis Tools",
      whatIfDescription: "Scenario planning and strategic decision support",
      whatIfValue: "Strategic decision-making",
    },
    stockReportsPage: {
      title: "Stock Reports",
      subtitle:
        "Comprehensive inventory reports for movement and valuation analysis",
      movementTab: "Stock Movement",
      valuationTab: "Stock Valuation",
      filters: "Filters",
      startDate: "Start Date",
      endDate: "End Date",
      groupBy: "Group By",
      warehouse: "Warehouse",
      item: "Item",
      itemSearch: "Item Search",
      category: "Category",
      allWarehouses: "All Warehouses",
      allItems: "All Items",
      allCategories: "All Categories",
      searchPlaceholder: "Search item code, item name, SKU, or batch...",
      byItem: "By Item",
      byWarehouse: "By Warehouse",
      byItemWarehouse: "By Item & Warehouse",
      byCategory: "By Category",
      totalIn: "Total IN",
      totalOut: "Total OUT",
      netMovement: "Net Movement",
      transactions: "Transactions",
      periodComparison: "Period Comparison",
      movementDetails: "Movement Details",
      noMovements: "No movements found for the selected period",
      inQty: "IN Qty",
      outQty: "OUT Qty",
      net: "Net",
      inValue: "IN Value",
      outValue: "OUT Value",
      netValue: "Net Value",
      totalStockValue: "Total Stock Value",
      currentValuation: "Current valuation",
      totalQtyOnHand: "Total Qty On Hand",
      activeLines: "Active inventory lines",
      avgUnitCost: "Avg Unit Cost",
      weightedAverage: "Weighted average",
      totalGroups: "Total Groups",
      groupedView: "Grouped view count",
      valuationDetails: "Valuation Details",
      noValuation: "No valuation data found for the selected filters",
      qtyOnHand: "Qty On Hand",
      unitCost: "Unit Cost",
      totalValue: "Total Value",
      lines: "lines",
      items: "items",
      warehouses: "warehouses",
      loadError: "Failed to load stock report data.",
    },
    stockAgingReportPage: {
      title: "Stock Aging Report",
      subtitle:
        "Identify aging stock by exact warehouse location and batch within the current business unit.",
      filters: "Filters",
      warehouse: "Warehouse",
      item: "Item",
      itemSearch: "Item Search",
      category: "Category",
      allWarehouses: "All Warehouses",
      allItems: "All Items",
      allCategories: "All Categories",
      searchPlaceholder: "Search item code, item name, SKU, or batch...",
      exportPdf: "Export PDF",
      exportingPdf: "Exporting PDF...",
      generatedAt: "Generated At",
      ageBucket: "Age Bucket",
      allAges: "All Ages",
      bucket90Plus: "90+ Days",
      rowsPerPage: "Rows / Page",
      ageDays: "Age Days",
      qtyOnHand: "Qty On Hand",
      qtyReserved: "Qty Reserved",
      qtyAvailable: "Qty Available",
      receivedAt: "Received At",
      updatedAt: "Updated At",
      agingRows: "Aging Rows",
      stockValue: "Stock Value",
      locationSku: "Location SKU",
      oldestStock: "Oldest Stock",
      agingRowsDescription: "Grouped location-batch aging rows.",
      qtyOnHandDescription: "Current on-hand quantity in scope.",
      stockValueDescription: "Estimated value at current item cost.",
      locationsAndBatches: "{locations} locations • {batches} batches",
      availableQtyCaption: "{qty} available qty",
      aged90PlusCaption: "{count} rows • {qty} qty over 90 days",
      daysValue: "{value} days",
      agingDetails: "Aging Details",
      bucket0to30: "0-30",
      bucket31to60: "31-60",
      bucket61to90: "61-90",
      bucket91to180: "91-180",
      bucket181Plus: "181+",
      totalQty: "Total Qty",
      totalValue: "Total Value",
      avgAgeDays: "Avg Age",
      oldestAgeDays: "Oldest",
      warehouseLocation: "Warehouse / Location",
      batch: "Batch",
      noRows: "No stock aging data found for the selected filters.",
      pageOfTotal: "Page {page} of {totalPages} • {total} total rows",
      previous: "Previous",
      next: "Next",
      noValue: "--",
      unknown: "Unknown",
      reset: "Reset",
      loadError: "Failed to load stock aging report.",
      warehousesCaption: "{count} warehouses covered",
      rowsCaption: "{count} grouped rows",
      agingBasedOnReceiptDate: "Aging is based on batch receipt date.",
      currentBusinessUnitScope: "Scoped to the current business unit.",
      locationBatchGranularity: "Each row represents one location-batch stock balance.",
      itemSubtotal: "Item Subtotal",
      oldestStockForItem: "Oldest in item: {value} days",
      batchesCount: "{count} batches",
    },
    shipmentsReportPage: {
      title: "Shipments Report",
      subtitle:
        "Track inbound purchasing shipments by supplier, container, and stage within the current business unit.",
      exportPdf: "Export PDF",
      exportingPdf: "Exporting PDF...",
      generatedAt: "Generated At",
      filters: "Filters",
      search: "Search",
      searchPlaceholder:
        "Search load list, supplier reference, container, seal, batch, or liner...",
      supplier: "Supplier",
      shipmentStage: "Status",
      allSuppliers: "All Suppliers",
      allStages: "All Stages",
      incoming: "Loading",
      inTransit: "In Transit",
      arrived: "Arrived",
      rowsPerPage: "Rows / Page",
      reset: "Reset",
      totalShipments: "Total Shipments",
      totalShipmentsDescription: "Matching load lists in the current scope.",
      containers: "Containers",
      containersDescription: "Shipments on this page with a recorded container.",
      totalQuantity: "Total Quantity",
      totalQuantityDescription: "Current page shipment quantity.",
      totalValue: "Total Value",
      totalValueDescription: "Current page shipment value.",
      shipments: "Shipments",
      loadList: "Load List",
      containerSeal: "Container / Seal",
      eta: "ETA",
      actualArrival: "Actual Arrival",
      quantity: "Quantity",
      value: "Value",
      pageOfTotal: "Page {page} of {totalPages} • {total} total shipments",
      previous: "Previous",
      next: "Next",
      noRows: "No shipments found for the selected filters.",
      noValue: "--",
      loadError: "Failed to load shipments report.",
    },
    salesAnalyticsPage: {
      title: "Sales Analytics",
      subtitle:
        "Comprehensive insights into sales performance across agents, locations, and time periods",
      overviewTab: "Overview",
      byTimeTab: "By Time",
      byEmployeeTab: "By Employee",
      byLocationTab: "By Location",
    },
    analyticsFilters: {
      dateRange: "Date Range",
      salesAgent: "Sales Agent",
      allAgents: "All agents",
      city: "City",
      allCities: "All cities",
      region: "Region",
      allRegions: "All regions",
      resetFilters: "Reset Filters",
    },
    analyticsDateRangePicker: {
      today: "Today",
      yesterday: "Yesterday",
      last7Days: "Last 7 days",
      last30Days: "Last 30 days",
      thisMonth: "This month",
      lastMonth: "Last month",
      thisYear: "This year",
      pickDateRange: "Pick a date range",
      presets: "Presets",
    },
    analyticsOverviewTab: {
      totalSales: "Total Sales",
      transactions: "{count} transactions",
      totalCommissions: "Total Commissions",
      earnedByAllAgents: "Earned by all agents",
      activeAgents: "Active Agents",
      salesAgentsWithActivity: "Sales agents with activity",
      averageOrderValue: "Average Order Value",
      perTransaction: "Per transaction",
      vsPreviousPeriod: "vs previous period",
      salesTrend: "Sales Trend",
      dailySalesPerformance: "Daily sales performance",
      noSalesData: "No sales data available",
      sales: "Sales",
      commission: "Commission",
      topSalesAgents: "Top 5 Sales Agents",
      byTotalSales: "By total sales",
      noEmployeeData: "No employee data available",
      topLocations: "Top 5 Locations",
      byTotalSalesLocations: "By total sales",
      noLocationData: "No location data available",
    },
    analyticsByTimeTab: {
      salesTrendOverTime: "Sales Trend Over Time",
      salesAndCommissionsByDate: "Sales and commissions by date",
      noSalesData: "No sales data available",
      sales: "Sales",
      commissions: "Commissions",
      transactions: "Transactions",
      salesOverTime: "Sales Over Time",
      dailySalesBreakdown: "Daily sales breakdown",
      date: "Date",
      averageOrderValue: "Avg Order Value",
      showingEntries: "Showing {from} to {to} of {total} entries",
      previous: "Previous",
      next: "Next",
      pageOf: "Page {page} of {total}",
    },
    analyticsByEmployeeTab: {
      topEmployeesBySales: "Top 10 Employees by Sales",
      salesCommissionComparison: "Sales and commission comparison",
      noEmployeeData: "No employee data available",
      sales: "Sales",
      commission: "Commission",
      commissionDistribution: "Commission Distribution",
      topEarnersByCommission: "Top 5 earners by commission",
      noCommissionData: "No commission data available",
      employeePerformanceLeaderboard: "Employee Performance Leaderboard",
      rankedByTotalSales: "Ranked by total sales",
      rank: "Rank",
      employee: "Employee",
      code: "Code",
      territory: "Territory",
      totalSales: "Total Sales",
      transactions: "Transactions",
      avgOrder: "Avg Order",
      rate: "Rate",
      noTerritory: "No territory",
      showingEntries: "Showing {from} to {to} of {total} entries",
      previous: "Previous",
      next: "Next",
      pageOf: "Page {page} of {total}",
    },
    analyticsByLocationTab: {
      topCitiesBySales: "Top 10 Cities by Sales",
      salesPerformanceByCity: "Sales performance by city",
      noLocationData: "No location data available",
      sales: "Sales",
      regionalDistribution: "Regional Distribution",
      salesByRegion: "Sales by region",
      noRegionalData: "No regional data available",
      salesByLocation: "Sales by Location",
      performanceBreakdown: "Performance breakdown by city and region",
      city: "City",
      region: "Region",
      totalSales: "Total Sales",
      transactions: "Transactions",
      avgOrderValue: "Avg Order Value",
      uniqueCustomers: "Unique Customers",
      topEmployee: "Top Employee",
      showingEntries: "Showing {from} to {to} of {total} entries",
      previous: "Previous",
      next: "Next",
      pageOf: "Page {page} of {total}",
    },
    commissionReportsPage: {
      title: "Commission Reports",
      subtitle: "Track and analyze employee commissions and earnings",
      summaryTab: "Summary",
      detailsTab: "Details",
      byPeriodTab: "By Period",
    },
    commissionSummary: {
      totalCommission: "Total Commission",
      fromTransactions: "From {count} transactions",
      totalSales: "Total Sales",
      totalSalesVolume: "Total sales volume",
      paidCommission: "Paid Commission",
      fromPaidInvoices: "From paid invoices",
      pendingCommission: "Pending Commission",
      fromUnpaidInvoices: "From unpaid invoices",
      activeEmployees: "Active Employees",
      employeesWithCommissions: "Employees with commissions",
      effectiveRate: "Effective Rate",
      averageCommissionRate: "Average commission rate",
      commissionInsights: "Commission Insights",
      keyPerformanceIndicators: "Key performance indicators",
      averageCommissionPerTransaction: "Average Commission per Transaction",
      commissionPayoutRate: "Commission Payout Rate",
      averageSalesPerTransaction: "Average Sales per Transaction",
    },
    commissionDetails: {
      paid: "Paid",
      partiallyPaid: "Partially Paid",
      sent: "Sent",
      overdue: "Overdue",
      title: "Commission Details",
      subtitle: "Detailed breakdown of all commission records",
      noRecords: "No commission records found for the selected period",
      invoice: "Invoice",
      date: "Date",
      employee: "Employee",
      invoiceAmount: "Invoice Amount",
      rate: "Rate",
      splitPct: "Split %",
      commission: "Commission",
      status: "Status",
    },
    commissionByPeriod: {
      title: "Commission by Period",
      subtitle: "Trend analysis and period comparisons (Coming soon)",
      description: "Period analysis feature will be available soon",
    },
    pickingEfficiencyReportPage: {
      title: "Picking Efficiency Report",
      subtitle:
        "Measure warehouse picking productivity and short-pick-based accuracy across pick lists.",
      filters: "Filters",
      startDate: "Start Date",
      endDate: "End Date",
      warehouse: "Warehouse",
      picker: "Picker",
      primaryTable: "Primary Table",
      allWarehouses: "All Warehouses",
      allPickers: "All Pickers",
      byPicker: "By Picker",
      byWarehouse: "By Warehouse",
      loadError: "Failed to load picking efficiency report.",
      pickLinesPerHour: "Pick Lines / Hour",
      linesInActiveHours: "{lines} lines in {hours} active hours",
      pickAccuracy: "Pick Accuracy",
      shortPickProxy: "Short-pick proxy (line-based)",
      avgPickTime: "Avg Pick Time",
      completedPickLists: "{count} completed pick lists",
      shortPickRate: "Short Pick Rate",
      shortLines: "{count} short lines",
      quantityFillRate: "Quantity Fill Rate",
      quantityFillRateDesc: "{picked} / {allocated} qty",
      pickers: "Pickers",
      observedInPeriod: "Observed in selected period",
      warehouses: "Warehouses",
      fulfillingWarehouses: "Fulfilling warehouses",
      shortQty: "Short Qty",
      totalQuantityShortPicked: "Total quantity short-picked",
      pickerPerformance: "Picker Performance",
      warehousePerformance: "Warehouse Picking Performance",
      pickerLabel: "Picker",
      warehouseLabel: "Warehouse",
      pickListsLabel: "Pick Lists",
      lines: "Lines",
      linesPerHour: "Lines/Hr",
      accuracy: "Accuracy",
      shortRate: "Short Rate",
      avgTime: "Avg Time",
      utilization: "Utilization",
      noDataForFilters: "No data for selected filters.",
      pickLists: "{count} pick lists",
      unknown: "Unknown",
      shortPickReasons: "Short Pick Reasons",
      noShortReasons: "No short-pick reasons recorded.",
      dailyTrend: "Daily Trend",
      date: "Date",
      noDailyData: "No daily data in selected period.",
      topPickers: "Top Pickers",
      noPickerData: "No picker data.",
      hoursShort: "h",
      minutesShort: "m",
      linesPerHourShort: "lph",
    },
    transformationEfficiencyReportPage: {
      title: "Transformation Efficiency",
      subtitle:
        "Monitor transformation throughput, yield, waste, cycle time, and cost variance.",
      filters: "Filters",
      startDate: "Start Date",
      endDate: "End Date",
      warehouse: "Warehouse",
      template: "Template",
      status: "Status",
      primaryTable: "Primary Table",
      allWarehouses: "All Warehouses",
      allTemplates: "All Templates",
      completed: "Completed",
      preparing: "Preparing",
      draft: "Draft",
      cancelled: "Cancelled",
      all: "All",
      byTemplate: "By Template",
      byWarehouse: "By Warehouse",
      loadError: "Failed to load transformation efficiency report.",
      orders: "Orders",
      completionRate: "{value} completion rate",
      yield: "Yield",
      outputQty: "Output {value}",
      wasteRate: "Waste Rate",
      wasteQty: "Waste {value}",
      avgCycleTime: "Avg Cycle Time",
      executionToCompletion: "Execution to completion",
      planAdherence: "Plan Adherence",
      actualVsPlanned: "Actual {actual} vs planned {planned}",
      costVariance: "Cost Variance",
      inputOutputCost: "Input {input} / Output {output}",
      templates: "Templates",
      inSelectedPeriod: "In selected period",
      warehouses: "Warehouses",
      participatingWarehouses: "Participating warehouses",
      templatePerformance: "Template Performance",
      warehousePerformance: "Warehouse Performance",
      templateLabel: "Template",
      warehouseLabel: "Warehouse",
      waste: "Waste",
      plan: "Plan",
      avgCycle: "Avg Cycle",
      variance: "Variance",
      noDataForFilters: "No data for selected filters.",
      completedSuffix: "{value} completed",
      unknown: "Unknown",
      wasteReasons: "Waste Reasons",
      noWasteReasons: "No waste reasons recorded.",
      dailyTrend: "Daily Trend",
      date: "Date",
      completion: "Completion",
      noDailyData: "No daily data in selected period.",
      hoursShort: "h",
      minutesShort: "m",
    },
    itemLocationBatchReportPage: {
      title: "Item Location (Location + Batch) Report",
      subtitle:
        "View stock balances at exact warehouse location and batch level, including location batch SKU.",
      filters: "Filters",
      warehouse: "Warehouse",
      item: "Item",
      stockStatus: "Stock Status",
      sortBy: "Sort By",
      sortOrder: "Sort Order",
      rowsPerPage: "Rows / Page",
      allWarehouses: "All Warehouses",
      allItems: "All Items",
      all: "All",
      availableOnly: "Available Only",
      reservedGtZero: "Reserved > 0",
      zeroOnHand: "Zero On Hand",
      updatedAt: "Updated At",
      qtyOnHand: "Qty On Hand",
      receivedAt: "Batch Received At",
      descending: "Descending",
      ascending: "Ascending",
      searchPlaceholder:
        "Search item, SKU, batch code, location, or location batch SKU...",
      search: "Search",
      reset: "Reset",
      loadError: "Failed to load item location batch report.",
      rows: "Rows",
      showingRows: "Showing {count} rows",
      currentPageTotal: "Current page total",
      reserved: "Reserved",
      rowsWithReservedQty: "{count} rows with reserved qty",
      available: "Available",
      dimensions: "Dimensions",
      dimensionsDesc: "{items} items • {locations} locations",
      batchesPage: "{count} batches (page)",
      locationBatchStockRows: "Location + Batch Stock Rows",
      noRows: "No rows found for selected filters.",
      warehouseLocation: "Warehouse / Location",
      batch: "Batch",
      locationSku: "Location SKU",
      onHand: "On Hand",
      updated: "Updated",
      oldDays: "{count}d old",
      pageOfTotal: "Page {page} of {totalPages} • {total} total rows",
      previous: "Previous",
      next: "Next",
      noValue: "--",
      unknown: "Unknown",
    },
    loadListsPage: {
      title: "Load Lists",
      subtitle: "Manage supplier shipments and deliveries",
      createAction: "Create Load List",
      searchPlaceholder: "Search by LL number, container, seal, batch...",
      statusPlaceholder: "Status",
      supplierPlaceholder: "Supplier",
      warehousePlaceholder: "Warehouse",
      allStatus: "All Status",
      allSuppliers: "All Suppliers",
      allWarehouses: "All Warehouses",
      draft: "Draft",
      confirmed: "Confirmed",
      inTransit: "In Transit",
      arrived: "Arrived",
      receiving: "Receiving",
      pendingApproval: "Pending Approval",
      received: "Received",
      cancelled: "Cancelled",
      llNumber: "LL Number",
      supplier: "Supplier",
      warehouse: "Warehouse",
      containerSeal: "Container / Seal",
      batch: "Batch",
      arrivalDate: "Arrival Date",
      status: "Status",
      createdBy: "Created By",
      actions: "Actions",
      supplierPrefix: "Supplier: {value}",
      estimatedPrefix: "Est: {date}",
      actualPrefix: "Act: {date}",
      loadError: "Error loading load lists. Please try again.",
      emptyTitle: "No load lists found",
      emptyDescription: "Create your first load list to get started.",
      noValue: "-",
      view: "View",
      edit: "Edit",
      delete: "Delete",
      deleteTitle: "Delete Load List",
      deleteDescription:
        "Are you sure you want to delete {code}? This action cannot be undone. The load list will be permanently removed from the system.",
      cancel: "Cancel",
      deleting: "Deleting...",
      deleteSuccess: "Load List deleted successfully",
      deleteError: "Failed to delete load list",
    },
    loadListForm: {
      editTitle: "Edit Load List",
      createTitle: "Create Load List",
      editDescription: "Update load list details and line items",
      createDescription: "Fill in the details to create a new load list",
      generalTab: "General",
      itemsTab: "Items",
      primaryInformation: "Primary Information",
      supplierLabel: "Supplier *",
      selectSupplier: "Select supplier",
      warehouseLabel: "Warehouse *",
      selectWarehouse: "Select warehouse",
      supplierLoadListNumber: "Supplier LL Number",
      supplierLoadListPlaceholder: "Supplier reference",
      containerDetails: "Container Details",
      containerNumber: "Container Number",
      containerNumberPlaceholder: "Container number",
      sealNumber: "Seal Number",
      sealNumberPlaceholder: "Seal number",
      batchNumber: "Batch Number",
      batchNumberPlaceholder: "Batch number",
      linerName: "Liner",
      linerNamePlaceholder: "Shipping line or liner",
      scheduleDetails: "Schedule Details",
      estimatedArrivalDate: "Estimated Arrival Date",
      loadDate: "Load Date",
      notes: "Notes",
      notesPlaceholder: "Add notes...",
      addItemsTitle: "Add Items",
      itemLabel: "Item *",
      selectItem: "Select item",
      searchItem: "Search item...",
      searchByCodeOrName: "Search by code or name...",
      noItemFound: "No item found.",
      quantityLabel: "Quantity *",
      quantityPlaceholder: "0",
      unitCostLabel: "Unit Cost *",
      unitCostPlaceholder: "0.00",
      addItem: "Add Item",
      addItemError: "Please select an item and enter quantity and unit cost",
      itemNotFound: "Item not found",
      lineItemsRequired: "Please add at least one line item",
      itemsTitle: "Load List Items",
      noItemsTitle: "No items added yet",
      noItemsDescription: "Start by adding items to the load list.",
      itemCode: "Item Code",
      itemName: "Item Name",
      qty: "Qty",
      unitPrice: "Unit Price",
      total: "Total",
      actions: "Actions",
      totalAmount: "Total Amount",
      cancel: "Cancel",
      saving: "Saving...",
      updateAction: "Update Load List",
      createAction: "Create Load List",
      updateSuccess: "Load List updated successfully",
      createSuccess: "Load List created successfully",
      saveError: "Failed to save load list",
    },
    linkStockRequisitionsDialog: {
      title: "Link Stock Requisitions",
      description: "Link load list items to stock requisition items to track fulfillment for {supplier}",
      outstandingTitle: "Outstanding Stock Requisitions",
      itemsAvailable: "{count} items available",
      noOutstandingItems: "No items with outstanding qty",
      noOutstandingDescription: "No items with outstanding quantity",
      noRequisitions: "No stock requisitions available for linking",
      noRequisitionsSupplier: "from supplier {supplier}",
      srItemsCount: "{count} items",
      outstandingPrefix: "Outstanding: {qty}",
      addLink: "Add Link",
      loadListItem: "Load List Item *",
      selectLoadListItem: "Select LL item",
      srItem: "SR Item *",
      selectSrItem: "Select SR item",
      quantityLabel: "Quantity *",
      quantityPlaceholder: "0",
      addLinkError: "Please select items and enter quantity",
      selectedSrItemNotFound: "Selected SR item not found",
      exceedOutstanding: "Quantity cannot exceed outstanding quantity ({qty})",
      exceedLoadListQty: "Quantity cannot exceed load list quantity ({qty})",
      linkAdded: "Link added successfully",
      linksRequired: "Please add at least one link",
      linkSuccess: "Successfully linked {count} item(s) to requisitions",
      linkError: "Failed to link requisitions",
      pendingLinks: "Pending Links",
      noLinksTitle: "No links added yet",
      noLinksDescription: "Create links between load list and requisition items.",
      llItem: "LL Item",
      srReference: "SR Reference",
      requested: "Requested",
      outstanding: "Outstanding",
      linkedQty: "Linked Qty",
      submit: "Submit Links",
      submitting: "Submitting...",
      cancel: "Cancel",
    },
    loadListDetailPage: {
      title: "Load List",
      edit: "Edit",
      confirm: "Confirm",
      linkStockRequisitions: "Link Stock Requisitions",
      markInTransit: "Mark In Transit",
      markArrived: "Mark Arrived",
      markReceived: "Mark Received",
      cancel: "Cancel",
      loadError: "Failed to load load list.",
      notFound: "Load list not found.",
      detailsTitle: "Load List Details",
      status: "Status:",
      supplier: "Supplier:",
      contact: "Contact:",
      warehouse: "Warehouse:",
      businessUnit: "Business Unit:",
      supplierLlNumber: "Supplier LL Number:",
      containerNumber: "Container Number:",
      sealNumber: "Seal Number:",
      batchNumber: "Batch Number:",
      linerName: "Liner:",
      loadDate: "Load Date:",
      estimatedArrival: "Estimated Arrival:",
      actualArrival: "Actual Arrival:",
      notes: "Notes:",
      createdBy: "Created By:",
      receivedBy: "Received By:",
      approvedBy: "Approved By:",
      lineItems: "Line Items",
      itemCode: "Item Code",
      itemName: "Item Name",
      loadListQty: "Load List Qty",
      receivedQty: "Received Qty",
      damagedQty: "Damaged Qty",
      shortageQty: "Shortage Qty",
      unitPrice: "Unit Price",
      total: "Total",
      noLineItems: "No line items found",
      confirmTitle: "Confirm Load List",
      confirmDescription: "Are you sure you want to confirm this load list? Once confirmed, items cannot be modified.",
      confirming: "Confirming...",
      inTransitTitle: "Mark as In Transit",
      inTransitDescription: "This will mark the load list as in transit and update inventory in-transit quantities.",
      estimatedArrivalDateLabel: "Estimated Arrival Date",
      linerNameLabel: "Liner",
      linerNamePlaceholder: "Shipping line or liner",
      saveAndMarkInTransit: "Save and Mark In Transit",
      updating: "Updating...",
      arrivedTitle: "Mark as Arrived",
      arrivedDescription: "This will mark the load list as arrived at the warehouse. You can then proceed with receiving.",
      receivedTitle: "Mark as Received",
      receivedDescription: "This will mark the load list as received and update inventory stock levels. This action cannot be undone.",
      cancelTitle: "Cancel Load List",
      cancelDescription: "Are you sure you want to cancel this load list? This action cannot be undone.",
      cancelBack: "No, go back",
      cancelling: "Cancelling...",
      confirmCancel: "Yes, cancel",
      statusUpdateSuccess: "Load List marked as {status}",
      statusUpdateError: "Failed to update load list status",
      draft: "Draft",
      confirmed: "Confirmed",
      inTransit: "In Transit",
      arrived: "Arrived",
      receiving: "Receiving",
      pendingApproval: "Pending Approval",
      received: "Received",
      cancelled: "Cancelled",
      noValue: "--",
    },
    loadListValidation: {
      supplierRequired: "Supplier is required",
      warehouseRequired: "Warehouse is required",
    },
    grnsPage: {
      title: "Goods Receipt Notes",
      subtitle: "Manage warehouse receiving and stock entry",
      searchPlaceholder: "Search by GRN number, container, seal number...",
      statusPlaceholder: "Status",
      warehousePlaceholder: "Warehouse",
      allStatus: "All Status",
      allWarehouses: "All Warehouses",
      draft: "Draft",
      receiving: "Receiving",
      pendingApproval: "Pending Approval",
      approved: "Approved",
      rejected: "Rejected",
      cancelled: "Cancelled",
      grnNumber: "GRN Number",
      loadList: "Load List",
      supplier: "Supplier",
      warehouse: "Warehouse",
      containerSeal: "Container / Seal",
      receivingDate: "Receiving Date",
      status: "Status",
      receivedBy: "Received By",
      actions: "Actions",
      supplierPrefix: "Supplier: {value}",
      notStarted: "Not started",
      loadError: "Error loading GRNs. Please try again.",
      emptyTitle: "No GRNs found",
      emptyDescription: "GRNs are automatically created when load lists arrive.",
      noValue: "-",
      view: "View",
      delete: "Delete",
      deleteTitle: "Delete GRN",
      deleteDescription:
        "Are you sure you want to delete {code}? This action cannot be undone. The GRN will be permanently removed from the system.",
      cancel: "Cancel",
      deleting: "Deleting...",
      deleteSuccess: "GRN deleted successfully",
      deleteError: "Failed to delete GRN",
    },
    grnDetailPage: {
      draft: "Draft",
      receiving: "Receiving",
      pendingApproval: "Pending Approval",
      approved: "Approved",
      rejected: "Rejected",
      cancelled: "Cancelled",
      loadError: "Failed to load GRN. Please try again.",
      goBack: "Go Back",
      loadListLabel: "Load List: {value}",
      saving: "Saving...",
      saveChanges: "Save Changes",
      submitting: "Submitting...",
      submitForApproval: "Submit for Approval",
      approve: "Approve",
      reject: "Reject",
      grnInformation: "GRN Information",
      grnNumber: "GRN Number",
      loadList: "Load List",
      container: "Container",
      seal: "Seal",
      batchNumber: "Batch Number",
      locationDates: "Location & Dates",
      warehouse: "Warehouse",
      businessUnit: "Business Unit",
      deliveryDate: "Delivery Date",
      receivingDate: "Receiving Date",
      notStarted: "Not started",
      supplierPersonnel: "Supplier & Personnel",
      supplier: "Supplier",
      createdBy: "Created By",
      receivedBy: "Received By",
      checkedBy: "Checked By",
      receiveItemsTab: "Receive Items",
      damageItemsTab: "Damage Items",
      boxManagementTab: "Box Labels Management",
      notesTab: "Notes",
      receivedItems: "Received Items",
      receiveItemsEditableDescription: "Enter received quantities and damage information",
      receiveItemsReadonlyDescription: "View received items details",
      itemsCount: "{count} items",
      itemCode: "Item Code",
      itemName: "Item Name",
      expected: "Expected",
      received: "Received",
      damaged: "Damaged",
      boxes: "Boxes",
      variance: "Variance",
      notes: "Notes",
      addNotesPlaceholder: "Add notes...",
      additionalNotes: "Additional Notes",
      noNotes: "No notes added.",
      approveTitle: "Approve GRN",
      approveDescription:
        "Are you sure you want to approve {grnNumber}? This will create stock entries and update inventory levels. This action cannot be undone.",
      approvalNotes: "Approval Notes (optional)",
      approvalNotesPlaceholder: "Add any approval notes...",
      approving: "Approving...",
      rejectTitle: "Reject GRN",
      rejectDescription:
        "Are you sure you want to reject {grnNumber}? Please provide a reason for rejection.",
      rejectionReason: "Rejection Reason *",
      rejectionReasonPlaceholder: "Enter reason for rejection...",
      rejecting: "Rejecting...",
      updateSuccess: "GRN updated successfully",
      updateError: "Failed to update GRN",
      submitSuccess: "GRN submitted for approval",
      submitError: "Failed to submit GRN",
      approveSuccess: "GRN approved successfully",
      approveError: "Failed to approve GRN",
      rejectReasonRequired: "Please provide a rejection reason",
      rejectSuccess: "GRN rejected",
      rejectError: "Failed to reject GRN",
      noValue: "-",
    },
    grnDamagedItemsSection: {
      title: "Damaged Items",
      description: "Report and track damaged or defective items",
      reportDamage: "Report Damage",
      empty: "No damaged items reported",
      item: "Item",
      quantity: "Quantity",
      damageType: "Damage Type",
      descriptionLabel: "Description",
      reportedBy: "Reported By",
      reportedDate: "Reported Date",
      status: "Status",
      actionTaken: "Action Taken",
      actions: "Actions",
      broken: "Broken",
      defective: "Defective",
      missing: "Missing",
      expired: "Expired",
      wrongItem: "Wrong Item",
      other: "Other",
      reported: "Reported",
      processing: "Processing",
      resolved: "Resolved",
      validationError: "Please select an item and enter a valid quantity",
      createSuccess: "Damaged item reported successfully",
      createError: "Failed to report damaged item",
      updateSuccess: "Damaged item updated successfully",
      updateError: "Failed to update damaged item",
      deleteSuccess: "Damaged item deleted successfully",
      deleteError: "Failed to delete damaged item",
      createTitle: "Report Damaged Item",
      createDescription: "Record a damaged or defective item from this GRN",
      itemLabel: "Item *",
      selectItem: "Select an item",
      quantityLabel: "Quantity *",
      damageTypeLabel: "Damage Type *",
      descriptionPlaceholder: "Describe the damage...",
      cancel: "Cancel",
      reporting: "Reporting...",
      report: "Report",
      updateTitle: "Update Damaged Item",
      updateDescription: "Update the action taken and status",
      statusLabel: "Status",
      actionTakenLabel: "Action Taken",
      actionTakenPlaceholder: "Describe the action taken...",
      updating: "Updating...",
      update: "Update",
      deleteTitle: "Delete Damaged Item",
      deleteDescription:
        "Are you sure you want to delete this damaged item record? This action cannot be undone.",
      deleting: "Deleting...",
      delete: "Delete",
      noValue: "-",
    },
    grnBoxManagementSection: {
      title: "Box Management & Barcodes",
      description: "Generate boxes and print barcode labels",
      printAllLabels: "Print All Labels",
      printing: "Printing...",
      receivedUnits: "Received: {count} units",
      boxesGenerated: "{count} boxes generated",
      printLabels: "Print Labels",
      regenerate: "Regenerate",
      generate: "Generate",
      generateBoxLabels: "Box Labels",
      boxNumber: "Box #",
      barcode: "Barcode",
      qty: "Qty",
      location: "Location",
      notAssigned: "Not assigned",
      empty: "No items to generate boxes for",
      dialogTitle: "Generate Boxes for Item",
      receivedQuantity: "Received Quantity: {count}",
      numberOfBoxesLabel: "Number of Boxes *",
      qtyPerBox: "Qty per box: {count}",
      warehouseLocationOptional: "Warehouse Location (Optional)",
      loadingLocations: "Loading locations...",
      assignLocationLater: "Assign location later",
      noLocation: "No location",
      unnamed: "Unnamed",
      noLocationsAvailable: "No locations available",
      assignLaterDescription: "You can assign locations later using the putaway screen",
      generating: "Generating...",
      generateBoxes: "Generate Boxes",
      loadLocationsError: "Failed to load warehouse locations",
      generateSuccess: "{count} boxes generated successfully",
      generateError: "Failed to generate boxes",
      printNoBoxes: "No boxes to print",
      printSuccess: "Barcode labels sent to printer",
      printError: "Failed to print labels",
    },
    grnPutawayPage: {
      enterBarcodeError: "Please enter or scan a barcode",
      fetchLocationsError: "Failed to load warehouse locations",
      boxNotFound: "Box not found",
      alreadyAssignedTo: "Box already assigned to {code}",
      scanSuccess: "Box scanned successfully",
      scanError: "Failed to scan barcode",
      selectLocationError: "Please select a warehouse location",
      selectWarehouseError: "Please select a warehouse first",
      invalidLocationSelected: "Invalid location selected",
      locationWarehouseMismatch: "Location does not belong to selected warehouse",
      assignSuccess: "Box assigned to {location}",
      assignError: "Failed to assign location",
      back: "Back",
      title: "Putaway Station",
      subtitle: "Scan boxes and assign warehouse locations",
      selectWarehouseTitle: "Select Warehouse",
      selectWarehouseDescription: "Choose the warehouse you are working in",
      selectWarehousePlaceholder: "Select warehouse",
      scanTitle: "Scan Box Barcode",
      scanDescription: "Scan QR code or enter barcode manually",
      barcodePlaceholder: "Scan or enter barcode...",
      scanning: "Scanning...",
      scan: "Scan",
      boxScanned: "Box Scanned",
      grn: "GRN",
      box: "Box",
      item: "Item",
      qty: "Qty",
      currentlyAssignedTo: "Currently assigned to: {code}",
      assignLocationTitle: "Assign Storage Location",
      assignLocationDescription: "Search and select a warehouse location",
      selectWarehouseFirstNotice: "Please select a warehouse first",
      locationLabel: "Location",
      searchLocation: "Search location...",
      searchByCodeOrName: "Search by code or name...",
      noLocationFound: "No location found.",
      locationsAvailable: "{count} locations available",
      assigning: "Assigning...",
      confirmLocation: "Confirm Location",
      completedTitle: "Completed ({count})",
      completedDescription: "Boxes processed in this session",
    },
    stockRequestsPage: {
      title: "Stock Requests",
      subtitle: "Manage stock requests and fulfillment workflow",
      deliveryNotes: "Delivery Notes",
      createRequest: "Create Request",
      searchPlaceholder: "Search stock requests...",
      statusPlaceholder: "Status",
      priorityPlaceholder: "Priority",
      allStatus: "All Status",
      allPriority: "All Priority",
      draft: "Draft",
      submitted: "Submitted",
      approved: "Approved",
      picking: "Picking",
      picked: "Picked",
      dispatched: "Dispatched",
      received: "Received",
      allocating: "Allocating",
      partiallyAllocated: "Partially Allocated",
      allocated: "Allocated",
      partiallyFulfilled: "Partially Fulfilled",
      fulfilled: "Fulfilled",
      completed: "Completed",
      cancelled: "Cancelled",
      low: "Low",
      normal: "Normal",
      high: "High",
      urgent: "Urgent",
      requestNumber: "Request #",
      requestDate: "Request Date",
      requiredDate: "Required Date",
      requestedByWarehouse: "Requested By",
      requestedToWarehouse: "Requested To",
      priority: "Priority",
      status: "Status",
      receivedDate: "Received",
      requestedByUser: "Requested By",
      actions: "Actions",
      loadingError: "Error loading stock requests. Please try again.",
      emptyTitle: "No stock requests found",
      emptyDescription: "Create your first request to get started.",
      edit: "Edit",
      delete: "Delete",
      submit: "Submit",
      approve: "Approve",
      reject: "Reject",
      dispatch: "Dispatch",
      receive: "Receive",
      cancel: "Cancel",
      noActions: "--",
      noWarehouse: "--",
      deleteTitle: "Delete Stock Request",
      deleteDescription:
        "Are you sure you want to delete request {code}? This action cannot be undone.",
      deleting: "Deleting...",
      actionRequestLabel: "Request",
      reasonPlaceholder: "Enter reason...",
      processing: "Processing...",
      submitTitle: "Submit Stock Request",
      submitDescription: "Submit this stock request for approval?",
      approveTitle: "Approve Stock Request",
      approveDescription: "Approve this stock request?",
      rejectTitle: "Reject Stock Request",
      rejectDescription: "Reject this stock request? Please provide a reason.",
      dispatchTitle: "Dispatch Stock Request",
      dispatchDescription: "Dispatch picked quantities and post outbound inventory movement?",
      completeTitle: "Complete Stock Request",
      completeDescription:
        "Complete this stock request? This will create stock transactions and update inventory levels.",
      cancelTitle: "Cancel Stock Request",
      cancelDescription: "Cancel this stock request? Please provide a reason.",
    },
    stockRequestForm: {
      editTitle: "Edit Stock Request",
      createTitle: "Create Stock Request",
      editDescription: "Edit request {code}",
      createDescription: "Create a new stock request",
      requestDateLabel: "Request Date",
      requiredDateLabel: "Required Date",
      priorityLabel: "Priority",
      selectPriority: "Select priority",
      requestedByLabel: "Requested By",
      selectRequestedBy: "Select requested by",
      autoAssignedWarehouseUnavailable: "No warehouse assigned to the current business unit",
      requestedToLabel: "Requested To",
      selectRequestedTo: "Select requested to",
      purposeLabel: "Purpose",
      purposePlaceholder: "Enter purpose of request (optional)",
      notesLabel: "Notes",
      notesPlaceholder: "Additional notes (optional)",
      lineItemsTitle: "Line Items",
      lineItemsDescription: "Add items to request",
      addItem: "Add Item",
      noItems: "No items added yet.",
      noItemsDescription: "Click \"Add Item\" to get started.",
      item: "Item",
      qty: "Qty",
      unit: "Unit",
      notes: "Notes",
      actions: "Actions",
      cancel: "Cancel",
      saving: "Saving...",
      updateAction: "Update Request",
      createAction: "Create Request",
      lineItemRequired: "Please add at least one line item",
      noValue: "--",
    },
    stockRequestValidation: {
      requestDateRequired: "Request date is required",
      requiredDateRequired: "Required date is required",
      requestedByRequired: "Requested by is required",
      requestedToRequired: "Requested to is required",
      requestingAndFulfillingMustDiffer: "Requested to must be different from requested by",
    },
    stockRequestLineItemDialog: {
      editTitle: "Edit Request Item",
      createTitle: "Add Request Item",
      editDescription: "Update the request item details.",
      createDescription: "Fill in the details for the new request item.",
      itemLabel: "Item",
      selectItem: "Select an item",
      searchItem: "Search by code or name...",
      loadingItems: "Loading items...",
      noItemFound: "No item found.",
      onHand: "On hand",
      available: "Available",
      requestedQuantityLabel: "Requested Quantity",
      requestedQuantityPlaceholder: "Enter quantity",
      notesLabel: "Notes (Optional)",
      notesPlaceholder: "Additional notes for this item...",
      quantityToRequest: "Quantity to Request",
      cancel: "Cancel",
      updateAction: "Update Item",
      addAction: "Add Item",
    },
    stockRequestLineItemValidation: {
      itemRequired: "Item is required",
      uomRequired: "Unit of measure is required",
      requestedQtyMin: "Requested quantity must be greater than 0",
    },
    receiveStockRequestDialog: {
      title: "Receive Stock Request",
      description: "Receive items for request {code}",
      from: "From",
      to: "To",
      requiredDate: "Required Date",
      status: "Status",
      receivedDateLabel: "Received Date",
      itemsToReceive: "Items to Receive",
      item: "Item",
      requested: "Requested",
      dispatched: "Dispatched",
      received: "Received",
      receiveNow: "Receive Now *",
      location: "Location",
      selectLocation: "Select location",
      selectWarehouseFirst: "Select warehouse first",
      notesLabel: "Notes",
      notesPlaceholder: "Any notes about this receipt...",
      cancel: "Cancel",
      receiving: "Receiving...",
      receiveAction: "Receive",
      noWarehouse: "--",
      receiveQtyRequired: "Please enter quantities to receive for at least one item",
      receiveSuccess: "Stock request received successfully.",
      receiveError: "Failed to receive stock request",
    },
    receiveStockRequestValidation: {
      receivedDateRequired: "Received date is required",
      receivedQtyMin: "Quantity cannot be negative",
    },
    stockRequestViewDialog: {
      title: "Stock Request Details",
      requestNumber: "Request #{code}",
      requestedByWarehouse: "Requested By",
      requestedToWarehouse: "Requested To",
      requestedByUser: "Requested By",
      requestDate: "Request Date",
      requiredDate: "Required Date",
      receivedDate: "Received Date",
      receivedBy: "Received By",
      priority: "Priority",
      purpose: "Purpose",
      notes: "Notes",
      lineItems: "Line Items",
      item: "Item",
      quantity: "Quantity",
      deliveredQty: "Delivered Qty",
      unit: "Unit",
      noItems: "No items found.",
      fulfillmentSummary: "Fulfillment Summary",
      totalRequested: "Total Requested",
      totalDelivered: "Total Delivered",
      remainingQty: "Remaining Qty",
      fulfillingDeliveryNotes: "Fulfilling Delivery Notes",
      noLinkedDeliveryNotes: "No linked delivery notes yet.",
      noValue: "--",
    },
  },
  zh: {
    common: {
      loading: "加载中...",
      error: "发生错误",
      success: "成功",
      confirm: "确认",
      yes: "是",
      no: "否",
      save: "保存",
      cancel: "取消",
      delete: "删除",
      edit: "编辑",
      create: "创建",
      search: "搜索",
      filter: "筛选",
      export: "导出",
      import: "导入",
      actions: "操作",
      status: "状态",
      name: "名称",
      code: "代码",
      description: "描述",
      notes: "备注",
      date: "日期",
      quantity: "数量",
      price: "价格",
      total: "总计",
      submit: "提交",
      close: "关闭",
      add: "添加",
      item: "物品",
      items: "物品",
      warehouse: "仓库",
      select: "选择",
      search_: "搜索...",
      view: "查看",
      allStatuses: "所有状态",
      draft: "草稿",
      preparing: "准备中",
      completed: "已完成",
      cancelled: "已取消",
      active: "活跃",
      inactive: "非活跃",
      usageCount: "使用次数",
      locked: "(已锁定)",
    },
    forms: {
      required: "此字段为必填项",
      invalid: "无效值",
      saveSuccess: "保存成功",
      saveError: "保存失败",
      deleteConfirm: "确定要删除吗？",
      deleteSuccess: "删除成功",
      deleteError: "删除失败",
      noResults: "未找到结果",
      selectItem: "选择物品...",
      noDataFound: "未找到数据",
    },
    transformation: {
      transformations: "转换",
      transformation: "转换",
      template: "模板",
      templates: "模板",
      order: "订单",
      orders: "订单",
      newTransformation: "新转换",
      newTemplate: "新模板",
      transformationOrder: "转换订单",
      transformationTemplate: "转换模板",
      inputMaterials: "输入材料",
      outputProducts: "输出产品",
      totalInputCost: "总输入成本",
      totalOutputCost: "总输出成本",
      costVariance: "成本差异",
      orderDate: "订单日期",
      plannedQuantity: "计划数量",
      actualQuantity: "实际数量",
      planned: "计划",
      consumed: "消耗",
      produced: "生产",
      unitCost: "单位成本",
      totalCost: "总成本",
      scrap: "废料",
      prepare: "准备",
      complete: "完成",
      cancelOrder: "取消订单",
      prepareOrder: "准备订单？",
      completeOrder: "完成订单？",
      preparing: "准备中",
      orderPrepared: "订单准备成功",
      orderCompleted: "订单完成成功",
      orderCancelled: "订单取消成功",
      notFound: "未找到",
      prepareConfirmation: "这将准备订单并使其准备好完成。",
      completeConfirmation: "这将完成转换，消耗输入材料并生产输出产品。",
      cancelConfirmation: "这将取消订单。此操作无法撤消。",
      manageTemplates: "管理模板",
      manageMaterialTransformations: "管理材料和产品转换",
      orderCode: "订单编号",
      searchOrdersPlaceholder: "按订单编号或备注搜索...",
      noOrdersFound: "未找到转换订单",
      createNewOrder: "从模板创建新的转换订单",
      orderDetails: "订单详情",
      selectTemplate: "选择模板",
      selectWarehouse: "选择仓库",
      plannedExecutionDate: "计划执行日期",
      pickDate: "选择日期",
      createFromTemplate: "从模板创建",
      executeTransformation: "执行转换",
      actualConsumed: "实际消耗",
      actualProduced: "实际生产",
      enterActualQuantities: "输入实际消耗的输入和生产的输出数量",
      difference: "差异",
      exceedsPlanned: "不能超过计划数量",
      wastedQuantity: "浪费数量",
      wasteReason: "浪费原因",
      enterWasteDetails: "如适用，请输入浪费详情",
      optional: "可选",
      tryAdjustingSearchOrStatus: "请调整搜索条件或状态筛选。",
      notAvailable: "无",
      dash: "-",
      templateRequired: "模板为必填项",
      noTemplatesTitle: "还没有转换模板",
      noTemplatesDescription: "创建模板以定义投入物料和产出产品，供后续库存转换单使用。",
      warehouseRequired: "仓库为必填项",
      orderDateRequired: "订单日期为必填项",
      plannedQuantityGreaterThanZero: "计划数量必须大于 0",
      companyIdMissing: "缺少公司 ID。请重新登录后重试。",
      failedCreateTransformationOrder: "创建转换订单失败",
      failedExecuteTransformation: "执行转换失败",
      failedOrderAction: "处理订单操作失败",
      noReasonProvided: "未提供原因",
      totalExceedsPlanned: "总数超过计划数量",
      totalLessThanPlanned: "总数少于计划数量",
      wasteReasonRequired: "必须填写浪费原因",
      totalAccounted: "已统计总数",
    },
    pagination: {
      rowsPerPage: "每页行数",
      pageOf: "第 {currentPage} 页，共 {totalPages} 页",
      showing: "显示第 {startItem} 到 {endItem} 项，共 {totalItems} 项",
      goToFirstPage: "转到第一页",
      goToPreviousPage: "转到上一页",
      goToNextPage: "转到下一页",
      goToLastPage: "转到最后一页",
    },
    navigation: {
      Home: "首页",
      Dashboard: "仪表板",
      Inventory: "库存",
      "Item Master": "商品主档",
      "Create Item": "创建商品",
      "Edit Item": "编辑商品",
      Warehouse: "仓库",
      Location: "库位",
      Warehouses: "仓库",
      "Stock Transactions": "库存交易",
      "Stock Adjustments": "库存调整",
      "Stock Requests": "库存申请",
      "Delivery Notes": "送货单",
      "Pick Lists": "拣货单",
      "Stock Transformations": "库存转换",
      "Reorder Management": "补货管理",
      Purchasing: "采购",
      Overview: "概览",
      Suppliers: "供应商",
      "Stock Requisitions": "库存请购",
      "Load Lists": "装载单",
      "Goods Receipt Notes": "收货单",
      Reports: "报表",
      "Reports Directory": "报表目录",
      "Stock Reports": "库存报表",
      Admin: "管理",
      Users: "用户",
      Roles: "角色",
      "Company Settings": "公司设置",
      "Business Units": "业务单元",
      dashboard: "仪表板",
      inventory: "库存",
      items: "商品主档",
      warehouses: "仓库",
      stock: "库存交易",
      adjustments: "库存调整",
      "stock-requests": "库存申请",
      "delivery-notes": "送货单",
      "pick-lists": "拣货单",
      transformations: "库存转换",
      templates: "模板",
      reorder: "补货管理",
      purchasing: "采购",
      overview: "概览",
      suppliers: "供应商",
      "stock-requisitions": "库存请购",
      "load-lists": "装载单",
      grns: "收货单",
      reports: "报表",
      admin: "管理",
      users: "用户",
      roles: "角色",
      settings: "公司设置",
      "business-units": "业务单元",
      "Delivery Note": "送货单",
      "Delivery Note Details": "送货单详情",
      "Stock Requisition Details": "库存请购详情",
      "Load List Details": "装载单详情",
      "GRN Details": "收货单详情",
    },
    warehousesPage: {
      title: "仓库管理",
      subtitle: "管理仓库位置和存储设施",
      createWarehouse: "创建仓库",
      searchPlaceholder: "搜索仓库...",
      statusPlaceholder: "状态",
      allStatus: "所有状态",
      loadingError: "加载仓库失败。请重试。",
      empty: "未找到仓库",
      location: "位置",
      manager: "负责人",
      contact: "联系方式",
      locations: "库位",
      deleteTitle: "删除仓库",
      deleteDescription: "确定要删除此仓库吗？",
      deleteDescriptionWithName:
        "确定要删除“{name}”吗？此操作无法撤销。",
      deleteSuccess: "仓库删除成功",
      deleteError: "删除仓库失败",
    },
    warehouseForm: {
      createTitle: "创建新仓库",
      editTitle: "编辑仓库",
      createDescription: "填写以下仓库信息以创建新仓库",
      editDescription: "更新以下仓库信息",
      codeLabel: "仓库代码 *",
      nameLabel: "仓库名称 *",
      descriptionLabel: "描述",
      locationInformation: "位置信息",
      contactInformation: "联系信息",
      addressLabel: "地址",
      cityLabel: "城市",
      stateLabel: "州/省",
      postalCodeLabel: "邮政编码",
      countryLabel: "国家",
      phoneLabel: "电话",
      emailLabel: "电子邮箱",
      activeStatusLabel: "启用状态",
      activeStatusDescription: "设置该仓库是否启用并可供使用",
      codePlaceholder: "WH-001",
      namePlaceholder: "输入仓库名称",
      descriptionPlaceholder: "输入描述",
      addressPlaceholder: "街道地址",
      cityPlaceholder: "城市",
      statePlaceholder: "州或省",
      postalCodePlaceholder: "邮政编码",
      countryPlaceholder: "国家",
      phonePlaceholder: "+1 234 567 8900",
      emailPlaceholder: "warehouse@example.com",
      saving: "保存中...",
      createAction: "创建仓库",
      updateAction: "更新仓库",
      createSuccess: "仓库创建成功",
      updateSuccess: "仓库更新成功",
      createError: "创建仓库失败",
      updateError: "更新仓库失败",
      missingCompany: "用户公司信息不可用",
    },
    warehouseValidation: {
      codeRequired: "仓库代码为必填项",
      codeMax: "仓库代码不能超过50个字符",
      codeFormat: "仓库代码只能包含大写字母、数字和连字符",
      nameRequired: "仓库名称为必填项",
      nameMax: "仓库名称不能超过200个字符",
      descriptionMax: "描述不能超过1000个字符",
      addressMax: "地址不能超过500个字符",
      cityMax: "城市不能超过100个字符",
      stateMax: "州/省不能超过100个字符",
      postalCodeMax: "邮政编码不能超过20个字符",
      countryMax: "国家不能超过100个字符",
      phoneMax: "电话不能超过50个字符",
      emailInvalid: "电子邮箱地址无效",
      emailMax: "电子邮箱不能超过255个字符",
    },
    dashboardPage: {
      goodMorning: "早上好",
      goodNoon: "中午好",
      goodAfternoon: "下午好",
      goodEvening: "晚上好",
      fallbackUser: "用户",
      subtitle: "以下是今天仓库的最新情况",
      loadError: "加载仪表板数据失败。请重试。",
      retry: "重试",
      incomingShipments: "到货运输",
      inTransit: "运输中",
      stockRequests: "库存申请",
      pending: "待处理",
      pickList: "拣货单",
      toPick: "待拣货",
    },
    warehouseDashboard: {
      lowStocks: "低库存",
      outOfStocks: "缺货商品",
      noLowStockItems: "没有低库存商品",
      noOutOfStockItems: "没有缺货商品",
      locationLabel: "库位",
      reorderLabel: "补货点",
      lastLabel: "最近",
      viewAllInventory: "查看全部库存",
      operationalQueue: "作业队列",
      pickListTab: "拣货单（{count}）",
      incomingTab: "到货（{count}）",
      requestsTab: "申请（{count}）",
      noItemsToPick: "没有待拣货项目",
      noIncomingDeliveries: "没有待到货记录",
      noPendingRequests: "没有待处理申请",
      itemsCount: "{count} 个项目",
      dueLabel: "截止",
      byLabel: "申请人",
      etaLabel: "预计到达",
      requiredLabel: "需求日期",
      status_draft: "草稿",
      status_submitted: "已提交",
      status_approved: "已批准",
      status_picking: "拣货中",
      status_picked: "已拣货",
      status_delivered: "已发运",
      status_completed: "已完成",
      status_cancelled: "已取消",
      status_in_transit: "运输中",
      status_partially_received: "部分接收",
      priority_low: "低",
      priority_normal: "普通",
      priority_high: "高",
      priority_urgent: "紧急",
      lastStockMovements: "最近 5 条库存移动",
      noRecentStockMovements: "没有最近的库存移动",
      justNow: "刚刚",
      minutesAgo: "{count} 分钟前",
      hoursAgo: "{count} 小时前",
      byUser: "操作人 {user}",
    },
    notificationsPage: {
      title: "通知",
      subtitle: "及时了解重要事件。",
      filter: "筛选",
      all: "全部",
      unread: "未读",
      empty: "未找到通知。",
      emptyMenu: "还没有通知。",
      new: "新",
      markAsRead: "标记为已读",
      viewAll: "查看全部",
    },
    userMenu: {
      myProfile: "我的资料",
      myPreferences: "我的偏好设置",
      changePassword: "修改密码",
      logOut: "退出登录",
    },
    preferencesPage: {
      title: "我的偏好设置",
      subtitle: "自定义应用偏好和显示设置",
      displayTitle: "显示",
      displayDescription: "自定义应用的外观和使用体验",
    },
    fontSizeSettings: {
      title: "字体大小",
      description: "调整整个应用中的文本大小",
      size_small: "小",
      size_medium: "中",
      size_large: "大",
      size_extraLarge: "特大",
      preview: "预览：文本将在所选大小下这样显示。",
    },
    accessDeniedPage: {
      title: "拒绝访问",
      resourceNeedAll: "你需要拥有以下所有资源的访问权限：{resources}",
      resourceNeedOne: "你至少需要拥有以下其中一个资源的访问权限：{resources}",
      resourceNeedView: "你需要拥有 {resource} 的查看权限",
      noPermission: "你没有权限访问此资源",
      supportMessage: "如果你认为这是错误，请联系系统管理员申请访问权限。",
      goBack: "返回",
      goHome: "前往首页",
      logout: "退出登录",
      loading: "加载中...",
      errorCode: "错误代码：403 - 禁止访问",
    },
    chartOfAccountsPage: {
      title: "会计科目表",
      subtitle: "管理总账会计科目",
      newAccount: "新建科目",
      searchPlaceholder: "按科目编号或名称搜索...",
      accountType: "科目类型",
      allTypes: "所有类型",
      allStatus: "所有状态",
      totalAccounts: "科目总数",
      assets: "资产",
      liabilities: "负债",
      revenue: "收入",
      accountNumber: "科目编号",
      accountName: "科目名称",
      type: "类型",
      level: "层级",
      system: "系统",
      systemAccount: "系统",
      loading: "正在加载科目...",
      empty: "未找到科目",
      unknown: "未知",
      viewActions: "操作",
      active: "启用",
      inactive: "停用",
      asset: "资产",
      liability: "负债",
      equity: "权益",
      expense: "费用",
      cogs: "销货成本",
    },
    journalsPage: {
      title: "会计分录",
      subtitle: "查看和管理总账分录",
      newJournalEntry: "新建分录",
      searchPlaceholder: "按分录编号、描述或参考号搜索...",
      source: "来源",
      allSources: "所有来源",
      totalEntries: "分录总数",
      posted: "已过账",
      draft: "草稿",
      totalDebits: "借方合计",
      journalCode: "分录编号",
      date: "日期",
      reference: "参考",
      debit: "借方",
      credit: "贷方",
      loading: "正在加载分录...",
      empty: "未找到分录",
      viewJournalEntry: "查看分录",
      printJournalEntry: "打印分录",
      ar: "应收",
      ap: "应付",
      inventory: "库存",
      manual: "手工",
    },
    journalEntryFormDialog: {
      loadAccountsError: "加载科目失败",
      minLinesError: "分录至少需要 2 行",
      unbalancedError: "分录未平衡",
      unbalancedDescription: "借方：{debits}，贷方：{credits}",
      accountRequiredError: "所有行都必须选择科目",
      debitCreditRequiredError: "分录必须同时包含借方和贷方",
      createError: "创建分录失败",
      createSuccess: "分录创建成功",
      createSuccessDescription: "分录编号：{journalCode}",
      title: "新建手工分录",
      description: "创建包含借贷分录行的手工分录",
      postingDate: "过账日期",
      referenceCode: "参考号",
      referencePlaceholder: "例如：REF-001",
      descriptionLabel: "描述",
      descriptionPlaceholder: "输入描述",
      journalLines: "分录行",
      addLine: "添加行",
      account: "科目",
      selectAccount: "选择科目",
      lineDescriptionPlaceholder: "行描述",
      debit: "借方",
      credit: "贷方",
      totals: "合计",
      totalDebit: "借方合计",
      totalCredit: "贷方合计",
      difference: "差额",
      balanced: "平衡",
      notBalanced: "未平衡",
      creating: "创建中...",
      createAction: "创建分录",
    },
    journalEntryViewDialog: {
      postError: "过账分录失败",
      postSuccess: "分录过账成功",
      postSuccessDescription: "{journalCode} 已过账到总账",
      title: "分录：{journalCode}",
      noDescription: "无描述",
      postingDate: "过账日期",
      sourceModule: "来源模块",
      referenceCode: "参考号",
      postedAt: "过账时间",
      journalLines: "分录行",
      lineNumber: "行号",
      account: "科目",
      descriptionLabel: "描述",
      debit: "借方",
      credit: "贷方",
      totals: "合计：",
      balanced: "已平衡",
      outOfBalance: "未平衡",
      difference: "差额：{amount}",
      createdAt: "创建时间",
      lastUpdated: "最后更新",
      posting: "过账中...",
      postToGl: "过账到总账",
    },
    generalLedgerPage: {
      title: "总分类账",
      subtitle: "查看科目明细交易",
      export: "导出",
      print: "打印",
      account: "科目",
      selectAccount: "选择科目...",
      fromDate: "开始日期",
      toDate: "结束日期",
      loading: "加载中...",
      viewLedger: "查看账簿",
      openingBalance: "期初余额",
      closingBalance: "期末余额",
      totalDebits: "借方合计",
      totalCredits: "贷方合计",
      netChange: "净变动",
      date: "日期",
      journalCode: "分录编号",
      descriptionLabel: "描述",
      source: "来源",
      reference: "参考",
      debit: "借方",
      credit: "贷方",
      balance: "余额",
      noTransactions: "所选期间没有交易记录",
      notAvailable: "-",
    },
    trialBalancePage: {
      title: "试算平衡表",
      subtitle: "核对借方与贷方是否相等",
      export: "导出",
      print: "打印",
      asOfDate: "截止日期",
      loading: "加载中...",
      generateReport: "生成报表",
      asOf: "截止至",
      balanced: "已平衡",
      notBalanced: "未平衡",
      totalDebits: "借方合计",
      totalCredits: "贷方合计",
      difference: "差额",
      accountNumber: "科目编号",
      accountName: "科目名称",
      type: "类型",
      debit: "借方",
      credit: "贷方",
      noActivity: "所选期间没有科目活动",
      total: "合计",
      notAvailable: "-",
    },
    adminUsersPage: {
      title: "用户管理",
      subtitle: "管理用户并分配角色",
      searchPlaceholder: "按邮箱、用户名或姓名搜索用户...",
      all: "全部",
      active: "启用",
      inactive: "停用",
      user: "用户",
      username: "用户名",
      created: "创建时间",
      loadError: "加载用户失败。请重试。",
      emptyTitle: "未找到用户",
      emptyDescription: "请尝试调整搜索或筛选条件。",
      manageRoles: "管理角色",
      viewPermissions: "查看权限",
      deactivate: "停用",
      activate: "启用",
      statusUpdatedActive: "用户 {email} 已启用",
      statusUpdatedInactive: "用户 {email} 已停用",
      statusUpdateError: "更新用户状态失败",
    },
    adminUserRolesDialog: {
      title: "管理角色 - {name}",
      description: "为该用户在不同业务单元中分配或移除角色",
      currentRoles: "当前角色",
      noRoles: "尚未分配角色",
      unknownBusinessUnit: "未知业务单元",
      assignNewRole: "分配新角色",
      role: "角色",
      businessUnit: "业务单元",
      selectRole: "选择角色",
      selectBusinessUnit: "选择业务单元",
      system: "系统",
      assignRole: "分配角色",
      assigning: "分配中...",
      selectRoleAndBusinessUnit: "请选择角色和业务单元",
      roleAssignedSuccess: "角色分配成功",
      roleAssignedError: "角色分配失败",
      roleRemovedSuccess: "角色移除成功",
      roleRemovedError: "角色移除失败",
    },
    adminUserPermissionsDialog: {
      title: "有效权限 - {name}",
      description: "汇总该用户所有已分配角色的权限",
      activePermissions: "{count} 项有效权限",
      searchPlaceholder: "按资源搜索权限...",
      noSearchResults: "没有权限匹配搜索 \"{query}\"",
      noPermissions: "该用户尚未分配任何权限。",
      resource: "资源",
      showingSummary: "显示 {filtered} / {total} 项权限",
    },
    adminRolesPage: {
      title: "角色管理",
      subtitle: "管理角色及其权限",
      createRole: "创建角色",
      searchPlaceholder: "按角色名称或描述搜索...",
      role: "角色",
      type: "类型",
      created: "创建时间",
      loadError: "加载角色失败。请重试。",
      emptyTitle: "未找到角色",
      emptyDescription: "请尝试调整搜索条件。",
      noDescription: "无描述",
      system: "系统",
      custom: "自定义",
      permissions: "权限",
      cannotDeleteSystemRoles: "无法删除系统角色",
      roleDeletedSuccess: "角色“{name}”删除成功",
      roleDeletedError: "删除角色失败",
      deleteTitle: "确定吗？",
      deleteDescription: "此操作将永久删除角色“{name}”。该操作无法撤销。",
      deleting: "删除中...",
    },
    adminRolePermissionsDialog: {
      title: "管理权限 - {name}",
      description: "选择权限并自定义该角色对每个资源可执行的操作。",
      systemRole: "系统角色",
      searchPlaceholder: "按资源或描述搜索权限...",
      noSearchResults: "没有权限匹配搜索 \"{query}\"",
      noPermissionsInSystem: "系统中未找到权限。",
      available: "可用：",
      assignedSummary: "已分配 {assigned} / {total} 项权限",
      shownSummary: "（显示 {count} 项）",
      saving: "保存中...",
      saveChanges: "保存更改",
      permissionsUpdatedSuccess: "权限更新成功",
      permissionsUpdatedError: "权限更新失败",
    },
    adminCreateRoleDialog: {
      title: "创建新角色",
      description: "创建新角色，并可选择从现有角色复制权限",
      roleName: "角色名称",
      roleNamePlaceholder: "例如：仓库经理",
      descriptionLabel: "描述",
      descriptionPlaceholder: "描述该角色的用途和职责",
      copyPermissionsFrom: "从以下角色复制权限（可选）",
      selectRolePlaceholder: "选择要复制权限的角色",
      system: "（系统）",
      copySummary: "将从“{name}”复制 {count} 项权限",
      creating: "创建中...",
      createRole: "创建角色",
      roleNameRequired: "角色名称为必填项",
      roleCreatedSuccess: "角色“{name}”创建成功",
      roleCreatedWithCopySuccess: "角色“{name}”创建成功，并已从“{source}”复制权限",
      roleCreateError: "创建角色失败",
    },
    adminEditRoleDialog: {
      title: "编辑角色",
      description: "更新角色名称和描述",
      roleName: "角色名称",
      roleNamePlaceholder: "例如：仓库经理",
      descriptionLabel: "描述",
      descriptionPlaceholder: "描述该角色的用途和职责",
      updating: "更新中...",
      updateRole: "更新角色",
      roleNameRequired: "角色名称为必填项",
      roleUpdatedSuccess: "角色“{name}”更新成功",
      roleUpdateError: "更新角色失败",
    },
    salesPage: {
      title: "销售管理",
      subtitle: "管理客户、订单、报价单和发票",
      totalCustomers: "客户总数",
      totalCustomersDescription: "活跃客户账户",
      totalRevenue: "总收入",
      totalRevenueDescription: "本月",
      outstandingCredit: "未收回信用额",
      outstandingCreditDescription: "客户余额",
      pendingOrders: "待处理订单",
      pendingOrdersDescription: "等待履约",
      quickAccess: "快捷入口",
      pointOfSale: "销售终端",
      pointOfSaleDescription: "面向到店客户的快速结账",
      customers: "客户",
      customersDescription: "管理客户账户",
      quotations: "报价单",
      quotationsDescription: "创建和管理报价单",
      salesOrders: "销售订单",
      salesOrdersDescription: "处理销售订单",
      invoices: "发票",
      invoicesDescription: "生成并跟踪发票",
      goTo: "前往",
    },
    customersPage: {
      title: "客户主数据",
      subtitle: "管理客户账户",
      createCustomer: "创建客户",
      searchPlaceholder: "搜索客户...",
      typePlaceholder: "类型",
      allTypes: "所有类型",
      customer: "客户",
      contact: "联系方式",
      location: "地点",
      creditLimit: "信用额度",
      balance: "余额",
      typeCompany: "公司",
      typeGovernment: "政府",
      typeIndividual: "个人",
      loadError: "加载客户失败。请重试。",
      empty: "未找到客户。创建第一个客户以开始使用。",
      deleteTitle: "删除客户",
      deleteDescription: "确定要删除此客户吗？",
      deleteDescriptionWithName: "确定要删除“{name}”吗？此操作无法撤销。",
      deleteSuccess: "客户删除成功",
      deleteError: "删除客户失败",
    },
    customerForm: {
      editTitle: "编辑客户",
      createTitle: "创建新客户",
      editDescription: "更新下方客户信息",
      createDescription: "填写以下客户信息以创建新客户",
      generalTab: "常规",
      billingTab: "账单",
      shippingTab: "收货",
      paymentTab: "付款",
      customerCode: "客户编码",
      customerCodePlaceholder: "CUST-001",
      customerType: "客户类型",
      selectType: "选择类型",
      typeIndividual: "个人",
      typeCompany: "公司",
      typeGovernment: "政府",
      customerName: "客户名称",
      customerNamePlaceholder: "输入客户名称",
      email: "电子邮箱",
      emailPlaceholder: "customer@email.com",
      phone: "电话",
      phonePlaceholder: "+1-555-0000",
      mobile: "手机",
      mobilePlaceholder: "+1-555-0001",
      website: "网站",
      websitePlaceholder: "www.customer.com",
      taxId: "税号",
      taxIdPlaceholder: "TAX-12345678",
      contactPersonOptional: "联系人（可选）",
      name: "姓名",
      contactNamePlaceholder: "John Doe",
      contactEmailPlaceholder: "john@email.com",
      contactPhonePlaceholder: "+1-555-0002",
      address: "地址",
      addressPlaceholder: "街道地址",
      city: "城市",
      cityPlaceholder: "城市",
      state: "州/省",
      statePlaceholder: "州/省",
      postalCode: "邮政编码",
      postalCodePlaceholder: "邮政编码",
      country: "国家",
      selectCountry: "选择国家",
      sameAsBilling: "与账单地址相同",
      paymentTerms: "付款条件",
      selectPaymentTerms: "选择付款条件",
      paymentCash: "现金",
      paymentDueOnReceipt: "收货即付",
      paymentNet30: "30天账期",
      paymentNet60: "60天账期",
      paymentNet90: "90天账期",
      paymentCod: "货到付款",
      creditLimit: "信用额度",
      creditLimitPlaceholder: "0.00",
      notes: "备注",
      notesPlaceholder: "附加备注",
      activeCustomer: "启用客户",
      missingCompany: "用户公司信息不可用",
      createSuccess: "客户创建成功",
      updateSuccess: "客户更新成功",
      createError: "创建客户失败",
      updateError: "更新客户失败",
      saving: "保存中...",
      updateCustomer: "更新客户",
      createCustomer: "创建客户",
    },
    customerValidation: {
      customerCodeRequired: "客户编码为必填项",
      customerCodeFormat: "编码只能包含大写字母、数字和连字符",
      customerNameRequired: "客户名称为必填项",
      invalidEmail: "电子邮箱地址无效",
      phoneRequired: "电话为必填项",
      billingAddressRequired: "账单地址为必填项",
      billingCityRequired: "账单城市为必填项",
      billingStateRequired: "账单州/省为必填项",
      billingPostalCodeRequired: "账单邮政编码为必填项",
      billingCountryRequired: "账单国家为必填项",
      shippingAddressRequired: "收货地址为必填项",
      shippingCityRequired: "收货城市为必填项",
      shippingStateRequired: "收货州/省为必填项",
      shippingPostalCodeRequired: "收货邮政编码为必填项",
      shippingCountryRequired: "收货国家为必填项",
      creditLimitMin: "信用额度必须大于或等于 0",
    },
    employeesPage: {
      title: "销售员工",
      subtitle: "管理销售人员、负责区域和佣金比例",
      addEmployee: "新增员工",
      totalEmployees: "员工总数",
      activeEmployees: "{count} 名启用",
      avgCommissionRate: "平均佣金比例",
      avgCommissionRateDescription: "所有员工平均值",
      territoriesCovered: "覆盖区域",
      territoriesCoveredDescription: "唯一地点数",
      employees: "员工",
      employeesDescription: "查看和管理员工",
      searchPlaceholder: "按姓名、编码或邮箱搜索...",
      firstName: "名",
      lastName: "姓",
      role: "角色",
      commissionRate: "佣金比例",
      territories: "区域",
      noEmployeesFound: "未找到员工",
      noTerritories: "无区域",
      moreCount: "另外 {count} 个",
      manageTerritories: "区域",
      showingEmployees: "显示第 {from} 到 {to} 条，共 {total} 名员工",
      previous: "上一页",
      next: "下一页",
      pageOf: "第 {page} / {totalPages} 页",
      salesAgent: "销售代表",
      salesManager: "销售经理",
      territoryManager: "区域经理",
    },
    employeeForm: {
      createTitle: "新增员工",
      editTitle: "编辑员工",
      createDescription: "创建新的销售员工账户",
      editDescription: "更新员工信息",
      employeeCode: "员工编码",
      employeeCodePlaceholder: "EMP-001",
      role: "角色",
      selectRole: "选择角色",
      firstName: "名",
      firstNamePlaceholder: "John",
      lastName: "姓",
      lastNamePlaceholder: "Doe",
      email: "电子邮箱",
      emailPlaceholder: "john@example.com",
      phone: "电话",
      phonePlaceholder: "+63 912 345 6789",
      commissionRate: "佣金比例 (%)",
      commissionRatePlaceholder: "5.00",
      commissionRateDescription: "该员工可获得的销售佣金百分比",
      activeStatus: "启用状态",
      activeStatusDescription: "停用员工无法分配到新发票",
      creatingSuccess: "员工创建成功",
      updatingSuccess: "员工更新成功",
      saveError: "保存员工失败",
      createAction: "创建员工",
      saveChanges: "保存更改",
      creating: "创建中...",
      employeeCodeRequired: "员工编码为必填项",
      firstNameRequired: "名为必填项",
      lastNameRequired: "姓为必填项",
      invalidEmail: "电子邮箱地址无效",
      commissionRateRange: "佣金比例必须在 0 到 100 之间",
    },
    territoryManagementDialog: {
      title: "管理区域",
      description: "为 {name}（{code}）分配区域",
      assignedTerritories: "已分配区域",
      addTerritory: "新增区域",
      noTerritories: "尚未分配区域",
      noTerritoriesDescription: "点击“新增区域”进行分配",
      primary: "主要",
      removePrimary: "取消主要",
      setAsPrimary: "设为主要",
      city: "城市",
      selectCity: "选择城市",
      regionState: "地区/州",
      selectRegion: "选择地区",
      primaryTerritory: "主要区域",
      primaryTerritoryDescription: "主要区域将用于自动分配",
      territoryAssignedSuccess: "区域分配成功",
      territoryAssignError: "新增区域失败",
      territoryRemovedSuccess: "区域移除成功",
      territoryRemoveError: "移除区域失败",
      territoryPrimaryAdded: "区域已设为主要",
      territoryPrimaryRemoved: "区域已取消主要",
      territoryPrimaryError: "更新区域失败",
      cityRequired: "城市为必填项",
      regionStateRequired: "地区/州为必填项",
    },
    salesOrdersPage: {
      title: "销售订单",
      subtitle: "处理和管理客户订单",
      createOrder: "创建订单",
      searchPlaceholder: "搜索订单...",
      orderNumber: "订单号",
      customer: "客户",
      orderDate: "订单日期",
      expectedDelivery: "预计交付",
      amount: "金额",
      loadError: "加载销售订单失败。请重试。",
      empty: "未找到销售订单。创建第一个订单以开始使用。",
      fromQuotation: "来自 {number}",
      overdue: "逾期",
      itemsCount: "{count} 个项目",
      confirm: "确认",
      invoice: "发票",
      selectWarehouseTitle: "选择仓库",
      selectWarehouseDescription: "选择该发票扣减库存所使用的仓库。",
      selectWarehouse: "选择仓库",
      selectLocationOptional: "选择库位（可选）",
      selectWarehouseFirst: "请先选择仓库",
      converting: "转换中...",
      createInvoice: "创建发票",
      draft: "草稿",
      confirmed: "已确认",
      inProgress: "进行中",
      shipped: "已发货",
      delivered: "已交付",
      invoiced: "已开票",
      cancelled: "已取消",
    },
    salesOrderForm: {
      customerRequired: "客户为必填项",
      orderDateRequired: "订单日期为必填项",
      expectedDeliveryDateRequired: "预计交付日期为必填项",
      addLineItemRequired: "请至少添加一个行项目",
      editTitle: "编辑销售订单",
      createTitle: "创建新销售订单",
      editDescription: "更新销售订单详情和行项目。",
      createDescription: "填写销售订单详情并添加行项目。",
      generalTab: "常规",
      lineItemsTab: "行项目（{count}）",
      shippingTab: "收货",
      termsTab: "条款和备注",
      customer: "客户",
      searchCustomer: "搜索客户...",
      customerSearchPlaceholder: "按编码或名称搜索...",
      noCustomerFound: "未找到客户。",
      orderDate: "订单日期",
      expectedDelivery: "预计交付",
      lineItemsTitle: "行项目",
      lineItemsDescription: "管理订单中的商品或服务",
      addItem: "添加项目",
      noItems: "尚未添加项目。",
      noItemsDescription: "点击“添加项目”开始。",
      qty: "数量",
      unit: "单位",
      price: "价格",
      discountPct: "折扣 %",
      taxPct: "税率 %",
      totals: "合计",
      subtotal: "小计",
      discount: "折扣",
      tax: "税额",
      total: "总计",
      address: "地址",
      addressPlaceholder: "街道地址",
      city: "城市",
      cityPlaceholder: "城市",
      stateProvince: "州/省",
      statePlaceholder: "州/省",
      postalCode: "邮政编码",
      postalCodePlaceholder: "邮政编码",
      country: "国家",
      countryPlaceholder: "国家",
      paymentTerms: "付款条款",
      internalNotes: "内部备注",
      saving: "保存中...",
      updateOrder: "更新订单",
      createOrder: "创建订单",
    },
    salesOrderViewDialog: {
      title: "销售订单详情",
      description: "订单号 #{number}",
      customerInformation: "客户信息",
      name: "名称",
      email: "电子邮箱",
      quotation: "报价单",
      orderDetails: "订单详情",
      orderDate: "订单日期",
      expectedDelivery: "预计交付",
      deliveryAddress: "送货地址",
      lineItems: "行项目",
      quantity: "数量",
      unit: "单位",
      unitPrice: "单价",
      discount: "折扣",
      tax: "税额",
      total: "总计",
      subtotal: "小计",
      totalAmount: "总金额",
      paymentSummary: "付款汇总",
      totalInvoiced: "已开票总额",
      totalPaid: "已支付总额",
      balanceDue: "应付余额",
      payments: "付款（{count}）",
      invoiceTotalSummary: "总额：{total} | 已付：{paid} | 待付：{due}",
      ref: "参考",
      termsConditions: "条款和条件",
      notes: "备注",
      generatingPdf: "正在生成 PDF...",
      downloadPdf: "下载 PDF",
      preparingPrint: "准备打印中...",
      printOrder: "打印订单",
      draft: "草稿",
      confirmed: "已确认",
      inProgress: "进行中",
      shipped: "已发货",
      delivered: "已交付",
      invoiced: "已开票",
      cancelled: "已取消",
      sent: "已发送",
      partiallyPaid: "部分支付",
      paid: "已支付",
      overdue: "逾期",
    },
    quotationsPage: {
      title: "报价单",
      subtitle: "创建和管理销售报价单",
      createQuotation: "创建报价单",
      searchPlaceholder: "搜索报价单...",
      quotationNumber: "报价单号",
      date: "日期",
      validUntil: "有效期至",
      amount: "金额",
      loadError: "加载报价单失败。请重试。",
      empty: "未找到报价单。创建第一张报价单以开始使用。",
      expiringSoon: "即将到期",
      itemsCount: "{count} 个项目",
      changeStatus: "更改状态",
      markAsSent: "标记为已发送",
      markAsAccepted: "标记为已接受",
      markAsRejected: "标记为已拒绝",
      convertToOrder: "转换为订单",
      converted: "已转换",
      convertTitle: "将报价单转换为销售订单",
      convertDescription: "确定要将报价单 {number} 转换为销售订单吗？",
      convertWillLabel: "此操作将：",
      convertBulletCreateOrder: "使用报价单全部信息创建新的销售订单",
      convertBulletCopyItems: "将所有行项目复制到销售订单",
      convertBulletStatus: "将报价单状态更新为“已下单”",
      convertBulletLink: "将报价单关联到新的销售订单",
      convertCannotUndo: "此操作无法撤销。",
      converting: "转换中...",
      convertAction: "转换为销售订单",
      draft: "草稿",
      sent: "已发送",
      accepted: "已接受",
      rejected: "已拒绝",
      expired: "已过期",
      ordered: "已下单",
    },
    quotationForm: {
      customerRequired: "客户为必填项",
      quotationDateRequired: "报价日期为必填项",
      validUntilRequired: "有效期至日期为必填项",
      addLineItemRequired: "请至少添加一个行项目",
      editTitle: "编辑报价单",
      createTitle: "创建新报价单",
      editDescription: "更新报价单详情和行项目。",
      createDescription: "填写报价单详情并添加行项目。",
      generalTab: "常规",
      lineItemsTab: "行项目（{count}）",
      termsTab: "条款和备注",
      customer: "客户",
      selectCustomer: "选择客户",
      quotationDate: "报价日期",
      validUntil: "有效期至",
      lineItemsTitle: "行项目",
      lineItemsDescription: "管理此报价单中的商品或服务",
      addItem: "添加项目",
      noItems: "尚未添加项目。",
      noItemsDescription: "点击“添加项目”开始。",
      qty: "数量",
      unit: "单位",
      price: "价格",
      discountPct: "折扣 %",
      taxPct: "税率 %",
      totals: "合计",
      subtotal: "小计",
      discount: "折扣",
      tax: "税额",
      total: "总计",
      termsConditions: "条款和条件",
      internalNotes: "内部备注",
      saving: "保存中...",
      updateQuotation: "更新报价单",
      createQuotation: "创建报价单",
    },
    quotationLineItemDialog: {
      itemRequired: "项目为必填项",
      quantityRequired: "数量必须大于 0",
      unitPriceRequired: "单价不能为负数",
      uomRequired: "计量单位为必填项",
      editTitle: "编辑行项目",
      createTitle: "添加行项目",
      editDescription: "更新行项目详情。",
      createDescription: "填写新行项目的详细信息。",
      item: "项目",
      searchItem: "搜索项目...",
      itemSearchPlaceholder: "按编码或名称搜索...",
      noItemFound: "未找到项目。",
      stockLabel: "库存",
      description: "描述",
      quantity: "数量",
      unitPrice: "单价",
      discountRate: "折扣 %",
      taxRate: "税率 %",
      subtotal: "小计",
      discount: "折扣",
      tax: "税额",
      lineTotal: "行总计",
      updateItem: "更新项目",
      addItem: "添加项目",
    },
    quotationViewDialog: {
      title: "报价单详情",
      description: "报价单号 #{number}",
      customerInformation: "客户信息",
      name: "名称",
      email: "电子邮箱",
      salesOrder: "销售订单",
      quotationDetails: "报价单详情",
      quotationDate: "报价日期",
      validUntil: "有效期至",
      paymentTerms: "付款条款",
      billingAddress: "账单地址",
      lineItems: "行项目",
      quantity: "数量",
      unit: "单位",
      unitPrice: "单价",
      discount: "折扣",
      tax: "税额",
      total: "总计",
      subtotal: "小计",
      totalAmount: "总金额",
      termsConditions: "条款和条件",
      notes: "备注",
      printQuotation: "打印报价单",
      draft: "草稿",
      sent: "已发送",
      accepted: "已接受",
      rejected: "已拒绝",
      expired: "已过期",
      ordered: "已下单",
    },
    invoicesPage: {
      title: "发票",
      subtitle: "创建和管理销售发票",
      createInvoice: "创建发票",
      searchPlaceholder: "搜索发票...",
      statusPlaceholder: "状态",
      allStatus: "所有状态",
      invoiceNumber: "发票号",
      customer: "客户",
      invoiceDate: "发票日期",
      dueDate: "到期日",
      amount: "金额",
      paid: "已付款",
      due: "待付款",
      status: "状态",
      actions: "操作",
      loadError: "加载发票失败。请重试。",
      empty: "未找到发票。创建第一张发票以开始使用。",
      fromSalesOrder: "来自 {number}",
      overdue: "逾期",
      itemsCount: "{count} 个项目",
      view: "查看",
      printInvoice: "打印发票",
      edit: "编辑",
      sendToCustomer: "发送给客户",
      deleteInvoice: "删除发票",
      recordPayment: "记录付款",
      cancelInvoice: "取消发票",
      sendTitle: "发送发票给客户",
      sendDescription: "确定要将发票 {invoiceNumber} 发送给 {customerName} 吗？",
      sendDescriptionBody: "这将把发票状态更新为“已发送”，客户将能够查看并支付该发票。",
      sending: "发送中...",
      sendAction: "发送发票",
      cancel: "取消",
      cancelTitle: "取消发票",
      cancelDescription:
        "确定要取消发票 {invoiceNumber} 吗？这将把发票标记为已取消，之后不能再发送或付款。此操作无法撤销。",
      cancelling: "取消中...",
      cancelAction: "取消发票",
      deleteTitle: "删除草稿发票",
      deleteDescription: "确定要删除发票 {invoiceNumber} 吗？这将永久删除草稿发票及其所有行项目。",
      deleteLinkedSalesOrderNotice:
        "关联的销售订单将恢复为“已确认”状态，以便再次转换为新发票。",
      deleting: "删除中...",
      deleteAction: "删除发票",
      draft: "草稿",
      sent: "已发送",
      paidStatus: "已付款",
      partiallyPaid: "部分付款",
      overdueStatus: "逾期",
      cancelledStatus: "已取消",
      sendSuccess: "发票发送成功",
      sendError: "发送发票失败",
      cancelSuccess: "发票已取消",
      cancelError: "取消发票失败",
      deleteSuccess: "发票删除成功",
      deleteError: "删除发票失败",
    },
    invoiceForm: {
      customerRequired: "客户为必填项",
      invoiceDateRequired: "发票日期为必填项",
      dueDateRequired: "到期日为必填项",
      dueDateAfterInvoiceDate: "到期日必须晚于或等于发票日期",
      addLineItemRequired: "请至少添加一个行项目",
      missingCustomerDetails: "未找到所选客户详情。",
      editTitle: "编辑发票",
      createTitle: "创建新发票",
      editDescription: "更新发票详情和行项目。",
      createDescription: "填写发票详情并添加行项目。",
      generalTab: "常规",
      lineItemsTab: "行项目（{count}）",
      termsTab: "条款和备注",
      customer: "客户",
      selectCustomer: "选择客户",
      warehouseOptional: "仓库（可选）",
      selectWarehouse: "选择仓库（用于库存校验）",
      none: "无",
      warehouseHelp: "选择仓库以在发送时校验并扣减库存",
      location: "库位",
      selectLocation: "选择库位（可选）",
      selectWarehouseFirst: "请先选择仓库",
      invoiceDate: "发票日期",
      dueDate: "到期日",
      lineItemsTitle: "行项目",
      lineItemsDescription: "管理此发票中的产品或服务",
      addItem: "添加项目",
      noItems: "尚未添加项目。",
      noItemsDescription: "点击“添加项目”开始。",
      item: "项目",
      qty: "数量",
      unit: "单位",
      price: "价格",
      actions: "操作",
      discountPct: "折扣 %",
      taxPct: "税率 %",
      totals: "合计",
      subtotal: "小计",
      discount: "折扣",
      tax: "税额",
      total: "总计",
      termsConditions: "条款和条件",
      internalNotes: "内部备注",
      saving: "保存中...",
      updateInvoice: "更新发票",
      createInvoice: "创建发票",
      createSuccess: "发票创建成功",
      createError: "创建发票失败",
      updateSuccess: "发票更新成功",
      updateError: "更新发票失败",
    },
    invoiceLineItemDialog: {
      itemRequired: "项目为必填项",
      itemCodeRequired: "项目编码为必填项",
      itemNameRequired: "项目名称为必填项",
      quantityRequired: "数量必须大于 0",
      unitPriceRequired: "单价不能为负数",
      discountMin: "折扣不能为负数",
      discountMax: "折扣不能超过 100%",
      taxMin: "税率不能为负数",
      taxMax: "税率不能超过 100%",
      uomRequired: "计量单位为必填项",
      editTitle: "编辑行项目",
      createTitle: "添加行项目",
      editDescription: "更新行项目详情。",
      createDescription: "填写新行项目的详细信息。",
      item: "项目",
      selectItem: "选择项目",
      description: "描述",
      quantity: "数量",
      unitPrice: "单价",
      discountRate: "折扣 %",
      taxRate: "税率 %",
      subtotal: "小计",
      discount: "折扣",
      tax: "税额",
      lineTotal: "行总计",
      cancel: "取消",
      updateItem: "更新项目",
      addItem: "添加项目",
    },
    invoiceViewDialog: {
      title: "发票详情",
      description: "发票号 #{number}",
      customerInformation: "客户信息",
      name: "名称",
      email: "电子邮箱",
      salesOrder: "销售订单",
      invoiceDetails: "发票详情",
      invoiceDate: "发票日期",
      dueDate: "到期日",
      warehouse: "仓库",
      location: "库位",
      paymentTerms: "付款条款",
      defaultPaymentTerms: "月结 30 天",
      billingAddress: "账单地址",
      lineItems: "行项目",
      quantity: "数量",
      unit: "单位",
      unitPrice: "单价",
      discount: "折扣",
      tax: "税额",
      total: "总计",
      subtotal: "小计",
      totalAmount: "总金额",
      amountPaid: "已付款金额",
      amountDue: "待付款金额",
      paymentHistory: "付款记录（{count}）",
      date: "日期",
      paymentNumber: "付款号",
      method: "方式",
      balanceRemaining: "剩余余额",
      reference: "参考号：{value}",
      termsConditions: "条款和条件",
      notes: "备注",
      generatingPdf: "正在生成 PDF...",
      downloadPdf: "下载 PDF",
      preparingPrint: "正在准备打印...",
      printInvoice: "打印发票",
      notAvailable: "无",
      draft: "草稿",
      sent: "已发送",
      paidStatus: "已付款",
      partiallyPaid: "部分付款",
      overdue: "逾期",
      cancelled: "已取消",
    },
    recordPaymentDialog: {
      invoiceIdRequired: "发票 ID 为必填项",
      amountRequired: "金额必须大于 0",
      paymentDateRequired: "付款日期为必填项",
      paymentMethodRequired: "付款方式为必填项",
      title: "记录付款",
      description: "为发票 {invoiceNumber} 记录付款",
      totalAmount: "总金额",
      amountPaid: "已付款金额",
      amountDue: "待付款金额",
      paymentAmount: "付款金额",
      paymentDate: "付款日期",
      paymentMethod: "付款方式",
      selectPaymentMethod: "选择付款方式",
      bankTransfer: "银行转账",
      check: "支票",
      cash: "现金",
      creditCard: "信用卡",
      wireTransfer: "电汇",
      other: "其他",
      referenceNumber: "参考号",
      referencePlaceholder: "支票号、交易编号等",
      notes: "备注",
      notesPlaceholder: "附加付款说明...",
      cancel: "取消",
      recording: "记录中...",
      recordPayment: "记录付款",
      recordSuccess: "付款记录成功",
      recordError: "记录付款失败",
    },
    posPage: {
      title: "收银台",
      subtitle: "为散客提供快速结账",
      searchAndAddItems: "搜索并添加商品...",
      searchItems: "搜索商品...",
      noItemsFound: "未找到商品。",
      outOfStock: "缺货",
      lowStock: "低库存",
      stockLabel: "库存：{count}",
      clear: "清空",
      itemNumber: "#",
      item: "商品",
      unit: "单位",
      price: "价格",
      qty: "数量",
      discount: "折扣",
      total: "总计",
      noItemsInCart: "购物车中没有商品。",
      noItemsInCartDescription: "搜索并添加商品以开始。",
      customer: "客户",
      walkInCustomer: "散客",
      billSummary: "账单汇总",
      items: "商品数",
      subtotal: "小计",
      vat: "增值税 (12%)",
      proceedToPayment: "前往付款",
      paymentMethod: "付款方式",
      cash: "现金",
      card: "银行卡",
      gcash: "GCash",
      maya: "Maya",
      amountReceived: "实收金额",
      change: "找零",
      cancel: "取消",
      completeSale: "完成销售",
      transactionSuccess: "交易完成成功",
      transactionError: "完成交易失败",
      outOfStockError: "{name} 已缺货",
      outOfStockDescription: "无法添加库存为零或负数的商品",
      insufficientStockError: "{name} 库存不足",
      insufficientStockDescription: "仅剩 {available} 件。购物车中当前数量：{current}",
      checkoutStockError: "无法完成结账 - 库存不足",
    },
    posTransactionsPage: {
      title: "POS 交易",
      subtitle: "查看和管理收银交易",
      totalTransactions: "交易总数",
      completed: "已完成",
      voided: "已作废",
      totalSales: "销售总额",
      searchPlaceholder: "按交易号、客户或收银员搜索（至少 3 个字符）",
      statusPlaceholder: "状态",
      allStatus: "所有状态",
      allCashiers: "所有收银员",
      clearFilters: "清除筛选",
      transactionNumber: "交易号",
      dateTime: "日期和时间",
      customer: "客户",
      cashier: "收银员",
      items: "商品",
      amount: "金额",
      status: "状态",
      actions: "操作",
      loading: "正在加载交易...",
      emptyFiltered: "没有符合筛选条件的交易",
      empty: "暂无交易",
      walkInCustomer: "散客",
      itemsCount: "{count} 件商品",
      printReceipt: "打印小票",
      voidTransaction: "作废交易",
      adminPinTitle: "需要管理员验证",
      adminPinDescription: "请输入管理员 PIN 以作废此交易。",
      cancel: "取消",
      voidTitle: "作废交易",
      voidDescription: "确定要作废交易 {transactionNumber} 吗？此操作无法撤销。",
      voidAction: "作废交易",
      voidSuccess: "交易作废成功",
      voidError: "作废交易失败",
      completedStatus: "已完成",
      voidedStatus: "已作废",
    },
    adminPinDialog: {
      defaultTitle: "需要管理员验证",
      defaultDescription: "请输入管理员 PIN 以继续此操作。",
      pinRequired: "请输入 PIN",
      invalidPin: "PIN 无效。请重试。",
      verifyFailed: "验证失败。请重试。",
      pinLabel: "管理员 PIN",
      pinPlaceholder: "输入 PIN",
      cancel: "取消",
      verifying: "验证中...",
      verify: "验证",
    },
    receiptPanel: {
      title: "小票",
      print: "打印",
      download: "下载",
      generating: "正在生成小票...",
      failed: "生成小票失败",
      previewTitle: "小票预览",
    },
    posTransactionDetailsDialog: {
      title: "交易详情",
      printReceipt: "打印小票",
      transactionNumber: "交易号",
      dateTime: "日期和时间",
      cashier: "收银员",
      customer: "客户",
      walkInCustomer: "散客",
      status: "状态",
      items: "商品",
      item: "商品",
      quantity: "数量",
      unitPrice: "单价",
      discount: "折扣",
      total: "总计",
      subtotal: "小计",
      tax: "税额 ({rate}%)",
      totalAmount: "总金额",
      payment: "付款",
      amountPaid: "已付金额",
      change: "找零",
      notes: "备注",
      completed: "已完成",
      voided: "已作废",
      notAvailable: "-",
    },
    itemsPage: {
      title: "库存主数据",
      subtitle: "管理具有实时库存数量的商品",
      exportCsv: "导出 CSV",
      createItem: "创建商品",
      totalItems: "商品总数",
      totalItemsDescription: "库存中的商品",
      totalAvailableValue: "可用库存总值",
      totalAvailableValueDescription: "当前可销售库存",
      lowStock: "低库存",
      lowStockDescription: "已达到或低于补货点",
      outOfStock: "缺货",
      outOfStockDescription: "没有可用库存",
      searchPlaceholder: "按商品编码或名称搜索...",
      categoryPlaceholder: "分类",
      allCategories: "所有分类",
      image: "图片",
      itemCode: "商品编码",
      itemName: "商品名称",
      category: "分类",
      uom: "计量单位",
      onHand: "现有库存",
      allocated: "已分配",
      inTransitQty: "在途数量",
      available: "可用数量",
      normal: "正常",
      overstock: "超储",
      discontinued: "已停用",
      unknown: "未知",
      errorLoadingTitle: "加载商品失败",
      unauthorizedMessage: "请登录后查看库存商品。",
      loadErrorMessage: "无法加载库存数据。请重试。",
      retry: "重试",
      empty: "未找到商品。创建第一个商品以开始使用。",
      deleteTitle: "删除商品",
      deleteDescription: "确定要删除此商品吗？",
      deleteDescriptionWithName: "确定要删除“{name}”吗？此操作无法撤销。",
      deleteSuccess: "商品删除成功",
      deleteError: "删除商品失败",
      noDataToExport: "没有可导出的数据",
      exportSuccess: "库存已导出为 CSV",
      editAriaLabel: "编辑",
      deleteAriaLabel: "删除",
      moreActions: "更多",
    },
    inventoryItemPage: {
      rawMaterial: "原材料",
      finishedGood: "成品",
      asset: "资产",
      service: "服务",
      loadingTitle: "正在加载商品...",
      loadingDescription: "正在加载商品详情，请稍候...",
      errorLoadingTitle: "加载商品失败",
      itemNotFound: "未找到商品",
      itemDetails: "商品详情",
      editItem: "编辑商品",
      addItemDetails: "补充商品信息",
      createNewItem: "创建新商品",
      itemDetailsDescription: "查看商品信息、价格层级和库存位置。",
      editItemDescription: "更新商品信息并在各标签中管理价格层级。",
      addItemDetailsDescription: "商品创建成功。继续在价格和库位标签中完成设置。",
      createNewItemDescription:
        "填写基础商品信息以创建新商品。保存后即可添加价格和库位信息。",
      createPageDescription: "添加新商品到库存",
      updatePageDescription: "更新商品信息",
      generalTab: "常规",
      overviewTab: "概览",
      pricesTab: "价格",
      locationsTab: "库位",
      basicInformation: "基础信息",
      itemCodeLabel: "商品编码 *",
      itemTypeLabel: "商品类型 *",
      selectItemType: "选择商品类型",
      itemNameLabel: "商品名称 *",
      chineseNameLabel: "中文名称",
      descriptionLabel: "描述",
      itemImageLabel: "商品图片",
      classificationAndUnit: "分类与计量单位",
      categoryLabel: "分类 *",
      selectCategory: "选择分类",
      unitOfMeasureLabel: "计量单位 *",
      selectUom: "选择计量单位",
      pricingInformation: "价格信息",
      standardCostLabel: "单位成本",
      listPriceLabel: "售价 *",
      availableQtyLabel: "可用数量",
      reservedQtyLabel: "预留数量",
      onHandLabel: "现有库存",
      inventoryManagement: "库存管理",
      reorderLevelLabel: "补货水平",
      reorderLevelDescription: "当库存低于该水平时提醒",
      reorderQtyLabel: "补货数量",
      reorderQtyDescription: "建议补货数量",
      itemInformationTitle: "商品信息",
      itemInformationDescription: "该商品的基本信息",
      itemInformationCreateDescription: "填写以下信息以创建新商品。",
      itemInformationEditDescription: "更新以下商品详细信息。",
      itemCodeImmutableDescription: "商品编码不可更改",
      itemCodeAutoGenerateDescription: "留空则自动生成",
      activeStatusLabel: "启用状态",
      activeStatusDescription: "设置该商品是否启用并可供使用",
      editItemAction: "编辑商品",
      backToItems: "返回商品列表",
      noCategory: "无分类",
      uncategorized: "未分类",
      perUnitPrefix: "每",
      marginLabel: "毛利率",
      reorderQtyShortLabel: "补货量",
      baseUomLabel: "基础计量单位",
      noImage: "暂无图片",
      qrCodeLabel: "二维码",
      noQrCode: "暂无二维码",
      pricingDetailsTitle: "价格详情",
      pricingDetailsDescription: "成本和价格信息",
      profitMarginLabel: "利润率",
      reorderSettingsDescription: "补货设置和阈值",
      inTransitLabel: "在途",
      itemImageDescription: "上传或更新商品图片",
      qrCodeReadonlyDescription: "SKU 二维码自动生成，不能在这里编辑。",
      noQrCodeAvailable: "暂无可用二维码",
      workflowInfo: "填写以下基础商品信息。保存后即可添加价格层级和库位详情。",
      close: "关闭",
      cancel: "取消",
      edit: "编辑",
      saving: "保存中...",
      updateItem: "更新商品",
      saveAndContinue: "保存并继续",
      itemCodePlaceholder: "ITEM-001",
      itemNamePlaceholder: "输入商品名称",
      chineseNamePlaceholder: "可选中文名称",
      descriptionPlaceholder: "输入描述",
      standardCostPlaceholder: "0.00",
      listPricePlaceholder: "0.00",
      reorderLevelPlaceholder: "0",
      reorderQtyPlaceholder: "0",
      updateSuccess: "商品更新成功",
      missingCompany: "用户公司信息不可用",
      createSuccess: "商品创建成功！",
      createSuccessDescription: "现在可以添加价格和库位信息",
      updateError: "更新商品失败",
      createError: "创建商品失败",
    },
    itemValidation: {
      codeRequired: "商品编码为必填项",
      codeMax: "商品编码不能超过50个字符",
      codeFormat: "商品编码只能包含大写字母、数字、空格和连字符",
      nameRequired: "商品名称为必填项",
      nameMax: "商品名称不能超过200个字符",
      chineseNameMax: "中文名称不能超过200个字符",
      descriptionMax: "描述不能超过1000个字符",
      uomRequired: "计量单位为必填项",
      categoryRequired: "分类为必填项",
      standardCostMin: "标准成本必须大于或等于0",
      listPriceMin: "标价必须大于或等于0",
      reorderLevelMin: "补货水平必须大于或等于0",
      reorderQtyMin: "补货数量必须大于或等于0",
    },
    itemLocationsTab: {
      title: "库位",
      description: "按仓库库位显示库存",
      moveStock: "移动库存",
      loadError: "加载商品库位失败。",
      empty: "未找到库位库存。",
      warehouse: "仓库",
      location: "库位",
      type: "类型",
      onHand: "现有库存",
      reserved: "已预留",
      available: "可用数量",
      inTransit: "在途",
      estArrival: "预计到达",
      defaultBadge: "默认",
      setDefault: "设为默认",
      defaultUpdated: "默认库位已更新",
      updateDefaultError: "更新默认库位失败",
      selectWarehouseAndLocations: "请选择仓库和库位以移动库存。",
      selectDifferentLocations: "请选择两个不同的库位。",
      enterValidQuantity: "请输入有效的移动数量。",
      stockMoved: "库存移动成功",
      moveStockError: "移动库存失败",
      batchCode: "批次编码",
      receivedDate: "收货日期",
      moveDialogTitle: "移动库存",
      moveDialogDescription: "在同一仓库内的库位之间转移库存。",
      warehouseLabel: "仓库",
      selectWarehouse: "选择仓库",
      fromLocationLabel: "来源库位",
      selectSourceLocation: "选择来源库位",
      toLocationLabel: "目标库位",
      selectDestinationLocation: "选择目标库位",
      quantityLabel: "数量",
      quantityPlaceholder: "输入要移动的数量",
      unnamed: "未命名",
      availableShort: "可用",
      cancel: "取消",
      moving: "移动中...",
    },
    itemPricesTab: {
      title: "商品价格",
      description: "管理此商品的多层级价格（如出厂价、批发价、建议零售价）",
      addPrice: "新增价格",
      deleteSuccess: "价格删除成功",
      deleteError: "删除价格失败",
      empty: "此商品暂无价格。",
      emptyDescription: "添加第一个价格层级以开始使用。",
      priceTier: "价格层级",
      tierName: "层级名称",
      price: "价格",
      effectiveFrom: "生效开始",
      effectiveTo: "生效结束",
      status: "状态",
      active: "启用",
      inactive: "停用",
      actions: "操作",
      deleteTitle: "删除价格",
      deleteDescription: "确定要删除此价格吗？",
      deleteDescriptionWithName: "确定要删除“{name}”的价格 ₱{price} 吗？此操作无法撤销。",
    },
    priceFormDialog: {
      editTitle: "编辑价格",
      createTitle: "创建价格",
      editDescription: "更新价格层级信息",
      createDescription: "为此商品新增价格层级",
      priceTierCodeLabel: "价格层级代码",
      priceTierCodeRequired: "价格层级代码为必填项",
      priceTierCodePlaceholder: "例如：fc、ws、srp",
      commonTiers: "常用层级",
      priceTierNameLabel: "价格层级名称",
      priceTierNameRequired: "价格层级名称为必填项",
      priceTierNamePlaceholder: "例如：出厂价、批发价",
      priceLabel: "价格",
      priceRequired: "价格为必填项",
      priceMin: "价格必须大于或等于0",
      pricePlaceholder: "0.0000",
      currencyCodeLabel: "币种代码",
      currencyCodePlaceholder: "PHP",
      currencyCodeDescription: "默认：PHP（菲律宾比索）",
      effectiveFromLabel: "生效开始",
      effectiveFromRequired: "生效开始日期为必填项",
      effectiveToLabel: "生效结束（可选）",
      effectiveToDescription: "留空表示不过期",
      activeLabel: "启用",
      cancel: "取消",
      updateAction: "更新价格",
      createAction: "创建价格",
      createSuccess: "价格创建成功",
      createError: "创建价格失败",
      updateSuccess: "价格更新成功",
      updateError: "更新价格失败",
      noPriceSelected: "未选择价格",
    },
    stockTransactionsPage: {
      title: "库存交易",
      subtitle: "跟踪所有库存移动和调整",
      newTransaction: "新建交易",
      searchPlaceholder: "搜索交易...",
      typePlaceholder: "类型",
      allTypes: "所有类型",
      stockIn: "入库",
      stockOut: "出库",
      transfer: "调拨",
      adjustment: "调整",
      date: "日期",
      type: "类型",
      item: "商品",
      warehouse: "仓库",
      location: "库位",
      quantity: "数量",
      reference: "参考单号",
      reason: "原因",
      createdBy: "创建人",
      loadingError: "加载库存交易失败。请重试。",
      emptyTitle: "未找到库存交易",
      emptyDescription: "请尝试调整搜索条件或筛选项。",
      badgeIn: "入库",
      badgeOut: "出库",
      badgeTransfer: "调拨",
      badgeAdjustment: "调整",
    },
    stockTransactionForm: {
      title: "新建库存交易",
      description: "记录新的库存移动或调整",
      transactionDateLabel: "交易日期 *",
      transactionTypeLabel: "交易类型 *",
      selectType: "选择类型",
      warehouseLabel: "仓库 *",
      fromWarehouseLabel: "来源仓库 *",
      toWarehouseLabel: "目标仓库 *",
      selectWarehouse: "选择仓库",
      selectDestinationWarehouse: "选择目标仓库",
      fromLocationLabel: "来源库位",
      toLocationLabel: "目标库位",
      destinationLocationLabel: "目标库位",
      sourceLocationLabel: "来源库位",
      selectLocation: "选择库位",
      selectWarehouseFirst: "请先选择仓库",
      selectDestinationWarehouseFirst: "请先选择目标仓库",
      itemLabel: "商品 *",
      selectWarehouseFirstItem: "请先选择仓库...",
      searchItem: "搜索商品...",
      searchItemByCodeOrName: "按编码或名称搜索...",
      noItemFound: "未找到商品。",
      stockLabel: "库存",
      quantityLabel: "数量 *",
      quantityPlaceholder: "0",
      referenceNumberLabel: "参考单号",
      referenceNumberPlaceholder: "PO-2024-001、SO-2024-001 等",
      reasonLabel: "原因 *",
      selectReason: "选择原因",
      notesLabel: "备注",
      notesPlaceholder: "附加备注...",
      cancel: "取消",
      createAction: "创建交易",
      creating: "创建中...",
      invalidItem: "所选商品无效或未设置计量单位",
      transferCreated: "库存调拨创建成功",
      transferCreatedDescription: "司机必须确认收货。",
      createSuccess: "库存交易创建成功",
      createError: "创建库存交易失败",
      reasonPurchaseReceipt: "采购收货",
      reasonProductionOutput: "生产产出",
      reasonCustomerReturn: "客户退货",
      reasonOther: "其他",
      reasonSalesOrder: "销售订单",
      reasonProductionConsumption: "生产领用",
      reasonDamageLoss: "损坏/丢失",
      reasonStockRebalancing: "库存再平衡",
      reasonCustomerRequest: "客户请求",
      reasonWarehouseConsolidation: "仓库整合",
      reasonPhysicalCountAdjustment: "盘点调整",
      reasonDamagedGoods: "货品损坏",
      reasonSystemCorrection: "系统修正",
    },
    stockTransactionValidation: {
      transactionDateRequired: "交易日期为必填项",
      itemRequired: "商品为必填项",
      warehouseRequired: "仓库为必填项",
      quantityMin: "数量必须大于 0",
      uomRequired: "计量单位为必填项",
      reasonRequired: "原因为必填项",
      destinationWarehouseRequired: "调拨必须选择目标仓库",
    },
    stockTransactionDetail: {
      titleDescription: "库存交易详情",
      transactionInformation: "交易信息",
      transactionCode: "交易编码",
      type: "类型",
      status: "状态",
      transactionDate: "交易日期",
      reference: "参考单号",
      notes: "备注",
      warehouseInformation: "仓库信息",
      sourceLocation: "来源位置",
      destinationLocation: "目标位置",
      location: "库位",
      createdBy: "创建人",
      createdAt: "创建时间",
      transactionItems: "交易项目",
      itemCode: "商品编码",
      itemName: "商品名称",
      qtyBefore: "变动前数量",
      quantity: "数量",
      qtyAfter: "变动后数量",
      unitCost: "单位成本",
      totalCost: "总成本",
      stockValueChanges: "库存价值变化",
      item: "商品",
      valuationRate: "计价率",
      valueBefore: "变动前价值",
      valueAfter: "变动后价值",
      change: "变化",
      totalCostLabel: "总成本",
      stockIn: "入库",
      stockOut: "出库",
      transfer: "调拨",
      adjustment: "调整",
      statusPosted: "已过账",
      statusDraft: "草稿",
      statusCompleted: "已完成",
      statusCancelled: "已取消",
      loadError: "加载库存交易失败",
    },
    stockAdjustmentsPage: {
      title: "库存调整",
      subtitle: "管理库存修正和调整",
      createAdjustment: "创建调整",
      searchPlaceholder: "搜索调整单...",
      statusPlaceholder: "状态",
      typePlaceholder: "类型",
      allStatus: "所有状态",
      allTypes: "所有类型",
      draft: "草稿",
      pending: "待处理",
      approved: "已批准",
      posted: "已过账",
      rejected: "已拒绝",
      physicalCount: "盘点",
      damage: "损坏",
      loss: "损失",
      found: "盘盈",
      qualityIssue: "质量问题",
      other: "其他",
      adjustmentNumber: "调整单号",
      type: "类型",
      date: "日期",
      warehouse: "仓库",
      location: "库位",
      reason: "原因",
      totalValue: "总价值",
      status: "状态",
      actions: "操作",
      loadingError: "加载库存调整失败。请重试。",
      emptyTitle: "未找到库存调整",
      emptyDescription: "创建第一张调整单以开始使用。",
      itemsCount: "{count, plural, one {# 个项目} other {# 个项目}}",
      post: "过账",
      deleteTitle: "删除库存调整",
      deleteDescription: "确定要删除调整单 {code} 吗？此操作无法撤销。",
      deleting: "删除中...",
      postTitle: "过账库存调整",
      postDescription: "确定要过账调整单 {code} 吗？",
      postStepCreateTransaction: "创建库存交易",
      postStepUpdateStock: "更新仓库库存数量",
      postStepUpdateLedger: "更新库存台账",
      summaryLabel: "这将会",
      postActionWarning: "此操作无法撤销。",
      posting: "过账中...",
      postAction: "过账调整",
      noLocation: "--",
    },
    stockAdjustmentForm: {
      editTitle: "编辑库存调整",
      createTitle: "创建库存调整",
      editDescription: "编辑调整单 {code}",
      createDescription: "创建新的库存调整",
      generalInformation: "基本信息",
      adjustmentTypeLabel: "调整类型",
      selectType: "选择类型",
      adjustmentDateLabel: "调整日期",
      warehouseLabel: "仓库",
      selectWarehouse: "选择仓库",
      locationLabel: "库位",
      selectLocation: "选择库位",
      selectWarehouseFirst: "请先选择仓库",
      reasonLabel: "原因",
      reasonPlaceholder: "输入调整原因",
      notesLabel: "备注（可选）",
      notesPlaceholder: "附加备注...",
      lineItemsTitle: "明细项目",
      lineItemsDescription: "添加需要调整库存的商品",
      addItem: "添加商品",
      selectWarehouseBeforeItems: "添加商品前请先选择仓库",
      noItems: "尚未添加商品。",
      noItemsDescription: "点击“添加商品”开始。",
      item: "商品",
      currentQty: "当前数量",
      adjustedQty: "调整后数量",
      difference: "差异",
      unitCost: "单位成本",
      totalValue: "总价值",
      actions: "操作",
      summary: "汇总",
      totalAdjustmentValue: "调整总价值",
      cancel: "取消",
      saving: "保存中...",
      updateAction: "更新调整",
      createAction: "创建调整",
      lineItemRequired: "请至少添加一条明细项目",
    },
    stockAdjustmentValidation: {
      adjustmentDateRequired: "调整日期为必填项",
      warehouseRequired: "仓库为必填项",
      reasonRequired: "原因为必填项",
    },
    stockAdjustmentLineItemDialog: {
      editTitle: "编辑库存调整",
      createTitle: "新增库存调整",
      editDescription: "更新以下调整明细",
      createDescription: "为指定商品调整库存数量",
      selectItemStep: "选择商品",
      adjustmentDetailsStep: "调整详情",
      summaryStep: "汇总",
      itemLabel: "库存商品",
      chooseItem: "选择要调整的商品",
      searchByCodeOrName: "按编码或名称搜索...",
      currentStockOnHand: "当前现有库存",
      units: "单位",
      typeLabel: "类型",
      selectType: "选择类型",
      increaseStock: "增加库存",
      decreaseStock: "减少库存",
      quantityLabel: "数量",
      quantityPlaceholder: "0.00",
      unitCostLabel: "单位成本",
      summary: "汇总",
      newStockLevel: "新库存水平",
      currentStock: "当前库存",
      adjustment: "调整量",
      newStock: "新库存",
      valueImpact: "价值影响",
      valueImpactFormula: "{quantity} {uom} x {unitCost}",
      cancel: "取消",
      updateAction: "更新调整",
      createAction: "添加调整",
    },
    stockAdjustmentLineItemValidation: {
      itemRequired: "商品为必填项",
      uomRequired: "计量单位为必填项",
      currentQtyMin: "当前数量不能为负数",
      adjustedQtyMin: "调整后数量不能为负数",
      unitCostMin: "单位成本不能为负数",
    },
    deliveryNotesPage: {
      title: "送货单",
      subtitle: "管理库存申请履行的送货单生命周期",
      createDn: "创建送货单",
      searchPlaceholder: "搜索送货单或仓库...",
      statusPlaceholder: "状态",
      allStatus: "所有状态",
      draft: "草稿",
      confirmed: "已确认",
      queuedForPicking: "待拣货",
      pickingInProgress: "拣货中",
      dispatchReady: "待发运",
      dispatched: "已发运",
      received: "已接收",
      voided: "已作废",
      dnNo: "送货单号",
      requestedBy: "申请方",
      fulfilledBy: "履行方",
      pickList: "拣货单",
      status: "状态",
      actions: "操作",
      emptyTitle: "未找到送货单",
      emptyFilteredDescription: "请调整搜索条件或筛选项。",
      emptyDescription: "创建第一张送货单以开始使用。",
      noValue: "--",
      view: "查看",
      generatingPdf: "正在生成 PDF...",
      printPdf: "打印 PDF",
      confirm: "确认",
      queuePicking: "加入拣货",
      dispatch: "发运",
      receive: "接收",
      void: "作废",
      createDialogTitle: "创建送货单",
      createDialogDescription: "选择来源业务单元，然后选择要分配的库存申请行项目。",
      requestSourceBusinessUnit: "申请来源业务单元",
      selectSourceBusinessUnit: "选择来源业务单元",
      fulfillmentMode: "履行方式",
      selectFulfillmentMode: "选择履行方式",
      transferToStore: "调拨到门店",
      customerPickupWarehouse: "客户自提（仓库）",
      fulfillmentModeHint: "客户自提将跳过目标库存接收入账，改为直接完成提货。",
      notes: "备注",
      sourceBuLabel: "来源业务单元：",
      eligibleLabel: "可用：",
      selectedLabel: "已选：",
      selectSourceBuHint: "请选择来源业务单元以加载库存申请行项目",
      use: "使用",
      sr: "申请单",
      item: "商品",
      requested: "申请数量",
      allocatable: "可分配",
      allocated: "已分配",
      availableLabel: "可用：",
      insufficientInventory: "此分配的库存不足。",
      noEligibleLines: "该来源业务单元没有符合条件的库存申请行项目",
      cancel: "取消",
      create: "创建",
      action: "操作",
      actionDescriptionFallback: "查看详情并确认操作。",
      loadingDetails: "正在加载详情...",
      loadDetailsError: "无法加载送货单详情。",
      source: "来源",
      destination: "目的地",
      request: "申请单",
      unit: "单位",
      picked: "已拣货",
      dispatchedQty: "已发运",
      assignPickers: "分配拣货员",
      searchNameOrEmail: "搜索姓名或邮箱...",
      noPickersFound: "未找到拣货员",
      pickersSelected: "已选择 {count} 名拣货员",
      pickingInstructions: "拣货说明",
      optionalPickingInstructions: "可选的拣货说明...",
      driverName: "司机姓名",
      enterDriverName: "输入司机姓名",
      dispatchNotes: "发运备注",
      optionalDispatchNotes: "可选的发运备注...",
      receiveNotes: "接收备注",
      optionalReceiveNotes: "可选的接收备注...",
      voidReason: "作废原因",
      voidReasonPlaceholder: "请提供作废此送货单的原因...",
      confirmCreatePickList: "确认创建拣货单",
      confirmDispatch: "确认发运",
      confirmReceive: "确认接收",
      confirmVoid: "确认作废",
      unknownWarehouse: "未知仓库",
      createError: "无法创建送货单。请检查分配数量后重试。",
      confirmTitle: "确认送货单",
      queuePickingTitle: "加入拣货",
      dispatchTitle: "发运送货单",
      receiveTitle: "接收送货单",
      voidTitle: "作废送货单",
      confirmDescription: "请查看以下详情，然后确认此送货单。",
      queuePickingDescription: "查看此送货单，分配拣货员，然后创建拣货单。",
      dispatchDescription: "查看详情并确认发运。发运数量将使用已拣货数量。",
      receiveDescription: "查看详情并确认接收。",
      voidDescription: "查看详情并确认作废。",
    },
    deliveryNoteDetailPage: {
      loading: "加载中...",
      loadError: "加载送货单失败。",
      title: "送货单",
      confirm: "确认",
      queuePicking: "加入拣货",
      void: "作废",
      status: "状态",
      sourceWarehouse: "来源仓库",
      destinationWarehouse: "目标仓库",
      linkedPickList: "关联拣货单",
      noValue: "--",
      totalItems: "商品总数",
      totalAllocated: "已分配总数",
      totalShort: "短缺总数",
      itemDetails: "商品明细",
      stockRequest: "库存申请",
      item: "商品",
      uom: "单位",
      allocated: "已分配",
      picked: "已拣货",
      short: "短缺",
      dispatchedQty: "已发运",
      actions: "操作",
      pickingControl: "拣货控制",
      pickingControlDescription: "拣货进度和状态流转在拣货单页面管理。",
      openPickLists: "打开拣货单",
      dispatchInformation: "发运信息",
      driverName: "司机姓名",
      enterDriverName: "输入司机姓名",
      driverSignature: "司机签名",
      required: "必填",
      dispatchNotes: "发运备注",
      optionalNotes: "可选备注",
      dispatching: "发运中...",
      confirmDispatch: "确认发运",
      receiveDelivery: "接收送货",
      receiveNotes: "接收备注",
      receivedQuantities: "接收数量",
      qty: "数量：",
      receiving: "接收中...",
      confirmReceive: "确认接收",
      voidInformation: "作废信息",
      voidReason: "作废原因",
      voidDeliveryNote: "作废送货单",
      reasonForVoidingOptional: "作废原因（可选）",
      timeline: "时间线",
      byUser: "由 {user}",
      createPickList: "创建拣货单",
      createPickListDescription: "为 {code} 分配拣货员。拣货员分配由拣货单负责。",
      assignPickers: "分配拣货员",
      searchNameOrEmail: "搜索姓名或邮箱...",
      noMatchingUsers: "未找到匹配的用户",
      pickersSelected: "已选择 {count} 名拣货员",
      pickingInstructions: "拣货说明",
      optionalPickingInstructions: "可选的拣货说明...",
      cancel: "取消",
      creating: "创建中...",
      created: "已创建",
      confirmed: "已确认",
      pickingStarted: "开始拣货",
      pickingCompleted: "完成拣货",
      dispatched: "已发运",
      received: "已接收",
      voided: "已作废",
      draft: "草稿",
      confirmedStatus: "已确认",
      queuedForPicking: "待拣货",
      pickingInProgress: "拣货中",
      dispatchReady: "待发运",
      dispatchedStatus: "已发运",
      receivedStatus: "已接收",
      voidedStatus: "已作废",
      lineState: "行状态",
      editQty: "编辑数量",
      voidItem: "作废行项目",
      addItems: "添加商品",
      addItemsDescription: "向此送货单添加可分配的库存申请商品，并创建新的拣货单。",
      adjustItem: "调整已发运商品",
      adjustItemDescription: "减少已发运数量，或设为零以作废该行并回退库存。",
      newDispatchedQty: "新的已发运数量",
      reason: "原因",
      reasonOptional: "原因（可选）",
      saveAdjustment: "保存调整",
      savingAdjustment: "保存中...",
      pendingPicking: "待拣货",
      lineVoided: "已作废行",
      searchItems: "搜索库存申请或商品...",
      noAllocatableItems: "没有可分配的库存申请商品。",
      requestedQty: "申请数量",
      availableQty: "可分配数量",
      selectQtyToAdd: "添加数量",
      addSelectedItems: "添加商品并创建拣货单",
      creatingReplacementPickList: "正在创建拣货单...",
      unknownSourceWarehouse: "未知来源仓库",
      unknownDestinationWarehouse: "未知目标仓库",
      unknownItem: "未知商品",
      unknownUnit: "未知单位",
      unknownStockRequest: "未知库存申请",
    },
    pickListsPage: {
      title: "拣货单",
      subtitle: "管理拣货员分配、拣货数量和状态流转",
      searchPlaceholder: "搜索拣货单、送货单或分配人员...",
      filterStatus: "筛选状态",
      allStatuses: "所有状态",
      pending: "待处理",
      inProgress: "进行中",
      paused: "已暂停",
      done: "已完成",
      cancelled: "已取消",
      pickListNumber: "拣货单号",
      deliveryNote: "送货单",
      status: "状态",
      assignees: "分配人员",
      created: "创建时间",
      actions: "操作",
      emptyTitle: "未找到拣货单",
      emptyFilteredDescription: "请调整搜索条件或筛选项。",
      emptyDescription: "从送货单创建后，拣货单将显示在这里。",
      noValue: "--",
      noAssignees: "未分配人员",
      viewDetails: "查看详情",
      pickListDetails: "拣货单详情",
      deliveryNoteLabel: "送货单：",
      statusLabel: "状态：",
      assignedPickers: "已分配拣货员",
      unknown: "未知",
      pickListItems: "拣货单项目",
      item: "商品",
      uom: "单位",
      allocated: "已分配",
      picked: "已拣货",
      short: "短缺",
      saving: "保存中...",
      savePickedQuantities: "保存拣货数量",
      statusActions: "状态操作",
      startPicking: "开始拣货",
      pause: "暂停",
      completePicking: "完成拣货",
      resumePicking: "继续拣货",
      cancelThisPickList: "取消此拣货单",
      cancelReasonPlaceholder: "取消原因（可选）",
      cancelPickList: "取消拣货单",
      close: "关闭",
    },
    reorderManagementPage: {
      title: "补货管理",
      subtitle: "监控库存水平、管理补货建议并配置自动补货",
      noMatchingItemsForAlerts: "未找到与所选预警匹配的商品。",
      highPriority: "高优先级",
      mediumPriority: "中优先级",
      lowPriority: "低优先级",
      pending: "待处理",
      approved: "已批准",
      rejected: "已拒绝",
      ordered: "已下单",
      critical: "严重",
      warning: "警告",
      info: "信息",
      itemsOk: "库存正常商品",
      adequatelyStocked: "库存充足",
      lowStock: "低库存",
      belowReorderPoint: "低于补货点",
      belowMinimumLevel: "低于最低库存",
      pendingOrders: "待处理订单",
      awaitingApproval: "等待审批",
      estimatedCost: "预计成本",
      totalReorderValue: "补货总价值",
      reorderSuggestionsTab: "补货建议 ({count})",
      activeAlertsTab: "有效预警 ({count})",
      reorderSuggestions: "补货建议",
      reorderSuggestionsDescription: "根据库存水平审查并批准自动补货建议",
      noReorderSuggestions: "当前没有补货建议",
      allItemsAdequatelyStocked: "所有商品库存均充足",
      itemCode: "商品编码",
      warehouse: "仓库",
      currentStock: "当前库存",
      reorderPoint: "补货点",
      suggestedQty: "建议数量",
      estimatedCostShort: "预计成本",
      supplier: "供应商",
      leadTime: "交货周期",
      leadTimeDays: "{count} 天",
      reason: "原因",
      approve: "批准",
      reject: "拒绝",
      stockLevelAlerts: "库存水平预警",
      stockLevelAlertsDescription: "需要立即关注商品的严重和警告预警",
      createPurchaseOrder: "创建采购订单",
      severity: "严重程度",
      item: "商品",
      stockLevel: "库存水平",
      message: "消息",
      action: "操作",
      noActiveAlerts: "没有有效预警",
      allStockLevelsAcceptable: "所有库存水平均在可接受范围内",
      selectAllAlerts: "选择所有预警",
      selectAlertFor: "选择 {itemName} 的预警",
      minLabel: "最小值",
      reorderShort: "补货点",
      acknowledge: "确认",
    },
    purchasingOverviewPage: {
      title: "概览",
      subtitle: "采购的战略与运营概览",
      allWarehouses: "所有仓库",
      refresh: "刷新",
      warehouseOperations: "仓库运营",
      warehouseOperationsDescription: "实时运营队列与仓容状态",
      footerAutoRefresh:
        "仪表板会根据不同组件每 2-5 分钟自动刷新。点击刷新可立即更新。",
    },
    purchasingOverviewWidgets: {
      anErrorOccurred: "发生错误",
      notAvailable: "无",
      unknown: "未知",
      unknownSupplier: "未知供应商",
      count: "数量",
      totalValue: "总价值",
      pending: "待处理",
      approved: "已批准",
      rejected: "已拒绝",
      ordered: "已下单",
      submitted: "已提交",
      fulfilled: "已完成",
      cancelled: "已取消",
      partiallyFulfilled: "部分完成",
      pendingDraft: "草稿",
      critical: "严重",
      warning: "警告",
      good: "良好",
      poor: "较差",
      excellent: "优秀",
      queue: "队列",
      outstandingRequisitionsTitle: "未完成请购",
      outstandingRequisitionsDescription: "等待履行的有效库存请购",
      failedLoadRequisitionsData: "加载请购数据失败",
      noOutstandingRequisitions: "没有未完成请购",
      allStockRequisitionsFulfilled: "所有库存请购均已完成",
      recentRequisitions: "最近请购",
      partial: "部分",
      viewAllRequisitions: "查看所有请购",
      expectedArrivalsThisWeekTitle: "本周预计到货",
      upcomingDeliveriesSchedule: "即将到货时间表",
      failedLoadArrivalsData: "加载到货数据失败",
      noExpectedArrivalsThisWeek: "本周没有预计到货",
      checkBackLaterForUpdates: "稍后回来查看更新",
      totalDeliveries: "总送货数",
      weeklySchedule: "每周计划",
      noDeliveries: "无送货",
      viewAllLoadLists: "查看所有装载单",
      incomingDeliveriesTitle: "到货送货",
      deliveriesLinkedToStockRequisitions: "与库存请购关联的送货",
      failedLoadDeliveriesData: "加载送货数据失败",
      noIncomingDeliveries: "没有到货送货",
      noLoadListsWithLinkedRequisitions: "没有关联请购的装载单",
      deliveries: "送货",
      expectedDeliveries: "预计送货",
      sr: "请购",
      srs: "请购",
      eta: "预计到达",
      viewAllDeliveries: "查看所有送货",
      delayedShipmentsTitle: "延迟发运",
      shipmentsPastEstimatedArrivalDate: "超过预计到达日期的发运",
      failedLoadDelayedShipments: "加载延迟发运失败",
      noDelayedShipments: "没有延迟发运",
      allDeliveriesOnTrack: "所有送货都在按计划进行！",
      criticalDelaysAlert: "{count} 个严重延迟（逾期超过 7 天），需要立即处理。",
      overdueShipments: "逾期发运",
      mostOverdueFirst: "最逾期优先",
      expected: "预计",
      daysLate: "延迟 {count} 天",
      viewAllDelayedShipments: "查看所有延迟发运",
      todaysReceivingQueueTitle: "今日收货队列",
      loadListsArrivedToday: "今日到达的装载单",
      failedLoadReceivingQueue: "加载收货队列失败",
      noItemsInReceivingQueue: "收货队列中没有项目",
      noLoadListsArrivedToday: "今天没有装载单到达",
      toReceive: "待接收",
      arrived: "已到达",
      start: "开始",
      resume: "继续",
      viewAllReceiving: "查看全部收货",
      pendingApprovalsTitle: "待审批",
      grnsAwaitingApproval: "等待审批的收货单",
      failedLoadPendingApprovals: "加载待审批数据失败",
      allCaughtUp: "已全部处理！",
      noGrnsAwaitingApproval: "没有等待审批的收货单",
      overdueGrnsAlert: "{count} 个收货单已等待超过 24 小时",
      awaitingApprovalLabel: "等待审批",
      grns: "收货单",
      loadList: "装载单",
      hoursShort: "{count} 小时",
      overdue: "逾期",
      viewAllGrns: "查看所有收货单",
      boxAssignmentQueueTitle: "箱号分配队列",
      itemsAwaitingBoxAssignment: "等待箱号分配的项目",
      failedLoadBoxAssignmentQueue: "加载箱号分配队列失败",
      allItemsAssigned: "所有项目已分配！",
      noItemsAwaitingBoxAssignment: "没有等待箱号分配的项目",
      itemsPending: "待处理项目",
      unitsReceived: "已接收 {count} 件",
      assign: "分配",
      viewAllItems: "查看所有项目",
      warehouseCapacityTitle: "仓库容量",
      spaceUtilizationMetrics: "空间利用率指标",
      failedLoadCapacityData: "加载容量数据失败",
      noCapacityDataAvailable: "没有可用容量数据",
      warehouseAtCapacityAlert: "仓库容量已达到 {value}%。请考虑扩容或优化存储。",
      utilization: "利用率",
      total: "总数",
      occupied: "已占用",
      available: "可用",
      capacityUsed: "已用容量",
      spaceRemaining: "剩余空间",
      locationsRemaining: "{count} 个库位",
      recommendations: "建议",
      reviewSlowMovingInventory: "检查滞销库存",
      optimizeBinAssignments: "优化库位分配",
      considerWarehouseExpansion: "考虑扩展仓库",
      damagedItemsThisMonthTitle: "本月损坏商品",
      qualityIssuesAndValueImpact: "质量问题与价值影响",
      failedLoadDamagedItemsData: "加载损坏商品数据失败",
      noDamagedItemsThisMonth: "本月没有损坏商品",
      excellentQualityRecord: "质量记录优秀！",
      highDamageCountDetected: "检测到高损坏数量（{count} 件）。请与供应商检查质量问题。",
      bySupplier: "按供应商",
      byType: "按类型",
      broken: "破损",
      defective: "缺陷",
      missing: "缺失",
      expired: "过期",
      wrongItem: "错误商品",
      other: "其他",
      viewDamageReports: "查看损坏报告",
      activeRequisitionsTitle: "有效请购",
      requisitionStatusBreakdown: "请购状态分布",
      noActiveRequisitions: "没有有效请购",
      totalRequisitions: "请购总数",
      statusDistribution: "状态分布",
      byStatus: "按状态",
      activeContainersTitle: "有效集装箱",
      containersCurrentlyInTransit: "当前在途的集装箱",
      failedLoadContainersData: "加载集装箱数据失败",
      noActiveContainers: "没有有效集装箱",
      allContainersReceived: "所有集装箱均已接收",
      inTransit: "在途",
      trackedContainers: "跟踪中的集装箱",
      overdueLabel: "逾期",
      confirmed: "已确认",
      viewAllContainers: "查看所有集装箱",
      locationAssignmentTitle: "库位分配",
      warehouseLocationAssignmentStatus: "仓库库位分配状态",
      failedLoadLocationData: "加载库位数据失败",
      noBoxesInSystem: "系统中没有箱号",
      noLocationDataAvailable: "没有可用库位数据",
      boxesAssignedAlert: "只有 {value}% 的箱号已分配库位。请分配库位以改善跟踪。",
      assignmentRate: "分配率",
      assigned: "已分配",
      unassigned: "未分配",
      locationsAssigned: "已分配库位",
      needAssignment: "待分配",
      boxesCount: "{count} 个箱号",
      viewUnassignedBoxes: "查看未分配箱号（{count}）",
      assignLocationsImproveTracking: "分配库位以改善库存跟踪",
      useBatchAssignmentForEfficiency: "使用批量分配提升效率",
      reviewWarehouseLayoutOptimization: "检查仓库布局优化",
    },
    suppliersPage: {
      title: "供应商主数据",
      subtitle: "管理供应商账户和合作关系",
      createSupplier: "创建供应商",
      searchPlaceholder: "搜索供应商...",
      statusPlaceholder: "状态",
      allStatus: "所有状态",
      statusActive: "启用",
      statusInactive: "停用",
      statusBlacklisted: "黑名单",
      code: "编码",
      supplier: "供应商",
      contactPerson: "联系人",
      contactInfo: "联系方式",
      location: "位置",
      paymentTerms: "付款条件",
      creditLimit: "信用额度",
      balance: "余额",
      status: "状态",
      actions: "操作",
      loadError: "加载供应商失败。请重试。",
      emptyTitle: "未找到供应商",
      emptyDescription: "创建第一个供应商以开始使用。",
      paymentCod: "货到付款",
      paymentNet7: "7天账期",
      paymentNet15: "15天账期",
      paymentNet30: "30天账期",
      paymentNet45: "45天账期",
      paymentNet60: "60天账期",
      paymentNet90: "90天账期",
      editSupplier: "编辑供应商",
      deleteSupplier: "删除供应商",
      deleteTitle: "删除供应商",
      deleteDescription: "确定要删除 {name} 吗？此操作无法撤销，系统将永久移除此供应商。",
      cancel: "取消",
      deleting: "删除中...",
      delete: "删除",
      deleteSuccess: "供应商删除成功",
      deleteError: "删除供应商失败",
    },
    supplierForm: {
      editTitle: "编辑供应商",
      createTitle: "创建新供应商",
      editDescription: "更新下方供应商信息",
      createDescription: "填写下方供应商信息以创建新供应商",
      generalTab: "基本信息",
      billingTab: "账单地址",
      shippingTab: "收货地址",
      paymentTab: "付款信息",
      bankTab: "银行信息",
      supplierCodeLabel: "供应商编码 *",
      supplierCodePlaceholder: "SUPP-001",
      languageLabel: "语言 *",
      selectLanguage: "选择语言",
      statusLabel: "状态 *",
      selectStatus: "选择状态",
      supplierNameLabel: "供应商名称 *",
      supplierNamePlaceholder: "输入供应商名称",
      contactPersonLabel: "联系人 *",
      contactPersonPlaceholder: "输入联系人姓名",
      emailLabel: "邮箱 *",
      emailPlaceholder: "supplier@email.com",
      phoneLabel: "电话 *",
      phonePlaceholder: "+63-2-8123-4567",
      mobileLabel: "手机",
      mobilePlaceholder: "+63-917-123-4567",
      websiteLabel: "网站",
      websitePlaceholder: "www.supplier.com",
      taxIdLabel: "税号",
      taxIdPlaceholder: "TIN-123-456-789-000",
      billingAddressLabel: "地址 *",
      shippingAddressLabel: "地址",
      addressPlaceholder: "街道地址",
      cityLabel: "城市 *",
      cityPlaceholder: "城市",
      stateLabel: "州/省 *",
      statePlaceholder: "州/省",
      postalCodeLabel: "邮政编码 *",
      postalCodePlaceholder: "邮政编码",
      countryLabel: "国家 *",
      selectCountry: "选择国家",
      sameAsBilling: "与账单地址相同",
      paymentTermsLabel: "付款条件 *",
      selectPaymentTerms: "选择付款条件",
      creditLimitLabel: "信用额度",
      creditLimitPlaceholder: "0.00",
      notesLabel: "备注",
      notesPlaceholder: "关于此供应商的附加说明",
      bankNameLabel: "银行名称",
      bankNamePlaceholder: "银行名称",
      bankAccountNameLabel: "账户名称",
      bankAccountNamePlaceholder: "账户持有人姓名",
      bankAccountNumberLabel: "账号",
      bankAccountNumberPlaceholder: "账号",
      cancel: "取消",
      saving: "保存中...",
      updateAction: "更新供应商",
      createAction: "创建供应商",
      updateSuccess: "供应商更新成功",
      createSuccess: "供应商创建成功",
      updateError: "更新供应商失败",
      createError: "创建供应商失败",
      missingCompanyInfo: "用户公司信息不可用",
      statusActive: "启用",
      statusInactive: "停用",
      statusBlacklisted: "黑名单",
      languageEnglish: "英语",
      languageChinese: "中文",
      paymentCod: "货到付款",
      paymentNet7: "7天账期",
      paymentNet15: "15天账期",
      paymentNet30: "30天账期",
      paymentNet45: "45天账期",
      paymentNet60: "60天账期",
      paymentNet90: "90天账期",
      countryPhilippines: "菲律宾",
      countryUsa: "美国",
      countryChina: "中国",
      countryJapan: "日本",
      countrySingapore: "新加坡",
      countryMalaysia: "马来西亚",
      countryThailand: "泰国",
    },
    supplierValidation: {
      codeRequired: "供应商编码为必填项",
      nameRequired: "供应商名称为必填项",
      contactPersonRequired: "联系人为必填项",
      invalidEmail: "邮箱地址无效",
      phoneRequired: "电话号码为必填项",
      billingAddressRequired: "账单地址为必填项",
      cityRequired: "城市为必填项",
      stateRequired: "州/省为必填项",
      postalCodeRequired: "邮政编码为必填项",
      countryRequired: "国家为必填项",
      creditLimitMin: "信用额度必须大于或等于零",
    },
    stockRequisitionsPage: {
      title: "库存请购",
      subtitle: "管理供应商库存请购",
      createAction: "创建库存请购",
      searchPlaceholder: "按请购单号或备注搜索...",
      statusPlaceholder: "状态",
      supplierPlaceholder: "供应商",
      allStatus: "所有状态",
      allSuppliers: "所有供应商",
      draft: "草稿",
      submitted: "已提交",
      partiallyFulfilled: "部分完成",
      fulfilled: "已完成",
      cancelled: "已取消",
      srNumber: "请购单号",
      supplier: "供应商",
      requisitionDate: "请购日期",
      requiredBy: "需求日期",
      totalAmount: "总金额",
      status: "状态",
      createdBy: "创建人",
      actions: "操作",
      loadError: "加载库存请购失败。请重试。",
      emptyTitle: "未找到库存请购",
      emptyDescription: "创建第一张库存请购以开始使用。",
      view: "查看",
      edit: "编辑",
      delete: "删除",
      deleteTitle: "删除库存请购",
      deleteDescription: "确定要删除 {number} 吗？此操作无法撤销，系统将永久移除此库存请购。",
      cancel: "取消",
      deleting: "删除中...",
      deleteSuccess: "库存请购删除成功",
      deleteError: "删除库存请购失败",
      noValue: "--",
    },
    stockRequisitionForm: {
      editTitle: "编辑库存请购",
      createTitle: "新建库存请购",
      editDescription: "更新请购信息并修改行项目",
      createDescription: "填写供应商信息并添加商品以创建新请购",
      generalTab: "基本信息",
      itemsTab: "商品",
      basicInformation: "基本信息",
      supplierLabel: "供应商 *",
      selectSupplier: "选择供应商",
      requisitionDateLabel: "请购日期 *",
      requiredByDateLabel: "需求日期",
      notesLabel: "备注",
      notesPlaceholder: "添加附加备注或说明...",
      addItemsTitle: "添加库存请购商品",
      itemLabel: "商品 *",
      selectItem: "选择商品",
      searchItemPlaceholder: "搜索商品...",
      searchItemByCodeOrName: "按编码或名称搜索...",
      noItemFound: "未找到商品。",
      quantityLabel: "数量 *",
      quantityPlaceholder: "0",
      unitPriceLabel: "单价 *",
      unitPricePlaceholder: "0.00",
      addItem: "添加商品",
      addItemMissingFields: "请选择商品并输入数量和价格",
      itemNotFound: "未找到商品",
      itemAddedSuccess: "商品添加成功",
      lineItemsRequired: "请至少添加一个行项目",
      saveError: "保存库存请购失败",
      itemsTitle: "库存请购商品",
      itemSingular: "项",
      itemPlural: "项",
      totalAmount: "总金额",
      itemCode: "商品编码",
      itemName: "商品名称",
      qty: "数量",
      unitPrice: "单价",
      total: "合计",
      noItemsTitle: "尚未添加商品",
      noItemsDescription: "先选择商品，输入数量和价格，然后点击“添加商品”",
      footerSummary: "{count} {label} • 合计：{total}",
      saving: "保存中...",
      cancel: "取消",
      updateAction: "更新库存请购",
      createAction: "创建库存请购",
      updateSuccess: "库存请购更新成功",
      createSuccess: "库存请购创建成功",
      noActiveItems: "没有可用的启用商品",
    },
    stockRequisitionValidation: {
      supplierRequired: "供应商为必填项",
      requisitionDateRequired: "请购日期为必填项",
    },
    stockRequisitionDetailPage: {
      title: "库存请购",
      downloadPdf: "下载 PDF",
      edit: "编辑",
      send: "发送",
      cancel: "取消",
      loadError: "加载库存请购失败。",
      notFound: "未找到库存请购。",
      requisitionDetails: "请购详情",
      status: "状态：",
      supplier: "供应商：",
      contact: "联系人：",
      businessUnit: "业务单元：",
      createdBy: "创建人：",
      requisitionDate: "请购日期：",
      requiredByDate: "需求日期：",
      totalAmount: "总金额：",
      notes: "备注：",
      lineItems: "行项目",
      itemCode: "商品编码",
      itemName: "商品名称",
      requestedQty: "申请数量",
      fulfilledQty: "已完成数量",
      outstandingQty: "未完成数量",
      unitPrice: "单价",
      total: "合计",
      noLineItems: "未找到行项目",
      sendTitle: "发送库存请购",
      sendDescription: "确定要发送此库存请购吗？发送后将无法编辑。",
      sending: "发送中...",
      cancelTitle: "取消库存请购",
      cancelDescription: "确定要取消此库存请购吗？此操作无法撤销。",
      cancelBack: "不，返回",
      cancelling: "取消中...",
      confirmCancel: "是，取消",
      submitSuccess: "库存请购提交成功",
      submitError: "提交库存请购失败",
      cancelSuccess: "库存请购取消成功",
      cancelError: "取消库存请购失败",
      pdfSuccess: "PDF 下载成功",
      pdfError: "生成 PDF 失败",
      unknownSupplier: "未知供应商",
      unknownItem: "未知商品",
      na: "无",
      draft: "草稿",
      submitted: "已提交",
      partiallyFulfilled: "部分完成",
      fulfilled: "已完成",
      cancelled: "已取消",
      noValue: "--",
    },
    purchaseOrdersPage: {
      title: "采购订单",
      subtitle: "管理供应商采购订单",
      createAction: "创建采购订单",
      searchPlaceholder: "搜索采购订单...",
      statusPlaceholder: "状态",
      allStatus: "所有状态",
      draft: "草稿",
      submitted: "已提交",
      approved: "已批准",
      inTransit: "在途",
      partiallyReceived: "部分收货",
      received: "已收货",
      cancelled: "已取消",
      loadError: "加载采购订单失败。请重试。",
      emptyTitle: "未找到采购订单",
      emptyDescription: "创建第一张采购订单以开始使用。",
      poNumber: "采购单号",
      supplier: "供应商",
      orderDate: "下单日期",
      expectedDelivery: "预计到货",
      status: "状态",
      totalAmount: "总金额",
      actions: "操作",
      view: "查看",
      edit: "编辑",
      submit: "提交",
      approve: "批准",
      cancel: "取消",
      delete: "删除",
      receiveGoods: "收货",
      complete: "完成",
      submitTitle: "提交采购订单",
      submitDescription: "确定要提交 {code} 吗？提交后，订单需要审批后才能处理。",
      submitting: "提交中...",
      approveTitle: "批准采购订单",
      approveDescription: "确定要批准 {code} 吗？批准后，订单即可处理并收货。",
      approving: "批准中...",
      cancelTitle: "取消采购订单",
      cancelDescription: "确定要取消 {code} 吗？此操作无法撤销，订单将被标记为已取消。",
      goBack: "返回",
      cancelling: "取消中...",
      cancelOrder: "取消订单",
      completeTitle: "完成采购订单",
      completeDescription: "将 {code} 标记为已收货？即使部分收货，这也会关闭订单。",
      completing: "完成中...",
      deleteTitle: "删除采购订单",
      deleteDescription: "确定要删除 {code} 吗？此操作无法撤销，系统将永久移除此订单。",
      deleting: "删除中...",
      submitSuccess: "采购订单提交成功",
      submitError: "提交采购订单失败",
      approveSuccess: "采购订单批准成功",
      approveError: "批准采购订单失败",
      cancelSuccess: "采购订单取消成功",
      cancelError: "取消采购订单失败",
      completeSuccess: "采购订单已标记为收货完成",
      completeError: "完成采购订单失败",
      deleteSuccess: "采购订单删除成功",
      deleteError: "删除采购订单失败",
    },
    purchaseOrderForm: {
      editTitle: "编辑采购订单",
      createTitle: "创建新采购订单",
      editDescription: "更新采购订单详情和行项目。",
      createDescription: "填写采购订单详情并添加行项目。",
      generalTab: "基本信息",
      itemsTab: "行项目（{count}）",
      notesTab: "备注",
      generalTabError: "请填写“基本信息”标签中的所有必填字段",
      supplierLabel: "供应商 *",
      selectSupplier: "选择供应商",
      orderDateLabel: "下单日期 *",
      expectedDeliveryDateLabel: "预计到货日期 *",
      deliveryAddressTitle: "收货地址",
      streetAddressLabel: "街道地址 *",
      streetAddressPlaceholder: "街道地址",
      cityLabel: "城市 *",
      cityPlaceholder: "城市",
      stateLabel: "州/省 *",
      statePlaceholder: "州/省",
      postalCodeLabel: "邮政编码 *",
      postalCodePlaceholder: "邮政编码",
      countryLabel: "国家 *",
      countryPlaceholder: "国家",
      lineItemsTitle: "行项目",
      lineItemsDescription: "管理此订单中要采购的商品",
      addItem: "添加商品",
      noItemsTitle: "尚未添加商品。",
      noItemsDescription: "点击“添加商品”开始。",
      item: "商品",
      qty: "数量",
      unit: "单位",
      rate: "单价",
      discount: "折扣 %",
      tax: "税 %",
      total: "合计",
      actions: "操作",
      totalsTitle: "汇总",
      subtotal: "小计：",
      discountAmount: "折扣：",
      taxAmount: "税额：",
      totalAmount: "总计：",
      internalNotes: "内部备注",
      cancel: "取消",
      saving: "保存中...",
      updateAction: "更新采购订单",
      createAction: "创建采购订单",
      lineItemsRequired: "请至少添加一个行项目",
      updateSuccess: "采购订单更新成功",
      createSuccess: "采购订单创建成功",
      updateError: "更新采购订单失败",
      createError: "创建采购订单失败",
      noUnit: "—",
    },
    purchaseOrderLineItemDialog: {
      editTitle: "编辑行项目",
      createTitle: "添加行项目",
      editDescription: "更新行项目详情。",
      createDescription: "填写新行项目的详细信息。",
      itemLabel: "商品 *",
      selectItem: "选择商品",
      searchItem: "搜索商品...",
      searchByCodeOrName: "按编码或名称搜索...",
      noItemFound: "未找到商品。",
      onHand: "现有库存",
      available: "可用库存",
      quantityLabel: "数量 *",
      rateLabel: "单价 *",
      discountLabel: "折扣 %",
      taxLabel: "税 %",
      subtotal: "小计：",
      discount: "折扣：",
      tax: "税额：",
      lineTotal: "行合计：",
      cancel: "取消",
      updateAction: "更新商品",
      createAction: "添加商品",
    },
    purchaseOrderViewDialog: {
      title: "采购订单详情",
      orderCode: "采购单 #{code}",
      supplierInformation: "供应商信息",
      name: "名称：",
      code: "编码：",
      email: "邮箱：",
      phone: "电话：",
      orderDetails: "订单详情",
      orderDate: "下单日期：",
      expectedDelivery: "预计到货：",
      approvedOn: "批准日期：",
      na: "无",
      deliveryAddress: "收货地址",
      lineItems: "行项目",
      item: "商品",
      quantity: "数量",
      unit: "单位",
      rate: "单价",
      discount: "折扣",
      tax: "税",
      total: "合计",
      received: "已收货",
      subtotal: "小计：",
      taxAmount: "税额：",
      discountAmount: "折扣：",
      totalAmount: "总计：",
      notes: "备注",
      goodsReceived: "已收货物（{count}）",
      receivedOn: "收货日期 {date}",
      atWarehouse: "，仓库 {warehouse}",
      supplierInvoice: "供应商发票：{number}",
      supplierInvoiceWithDate: "供应商发票：{number}（{date}）",
      ordered: "订购",
      close: "关闭",
      print: "打印",
      draft: "草稿",
      submitted: "已提交",
      approved: "已批准",
      inTransit: "在途",
      partiallyReceived: "部分收货",
      receivedStatus: "已收货",
      cancelled: "已取消",
      noUnit: "—",
    },
    receiveGoodsDialog: {
      title: "收货",
      description: "接收采购订单 {code} 的商品",
      supplier: "供应商",
      orderDate: "下单日期",
      expectedDelivery: "预计到货",
      status: "状态",
      warehouseLabel: "仓库 *",
      selectWarehouse: "选择仓库",
      locationLabel: "库位",
      selectLocation: "选择库位",
      selectWarehouseFirst: "请先选择仓库",
      receiptDateLabel: "收货日期 *",
      supplierInvoiceNumberLabel: "供应商发票号",
      supplierInvoiceNumberPlaceholder: "INV-001",
      supplierInvoiceDateLabel: "供应商发票日期",
      batchLabel: "批次",
      batchPlaceholder: "批次参考",
      itemsToReceive: "待收货商品",
      item: "商品",
      ordered: "已订购",
      alreadyReceived: "已收货",
      remaining: "剩余",
      receiveNow: "本次收货 *",
      notesLabel: "备注",
      notesPlaceholder: "关于本次收货的备注...",
      fixErrors: "请修复以下错误：",
      itemError: "商品 {index}: {message}",
      receiveAction: "收货",
      receiving: "收货中...",
      cancel: "取消",
      lineItemRequired: "请至少为一个商品输入收货数量",
      success: "收货成功！库存已更新。",
      error: "收货失败",
      draft: "草稿",
      submitted: "已提交",
      approved: "已批准",
      inTransit: "在途",
      partiallyReceived: "部分收货",
      received: "已收货",
      cancelled: "已取消",
    },
    purchaseOrderValidation: {
      supplierRequired: "供应商为必填项",
      orderDateRequired: "下单日期为必填项",
      expectedDeliveryDateRequired: "预计到货日期为必填项",
      deliveryAddressRequired: "收货地址为必填项",
      cityRequired: "城市为必填项",
      stateRequired: "州/省为必填项",
      countryRequired: "国家为必填项",
      postalCodeRequired: "邮政编码为必填项",
      itemRequired: "商品为必填项",
      quantityMin: "数量必须大于 0",
      rateMin: "单价不能为负数",
      uomRequired: "计量单位为必填项",
      warehouseRequired: "仓库为必填项",
      receiptDateRequired: "收货日期为必填项",
      quantityNonNegative: "数量不能为负数",
    },
    purchaseReceiptsPage: {
      title: "采购收货",
      subtitle: "接收并管理来自采购订单的到货商品",
      searchPlaceholder: "搜索收货单...",
      statusPlaceholder: "状态",
      allStatus: "所有状态",
      draft: "草稿",
      received: "已收货",
      cancelled: "已取消",
      receiptCode: "收货单号",
      purchaseOrder: "采购订单",
      supplier: "供应商",
      warehouse: "仓库",
      batch: "批次",
      receiptDate: "收货日期",
      totalValue: "总价值",
      status: "状态",
      actions: "操作",
      loadError: "加载采购收货失败。请重试。",
      emptyTitle: "未找到采购收货",
      emptyDescription: "从已批准的采购订单收货以开始使用。",
      batchPrefix: "批次：{batch}",
      noValue: "--",
      view: "查看",
      delete: "删除",
      deleteTitle: "删除收货单",
      deleteDescription: "确定要删除 {code} 吗？此操作无法撤销，系统将永久移除此收货单。",
      cancel: "取消",
      deleting: "删除中...",
      deleteSuccess: "收货单删除成功",
      deleteError: "删除收货单失败",
    },
    purchaseReceiptViewDialog: {
      title: "采购收货详情",
      receiptCode: "收货单 #{code}",
      supplierInformation: "供应商信息",
      name: "名称：",
      code: "编码：",
      receiptDetails: "收货详情",
      purchaseOrder: "采购订单：",
      receiptDate: "收货日期：",
      batch: "批次：",
      warehouse: "仓库：",
      supplierInvoice: "供应商发票",
      invoiceNumber: "发票号：",
      invoiceDate: "发票日期：",
      receivedItems: "已收货商品",
      item: "商品",
      ordered: "订购",
      received: "已收货",
      unit: "单位",
      rate: "单价",
      totalValue: "总价值",
      notes: "备注",
      close: "关闭",
      print: "打印收货单",
      draft: "草稿",
      receivedStatus: "已收货",
      cancelled: "已取消",
      noUnit: "—",
      noValue: "—",
    },
    purchaseReceiptDetailPage: {
      receiptNotFound: "未找到收货单",
      receiptNotFoundDescription: "您要查找的收货单不存在。",
      goodsReceiptDetails: "收货单详情",
      print: "打印",
      export: "导出",
      receiptInformation: "收货信息",
      receiptId: "收货单号",
      status: "状态",
      purchaseOrder: "采购订单",
      receivedBy: "收货人",
      receiptDate: "收货日期",
      deliveryDate: "到货日期",
      batch: "批次",
      warehouse: "仓库",
      notes: "备注",
      supplierInformation: "供应商信息",
      supplierName: "供应商名称",
      supplierCode: "供应商编码",
      address: "地址",
      contact: "联系方式",
      totalItems: "项目总数",
      orderedQuantity: "订购数量",
      receivedQuantity: "收货数量",
      ofTotal: "占总数",
      totalValue: "总价值",
      receiptItems: "收货项目",
      receiptItemsDescription: "此收货单包含的项目",
      productCode: "产品编码",
      productName: "产品名称",
      orderedQty: "订购数量",
      receivedQty: "收货数量",
      unit: "单位",
      unitPrice: "单价",
      totalPrice: "总价",
      completed: "已完成",
      partial: "部分收货",
      pending: "待处理",
      received: "已收货",
      noValue: "—",
    },
    reportsPage: {
      title: "报表目录",
      subtitle: "面向商业智能和运营洞察的综合报表套件",
      totalReports: "报表总数",
      totalReportsDescription: "共 {count} 个分类",
      availableNow: "当前可用",
      availableNowDescription: "可立即使用",
      comingSoon: "即将推出",
      comingSoonDescription: "已纳入路线图",
      searchPlaceholder: "搜索报表...",
      allReports: "全部报表",
      available: "可用",
      inDevelopment: "开发中",
      openReport: "打开报表",
      valueLabel: "价值",
      noReportsFound: "未找到报表",
      noReportsFoundDescription: "请尝试调整搜索条件",
      roadmapTitle: "报表开发路线图",
      roadmapDescription:
        "我们正在持续扩展报表能力。标记为“即将推出”的报表将根据业务影响确定优先级，并在未来 12 到 15 个月内分阶段交付。关键和高优先级报表将优先实现。",
      inventoryName: "库存与仓储",
      inventoryDescription: "优化库存水平、减少浪费并提升仓库效率",
      stockReportsName: "库存报表",
      stockReportsDescription: "提供完整库存指标的库存流动与估值分析",
      stockReportsValue: "完整库存可视化",
      stockAgingName: "库存库龄报表",
      stockAgingDescription: "识别滞销和呆滞库存，优化营运资金",
      stockAgingValue: "减少 15-25% 呆滞库存",
      abcAnalysisName: "ABC 分析报表",
      abcAnalysisDescription: "基于帕累托原则按价值贡献对库存分类",
      abcAnalysisValue: "库存管理效率提升 20-30%",
      stockTurnoverName: "库存周转报表",
      stockTurnoverDescription: "衡量库存效率并识别资金利用机会",
      stockTurnoverValue: "现金流改善 10-15%",
      reorderAnalysisName: "补货点分析",
      reorderAnalysisDescription: "优化补货水平，防止缺货并减少过量库存",
      reorderAnalysisValue: "缺货减少 30-50%",
      warehouseUtilizationName: "仓库空间利用率",
      warehouseUtilizationDescription: "优化仓库布局、容量规划和拣货效率",
      warehouseUtilizationValue: "拣货效率提升 15-20%",
      stockVarianceName: "库存差异报表（循环盘点）",
      stockVarianceDescription: "跟踪系统库存与实物库存准确率，识别损耗",
      stockVarianceValue: "库存准确率达到 95%+",
      batchTraceabilityName: "批次/序列追溯",
      batchTraceabilityDescription: "用于召回、质量控制和合规的完整追溯",
      batchTraceabilityValue: "质量控制与法规合规关键能力",
      itemLocationBatchName: "商品库位（库位 + 批次）",
      itemLocationBatchDescription: "按仓库库位和批次查看精确库存余额，含库位批次 SKU",
      itemLocationBatchValue: "为拣货、上架和批次管理提供运营可视化",
      financialName: "财务与盈利能力",
      financialDescription: "完整财务报表与盈利能力分析",
      plStatementName: "损益表",
      plStatementDescription: "展示盈利能力的标准财务表现报表",
      plStatementValue: "核心财务报表需求",
      balanceSheetName: "资产负债表",
      balanceSheetDescription: "展示资产、负债和权益的财务状况快照",
      balanceSheetValue: "评估财务健康状况",
      cashFlowName: "现金流量表",
      cashFlowDescription: "跟踪现金流动与流动性管理",
      cashFlowValue: "支持流动性管理和融资规划",
      arAgingName: "应收账款账龄",
      arAgingDescription: "跟踪客户付款表现并管理催收",
      arAgingValue: "DSO 降低 20-30%",
      apAgingName: "应付账款账龄",
      apAgingDescription: "管理供应商付款义务并优化付款时机",
      apAgingValue: "营运资金改善 5-10%",
      salesProfitabilityName: "销售盈利能力报表",
      salesProfitabilityDescription: "按发票、客户、商品和员工分析真实利润",
      salesProfitabilityValue: "整体利润率提升 15-25%",
      cogsAnalysisName: "销售成本分析报表",
      cogsAnalysisDescription: "详细销售成本拆解和差异分析",
      cogsAnalysisValue: "更好的成本控制和定价决策",
      purchasingName: "采购与供应商",
      purchasingDescription: "供应商绩效跟踪与采购优化",
      supplierScorecardName: "供应商绩效记分卡",
      supplierScorecardDescription: "评估供应商可靠性与绩效，改进采购来源",
      supplierScorecardValue: "供应商可靠性提升 10-20%",
      poVarianceName: "采购订单与收货差异",
      poVarianceDescription: "跟踪订单履约准确率和价格合规性",
      poVarianceValue: "提升供应商责任约束",
      supplierSpendName: "供应商支出分析",
      supplierSpendDescription: "理解采购模式并优化供应商关系",
      supplierSpendValue: "采购成本降低 5-15%",
      priceVarianceName: "采购价格差异",
      priceVarianceDescription: "监控成本变化并控制采购预算",
      priceVarianceValue: "成本控制与预算管理",
      shipmentsReportName: "到货运输报表",
      shipmentsReportDescription: "按即将到达、运输中和已到达状态跟踪采购入库运输",
      shipmentsReportValue: "实时掌握供应商到货运输状态",
      operationsName: "运营与物流",
      operationsDescription: "运营效率与交付绩效指标",
      deliveryPerformanceName: "交付绩效仪表板",
      deliveryPerformanceDescription: "监控物流效率与交付可靠性",
      deliveryPerformanceValue: "交付绩效提升 20-35%",
      pickingEfficiencyName: "拣货效率报表",
      pickingEfficiencyDescription: "衡量仓库拣货生产率与准确率",
      pickingEfficiencyValue: "拣货生产率提升 25-40%",
      stockTransferName: "库存调拨分析",
      stockTransferDescription: "分析跨仓调拨并优化备货水平",
      stockTransferValue: "跨仓调拨减少 20-40%",
      transformationEfficiencyName: "转换效率",
      transformationEfficiencyDescription: "监控制造/加工运营并优化产出率",
      transformationEfficiencyValue: "产出率提升 10-25%",
      rtsAnalysisName: "退供应商分析",
      rtsAnalysisDescription: "跟踪质量问题并管理供应商责任",
      rtsAnalysisValue: "提升供应商质量",
      executiveName: "高管仪表板",
      executiveDescription: "高层业务概览与战略洞察",
      executiveSummaryName: "高管摘要仪表板",
      executiveSummaryDescription: "为管理决策提供的一页式业务概览",
      executiveSummaryValue: "加速高层决策",
      periodComparisonName: "期间对比分析",
      periodComparisonDescription: "跟踪业务增长并识别趋势",
      periodComparisonValue: "洞察业务发展轨迹",
      budgetActualName: "预算与实际报表",
      budgetActualDescription: "通过预算跟踪实现财务规划与控制",
      budgetActualValue: "强化财务纪律和控制",
      auditName: "审计与合规",
      auditDescription: "系统活动跟踪与合规报表",
      auditTrailName: "审计追踪报表",
      auditTrailDescription: "跟踪所有系统变更，用于安全、合规和调查",
      auditTrailValue: "安全监控与合规",
      documentStatusName: "单据状态跟踪",
      documentStatusDescription: "监控单据流程合规并识别瓶颈",
      documentStatusValue: "提升流程效率",
      userActivityName: "用户活动报表",
      userActivityDescription: "监控系统使用情况，用于许可优化与安全",
      userActivityValue: "许可优化与安全",
      predictiveName: "预测分析",
      predictiveDescription: "支持战略决策的预测与情景规划",
      demandForecastName: "需求预测报表",
      demandForecastDescription: "预测未来销售以支持主动库存规划",
      demandForecastValue: "库存优化提升 20-30%",
      whatIfName: "假设分析工具",
      whatIfDescription: "情景规划与战略决策支持",
      whatIfValue: "支持战略决策",
    },
    stockReportsPage: {
      title: "库存报表",
      subtitle: "用于库存流动和估值分析的综合库存报表",
      movementTab: "库存流动",
      valuationTab: "库存估值",
      filters: "筛选条件",
      startDate: "开始日期",
      endDate: "结束日期",
      groupBy: "分组方式",
      warehouse: "仓库",
      item: "商品",
      itemSearch: "商品搜索",
      category: "分类",
      allWarehouses: "所有仓库",
      allItems: "所有商品",
      allCategories: "所有分类",
      searchPlaceholder: "搜索商品编码、商品名称、SKU 或批次...",
      byItem: "按商品",
      byWarehouse: "按仓库",
      byItemWarehouse: "按商品与仓库",
      byCategory: "按分类",
      totalIn: "入库总量",
      totalOut: "出库总量",
      netMovement: "净流动",
      transactions: "交易数",
      periodComparison: "期间对比",
      movementDetails: "流动明细",
      noMovements: "所选期间未找到流动数据",
      inQty: "入库数量",
      outQty: "出库数量",
      net: "净额",
      inValue: "入库金额",
      outValue: "出库金额",
      netValue: "净金额",
      totalStockValue: "库存总价值",
      currentValuation: "当前估值",
      totalQtyOnHand: "现有总数量",
      activeLines: "有效库存行",
      avgUnitCost: "平均单位成本",
      weightedAverage: "加权平均",
      totalGroups: "分组总数",
      groupedView: "分组视图数量",
      valuationDetails: "估值明细",
      noValuation: "所选筛选条件下未找到估值数据",
      qtyOnHand: "现有数量",
      unitCost: "单位成本",
      totalValue: "总价值",
      lines: "行",
      items: "商品",
      warehouses: "仓库",
      loadError: "加载库存报表数据失败。",
    },
    stockAgingReportPage: {
      title: "库存库龄报表",
      subtitle: "在当前业务单元范围内，按精确仓库库位和批次识别老化库存。",
      filters: "筛选条件",
      warehouse: "仓库",
      item: "商品",
      itemSearch: "商品搜索",
      category: "分类",
      allWarehouses: "所有仓库",
      allItems: "所有商品",
      allCategories: "所有分类",
      searchPlaceholder: "搜索商品编码、商品名称、SKU 或批次...",
      exportPdf: "导出 PDF",
      exportingPdf: "正在导出 PDF...",
      generatedAt: "生成时间",
      ageBucket: "库龄区间",
      allAges: "全部库龄",
      bucket90Plus: "90 天以上",
      rowsPerPage: "每页行数",
      ageDays: "库龄天数",
      qtyOnHand: "现有数量",
      qtyReserved: "预留数量",
      qtyAvailable: "可用数量",
      receivedAt: "收货时间",
      updatedAt: "更新时间",
      agingRows: "老化库存行",
      stockValue: "库存价值",
      locationSku: "库位 SKU",
      oldestStock: "最老库存",
      agingRowsDescription: "按库位与批次分组的老化库存行。",
      qtyOnHandDescription: "当前范围内的现有库存数量。",
      stockValueDescription: "按当前商品成本估算的库存价值。",
      locationsAndBatches: "{locations} 个库位 • {batches} 个批次",
      availableQtyCaption: "{qty} 可用数量",
      aged90PlusCaption: "{count} 行 • {qty} 数量超过 90 天",
      daysValue: "{value} 天",
      agingDetails: "库龄明细",
      bucket0to30: "0-30 天",
      bucket31to60: "31-60 天",
      bucket61to90: "61-90 天",
      bucket91to180: "91-180 天",
      bucket181Plus: "181 天以上",
      totalQty: "总数量",
      totalValue: "总价值",
      avgAgeDays: "平均库龄",
      oldestAgeDays: "最老天数",
      warehouseLocation: "仓库 / 库位",
      batch: "批次",
      noRows: "所选筛选条件下未找到库龄数据。",
      pageOfTotal: "第 {page} / {totalPages} 页 • 共 {total} 行",
      previous: "上一页",
      next: "下一页",
      noValue: "--",
      unknown: "未知",
      reset: "重置",
      loadError: "加载库存库龄报表失败。",
      warehousesCaption: "覆盖 {count} 个仓库",
      rowsCaption: "{count} 个分组行",
      agingBasedOnReceiptDate: "库龄基于批次收货日期计算。",
      currentBusinessUnitScope: "范围限定为当前业务单元。",
      locationBatchGranularity: "每一行代表一个库位-批次库存余额。",
      itemSubtotal: "商品小计",
      oldestStockForItem: "该商品最老库存：{value} 天",
      batchesCount: "{count} 个批次",
    },
    shipmentsReportPage: {
      title: "到货运输报表",
      subtitle: "在当前业务单元范围内，按供应商、柜号和运输阶段跟踪采购入库运输。",
      exportPdf: "导出 PDF",
      exportingPdf: "正在导出 PDF...",
      generatedAt: "生成时间",
      filters: "筛选条件",
      search: "搜索",
      searchPlaceholder: "搜索装柜单、供应商单号、柜号、封条、批次或船名...",
      supplier: "供应商",
      shipmentStage: "状态",
      allSuppliers: "所有供应商",
      allStages: "全部阶段",
      incoming: "装柜中",
      inTransit: "运输中",
      arrived: "已到达",
      rowsPerPage: "每页行数",
      reset: "重置",
      totalShipments: "运输总数",
      totalShipmentsDescription: "当前范围内匹配的装柜单数量。",
      containers: "柜号数",
      containersDescription: "当前页中已记录柜号的运输数量。",
      totalQuantity: "总数量",
      totalQuantityDescription: "当前页运输数量总计。",
      totalValue: "总价值",
      totalValueDescription: "当前页运输金额总计。",
      shipments: "运输列表",
      loadList: "装柜单",
      containerSeal: "柜号 / 封条",
      eta: "预计到达",
      actualArrival: "实际到达",
      quantity: "数量",
      value: "价值",
      pageOfTotal: "第 {page} / {totalPages} 页 • 共 {total} 个运输",
      previous: "上一页",
      next: "下一页",
      noRows: "所选筛选条件下未找到运输数据。",
      noValue: "--",
      loadError: "加载运输报表失败。",
    },
    salesAnalyticsPage: {
      title: "销售分析",
      subtitle: "按销售人员、地区和时间维度查看销售表现洞察",
      overviewTab: "概览",
      byTimeTab: "按时间",
      byEmployeeTab: "按员工",
      byLocationTab: "按地区",
    },
    analyticsFilters: {
      dateRange: "日期范围",
      salesAgent: "销售员",
      allAgents: "全部销售员",
      city: "城市",
      allCities: "全部城市",
      region: "区域",
      allRegions: "全部区域",
      resetFilters: "重置筛选",
    },
    analyticsDateRangePicker: {
      today: "今天",
      yesterday: "昨天",
      last7Days: "最近 7 天",
      last30Days: "最近 30 天",
      thisMonth: "本月",
      lastMonth: "上月",
      thisYear: "今年",
      pickDateRange: "选择日期范围",
      presets: "预设",
    },
    analyticsOverviewTab: {
      totalSales: "销售总额",
      transactions: "{count} 笔交易",
      totalCommissions: "佣金总额",
      earnedByAllAgents: "所有销售员获得的佣金",
      activeAgents: "活跃销售员",
      salesAgentsWithActivity: "有销售活动的销售员",
      averageOrderValue: "平均订单金额",
      perTransaction: "每笔交易",
      vsPreviousPeriod: "较上一期间",
      salesTrend: "销售趋势",
      dailySalesPerformance: "每日销售表现",
      noSalesData: "暂无销售数据",
      sales: "销售额",
      commission: "佣金",
      topSalesAgents: "前 5 名销售员",
      byTotalSales: "按销售总额",
      noEmployeeData: "暂无员工数据",
      topLocations: "前 5 名地区",
      byTotalSalesLocations: "按销售总额",
      noLocationData: "暂无地区数据",
    },
    analyticsByTimeTab: {
      salesTrendOverTime: "按时间的销售趋势",
      salesAndCommissionsByDate: "按日期统计的销售额和佣金",
      noSalesData: "暂无销售数据",
      sales: "销售额",
      commissions: "佣金",
      transactions: "交易数",
      salesOverTime: "时间维度销售",
      dailySalesBreakdown: "每日销售明细",
      date: "日期",
      averageOrderValue: "平均订单金额",
      showingEntries: "显示第 {from} 到 {to} 条，共 {total} 条",
      previous: "上一页",
      next: "下一页",
      pageOf: "第 {page} / {total} 页",
    },
    analyticsByEmployeeTab: {
      topEmployeesBySales: "按销售额排名前 10 的员工",
      salesCommissionComparison: "销售额与佣金对比",
      noEmployeeData: "暂无员工数据",
      sales: "销售额",
      commission: "佣金",
      commissionDistribution: "佣金分布",
      topEarnersByCommission: "按佣金排名前 5 的员工",
      noCommissionData: "暂无佣金数据",
      employeePerformanceLeaderboard: "员工表现排行榜",
      rankedByTotalSales: "按销售总额排序",
      rank: "排名",
      employee: "员工",
      code: "编码",
      territory: "负责区域",
      totalSales: "销售总额",
      transactions: "交易数",
      avgOrder: "平均订单",
      rate: "比例",
      noTerritory: "无负责区域",
      showingEntries: "显示第 {from} 到 {to} 条，共 {total} 条",
      previous: "上一页",
      next: "下一页",
      pageOf: "第 {page} / {total} 页",
    },
    analyticsByLocationTab: {
      topCitiesBySales: "按销售额排名前 10 的城市",
      salesPerformanceByCity: "按城市统计销售表现",
      noLocationData: "暂无地区数据",
      sales: "销售额",
      regionalDistribution: "区域分布",
      salesByRegion: "按区域统计销售",
      noRegionalData: "暂无区域数据",
      salesByLocation: "按地区销售",
      performanceBreakdown: "按城市和区域拆解表现",
      city: "城市",
      region: "区域",
      totalSales: "销售总额",
      transactions: "交易数",
      avgOrderValue: "平均订单金额",
      uniqueCustomers: "唯一客户数",
      topEmployee: "最佳员工",
      showingEntries: "显示第 {from} 到 {to} 条，共 {total} 条",
      previous: "上一页",
      next: "下一页",
      pageOf: "第 {page} / {total} 页",
    },
    commissionReportsPage: {
      title: "佣金报表",
      subtitle: "跟踪并分析员工佣金与收入",
      summaryTab: "汇总",
      detailsTab: "明细",
      byPeriodTab: "按期间",
    },
    commissionSummary: {
      totalCommission: "佣金总额",
      fromTransactions: "来自 {count} 笔交易",
      totalSales: "销售总额",
      totalSalesVolume: "销售总量",
      paidCommission: "已支付佣金",
      fromPaidInvoices: "来自已付款发票",
      pendingCommission: "待支付佣金",
      fromUnpaidInvoices: "来自未付款发票",
      activeEmployees: "活跃员工",
      employeesWithCommissions: "有佣金记录的员工",
      effectiveRate: "有效佣金率",
      averageCommissionRate: "平均佣金比例",
      commissionInsights: "佣金洞察",
      keyPerformanceIndicators: "关键绩效指标",
      averageCommissionPerTransaction: "平均每笔交易佣金",
      commissionPayoutRate: "佣金支付率",
      averageSalesPerTransaction: "平均每笔交易销售额",
    },
    commissionDetails: {
      paid: "已支付",
      partiallyPaid: "部分支付",
      sent: "已发送",
      overdue: "逾期",
      title: "佣金明细",
      subtitle: "所有佣金记录的详细拆解",
      noRecords: "所选期间未找到佣金记录",
      invoice: "发票",
      date: "日期",
      employee: "员工",
      invoiceAmount: "发票金额",
      rate: "比例",
      splitPct: "分成 %",
      commission: "佣金",
      status: "状态",
    },
    commissionByPeriod: {
      title: "按期间统计佣金",
      subtitle: "趋势分析和期间比较（即将推出）",
      description: "期间分析功能即将推出",
    },
    pickingEfficiencyReportPage: {
      title: "拣货效率报表",
      subtitle: "衡量仓库拣货生产率以及基于短拣的准确率表现。",
      filters: "筛选条件",
      startDate: "开始日期",
      endDate: "结束日期",
      warehouse: "仓库",
      picker: "拣货员",
      primaryTable: "主表维度",
      allWarehouses: "所有仓库",
      allPickers: "所有拣货员",
      byPicker: "按拣货员",
      byWarehouse: "按仓库",
      loadError: "加载拣货效率报表失败。",
      pickLinesPerHour: "每小时拣货行数",
      linesInActiveHours: "{lines} 行，用时 {hours} 个有效小时",
      pickAccuracy: "拣货准确率",
      shortPickProxy: "基于短拣行的近似指标",
      avgPickTime: "平均拣货时间",
      completedPickLists: "已完成拣货单 {count} 个",
      shortPickRate: "短拣率",
      shortLines: "短拣行 {count} 行",
      quantityFillRate: "数量完成率",
      quantityFillRateDesc: "{picked} / {allocated} 数量",
      pickers: "拣货员",
      observedInPeriod: "所选期间内观察到",
      warehouses: "仓库",
      fulfillingWarehouses: "履约仓库",
      shortQty: "短缺数量",
      totalQuantityShortPicked: "短拣总数量",
      pickerPerformance: "拣货员表现",
      warehousePerformance: "仓库拣货表现",
      pickerLabel: "拣货员",
      warehouseLabel: "仓库",
      pickListsLabel: "拣货单",
      lines: "行数",
      linesPerHour: "行/小时",
      accuracy: "准确率",
      shortRate: "短拣率",
      avgTime: "平均时间",
      utilization: "利用率",
      noDataForFilters: "所选筛选条件下无数据。",
      pickLists: "{count} 个拣货单",
      unknown: "未知",
      shortPickReasons: "短拣原因",
      noShortReasons: "未记录短拣原因。",
      dailyTrend: "每日趋势",
      date: "日期",
      noDailyData: "所选期间内无每日数据。",
      topPickers: "最佳拣货员",
      noPickerData: "暂无拣货员数据。",
      hoursShort: "时",
      minutesShort: "分",
      linesPerHourShort: "行/小时",
    },
    transformationEfficiencyReportPage: {
      title: "转换效率",
      subtitle: "监控转换吞吐量、产出率、浪费、周期时间和成本差异。",
      filters: "筛选条件",
      startDate: "开始日期",
      endDate: "结束日期",
      warehouse: "仓库",
      template: "模板",
      status: "状态",
      primaryTable: "主表维度",
      allWarehouses: "所有仓库",
      allTemplates: "所有模板",
      completed: "已完成",
      preparing: "准备中",
      draft: "草稿",
      cancelled: "已取消",
      all: "全部",
      byTemplate: "按模板",
      byWarehouse: "按仓库",
      loadError: "加载转换效率报表失败。",
      orders: "订单数",
      completionRate: "完成率 {value}",
      yield: "产出率",
      outputQty: "产出 {value}",
      wasteRate: "浪费率",
      wasteQty: "浪费 {value}",
      avgCycleTime: "平均周期时间",
      executionToCompletion: "从执行到完成",
      planAdherence: "计划达成率",
      actualVsPlanned: "实际 {actual} / 计划 {planned}",
      costVariance: "成本差异",
      inputOutputCost: "投入 {input} / 产出 {output}",
      templates: "模板数",
      inSelectedPeriod: "所选期间内",
      warehouses: "仓库数",
      participatingWarehouses: "参与仓库",
      templatePerformance: "模板表现",
      warehousePerformance: "仓库表现",
      templateLabel: "模板",
      warehouseLabel: "仓库",
      waste: "浪费",
      plan: "计划",
      avgCycle: "平均周期",
      variance: "差异",
      noDataForFilters: "所选筛选条件下无数据。",
      completedSuffix: "完成率 {value}",
      unknown: "未知",
      wasteReasons: "浪费原因",
      noWasteReasons: "未记录浪费原因。",
      dailyTrend: "每日趋势",
      date: "日期",
      completion: "完成率",
      noDailyData: "所选期间内无每日数据。",
      hoursShort: "时",
      minutesShort: "分",
    },
    itemLocationBatchReportPage: {
      title: "商品库位（库位 + 批次）报表",
      subtitle: "按精确仓库库位和批次查看库存余额，包括库位批次 SKU。",
      filters: "筛选条件",
      warehouse: "仓库",
      item: "商品",
      stockStatus: "库存状态",
      sortBy: "排序字段",
      sortOrder: "排序顺序",
      rowsPerPage: "每页行数",
      allWarehouses: "所有仓库",
      allItems: "所有商品",
      all: "全部",
      availableOnly: "仅可用库存",
      reservedGtZero: "预留大于 0",
      zeroOnHand: "现有数量为 0",
      updatedAt: "更新时间",
      qtyOnHand: "现有数量",
      receivedAt: "批次收货时间",
      descending: "降序",
      ascending: "升序",
      searchPlaceholder: "搜索商品、SKU、批次编码、库位或库位批次 SKU...",
      search: "搜索",
      reset: "重置",
      loadError: "加载商品库位批次报表失败。",
      rows: "行数",
      showingRows: "显示 {count} 行",
      currentPageTotal: "当前页合计",
      reserved: "预留",
      rowsWithReservedQty: "{count} 行有预留数量",
      available: "可用",
      dimensions: "维度",
      dimensionsDesc: "{items} 个商品 • {locations} 个库位",
      batchesPage: "{count} 个批次（当前页）",
      locationBatchStockRows: "库位 + 批次库存行",
      noRows: "所选筛选条件下未找到记录。",
      warehouseLocation: "仓库 / 库位",
      batch: "批次",
      locationSku: "库位 SKU",
      onHand: "现有",
      updated: "更新于",
      oldDays: "{count} 天前",
      pageOfTotal: "第 {page} / {totalPages} 页 • 共 {total} 行",
      previous: "上一页",
      next: "下一页",
      noValue: "--",
      unknown: "未知",
    },
    loadListsPage: {
      title: "装载单",
      subtitle: "管理供应商发运和交付",
      createAction: "创建装载单",
      searchPlaceholder: "按装载单号、集装箱号、封条号、批次搜索...",
      statusPlaceholder: "状态",
      supplierPlaceholder: "供应商",
      warehousePlaceholder: "仓库",
      allStatus: "所有状态",
      allSuppliers: "所有供应商",
      allWarehouses: "所有仓库",
      draft: "草稿",
      confirmed: "已确认",
      inTransit: "在途",
      arrived: "已到达",
      receiving: "收货中",
      pendingApproval: "待审批",
      received: "已收货",
      cancelled: "已取消",
      llNumber: "装载单号",
      supplier: "供应商",
      warehouse: "仓库",
      containerSeal: "集装箱 / 封条",
      batch: "批次",
      arrivalDate: "到达日期",
      status: "状态",
      createdBy: "创建人",
      actions: "操作",
      supplierPrefix: "供应商：{value}",
      estimatedPrefix: "预计：{date}",
      actualPrefix: "实际：{date}",
      loadError: "加载装载单失败。请重试。",
      emptyTitle: "未找到装载单",
      emptyDescription: "创建第一张装载单以开始使用。",
      noValue: "-",
      view: "查看",
      edit: "编辑",
      delete: "删除",
      deleteTitle: "删除装载单",
      deleteDescription: "确定要删除 {code} 吗？此操作无法撤销，系统将永久移除此装载单。",
      cancel: "取消",
      deleting: "删除中...",
      deleteSuccess: "装载单删除成功",
      deleteError: "删除装载单失败",
    },
    loadListForm: {
      editTitle: "编辑装载单",
      createTitle: "创建装载单",
      editDescription: "更新装载单详情和行项目",
      createDescription: "填写详情以创建新的装载单",
      generalTab: "基本信息",
      itemsTab: "商品",
      primaryInformation: "主要信息",
      supplierLabel: "供应商 *",
      selectSupplier: "选择供应商",
      warehouseLabel: "仓库 *",
      selectWarehouse: "选择仓库",
      supplierLoadListNumber: "供应商装载单号",
      supplierLoadListPlaceholder: "供应商参考号",
      containerDetails: "集装箱信息",
      containerNumber: "集装箱号",
      containerNumberPlaceholder: "集装箱号",
      sealNumber: "封条号",
      sealNumberPlaceholder: "封条号",
      batchNumber: "批次号",
      batchNumberPlaceholder: "批次号",
      linerName: "船公司",
      linerNamePlaceholder: "船公司或航运公司",
      scheduleDetails: "计划信息",
      estimatedArrivalDate: "预计到达日期",
      loadDate: "装载日期",
      notes: "备注",
      notesPlaceholder: "添加备注...",
      addItemsTitle: "添加商品",
      itemLabel: "商品 *",
      selectItem: "选择商品",
      searchItem: "搜索商品...",
      searchByCodeOrName: "按编码或名称搜索...",
      noItemFound: "未找到商品。",
      quantityLabel: "数量 *",
      quantityPlaceholder: "0",
      unitCostLabel: "单价 *",
      unitCostPlaceholder: "0.00",
      addItem: "添加商品",
      addItemError: "请选择商品并输入数量和单价",
      itemNotFound: "未找到商品",
      lineItemsRequired: "请至少添加一个行项目",
      itemsTitle: "装载单商品",
      noItemsTitle: "尚未添加商品",
      noItemsDescription: "先向装载单添加商品。",
      itemCode: "商品编码",
      itemName: "商品名称",
      qty: "数量",
      unitPrice: "单价",
      total: "合计",
      actions: "操作",
      totalAmount: "总金额",
      cancel: "取消",
      saving: "保存中...",
      updateAction: "更新装载单",
      createAction: "创建装载单",
      updateSuccess: "装载单更新成功",
      createSuccess: "装载单创建成功",
      saveError: "保存装载单失败",
    },
    linkStockRequisitionsDialog: {
      title: "关联库存请购",
      description: "将装载单商品与库存请购商品关联，以跟踪 {supplier} 的履行情况",
      outstandingTitle: "待处理库存请购",
      itemsAvailable: "可用 {count} 个商品",
      noOutstandingItems: "没有待处理数量的商品",
      noOutstandingDescription: "没有具有待处理数量的商品",
      noRequisitions: "没有可供关联的库存请购",
      noRequisitionsSupplier: "供应商 {supplier}",
      srItemsCount: "{count} 个商品",
      outstandingPrefix: "待处理：{qty}",
      addLink: "添加关联",
      loadListItem: "装载单商品 *",
      selectLoadListItem: "选择装载单商品",
      srItem: "请购商品 *",
      selectSrItem: "选择请购商品",
      quantityLabel: "数量 *",
      quantityPlaceholder: "0",
      addLinkError: "请选择商品并输入数量",
      selectedSrItemNotFound: "未找到所选请购商品",
      exceedOutstanding: "数量不能超过待处理数量（{qty}）",
      exceedLoadListQty: "数量不能超过装载单数量（{qty}）",
      linkAdded: "关联添加成功",
      linksRequired: "请至少添加一个关联",
      linkSuccess: "成功将 {count} 个商品关联到请购",
      linkError: "关联请购失败",
      pendingLinks: "待提交关联",
      noLinksTitle: "尚未添加关联",
      noLinksDescription: "在装载单商品和请购商品之间建立关联。",
      llItem: "装载单商品",
      srReference: "请购参考",
      requested: "申请数量",
      outstanding: "待处理",
      linkedQty: "关联数量",
      submit: "提交关联",
      submitting: "提交中...",
      cancel: "取消",
    },
    loadListDetailPage: {
      title: "装载单",
      edit: "编辑",
      confirm: "确认",
      linkStockRequisitions: "关联库存请购",
      markInTransit: "标记为在途",
      markArrived: "标记为已到达",
      markReceived: "标记为已收货",
      cancel: "取消",
      loadError: "加载装载单失败。",
      notFound: "未找到装载单。",
      detailsTitle: "装载单详情",
      status: "状态：",
      supplier: "供应商：",
      contact: "联系人：",
      warehouse: "仓库：",
      businessUnit: "业务单元：",
      supplierLlNumber: "供应商装载单号：",
      containerNumber: "集装箱号：",
      sealNumber: "封条号：",
      batchNumber: "批次号：",
      linerName: "船公司：",
      loadDate: "装载日期：",
      estimatedArrival: "预计到达：",
      actualArrival: "实际到达：",
      notes: "备注：",
      createdBy: "创建人：",
      receivedBy: "收货人：",
      approvedBy: "审批人：",
      lineItems: "行项目",
      itemCode: "商品编码",
      itemName: "商品名称",
      loadListQty: "装载单数量",
      receivedQty: "已收货数量",
      damagedQty: "损坏数量",
      shortageQty: "短缺数量",
      unitPrice: "单价",
      total: "合计",
      noLineItems: "未找到行项目",
      confirmTitle: "确认装载单",
      confirmDescription: "确定要确认此装载单吗？确认后将无法修改商品。",
      confirming: "确认中...",
      inTransitTitle: "标记为在途",
      inTransitDescription: "这将把装载单标记为在途，并更新库存在途数量。",
      estimatedArrivalDateLabel: "预计到达日期",
      linerNameLabel: "船公司",
      linerNamePlaceholder: "船公司或航运公司",
      saveAndMarkInTransit: "保存并标记为在途",
      updating: "更新中...",
      arrivedTitle: "标记为已到达",
      arrivedDescription: "这将把装载单标记为已到达仓库，然后可以继续收货。",
      receivedTitle: "标记为已收货",
      receivedDescription: "这将把装载单标记为已收货，并更新库存水平。此操作无法撤销。",
      cancelTitle: "取消装载单",
      cancelDescription: "确定要取消此装载单吗？此操作无法撤销。",
      cancelBack: "不，返回",
      cancelling: "取消中...",
      confirmCancel: "是，取消",
      statusUpdateSuccess: "装载单已标记为 {status}",
      statusUpdateError: "更新装载单状态失败",
      draft: "草稿",
      confirmed: "已确认",
      inTransit: "在途",
      arrived: "已到达",
      receiving: "收货中",
      pendingApproval: "待审批",
      received: "已收货",
      cancelled: "已取消",
      noValue: "--",
    },
    loadListValidation: {
      supplierRequired: "供应商为必填项",
      warehouseRequired: "仓库为必填项",
    },
    grnsPage: {
      title: "收货单",
      subtitle: "管理仓库收货和入库",
      searchPlaceholder: "按收货单号、集装箱号、封条号搜索...",
      statusPlaceholder: "状态",
      warehousePlaceholder: "仓库",
      allStatus: "所有状态",
      allWarehouses: "所有仓库",
      draft: "草稿",
      receiving: "收货中",
      pendingApproval: "待审批",
      approved: "已批准",
      rejected: "已拒绝",
      cancelled: "已取消",
      grnNumber: "收货单号",
      loadList: "装载单",
      supplier: "供应商",
      warehouse: "仓库",
      containerSeal: "集装箱 / 封条",
      receivingDate: "收货日期",
      status: "状态",
      receivedBy: "收货人",
      actions: "操作",
      supplierPrefix: "供应商：{value}",
      notStarted: "未开始",
      loadError: "加载收货单失败。请重试。",
      emptyTitle: "未找到收货单",
      emptyDescription: "装载单到达后会自动创建收货单。",
      noValue: "-",
      view: "查看",
      delete: "删除",
      deleteTitle: "删除收货单",
      deleteDescription: "确定要删除 {code} 吗？此操作无法撤销，系统将永久移除此收货单。",
      cancel: "取消",
      deleting: "删除中...",
      deleteSuccess: "收货单删除成功",
      deleteError: "删除收货单失败",
    },
    grnDetailPage: {
      draft: "草稿",
      receiving: "收货中",
      pendingApproval: "待审批",
      approved: "已批准",
      rejected: "已拒绝",
      cancelled: "已取消",
      loadError: "加载收货单失败。请重试。",
      goBack: "返回",
      loadListLabel: "装载单：{value}",
      saving: "保存中...",
      saveChanges: "保存更改",
      submitting: "提交中...",
      submitForApproval: "提交审批",
      approve: "批准",
      reject: "拒绝",
      grnInformation: "收货单信息",
      grnNumber: "收货单号",
      loadList: "装载单",
      container: "集装箱",
      seal: "封条",
      batchNumber: "批次号",
      locationDates: "位置与日期",
      warehouse: "仓库",
      businessUnit: "业务单元",
      deliveryDate: "到货日期",
      receivingDate: "收货日期",
      notStarted: "未开始",
      supplierPersonnel: "供应商与人员",
      supplier: "供应商",
      createdBy: "创建人",
      receivedBy: "收货人",
      checkedBy: "复核人",
      receiveItemsTab: "收货项目",
      damageItemsTab: "损坏项目",
      boxManagementTab: "箱标管理",
      notesTab: "备注",
      receivedItems: "已收货项目",
      receiveItemsEditableDescription: "录入收货数量和损坏信息",
      receiveItemsReadonlyDescription: "查看收货项目详情",
      itemsCount: "{count} 个项目",
      itemCode: "物料编码",
      itemName: "物料名称",
      expected: "应收",
      received: "实收",
      damaged: "损坏",
      boxes: "箱数",
      variance: "差异",
      notes: "备注",
      addNotesPlaceholder: "添加备注...",
      additionalNotes: "附加备注",
      noNotes: "暂无备注。",
      approveTitle: "批准收货单",
      approveDescription: "确定要批准 {grnNumber} 吗？这将创建库存记录并更新库存水平。此操作无法撤销。",
      approvalNotes: "审批备注（可选）",
      approvalNotesPlaceholder: "添加审批备注...",
      approving: "批准中...",
      rejectTitle: "拒绝收货单",
      rejectDescription: "确定要拒绝 {grnNumber} 吗？请提供拒绝原因。",
      rejectionReason: "拒绝原因 *",
      rejectionReasonPlaceholder: "输入拒绝原因...",
      rejecting: "拒绝中...",
      updateSuccess: "收货单更新成功",
      updateError: "更新收货单失败",
      submitSuccess: "收货单已提交审批",
      submitError: "提交收货单失败",
      approveSuccess: "收货单批准成功",
      approveError: "批准收货单失败",
      rejectReasonRequired: "请提供拒绝原因",
      rejectSuccess: "收货单已拒绝",
      rejectError: "拒绝收货单失败",
      noValue: "-",
    },
    grnDamagedItemsSection: {
      title: "损坏项目",
      description: "报告并跟踪损坏或有缺陷的项目",
      reportDamage: "报告损坏",
      empty: "暂无已报告的损坏项目",
      item: "项目",
      quantity: "数量",
      damageType: "损坏类型",
      descriptionLabel: "描述",
      reportedBy: "报告人",
      reportedDate: "报告日期",
      status: "状态",
      actionTaken: "处理措施",
      actions: "操作",
      broken: "破损",
      defective: "瑕疵",
      missing: "缺失",
      expired: "过期",
      wrongItem: "错货",
      other: "其他",
      reported: "已报告",
      processing: "处理中",
      resolved: "已解决",
      validationError: "请选择项目并输入有效数量",
      createSuccess: "损坏项目报告成功",
      createError: "报告损坏项目失败",
      updateSuccess: "损坏项目更新成功",
      updateError: "更新损坏项目失败",
      deleteSuccess: "损坏项目删除成功",
      deleteError: "删除损坏项目失败",
      createTitle: "报告损坏项目",
      createDescription: "记录此收货单中的损坏或有缺陷项目",
      itemLabel: "项目 *",
      selectItem: "选择项目",
      quantityLabel: "数量 *",
      damageTypeLabel: "损坏类型 *",
      descriptionPlaceholder: "描述损坏情况...",
      cancel: "取消",
      reporting: "提交中...",
      report: "提交",
      updateTitle: "更新损坏项目",
      updateDescription: "更新处理措施和状态",
      statusLabel: "状态",
      actionTakenLabel: "处理措施",
      actionTakenPlaceholder: "描述已采取的措施...",
      updating: "更新中...",
      update: "更新",
      deleteTitle: "删除损坏项目",
      deleteDescription: "确定要删除此损坏项目记录吗？此操作无法撤销。",
      deleting: "删除中...",
      delete: "删除",
      noValue: "-",
    },
    grnBoxManagementSection: {
      title: "箱管理与条码",
      description: "生成箱信息并打印条码标签",
      printAllLabels: "打印全部标签",
      printing: "打印中...",
      receivedUnits: "已收货：{count} 件",
      boxesGenerated: "已生成 {count} 箱",
      printLabels: "打印标签",
      regenerate: "重新生成",
      generate: "生成",
      generateBoxLabels: "箱标签",
      boxNumber: "箱号",
      barcode: "条码",
      qty: "数量",
      location: "库位",
      notAssigned: "未分配",
      empty: "暂无可生成箱标签的项目",
      dialogTitle: "为项目生成箱信息",
      receivedQuantity: "已收货数量：{count}",
      numberOfBoxesLabel: "箱数 *",
      qtyPerBox: "每箱数量：{count}",
      warehouseLocationOptional: "仓库库位（可选）",
      loadingLocations: "正在加载库位...",
      assignLocationLater: "稍后分配库位",
      noLocation: "不分配库位",
      unnamed: "未命名",
      noLocationsAvailable: "暂无可用库位",
      assignLaterDescription: "稍后可在上架页面分配库位",
      generating: "生成中...",
      generateBoxes: "生成箱信息",
      loadLocationsError: "加载仓库库位失败",
      generateSuccess: "已成功生成 {count} 个箱",
      generateError: "生成箱信息失败",
      printNoBoxes: "没有可打印的箱",
      printSuccess: "条码标签已发送到打印机",
      printError: "打印标签失败",
    },
    grnPutawayPage: {
      enterBarcodeError: "请输入或扫描条码",
      fetchLocationsError: "加载仓库库位失败",
      boxNotFound: "未找到箱信息",
      alreadyAssignedTo: "箱已分配到 {code}",
      scanSuccess: "箱扫描成功",
      scanError: "扫描条码失败",
      selectLocationError: "请选择仓库库位",
      selectWarehouseError: "请先选择仓库",
      invalidLocationSelected: "所选库位无效",
      locationWarehouseMismatch: "该库位不属于所选仓库",
      assignSuccess: "箱已分配到 {location}",
      assignError: "分配库位失败",
      back: "返回",
      title: "上架工作站",
      subtitle: "扫描箱并分配仓库库位",
      selectWarehouseTitle: "选择仓库",
      selectWarehouseDescription: "选择当前作业仓库",
      selectWarehousePlaceholder: "选择仓库",
      scanTitle: "扫描箱条码",
      scanDescription: "扫描二维码或手动输入条码",
      barcodePlaceholder: "扫描或输入条码...",
      scanning: "扫描中...",
      scan: "扫描",
      boxScanned: "箱已扫描",
      grn: "收货单",
      box: "箱",
      item: "项目",
      qty: "数量",
      currentlyAssignedTo: "当前已分配到：{code}",
      assignLocationTitle: "分配存储库位",
      assignLocationDescription: "搜索并选择仓库库位",
      selectWarehouseFirstNotice: "请先选择仓库",
      locationLabel: "库位",
      searchLocation: "搜索库位...",
      searchByCodeOrName: "按编码或名称搜索...",
      noLocationFound: "未找到库位。",
      locationsAvailable: "共有 {count} 个可用库位",
      assigning: "分配中...",
      confirmLocation: "确认库位",
      completedTitle: "已完成（{count}）",
      completedDescription: "本次会话中已处理的箱",
    },
    stockRequestsPage: {
      title: "库存申请",
      subtitle: "管理库存申请及履行流程",
      deliveryNotes: "送货单",
      createRequest: "创建申请",
      searchPlaceholder: "搜索库存申请...",
      statusPlaceholder: "状态",
      priorityPlaceholder: "优先级",
      allStatus: "所有状态",
      allPriority: "所有优先级",
      draft: "草稿",
      submitted: "已提交",
      approved: "已批准",
      picking: "拣货中",
      picked: "已拣货",
      dispatched: "已发运",
      received: "已接收",
      allocating: "分配中",
      partiallyAllocated: "部分分配",
      allocated: "已分配",
      partiallyFulfilled: "部分完成",
      fulfilled: "已完成",
      completed: "已完成",
      cancelled: "已取消",
      low: "低",
      normal: "普通",
      high: "高",
      urgent: "紧急",
      requestNumber: "申请单号",
      requestDate: "申请日期",
      requiredDate: "需求日期",
      requestedByWarehouse: "申请方仓库",
      requestedToWarehouse: "供货方仓库",
      priority: "优先级",
      status: "状态",
      receivedDate: "接收日期",
      requestedByUser: "申请人",
      actions: "操作",
      loadingError: "加载库存申请失败。请重试。",
      emptyTitle: "未找到库存申请",
      emptyDescription: "创建第一张申请单以开始使用。",
      edit: "编辑",
      delete: "删除",
      submit: "提交",
      approve: "批准",
      reject: "拒绝",
      dispatch: "发运",
      receive: "接收",
      cancel: "取消",
      noActions: "--",
      noWarehouse: "--",
      deleteTitle: "删除库存申请",
      deleteDescription: "确定要删除申请单 {code} 吗？此操作无法撤销。",
      deleting: "删除中...",
      actionRequestLabel: "申请单",
      reasonPlaceholder: "输入原因...",
      processing: "处理中...",
      submitTitle: "提交库存申请",
      submitDescription: "确定要提交此库存申请以供审批吗？",
      approveTitle: "批准库存申请",
      approveDescription: "确定要批准此库存申请吗？",
      rejectTitle: "拒绝库存申请",
      rejectDescription: "确定要拒绝此库存申请吗？请提供原因。",
      dispatchTitle: "发运库存申请",
      dispatchDescription: "发运已拣货数量并过账出库库存移动吗？",
      completeTitle: "完成库存申请",
      completeDescription: "确定要完成此库存申请吗？这将创建库存交易并更新库存数量。",
      cancelTitle: "取消库存申请",
      cancelDescription: "确定要取消此库存申请吗？请提供原因。",
    },
    stockRequestForm: {
      editTitle: "编辑库存申请",
      createTitle: "创建库存申请",
      editDescription: "编辑申请单 {code}",
      createDescription: "创建新的库存申请",
      requestDateLabel: "申请日期",
      requiredDateLabel: "需求日期",
      priorityLabel: "优先级",
      selectPriority: "选择优先级",
      requestedByLabel: "申请方",
      selectRequestedBy: "选择申请方",
      autoAssignedWarehouseUnavailable: "当前业务单元未分配仓库",
      requestedToLabel: "供货方",
      selectRequestedTo: "选择供货方",
      purposeLabel: "用途",
      purposePlaceholder: "输入申请用途（可选）",
      notesLabel: "备注",
      notesPlaceholder: "附加备注（可选）",
      lineItemsTitle: "明细项目",
      lineItemsDescription: "添加申请商品",
      addItem: "添加商品",
      noItems: "尚未添加商品。",
      noItemsDescription: "点击“添加商品”开始。",
      item: "商品",
      qty: "数量",
      unit: "单位",
      notes: "备注",
      actions: "操作",
      cancel: "取消",
      saving: "保存中...",
      updateAction: "更新申请",
      createAction: "创建申请",
      lineItemRequired: "请至少添加一条明细项目",
      noValue: "--",
    },
    stockRequestValidation: {
      requestDateRequired: "申请日期为必填项",
      requiredDateRequired: "需求日期为必填项",
      requestedByRequired: "申请方为必填项",
      requestedToRequired: "供货方为必填项",
      requestingAndFulfillingMustDiffer: "供货方必须不同于申请方",
    },
    stockRequestLineItemDialog: {
      editTitle: "编辑申请商品",
      createTitle: "添加申请商品",
      editDescription: "更新申请商品详情。",
      createDescription: "填写新申请商品的详情。",
      itemLabel: "商品",
      selectItem: "选择商品",
      searchItem: "按编码或名称搜索...",
      loadingItems: "加载商品中...",
      noItemFound: "未找到商品。",
      onHand: "现有库存",
      available: "可用数量",
      requestedQuantityLabel: "申请数量",
      requestedQuantityPlaceholder: "输入数量",
      notesLabel: "备注（可选）",
      notesPlaceholder: "此商品的附加备注...",
      quantityToRequest: "申请数量",
      cancel: "取消",
      updateAction: "更新商品",
      addAction: "添加商品",
    },
    stockRequestLineItemValidation: {
      itemRequired: "商品为必填项",
      uomRequired: "计量单位为必填项",
      requestedQtyMin: "申请数量必须大于 0",
    },
    receiveStockRequestDialog: {
      title: "接收库存申请",
      description: "接收申请单 {code} 的商品",
      from: "来源",
      to: "目标",
      requiredDate: "需求日期",
      status: "状态",
      receivedDateLabel: "接收日期",
      itemsToReceive: "待接收商品",
      item: "商品",
      requested: "申请数量",
      dispatched: "已发运",
      received: "已接收",
      receiveNow: "本次接收 *",
      location: "库位",
      selectLocation: "选择库位",
      selectWarehouseFirst: "请先选择仓库",
      notesLabel: "备注",
      notesPlaceholder: "关于本次收货的备注...",
      cancel: "取消",
      receiving: "接收中...",
      receiveAction: "接收",
      noWarehouse: "--",
      receiveQtyRequired: "请至少为一个商品输入接收数量",
      receiveSuccess: "库存申请接收成功。",
      receiveError: "接收库存申请失败",
    },
    receiveStockRequestValidation: {
      receivedDateRequired: "接收日期为必填项",
      receivedQtyMin: "数量不能为负数",
    },
    stockRequestViewDialog: {
      title: "库存申请详情",
      requestNumber: "申请单号 #{code}",
      requestedByWarehouse: "申请方",
      requestedToWarehouse: "供货方",
      requestedByUser: "申请人",
      requestDate: "申请日期",
      requiredDate: "需求日期",
      receivedDate: "接收日期",
      receivedBy: "接收人",
      priority: "优先级",
      purpose: "用途",
      notes: "备注",
      lineItems: "明细项目",
      item: "商品",
      quantity: "数量",
      deliveredQty: "已交付数量",
      unit: "单位",
      noItems: "未找到商品。",
      fulfillmentSummary: "履行汇总",
      totalRequested: "申请总数",
      totalDelivered: "已交付总数",
      remainingQty: "剩余数量",
      fulfillingDeliveryNotes: "相关送货单",
      noLinkedDeliveryNotes: "尚无关联送货单。",
      noValue: "--",
    },
  }
};
