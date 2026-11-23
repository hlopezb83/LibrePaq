import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
import type { Account, CfdiDocument } from '../../../shared/types';
import { CfdiFacturaTab } from './CfdiFacturaTab';
import { CfdiPolizaTab } from './CfdiPolizaTab';
import { CfdiXmlTab } from './CfdiXmlTab';

interface CfdiInvoicePreviewModalProps {
  cfdi: CfdiDocument | null;
  accounts?: readonly Account[];
  isPeriodLocked?: boolean;
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
  onClose,
  onContabilizar,
  onDownloadXml
}: CfdiInvoicePreviewModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [activeTab, setActiveTab] = useState<'FACTURA' | 'POLIZA' | 'XML'>('FACTURA');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  useDialogLightDismiss(dialogRef, onClose, { isOpen: Boolean(cfdi) });

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

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const emisorRfcCheck = useMemo(
    () => (cfdi ? validateRfcModulo11(cfdi.emisorRfc) : null),
    [cfdi?.emisorRfc]
  );
  const receptorRfcCheck = useMemo(
    () => (cfdi ? validateRfcModulo11(cfdi.receptorRfc) : null),
    [cfdi?.receptorRfc]
  );

  const autoPlan = useMemo(() => {
    if (!cfdi || !accounts || accounts.length === 0) return null;
    try {
      return buildAutoPolizaPlan(cfdi, accounts);
    } catch {
      return null;
    }
  }, [cfdi, accounts]);

  if (!cfdi) return null;

  const tipoLabel =
    cfdi.tipoComprobante === 'I'
      ? 'I - Ingreso (Factura Comercial)'
      : cfdi.tipoComprobante === 'E'
      ? 'E - Egreso (Nota de Crédito)'
      : cfdi.tipoComprobante === 'P'
      ? 'P - Recepción de Pagos (REP 2.0)'
      : cfdi.tipoComprobante === 'N'
      ? 'N - Nómina Digital'
      : 'T - Traslado';

  const satVerifUrl = `https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?id=${cfdi.uuid}&re=${cfdi.emisorRfc}&rr=${cfdi.receptorRfc}&tt=${cfdi.total}&fe=${cfdi.uuid.slice(-8)}`;

  return createPortal(
    <dialog
      ref={dialogRef}
      closedby="any"
      onClose={onClose}
      aria-labelledby="cfdi-preview-title"
      className="rounded-2xl shadow-2xl border border-slate-300 bg-white w-full max-w-4xl overflow-hidden backdrop:bg-slate-900/60"
    >
      <div className="p-4 sm:p-5 max-h-[90dvh] scrollable-panel space-y-4">
        {/* Barra superior de herramientas y pestañas de vista */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 border-b border-slate-200 no-print gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center shrink-0">
              <FileCode2 className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="cfdi-preview-title" className="text-base font-bold text-slate-900">
                Inspector y Visor de CFDI 4.0
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                <span>UUID: {cfdi.uuid.slice(0, 18)}...</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(cfdi.uuid, 'UUID')}
                  title="Copiar UUID completo"
                  aria-label="Copiar UUID completo"
                  className="text-slate-400 hover:text-blue-700 cursor-pointer"
                >
                  {copiedText === 'UUID' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Selector de Modos de Vista */}
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
            <div
              role="tablist"
              aria-label="Vistas del comprobante CFDI"
              className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-semibold"
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
                    className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                      isSelected ? 'bg-white text-blue-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 sm:pl-2">
              <a
                href={satVerifUrl}
                target="_blank"
                rel="noreferrer"
                title="Verificar validez fiscal directamente en el portal del SAT"
                aria-label="Verificar CFDI en portal del SAT"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition"
              >
                <ExternalLink className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                SAT
              </a>

              {onDownloadXml && (
                <button
                  type="button"
                  onClick={() => onDownloadXml(cfdi)}
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

              {!cfdi.polizaId && onContabilizar && (
                <button
                  type="button"
                  disabled={isPeriodLocked}
                  title={isPeriodLocked ? 'Periodo fiscal bloqueado ante el SAT' : 'Generar póliza para comprobante'}
                  onClick={() => {
                    dialogRef.current?.close();
                    onContabilizar(cfdi);
                  }}
                  aria-label="Generar póliza para comprobante"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs transition cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                  Contabilizar
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar vista previa"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        {/* TAB 1: REPRESENTACIÓN IMPRESA OFICIAL SAT */}
        {activeTab === 'FACTURA' && (
          <div role="tabpanel" id="cfdi-prev-panel-FACTURA" aria-labelledby="cfdi-prev-tab-FACTURA">
            <CfdiFacturaTab
              cfdi={cfdi}
              tipoLabel={tipoLabel}
              emisorRfcCheck={emisorRfcCheck}
              receptorRfcCheck={receptorRfcCheck}
            />
          </div>
        )}

        {/* TAB 2: PÓLIZA CONTABLE AUTOMÁTICA */}
        {activeTab === 'POLIZA' && (
          <div role="tabpanel" id="cfdi-prev-panel-POLIZA" aria-labelledby="cfdi-prev-tab-POLIZA">
            <CfdiPolizaTab
              cfdi={cfdi}
              autoPlan={autoPlan}
              onContabilizar={isPeriodLocked ? undefined : onContabilizar}
              onClose={() => dialogRef.current?.close()}
            />
          </div>
        )}

        {/* TAB 3: INSPECTOR DE NODOS XML DEL SAT */}
        {activeTab === 'XML' && (
          <div role="tabpanel" id="cfdi-prev-panel-XML" aria-labelledby="cfdi-prev-tab-XML">
            <CfdiXmlTab
              cfdi={cfdi}
              copiedText={copiedText}
              copyToClipboard={copyToClipboard}
            />
          </div>
        )}
      </div>
    </dialog>,
    document.body
  );
}
