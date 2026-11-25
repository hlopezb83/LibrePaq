import { strFromU8, unzipSync } from 'fflate';
import { XMLParser } from 'fast-xml-parser';
import { fromCents, sumCents, toCents } from '../../shared/engine/invariants-and-math';
import { resolvePolizaYearPeriod } from '../../shared/date-utils';
import type { Account, PolizaType } from '../../shared/types';

export interface ParsedPolizaImportMovement {
  accountCode: string;
  accountId: string;
  accountName: string;
  referencia: string;
  concepto: string;
  cargo: number;
  abono: number;
  cfdiUuid: string | null;
  error?: string;
}

export interface ParsedPolizaImportItem {
  key: string;
  fecha: string;
  ejercicio: number;
  periodo: number;
  tipo: PolizaType;
  concepto: string;
  totalCargos: number;
  totalAbonos: number;
  isBalanced: boolean;
  isPeriodLocked: boolean;
  hasAccountError: boolean;
  canImport: boolean;
  errors: string[];
  movements: ParsedPolizaImportMovement[];
}

export interface PolizaImportPreview {
  polizas: ParsedPolizaImportItem[];
  validCount: number;
  lockedCount: number;
  unbalancedCount: number;
  accountErrorCount: number;
  globalErrors: string[];
}

function normalizeTipo(raw: string): PolizaType {
  const u = raw.trim().toUpperCase();
  if (u === '1' || u.startsWith('ING')) return 'INGRESO';
  if (u === '2' || u.startsWith('EGR')) return 'EGRESO';
  return 'DIARIO';
}

function normalizeDate(raw: string): string {
  const s = raw.trim();
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const dmy = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  return s;
}

function parseDelimitedLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i += 1; }
      else inQuotes = !inQuotes;
    } else if (ch === sep && !inQuotes) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function parseXlsxToRows(buffer: ArrayBuffer): string[][] {
  const files = unzipSync(new Uint8Array(buffer));
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const sharedStrings: string[] = [];
  const ssBytes = files['xl/sharedStrings.xml'];
  if (ssBytes) {
    const ssDoc = parser.parse(strFromU8(ssBytes)) as { sst?: { si?: unknown } };
    const siList = Array.isArray(ssDoc?.sst?.si) ? ssDoc.sst.si : ssDoc?.sst?.si ? [ssDoc.sst.si] : [];
    for (const si of siList) {
      if (typeof si === 'string') sharedStrings.push(si);
      else if (si && typeof si === 'object') {
        const rec = si as { t?: unknown; r?: Array<{ t?: unknown }> };
        if (rec.t !== undefined) sharedStrings.push(String(typeof rec.t === 'object' && rec.t !== null && '#text' in rec.t ? (rec.t as { '#text': unknown })['#text'] : rec.t));
        else if (Array.isArray(rec.r)) sharedStrings.push(rec.r.map((x) => String(x?.t ?? '')).join(''));
        else sharedStrings.push('');
      }
    }
  }
  const sheetKey = Object.keys(files).find((k) => /^xl\/worksheets\/sheet1\.xml$/i.test(k))
    || Object.keys(files).find((k) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(k));
  if (!sheetKey || !files[sheetKey]) return [];
  const wsDoc = parser.parse(strFromU8(files[sheetKey]!)) as { worksheet?: { sheetData?: { row?: unknown } } };
  const rowList = Array.isArray(wsDoc?.worksheet?.sheetData?.row)
    ? wsDoc.worksheet.sheetData.row
    : wsDoc?.worksheet?.sheetData?.row
      ? [wsDoc.worksheet.sheetData.row]
      : [];

  return rowList.map((rowObj) => {
    const cList = Array.isArray((rowObj as { c?: unknown })?.c)
      ? ((rowObj as { c: Array<Record<string, unknown>> }).c)
      : (rowObj as { c?: Record<string, unknown> })?.c
        ? [(rowObj as { c: Record<string, unknown> }).c]
        : [];
    const cells: string[] = [];
    for (const cell of cList) {
      const ref = String(cell['@_r'] || '');
      const colLetters = ref.replace(/\d+/g, '');
      let colIdx = cells.length;
      if (colLetters) {
        colIdx = 0;
        for (let i = 0; i < colLetters.length; i += 1) {
          colIdx = colIdx * 26 + (colLetters.charCodeAt(i) - 64);
        }
        colIdx -= 1;
      }
      while (cells.length < colIdx) cells.push('');
      const t = String(cell['@_t'] || '');
      let val = '';
      if (t === 's') val = sharedStrings[Number(cell.v ?? 0)] ?? '';
      else if (t === 'inlineStr') val = String((cell.is as { t?: unknown })?.t ?? '');
      else val = cell.v !== undefined ? String(cell.v) : '';
      cells[colIdx] = val.trim();
    }
    return cells;
  });
}

