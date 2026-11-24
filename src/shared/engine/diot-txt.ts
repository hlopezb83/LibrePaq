export type DiotTipoTercero = '04' | '05' | '15';

export interface DiotTxtRowInput {
  rfc: string;
  nombre: string;
  tipoTercero: DiotTipoTercero;
  tipoOperacion: '03' | '06' | '85';
  actosPagados16: number;
  actosPagados8?: number;
  actosPagados0?: number;
  actosExentos?: number;
  iepsPagado?: number;
  ivaAcreditable16: number;
  ivaRetenido: number;
  idFiscal?: string;
  pais?: string;
  nacionalidad?: string;
  regionFronteriza?: 'NORTE' | 'SUR';
  ivaNoAcreditable16?: number;
  ivaNoAcreditable8?: number;
  importacionesTangibles16?: number;
  importacionesIntangibles16?: number;
  devolucionesMxn?: number;
  /** Convención SAT DIOT 2025/2026 campo 54: '01' = Sí manifiesta efectos fiscales. */
  manifestacionEfectos?: string;
}

/**
 * Construye una línea del layout batch oficial SAT DIOT 2025/2026:
 * exactamente 54 campos delimitados por `|` (53 pipes por línea, sin pipes externos).
 *
 * Mapa resumido de campos (base 1):
 *  1: Tipo Tercero ('04' Nacional | '05' Extranjero | '15' Global)
 *  2: Tipo Operación ('03' | '06' | '85')
 *  3: RFC (solo '04')
 *  4: ID Fiscal extranjero (solo '05')
 *  5: Nombre extranjero (solo '05')
 *  6: País residencia (solo '05'; campo `pais` real o 'USA' como último fallback)
 *  7: Nacionalidad (solo '05')
 *  8: Actos pagados 16% | 9: IVA no acred. 16%
 * 10-13: Frontera Norte/Sur 8% (10: FN 8%, 11: IVA no acred FN, 12: FS 8%, 13: IVA no acred FS)
 * 14-21: Importaciones de bienes tangibles (14: 16%)
 * 22-29: Importaciones de bienes intangibles y servicios (22: 16%)
 * 30: Actos pagados 0% | 31: Actos pagados exentos
 * 47: IVA acreditable pagado | 48: IVA retenido por el contribuyente
 * 49: Actos por devoluciones/descuentos | 54: Manifestación efectos fiscales ('01')
 */
export function buildDiot54BatchLine(row: DiotTxtRowInput): string {
  const cols = new Array<string>(54).fill('');
  const safeStr = (val: string | undefined) => (val || '').replace(/\|/g, ' ').trim();
  const roundAmt = (val: number | undefined) => {
    const rounded = Math.round(val || 0);
    return rounded > 0 ? String(rounded) : '';
  };

  cols[0] = row.tipoTercero;
  cols[1] = row.tipoOperacion;

  if (row.tipoTercero === '04') {
    cols[2] = safeStr(row.rfc).toUpperCase();
  } else if (row.tipoTercero === '05') {
    const idFiscal = safeStr(row.idFiscal) || (row.rfc !== 'XEXX010101000' ? safeStr(row.rfc) : '');
    cols[3] = idFiscal;
    cols[4] = safeStr(row.nombre);
    cols[5] = safeStr(row.pais).toUpperCase() || 'USA';
    cols[6] = safeStr(row.nacionalidad);
  }

  cols[7] = roundAmt(row.actosPagados16);
  cols[8] = roundAmt(row.ivaNoAcreditable16);

  if (row.regionFronteriza === 'SUR') {
    cols[11] = roundAmt(row.actosPagados8);
    cols[12] = roundAmt(row.ivaNoAcreditable8);
  } else {
    cols[9] = roundAmt(row.actosPagados8);
    cols[10] = roundAmt(row.ivaNoAcreditable8);
  }

  cols[13] = roundAmt(row.importacionesTangibles16);
  cols[21] = roundAmt(row.importacionesIntangibles16);
  cols[29] = roundAmt(row.actosPagados0);
  cols[30] = roundAmt(row.actosExentos);
  cols[46] = roundAmt(row.ivaAcreditable16 > 0 ? row.ivaAcreditable16 : 0);
  cols[47] = roundAmt(row.ivaRetenido);
  cols[48] = roundAmt(row.devolucionesMxn);
  // Campo 54: '01' indica que sí se da efectos fiscales a los comprobantes (convención DIOT 2025/2026)
  cols[53] = row.manifestacionEfectos || '01';

  return cols.join('|');
}

/** Genera el contenido TXT completo del layout DIOT SAT 2025/2026 (54 campos delimitados por `|`). */
export function generateDiotTxt(rows: readonly DiotTxtRowInput[]): string {
  return rows.map((r) => buildDiot54BatchLine(r)).join('\n');
}
