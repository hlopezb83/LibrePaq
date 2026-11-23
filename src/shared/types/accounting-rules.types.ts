export type AccountingRuleDirection = 'EMITIDO' | 'RECIBIDO';

export interface AccountingRuleRecord {
  id: string;
  companyId: string;
  name: string;
  matchRfc: string | null;
  matchClaveProdServ: string | null;
  matchUsoCfdi: string | null;
  direction: AccountingRuleDirection;
  operationAccountCode: string;
  counterAccountCode: string | null;
  deductiblePct: number;
  priority: number;
  autoLearned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertAccountingRulePayload {
  id?: string;
  companyId: string;
  name?: string;
  matchRfc?: string | null;
  matchClaveProdServ?: string | null;
  matchUsoCfdi?: string | null;
  direction?: AccountingRuleDirection;
  operationAccountCode: string;
  counterAccountCode?: string | null;
  deductiblePct?: number;
  priority?: number;
  autoLearned?: boolean;
}
