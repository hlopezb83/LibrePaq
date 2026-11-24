import type { Account, AccountWithBalance, CfdiDocument } from '../types';
import type {
  IsnStateRate,
  PayrollAmarreStatus,
  PayrollPeriodSummary,
  SuaAndIsnInputs,
  SuaAndIsnMovement,
  SuaAndIsnProvisionResult
} from '../types/payroll-summary.types';
import { extractNominaOtrosPagos } from '../cfdi-xml';
import { parseCalendarDate } from '../date-utils';
import { resolveFiscalAccount } from './auto-poliza-account-resolver';
import {
  assertAccountingInvariant,
  fromCents,
  toCents,
  validateDoubleEntryMovements
} from './invariants-and-math';

export const MEXICO_ISN_RATES: readonly IsnStateRate[] = [
  { code: 'AGS', name: 'Aguascalientes', ratePct: 2.5 }, { code: 'BCN', name: 'Baja California', ratePct: 4.25, notes: '1.80% + sobretasa' },
  { code: 'BCS', name: 'Baja California Sur', ratePct: 2.5 }, { code: 'CAM', name: 'Campeche', ratePct: 3.0 },
  { code: 'CHP', name: 'Chiapas', ratePct: 2.0 }, { code: 'CHH', name: 'Chihuahua', ratePct: 4.0, notes: 'Incluye contribución extra' },
  { code: 'CMX', name: 'Ciudad de México', ratePct: 4.0, notes: 'Tasa vigente 4.0% CDMX' }, { code: 'COA', name: 'Coahuila de Zaragoza', ratePct: 3.0 },
  { code: 'COL', name: 'Colima', ratePct: 2.0 }, { code: 'DUR', name: 'Durango', ratePct: 3.0 },
  { code: 'GUA', name: 'Guanajuato', ratePct: 3.0 }, { code: 'GRO', name: 'Guerrero', ratePct: 2.0 },
  { code: 'HID', name: 'Hidalgo', ratePct: 3.0 }, { code: 'JAL', name: 'Jalisco', ratePct: 3.0 },
  { code: 'MEX', name: 'Estado de México', ratePct: 3.0 }, { code: 'MIC', name: 'Michoacán de Ocampo', ratePct: 3.0 },
  { code: 'MOR', name: 'Morelos', ratePct: 2.0 }, { code: 'NAY', name: 'Nayarit', ratePct: 3.0 },
  { code: 'NLE', name: 'Nuevo León', ratePct: 3.0 }, { code: 'OAX', name: 'Oaxaca', ratePct: 3.0 },
  { code: 'PUE', name: 'Puebla', ratePct: 3.0 }, { code: 'QUE', name: 'Querétaro', ratePct: 3.0 },
  { code: 'ROO', name: 'Quintana Roo', ratePct: 4.0 }, { code: 'SLP', name: 'San Luis Potosí', ratePct: 3.0 },
  { code: 'SIN', name: 'Sinaloa', ratePct: 3.0 }, { code: 'SON', name: 'Sonora', ratePct: 3.0 },
  { code: 'TAB', name: 'Tabasco', ratePct: 3.0 }, { code: 'TAM', name: 'Tamaulipas', ratePct: 3.0 },
  { code: 'TLA', name: 'Tlaxcala', ratePct: 3.0 }, { code: 'VER', name: 'Veracruz', ratePct: 3.0 },
  { code: 'YUC', name: 'Yucatán', ratePct: 3.0 }, { code: 'ZAC', name: 'Zacatecas', ratePct: 3.5 }
];

function extractAttrNumber(xmlRaw: string, attrName: string): number | null {
  if (!xmlRaw || !xmlRaw.includes(attrName)) return null;
  const match = new RegExp(`${attrName}=["']([0-9]+(?:\\.[0-9]+)?)["']`, 'i').exec(xmlRaw);
  if (!match?.[1]) return null;
  const val = Number.parseFloat(match[1]);
  return Number.isFinite(val) ? val : null;
}

