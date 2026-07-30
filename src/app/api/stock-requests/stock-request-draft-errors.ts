const STOCK_REQUEST_DRAFT_ERRORS = {
  STOCK_REQUEST_UNAUTHORIZED: {
    status: 401,
    error: "Authentication is required to save this stock request.",
  },
  STOCK_REQUEST_FORBIDDEN: {
    status: 403,
    error: "You do not have permission to save stock requests in this business unit.",
  },
  STOCK_REQUEST_CONTEXT_INVALID: {
    status: 400,
    error: "Select a valid business unit before saving the stock request.",
  },
  STOCK_REQUEST_NOT_FOUND: {
    status: 404,
    error: "The stock request could not be found.",
  },
  STOCK_REQUEST_NOT_DRAFT: {
    status: 409,
    error: "Only draft stock requests can be updated. Refresh the page and try again.",
  },
  STOCK_REQUEST_HEADER_INVALID: {
    status: 400,
    error: "Complete the required stock request details before saving.",
  },
  STOCK_REQUEST_BUSINESS_UNITS_MUST_DIFFER: {
    status: 400,
    error: "The requesting and fulfilling business units must be different.",
  },
  STOCK_REQUEST_FULFILLING_BUSINESS_UNIT_INVALID: {
    status: 400,
    error: "Select an active fulfilling business unit in your company.",
  },
  STOCK_REQUEST_ITEMS_INVALID: {
    status: 400,
    error: "Add between 1 and 200 stock request items.",
  },
  STOCK_REQUEST_LINE_INVALID: {
    status: 400,
    error: "One or more stock request lines contain invalid values.",
  },
  STOCK_REQUEST_ITEM_UNAVAILABLE: {
    status: 409,
    error: "An item is no longer available. Refresh the item list and try again.",
  },
  STOCK_REQUEST_UNIT_OPTION_UNAVAILABLE: {
    status: 409,
    error: "A selected unit is no longer available. Reselect the unit and try again.",
  },
  STOCK_REQUEST_UNIT_OPTION_MISMATCH: {
    status: 400,
    error: "A selected unit does not match its item.",
  },
  STOCK_REQUEST_SELECTED_BATCH_UNAVAILABLE: {
    status: 409,
    error: "A selected batch is no longer available. Search for another batch and try again.",
  },
  STOCK_REQUEST_SELECTED_BATCH_ITEM_MISMATCH: {
    status: 400,
    error: "A selected batch does not match its request item.",
  },
  STOCK_REQUEST_SELECTED_BATCH_BUSINESS_UNIT_MISMATCH: {
    status: 400,
    error: "A selected batch does not belong to the fulfilling business unit.",
  },
  STOCK_REQUEST_SELECTED_BATCH_INSUFFICIENT: {
    status: 409,
    error: "A selected batch no longer has enough available quantity.",
  },
} as const;

export const mapStockRequestDraftRpcError = (message: string) => {
  const matchedCode = Object.keys(STOCK_REQUEST_DRAFT_ERRORS).find((code) =>
    message.includes(code)
  ) as keyof typeof STOCK_REQUEST_DRAFT_ERRORS | undefined;

  if (!matchedCode) {
    return {
      status: 500,
      body: {
        code: "STOCK_REQUEST_SAVE_FAILED",
        error: "The stock request could not be saved. Please try again.",
      },
    };
  }

  return {
    status: STOCK_REQUEST_DRAFT_ERRORS[matchedCode].status,
    body: {
      code: matchedCode,
      error: STOCK_REQUEST_DRAFT_ERRORS[matchedCode].error,
    },
  };
};
