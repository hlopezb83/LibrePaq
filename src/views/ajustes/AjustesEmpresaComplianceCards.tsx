import { useState } from 'react';
import { FolderTree, Loader2, Lock, LockOpen, ShieldCheck } from 'lucide-react';
import type { Company } from '../../shared/types';

export interface AjustesEmpresaComplianceCardsProps {
  activeCompany: Company;
  compMask: string;
  periodLock?: { isLocked: boolean } | null;
  togglePeriodLockMutation: { mutate: (lock: boolean) => void; isPending: boolean };
  isReadOnly?: boolean;
}

export function AjustesEmpresaComplianceCards({
  activeCompany,
  compMask,
  periodLock,
  togglePeriodLockMutation,
  isReadOnly = false
}: AjustesEmpresaComplianceCardsProps) {
  const [confirmLockToggle, setConfirmLockToggle] = useState(false);

  return (
    <div className="space-y-5">
      {/* Tarjeta: Candado Fiscal de Periodo */}
      <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <Lock className="w-4 h-4 text-blue-700" aria-hidden="true" />
            <span>Control y Candado Fiscal</span>
          </div>
          <span className="text-[11px] font-mono font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
            P{String(activeCompany.currentPeriod).padStart(2, '0')}/{activeCompany.currentYear}
          </span>
        </div>

        <div className="p-5 space-y-4 text-xs">
          <p className="text-slate-600 leading-relaxed">
            Protege los registros contables contra modificaciones accidentales una vez presentada la declaración del mes ante el SAT.
          </p>

          <div
            className={`p-4 rounded-xl border ${
              periodLock?.isLocked
                ? 'bg-amber-50 border-amber-200 text-amber-950'
                : 'bg-emerald-50 border-emerald-200 text-emerald-950'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-xs">
              {periodLock?.isLocked ? (
                <>
                  <Lock className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
                  <span>PERIODO BLOQUEADO (SOLO LECTURA)</span>
                </>
              ) : (
                <>
                  <LockOpen className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
                  <span>PERIODO ABIERTO PARA CAPTURA</span>
                </>
              )}
            </div>
            <p className="text-[11px] mt-1 text-slate-700">
              {periodLock?.isLocked
                ? `El periodo ${activeCompany.currentPeriod}/${activeCompany.currentYear} se encuentra protegido contra altas, bajas o modificaciones.`
                : 'Permite registrar pólizas, importar CFDIs y conciliar movimientos bancarios libremente.'}
            </p>
          </div>

          {confirmLockToggle ? (
            <div
              role="alertdialog"
              aria-modal="false"
              aria-label="Confirmar cambio de candado fiscal"
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setConfirmLockToggle(false);
                }
              }}
              className="p-3 rounded-xl bg-amber-50 border border-amber-300 space-y-2"
            >
              <p className="font-bold text-amber-950">
                {periodLock?.isLocked
                  ? `¿Confirmas reabrir el periodo P${String(activeCompany.currentPeriod).padStart(2, '0')}/${activeCompany.currentYear} para captura?`
                  : `¿Confirmas bloquear el periodo P${String(activeCompany.currentPeriod).padStart(2, '0')}/${activeCompany.currentYear} contra cambios?`}
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  autoFocus
                  onClick={() => setConfirmLockToggle(false)}
                  className="px-3 py-1.5 rounded-lg font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={togglePeriodLockMutation.isPending}
                  onClick={() => {
                    togglePeriodLockMutation.mutate(!(periodLock?.isLocked ?? false));
                    setConfirmLockToggle(false);
                  }}
                  className="px-3 py-1.5 rounded-lg font-bold bg-amber-700 hover:bg-amber-800 text-white cursor-pointer disabled:opacity-50"
                >
                  {periodLock?.isLocked ? 'Sí, reabrir periodo' : 'Sí, bloquear periodo'}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={isReadOnly || togglePeriodLockMutation.isPending}
              aria-busy={togglePeriodLockMutation.isPending}
              title={
                isReadOnly
                  ? 'Modo solo lectura: no tienes permisos para bloquear o reabrir periodos'
                  : undefined
              }
              onClick={() => {
                if (!isReadOnly) setConfirmLockToggle(true);
              }}
              className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                periodLock?.isLocked
                  ? 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300 shadow-2xs'
                  : 'bg-amber-600 hover:bg-amber-700 text-white border-transparent shadow-xs'
              }`}
            >
              {togglePeriodLockMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : periodLock?.isLocked ? (
                <LockOpen className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Lock className="w-4 h-4" aria-hidden="true" />
              )}
              <span>
                {togglePeriodLockMutation.isPending
                  ? 'Actualizando candado...'
                  : periodLock?.isLocked
                    ? 'Reabrir Periodo para Captura'
                    : 'Bloquear Periodo Fiscal'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Tarjeta: Estructura y Máscara de Cuentas */}
      <div className="bg-white rounded-2xl border border-slate-300/90 p-5 shadow-2xs space-y-3">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
          <FolderTree className="w-4 h-4 text-purple-700" aria-hidden="true" />
          <span>Estructura y Catálogo Contable</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="font-bold text-slate-700 block text-[11px]">Máscara Contable</span>
            <span className="font-mono font-bold text-blue-900 bg-white px-2 py-0.5 rounded border border-slate-300 inline-block mt-1">
              {compMask}
            </span>
            <p className="text-[10px] text-slate-600 mt-1">
              3 niveles estándar reglamentados por Anexo 24.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="font-bold text-slate-700 block text-[11px]">Catálogo Oficial</span>
            <span className="text-slate-900 font-bold block mt-1">SAT Anexo 24</span>
            <p className="text-[10px] text-slate-600 mt-1">
              Compatible con CONTPAQi Contabilidad.
            </p>
          </div>
        </div>
      </div>

      {/* Tarjeta: Estándares Fiscales SAT */}
      <div className="bg-[#0A1120] text-white rounded-2xl p-5 shadow-sm border border-slate-800 space-y-3.5 text-xs">
        <div className="flex items-center gap-2 text-blue-300 font-bold">
          <ShieldCheck className="w-4 h-4" aria-hidden="true" />
          <span className="uppercase tracking-wider text-[11px]">Garantía de Conformidad Fiscal</span>
        </div>
        <p className="text-slate-200 text-[11px] leading-relaxed">
          LibrePaq Pro opera bajo las especificaciones técnicas obligatorias del Servicio de Administración Tributaria.
        </p>

        <div className="space-y-2 pt-2 border-t border-slate-800 text-[11px]">
          <div className="flex items-center justify-between">
            <span className="text-slate-300">Contabilidad Electrónica</span>
            <span className="font-mono font-bold text-white">Anexo 24 RMF (XML 1.3)</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-300">Comprobantes Fiscales</span>
            <span className="font-mono font-bold text-white">CFDI Versión 4.0</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-300">Aritmética Monetaria</span>
            <span className="font-mono font-bold text-emerald-300">Exactitud al Centavo</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-300">Validación de RFC</span>
            <span className="font-mono font-bold text-emerald-300">SAT Módulo 11 Oficial</span>
          </div>
        </div>
      </div>
    </div>
  );
}
