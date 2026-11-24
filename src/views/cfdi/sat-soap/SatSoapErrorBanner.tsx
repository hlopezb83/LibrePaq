import { AlertCircle, Lightbulb } from 'lucide-react';
import { AlertBanner, StatusBadge } from '../../../components/ui';
import type { SatDownloadRequestRecord } from '../../../shared/types';
import { translateSatErrorCode } from './satErrorTranslator';

interface SatSoapErrorBannerProps {
  relevantError: SatDownloadRequestRecord;
  onDismiss: () => void;
}

export function SatSoapErrorBanner({ relevantError, onDismiss }: SatSoapErrorBannerProps) {
  const isPartialStatus =
    relevantError.estadoSolicitud === 'PARCIAL' ||
    relevantError.estadoSolicitud === 'ERROR_LIMITE';

  const translatedError = isPartialStatus
    ? {
        code: relevantError.codigoEstadoSat || 'PARCIAL',
        title: `Descarga SAT parcial (${relevantError.cfdisDescargados || 0} comprobantes integrados)`,
        explanation:
          relevantError.mensajeSat || 'El SAT alcanzó el límite de descarga para este rango.',
        hint: 'Divide el periodo en rangos de fechas más cortos (ej. por semana o quincena).'
      }
    : translateSatErrorCode(relevantError.codigoEstadoSat, relevantError.mensajeSat);

  return (
    <AlertBanner
      tone="warning"
      icon={<AlertCircle className="w-4 h-4" aria-hidden="true" />}
      title={translatedError.title}
      action={
        <StatusBadge tone="amber" shape="tag">
          SAT {translatedError.code}
        </StatusBadge>
      }
      onDismiss={onDismiss}
      dismissLabel="Descartar aviso"
    >
      <div className="space-y-2 mt-1">
        <p className="text-[11px] leading-relaxed">
          {relevantError.mensajeSat || translatedError.explanation}
        </p>
        <div className="bg-white p-2 rounded-lg border border-amber-200 font-mono text-[11px] text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <span>
            Folio SAT:{' '}
            <strong className="select-all underline text-slate-900">
              {relevantError.idSolicitudSat}
            </strong>
          </span>
          <span className="text-slate-600 text-[11px]">
            ({relevantError.fechaInicial} al {relevantError.fechaFinal})
          </span>
        </div>
        <p className="text-[11px] text-slate-700 flex items-center gap-1.5">
          <Lightbulb className="w-3.5 h-3.5 text-amber-700 shrink-0" aria-hidden="true" />
          <span>
            <em>¿Qué puedes hacer?</em> {translatedError.hint}
          </span>
        </p>
      </div>
    </AlertBanner>
  );
}
