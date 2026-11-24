import type { QueryClient } from '@tanstack/react-query';
import { apiClient, invalidateAccountingQueries } from '../../lib/api-client';
import { formatCurrency, getDefaultDateForPeriod } from '../../lib/formatters';
import { buildInversePolizaDraft } from '../../shared/engine/poliza-productivity';
import type { CfdiDocument } from '../../shared/types';

export async function reverseCancelledCfdiPolizas(params: {
  companyId: string;
  currentYear: number;
  currentPeriod: number;
  isPeriodLocked: boolean;
  isReadOnlyClient: boolean;
  targetCfdis: readonly Pick<CfdiDocument, 'id' | 'uuid' | 'polizaId'>[];
  queryClient: QueryClient;
  toast: {
    success: (title: string, desc?: string) => void;
    info: (title: string, desc?: string) => void;
    error: (title: string, desc?: string) => void;
  };
}): Promise<number> {
  if (params.isReadOnlyClient) {
    throw new Error('Acceso de solo lectura: no puedes generar pólizas inversas.');
  }
  if (params.isPeriodLocked) {
    throw new Error(
      `El periodo P${String(params.currentPeriod).padStart(2, '0')}/${params.currentYear} está bloqueado ante el SAT.`
    );
  }

  const allYearPolizas = await apiClient.getPolizas(params.companyId, params.currentYear, 'ALL');
  const polizaIdsToReverse = new Set<string>();
  const uuidsToReverse = new Set<string>();

  for (const c of params.targetCfdis) {
    if (c.polizaId) polizaIdsToReverse.add(c.polizaId);
    if (c.uuid) uuidsToReverse.add(c.uuid.trim().toUpperCase());
  }

  const targetPolizas = allYearPolizas.filter(
    (p) =>
      polizaIdsToReverse.has(p.id) ||
      (p.cfdiUuid && uuidsToReverse.has(p.cfdiUuid.trim().toUpperCase())) ||
      Boolean(p.cfdiUuids?.some((u) => uuidsToReverse.has(u.trim().toUpperCase())))
  );

  if (targetPolizas.length === 0) {
    params.toast.info(
      'Sin pólizas activas por revertir',
      'No se encontró la póliza original asociada en este ejercicio.'
    );
    return 0;
  }

  const targetFecha = getDefaultDateForPeriod(params.currentYear, params.currentPeriod);
  let createdCount = 0;

  for (const pol of targetPolizas) {
    const expectedPrefix = `Reverso de ${pol.tipo} #${pol.folio}:`;
    const alreadyReversed = allYearPolizas.some((existing) =>
      existing.concepto.startsWith(expectedPrefix)
    );
    if (alreadyReversed) continue;

    const draft = buildInversePolizaDraft(pol, {
      fecha: targetFecha,
      periodo: params.currentPeriod
    });
    const created = await apiClient.createPoliza(draft);
    createdCount += 1;
    if (targetPolizas.length === 1) {
      params.toast.success(
        `Póliza Inversa ${created.tipo} #${created.folio} generada`,
        `Reversión de ${pol.tipo} #${pol.folio} por ${formatCurrency(created.totalCargos)}.`
      );
    }
  }

  if (createdCount === 0) {
    params.toast.info(
      'Pólizas ya revertidas',
      'Las pólizas de los CFDIs cancelados ya cuentan con una póliza inversa en el ejercicio.'
    );
    return 0;
  }

  if (targetPolizas.length > 1) {
    params.toast.success(
      `Se generaron ${createdCount} póliza(s) inversa(s)`,
      'La contabilidad quedó revertida sin duplicar vínculos CFDI.'
    );
  }

  invalidateAccountingQueries(params.queryClient, [
    'polizas',
    'accounts',
    'account-ledger',
    'reports',
    'dashboard',
    'cfdis',
    'fiscal-workpaper',
    'diot',
    'sat-xml'
  ]);

  return createdCount;
}
