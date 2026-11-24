import type { ToastContextType } from '../../context/ToastContext';
import { apiClient } from '../../lib/api-client';
import { downloadBlobFile } from '../../lib/formatters';
import {
  buildAutoPolizaPlan,
  inferExpenseAccountForCfdi,
  resolveFiscalAccount
} from '../../shared/accounting-engine';
import { chunkArray } from '../../shared/array-utils';
import { SAFETY_BOUNDS } from '../../shared/sat-constants';
import type { AccountWithBalance, CfdiDocument } from '../../shared/types';

export interface UploadBatchProgress {
  currentBatch: number;
  totalBatches: number;
  processed: number;
  total: number;
}

/** Sube >250 XMLs en lotes secuenciales de 200 notificando al usuario para no truncar cargas masivas. */
export async function uploadXmlsInSequentialBatches(params: {
  companyId: string;
  xmls: string[];
  toast: Pick<ToastContextType, 'info' | 'success'>;
  onProgress: (progress: UploadBatchProgress | null) => void;
}): Promise<{ uploadedCount: number; skippedDuplicates: number }> {
  const { companyId, xmls, toast, onProgress } = params;
  if (xmls.length <= SAFETY_BOUNDS.MAX_BATCH_CFDI) {
    const res = await apiClient.batchUploadCfdiXmls(companyId, xmls);
    return { uploadedCount: res.uploaded.length, skippedDuplicates: res.skippedDuplicates };
  }

  const batches = chunkArray(xmls, 200);
  toast.info(
    `Se detectaron ${xmls.length} archivos XML (>250). Se procesarán en ${batches.length} lotes secuenciales de 200.`
  );
  let uploadedCount = 0;
  let skippedDuplicates = 0;
  let processed = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]!;
    onProgress({
      currentBatch: i + 1,
      totalBatches: batches.length,
      processed,
      total: xmls.length
    });
    const res = await apiClient.batchUploadCfdiXmls(companyId, batch);
    uploadedCount += res.uploaded.length;
    skippedDuplicates += res.skippedDuplicates;
    processed += batch.length;
    onProgress({
      currentBatch: i + 1,
      totalBatches: batches.length,
      processed,
      total: xmls.length
    });
  }
  onProgress(null);
  return { uploadedCount, skippedDuplicates };
}

/** Extracts valid XML payloads from dropped/selected XML or ZIP files within safety bounds (no 250 cap). */
export async function extractXmlStringsFromFiles(
  fileList: FileList | File[],
  toast: Pick<ToastContextType, 'error'>
): Promise<string[]> {
  const rawFiles = Array.from(fileList);
  const xmlList: string[] = [];

  for (const file of rawFiles) {
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.xml') || file.type.includes('xml')) {
      if (file.size <= SAFETY_BOUNDS.MAX_XML_BYTES) {
        xmlList.push(await file.text());
      } else {
        toast.error(`El XML ${file.name} excede el límite de 5MB.`);
      }
    } else if (lower.endsWith('.zip') || file.type.includes('zip')) {
      try {
        if (file.size > SAFETY_BOUNDS.MAX_ZIP_UNCOMPRESSED_BYTES) {
          toast.error(`El archivo ZIP ${file.name} excede el límite de 50MB.`);
          continue;
        }
        const buffer = new Uint8Array(await file.arrayBuffer());
        const { unzipSync, strFromU8 } = await import('fflate');
        const unzipped = unzipSync(buffer, {
          filter(fileInfo) {
            return fileInfo.originalSize <= SAFETY_BOUNDS.MAX_XML_BYTES;
          }
        });
        for (const [name, content] of Object.entries(unzipped)) {
          if (name.toLowerCase().endsWith('.xml')) {
            xmlList.push(strFromU8(content));
          }
        }
      } catch {
        toast.error(`No fue posible leer el archivo ZIP: ${file.name}`);
      }
    }
  }

  return xmlList;
}

