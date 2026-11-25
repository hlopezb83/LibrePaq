import type { SheetData } from 'write-excel-file/browser';
import { formatBalanceCutoffLabel } from '../shared/date-utils';
import { fromCents, toCents } from '../shared/engine/invariants-and-math';
import type {
  BankReconciliationResponse,
  Company,
  CxcCxpAgingResponse,
  CxcCxpDocumentRow
} from '../shared/types';
import { xNum, xStr } from './excel-deliverable-sheets';

export interface DossierBankReconSummary {
  recon: BankReconciliationResponse;
  hasCapturedBankBalance: boolean;
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
  pendingBank: BankReconciliationResponse['statementLines'];
  pendingBooks: BankReconciliationResponse['bookMovements'];
}

export interface TopCounterpartyAgingRow {
  rfc: string;
  nombre: string;
  docsCount: number;
  totalOriginalMxn: number;
  totalPagadoMxn: number;
  saldoInsolutoMxn: number;
  vencidoMas30Mxn: number;
  maxDaysPast: number;
}

export function computeDossierBankReconSummary(
  recon: BankReconciliationResponse
): DossierBankReconSummary {
  const pendingBank = recon.statementLines.filter((l) => !l.matchedMovementId);
  const pendingBooks = recon.bookMovements.filter((b) => !b.isMatched);

  const cargosBancoNoRegCents = pendingBank.reduce((s, l) => s + toCents(l.cargoBanco), 0);
  const depBancoNoRegCents = pendingBank.reduce((s, l) => s + toCents(l.abonoBanco), 0);
  const cargosTransitoCents = pendingBooks.reduce((s, b) => s + toCents(b.cargoContable), 0);
  const abonosTransitoCents = pendingBooks.reduce((s, b) => s + toCents(b.abonoContable), 0);

  const hasCapturedBankBalance =
    recon.summary.saldoBancoCierre !== null && recon.summary.saldoBancoCierre !== undefined;
  const saldoBancoCents = toCents(recon.summary.saldoBancoCierre ?? 0);
  const conciliadoBancoCents = saldoBancoCents + cargosTransitoCents - abonosTransitoCents;

  const saldoLibrosCents = toCents(recon.summary.saldoFinalLibros);
  const conciliadoLibrosCents = saldoLibrosCents + depBancoNoRegCents - cargosBancoNoRegCents;
  const diffCents = hasCapturedBankBalance ? conciliadoBancoCents - conciliadoLibrosCents : 0;

  return {
    recon,
    hasCapturedBankBalance,
    saldoEstadoCuenta: fromCents(saldoBancoCents),
    cargosContablesEnTransito: fromCents(cargosTransitoCents),
    abonosContablesEnTransito: fromCents(abonosTransitoCents),
    saldoConciliadoBanco: fromCents(conciliadoBancoCents),
    saldoFinalLibros: fromCents(saldoLibrosCents),
    depositosBancoNoRegistrados: fromCents(depBancoNoRegCents),
    cargosBancoNoRegistrados: fromCents(cargosBancoNoRegCents),
    saldoConciliadoLibros: fromCents(conciliadoLibrosCents),
    diferenciaCuadre: fromCents(diffCents),
    isCuadrada: hasCapturedBankBalance && diffCents === 0,
    pendingBank,
    pendingBooks
  };
}

