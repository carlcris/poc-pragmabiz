export type QuotationStatus =
  | "draft"
  | "sent"
  | "accepted"
  | "partially_ordered"
  | "rejected"
  | "expired"
  | "ordered";

export type FrameServiceFeeMode =
  | "per_frame"
  | "per_order"
  | "size_based"
  | "service_type"
  | "manual";

export type FrameInvoiceDisplayMode = "summary" | "components" | "both";

export type FrameComponentType = "molding" | "material" | "accessory";

export type FrameQuotationComponent = {
  id?: string;
  /** Original quotation component when this component has been copied to an order. */
  quotationComponentId?: string;
  componentType: FrameComponentType;
  source: "auto" | "manual";
  itemId: string;
  itemCode?: string;
  itemName?: string;
  description: string;
  qtyPerFrame: number;
  totalQuantity: number;
  uomId: string;
  uomCode?: string;
  unitRate: number;
  /** Discount rate for this part alone, 0–100. */
  discountPercent?: number;
  /** Money taken off; `totalAmount` is already net of it. */
  discountAmount?: number;
  totalAmount: number;
  roundingMode?: "none" | "ceil_per_order";
  sortOrder?: number;
};

export type FrameQuotationConfiguration = {
  id?: string;
  /** Original quotation configuration when this size has been copied to an order. */
  quotationConfigurationId?: string;
  width: number;
  height: number;
  fixedAllowance: number;
  moldingItemId?: string;
  moldingItemCode?: string;
  moldingItemName?: string;
  /** Material the line was quoted under; drives which pricing formula applied. */
  mouldingMaterial?: FrameMouldingMaterial;
  /** How many identical frames this size covers. */
  frameQuantity?: number;
  moldingStickLength?: number;
  moldingSticksRequired?: number;
  serviceFeeMode: FrameServiceFeeMode;
  serviceType?: string;
  serviceFeeAmount: number;
  totalServiceFee: number;
  invoiceDisplayMode: FrameInvoiceDisplayMode;
  /**
   * Which billing mode this configured line uses. `framing` bills one price for
   * the finished frame; `chop_join` bills every part consumed as its own line.
   * Defaults `invoiceDisplayMode` but remains independently settable.
   */
  billingMode?: FrameBillingMode;
  artworkLengthIn?: number;
  artworkWidthIn?: number;
  frameWidthIn?: number;
  sizeMode?: FrameSizeMode;
  overlapIn?: number;
  matSource?: FrameMatSource;
  glazingCutToMatOuter?: boolean;
  /**
   * Glass and backing are chosen by type, and their per-square-inch rates are
   * entered per line. Both are stored here rather than only on the component
   * rows, so a saved line can be reopened into the same editor it was built in.
   */
  matIncluded?: boolean;
  glazingIncluded?: boolean;
  glazingType?: FrameGlazingType;
  glazingUnitRate?: number;
  glazingSheets?: number;
  glazingRemarks?: string;
  backingType?: FrameBackingType;
  backingUnitRate?: number;
  /** Plywood thickness in inches; unpriced, printed for the workshop. */
  backingThicknessIn?: number;
  /** Discount rate per component key, so a reopened line restores them. */
  componentDiscounts?: Record<string, number>;
  /**
   * The point fractions as typed. Stored as two integers apiece because the
   * shop bills `(numerator + denominator) x 2 x rate` — `1/2` and `2/4` price
   * differently, so a single decimal could not round-trip them.
   */
  /**
   * The mat border for the whole stack. Layers no longer carry a measurement:
   * each one below the top reveals a fixed quarter inch taken from within this.
   */
  /** Whole-frame rate; the entire charge in `framing` mode. */
  frameRate?: number;
  /** One mat rate for the whole stack. */
  matUnitRate?: number;
  matBorderLIn?: number;
  matBorderWIn?: number;
  flexipointsNumerator?: number;
  flexipointsDenominator?: number;
  multipointsNumerator?: number;
  multipointsDenominator?: number;
  /** Free-text bench direction for this frame; prints on its requisition row. */
  framingInstructions?: string;
  /**
   * Reference files for this size. Unpriced — they never appear among the billed
   * component rows; the bench reads them to see what it is framing.
   */
  attachments?: FrameQuotationAttachment[];
};

/**
 * A stored reference file. `storagePath` is the durable handle: the bucket is
 * private, so URLs are signed per read and must never be persisted.
 */
export type FrameQuotationAttachment = {
  id?: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
};

export type FrameMouldingMaterial = "polystyrene" | "wood";

export type FrameGlazingType = "clear" | "double" | "acrylic" | "non_glare" | "octagon";
export type FrameBackingType = "mdf" | "plywood" | "sintra" | "foam";

export type FrameBillingMode = "framing" | "chop_join";
export type FrameSizeMode = "artwork" | "outside";
export type FrameMatSource = "store" | "customer";

/**
 * One mat layer on a configured line. Index 0 is the top mat, whose border runs
 * from the mat edge to its opening; layers beneath show a reveal.
 */
