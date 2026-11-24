import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiClient } from '../../../lib/api-client';
import { useDialogLightDismiss } from '../../../hooks/useDialogLightDismiss';
import { handleTablistKeyDown } from '../../../hooks/useTablistKeyboard';
import {
  Check,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileCode2,
  FileText,
  Printer,
  Scale,
  Sparkles,
  X
} from 'lucide-react';
import {
  buildAutoPolizaPlan,
  validateRfcModulo11
} from '../../../shared/accounting-engine';
import { parseCfdiPreview } from '../../../shared/cfdi-preview-parser';
import type { Account, CfdiDocument } from '../../../shared/types';
import { CfdiFacturaTab } from './CfdiFacturaTab';
import { CfdiPolizaTab } from './CfdiPolizaTab';
import { CfdiXmlTab } from './CfdiXmlTab';

interface CfdiInvoicePreviewModalProps {
  cfdi: CfdiDocument | null;
  accounts?: readonly Account[];
  isPeriodLocked?: boolean;
  isReadOnlyClient?: boolean;
  onClose: () => void;
  onContabilizar?: (cfdi: CfdiDocument) => void;
  onDownloadXml?: (cfdi: CfdiDocument) => void;
}

const PREVIEW_TABS: ReadonlyArray<{ id: 'FACTURA' | 'POLIZA' | 'XML'; label: string; icon: typeof FileText }> = [
  { id: 'FACTURA', label: 'Factura SAT', icon: FileText },
  { id: 'POLIZA', label: 'Póliza Contable', icon: Scale },
  { id: 'XML', label: 'Nodos XML', icon: Code2 }
];