export function buildTopCounterpartyAging(
  items: readonly CxcCxpDocumentRow[],
  limit = 10
): TopCounterpartyAgingRow[] {
  const byParty = new Map<
    string,
    {
      rfc: string;
      nombre: string;
      docsCount: number;
      origCents: number;
      paidCents: number;
      saldoCents: number;
      vencidoCents: number;
      maxDaysPast: number;
    }
  >();

  for (const item of items) {
    const key = `${(item.rfc || '').trim().toUpperCase()}::${(item.nombre || '').trim().toUpperCase()}`;
    const prev = byParty.get(key) ?? {
      rfc: item.rfc,
      nombre: item.nombre,
      docsCount: 0,
      origCents: 0,
      paidCents: 0,
      saldoCents: 0,
      vencidoCents: 0,
      maxDaysPast: 0
    };
    prev.docsCount += 1;
    prev.origCents += toCents(item.totalOriginalMxn);
    prev.paidCents += toCents(item.totalPagadoMxn);
    const saldoCents = toCents(item.saldoInsolutoMxn);
    prev.saldoCents += saldoCents;
    if (item.daysPast > 30) prev.vencidoCents += saldoCents;
    if (item.daysPast > prev.maxDaysPast) prev.maxDaysPast = item.daysPast;
    byParty.set(key, prev);
  }

  return Array.from(byParty.values())
    .sort(
      (a, b) =>
        b.vencidoCents - a.vencidoCents ||
        b.maxDaysPast - a.maxDaysPast ||
        b.saldoCents - a.saldoCents
    )
    .slice(0, limit)
    .map((r) => ({
      rfc: r.rfc,
      nombre: r.nombre,
      docsCount: r.docsCount,
      totalOriginalMxn: fromCents(r.origCents),
      totalPagadoMxn: fromCents(r.paidCents),
      saldoInsolutoMxn: fromCents(r.saldoCents),
      vencidoMas30Mxn: fromCents(r.vencidoCents),
      maxDaysPast: r.maxDaysPast
    }));
}

export function buildConciliacionBancariaSheetData(
  recons: readonly BankReconciliationResponse[],
  company: Company,
  year: number,
  period: number,
  mesLabel: string
): SheetData {
  const cutoff = formatBalanceCutoffLabel(year, period, mesLabel);
  const rows: SheetData = [
    [xStr('LIBREPAQ PRO ERP — CONCILIACIÓN BANCARIA BILATERAL Y PARTIDAS EN TRÁNSITO', true)],
    [xStr(`${company.name} | RFC: ${company.rfc} | ${cutoff}`, true)],
    [xStr('Resumen Bilateral (Banco vs. Libros) y Partidas Pendientes • Cifras en MXN')],
    []
  ];

  for (const recon of recons) {
    const s = computeDossierBankReconSummary(recon);
    rows.push(
      [xStr(`CUENTA BANCARIA: ${recon.account.code} — ${recon.account.name}`, true)],
      [
        { value: 'Sección Bilateral', fontWeight: 'bold' },
        { value: 'Concepto', fontWeight: 'bold' },
        { value: 'Importe MXN', fontWeight: 'bold', align: 'right' },
        { value: 'Estatus / Referencia', fontWeight: 'bold' },
        { value: 'Fecha', fontWeight: 'bold' },
        { value: 'Importe Detalle MXN', fontWeight: 'bold', align: 'right' }
      ],
      [xStr('Lado Banco'), xStr('Saldo Final Estado de Cuenta'), xNum(s.saldoEstadoCuenta), xStr(s.hasCapturedBankBalance ? 'Capturado' : 'Pendiente captura'), xStr(''), xStr('')],
      [xStr('Lado Banco'), xStr('(+) Depósitos en Tránsito (Cargos Libros)'), xNum(s.cargosContablesEnTransito), xStr(`${s.pendingBooks.length} movs. libros`), xStr(''), xStr('')],
      [xStr('Lado Banco'), xStr('(-) Cheques / Pagos en Tránsito (Abonos Libros)'), xNum(-s.abonosContablesEnTransito), xStr(''), xStr(''), xStr('')],
      [xStr('Lado Banco', true), xStr('(=) Saldo Conciliado según Banco', true), xNum(s.saldoConciliadoBanco, true), xStr(''), xStr(''), xStr('')],
      [xStr('Lado Libros'), xStr('Saldo Final en Libros Contables'), xNum(s.saldoFinalLibros), xStr(`${recon.summary.movimientosConciliados} conciliados`), xStr(''), xStr('')],
      [xStr('Lado Libros'), xStr('(+) Depósitos en Banco No Registrados'), xNum(s.depositosBancoNoRegistrados), xStr(`${s.pendingBank.length} movs. banco`), xStr(''), xStr('')],
      [xStr('Lado Libros'), xStr('(-) Cargos / Comisiones Banco No Registrados'), xNum(-s.cargosBancoNoRegistrados), xStr(''), xStr(''), xStr('')],
      [xStr('Lado Libros', true), xStr('(=) Saldo Conciliado según Libros', true), xNum(s.saldoConciliadoLibros, true), xStr(s.isCuadrada ? 'CUADRADA' : s.hasCapturedBankBalance ? 'CON DIFERENCIA' : 'SIN SALDO BANCO'), xStr(''), xStr('')],
      [xStr('Diferencia', true), xStr('Diferencia Bilateral (Banco - Libros)', true), xNum(s.diferenciaCuadre, true), xStr(''), xStr(''), xStr('')]
    );

    if (s.pendingBank.length > 0 || s.pendingBooks.length > 0) {
      rows.push([xStr('PARTIDAS EN TRÁNSITO / PENDIENTES', true), xStr('Concepto / Descripción', true), xStr('Cargo MXN', true), xStr('Ref. / Póliza', true), xStr('Fecha', true), xStr('Abono MXN', true)]);
      for (const l of s.pendingBank) {
        rows.push([xStr('Banco No Reg.'), xStr(l.descripcion), xNum(l.cargoBanco), xStr(l.referencia), xStr(l.fecha), xNum(l.abonoBanco)]);
      }
      for (const b of s.pendingBooks) {
        rows.push([xStr('Libros Tránsito'), xStr(b.concepto), xNum(b.cargoContable), xStr(b.polizaFolio), xStr(b.fecha), xNum(b.abonoContable)]);
      }
    }
    rows.push([]);
  }
  return rows;
}

