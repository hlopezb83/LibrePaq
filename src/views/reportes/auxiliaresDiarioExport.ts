import writeXlsx, { type SheetData } from 'write-excel-file/browser';
import { sanitizeSpreadsheetText } from '../../shared/date-utils';
import { fromCents, toCents } from '../../shared/accounting-engine';
import type { AccountWithBalance, Company, Poliza } from '../../shared/types';

export interface AuxiliarAccountBlock {
  account: AccountWithBalance;
  initialBalance: number;
  totalCharges: number;
  totalCredits: number;
  finalBalance: number;
  entries: Array<{
    movementId: string;
    polizaId: string;
    fecha: string;
    periodo: number;
    tipoPoliza: string;
    folioPoliza: number;
    referencia: string;
    concepto: string;
    cfdiUuid: string | null;
    cargo: number;
    abono: number;
    runningBalance: number;
  }>;
}

export function buildAuxiliarAccountBlocks(params: {
  accountsStart: readonly AccountWithBalance[];
  polizas: readonly Poliza[];
  codeFrom: string;
  codeTo: string;
  onlyWithActivity: boolean;
}): AuxiliarAccountBlock[] {
  const { accountsStart, polizas, codeFrom, codeTo, onlyWithActivity } = params;
  const minCode = codeFrom <= codeTo ? codeFrom : codeTo;
  const maxCode = codeFrom <= codeTo ? codeTo : codeFrom;

  const targetAccounts = accountsStart
    .filter((a) => a.isAffectable && a.code >= minCode && a.code <= maxCode)
    .sort((a, b) => a.code.localeCompare(b.code));

  const movsByCode = new Map<string, AuxiliarAccountBlock['entries']>();
  for (const pol of polizas) {
    for (const m of pol.movements) {
      const list = movsByCode.get(m.accountCode) ?? [];
      list.push({
        movementId: m.id,
        polizaId: pol.id,
        fecha: pol.fecha,
        periodo: pol.periodo,
        tipoPoliza: pol.tipo,
        folioPoliza: pol.folio,
        referencia: m.referencia || '',
        concepto: m.concepto || pol.concepto,
        cfdiUuid: m.cfdiUuid ?? pol.cfdiUuid ?? null,
        cargo: m.cargo,
        abono: m.abono,
        runningBalance: 0
      });
      movsByCode.set(m.accountCode, list);
    }
  }

  const blocks: AuxiliarAccountBlock[] = [];
  for (const acc of targetAccounts) {
    const rawEntries = movsByCode.get(acc.code) ?? [];
    if (onlyWithActivity && rawEntries.length === 0 && Math.abs(acc.initialBalanceComputed) < 0.01) {
      continue;
    }
    let runningCents = toCents(acc.initialBalanceComputed);
    let chgCents = 0;
    let credCents = 0;
    const entries = rawEntries.map((e) => {
      const cCents = toCents(e.cargo);
      const aCents = toCents(e.abono);
      chgCents += cCents;
      credCents += aCents;
      runningCents += acc.nature === 'DEUDORA' ? cCents - aCents : aCents - cCents;
      return { ...e, runningBalance: fromCents(runningCents) };
    });
    blocks.push({
      account: acc,
      initialBalance: acc.initialBalanceComputed,
      totalCharges: fromCents(chgCents),
      totalCredits: fromCents(credCents),
      finalBalance: fromCents(runningCents),
      entries
    });
  }
  return blocks;
}

const sCell = (val: string, bold = false) => ({
  type: String as typeof String,
  value: sanitizeSpreadsheetText(val),
  ...(bold ? { fontWeight: 'bold' as const } : {})
});

export async function exportDiarioGeneralXlsx(params: {
  company: Company;
  ejercicio: number;
  periodFrom: number;
  periodTo: number;
  polizas: readonly Poliza[];
}): Promise<void> {
  const { company, ejercicio, periodFrom, periodTo, polizas } = params;
  const rows: SheetData = [
    [sCell(`${company.name} (${company.rfc})`, true)],
    [sCell(`Diario General - Ejercicio ${ejercicio} (P${String(periodFrom).padStart(2, '0')} a P${String(periodTo).padStart(2, '0')})`, true)],
    [],
    [
      sCell('Fecha', true),
      sCell('Póliza', true),
      sCell('Cuenta', true),
      sCell('Nombre Cuenta', true),
      sCell('Referencia', true),
      sCell('Concepto', true),
      sCell('UUID CFDI', true),
      sCell('Cargo (Debe)', true),
      sCell('Abono (Haber)', true)
    ]
  ];

  let totalCargosCents = 0;
  let totalAbonosCents = 0;
  for (const p of polizas) {
    for (const m of p.movements) {
      totalCargosCents += toCents(m.cargo);
      totalAbonosCents += toCents(m.abono);
      rows.push([
        sCell(p.fecha),
        sCell(`${p.tipo} #${p.folio}`),
        sCell(m.accountCode),
        sCell(m.accountName),
        sCell(m.referencia || ''),
        sCell(m.concepto || p.concepto),
        sCell(m.cfdiUuid || p.cfdiUuid || ''),
        { type: Number, value: m.cargo, format: '$#,##0.00' },
        { type: Number, value: m.abono, format: '$#,##0.00' }
      ]);
    }
  }

  rows.push([
    sCell('SUMAS IGUALES', true),
    sCell(''),
    sCell(''),
    sCell(''),
    sCell(''),
    sCell(''),
    sCell(''),
    { type: Number, value: fromCents(totalCargosCents), format: '$#,##0.00', fontWeight: 'bold' },
    { type: Number, value: fromCents(totalAbonosCents), format: '$#,##0.00', fontWeight: 'bold' }
  ]);

  await writeXlsx([
    {
      sheet: 'Diario General',
      data: rows,
      columns: [
        { width: 13 }, { width: 15 }, { width: 15 }, { width: 28 }, { width: 14 },
        { width: 34 }, { width: 36 }, { width: 16 }, { width: 16 }
      ]
    }
  ]).toFile(`Diario_General_${company.rfc}_${ejercicio}_P${String(periodFrom).padStart(2, '0')}-P${String(periodTo).padStart(2, '0')}.xlsx`);
}

