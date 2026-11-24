import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileArchive,
  FileCode2,
  RefreshCw
} from 'lucide-react';
import { Button, EmptyState, StatusBadge, TabBar, type TabBarItem } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import { downloadBlobFile } from '../../lib/formatters';
import {
  hasEmptyAnexo24Body,
  isValidSatNumOrden,
  isValidSatNumTramite,
  type SatXmlType
} from '../../shared/sat-anexo24';
import { buildSatAnexo24Zip } from '../../shared/sat-anexo24-zip';
import { Anexo24OptionsBar, type Anexo24UiOptions } from './Anexo24OptionsBar';

interface Anexo24TabProps {
  companyRfc: string;
  ejercicio: number;
  periodo: number;
  satXmlType: SatXmlType;
  setSatXmlType: (type: SatXmlType) => void;
  anexo24Options: Anexo24UiOptions;
  setAnexo24Options: (next: Anexo24UiOptions) => void;
  satXmlData: { xml: string; filename: string; type: string } | undefined;
  isLoadingXml: boolean;
  isErrorXml?: boolean;
  xmlError?: unknown;
  onRetryXml?: () => void;
  onDownloadXml: () => void;
}

const XML_TYPE_BUTTONS: ReadonlyArray<TabBarItem<SatXmlType>> = [
  { id: 'balanza', label: 'Balanza (BN/BC)' },
  { id: 'catalogo', label: 'Catálogo (CT)' },
  { id: 'polizas', label: 'Pólizas (PL)' },
  { id: 'auxiliar_folios', label: 'Aux. Folios (XF)' },
  { id: 'auxiliar_cuentas', label: 'Aux. Cuentas (XC)' }
];

