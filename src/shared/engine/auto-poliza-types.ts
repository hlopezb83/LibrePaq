import type {
  PolizaType,
  ThirdPartyRecord
} from '../types';
import type { AccountingRuleRecord } from '../types/accounting-rules.types';

export type { AccountingRuleRecord };

export interface AutoPolizaMovementDraft {
  accountId: string;
  accountCode: string;
  accountName: string;
  referencia: string;
  cargo: number;
  abono: number;
  concepto: string;
}

export interface AutoPolizaOverrides {
  polizaType?: PolizaType;
  operationAccountCode?: string;
  counterAccountCode?: string;
  expenseOrIncomeAccountId?: string;
  bankOrCounterpartyAccountId?: string;
  thirdParty?: Pick<ThirdPartyRecord, 'cuentaOperacionCode' | 'cuentaContrapartidaCode'> | null;
  rules?: readonly AccountingRuleRecord[];
  deductiblePct?: number;
  relatedOriginalTipoCambio?: number;
}

export interface AutoPolizaPlan {
  polizaType: PolizaType;
  polizaConcept: string;
  movements: AutoPolizaMovementDraft[];
  totalCargo: number;
  totalAbono: number;
  isBalanced: boolean;
  matchedRule?: AccountingRuleRecord | null;
}