export async function exportAuxiliaresRangeXlsx(params: {
  company: Company;
  ejercicio: number;
  periodFrom: number;
  periodTo: number;
  blocks: readonly AuxiliarAccountBlock[];
}): Promise<void> {
  const { company, ejercicio, periodFrom, periodTo, blocks } = params;
  const rows: SheetData = [
    [sCell(`${company.name} (${company.rfc})`, true)],
    [sCell(`Auxiliar de Movimientos - Ejercicio ${ejercicio} (P${String(periodFrom).padStart(2, '0')} a P${String(periodTo).padStart(2, '0')})`, true)],
    [],
    [
      sCell('Cuenta', true),
      sCell('Fecha', true),
      sCell('Póliza', true),
      sCell('Referencia', true),
      sCell('Concepto', true),
      sCell('Cargo (Debe)', true),
      sCell('Abono (Haber)', true),
      sCell('Saldo Progresivo', true)
    ]
  ];

  for (const b of blocks) {
    rows.push([
      sCell(`${b.account.code} - ${b.account.name}`, true),
      sCell('SALDO INICIAL', true),
      sCell(''),
      sCell(''),
      sCell(`Naturaleza ${b.account.nature}`),
      { type: Number, value: 0, format: '$#,##0.00' },
      { type: Number, value: 0, format: '$#,##0.00' },
      { type: Number, value: b.initialBalance, format: '$#,##0.00', fontWeight: 'bold' }
    ]);
    for (const e of b.entries) {
      rows.push([
        sCell(b.account.code),
        sCell(e.fecha),
        sCell(`${e.tipoPoliza} #${e.folioPoliza}`),
        sCell(e.referencia),
        sCell(e.concepto),
        { type: Number, value: e.cargo, format: '$#,##0.00' },
        { type: Number, value: e.abono, format: '$#,##0.00' },
        { type: Number, value: e.runningBalance, format: '$#,##0.00' }
      ]);
    }
    rows.push([
      sCell(`Subtotal ${b.account.code}`, true),
      sCell(''),
      sCell(''),
      sCell(''),
      sCell('Saldo Final de Cuenta', true),
      { type: Number, value: b.totalCharges, format: '$#,##0.00', fontWeight: 'bold' },
      { type: Number, value: b.totalCredits, format: '$#,##0.00', fontWeight: 'bold' },
      { type: Number, value: b.finalBalance, format: '$#,##0.00', fontWeight: 'bold' }
    ]);
  }

  await writeXlsx([
    {
      sheet: 'Auxiliar de Movimientos',
      data: rows,
      columns: [
        { width: 32 }, { width: 13 }, { width: 15 }, { width: 14 },
        { width: 34 }, { width: 16 }, { width: 16 }, { width: 18 }
      ]
    }
  ]).toFile(`Auxiliar_Movimientos_${company.rfc}_${ejercicio}_P${String(periodFrom).padStart(2, '0')}-P${String(periodTo).padStart(2, '0')}.xlsx`);
}

function escapeHtml(val: string | number | null | undefined): string {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function printReportHtmlDocument(title: string, subtitle: string, bodyHtml: string): boolean {
  if (typeof window === 'undefined') return false;
  const win = window.open('', '_blank', 'width=1024,height=800');
  if (!win) return false;
  win.document.open();
  win.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
  <style>
    @page { size: letter portrait; margin: 10mm; }
    body { font-family: system-ui, sans-serif; color: #0f172a; font-size: 10px; margin: 0; }
    h1 { font-size: 14px; margin: 0 0 2px; text-transform: uppercase; }
    p { margin: 0 0 10px; color: #475569; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    th, td { border: 1px solid #cbd5e1; padding: 4px 6px; text-align: left; }
    thead th { background: #f1f5f9; font-size: 9px; text-transform: uppercase; }
    tfoot td { background: #f8fafc; font-weight: 700; border-top: 2px solid #0f172a; }
    .right { text-align: right; font-family: monospace; }
    .mono { font-family: monospace; }
    .subrow { background: #f8fafc; font-weight: 700; }
  </style></head><body>
  <h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p>${bodyHtml}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 200);
  return true;
}
