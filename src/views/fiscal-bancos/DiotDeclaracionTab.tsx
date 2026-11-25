import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Copy, Download, FileSpreadsheet, ShieldAlert, ShieldCheck, Upload } from 'lucide-react';
import { Button, EmptyState, KpiCard, StatusBadge } from '../../components/ui';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import { formatCurrency } from '../../lib/formatters';
import { checkRfcsAgainstCloud69B } from '../../lib/supabase/supabase-cxc-sat';
import { checkRfc69BStatus, getLoaded69BDatabase, getLoaded69BMeta } from '../../shared/sat-69b';
import { MESES_SAT } from '../../shared/sat-constants';
import { validateDiotBatchLines } from '../../shared/engine/diot.engine';
import type { DiotReportResponse } from '../../shared/types';
import { DiotStatusBanners } from './DiotStatusBanners';
import { DiotSuppliersTable, type DiotSupplierRowWithEfos } from './DiotSuppliersTable';
import { Importar69BModal } from './Importar69BModal';

export interface DiotDeclaracionTabProps {
  isLoadingDiot: boolean;
  diotData: DiotReportResponse | null | undefined;
  isErrorDiot?: boolean;
  onRetryDiot?: () => void;
  onExportDiotCsv: () => void;
  onDownloadDiotTxt: () => void;
  copiedBatch: boolean;
  setCopiedBatch: (b: boolean) => void;
  onClassifySupplier?: (row: DiotSupplierRowWithEfos) => void;
}