export function buildConciliacionBancariaCsvRows(
  recons: readonly BankReconciliationResponse[]
): Array<Array<string | number>> {
  const rows: Array<Array<string | number>> = [];
  for (const recon of recons) {
    const s = computeDossierBankReconSummary(recon);
    const cta = `${recon.account.code} ${recon.account.name}`;
    rows.push(
      [cta, 'BILATERAL_BANCO', 'Saldo Final Estado de Cuenta', '', '', s.saldoEstadoCuenta, 0],
      [cta, 'BILATERAL_BANCO', '(+) Depósitos en Tránsito (Libros)', '', '', s.cargosContablesEnTransito, 0],
      [cta, 'BILATERAL_BANCO', '(-) Pagos en Tránsito (Libros)', '', '', 0, s.abonosContablesEnTransito],
      [cta, 'BILATERAL_BANCO', '(=) Saldo Conciliado Banco', '', '', s.saldoConciliadoBanco, 0],
      [cta, 'BILATERAL_LIBROS', 'Saldo Final en Libros', '', '', s.saldoFinalLibros, 0],
      [cta, 'BILATERAL_LIBROS', '(+) Depósitos Banco No Registrados', '', '', s.depositosBancoNoRegistrados, 0],
      [cta, 'BILATERAL_LIBROS', '(-) Cargos Banco No Registrados', '', '', 0, s.cargosBancoNoRegistrados],
      [cta, 'BILATERAL_LIBROS', '(=) Saldo Conciliado Libros', '', '', s.saldoConciliadoLibros, 0],
      [cta, 'DIFERENCIA', 'Diferencia Bilateral', '', '', s.diferenciaCuadre, 0]
    );
    for (const l of s.pendingBank) {
      rows.push([cta, 'TRANSITO_BANCO', l.descripcion, l.referencia, l.fecha, l.cargoBanco, l.abonoBanco]);
    }
    for (const b of s.pendingBooks) {
      rows.push([cta, 'TRANSITO_LIBROS', b.concepto, b.polizaFolio, b.fecha, b.cargoContable, b.abonoContable]);
    }
  }
  return rows;
}