export function Anexo24Tab({
  companyRfc,
  ejercicio,
  periodo,
  satXmlType,
  setSatXmlType,
  anexo24Options,
  setAnexo24Options,
  satXmlData,
  isLoadingXml,
  isErrorXml,
  xmlError,
  onRetryXml,
  onDownloadXml
}: Anexo24TabProps) {
  const toast = useToast();
  const { copiedKey, copy } = useCopyToClipboard<'xml'>(1800);
  const copiedXml = copiedKey === 'xml';

  const needsSolicitud =
    satXmlType === 'polizas' ||
    satXmlType === 'auxiliar_folios' ||
    satXmlType === 'auxiliar_cuentas';
  const isOrdenSolicitud =
    anexo24Options.tipoSolicitud === 'AF' || anexo24Options.tipoSolicitud === 'FC';
  const capturedFolio = isOrdenSolicitud
    ? anexo24Options.numOrden.trim()
    : anexo24Options.numTramite.trim();
  const missingSolicitudFolio = needsSolicitud && capturedFolio.length === 0;
  const invalidSolicitudFolio =
    needsSolicitud &&
    capturedFolio.length > 0 &&
    (isOrdenSolicitud
      ? !isValidSatNumOrden(capturedFolio)
      : !isValidSatNumTramite(capturedFolio));
  const hasSolicitudWarning = missingSolicitudFolio || invalidSolicitudFolio;
  const isMissingFechaModBal =
    satXmlType === 'balanza' &&
    anexo24Options.tipoEnvio === 'C' &&
    !anexo24Options.fechaModBal.trim();
  const isEmptyXmlBody = Boolean(satXmlData?.xml && hasEmptyAnexo24Body(satXmlType, satXmlData.xml));
  const isDownloadBlocked = !satXmlData || hasSolicitudWarning || isMissingFechaModBal || isEmptyXmlBody;
  const blockedDownloadTitle = !satXmlData
    ? 'Esperando generación del archivo XML Anexo 24...'
    : isEmptyXmlBody
      ? 'Archivo XML sin movimientos ni registros de detalle; el SAT rechaza archivos vacíos conforme al Anexo 24 v1.3.'
      : isMissingFechaModBal
        ? 'Captura la FechaModBal requerida para envío Complementario (C)'
        : missingSolicitudFolio
          ? `Captura ${isOrdenSolicitud ? 'el Número de Orden' : 'el Número de Trámite'} requerido para ${anexo24Options.tipoSolicitud}`
          : `Corrige el formato de ${isOrdenSolicitud ? 'Número de Orden' : 'Número de Trámite'} antes de descargar`;

  const handleCopy = () => {
    if (!satXmlData?.xml) return;
    void copy(satXmlData.xml, 'xml');
  };

  const handleDownloadZip = () => {
    if (!satXmlData?.xml || !satXmlData.filename) return;
    try {
      const zipRes = buildSatAnexo24Zip({
        company: { rfc: companyRfc },
        year: ejercicio,
        period: periodo,
        type: satXmlType,
        xmlResult: satXmlData,
        tipoEnvio: anexo24Options.tipoEnvio
      });
      const zipBuffer = zipRes.zipBytes.buffer.slice(
        zipRes.zipBytes.byteOffset,
        zipRes.zipBytes.byteOffset + zipRes.zipBytes.byteLength
      ) as ArrayBuffer;
      downloadBlobFile(zipRes.zipFilename, zipBuffer, 'application/zip');
      toast.success(`Paquete ZIP SAT descargado: ${zipRes.zipFilename}`);
    } catch {
      toast.error('No se pudo empaquetar el archivo .ZIP para el SAT');
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs p-5 sm:p-6 space-y-4">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FileCode2 className="w-5 h-5 text-blue-700 shrink-0" aria-hidden="true" />
            <span>Generador de Contabilidad Electrónica SAT (Anexo 24 v1.3)</span>
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Archivos XML validados con la nomenclatura y estructura XSD oficial del SAT para buzón tributario
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <TabBar
            mode="group"
            tabs={XML_TYPE_BUTTONS}
            activeId={satXmlType}
            onSelect={setSatXmlType}
            idPrefix="anexo24-type-"
            ariaLabel="Tipo de archivo XML SAT"
          />

          <div className="flex flex-wrap items-center gap-2">
            {satXmlData && (
              <Button
                variant="secondary"
                size="md"
                disabled={isDownloadBlocked}
                title={isDownloadBlocked ? blockedDownloadTitle : 'Copiar código XML al portapapeles'}
                onClick={handleCopy}
                leftIcon={
                  copiedXml ? (
                    <Check className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                  )
                }
              >
                {copiedXml ? 'XML Copiado' : 'Copiar XML'}
              </Button>
            )}
            <span className="visually-hidden" aria-live="polite">
              {copiedXml ? 'Código XML copiado al portapapeles' : ''}
            </span>
            <Button
              variant="export"
              size="md"
              onClick={handleDownloadZip}
              disabled={isDownloadBlocked}
              title={
                isDownloadBlocked
                  ? blockedDownloadTitle
                  : `Empaquetar ${satXmlData.filename} en .ZIP oficial para Buzón Tributario`
              }
              leftIcon={<FileArchive className="w-4 h-4" aria-hidden="true" />}
            >
              Descargar .ZIP SAT Oficial
            </Button>
            <Button
              variant="export-outline"
              size="md"
              onClick={onDownloadXml}
              disabled={isDownloadBlocked}
              title={
                isDownloadBlocked
                  ? blockedDownloadTitle
                  : `Descargar ${satXmlData.filename} sin comprimir`
              }
              leftIcon={<Download className="w-4 h-4" aria-hidden="true" />}
            >
              Descargar .XML
            </Button>
          </div>
        </div>
      </div>

      <Anexo24OptionsBar
        satXmlType={satXmlType}
        options={anexo24Options}
        onChange={setAnexo24Options}
      />

      {isErrorXml ? (
        <div role="alert">
          <EmptyState
            variant="dashed"
            tone="red"
            icon={<AlertCircle className="w-6 h-6" aria-hidden="true" />}
            title="No se pudo generar el XML Anexo 24"
            description={xmlError instanceof Error ? xmlError.message : 'Error de conexión al generar el XML.'}
            actions={
              onRetryXml ? (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={onRetryXml}
                  leftIcon={<RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />}
                >
                  Reintentar XML
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : isLoadingXml || !satXmlData ? (
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          className="p-12 text-center text-xs text-slate-600"
        >
          <div
            className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin mx-auto mb-3"
            aria-hidden="true"
          />
          Generando estructura XML Anexo 24 oficial...
        </div>
      ) : (
        <figure className="space-y-2">
          <figcaption className="text-xs font-mono text-slate-700 flex flex-wrap items-center justify-between gap-2 px-1">
            <span>
              Archivo oficial: <strong className="text-blue-700 break-all">{satXmlData.filename}</strong> ({satXmlData.type})
            </span>
            {hasSolicitudWarning || isMissingFechaModBal || isEmptyXmlBody ? (
              <span role="status">
                <StatusBadge
                  tone="amber"
                  shape="tag"
                  icon={<AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />}
                >
                  {isEmptyXmlBody
                    ? 'Archivo XML vacío (sin registros de detalle requeridos por XSD SAT 1.3)'
                    : isMissingFechaModBal
                      ? 'Captura FechaModBal requerida para envío Complementario (C)'
                      : missingSolicitudFolio
                        ? `Captura ${isOrdenSolicitud ? 'NumOrden' : 'NumTramite'} requerido para ${anexo24Options.tipoSolicitud}`
                        : `${isOrdenSolicitud ? 'NumOrden' : 'NumTramite'} con formato inválido`}
                </StatusBadge>
              </span>
            ) : (
              <span role="status">
                <StatusBadge
                  tone="emerald"
                  shape="tag"
                  icon={<CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />}
                >
                  Esquema XSD SAT 1.3 Válido
                </StatusBadge>
              </span>
            )}
          </figcaption>
          <p className="text-[11px] text-slate-600 px-1">
            Regla 2.8.1.5 RMF:{' '}
            {satXmlType === 'polizas' || satXmlType === 'auxiliar_folios' || satXmlType === 'auxiliar_cuentas'
              ? 'Los archivos PL, XF y XC se presentan ante el SAT en solicitudes de devolución, compensación o facultades de comprobación; el botón "Descargar .ZIP SAT Oficial" ya los empaqueta con la nomenclatura SAT.'
              : 'El botón "Descargar .ZIP SAT Oficial" ya empaqueta este XML dentro de un comprimido .ZIP conservando exactamente la nomenclatura oficial del SAT para enviarlo por Buzón Tributario.'}
          </p>
          <pre
            tabIndex={0}
            role="region"
            aria-label="Vista previa del código XML Anexo 24"
            className="p-4 rounded-xl bg-[#0A1120] text-emerald-300 text-xs font-mono overflow-x-auto max-h-[460px] leading-relaxed border border-slate-800 shadow-inner"
          >
            <code>{satXmlData.xml}</code>
          </pre>
        </figure>
      )}
    </div>
  );
}