function extractImssObreroFromXml(xmlRaw: string): number | null {
  if (!xmlRaw || !xmlRaw.includes('TipoDeduccion')) return null;
  const tagRe = /<(?:[a-z0-9_]+:)?Deduccion\b([^>]*)\/?>/gi;
  let totalCents = 0;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(xmlRaw)) !== null) {
    const attrs = match[1] ?? '';
    if (!/TipoDeduccion=["']001["']/i.test(attrs)) continue;
    const impMatch = /Importe=["']([0-9]+(?:\.[0-9]+)?)["']/i.exec(attrs);
    if (impMatch?.[1]) {
      totalCents += toCents(Number.parseFloat(impMatch[1]));
    }
  }
  return fromCents(totalCents);
}

function extractSubsidioEmpleo(xmlRaw: string): number {
  if (!xmlRaw) return 0;
  if (/<(?:[a-z0-9_]+:)?Otros?Pagos?\b/i.test(xmlRaw)) {
    const otroPagoRe = /<(?:[a-z0-9_]+:)?OtroPago\b([^>]*)\/?>/gi;
    let totalCents = 0;
    let match: RegExpExecArray | null;
    while ((match = otroPagoRe.exec(xmlRaw)) !== null) {
      const attrs = match[1] ?? '';
      if (!/TipoOtroPago=["']002["']/i.test(attrs)) continue;
      const impMatch = /Importe=["']([0-9]+(?:\.[0-9]+)?)["']/i.exec(attrs);
      if (impMatch?.[1]) totalCents += toCents(Number.parseFloat(impMatch[1]));
    }
    return fromCents(totalCents);
  }
  const otrosPagos = extractNominaOtrosPagos(xmlRaw);
  return otrosPagos > 0 ? otrosPagos : 0;
}

export function computePayrollPeriodSummary(params: {
  cfdis: readonly CfdiDocument[];
  trialBalance: readonly AccountWithBalance[];
  ejercicio: number;
  periodo: number;
}): PayrollPeriodSummary {
  const { cfdis, trialBalance, ejercicio, periodo } = params;
  const nominaCfdis = cfdis.filter((c) => {
    const effectiveDate = c.fechaPago || c.fecha;
    if (c.statusSat !== 'VIGENTE' || c.tipoComprobante !== 'N' || c.direction !== 'EMITIDO' || !effectiveDate) {
      return false;
    }
    const { year, month } = parseCalendarDate(effectiveDate, 0, 0);
    return year === ejercicio && month === periodo;
  });

  let percepcionesCents = 0;
  let subsidioCents = 0;
  let isrCfdisCents = 0;
  let imssObreroCents = 0;
  let netoCents = 0;

  for (const cfdi of nominaCfdis) {
    const rate = cfdi.moneda && cfdi.moneda.toUpperCase() !== 'MXN' && cfdi.tipoCambio > 0 ? cfdi.tipoCambio : 1;
    const subsidio = extractSubsidioEmpleo(cfdi.xmlRaw);
    const xmlPercepciones = extractAttrNumber(cfdi.xmlRaw, 'TotalPercepciones');
    const percepciones =
      xmlPercepciones !== null ? xmlPercepciones : Math.max(0, fromCents(toCents(cfdi.subtotal) - toCents(subsidio)));
    const isrRet =
      cfdi.isrRetenido > 0 ? cfdi.isrRetenido : (extractAttrNumber(cfdi.xmlRaw, 'TotalImpuestosRetenidos') ?? 0);
    const imssObrero = extractImssObreroFromXml(cfdi.xmlRaw) ?? 0;

    percepcionesCents += Math.round(toCents(percepciones) * rate);
    subsidioCents += Math.round(toCents(subsidio) * rate);
    isrCfdisCents += Math.round(toCents(isrRet) * rate);
    imssObreroCents += Math.round(toCents(imssObrero) * rate);
    netoCents += Math.round(toCents(cfdi.total) * rate);
  }

  const satPayrollIsrAccounts = trialBalance.filter(
    (a) =>
      a.isAffectable &&
      ((a.satGroupCode ?? '').startsWith('216.01') || (a.satGroupCode ?? '').startsWith('216.02'))
  );
  const payrollIsrAccounts =
    satPayrollIsrAccounts.length > 0
      ? satPayrollIsrAccounts
      : trialBalance.filter((a) => a.isAffectable && a.code === '216-01-001');

  let librosCents = 0;
  for (const acc of payrollIsrAccounts) {
    const creditsCents = toCents(acc.periodCredits);
    const chargesCents = toCents(acc.periodCharges);
    const initCents = toCents(acc.initialBalanceComputed);
    const finalCents = toCents(acc.finalBalance);
    librosCents +=
      creditsCents > 0 || chargesCents > 0 || initCents !== 0 ? creditsCents : Math.max(0, finalCents);
  }
  const diffCents = isrCfdisCents - librosCents;
  const amarreStatus: PayrollAmarreStatus =
    nominaCfdis.length === 0 && librosCents === 0 ? 'SIN_NOMINA' : diffCents === 0 ? 'CUADRADO' : 'DIFERENCIA';

  return {
    ejercicio,
    periodo,
    nominaCount: nominaCfdis.length,
    totalPercepciones: fromCents(percepcionesCents),
    totalSubsidioEmpleo: fromCents(subsidioCents),
    isrRetenidoCfdis: fromCents(isrCfdisCents),
    imssObreroEstimado: fromCents(imssObreroCents),
    totalNetoPagado: fromCents(netoCents),
    isrRetenidoLibros: fromCents(librosCents),
    diferenciaIsrAmarre: fromCents(diffCents),
    amarreStatus,
    cuentaIsrCode: payrollIsrAccounts[0]?.code ?? '216-01-001'
  };
}

function resolvePayrollAccount(
  accounts: readonly Account[],
  preferredCodes: readonly string[],
  nameHints: readonly string[],
  targetType: Account['type'],
  fallbackRole: 'SUELDOS_Y_SALARIOS' | 'OTRAS_CUENTAS_POR_PAGAR'
): Account {
  const affectable = accounts.filter((a) => a.isAffectable);
  for (const code of preferredCodes) {
    const exact = affectable.find((a) => a.code === code);
    if (exact) return exact;
  }
  const byHint = affectable.find(
    (a) => a.type === targetType && nameHints.some((hint) => a.name.toLowerCase().includes(hint))
  );
  return byHint ?? resolveFiscalAccount(accounts, fallbackRole);
}

export function computeSuaAndIsnProvision(
  inputs: SuaAndIsnInputs,
  accounts: readonly Account[]
): SuaAndIsnProvisionResult {
  assertAccountingInvariant(accounts.length > 0, 'EMPTY_CATALOG', 'El catálogo de cuentas está vacío.');
  const stateEntry = MEXICO_ISN_RATES.find((s) => s.code === inputs.stateCode.toUpperCase());
  assertAccountingInvariant(
    stateEntry !== undefined || inputs.tasaIsnPct !== undefined,
    'INVALID_ISN_STATE',
    `Estado ISN no reconocido: ${inputs.stateCode}`
  );

  const tasaIsnPct = Math.max(0, inputs.tasaIsnPct ?? stateEntry?.ratePct ?? 0);
  const baseCents = Math.max(0, toCents(inputs.baseGravableNomina));
  const isnCents = Math.round((baseCents * tasaIsnPct) / 100);
  const imssCents = Math.max(0, toCents(inputs.imssPatronal));
  const rcvCents = Math.max(0, toCents(inputs.rcv));
  const infonavitCents = Math.max(0, toCents(inputs.infonavit));
  const totalSuaCents = imssCents + rcvCents + infonavitCents;
  const totalProvisionCents = totalSuaCents + isnCents;

  assertAccountingInvariant(
    totalProvisionCents > 0,
    'ZERO_SUA_ISN_PROVISION',
    'Captura al menos un importe patronal (IMSS, RCV, INFONAVIT) o base gravable de ISN mayor a $0.00.'
  );

  const accGastoSua = resolvePayrollAccount(
    accounts, ['601-01-007', '601-01-008', '601-02-001', '601-26-001'], ['cuota', 'imss', 'infonavit', 'sar', 'rcv'], 'GASTOS', 'SUELDOS_Y_SALARIOS'
  );
  const accGastoIsn = resolvePayrollAccount(
    accounts, ['601-01-011', '601-02-002', '601-58-001'], ['nomina', 'nómina', 'sobre nomina', 'sobre nómina', 'isn', 'estatal'], 'GASTOS', 'SUELDOS_Y_SALARIOS'
  );
  const accPasivoSua = resolvePayrollAccount(
    accounts, ['211-01-002', '211-01-001', '211-02-001'], ['imss', 'infonavit', 'cuotas'], 'PASIVO', 'OTRAS_CUENTAS_POR_PAGAR'
  );
  const accPasivoIsn = resolvePayrollAccount(
    accounts, ['213-01-004', '213-01-003', '213-02-001', '211-01-003'], ['isn', 'impuesto sobre nómina', 'impuesto sobre nomina', 'impuestos estatales'], 'PASIVO', 'OTRAS_CUENTAS_POR_PAGAR'
  );

  const ref = inputs.referencia?.trim() || `SUA-ISN-${inputs.ejercicio}-${String(inputs.periodo).padStart(2, '0')}`;
  const stateCode = stateEntry?.code ?? inputs.stateCode.toUpperCase();
  const stateName = stateEntry?.name ?? stateCode;
  const movements: SuaAndIsnMovement[] = [];
  const pushMov = (acc: Account, cargoCents: number, abonoCents: number, concepto: string) => {
    movements.push({
      accountId: acc.id, accountCode: acc.code, accountName: acc.name,
      referencia: ref, concepto, cargo: fromCents(cargoCents), abono: fromCents(abonoCents)
    });
  };

  if (imssCents > 0) pushMov(accGastoSua, imssCents, 0, `Cuotas Patronales IMSS ${inputs.periodo}/${inputs.ejercicio}`);
  if (rcvCents > 0) pushMov(accGastoSua, rcvCents, 0, `Cuotas Patronales RCV (Retiro/Cesantía) ${inputs.periodo}/${inputs.ejercicio}`);
  if (infonavitCents > 0) pushMov(accGastoSua, infonavitCents, 0, `Aportación Patronal INFONAVIT 5% ${inputs.periodo}/${inputs.ejercicio}`);
  if (isnCents > 0) pushMov(accGastoIsn, isnCents, 0, `ISN Estatal ${stateName} (${tasaIsnPct}%) ${inputs.periodo}/${inputs.ejercicio}`);
  if (totalSuaCents > 0) pushMov(accPasivoSua, 0, totalSuaCents, `Provisión SUA por pagar (IMSS/RCV/INFONAVIT) ${inputs.periodo}/${inputs.ejercicio}`);
  if (isnCents > 0) pushMov(accPasivoIsn, 0, isnCents, `Provisión ISN Estatal por pagar (${stateCode}) ${inputs.periodo}/${inputs.ejercicio}`);

  const { totalCargo, totalAbono } = validateDoubleEntryMovements(movements, new Map(accounts.map((a) => [a.id, a])));
  return {
    stateCode, stateName, tasaIsnPct,
    baseGravableNomina: fromCents(baseCents), isnEstatal: fromCents(isnCents),
    imssPatronal: fromCents(imssCents), rcv: fromCents(rcvCents), infonavit: fromCents(infonavitCents),
    totalSuaPatronal: fromCents(totalSuaCents), totalProvision: fromCents(totalProvisionCents),
    totalCargos: totalCargo, totalAbonos: totalAbono,
    isBalanced: toCents(totalCargo) === toCents(totalAbono),
    polizaTipo: 'DIARIO',
    polizaConcept: inputs.concepto?.trim() || `Provisión mensual SUA e ISN ${stateName} (${String(inputs.periodo).padStart(2, '0')}/${inputs.ejercicio})`,
    polizaMovements: movements
  };
}
