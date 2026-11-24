import type {
  CfdiRelatedDocMeta,
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
  thirdParty?:
    | (Pick<ThirdPartyRecord, 'cuentaOperacionCode' | 'cuentaContrapartidaCode'> & {
        rol?: ThirdPartyRecord['rol'];
      })
    | null;
  rules?: readonly AccountingRuleRecord[];
  deductiblePct?: number;
  relatedOriginalTipoCambio?: number;
  relatedOriginalTipoCambioByUuid?: Readonly<Record<string, number>>;
  relatedDocsMetaByUuid?: Readonly<Record<string, CfdiRelatedDocMeta>>;
  relatedIsPpd?: boolean;
  relatedPpdIsrRetenido?: number;
  relatedPpdIvaRetenido?: number;
  relatedPpdTotal?: number;
}

export type AutoPolizaContextOverrides = AutoPolizaOverrides;

export interface AutoPolizaPlan {
  polizaType: PolizaType;
  polizaConcept: string;
  movements: AutoPolizaMovementDraft[];
  totalCargo: number;
  totalAbono: number;
  isBalanced: boolean;
  matchedRule?: AccountingRuleRecord | null;
}