export function CfdiInvoicePreviewModal({
  cfdi,
  accounts = [],
  isPeriodLocked = false,
  isReadOnlyClient = false,
  onClose,
  onContabilizar,
  onDownloadXml
}: CfdiInvoicePreviewModalProps) {
  const isWriteBlocked = isPeriodLocked || isReadOnlyClient;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeTab, setActiveTab] = useState<'FACTURA' | 'POLIZA' | 'XML'>('FACTURA');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [fetchedXml, setFetchedXml] = useState<{ id: string; xml: string } | null>(null);
  const [isLoadingXml, setIsLoadingXml] = useState(false);

  useDialogLightDismiss(dialogRef, onClose, { isOpen: Boolean(cfdi) });

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (cfdi) {
      if (!dialog.open) dialog.showModal();
      setActiveTab('FACTURA');
    } else if (dialog.open) {
      dialog.close();
    }
  }, [cfdi]);

  useEffect(() => {
    if (!cfdi || cfdi.xmlRaw) {
      setFetchedXml(null);
      setIsLoadingXml(false);
      return;
    }
    let cancelled = false;
    setIsLoadingXml(true);
    void apiClient.getCfdiXml(cfdi.id).then((xml) => {
      if (!cancelled && xml) setFetchedXml({ id: cfdi.id, xml });
    }).catch(() => {}).finally(() => {
      if (!cancelled) setIsLoadingXml(false);
    });
    return () => { cancelled = true; };
  }, [cfdi?.id, cfdi?.xmlRaw]);

  const effectiveCfdi = useMemo(
    () => (!cfdi ? null : !cfdi.xmlRaw && fetchedXml?.id === cfdi.id ? { ...cfdi, xmlRaw: fetchedXml.xml } : cfdi),
    [cfdi, fetchedXml]
  );

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedText(label);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopiedText(null), 2000);
  };

  const emisorRfcCheck = useMemo(
    () => (effectiveCfdi ? validateRfcModulo11(effectiveCfdi.emisorRfc) : null),
    [effectiveCfdi?.emisorRfc]
  );
  const receptorRfcCheck = useMemo(
    () => (effectiveCfdi ? validateRfcModulo11(effectiveCfdi.receptorRfc) : null),
    [effectiveCfdi?.receptorRfc]
  );
  const preview = useMemo(() => (effectiveCfdi ? parseCfdiPreview(effectiveCfdi) : null), [effectiveCfdi]);

  const autoPlan = useMemo(() => {
    if (!effectiveCfdi || !accounts || accounts.length === 0) return null;
    try {
      return buildAutoPolizaPlan(effectiveCfdi, accounts);
    } catch {
      return null;
    }
  }, [effectiveCfdi, accounts]);

  if (!effectiveCfdi) return null;

  const tipoLabel =
    effectiveCfdi.tipoComprobante === 'I'
      ? 'I - Ingreso (Factura Comercial)'
      : effectiveCfdi.tipoComprobante === 'E'
      ? 'E - Egreso (Nota de Crédito)'
      : effectiveCfdi.tipoComprobante === 'P'
      ? 'P - Recepción de Pagos (REP 2.0)'
      : effectiveCfdi.tipoComprobante === 'N'
      ? 'N - Nómina Digital'
      : 'T - Traslado';

  const satParams = new URLSearchParams({
    id: effectiveCfdi.uuid,
    re: effectiveCfdi.emisorRfc,
    rr: effectiveCfdi.receptorRfc,
    tt: effectiveCfdi.tipoComprobante === 'P' ? '0' : String(effectiveCfdi.total)
  });
  const selloSuffix = preview?.timbre.selloCfd ? preview.timbre.selloCfd.slice(-8) : '';
  if (selloSuffix) satParams.set('fe', selloSuffix);
  const satVerifUrl = `https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?${satParams.toString()}`;

  return createPortal(
    <dialog
      ref={dialogRef}
      closedby="any"
      onClose={onClose}
      aria-labelledby="cfdi-preview-title"
      className="rounded-2xl shadow-2xl border border-slate-300 bg-white w-full max-w-4xl open:flex open:flex-col max-h-[92dvh] overflow-hidden p-0 m-auto backdrop:bg-slate-900/60"
    >
      {/* Barra superior sticky de herramientas y pestañas de vista */}
      <div className="p-4 sm:px-5 sm:py-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shrink-0 no-print bg-white">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center shrink-0">
            <FileCode2 className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 id="cfdi-preview-title" className="text-base font-bold text-slate-900">
              Inspector y Visor de CFDI 4.0
            </h1>
            <div className="flex items-center gap-1.5 text-xs text-slate-600 font-mono">
              <span className="truncate">UUID: {effectiveCfdi.uuid.slice(0, 18)}...</span>
              <button
                type="button"
                onClick={() => copyToClipboard(effectiveCfdi.uuid, 'UUID')}
                title="Copiar UUID completo"
                aria-label="Copiar UUID completo"
                className="min-w-[28px] min-h-[28px] p-1.5 inline-flex items-center justify-center rounded-md text-slate-600 hover:text-blue-700 hover:bg-slate-100 cursor-pointer shrink-0"
              >
                {copiedText === 'UUID' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                ) : (
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                )}
              </button>
              <span className="sr-only" aria-live="polite">
                {copiedText === 'UUID' ? 'UUID copiado al portapapeles' : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Selector de Modos de Vista y Acciones */}
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <div
            role="tablist"
            aria-label="Vistas del comprobante CFDI"
            className="flex flex-nowrap items-center max-w-full erp-tab-scroller rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-semibold"
          >
            {PREVIEW_TABS.map((t) => {
              const Icon = t.icon;
              const isSelected = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  id={`cfdi-prev-tab-${t.id}`}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  aria-controls={`cfdi-prev-panel-${t.id}`}
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => setActiveTab(t.id)}
                  onKeyDown={(e) =>
                    handleTablistKeyDown(e, PREVIEW_TABS, activeTab, setActiveTab, 'cfdi-prev-tab-')
                  }
                  className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                    isSelected ? 'bg-white text-blue-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 lg:pl-1">
            <a
              href={satVerifUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Verificar validez fiscal directamente en el portal del SAT"
              aria-label="Verificar CFDI en portal del SAT (abre en nueva pestaña)"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
              <span>SAT</span>
              <span className="sr-only">(abre en nueva pestaña)</span>
            </a>

            {onDownloadXml && (
              <button
                type="button"
                onClick={() => onDownloadXml(effectiveCfdi)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition cursor-pointer"
                title="Descargar archivo XML original"
                aria-label="Descargar XML original"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition cursor-pointer"
              title="Imprimir representación impresa"
              aria-label="Imprimir factura"
            >
              <Printer className="w-3.5 h-3.5" aria-hidden="true" />
            </button>

            {!effectiveCfdi.polizaId && onContabilizar && (() => {
              const isNonContabilizable =
                effectiveCfdi.statusSat === 'CANCELADO' || effectiveCfdi.tipoComprobante === 'T';
              const isContabilizarDisabled = isWriteBlocked || isNonContabilizable;
              return (
                <button
                  type="button"
                  disabled={isContabilizarDisabled}
                  title={
                    isReadOnlyClient
                      ? 'Modo solo lectura'
                      : isPeriodLocked
                      ? 'Periodo fiscal bloqueado ante el SAT'
                      : effectiveCfdi.statusSat === 'CANCELADO'
                      ? 'CFDI cancelado ante el SAT'
                      : effectiveCfdi.tipoComprobante === 'T'
                      ? 'CFDI de Traslado (T) no contabilizable'
                      : 'Contabilizar comprobante y generar póliza'
                  }
                  onClick={() => {
                    if (isContabilizarDisabled) return;
                    dialogRef.current?.close();
                    onContabilizar(effectiveCfdi);
                  }}
                  aria-label="Contabilizar comprobante y generar póliza"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs transition cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                  Contabilizar
                </button>
              );
            })()}

            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar vista previa"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center p-1.5 rounded-lg text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* Cuerpo scrollable */}
      <div className="p-4 sm:p-5 flex-1 min-h-0 overflow-y-auto overscroll-contain scrollable-panel">
        {activeTab === 'FACTURA' && (
          <div role="tabpanel" id="cfdi-prev-panel-FACTURA" aria-labelledby="cfdi-prev-tab-FACTURA">
            <CfdiFacturaTab
              cfdi={effectiveCfdi}
              tipoLabel={tipoLabel}
              emisorRfcCheck={emisorRfcCheck}
              receptorRfcCheck={receptorRfcCheck}
            />
          </div>
        )}

        {activeTab === 'POLIZA' && (
          <div role="tabpanel" id="cfdi-prev-panel-POLIZA" aria-labelledby="cfdi-prev-tab-POLIZA">
            <CfdiPolizaTab
              cfdi={effectiveCfdi}
              autoPlan={autoPlan}
              isWriteBlocked={isWriteBlocked}
              onContabilizar={isWriteBlocked ? undefined : onContabilizar}
              onClose={() => dialogRef.current?.close()}
            />
          </div>
        )}

        {activeTab === 'XML' && (
          <div role="tabpanel" id="cfdi-prev-panel-XML" aria-labelledby="cfdi-prev-tab-XML">
            <CfdiXmlTab
              cfdi={effectiveCfdi}
              copiedText={copiedText}
              copyToClipboard={copyToClipboard}
              isLoadingXml={isLoadingXml}
            />
          </div>
        )}
      </div>
    </dialog>,
    document.body
  );
}
