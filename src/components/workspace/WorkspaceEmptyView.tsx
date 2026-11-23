import { useRef } from 'react';
import {
  Briefcase,
  Building2,
  Check,
  FlaskConical,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Upload
} from 'lucide-react';
import type { Company } from '../../shared/types';
import type { UserWorkspace } from '../../context/CompanyContext';
import { useWorkspaceEmptyActions } from './useWorkspaceActions';

interface WorkspaceEmptyViewProps {
  workspace: UserWorkspace | null;
  onRenameWorkspace: (nextName: string) => Promise<void>;
  onOpenNewCompanyWizard: () => void;
  onCompanyRestored: (companyId: string, company?: Company) => void;
}

export function WorkspaceEmptyView({
  workspace,
  onRenameWorkspace,
  onOpenNewCompanyWizard,
  onCompanyRestored
}: WorkspaceEmptyViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    isEditingName,
    setIsEditingName,
    draftName,
    setDraftName,
    isSavingName,
    isRestoring,
    isProvisioningDemo,
    handleSaveName,
    handleProvisionDemo,
    handleRestoreFile
  } = useWorkspaceEmptyActions({
    workspace,
    onRenameWorkspace,
    onCompanyRestored
  });

  return (
    <div className="max-w-5xl mx-auto py-2 sm:py-5 lg:py-8 space-y-4 sm:space-y-6">
      {/* Cabecera Ejecutiva del Despacho Contable */}
      <section className="rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#0A1120] via-[#0F1B33] to-[#13264A] text-white p-4 sm:p-6 lg:p-8 shadow-xl border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 lg:gap-6">
          <div className="space-y-2.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[11px] font-bold bg-blue-500/20 text-cyan-300 border border-cyan-400/30">
                <Briefcase className="w-3.5 h-3.5" aria-hidden="true" />
                Despacho Contable Activo
              </span>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-400/30">
                0 Empresas Fiscales
              </span>
            </div>

            {!isEditingName ? (
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-lg sm:text-2xl font-extrabold tracking-tight text-white break-words">
                  {workspace?.name || 'Mi Despacho Contable'}
                </h1>
                <button
                  type="button"
                  onClick={() => {
                    setDraftName(workspace?.name || '');
                    setIsEditingName(true);
                  }}
                  title="Personalizar nombre de tu Despacho o Cartera"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-slate-200 transition cursor-pointer"
                >
                  <Pencil className="w-3 h-3" aria-hidden="true" />
                  <span>Renombrar</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleSaveName} className="flex flex-wrap items-center gap-2 max-w-md">
                <input
                  type="text"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setIsEditingName(false);
                    }
                  }}
                  placeholder="Ej. Despacho Contable Díaz & Asociados"
                  aria-label="Nombre del Despacho Contable (presiona Enter para guardar o Escape para cancelar)"
                  autoFocus
                  className="flex-1 min-w-[180px] px-3 py-1.5 rounded-xl bg-slate-900/90 border border-blue-400 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                />
                <button
                  type="submit"
                  disabled={isSavingName}
                  aria-busy={isSavingName}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-xs font-bold text-slate-950 transition cursor-pointer disabled:opacity-50"
                >
                  {isSavingName ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Check className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  <span>Guardar</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingName(false)}
                  className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-slate-300 transition cursor-pointer"
                >
                  Cancelar
                </button>
              </form>
            )}

            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Tu despacho en la nube está listo. Da de alta tu primera empresa (escribiendo su RFC,
              arrastrando una factura XML o subiendo el PDF de su Constancia SAT), o explora el sistema
              en 1 clic con una <strong className="text-amber-300">Empresa Ejemplo</strong> si estás en tu celular.
            </p>
          </div>

          <div className="shrink-0 flex flex-col sm:flex-row lg:flex-col gap-2 sm:gap-2.5">
            <button
              type="button"
              onClick={onOpenNewCompanyWizard}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-blue-950/50 border border-blue-400/30 transition cursor-pointer"
            >
              <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Crear Primera Empresa Fiscal</span>
            </button>

            <button
              type="button"
              disabled={isProvisioningDemo}
              aria-busy={isProvisioningDemo}
              onClick={() => void handleProvisionDemo()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-400/15 hover:bg-amber-400/25 text-amber-200 border border-amber-400/40 text-xs font-bold transition cursor-pointer disabled:opacity-50"
            >
              {isProvisioningDemo ? (
                <Loader2 className="w-3.5 h-3.5 text-amber-300 animate-spin shrink-0" aria-hidden="true" />
              ) : (
                <FlaskConical className="w-3.5 h-3.5 text-amber-300 shrink-0" aria-hidden="true" />
              )}
              <span>
                {isProvisioningDemo
                  ? 'Preparando Empresa Ejemplo...'
                  : 'Explorar con Empresa Ejemplo (Demo)'}
              </span>
            </button>
          </div>
        </div>
      </section>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={(e) => void handleRestoreFile(e)}
        aria-label="Seleccionar archivo de respaldo de empresa"
        className="hidden"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <article className="grid grid-rows-[auto_1fr_auto] sm:grid-rows-subgrid sm:row-span-3 gap-2.5 sm:gap-3 bg-white border border-blue-200 rounded-2xl p-4 sm:p-5 shadow-2xs">
          <header className="space-y-2">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center">
              <Building2 className="w-5 h-5" aria-hidden="true" />
            </div>
            <h2 className="text-sm font-bold text-slate-900">1. Alta Rápida (RFC, 1 XML o Constancia SAT)</h2>
          </header>
          <p className="text-xs text-slate-600 leading-relaxed">
            Da de alta a tu empresa o cliente en 10 segundos. Puedes teclear su RFC, arrastrar
            cualquier factura XML CFDI 4.0 o subir el PDF de su Constancia SAT (CSF) para llenar
            automáticamente Razón Social, Régimen y Código Postal.
          </p>
          <footer className="pt-1.5">
            <button
              type="button"
              onClick={onOpenNewCompanyWizard}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Dar de Alta Mi Empresa</span>
            </button>
          </footer>
        </article>

        <article className="grid grid-rows-[auto_1fr_auto] sm:grid-rows-subgrid sm:row-span-3 gap-2.5 sm:gap-3 bg-gradient-to-b from-amber-50/60 to-white border border-amber-300/80 rounded-2xl p-4 sm:p-5 shadow-2xs">
          <header className="space-y-2">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-100 text-amber-800 border border-amber-300 flex items-center justify-center">
              <FlaskConical className="w-5 h-5" aria-hidden="true" />
            </div>
            <h2 className="text-sm font-bold text-slate-900">2. Explorar Empresa Ejemplo (1 Clic)</h2>
          </header>
          <p className="text-xs text-slate-600 leading-relaxed">
            ¿Entraste de noche o desde el celular sin facturas a la mano? Carga una empresa{' '}
            <strong>DEMO</strong> con pólizas automáticas, Balanza Anexo 24 y Cédula Día 17. Puedes
            eliminarla en 1 clic cuando gustes.
          </p>
          <footer className="pt-1.5">
            <button
              type="button"
              disabled={isProvisioningDemo}
              aria-busy={isProvisioningDemo}
              onClick={() => void handleProvisionDemo()}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold transition cursor-pointer disabled:opacity-50"
            >
              {isProvisioningDemo ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden="true" />
              ) : (
                <FlaskConical className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              )}
              <span>{isProvisioningDemo ? 'Creando Demo...' : 'Probar Empresa Ejemplo'}</span>
            </button>
          </footer>
        </article>

        <article className="grid grid-rows-[auto_1fr_auto] sm:grid-rows-subgrid sm:row-span-3 gap-2.5 sm:gap-3 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs">
          <header className="space-y-2">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
              <Upload className="w-5 h-5" aria-hidden="true" />
            </div>
            <h2 className="text-sm font-bold text-slate-900">3. Restaurar Respaldo de Empresa</h2>
          </header>
          <p className="text-xs text-slate-600 leading-relaxed">
            ¿Cuentas con un paquete de respaldo exportado previamente desde LibrePaq Pro?
            Impórtalo directamente dentro de tu Despacho conservando su catálogo de cuentas, pólizas y comprobantes CFDI.
          </p>
          <footer className="pt-1.5">
            <button
              type="button"
              disabled={isRestoring}
              aria-busy={isRestoring}
              onClick={() => fileInputRef.current?.click()}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-bold transition cursor-pointer disabled:opacity-50"
            >
              {isRestoring ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden="true" />
              ) : (
                <Upload className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              )}
              <span>{isRestoring ? 'Restaurando empresa...' : 'Cargar Respaldo de Empresa'}</span>
            </button>
          </footer>
        </article>
      </div>
    </div>
  );
}