export function buildAgingCxcCxpSheetData(
  aging: CxcCxpAgingResponse,
  company: Company,
  year: number,
  period: number,
  mesLabel: string
): SheetData {
  const cutoff = formatBalanceCutoffLabel(year, period, mesLabel);
  const topCxc = buildTopCounterpartyAging(aging.cxcItems, 15);
  const topCxp = buildTopCounterpartyAging(aging.cxpItems, 15);

  const rows: SheetData = [
    [xStr('LIBREPAQ PRO ERP — ANTIGÜEDAD DE SALDOS PPD (CxC / CxP) Y TOP VENCIDOS', true)],
    [xStr(`${company.name} | RFC: ${company.rfc} | ${cutoff} | Corte: ${aging.asOfDate}`, true)],
    [],
    [
      { value: 'Cartera', fontWeight: 'bold' },
      { value: '0–30 días', fontWeight: 'bold', align: 'right' },
      { value: '31–60 días', fontWeight: 'bold', align: 'right' },
      { value: '61–90 días', fontWeight: 'bold', align: 'right' },
      { value: '+90 días', fontWeight: 'bold', align: 'right' },
      { value: 'Saldo Total MXN', fontWeight: 'bold', align: 'right' }
    ],
    [xStr(`CxC Clientes (${aging.cxcItems.length} doctos)`, true), xNum(aging.cxcBuckets['0_30']), xNum(aging.cxcBuckets['31_60']), xNum(aging.cxcBuckets['61_90']), xNum(aging.cxcBuckets['90_PLUS']), xNum(aging.cxcTotal, true)],
    [xStr(`CxP Proveedores (${aging.cxpItems.length} doctos)`, true), xNum(aging.cxpBuckets['0_30']), xNum(aging.cxpBuckets['31_60']), xNum(aging.cxpBuckets['61_90']), xNum(aging.cxpBuckets['90_PLUS']), xNum(aging.cxpTotal, true)],
    [],
    [xStr('TOP CLIENTES POR SALDO / VENCIMIENTO (>30 DÍAS)', true)],
    [
      { value: 'RFC', fontWeight: 'bold' },
      { value: 'Cliente', fontWeight: 'bold' },
      { value: 'Doctos', fontWeight: 'bold', align: 'right' },
      { value: 'Máx. Días', fontWeight: 'bold', align: 'right' },
      { value: 'Vencido >30d MXN', fontWeight: 'bold', align: 'right' },
      { value: 'Saldo Total MXN', fontWeight: 'bold', align: 'right' }
    ],
    ...topCxc.map((c): SheetData[number] => [
      xStr(c.rfc), xStr(c.nombre), { type: Number, value: c.docsCount }, { type: Number, value: c.maxDaysPast }, xNum(c.vencidoMas30Mxn), xNum(c.saldoInsolutoMxn, true)
    ]),
    [],
    [xStr('TOP PROVEEDORES POR SALDO / VENCIMIENTO (>30 DÍAS)', true)],
    [
      { value: 'RFC', fontWeight: 'bold' },
      { value: 'Proveedor', fontWeight: 'bold' },
      { value: 'Doctos', fontWeight: 'bold', align: 'right' },
      { value: 'Máx. Días', fontWeight: 'bold', align: 'right' },
      { value: 'Vencido >30d MXN', fontWeight: 'bold', align: 'right' },
      { value: 'Saldo Total MXN', fontWeight: 'bold', align: 'right' }
    ],
    ...topCxp.map((p): SheetData[number] => [
      xStr(p.rfc), xStr(p.nombre), { type: Number, value: p.docsCount }, { type: Number, value: p.maxDaysPast }, xNum(p.vencidoMas30Mxn), xNum(p.saldoInsolutoMxn, true)
    ])
  ];
  return rows;
}

export function buildAgingCxcCxpCsvRows(
  aging: CxcCxpAgingResponse
): Array<Array<string | number>> {
  const topCxc = buildTopCounterpartyAging(aging.cxcItems, 20);
  const topCxp = buildTopCounterpartyAging(aging.cxpItems, 20);
  return [
    ['RESUMEN_CXC', '', `CxC Clientes (${aging.cxcItems.length})`, aging.cxcBuckets['0_30'], aging.cxcBuckets['31_60'], aging.cxcBuckets['61_90'], aging.cxcBuckets['90_PLUS'], aging.cxcTotal],
    ['RESUMEN_CXP', '', `CxP Proveedores (${aging.cxpItems.length})`, aging.cxpBuckets['0_30'], aging.cxpBuckets['31_60'], aging.cxpBuckets['61_90'], aging.cxpBuckets['90_PLUS'], aging.cxpTotal],
    ...topCxc.map((c) => ['TOP_CLIENTE_VENCIDO', c.rfc, c.nombre, c.docsCount, c.maxDaysPast, c.vencidoMas30Mxn, 0, c.saldoInsolutoMxn]),
    ...topCxp.map((p) => ['TOP_PROVEEDOR_VENCIDO', p.rfc, p.nombre, p.docsCount, p.maxDaysPast, p.vencidoMas30Mxn, 0, p.saldoInsolutoMxn])
  ];
}
