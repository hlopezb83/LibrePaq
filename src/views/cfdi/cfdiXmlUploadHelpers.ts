import type { ToastContextType } from '../../context/ToastContext';
import { downloadBlobFile } from '../../lib/formatters';
import { buildAutoPolizaPlan } from '../../shared/accounting-engine';
import { SAFETY_BOUNDS } from '../../shared/sat-catalog';
import type { AccountWithBalance, CfdiDocument } from '../../shared/types';

/** Extracts valid XML payloads from dropped/selected XML or ZIP files within safety bounds. */
export async function extractXmlStringsFromFiles(
  fileList: FileList | File[],
  toast: Pick<ToastContextType, 'error'>
): Promise<string[]> {
  const rawFiles = Array.from(fileList);
  const xmlList: string[] = [];

  for (const file of rawFiles) {
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.xml') || file.type.includes('xml')) {
      xmlList.push(await file.text());
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
            if (xmlList.length >= SAFETY_BOUNDS.MAX_BATCH_CFDI) break;
          }
        }
      } catch {
        toast.error(`No fue posible leer el archivo ZIP: ${file.name}`);
      }
    }
  }

  return xmlList.slice(0, SAFETY_BOUNDS.MAX_BATCH_CFDI);
}

/** Triggers browser download of a CFDI XML file. */
export function downloadCfdiXmlFile(cfdi: Pick<CfdiDocument, 'xmlRaw' | 'serie' | 'folio' | 'uuid'>): void {
  downloadBlobFile(
    `CFDI_${cfdi.serie}_${cfdi.folio}_${cfdi.uuid.slice(0, 8)}.xml`,
    cfdi.xmlRaw,
    'application/xml;charset=utf-8'
  );
}

/** Suggests initial operation & counter accounts when opening the contabilizar modal. */
export function resolveDefaultAccountsForCfdi(
  cfdi: CfdiDocument,
  accounts: AccountWithBalance[]
): { operationAccountCode: string; counterAccountCode: string } {
  const plan = buildAutoPolizaPlan(cfdi, accounts);
  const opMov = plan.movements[0];
  const counterMov = plan.movements[plan.movements.length - 1];
  const fallbackOperation =
    cfdi.tipoComprobante === 'P'
      ? cfdi.direction === 'EMITIDO'
        ? '105-01-002'
        : '201-01-099'
      : cfdi.direction === 'EMITIDO'
        ? '401-01-002'
        : '601-01-003';
  const fallbackCounter =
    cfdi.metodoPago === 'PUE' || cfdi.tipoComprobante === 'P'
      ? '102-01-001'
      : cfdi.direction === 'EMITIDO'
        ? '105-01-002'
        : '201-01-099';
  return {
    operationAccountCode: opMov?.accountCode ?? fallbackOperation,
    counterAccountCode: counterMov?.accountCode ?? fallbackCounter
  };
}
