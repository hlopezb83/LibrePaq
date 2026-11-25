import type { Account, Poliza, PolizaType } from '../../shared/types';
import type { DraftMovement } from './poliza-editor.types';

export interface PolizaEditorSnapshot {
  tipo: PolizaType;
  fecha: string;
  concepto: string;
  cfdiUuids: string[];
  movements: Array<{
    accountId: string;
    referencia: string;
    concepto: string;
    cargo: number;
    abono: number;
    cfdiUuid: string | null;
    paymentMethodSat: string | null;
    bankCodeOri: string | null;
    accountOri: string | null;
    bankCodeDest: string | null;
    accountDest: string | null;
    beneficiaryName: string | null;
    beneficiaryRfc: string | null;
    chequeNum: string | null;
    businessSegmentId: string | null;
  }>;
}

const normStr = (v?: string | null): string | null => {
  const s = v?.trim() ?? '';
  return s.length > 0 ? s : null;
};

export function createPolizaSnapshot(params: {
  tipo: PolizaType;
  fecha: string;
  concepto: string;
  cfdiUuids: string[];
  movements: DraftMovement[];
}): PolizaEditorSnapshot {
  return {
    tipo: params.tipo,
    fecha: params.fecha,
    concepto: params.concepto,
    cfdiUuids: params.cfdiUuids.map((u) => u.trim().toUpperCase()).filter(Boolean),
    movements: params.movements.map((m) => ({
      accountId: m.accountId,
      referencia: m.referencia,
      concepto: m.concepto,
      cargo: Number(m.cargo || 0),
      abono: Number(m.abono || 0),
      cfdiUuid: m.cfdiUuid ? m.cfdiUuid.trim().toUpperCase() : null,
      paymentMethodSat: normStr(m.paymentMethodSat),
      bankCodeOri: normStr(m.bankCodeOri),
      accountOri: normStr(m.accountOri),
      bankCodeDest: normStr(m.bankCodeDest),
      accountDest: normStr(m.accountDest),
      beneficiaryName: normStr(m.beneficiaryName),
      beneficiaryRfc: normStr(m.beneficiaryRfc)?.toUpperCase() ?? null,
      chequeNum: normStr(m.chequeNum),
      businessSegmentId: normStr(m.businessSegmentId)
    }))
  };
}

export function isPolizaSnapshotDirty(
  initial: PolizaEditorSnapshot | null | undefined,
  current: PolizaEditorSnapshot
): boolean {
  if (!initial) {
    return (
      current.concepto.trim().length > 0 ||
      current.cfdiUuids.length > 0 ||
      current.movements.some((m) => m.cargo > 0 || m.abono > 0)
    );
  }
  if (
    initial.tipo !== current.tipo ||
    initial.fecha !== current.fecha ||
    initial.concepto !== current.concepto ||
    initial.cfdiUuids.length !== current.cfdiUuids.length ||
    initial.movements.length !== current.movements.length
  ) {
    return true;
  }
  for (let i = 0; i < initial.cfdiUuids.length; i += 1) {
    if (initial.cfdiUuids[i] !== current.cfdiUuids[i]) return true;
  }
  for (let i = 0; i < initial.movements.length; i += 1) {
    const a = initial.movements[i]!;
    const b = current.movements[i]!;
    if (
      a.accountId !== b.accountId ||
      a.referencia !== b.referencia ||
      a.concepto !== b.concepto ||
      a.cargo !== b.cargo ||
      a.abono !== b.abono ||
      a.cfdiUuid !== b.cfdiUuid ||
      a.paymentMethodSat !== b.paymentMethodSat ||
      a.bankCodeOri !== b.bankCodeOri ||
      a.accountOri !== b.accountOri ||
      a.bankCodeDest !== b.bankCodeDest ||
      a.accountDest !== b.accountDest ||
      a.beneficiaryName !== b.beneficiaryName ||
      a.beneficiaryRfc !== b.beneficiaryRfc ||
      a.chequeNum !== b.chequeNum ||
      a.businessSegmentId !== b.businessSegmentId
    ) {
      return true;
    }
  }
  return false;
}

export function shouldTriggerDittoKey(
  key: string,
  value: string,
  selectionStart: number | null,
  selectionEnd: number | null
): boolean {
  if (key === 'F3') return true;
  if (key !== '"') return false;
  if (value.length === 0) return true;
  return selectionStart === 0 && selectionEnd === value.length;
}

const SAT_UUID_REGEX =
  /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/;

export function isValidSatUuid(raw: string): boolean {
  return SAT_UUID_REGEX.test(raw.trim());
}

export function buildInitialPolizaMovements(affectableAccounts: Account[]): DraftMovement[] {
  const defaultAcc1 = affectableAccounts[0]?.id || '';
  const defaultAcc2 = affectableAccounts[1]?.id || defaultAcc1;
  return [
    { _rowId: crypto.randomUUID(), accountId: defaultAcc1, referencia: 'REF-01', concepto: '', cargo: 0, abono: 0 },
    { _rowId: crypto.randomUUID(), accountId: defaultAcc2, referencia: 'REF-01', concepto: '', cargo: 0, abono: 0 }
  ];
}

export function mapPolizaMovementsToDraft(pol: Poliza, preserveIds: boolean): DraftMovement[] {
  return pol.movements.map((m) => ({
    _rowId: preserveIds && m.id ? m.id : crypto.randomUUID(),
    accountId: m.accountId,
    referencia: m.referencia,
    concepto: m.concepto,
    cargo: m.cargo,
    abono: m.abono,
    ...(preserveIds ? { cfdiUuid: m.cfdiUuid ?? null } : {}),
    paymentMethodSat: m.paymentMethodSat ?? null,
    bankCodeOri: m.bankCodeOri ?? null,
    accountOri: m.accountOri ?? null,
    bankCodeDest: m.bankCodeDest ?? null,
    accountDest: m.accountDest ?? null,
    beneficiaryName: m.beneficiaryName ?? null,
    beneficiaryRfc: m.beneficiaryRfc ?? null,
    chequeNum: m.chequeNum ?? null,
    businessSegmentId: m.businessSegmentId ?? null
  }));
}
