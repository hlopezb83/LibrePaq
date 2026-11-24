import writeXlsx, { type SheetData } from 'write-excel-file/browser';
import { formatCurrency } from '../../lib/formatters';
import { sanitizeSpreadsheetText } from '../../shared/date-utils';
import { fromCents, toCents } from '../../shared/engine/invariants-and-math';
import type { BankReconciliationResponse, ReconciliationFormulaData } from '../../shared/types';

export interface BankReconciliationProof {
  saldoEstadoCuenta: number;
  cargosContablesEnTransito: number;
  abonosContablesEnTransito: number;
  saldoConciliadoBanco: number;
  saldoFinalLibros: number;
  depositosBancoNoRegistrados: number;
  cargosBancoNoRegistrados: number;
  saldoConciliadoLibros: number;
  diferenciaCuadre: number;
  isCuadrada: boolean;
}

export function computeBankReconciliationProof(
  reconData: BankReconciliationResponse,
  reconFormula: ReconciliationFormulaData,
  bankStatementFinalBalance: number
): BankReconciliationProof {
  const saldoBancoCents = toCents(bankStatementFinalBalance);
  const cargosTransitoCents = toCents(reconFormula.cargosContablesEnTransito);
  const abonosTransitoCents = toCents(reconFormula.abonosContablesEnTransito);
  const conciliadoBancoCents = saldoBancoCents + cargosTransitoCents - abonosTransitoCents;

  const saldoLibrosCents = toCents(reconData.summary.saldoFinalLibros);
  const depBancoNoRegCents = toCents(reconFormula.depositosBancoNoRegistrados);
  const cargosBancoNoRegCents = toCents(reconFormula.cargosBancoNoRegistrados);
  const conciliadoLibrosCents = saldoLibrosCents + depBancoNoRegCents - cargosBancoNoRegCents;

  const diffCents = conciliadoBancoCents - conciliadoLibrosCents;
  return {
    saldoEstadoCuenta: fromCents(saldoBancoCents),
    cargosContablesEnTransito: fromCents(cargosTransitoCents),
    abonosContablesEnTransito: fromCents(abonosTransitoCents),
    saldoConciliadoBanco: fromCents(conciliadoBancoCents),
    saldoFinalLibros: fromCents(saldoLibrosCents),
    depositosBancoNoRegistrados: fromCents(depBancoNoRegCents),
    cargosBancoNoRegistrados: fromCents(cargosBancoNoRegCents),
    saldoConciliadoLibros: fromCents(conciliadoLibrosCents),
    diferenciaCuadre: fromCents(diffCents),
    isCuadrada: diffCents === 0
  };
}

const sCell = (val: string | number | null | undefined) => ({
  type: String,
  value: sanitizeSpreadsheetText(String(val ?? ''))
});
const nCell = (val: number) => ({ type: Number, value: Number(val.toFixed(2)), format: '#,##0.00' });