export type FrameQuotationMatLayer = {
  id?: string;
  /** Original quotation mat layer when this layer has been copied to an order. */
  quotationMatLayerId?: string;
  layerIndex: number;
  matBoardItemId: string;
  matBoardItemCode?: string;
  matBoardItemName?: string;
  unitRate: number;
};

/**
 * One size on a configured line. A line may carry several — an 8 × 10 and a
 * 12 × 10 of the same job — each with its own moulding, mat, glass and backing.
 * They share a billing mode and bill as a single quotation line.
 */
export type FrameQuotationSize = {
  frameConfiguration: FrameQuotationConfiguration;
  frameComponents: FrameQuotationComponent[];
  matLayers: FrameQuotationMatLayer[];
  /** Quantity originally accepted for this quoted size. */
  quotedQuantity?: number;
  /** Quantity already allocated to active Sales Orders. */
  orderedQuantity?: number;
  /** Quantity that can still be selected for a new Sales Order. */
  remainingQuantity?: number;
};

export type QuotationLineItem = {
  id: string;
  itemId: string;
  itemCode?: string; // Joined from items table
  itemName?: string; // Joined from items table
  description: string;
  quantity: number;
  orderedQuantity?: number;
  remainingQuantity?: number;
  uomId: string;
  uomCode?: string;
  uomName?: string;
  pricingTier?: string;
  pricingTierName?: string;
  unitPrice: number;
  discount: number; // Percentage
  discountAmount: number;
  taxRate: number; // Percentage
  taxAmount: number;
  lineTotal: number;
  sortOrder?: number;
  frameConfiguration?: FrameQuotationConfiguration | null;
  frameComponents?: FrameQuotationComponent[];
  matLayers?: FrameQuotationMatLayer[];
  /**
   * Every size on this line. The singular fields above carry the first size, so
   * anything reading one configuration keeps working.
   */
  frameSizes?: FrameQuotationSize[];
};

export type Quotation = {
  id: string;
  companyId: string;
  quotationNumber: string; // Maps to quotation_code in DB
  customerId: string;
  customerName?: string; // Joined from customers table
  customerEmail?: string; // Joined from customers table
  quotationDate: string;
  validUntil: string;
  /** When the customer's artwork came in. */
  dateReceived: string;
  /** When the finished work is promised back. */
  dueDate: string;
  /** Free-text record of what the customer handed over for the whole job. */
  itemsReceived: string;
  /** Payment terms quoted; same vocabulary as `customers.payment_terms`. */
  paymentTerms: string;
  status: QuotationStatus;
  /**
   * The acceptance record. Present once the quotation has been accepted — who
   * on the customer's side agreed, and through which channel. The waiver files
   * themselves are fetched separately.
   */
  acceptedByName?: string;
  acceptedChannel?: string;
  acceptedAt?: string;
  frameJobOrderId?: string;
  draftInvoiceId?: string;
  lineItems: QuotationLineItem[];
  subtotal: number;
  totalDiscount: number; // Maps to discount_amount in DB
  totalTax: number; // Maps to tax_amount in DB
  totalAmount: number; // Maps to total_amount in DB
  terms: string; // Maps to terms_conditions in DB
  notes: string;
  billingAddress?: string;
  billingCity?: string;
  billingState?: string;
  billingPostalCode?: string;
  billingCountry?: string;
  createdBy: string;
  createdByName?: string; // Joined from users table
  createdAt: string;
  updatedAt: string;
};

export type CreateQuotationItemRequest = {
  itemId: string;
  description?: string;
  quantity: number;
  uomId: string;
  rate: number;
  pricingTier?: string;
  pricingTierName?: string;
  discountPercent?: number;
  discountAmount?: number;
  taxPercent?: number;
  taxAmount?: number;
  /**
   * Exact line total. Overrides the server's `quantity × rate` derivation —
   * a configured frame's total is the sum of its printed component amounts,
   * which the rounded per-frame rate cannot reproduce.
   */
  lineTotal?: number;
  sortOrder?: number;
  notes?: string;
  frameConfiguration?: FrameQuotationConfiguration | null;
  frameComponents?: FrameQuotationComponent[];
  matLayers?: FrameQuotationMatLayer[];
  /** Every size on this line; the RPC writes one configuration per entry. */
  frameSizes?: FrameQuotationSize[];
};

export type CreateQuotationRequest = {
  quotationCode?: string;
  customerId: string;
  quotationDate: string;
  validUntil?: string;
  dateReceived: string;
  dueDate: string;
  itemsReceived?: string;
  paymentTerms?: string;
  priceListId?: string;
  items: CreateQuotationItemRequest[];
  termsConditions?: string;
  notes?: string;
};

export type UpdateQuotationRequest = {
  quotationDate?: string;
  validUntil?: string;
  dateReceived?: string;
  dueDate?: string;
  itemsReceived?: string;
  paymentTerms?: string;
  status?: QuotationStatus;
  items?: CreateQuotationItemRequest[];
  termsConditions?: string;
  notes?: string;
};

export type QuotationFilters = {
  search?: string;
  status?: QuotationStatus | "all";
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
  cursor?: string | null;
  limit?: number;
};
