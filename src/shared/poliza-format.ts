import type { Poliza } from './types';

function formatMoneyMxn(value: number): string {
  return value.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Formatea una póliza contable y sus movimientos en texto tabular legible para copiar al portapapeles.
 */
export function formatPolizaAsientoText(pol: Poliza): string {
  const periodLabel = String(pol.periodo).padStart(2, '0');
  const header = [
    `PÓLIZA DE ${pol.tipo} #${pol.folio} | ${pol.fecha} | ${pol.ejercicio}-P${periodLabel}`,
    `Concepto: ${pol.concepto}`,
    '----------------------------------------------------------------'
  ];

  const lines = pol.movements.map((mov, idx) => {
    const num = String(idx + 1).padStart(2, ' ');
    const acc = `${mov.accountCode} ${mov.accountName}`.trim();
    const cargo = formatMoneyMxn(mov.cargo);
    const abono = formatMoneyMxn(mov.abono);
    const ref = mov.referencia ? ` [Ref: ${mov.referencia}]` : '';
    return `${num}. ${acc}${ref} | Cargo: $${cargo} | Abono: $${abono}`;
  });

  const footer = [
    '----------------------------------------------------------------',
    `Totales | Cargos: $${formatMoneyMxn(pol.totalCargos)} | Abonos: $${formatMoneyMxn(pol.totalAbonos)}`
  ];

  return [...header, ...lines, ...footer].join('\n');
}
