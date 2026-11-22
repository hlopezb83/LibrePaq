import type {
  PolizaType,
  ThirdPartyRecord
} from '../types';

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
}

export interface AutoPolizaPlan {
  polizaType: PolizaType;
  polizaConcept: string;
  movements: AutoPolizaMovementDraft[];
  totalCargo: number;
  totalAbono: number;
  isBalanced: boolean;
}
