// ============================================================================
// Libre CONTPAQ (LibrePaq Pro) - Unified Accounting Engine Facade
// NASA Power of 10 Architecture: Zero Floating Drift & 100% Deterministic Math
// ============================================================================

export {
  AccountingInvariantError,
  assertAccountingInvariant,
  toCents,
  fromCents,
  sumCents,
  validateDoubleEntryMovements,
  validateAccountHierarchy
} from './engine/invariants-and-math';

export {
  resolveFiscalAccount,
  inferExpenseAccountForCfdi,
  buildAutoPolizaPlan,
  type AutoPolizaMovementDraft,
  type AutoPolizaOverrides,
  type AutoPolizaPlan
} from './engine/auto-poliza.engine';

export {
  computeFixedAssetWithDepreciation,
  buildDepreciationPolizaPlan,
  computeFiscalWorkpaper,
  calculateResicoPfRate
} from './engine/fiscal.engine';

export { calculateArt106PfIsr } from './engine/art106-tax.engine';

export {
  buildTaxProvisionMovements,
  buildExchangeFluctuationMovements
} from './engine/tax-provision.engine';

export { buildYearCloseMovements } from './engine/bank-and-closing.engine';

export {
  validateRfcModulo11,
  calculateRfcCheckDigit,
  fixRfcCheckDigit,
  type RfcModulo11Step,
  type RfcModulo11Result
} from './engine/rfc-validator';
