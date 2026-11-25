import writeXlsx, { type SheetData } from 'write-excel-file/browser';
import { sanitizeSpreadsheetText } from '../../shared/date-utils';
import type { FixedAssetsResponse } from '../../shared/types';

const sCell = (val: string | number | null | undefined, bold = false) => ({
  type: String as typeof String,
  value: sanitizeSpreadsheetText(String(val ?? '')),
  ...(bold ? { fontWeight: 'bold' as const } : {})
});

const nCell = (val: number, bold = false) => ({
  type: Number as typeof Number,
  value: Number(val.toFixed(2)),
  format: '$#,##0.00',
  ...(bold ? { fontWeight: 'bold' as const } : {})
});

export async function exportFixedAssetsXlsx(params: {
  companyName: string;
  companyRfc: string;
  year: number;
  period: number;
  data: FixedAssetsResponse;
}): Promise<void> {
  const { companyName, companyRfc, year, period, data } = params;
  const pLabel = `P${String(period).padStart(2, '0')}/${year}`;

  const rows: SheetData = [
    [sCell(`CÉDULA DE ACTIVOS FIJOS Y DEPRECIACIÓN (CONTABLES VS ART. 31 LISR)`, true)],
    [sCell(`${companyRfc} — ${companyName}`), sCell(`Corte: ${pLabel}`)],
    [],
    [
      sCell('Código', true), sCell('Descripción', true), sCell('Categoría', true),
      sCell('Tope Vehicular', true), sCell('Adquisición', true), sCell('MOI', true),
      sCell('Tasa %', true), sCell('Meses Dep.', true), sCell('Dep. Mensual Contable', true),
      sCell('Dep. Acumulada', true), sCell('Valor Libros', true), sCell('INPC Adq.', true),
      sCell('INPC Medio', true), sCell('Factor Act.', true), sCell('Dep. Fiscal Act.', true),
      sCell('Estatus', true), sCell('Fecha Baja', true), sCell('Precio Venta', true)
    ],
    ...data.assets.map((a) => [
      sCell(a.codigo), sCell(a.nombre), sCell(a.categoria),
      sCell(a.vehicleCapType ?? ''), sCell(a.fechaAdquisicion), nCell(a.montoOriginalInversion),
      { type: Number, value: a.tasaAnualPct }, { type: Number, value: a.mesesDepreciadosPrevios },
      nCell(a.depreciacionMensualContable), nCell(a.depreciacionAcumuladaTotal), nCell(a.valorNetoEnLibros),
      { type: Number, value: Number(a.inpcAdquisicion.toFixed(3)) },
      { type: Number, value: Number(a.inpcMedioPeriodo.toFixed(3)) },
      { type: Number, value: Number(a.factorActualizacionInpc.toFixed(4)) },
      nCell(a.depreciacionMensualFiscalActualizada), sCell(a.estatus),
      sCell(a.fechaBaja ?? ''), a.precioVenta != null ? nCell(a.precioVenta) : sCell('')
    ]),
    [
      sCell('TOTALES', true), sCell(''), sCell(''), sCell(''), sCell(''),
      nCell(data.totals.totalMoi, true), sCell(''), sCell(''),
      nCell(data.totals.totalDepreciacionMensualContable, true),
      nCell(data.totals.totalDepreciacionAcumulada, true),
      nCell(data.totals.totalValorNetoEnLibros, true),
      sCell(''), sCell(''), sCell(''),
      nCell(data.totals.totalDepreciacionMensualFiscal, true),
      sCell(''), sCell(''), sCell('')
    ]
  ];

  await writeXlsx([
    { sheet: 'Cédula Activos Fijos', data: rows }
  ]).toFile(`Cedula_Activos_Fijos_${companyRfc}_${pLabel.replace('/', '-')}.xlsx`);
}