function parseContpaqiTxtGroups(lines: string[]) {
  const groups: Array<{
    key: string;
    fecha: string;
    tipo: PolizaType;
    concepto: string;
    rows: Array<{ code: string; ref: string; concepto: string; cargo: number; abono: number; uuid: string | null }>;
  }> = [];
  let current: (typeof groups)[number] | null = null;
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i]!;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const parts = trimmed.includes('\t') ? trimmed.split('\t').map((s) => s.trim()) : trimmed.split(/\s{2,}/).map((s) => s.trim());
    if (/^P\b/i.test(parts[0] || '')) {
      const fecha = normalizeDate(parts[1] || '');
      const tipo = normalizeTipo(parts[2] || 'DIARIO');
      const folio = parts[3] || String(groups.length + 1);
      const concepto = parts.slice(4).join(' ').trim() || `Póliza importada ${folio}`;
      current = { key: `${fecha}_${tipo}_${folio}_${i}`, fecha, tipo, concepto, rows: [] };
      groups.push(current);
    } else if (/^M\b/i.test(parts[0] || '') && current) {
      const code = (parts[1] || '').trim();
      const ref = (parts[2] || '').trim();
      const tipoMov = (parts[3] || '0').trim();
      const amount = Number(String(parts[4] || '0').replace(/[^0-9.-]/g, '')) || 0;
      const movConcepto = (parts[5] || current.concepto).trim();
      const isAbono = tipoMov === '1' || tipoMov.toUpperCase() === 'A' || tipoMov.toUpperCase() === 'ABONO';
      current.rows.push({
        code,
        ref,
        concepto: movConcepto,
        cargo: isAbono ? 0 : amount,
        abono: isAbono ? amount : 0,
        uuid: parts[6]?.trim() || null
      });
    }
  }
  return groups;
}

