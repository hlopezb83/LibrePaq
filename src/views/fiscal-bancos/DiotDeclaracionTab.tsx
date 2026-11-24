import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Copy, Download, FileSpreadsheet, ShieldAlert, ShieldCheck, Upload } from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import { formatCurrency } from '../../lib/formatters';
import { checkRfcsAgainstCloud69B } from '../../lib/supabase/supabase-cxc-sat';
import { checkRfc69BStatus, getLoaded69BDatabase, getLoaded69BMeta } from '../../shared/sat-69b';
import { MESES_SAT } from '../../shared/sat-constants';
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
      <div role="alert" className="p-8 text-center bg-white rounded-2xl border border-red-200 shadow-2xs space-y-4 max-w-lg mx-auto my-12">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" aria-hidden="true" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900 text-base">Error al generar la Declaración DIOT</h3>
          <p className="text-xs text-slate-600 mt-1">No se pudo cargar la información de operaciones con terceros.</p>
        </div>
        {onRetryDiot && (
          <button
            type="button"
            onClick={onRetryDiot}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            Reintentar cálculo
          </button>
        )}
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
    return {
      ...r,
      isEfos: efosCheck.isEfos,
      efosStatus: efosCheck.status
    };
  });
  void cloudSyncTick;
  const efosCount = rowsWithEfos.filter((r) => r.isEfos).length;
  const hasRows = diotData.rows.length > 0;
  const noRowsTitle = 'No hay operaciones pagadas con terceros en este periodo para exportar';

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-300 shadow-2xs">
          <div className="text-[11px] font-bold uppercase text-slate-500">
            IVA Trasladado Cobrado
          </div>
          <div className="mt-1 text-lg font-bold font-mono tabular-nums text-slate-900">
            {formatCurrency(diotData.totals.ivaTrasladadoCobrado)}
          </div>
          <div className="text-[11px] text-slate-600">Causado por cobros del mes</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-300 shadow-2xs">
          <div className="text-[11px] font-bold uppercase text-slate-500">
            (-) IVA Acreditable Pagado DIOT
          </div>
          <div className="mt-1 text-lg font-bold font-mono tabular-nums text-emerald-800">
            {formatCurrency(diotData.totals.ivaAcreditable16)}
          </div>
          <div className="text-[11px] text-slate-600">
            Base pagada: {formatCurrency(diotData.totals.actosPagados16)}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-300 shadow-2xs">
          <div className="text-[11px] font-bold uppercase text-slate-500">
            (=) IVA Neto a Cargo / Favor
          </div>
          <div
            className={`mt-1 text-lg font-bold font-mono tabular-nums ${
              diotData.totals.ivaNetoCargoFavor >= 0 ? 'text-blue-800' : 'text-emerald-800'
            }`}
          >
            {formatCurrency(diotData.totals.ivaNetoCargoFavor)}
          </div>
          <div className="text-[11px] text-slate-600">
            {diotData.totals.ivaNetoCargoFavor >= 0
              ? 'Impuesto a cargo en pago provisional'
              : 'Saldo a favor del periodo'}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-300 shadow-2xs">
          <div className="text-[11px] font-bold uppercase text-slate-500">
            Retenciones (ISR + IVA)
          </div>
          <div className="mt-1 text-lg font-bold font-mono tabular-nums text-red-700">
            {formatCurrency(diotData.totals.isrRetenido + diotData.totals.ivaRetenido)}
          </div>
          <div className="text-[11px] text-slate-600">
            ISR: {formatCurrency(diotData.totals.isrRetenido)} | IVA: {formatCurrency(diotData.totals.ivaRetenido)}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-700" aria-hidden="true" />
                Declaración Informativa de Operaciones con Terceros (DIOT Formato A-29)
              </h2>
              {efosCount > 0 ? (
                <span
                  role="status"
                  title="Atención: Se detectaron proveedores con publicación presunta o definitiva en la lista negra del SAT"
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-900 border border-red-300 shadow-2xs"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-red-700" aria-hidden="true" />
                  <span>{efosCount} Proveedor(es) en Lista 69-B</span>
                </span>
              ) : isSampleOnly69B ? (
                <div className="inline-flex flex-wrap items-center gap-2">
                  <span
                    role="status"
                    title="La lista oficial del SAT Art. 69-B aún no ha sido importada; solo están cargados 4 RFCs de muestra"
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-900 border border-amber-300 shadow-2xs"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
                    <span>Lista 69-B sin cargar (solo 4 muestra)</span>
                  </span>
                  <button
                    type="button"
                    disabled={isReadOnly}
                    onClick={() => { if (!isReadOnly) setIs69BModalOpen(true); }}
                    title={isReadOnly ? 'Modo solo lectura' : 'Importar CSV oficial del SAT Art. 69-B'}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-semibold bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Upload className="w-3 h-3" aria-hidden="true" />
                    Importar CSV 69-B
                  </button>
                </div>
              ) : (
                <span
                  title={
                    isCloud69BVerified
                      ? 'Todos los RFCs fueron verificados contra el padrón oficial Art. 69-B en la nube de LibrePaq'
                      : `Todos los RFCs fueron verificados contra ${db69BCount.toLocaleString()} registros del Art. 69-B del CFF`
                  }
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                  <span>0 EFOS 69-B</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600">
              Proveedores con CFDIs pagados y contabilizados en {mesName} {diotData.ejercicio} ({diotData.rows.length} terceros reportables)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!hasRows}
              title={!hasRows ? noRowsTitle : 'Exportar cédula DIOT a Excel (.CSV)'}
              onClick={onExportDiotCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition shadow-2xs"
            >
              <Download className="w-4 h-4 text-slate-500" aria-hidden="true" />
              <span>Exportar Excel (.CSV)</span>
            </button>
            <button
              type="button"
              disabled={!hasRows}
              title={!hasRows ? noRowsTitle : `Descargar archivo batch ${diotData.filename}`}
              onClick={onDownloadDiotTxt}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-blue-700 hover:bg-blue-800 text-white shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition"
            >
              <Download className="w-4 h-4 text-blue-200" aria-hidden="true" />
              <span>Descargar Carga Batch ({diotData.filename})</span>
            </button>
          </div>
        </div>

        <DiotStatusBanners
          efosCount={efosCount}
          unpostedPaidCfdisCount={diotData.unpostedPaidCfdisCount ?? 0}
          regimenFiscal={diotData.company.regimenFiscal}
          isTruncatedLocal69B={isTruncatedLocal69B}
          cachedCount69B={meta69B?.cachedCount ?? getLoaded69BDatabase().size}
          totalCount69B={meta69B?.totalCount ?? db69BCount}
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

        <div className="p-4 bg-[#0A1120] text-slate-200 border-t border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-slate-300">
              Vista Previa Carga Batch SAT ({diotData.filename})
            </span>
            <button
              type="button"
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
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#111C35] hover:bg-slate-800 text-emerald-300 border border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition shadow-2xs"
            >
              {isCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                  <span>¡Copiado al Portapapeles!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                  <span>Copiar Contenido .TXT</span>
                </>
              )}
            </button>
          </div>
          <span className="visually-hidden" aria-live="polite">
            {isCopied ? 'Contenido DIOT copiado al portapapeles' : ''}
          </span>
          <pre className="max-h-60 overflow-y-auto text-xs font-mono text-emerald-400 overflow-x-auto leading-relaxed">
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