export async function exportBankReconciliationXlsx(params: {
  companyName: string;
  companyRfc: string;
  reconData: BankReconciliationResponse;
  reconFormula: ReconciliationFormulaData;
  bankStatementFinalBalance: number;
}): Promise<void> {
  const { companyName, companyRfc, reconData, reconFormula, bankStatementFinalBalance } = params;
  const proof = computeBankReconciliationProof(reconData, reconFormula, bankStatementFinalBalance);
  const periodLabel = `P${String(reconData.periodo).padStart(2, '0')}/${reconData.ejercicio}`;

  const summarySheet: SheetData = [
    [{ value: 'CÉDULA DE CONCILIACIÓN BANCARIA', fontWeight: 'bold', type: String }],
    [sCell(`${companyRfc} — ${companyName}`), sCell(`Cuenta: ${reconData.account.code} ${reconData.account.name}`), sCell(`Periodo: ${periodLabel}`)],
    [],
    [{ value: 'I. CONCILIACIÓN POR LADO BANCO', fontWeight: 'bold', type: String }, { value: 'IMPORTE (MXN)', fontWeight: 'bold', type: String }],
    [sCell('Saldo Final Estado de Cuenta Bancario'), nCell(proof.saldoEstadoCuenta)],
    [sCell('(+) Depósitos / Cargos Contables en Tránsito (Libros)'), nCell(proof.cargosContablesEnTransito)],
    [sCell('(-) Cheques / Abonos Contables en Tránsito (Libros)'), nCell(proof.abonosContablesEnTransito)],
    [{ value: '(=) Saldo Conciliado según Banco', fontWeight: 'bold', type: String }, nCell(proof.saldoConciliadoBanco)],
    [],
    [{ value: 'II. CONCILIACIÓN POR LADO LIBROS', fontWeight: 'bold', type: String }, { value: 'IMPORTE (MXN)', fontWeight: 'bold', type: String }],
    [sCell('Saldo Final en Libros Contables'), nCell(proof.saldoFinalLibros)],
    [sCell('(+) Depósitos en Banco No Registrados en Libros'), nCell(proof.depositosBancoNoRegistrados)],
    [sCell('(-) Cargos / Comisiones Banco No Registrados'), nCell(proof.cargosBancoNoRegistrados)],
    [{ value: '(=) Saldo Conciliado según Libros', fontWeight: 'bold', type: String }, nCell(proof.saldoConciliadoLibros)],
    [],
    [{ value: 'DIFERENCIA DE CUADRE', fontWeight: 'bold', type: String }, nCell(proof.diferenciaCuadre)]
  ];

  const pendingBank = reconData.statementLines.filter((l) => !l.matchedMovementId);
  const pendingBooks = reconData.bookMovements.filter((b) => !b.isMatched);

  const pendingSheet: SheetData = [
    [{ value: 'PARTIDAS PENDIENTES / EN TRÁNSITO', fontWeight: 'bold', type: String }],
    [sCell('Origen'), sCell('Fecha'), sCell('Referencia / Póliza'), sCell('Descripción / Concepto'), sCell('Cargo'), sCell('Abono')],
    ...pendingBank.map((l) => [sCell('Banco No Reg.'), sCell(l.fecha), sCell(l.referencia), sCell(l.descripcion), nCell(l.cargoBanco), nCell(l.abonoBanco)]),
    ...pendingBooks.map((b) => [sCell('Libros Tránsito'), sCell(b.fecha), sCell(b.polizaFolio), sCell(b.concepto), nCell(b.cargoContable), nCell(b.abonoContable)])
  ];

  const detailSheet: SheetData = [
    [{ value: 'DETALLE ESTADO DE CUENTA BANCARIO', fontWeight: 'bold', type: String }],
    [sCell('Fecha'), sCell('Referencia'), sCell('Descripción'), sCell('Retiro (Cargo)'), sCell('Depósito (Abono)'), sCell('Estatus')],
    ...reconData.statementLines.map((l) => [
      sCell(l.fecha), sCell(l.referencia), sCell(l.descripcion), nCell(l.cargoBanco), nCell(l.abonoBanco),
      sCell(l.matchedMovementId ? `Conciliado (${l.matchedPolizaFolio || 'Póliza'})` : 'Sin Conciliar')
    ])
  ];

  await writeXlsx(
    [
      { sheet: 'Resumen Conciliación', data: summarySheet },
      { sheet: 'Partidas Pendientes', data: pendingSheet },
      { sheet: 'Detalle Banco', data: detailSheet }
    ]
  ).toFile(`Conciliacion_${reconData.account.code}_${companyRfc}_${periodLabel.replace('/', '-')}.xlsx`);
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function printBankReconciliationPdf(params: {
  companyName: string;
  companyRfc: string;
  reconData: BankReconciliationResponse;
  reconFormula: ReconciliationFormulaData;
  bankStatementFinalBalance: number;
}): boolean {
  const { companyName, companyRfc, reconData, reconFormula, bankStatementFinalBalance } = params;
  const proof = computeBankReconciliationProof(reconData, reconFormula, bankStatementFinalBalance);
  const periodLabel = `P${String(reconData.periodo).padStart(2, '0')}/${reconData.ejercicio}`;
  const win = window.open('', '_blank', 'width=980,height=760');
  if (!win) return false;

  const pendingBank = reconData.statementLines.filter((l) => !l.matchedMovementId);
  const pendingBooks = reconData.bookMovements.filter((b) => !b.isMatched);

  const rowsHtml = [
    ...pendingBank.map((l) => `<tr><td>Banco No Reg.</td><td>${escapeHtml(l.fecha)}</td><td>${escapeHtml(l.referencia)}</td><td>${escapeHtml(l.descripcion)}</td><td class="num">${formatCurrency(l.cargoBanco)}</td><td class="num">${formatCurrency(l.abonoBanco)}</td></tr>`),
    ...pendingBooks.map((b) => `<tr><td>Libros Tránsito</td><td>${escapeHtml(b.fecha)}</td><td>${escapeHtml(b.polizaFolio)}</td><td>${escapeHtml(b.concepto)}</td><td class="num">${formatCurrency(b.cargoContable)}</td><td class="num">${formatCurrency(b.abonoContable)}</td></tr>`)
  ].join('');

  win.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"/><title>Conciliación Bancaria ${escapeHtml(periodLabel)}</title>
  <style>body{font-family:system-ui,sans-serif;padding:28px;color:#0f172a;font-size:12px}h1{font-size:16px;margin:0 0 4px}table{width:100%;border-collapse:collapse;margin:14px 0}th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left}th{background:#f1f5f9;font-size:11px;text-transform:uppercase}.num{text-align:right;font-family:monospace}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.sign{margin-top:40px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:24px;text-align:center}.line{border-top:1px solid #475569;padding-top:6px;margin-top:36px}</style></head><body>
  <h1>Cédula Formal de Conciliación Bancaria</h1>
  <div><strong>${escapeHtml(companyRfc)} — ${escapeHtml(companyName)}</strong> | Cuenta: ${escapeHtml(reconData.account.code)} ${escapeHtml(reconData.account.name)} | Periodo: ${escapeHtml(periodLabel)}</div>
  <div class="grid">
    <table><thead><tr><th colspan="2">Aritmética Lado Banco</th></tr></thead><tbody>
      <tr><td>Saldo Final Estado de Cuenta</td><td class="num">${formatCurrency(proof.saldoEstadoCuenta)}</td></tr>
      <tr><td>(+) Depósitos en Tránsito (Cargos Libros)</td><td class="num">${formatCurrency(proof.cargosContablesEnTransito)}</td></tr>
      <tr><td>(-) Cheques / Pagos en Tránsito (Abonos Libros)</td><td class="num">-${formatCurrency(proof.abonosContablesEnTransito)}</td></tr>
      <tr><th>(=) Saldo Conciliado Banco</th><th class="num">${formatCurrency(proof.saldoConciliadoBanco)}</th></tr>
    </tbody></table>
    <table><thead><tr><th colspan="2">Aritmética Lado Libros</th></tr></thead><tbody>
      <tr><td>Saldo Final en Libros</td><td class="num">${formatCurrency(proof.saldoFinalLibros)}</td></tr>
      <tr><td>(+) Depósitos Banco No Registrados</td><td class="num">${formatCurrency(proof.depositosBancoNoRegistrados)}</td></tr>
      <tr><td>(-) Cargos Banco No Registrados</td><td class="num">-${formatCurrency(proof.cargosBancoNoRegistrados)}</td></tr>
      <tr><th>(=) Saldo Conciliado Libros</th><th class="num">${formatCurrency(proof.saldoConciliadoLibros)}</th></tr>
    </tbody></table>
  </div>
  <div><strong>Diferencia de Cuadre:</strong> ${formatCurrency(proof.diferenciaCuadre)} (${proof.isCuadrada ? 'CUADRADA' : 'CON DIFERENCIA'})</div>
  <h3>Partidas Pendientes / En Tránsito (${pendingBank.length + pendingBooks.length})</h3>
  <table><thead><tr><th>Origen</th><th>Fecha</th><th>Ref./Póliza</th><th>Concepto</th><th class="num">Cargo</th><th class="num">Abono</th></tr></thead><tbody>${rowsHtml || '<tr><td colspan="6">Sin partidas pendientes.</td></tr>'}</tbody></table>
  <div class="sign"><div class="line">Elaboró (Auxiliar)</div><div class="line">Revisó (Contador)</div><div class="line">Autorizó (Socio/Dirección)</div></div>
  </body></html>`);
  win.document.close();
  win.focus();
  win.print();
  return true;
}
