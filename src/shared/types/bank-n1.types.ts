import type { BankReconciliationResponse } from './fiscal.types';

export type BankN1Direction = 'DEPOSIT' | 'WITHDRAWAL';

export interface BankN1ProposedMovement {
  movementId: string;
  polizaId: string;
  polizaFolio: string;
  fecha: string;
  referencia: string;
  concepto: string;
  amount: number;
}

export interface BankN1MatchProposal {
  bankLineId: string;
  bankFecha: string;
  bankReferencia: string;
  bankDescripcion: string;
  direction: BankN1Direction;
  bankAmount: number;
  booksTotalAmount: number;
  diffCents: number;
  movements: BankN1ProposedMovement[];
}

export interface BankN1MatchRecord {
  id: string;
  companyId: string;
  bankLineId: string;
  movementId: string;
  polizaId: string;
  matchedAmount: number;
  createdAt: string;
}

export interface BankN1ApplyItem {
  bankLineId: string;
  movementIds: string[];
}

export interface BankN1ProposeResponse {
  proposals: BankN1MatchProposal[];
  matches: BankN1MatchRecord[];
}

export interface BankN1ApplyResponse {
  appliedCount: number;
  matchedLineIds: string[];
  matches: BankN1MatchRecord[];
  reconciliation: BankReconciliationResponse | null;
}

export interface ExtractedBankPdfMovement {
  fecha: string;
  referencia: string;
  descripcion: string;
  cargo: number;
  abono: number;
}

export interface ExtractBankPdfResponse {
  ok: boolean;
  banco?: string;
  cuenta?: string;
  moneda?: string;
  periodo?: string;
  movimientos?: ExtractedBankPdfMovement[];
  code?: string;
  error?: string;
}