export function buildPolizaImportPreview(params: {
  fileName: string;
  textContent?: string;
  arrayBuffer?: ArrayBuffer;
  affectableAccounts: readonly Account[];
  lockedPeriods: ReadonlySet<string>;
}): PolizaImportPreview {
  const { fileName, textContent = '', arrayBuffer, affectableAccounts, lockedPeriods } = params;
  const lower = fileName.toLowerCase();
  const accByCode = new Map(affectableAccounts.map((a) => [a.code.trim(), a]));
  const accCompactMap = new Map(affectableAccounts.map((a) => [a.code.replace(/[^A-Z0-9]/gi, '').toUpperCase(), a]));

  const resolveAcc = (rawCode: string): Account | undefined => {
    const clean = rawCode.trim();
    return accByCode.get(clean) ?? accCompactMap.get(clean.replace(/[^A-Z0-9]/gi, '').toUpperCase());
  };

  let rawGroups: ReturnType<typeof parseContpaqiTxtGroups> = [];
  const globalErrors: string[] = [];

  let tableRows: string[][] = [];
  if (lower.endsWith('.xlsx') && arrayBuffer) {
    try {
      tableRows = parseXlsxToRows(arrayBuffer);
    } catch (e) {
      globalErrors.push(e instanceof Error ? e.message : 'No se pudo leer el archivo .xlsx');
    }
  } else {
    const cleanText = textContent.replace(/^\uFEFF/, '');
    const lines = cleanText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const looksLikeContpaqiPm = lines.some((l) => /^P(?:\t|\s{2,})/i.test(l.trim())) && lines.some((l) => /^M(?:\t|\s{2,})/i.test(l.trim()));
    if (looksLikeContpaqiPm) {
      rawGroups = parseContpaqiTxtGroups(lines);
    } else if (lines.length > 0) {
      const sep = lines[0]!.includes('\t') ? '\t' : lines[0]!.includes(';') ? ';' : ',';
      tableRows = lines.map((l) => parseDelimitedLine(l, sep));
    }
  }

  if (rawGroups.length === 0 && tableRows.length > 1) {
    const headers = tableRows[0]!.map((h) => h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
    const findCol = (pats: string[]) => headers.findIndex((h) => pats.some((p) => h.includes(p)));
    const iFecha = findCol(['fecha']);
    const iTipo = findCol(['tipo']);
    const iGrupo = findCol(['folio', 'poliza', 'grupo']);
    const iConceptoPol = findCol(['concepto poliza', 'concepto general', 'concepto']);
    const iCuenta = findCol(['cuenta', 'codigo']);
    const iRef = findCol(['ref']);
    const iConceptoMov = findCol(['concepto partida', 'descripcion', 'detalle']);
    const iCargo = findCol(['cargo', 'debe']);
    const iAbono = findCol(['abono', 'haber']);
    const iUuid = findCol(['uuid']);

    if (iFecha < 0 || iCuenta < 0 || iCargo < 0 || iAbono < 0) {
      globalErrors.push('Faltan columnas requeridas (Fecha, Cuenta, Cargo, Abono).');
    } else {
      const groupMap = new Map<string, (typeof rawGroups)[number]>();
      for (let r = 1; r < tableRows.length; r += 1) {
        const cols = tableRows[r]!;
        const fecha = normalizeDate(cols[iFecha] || '');
        const tipo = normalizeTipo(iTipo >= 0 ? (cols[iTipo] || 'DIARIO') : 'DIARIO');
        const grupo = iGrupo >= 0 ? (cols[iGrupo] || '') : '';
        const concepto = (iConceptoPol >= 0 ? cols[iConceptoPol] : '') || `Póliza importada ${fecha}`;
        const key = `${fecha}__${tipo}__${grupo || concepto}`;
        let grp = groupMap.get(key);
        if (!grp) {
          grp = { key, fecha, tipo, concepto, rows: [] };
          groupMap.set(key, grp);
        }
        const cargo = Number(String(cols[iCargo] || '0').replace(/[^0-9.-]/g, '')) || 0;
        const abono = Number(String(cols[iAbono] || '0').replace(/[^0-9.-]/g, '')) || 0;
        grp.rows.push({
          code: cols[iCuenta] || '',
          ref: iRef >= 0 ? (cols[iRef] || '') : '',
          concepto: (iConceptoMov >= 0 ? cols[iConceptoMov] : '') || concepto,
          cargo,
          abono,
          uuid: iUuid >= 0 && cols[iUuid] ? cols[iUuid]!.toUpperCase() : null
        });
      }
      rawGroups = Array.from(groupMap.values());
    }
  }

  const polizas: ParsedPolizaImportItem[] = rawGroups.map((g) => {
    const resolvedPeriod = /^\d{4}-\d{2}-\d{2}$/.test(g.fecha)
      ? resolvePolizaYearPeriod(g.fecha)
      : { ejercicio: 0, periodo: 0 };
    const isPeriodLocked =
      resolvedPeriod.ejercicio > 0 &&
      lockedPeriods.has(`${resolvedPeriod.ejercicio}:${resolvedPeriod.periodo}`);

    const movements: ParsedPolizaImportMovement[] = g.rows.map((r) => {
      const acc = resolveAcc(r.code);
      return {
        accountCode: acc?.code || r.code,
        accountId: acc?.id || '',
        accountName: acc?.name || 'Cuenta no encontrada / no afectable',
        referencia: r.ref,
        concepto: r.concepto,
        cargo: fromCents(toCents(r.cargo)),
        abono: fromCents(toCents(r.abono)),
        cfdiUuid: r.uuid,
        error: acc ? undefined : `Cuenta "${r.code}" no existe o no es afectable`
      };
    });

    const totalCargosCents = sumCents(movements.map((m) => m.cargo));
    const totalAbonosCents = sumCents(movements.map((m) => m.abono));
    const isBalanced = totalCargosCents === totalAbonosCents && totalCargosCents > 0;
    const hasAccountError = movements.some((m) => Boolean(m.error));
    const errors: string[] = [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(g.fecha)) errors.push('Fecha inválida (usa YYYY-MM-DD)');
    if (isPeriodLocked) errors.push(`Periodo ${resolvedPeriod.ejercicio}-P${String(resolvedPeriod.periodo).padStart(2, '0')} bloqueado`);
    if (!isBalanced) errors.push('No cumple partida doble (Debe ≠ Haber o en $0.00)');
    if (hasAccountError) errors.push('Contiene cuentas inválidas o no afectables');

    return {
      key: g.key,
      fecha: g.fecha,
      ejercicio: resolvedPeriod.ejercicio,
      periodo: resolvedPeriod.periodo,
      tipo: g.tipo,
      concepto: g.concepto,
      totalCargos: fromCents(totalCargosCents),
      totalAbonos: fromCents(totalAbonosCents),
      isBalanced,
      isPeriodLocked,
      hasAccountError,
      canImport: errors.length === 0,
      errors,
      movements
    };
  });

  return {
    polizas,
    validCount: polizas.filter((p) => p.canImport).length,
    lockedCount: polizas.filter((p) => p.isPeriodLocked).length,
    unbalancedCount: polizas.filter((p) => !p.isBalanced).length,
    accountErrorCount: polizas.filter((p) => p.hasAccountError).length,
    globalErrors
  };
}
