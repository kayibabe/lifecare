/**
 * Claim validation rules and logic
 */

export const validateClaim = (claim, patients, invoices) => {
  const errors = [];
  const warnings = [];

  // Required fields
  if (!claim.patient_id) errors.push("Patient is required");
  if (!claim.invoice_id) errors.push("Invoice is required");
  if (!claim.scheme_name) errors.push("Insurance scheme is required");
  if (!claim.claim_amount || Number(claim.claim_amount) <= 0) {
    errors.push("Claim amount must be greater than 0");
  }

  // Logical validations
  const patient = patients.find(p => p.id === claim.patient_id);
  const invoice = invoices.find(i => i.id === claim.invoice_id);

  if (invoice && claim.claim_amount > invoice.total_amount) {
    errors.push(
      `Claim amount (${claim.claim_amount}) exceeds invoice total (${invoice.total_amount})`
    );
  }

  if (invoice && patient && invoice.patient_id !== patient.id) {
    errors.push("Selected invoice does not belong to the selected patient");
  }

  // Co-pay validation
  if (claim.co_pay_amount && Number(claim.co_pay_amount) < 0) {
    errors.push("Co-pay amount cannot be negative");
  }

  if (
    invoice &&
    claim.claim_amount &&
    claim.co_pay_amount &&
    Number(claim.claim_amount) + Number(claim.co_pay_amount) > invoice.total_amount
  ) {
    warnings.push(
      "Claim + co-pay exceeds invoice total. Patient may owe the difference."
    );
  }

  return { valid: errors.length === 0, errors, warnings };
};

export const validateBatchClaims = (claimIds, claims, patients, invoices) => {
  const results = {
    valid: [],
    invalid: [],
    warnings: []
  };

  claimIds.forEach(claimId => {
    const claim = claims.find(c => c.id === claimId);
    if (!claim) return;

    const validation = validateClaim(claim, patients, invoices);
    if (validation.valid) {
      results.valid.push(claimId);
    } else {
      results.invalid.push({ claimId, errors: validation.errors });
    }
    if (validation.warnings.length > 0) {
      results.warnings.push({ claimId, warnings: validation.warnings });
    }
  });

  return results;
};

export const getValidationStatusColor = (status) => {
  const colorMap = {
    valid: "bg-chart-3/10 text-chart-3 border-chart-3/20",
    invalid: "bg-destructive/10 text-destructive border-destructive/20",
    warning: "bg-chart-2/10 text-chart-2 border-chart-2/20"
  };
  return colorMap[status] || "bg-muted";
};