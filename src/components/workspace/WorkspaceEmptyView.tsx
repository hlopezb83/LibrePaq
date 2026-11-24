import { useEffect, useRef } from 'react';
import {
  Briefcase,
  Building2,
  Check,
  FlaskConical,
  Loader2,
  Pencil,
  Sparkles,
  Upload
} from 'lucide-react';
import type { Company } from '../../shared/types';
import type { UserWorkspace } from '../../context/CompanyContext';
import { Button, Input, StatusBadge, getButtonClasses } from '../ui';
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
  const renameBtnRef = useRef<HTMLButtonElement>(null);
  const wasEditingNameRef = useRef(false);
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

  useEffect(() => {
    if (isEditingName) {
      wasEditingNameRef.current = true;
    } else if (wasEditingNameRef.current) {
      wasEditingNameRef.current = false;
      requestAnimationFrame(() => renameBtnRef.current?.focus());
    }
  }, [isEditingName]);

  return (
    <div className="max-w-5xl mx-auto py-2 sm:py-5 lg:py-8 space-y-4 sm:space-y-6">
      {/* Cabecera Ejecutiva del Despacho Contable (Superficie Blanca Limpia) */}
      <section className="rounded-2xl bg-white border border-slate-300/90 shadow-2xs p-4 sm:p-6">
        <div className="space-y-2.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge
              tone="blue"
              icon={<Briefcase className="w-3.5 h-3.5" aria-hidden="true" />}
            >
              Despacho Contable Activo
            </StatusBadge>
            <StatusBadge tone="emerald" dot>
              0 Empresas Fiscales
            </StatusBadge>
          </div>

          {!isEditingName ? (
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-lg sm:text-2xl font-extrabold tracking-tight text-slate-900 break-words">
                {workspace?.name || 'Mi Despacho Contable'}
              </h1>
              <button
                ref={renameBtnRef}
                type="button"
                onClick={() => {
                  setDraftName(workspace?.name || '');
                  setIsEditingName(true);
                }}
                title="Personalizar nombre de tu Despacho o Cartera"
                className={getButtonClasses('secondary', 'sm')}
              >
                <Pencil className="w-3 h-3" aria-hidden="true" />
                <span>Renombrar</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleSaveName} className="flex flex-wrap items-center gap-2 max-w-md">
              <label htmlFor="workspace-name-input" className="visually-hidden">
                Nombre del Despacho Contable
              </label>
              <Input
                id="workspace-name-input"
                type="text"
                required
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    setIsEditingName(false);
                  }
                }}
                placeholder="Ej. Despacho Contable Díaz & Asociados"
                autoFocus
                className="flex-1 min-w-[180px] text-sm"
              />
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={isSavingName}
                disabled={!draftName.trim()}
                title={!draftName.trim() ? 'Escribe un nombre para tu Despacho Contable' : undefined}
                leftIcon={!isSavingName ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : undefined}
              >
                Guardar
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsEditingName(false)}
              >
                Cancelar
              </Button>
            </form>
          )}

          <p className="text-xs sm:text-sm text-slate-600 max-w-3xl leading-relaxed">
            Tu despacho en la nube está listo. Elige cómo iniciar abajo: da de alta tu primera empresa
            (RFC, XML o Constancia SAT), explora en 1 clic una{' '}
            <strong className="text-slate-900">Empresa Ejemplo</strong> o restaura un respaldo previo.
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        <article className="grid grid-rows-[auto_1fr_auto] lg:grid-rows-subgrid lg:row-span-3 gap-2.5 sm:gap-3 bg-white border border-slate-300/90 rounded-2xl p-4 sm:p-5 shadow-2xs">
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
            <Button
              variant="primary"
              className="w-full"
              leftIcon={<Sparkles className="w-3.5 h-3.5" aria-hidden="true" />}
              onClick={onOpenNewCompanyWizard}
            >
              Dar de Alta Mi Empresa
            </Button>
          </footer>
        </article>

        <article className="grid grid-rows-[auto_1fr_auto] lg:grid-rows-subgrid lg:row-span-3 gap-2.5 sm:gap-3 bg-white border border-slate-300/90 rounded-2xl p-4 sm:p-5 shadow-2xs">
          <header className="space-y-2">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center">
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
            <Button
              variant="secondary"
              className="w-full"
              loading={isProvisioningDemo}
              onClick={() => void handleProvisionDemo()}
              leftIcon={
                isProvisioningDemo ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <FlaskConical className="w-3.5 h-3.5 text-amber-700" aria-hidden="true" />
                )
              }
            >
              {isProvisioningDemo ? 'Creando Demo...' : 'Probar Empresa Ejemplo'}
            </Button>
          </footer>
        </article>

        <article className="grid grid-rows-[auto_1fr_auto] lg:grid-rows-subgrid lg:row-span-3 gap-2.5 sm:gap-3 bg-white border border-slate-300/90 rounded-2xl p-4 sm:p-5 shadow-2xs">
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
            <label
              htmlFor="workspace-restore-file"
              className={getButtonClasses(
                'secondary',
                'md',
                `w-full focus-within:outline-2 focus-within:outline-blue-700 ${
                  isRestoring ? 'opacity-50 pointer-events-none' : ''
                }`
              )}
            >
              <input
                ref={fileInputRef}
                id="workspace-restore-file"
                type="file"
                disabled={isRestoring}
                accept=".json,application/json"
                onChange={(e) => void handleRestoreFile(e)}
                className="sr-only"
              />
              {isRestoring ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden="true" />
              ) : (
                <Upload className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              )}
              <span>{isRestoring ? 'Restaurando empresa...' : 'Cargar Respaldo de Empresa'}</span>
            </label>
          </footer>
        </article>
      </div>
    </div>
  );
}
