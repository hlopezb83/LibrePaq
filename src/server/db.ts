// ============================================================================
// Libre CONTPAQ (LibrePaq Pro) - Unified Database Engine & Domain Repositories
// NASA Power of 10 Architecture: Encapsulated Repositories & Type Facade
// ============================================================================

export {
  db,
  dataDir,
  mapCompanyRow,
  mapAccountRow,
  mapCfdiRow,
  mapThirdPartyRow,
  mapFixedAssetRow,
  type CompanyDbRow,
  type AccountDbRow,
  type PolizaDbRow,
  type PolizaMovementDbRow,
  type CfdiDbRow,
  type BankLineDbRow,
  type PeriodLockDbRow,
  type ThirdPartyDbRow,
  type FixedAssetDbRow,
  type TaxParametersDbRow
} from './connection';

export {
  initDatabase,
  ensureExtendedFiscalSeedsForCompany
} from './schema';

export {
  seedAccountsForCompany,
  getAccounts,
  createAccountRecord,
  updateAccountRecord,
  deleteAccountRecord,
  batchImportAccountsCatalog
} from './repositories/accounts.repo';

export {
  computeTrialBalance,
  computeMonthlyTrendFast
} from './repositories/trial-balance.repo';

export {
  getAccountLedger
} from './repositories/account-ledger.repo';

export {
  getPolizas,
  createPolizaTransaction,
  updatePolizaTransaction,
  deletePolizaTransaction,
  insertPolizaStmt,
  insertMovementStmt,
  maxFolioQuery
} from './repositories/polizas.repo';

export {
  closeYearPolizaTransaction
} from './repositories/polizas-closing.repo';

export {
  getCfdiDocuments,
  getCfdiById,
  getCfdiXml,
  insertParsedCfdiRecord,
  batchUploadCfdiXmlStrings,
  deleteCfdiRecord,
  generateAutoPolizaFromCfdiId,
  batchGenerateAutoPolizasFromCfdiIds
} from './repositories/cfdi.repo';

export {
  getBankReconciliation,
  addBankStatementLinesTransaction,
  autoMatchBankLinesTransaction,
  unmatchBankLineTransaction
} from './repositories/bank.repo';

export {
  createPolizaFromBankLineTransaction
} from './repositories/bank-poliza.repo';

export {
  getFielCredentialStatus,
  saveFielCredentialsForCompany,
  generateAndInstallTestFielForCompany,
  type FielDbRow
} from './repositories/fiel-credentials.repo';

export {
  getSatDownloadRequests,
  executeSatSoapMassiveDownload,
  verifyCfdiStatusViaSatSoap,
  type SatRequestDbRow
} from './repositories/sat-soap-download.service';

export {
  getPeriodLock,
  setPeriodLock,
  assertPeriodOpen
} from './repositories/period-locks.repo';

export {
  getThirdPartyByRfc,
  syncThirdPartiesFromCfdis,
  upsertThirdPartyRecord
} from './repositories/third-parties.repo';

export {
  getDiotReport,
  getFixedAssetsResponse,
  createFixedAssetRecord,
  deleteFixedAssetRecord,
  generateMonthlyDepreciationPoliza,
  getTaxParameters,
  saveTaxParameters,
  getFiscalWorkpaperReport,
  getCxcCxpAgingRepo,
  verifyCfdisSatBatchRepo
} from './repositories/fiscal.repo';

export {
  generateExchangeFluctuationPoliza,
  generateTaxProvisionPoliza
} from './repositories/tax-provision.repo';

export {
  companyExistsById,
  getCompanies,
  getCompanyById,
  createCompanyRecord,
  updateCompanyRecord,
  deleteCompanyRecord,
  updateCompanyPeriodRecord
} from './repositories/companies.repo';

export {
  restoreCompanyBackupBundle,
  exportCompanyBackupBundle
} from './repositories/backup-restore.repo';