export function DiotDeclaracionTab({
  isLoadingDiot,
  diotData,
  isErrorDiot,
  onRetryDiot,
  onExportDiotCsv,
  onDownloadDiotTxt,
  copiedBatch,
  setCopiedBatch,
  onClassifySupplier
}: DiotDeclaracionTabProps) {
  const { isReadOnlyClient, isReadOnlySupportMode } = useCompany();
  const isReadOnly = isReadOnlyClient || isReadOnlySupportMode;
  const toast = useToast();
  const [is69BModalOpen, setIs69BModalOpen] = useState(false);
  const [cloudSyncTick, setCloudSyncTick] = useState(0);
  const [cloudVerifiedKey, setCloudVerifiedKey] = useState<string | null>(null);
  const checkedCloudKeyRef = useRef<string>('');
  const { copiedKey, copy: copyDiotText } = useCopyToClipboard<'diot'>(2000);
  const isCopied = copiedBatch || copiedKey === 'diot';

  useEffect(() => {
    const companyId = diotData?.company.id;
    const rows = diotData?.rows ?? [];
    if (!companyId || rows.length === 0) return;
    const rfcs = Array.from(new Set(rows.map((r) => r.rfc.trim().toUpperCase()).filter((r) => r.length >= 12)));
    const key = `${companyId}::${rfcs.join(',')}`;
    if (rfcs.length === 0 || checkedCloudKeyRef.current === key) return;
    checkedCloudKeyRef.current = key;
    void checkRfcsAgainstCloud69B(rfcs, companyId)
      .then((res) => {
        if (res.matches.length > 0 || res.checkedCount > 0) {
          setCloudVerifiedKey(key);
          setCloudSyncTick((t) => t + 1);
        }
      })
      .catch(() => undefined);
  }, [diotData?.company.id, diotData?.rows]);

  if (isErrorDiot) {
    return (
      <div role="alert" className="max-w-lg mx-auto my-12">
        <EmptyState
          variant="card"
          tone="red"
          icon={<ShieldAlert className="w-6 h-6" aria-hidden="true" />}
          title="Error al generar la Declaración DIOT"
          description="No se pudo cargar la información de operaciones con terceros."
          actions={
            onRetryDiot && (
              <Button variant="primary" onClick={onRetryDiot}>
                Reintentar cálculo
              </Button>
            )
          }
        />
      </div>
    );
  }

  if (isLoadingDiot || !diotData) {
    return (
      <div role="status" aria-live="polite" aria-busy="true" className="p-10 bg-white rounded-2xl border border-slate-300 text-center text-xs text-slate-600">
        Calculando operaciones con terceros y determinación de IVA...
      </div>
    );
  }

  const mesName = MESES_SAT.find((m) => m.periodo === diotData.periodo)?.nombre || `Mes ${diotData.periodo}`;
  const meta69B = getLoaded69BMeta();
  const db69BCount = Math.max(getLoaded69BDatabase().size, meta69B?.totalCount ?? 0);
  const currentRfcs = Array.from(
    new Set(diotData.rows.map((r) => r.rfc.trim().toUpperCase()).filter((r) => r.length >= 12))
  );
  const currentSupplierKey = `${diotData.company.id}::${currentRfcs.join(',')}`;
  const isCloud69BVerified = currentRfcs.length > 0 && cloudVerifiedKey === currentSupplierKey;
  const isSampleOnly69B = db69BCount <= 4 && !isCloud69BVerified;
  const isTruncatedLocal69B = Boolean(meta69B?.isTruncated && !meta69B.cloudSynced && !isCloud69BVerified);

  const rowsWithEfos = diotData.rows.map((r) => {
    const efosCheck = checkRfc69BStatus(r.rfc);
    return { ...r, isEfos: efosCheck.isEfos, efosStatus: efosCheck.status };
  });
  void cloudSyncTick;
  const efosCount = rowsWithEfos.filter((r) => r.isEfos).length;
  const hasRows = diotData.rows.length > 0;
  const batchWarnings = validateDiotBatchLines(diotData.rows);
  const noRowsTitle = 'No hay operaciones pagadas con terceros en este periodo para exportar';
  const totalRetenciones = diotData.totals.isrRetenido + diotData.totals.ivaRetenido;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="IVA Trasladado Cobrado"
          value={formatCurrency(diotData.totals.ivaTrasladadoCobrado)}
          hint="Causado por cobros del mes"
        />
        <KpiCard
          label="(-) IVA Acreditable Pagado DIOT"
          value={formatCurrency(diotData.totals.ivaAcreditable16)}
          valueClassName="text-emerald-800"
          hint={`Base pagada: ${formatCurrency(diotData.totals.actosPagados16)}`}
        />
        <KpiCard
          label="(=) IVA Neto a Cargo / Favor"
          value={formatCurrency(diotData.totals.ivaNetoCargoFavor)}
          valueClassName={diotData.totals.ivaNetoCargoFavor >= 0 ? 'text-blue-800' : 'text-emerald-800'}
          hint={
            diotData.totals.ivaNetoCargoFavor >= 0
              ? 'Impuesto a cargo en pago provisional'
              : 'Saldo a favor del periodo'
          }
        />
        <KpiCard
          label="Retenciones (ISR + IVA)"
          value={formatCurrency(totalRetenciones)}
          valueClassName={totalRetenciones > 0 ? 'text-red-700' : 'text-slate-900'}
          hint={`ISR: ${formatCurrency(diotData.totals.isrRetenido)} | IVA: ${formatCurrency(diotData.totals.ivaRetenido)}`}
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-700" aria-hidden="true" />
                Declaración Informativa de Operaciones con Terceros — DIOT 2025/2026 (54 campos)
              </h2>
              {efosCount > 0 ? (
                <span
                  role="status"
                  title="Atención: Se detectaron proveedores con publicación presunta o definitiva en la lista negra del SAT"
                >
                  <StatusBadge tone="red" icon={<ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />}>
                    {efosCount} Proveedor(es) en Lista 69-B
                  </StatusBadge>
                </span>
              ) : isSampleOnly69B ? (
                <div className="inline-flex flex-wrap items-center gap-2">
                  <span
                    role="status"
                    title="La lista oficial del SAT Art. 69-B aún no ha sido importada; solo están cargados 4 RFCs de muestra"
                  >
                    <StatusBadge tone="amber" icon={<AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />}>
                      Lista 69-B sin cargar (solo 4 muestra)
                    </StatusBadge>
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={isReadOnly}
                    onClick={() => { if (!isReadOnly) setIs69BModalOpen(true); }}
                    title={isReadOnly ? 'Modo solo lectura' : 'Importar CSV oficial del SAT Art. 69-B'}
                    leftIcon={<Upload className="w-3 h-3" aria-hidden="true" />}
                  >
                    Importar CSV 69-B
                  </Button>
                </div>
              ) : (
                <span
                  title={
                    isCloud69BVerified
                      ? 'Todos los RFCs fueron verificados contra el padrón oficial Art. 69-B en la nube de LibrePaq'
                      : `Todos los RFCs fueron verificados contra ${db69BCount.toLocaleString()} registros del Art. 69-B del CFF`
                  }
                >
                  <StatusBadge tone="emerald" icon={<ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />}>
                    0 EFOS 69-B
                  </StatusBadge>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600">
              Proveedores con CFDIs pagados y contabilizados en {mesName} {diotData.ejercicio} ({diotData.rows.length} terceros reportables)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              disabled={!hasRows}
              title={!hasRows ? noRowsTitle : 'Exportar cédula DIOT a Excel (.CSV)'}
              onClick={onExportDiotCsv}
              leftIcon={<Download className="w-4 h-4 text-slate-500" aria-hidden="true" />}
            >
              Exportar Excel (.CSV)
            </Button>
            <Button
              variant="primary"
              disabled={!hasRows}
              title={!hasRows ? noRowsTitle : `Descargar archivo batch ${diotData.filename}`}
              onClick={onDownloadDiotTxt}
              leftIcon={<Download className="w-4 h-4" aria-hidden="true" />}
            >
              Descargar Carga Batch ({diotData.filename})
            </Button>
          </div>
        </div>

        <DiotStatusBanners
          efosCount={efosCount}
          unpostedPaidCfdisCount={diotData.unpostedPaidCfdisCount ?? 0}
          regimenFiscal={diotData.company.regimenFiscal}
          isTruncatedLocal69B={isTruncatedLocal69B}
          cachedCount69B={meta69B?.cachedCount ?? getLoaded69BDatabase().size}
          totalCount69B={meta69B?.totalCount ?? db69BCount}
          batchWarnings={batchWarnings}
        />

        <DiotSuppliersTable
          rows={rowsWithEfos}
          mesName={mesName}
          ejercicio={diotData.ejercicio}
          totals={{
            actosPagados16: diotData.totals.actosPagados16,
            ivaAcreditable16: diotData.totals.ivaAcreditable16,
            ivaRetenido: diotData.totals.ivaRetenido,
            isrRetenido: diotData.totals.isrRetenido
          }}
          onClassifySupplier={onClassifySupplier}
        />

        <div className="p-4 bg-slate-50 text-slate-900 border-t border-slate-200 space-y-2">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-mono font-semibold text-slate-700">
              Vista Previa Carga Batch SAT ({diotData.filename})
            </span>
            <Button
              size="sm"
              variant="secondary"
              disabled={!hasRows || !diotData.batchTxtContent.trim()}
              title={!hasRows ? noRowsTitle : 'Copiar contenido del archivo batch .TXT al portapapeles'}
              onClick={() => {
                void copyDiotText(diotData.batchTxtContent, 'diot').then((ok) => {
                  if (ok) {
                    setCopiedBatch(true);
                    setTimeout(() => setCopiedBatch(false), 2000);
                  }
                });
              }}
              leftIcon={
                isCopied
                  ? <Check className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
                  : <Copy className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
              }
            >
              {isCopied ? '¡Copiado al Portapapeles!' : 'Copiar Contenido .TXT'}
            </Button>
          </div>
          <span className="visually-hidden" aria-live="polite">
            {isCopied ? 'Contenido DIOT copiado al portapapeles' : ''}
          </span>
          <pre className="max-h-60 overflow-y-auto p-3 rounded-xl bg-white border border-slate-200 text-xs font-mono text-slate-800 overflow-x-auto leading-relaxed">
            <code>
              {diotData.batchTxtContent || 'Sin operaciones gravadas pagadas registradas en este periodo.'}
            </code>
          </pre>
        </div>
      </div>

      <Importar69BModal
        isOpen={!isReadOnly && is69BModalOpen}
        onClose={() => setIs69BModalOpen(false)}
        onImportComplete={(count) => {
          toast.success(`Lista 69-B actualizada (${count.toLocaleString()} RFCs procesados).`);
          onRetryDiot?.();
        }}
      />
    </div>
  );
}
