import { CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';

interface WizardStep5ReviewProps {
  name: string;
  rfc: string;
  regimenFiscal: string;
  codigoPostal: string;
  currentYear: number;
  currentPeriod: number;
  catalogPreset: 'SAT_STANDARD' | 'RESICO_SIMPLIFIED' | 'CUSTOM';
  initialBankName: string;
  initialBankBalance: number;
  createOpeningEntry: boolean;
  skipFiel?: boolean;
  fielCerName?: string | null;
  fielKeyName?: string | null;
}

export function WizardStep5Review({
  name,
  rfc,
  regimenFiscal,
  codigoPostal,
  currentYear,
  currentPeriod,
  catalogPreset,
  initialBankName,
  initialBankBalance,
  createOpeningEntry,
  skipFiel = true,
  fielCerName = null,
  fielKeyName = null
}: WizardStep5ReviewProps) {
  return (
    <div className="space-y-4">
      <div className="dark-surface p-4 rounded-2xl bg-[#0A1120] text-white space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs font-bold text-blue-300 uppercase tracking-wider">
            Resumen de Configuración
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            Listo para inicializar
          </span>
        </div>
        <div className="text-base font-bold text-white">{name}</div>
        <div className="text-xs font-mono text-slate-300">
          RFC: <strong className="text-white">{rfc}</strong> • {regimenFiscal} • CP {codigoPostal}
        </div>
        <div className="text-xs text-slate-300">
          Periodo de arranque: <strong>P{String(currentPeriod).padStart(2, '0')} - {currentYear}</strong>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
            Catálogo de Cuentas
          </span>
          <span className="text-xs font-bold text-slate-900">
            {catalogPreset === 'SAT_STANDARD' && 'Catálogo Anexo 24 del SAT (54 cuentas)'}
            {catalogPreset === 'RESICO_SIMPLIFIED' && 'Catálogo Simplificado RESICO'}
            {catalogPreset === 'CUSTOM' && 'Importación CONTPAQi / Personalizado'}
          </span>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
            Tesorería / Banco
          </span>
          <span className="text-xs font-bold text-slate-900 tabular-nums">
            {initialBankName
              ? `${initialBankName} (${formatCurrency(initialBankBalance)} MXN)`
              : 'Omitido por ahora (se configura después)'}
          </span>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
            e.firma SAT (FIEL)
          </span>
          <span className="text-xs font-bold text-slate-900">
            {skipFiel
              ? 'Omitida por ahora (se configura después)'
              : fielCerName && fielKeyName
              ? `Lista (${fielCerName})`
              : 'Pendiente de adjuntar archivos'}
          </span>
        </div>
      </div>

      {initialBankName && createOpeningEntry && initialBankBalance > 0 && (
        <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs space-y-1.5 text-emerald-950">
          <div className="font-bold flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-700" aria-hidden="true" />
            Asiento de Apertura Automático (Póliza Diario #1)
          </div>
          <div className="font-mono text-[11px] space-y-0.5 text-slate-700 bg-white p-2.5 rounded-lg border border-emerald-100">
            <div className="flex justify-between">
              <span>Cargo: 102-01-001 ({initialBankName})</span>
              <strong className="text-emerald-700">{formatCurrency(initialBankBalance)}</strong>
            </div>
            <div className="flex justify-between">
              <span>Abono: 301-01-001 (Capital Social Fijo)</span>
              <strong className="text-emerald-700">{formatCurrency(initialBankBalance)}</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
