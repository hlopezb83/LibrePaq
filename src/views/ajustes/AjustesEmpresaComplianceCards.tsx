import { useState } from 'react';
import { Calculator, FileCheck2, FileCode2, FolderTree, Loader2, Lock, LockOpen, ShieldCheck } from 'lucide-react';
import { AlertBanner, Button, InlineConfirm, KpiCard, StatusBadge } from '../../components/ui';
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
          <StatusBadge tone="slate" shape="tag">
            P{String(activeCompany.currentPeriod).padStart(2, '0')}/{activeCompany.currentYear}
          </StatusBadge>
        </div>

        <div className="p-5 space-y-4 text-xs">
          <p className="text-slate-600 leading-relaxed">
            Protege los registros contables contra modificaciones accidentales una vez presentada la declaración del mes ante el SAT.
          </p>

          <AlertBanner
            tone={periodLock?.isLocked ? 'warning' : 'success'}
            icon={
              periodLock?.isLocked ? (
                <Lock className="w-4 h-4" aria-hidden="true" />
              ) : (
                <LockOpen className="w-4 h-4" aria-hidden="true" />
              )
            }
            title={periodLock?.isLocked ? 'PERIODO BLOQUEADO (SOLO LECTURA)' : 'PERIODO ABIERTO PARA CAPTURA'}
          >
            <p className="mt-0.5 text-[11px]">
              {periodLock?.isLocked
                ? `El periodo ${activeCompany.currentPeriod}/${activeCompany.currentYear} se encuentra protegido contra altas, bajas o modificaciones.`
                : 'Permite registrar pólizas, importar CFDIs y conciliar movimientos bancarios libremente.'}
            </p>
          </AlertBanner>

          {confirmLockToggle ? (
            <InlineConfirm
              tone="warning"
              busy={togglePeriodLockMutation.isPending}
              ariaLabel="Confirmar cambio de candado fiscal"
              message={
                periodLock?.isLocked
                  ? `¿Reabrir P${String(activeCompany.currentPeriod).padStart(2, '0')}/${activeCompany.currentYear}?`
                  : `¿Bloquear P${String(activeCompany.currentPeriod).padStart(2, '0')}/${activeCompany.currentYear}?`
              }
              confirmLabel={periodLock?.isLocked ? 'Sí, reabrir periodo' : 'Sí, bloquear periodo'}
              onCancel={() => setConfirmLockToggle(false)}
              onConfirm={() => {
                togglePeriodLockMutation.mutate(!(periodLock?.isLocked ?? false));
                setConfirmLockToggle(false);
              }}
              className="w-full justify-between"
            />
          ) : (
            <Button
              variant={periodLock?.isLocked ? 'secondary' : 'primary'}
              size="lg"
              className="w-full"
              disabled={isReadOnly || togglePeriodLockMutation.isPending}
              loading={togglePeriodLockMutation.isPending}
              title={
                isReadOnly
                  ? 'Modo solo lectura: no tienes permisos para bloquear o reabrir periodos'
                  : undefined
              }
              leftIcon={
                togglePeriodLockMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : periodLock?.isLocked ? (
                  <LockOpen className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Lock className="w-4 h-4" aria-hidden="true" />
                )
              }
              onClick={() => {
                if (!isReadOnly) setConfirmLockToggle(true);
              }}
            >
              {togglePeriodLockMutation.isPending
                ? 'Actualizando candado...'
                : periodLock?.isLocked
                  ? 'Reabrir Periodo para Captura'
                  : 'Bloquear Periodo Fiscal'}
            </Button>
          )}
        </div>
      </div>

      {/* Tarjeta: Estructura y Máscara de Cuentas */}
      <div className="bg-white rounded-2xl border border-slate-300/90 p-5 shadow-2xs space-y-3">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
          <FolderTree className="w-4 h-4 text-blue-700" aria-hidden="true" />
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

      {/* Tarjeta: Estándares Fiscales SAT (KPIs blancas limpias) */}
      <div className="bg-white rounded-2xl border border-slate-300/90 p-5 shadow-2xs space-y-3.5 text-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <ShieldCheck className="w-4 h-4 text-blue-700" aria-hidden="true" />
            <span>Garantía de Conformidad Fiscal</span>
          </div>
          <StatusBadge tone="emerald">Normativa SAT</StatusBadge>
        </div>
        <p className="text-slate-600 text-xs leading-relaxed">
          LibrePaq Pro opera bajo las especificaciones técnicas obligatorias del Servicio de Administración Tributaria.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <KpiCard
            label="Contabilidad Electrónica"
            value="Anexo 24 RMF"
            valueClassName="text-sm sm:text-base text-slate-900 font-mono tabular-nums"
            hint="XML 1.3 oficial"
            icon={<FileCode2 className="w-4 h-4" aria-hidden="true" />}
            iconTone="blue"
          />
          <KpiCard
            label="Comprobantes Fiscales"
            value="CFDI 4.0"
            valueClassName="text-sm sm:text-base text-slate-900 font-mono tabular-nums"
            hint="Timbrado y validación"
            icon={<FileCheck2 className="w-4 h-4" aria-hidden="true" />}
            iconTone="blue"
          />
          <KpiCard
            label="Aritmética Monetaria"
            value="Al Centavo"
            valueClassName="text-sm sm:text-base text-emerald-700 font-mono tabular-nums"
            hint="Exactitud entera"
            icon={<Calculator className="w-4 h-4" aria-hidden="true" />}
            iconTone="emerald"
          />
          <KpiCard
            label="Validación de RFC"
            value="Módulo 11"
            valueClassName="text-sm sm:text-base text-emerald-700 font-mono tabular-nums"
            hint="Algoritmo SAT oficial"
            icon={<ShieldCheck className="w-4 h-4" aria-hidden="true" />}
            iconTone="emerald"
          />
        </div>
      </div>
    </div>
  );
}