/** Triggers browser download of a CFDI XML file, fetching xmlRaw from vault when omitted. */
export async function downloadCfdiXmlFile(
  cfdi: Pick<CfdiDocument, 'id' | 'xmlRaw' | 'serie' | 'folio' | 'uuid'>,
  toast?: Pick<ToastContextType, 'error'>
): Promise<void> {
  try {
    const rawXml = cfdi.xmlRaw || (await apiClient.getCfdiXml(cfdi.id));
    if (!rawXml) {
      toast?.error('El archivo XML no está disponible en la bóveda SAT.');
      return;
    }
    downloadBlobFile(
      `CFDI_${cfdi.serie}_${cfdi.folio}_${cfdi.uuid.slice(0, 8)}.xml`,
      rawXml,
      'application/xml;charset=utf-8'
    );
  } catch (err: unknown) {
    toast?.error(`Error al descargar XML: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Computes next selected ID set supporting Shift+Click range selection. */
export function computeNextCfdiSelection(
  prev: Set<string>,
  filteredCfdis: readonly CfdiDocument[],
  id: string,
  lastSelectedId: string | null,
  shiftKey: boolean
): Set<string> {
  const next = new Set(prev);
  const shouldSelect = !prev.has(id);
  if (shiftKey && lastSelectedId) {
    const startIdx = filteredCfdis.findIndex((c) => c.id === lastSelectedId);
    const endIdx = filteredCfdis.findIndex((c) => c.id === id);
    if (startIdx !== -1 && endIdx !== -1) {
      const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
      for (let i = from; i <= to; i++) {
        const doc = filteredCfdis[i];
        if (!doc) continue;
        if (shouldSelect) next.add(doc.id);
        else next.delete(doc.id);
      }
      return next;
    }
  }
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** Builds preview poliza movements for the contabilizar modal. */
export function buildContabilizarPreviewMovements(
  cfdi: CfdiDocument | null,
  affectableAccounts: AccountWithBalance[],
  operationAccountCode: string,
  counterAccountCode: string
) {
  if (!cfdi || affectableAccounts.length === 0) return [];
  try {
    const plan = buildAutoPolizaPlan(cfdi, affectableAccounts, {
      operationAccountCode: operationAccountCode || undefined,
      counterAccountCode: counterAccountCode || undefined
    });
    return plan.movements.map((m) => ({
      code: m.accountCode,
      name: m.accountName,
      concepto: m.concepto,
      cargo: m.cargo,
      abono: m.abono
    }));
  } catch {
    return [];
  }
}

const TAX_OR_ADJUST_PREFIXES = [
  '113-',
  '118-',
  '119-',
  '208-',
  '209-',
  '211-',
  '213-',
  '216-',
  '701-',
  '702-',
  '801-'
];

function findMovementByPrefixes(
  movements: ReadonlyArray<{ accountCode: string }>,
  prefixes: readonly string[]
): string | undefined {
  for (const prefix of prefixes) {
    const found = movements.find((m) => m.accountCode.startsWith(prefix));
    if (found) return found.accountCode;
  }
  return undefined;
}

/** Suggests initial operation & counter accounts when opening the contabilizar modal. */
export function resolveDefaultAccountsForCfdi(
  cfdi: CfdiDocument,
  accounts: AccountWithBalance[]
): { operationAccountCode: string; counterAccountCode: string } {
  if (accounts.length === 0) {
    return { operationAccountCode: '', counterAccountCode: '' };
  }
  try {
    const plan = buildAutoPolizaPlan(cfdi, accounts);
    const nonTaxMovements = plan.movements.filter(
      (m) => !TAX_OR_ADJUST_PREFIXES.some((p) => m.accountCode.startsWith(p))
    );
    const esEmitido = cfdi.direction === 'EMITIDO';
    const esPue = cfdi.metodoPago === 'PUE';

    if (cfdi.tipoComprobante === 'P') {
      const opCode =
        findMovementByPrefixes(nonTaxMovements, esEmitido ? ['105-'] : ['201-']) ??
        resolveFiscalAccount(
          accounts,
          esEmitido ? 'CLIENTES_NACIONALES' : 'PROVEEDORES_NACIONALES'
        ).code;
      const counterCode =
        findMovementByPrefixes(nonTaxMovements, ['102-', '101-']) ??
        resolveFiscalAccount(accounts, 'BANCO_PRINCIPAL').code;
      return { operationAccountCode: opCode, counterAccountCode: counterCode };
    }

    if (cfdi.tipoComprobante === 'N') {
      const opCode =
        findMovementByPrefixes(nonTaxMovements, ['601-', '501-']) ??
        resolveFiscalAccount(accounts, 'SUELDOS_Y_SALARIOS').code;
      const counterCode =
        findMovementByPrefixes(nonTaxMovements, ['102-', '101-', '107-']) ??
        resolveFiscalAccount(accounts, 'BANCO_SECUNDARIO').code;
      return { operationAccountCode: opCode, counterAccountCode: counterCode };
    }

    if (cfdi.tipoComprobante === 'E') {
      if (esEmitido) {
        const opCode =
          findMovementByPrefixes(nonTaxMovements, ['402-', '401-']) ??
          resolveFiscalAccount(accounts, 'DEVOLUCIONES_DESCUENTOS').code;
        const counterCode =
          findMovementByPrefixes(nonTaxMovements, ['105-', '102-', '101-']) ??
          resolveFiscalAccount(accounts, 'CLIENTES_NACIONALES').code;
        return { operationAccountCode: opCode, counterAccountCode: counterCode };
      }
      const opCode =
        findMovementByPrefixes(nonTaxMovements, ['601-', '501-', '115-']) ??
        inferExpenseAccountForCfdi(cfdi, accounts).code;
      const counterCode =
        findMovementByPrefixes(nonTaxMovements, ['201-', '205-', '102-', '101-']) ??
        resolveFiscalAccount(accounts, 'PROVEEDORES_NACIONALES').code;
      return { operationAccountCode: opCode, counterAccountCode: counterCode };
    }

    if (esEmitido) {
      const opCode =
        findMovementByPrefixes(nonTaxMovements, ['401-', '402-', '403-']) ??
        resolveFiscalAccount(accounts, 'INGRESOS_TASA_16').code;
      const counterCode =
        findMovementByPrefixes(
          nonTaxMovements,
          esPue ? ['102-', '101-'] : ['105-']
        ) ??
        resolveFiscalAccount(
          accounts,
          esPue ? 'BANCO_PRINCIPAL' : 'CLIENTES_NACIONALES'
        ).code;
      return { operationAccountCode: opCode, counterAccountCode: counterCode };
    }

    const opCode =
      findMovementByPrefixes(nonTaxMovements, ['601-', '501-', '15', '115-']) ??
      inferExpenseAccountForCfdi(cfdi, accounts).code;
    const counterCode =
      findMovementByPrefixes(
        nonTaxMovements,
        esPue ? ['102-', '101-'] : ['201-', '205-']
      ) ??
      resolveFiscalAccount(
        accounts,
        esPue ? 'BANCO_PRINCIPAL' : 'PROVEEDORES_NACIONALES'
      ).code;
    return { operationAccountCode: opCode, counterAccountCode: counterCode };
  } catch {
    return { operationAccountCode: '', counterAccountCode: '' };
  }
}
