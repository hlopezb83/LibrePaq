import type { AccountingRuleRecord } from './accounting-rules.types';
import type { AnnualTaxInputs } from './annual-tax.types';
import type { BankN1MatchRecord } from './bank-n1.types';
import type { InventoryPeriodRecord } from './cost-of-sales.types';
import type { Account, CfdiDocument, Company, Poliza, PolizaType } from './core.types';
import type {
  BankStatementLine,
  FixedAssetRecord,
  PeriodLock,
  TaxParametersRecord,
  ThirdPartyRecord
} from './fiscal.types';

export type DiotTipoOperacion = '02' | '03' | '06' | '07' | '08' | '85' | '87';

export type VehicleCapType = 'NONE' | 'COMBUSTION' | 'ELECTRICO' | (string & {});

export interface BusinessSegment {
  id: string;
  companyId: string;
  code: string;
  name: string;
  parentId?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface PolizaTemplateMovement {
  accountCode: string;
  accountName?: string;
  referencia?: string;
  concepto?: string;
  cargoPct?: number;
  abonoPct?: number;
  cargoFixed?: number;
  abonoFixed?: number;
  businessSegmentId?: string | null;
}

export interface PolizaTemplate {
  id: string;
  companyId: string;
  name: string;
  tipo: PolizaType;
  conceptoDefault: string;
  movementsJson: PolizaTemplateMovement[];
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CustomInpcEntry {
  companyId: string;
  year: number;
  month: number;
  inpcValue: number;
  source?: string;
  updatedAt?: string;
}

export interface FiscalLossCarryforward {
  id: string;
  companyId: string;
  lossYear: number;
  originalAmount: number;
  appliedAmount: number;
  remainingAmount: number;
  inpcFirstUpdateMonth?: number | null;
  inpcLastApplied?: number | null;
  notes?: string;
  updatedAt?: string;
}

export interface CompanyBackupBundle {
  version: '2.0' | '2.1';
  exportedAt: string;
  company: Company;
  accounts: Account[];
  cfdis: CfdiDocument[];
  polizas: Poliza[];
  thirdParties: ThirdPartyRecord[];
  fixedAssets: FixedAssetRecord[];
  periodLocks: PeriodLock[];
  taxParameters: TaxParametersRecord[];
  bankStatementLines?: BankStatementLine[];
  accountingRules?: AccountingRuleRecord[];
  annualTaxSnapshots?: AnnualTaxInputs[];
  inventoryPeriods?: InventoryPeriodRecord[];
  bankStatementMatches?: BankN1MatchRecord[];
  businessSegments?: BusinessSegment[];
  polizaTemplates?: PolizaTemplate[];
  customInpcEntries?: CustomInpcEntry[];
  fiscalLossCarryforwards?: FiscalLossCarryforward[];
}
