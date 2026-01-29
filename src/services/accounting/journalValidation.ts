/**
 * Journal Entry Validation Service
 *
 * Provides validation functions for journal entries following double-entry bookkeeping rules
 */

import type { CreateJournalLineRequest } from "@/types/accounting";

export type JournalValidationError = {
  field: string;
  message: string;
};

export type JournalValidationResult = {
  isValid: boolean;
  errors: JournalValidationError[];
};

/**
 * Validates journal entry lines for double-entry bookkeeping compliance
 */
export function validateJournalLines(lines: CreateJournalLineRequest[]): JournalValidationResult {
  const errors: JournalValidationError[] = [];

  // Rule 1: Must have at least 2 lines
  if (lines.length < 2) {
    errors.push({
      field: "lines",
      message: "Journal entry must have at least 2 lines",
    });
  }

  // Rule 2: Each line must have either debit OR credit (not both, not neither)
  lines.forEach((line, index) => {
    const hasDebit = line.debit > 0;
    const hasCredit = line.credit > 0;

    if (!hasDebit && !hasCredit) {
      errors.push({
        field: `lines[${index}]`,
        message: "Line must have either debit or credit amount",
      });
    }

    if (hasDebit && hasCredit) {
      errors.push({
        field: `lines[${index}]`,
        message: "Line cannot have both debit and credit amounts",
      });
    }

    // Rule 3: Amounts must be positive
    if (line.debit < 0) {
      errors.push({
        field: `lines[${index}].debit`,
        message: "Debit amount must be positive",
      });
    }

    if (line.credit < 0) {
      errors.push({
        field: `lines[${index}].credit`,
        message: "Credit amount must be positive",
      });
    }

    // Rule 4: Must have account reference
    if (!line.accountId && !line.accountNumber) {
      errors.push({
        field: `lines[${index}]`,
        message: "Line must have either accountId or accountNumber",
      });
    }
  });

  // Rule 5: Total debits must equal total credits (balanced entry)
  const totalDebits = lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredits = lines.reduce((sum, line) => sum + line.credit, 0);

  // Use small epsilon for floating-point comparison
  const epsilon = 0.0001;
  if (Math.abs(totalDebits - totalCredits) > epsilon) {
    errors.push({
      field: "lines",
      message: `Journal entry is not balanced. Total debits (${totalDebits.toFixed(
        4
      )}) must equal total credits (${totalCredits.toFixed(4)})`,
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Calculates totals for journal entry
 */
export function calculateJournalTotals(lines: CreateJournalLineRequest[]) {
  const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredit = lines.reduce((sum, line) => sum + line.credit, 0);

  return {
    totalDebit: Number(totalDebit.toFixed(4)),
    totalCredit: Number(totalCredit.toFixed(4)),
    isBalanced: Math.abs(totalDebit - totalCredit) < 0.0001,
  };
}

/**
 * Validates posting date
 */
export function validatePostingDate(postingDate: string): JournalValidationResult {
  const errors: JournalValidationError[] = [];

  // Check if date is valid ISO format
  const date = new Date(postingDate);
  if (isNaN(date.getTime())) {
    errors.push({
      field: "postingDate",
      message: "Invalid date format. Use ISO date string (YYYY-MM-DD)",
    });
  }

  // Check if date is not in the future (more than 1 day ahead)
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  if (date > tomorrow) {
    errors.push({
      field: "postingDate",
      message: "Posting date cannot be in the future",
    });
  }

  // Check if date is not too old (more than 5 years ago)
  const fiveYearsAgo = new Date(now);
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

  if (date < fiveYearsAgo) {
    errors.push({
      field: "postingDate",
      message: "Posting date cannot be more than 5 years in the past",
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Full validation for a complete journal entry
 */
export function validateJournalEntry(
  postingDate: string,
  lines: CreateJournalLineRequest[]
): JournalValidationResult {
  const allErrors: JournalValidationError[] = [];

  // Validate posting date
  const dateValidation = validatePostingDate(postingDate);
  allErrors.push(...dateValidation.errors);

  // Validate journal lines
  const linesValidation = validateJournalLines(lines);
  allErrors.push(...linesValidation.errors);

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
  };
}
