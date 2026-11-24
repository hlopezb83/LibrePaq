import { useEffect, useMemo, useRef, useState } from 'react';
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
  Sparkles
} from 'lucide-react';
import {
  Button,
  ModalShell,
  TabBar,
  getButtonClasses,
  type TabBarItem
} from '../../../components/ui';
import { apiClient } from '../../../lib/api-client';
import { buildAutoPolizaPlan, validateRfcModulo11 } from '../../../shared/accounting-engine';
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

type PreviewTabId = 'FACTURA' | 'POLIZA' | 'XML';

const PREVIEW_TABS: ReadonlyArray<TabBarItem<PreviewTabId>> = [
  { id: 'FACTURA', label: 'Factura SAT', icon: <FileText className="w-3.5 h-3.5" aria-hidden="true" /> },
  { id: 'POLIZA', label: 'Póliza Contable', icon: <Scale className="w-3.5 h-3.5" aria-hidden="true" /> },
  { id: 'XML', label: 'Nodos XML', icon: <Code2 className="w-3.5 h-3.5" aria-hidden="true" /> }
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
  const [activeTab, setActiveTab] = useState<PreviewTabId>('FACTURA');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [fetchedXml, setFetchedXml] = useState<{ id: string; xml: string } | null>(null);
  const [isLoadingXml, setIsLoadingXml] = useState(false);

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
    void apiClient
      .getCfdiXml(cfdi.id)
      .then((xml) => {
        if (!cancelled && xml) setFetchedXml({ id: cfdi.id, xml });
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoadingXml(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cfdi?.id, cfdi?.xmlRaw]);

  const effectiveCfdi = useMemo(
    () =>
      !cfdi
        ? null
        : !cfdi.xmlRaw && fetchedXml?.id === cfdi.id
        ? { ...cfdi, xmlRaw: fetchedXml.xml }
        : cfdi,
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
  const preview = useMemo(
    () => (effectiveCfdi ? parseCfdiPreview(effectiveCfdi) : null),
    [effectiveCfdi]
  );

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

  const isNonContabilizable =
    effectiveCfdi.statusSat === 'CANCELADO' || effectiveCfdi.tipoComprobante === 'T';
  const isContabilizarDisabled = isWriteBlocked || isNonContabilizable;

  return (
    <ModalShell
      dialogRef={dialogRef}
      isOpen={Boolean(cfdi)}
      onClose={onClose}
      usePortal={true}
      maxWidth="4xl"
      titleId="cfdi-preview-title"
      icon={<FileCode2 className="w-5 h-5" aria-hidden="true" />}
      iconTone="blue"
      title="Inspector y Visor de CFDI 4.0"
      subtitle={
        <span className="inline-flex items-center gap-1.5 font-mono">
          <span className="truncate">UUID: {effectiveCfdi.uuid.slice(0, 18)}...</span>
          <button
            type="button"
            onClick={() => copyToClipboard(effectiveCfdi.uuid, 'UUID')}
            title="Copiar UUID completo"
            aria-label="Copiar UUID completo"
            className="min-w-[24px] min-h-[24px] p-1 inline-flex items-center justify-center rounded-md text-slate-600 hover:text-blue-700 hover:bg-slate-100 cursor-pointer shrink-0"
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
        </span>
      }
      closeLabel="Cerrar vista previa"
      dialogClassName="print:[&>header]:hidden print:[&>div]:p-0"
      bodyClassName="scrollable-panel"
      headerExtra={
        <div className="flex flex-wrap items-center gap-1.5">
          <a
            href={satVerifUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Verificar validez fiscal directamente en el portal del SAT"
            aria-label="Verificar CFDI en portal del SAT (abre en nueva pestaña)"
            className={getButtonClasses('secondary', 'sm')}
          >
            <ExternalLink className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
            <span>SAT</span>
            <span className="sr-only">(abre en nueva pestaña)</span>
          </a>

          {onDownloadXml && (
            <Button
              variant="export"
              size="sm"
              onClick={() => onDownloadXml(effectiveCfdi)}
              title="Descargar archivo XML original"
              aria-label="Descargar XML original"
              leftIcon={<Download className="w-3.5 h-3.5" aria-hidden="true" />}
            />
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (activeTab !== 'FACTURA') {
                setActiveTab('FACTURA');
                requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
              } else {
                window.print();
              }
            }}
            title="Imprimir representación impresa"
            aria-label="Imprimir factura"
            leftIcon={<Printer className="w-3.5 h-3.5" aria-hidden="true" />}
          />

          {!effectiveCfdi.polizaId && onContabilizar && (
            <Button
              variant="primary"
              size="sm"
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
              leftIcon={<Sparkles className="w-3.5 h-3.5" aria-hidden="true" />}
            >
              Contabilizar
            </Button>
          )}
        </div>
      }
      headerTabs={
        <TabBar
          tabs={PREVIEW_TABS}
          activeId={activeTab}
          onSelect={setActiveTab}
          idPrefix="cfdi-prev-tab-"
          ariaLabel="Vistas del comprobante CFDI"
          panelId={`cfdi-prev-panel-${activeTab}`}
        />
      }
    >
      {activeTab === 'FACTURA' && (
        <div role="tabpanel" id="cfdi-prev-panel-FACTURA" aria-labelledby="cfdi-prev-tab-FACTURA">
          <CfdiFacturaTab
            cfdi={effectiveCfdi}
            tipoLabel={tipoLabel}
            emisorRfcCheck={emisorRfcCheck}
            receptorRfcCheck={receptorRfcCheck}
            isLoadingXml={isLoadingXml}
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
    </ModalShell>
  );
}
