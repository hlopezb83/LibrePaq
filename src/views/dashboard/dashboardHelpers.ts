import { checkRfc69BStatus } from '../../shared/sat-69b';
import type { CfdiDocument, ThirdPartyRecord } from '../../shared/types';

const LEDGER_CODE_REGEX = /(?:^|_)(\d{3}-\d{2}-\d{3}|\d{3}-\d{2}|\d{3})(?:$|\b)/;

/**
 * Extrae el código contable SAT desde un ID compuesto (ej. `comp_123_400-00-000` o `105-01-001`)
 * y resuelve el ID real de la cuenta buscando primero coincidencia exacta antes del fallback por prefijo.
 */
export function resolveLedgerAccountId(
  codeOrId: string,
  accounts: ReadonlyArray<{ id: string; code: string }>
): string {
  const codeMatch = codeOrId.match(LEDGER_CODE_REGEX);
  if (codeMatch && codeMatch[1]) {
    const targetCode = codeMatch[1];
    const exactMatch = accounts.find((a) => a.code === targetCode);
    if (exactMatch) return exactMatch.id;

    const prefixMatch =
      accounts.find((a) => a.code.startsWith(targetCode)) ||
      accounts.find((a) => a.code.startsWith(targetCode.slice(0, 3)));
    if (prefixMatch) return prefixMatch.id;
  }
  return codeOrId;
}

export interface EfosDashboardSummary {
  efosCount: number;
  definitivosCount: number;
  presuntosCount: number;
  totalThirdParties: number;
}

/**
 * Resume el estatus Art. 69-B CFF combinando el padrón de terceros de la empresa
 * y los CFDIs pendientes del periodo sin requerir cambios en el backend.
 */
export function computeEfosDashboardSummary(
  thirdParties: ReadonlyArray<ThirdPartyRecord>,
  pendingCfdis: ReadonlyArray<CfdiDocument>
): EfosDashboardSummary {
  const flaggedRfcs = new Map<string, 'DEFINITIVO_EFOS' | 'PRESUNTO_EFOS'>();

  for (const tp of thirdParties) {
    const normalizedRfc = (tp.rfc || '').trim().toUpperCase();
    if (!normalizedRfc) continue;
    if (tp.estatus69B === 'DEFINITIVO_EFOS' || tp.estatus69B === 'PRESUNTO_EFOS') {
      flaggedRfcs.set(normalizedRfc, tp.estatus69B);
      continue;
    }
    const localCheck = checkRfc69BStatus(normalizedRfc);
    if (localCheck.isEfos && (localCheck.status === 'DEFINITIVO_EFOS' || localCheck.status === 'PRESUNTO_EFOS')) {
      flaggedRfcs.set(normalizedRfc, localCheck.status);
    }
  }

  for (const cfdi of pendingCfdis) {
    const targetRfc = (cfdi.direction === 'EMITIDO' ? cfdi.receptorRfc : cfdi.emisorRfc || '')
      .trim()
      .toUpperCase();
    if (!targetRfc || flaggedRfcs.has(targetRfc)) continue;
    const localCheck = checkRfc69BStatus(targetRfc);
    if (localCheck.isEfos && (localCheck.status === 'DEFINITIVO_EFOS' || localCheck.status === 'PRESUNTO_EFOS')) {
      flaggedRfcs.set(targetRfc, localCheck.status);
    }
  }

  let definitivosCount = 0;
  let presuntosCount = 0;
  for (const status of flaggedRfcs.values()) {
    if (status === 'DEFINITIVO_EFOS') definitivosCount++;
    else presuntosCount++;
  }

  return {
    efosCount: flaggedRfcs.size,
    definitivosCount,
    presuntosCount,
    totalThirdParties: thirdParties.length
  };
}
