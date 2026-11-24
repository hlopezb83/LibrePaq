import React from 'react';
import { ArrowRightLeft, Download, FolderTree, Lock, Plus, Upload } from 'lucide-react';
import { Button, PageHeader, getButtonClasses } from '../../components/ui';

export interface CatalogoHeaderBarProps {
  csvImportRef: React.RefObject<HTMLInputElement | null>;
  isPeriodLocked?: boolean;
  isReadOnlyClient?: boolean;
  onImportCsv: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExportCsv: () => void;
  onOpenReclassify?: () => void;
  onOpenCreateModal: () => void;
}

export function CatalogoHeaderBar({
  csvImportRef,
  isPeriodLocked = false,
  isReadOnlyClient = false,
  onImportCsv,
  onExportCsv,
  onOpenReclassify,
  onOpenCreateModal
}: CatalogoHeaderBarProps) {
  const isWriteBlocked = isPeriodLocked || isReadOnlyClient;
  const blockedReason = isReadOnlyClient
    ? 'Tu rol Cliente (Solo lectura) no permite modificar el catálogo'
    : 'Periodo fiscal bloqueado ante el SAT';

  return (
    <PageHeader
      title="Catálogo de Cuentas SAT (Anexo 24) y Libro Mayor"
      subtitle={
        <>
          Árbol jerárquico plegable: haz clic en <strong>▼/▶</strong> para contraer nodos o en cualquier cuenta para abrir su{' '}
          <strong>Libro Mayor</strong>
        </>
      }
      icon={<FolderTree className="w-5 h-5" aria-hidden="true" />}
      iconTone="blue"
      actions={
        <div className="flex flex-wrap items-center gap-2 no-print">
          <label
            htmlFor="catalogo-import-csv"
            title={
              isWriteBlocked
                ? blockedReason
                : 'Importar catálogo de cuentas desde archivo CSV, TXT CONTPAQi o XML Anexo 24'
            }
            className={getButtonClasses(
              'secondary',
              'md',
              `focus-within:ring-2 focus-within:ring-blue-600 focus-within:ring-offset-1 ${
                isWriteBlocked ? 'opacity-50 pointer-events-none cursor-not-allowed' : ''
              }`
            )}
          >
            <input
              id="catalogo-import-csv"
              ref={csvImportRef}
              type="file"
              accept=".csv,.txt,.xml,text/csv,text/xml,application/xml"
              disabled={isWriteBlocked}
              onChange={onImportCsv}
              className="visually-hidden"
            />
            <Upload className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
            <span>Importar CSV / CONTPAQi / XML</span>
          </label>

          {onOpenReclassify && (
            <Button
              variant="secondary"
              size="md"
              disabled={isWriteBlocked}
              onClick={onOpenReclassify}
              title={
                isWriteBlocked
                  ? blockedReason
                  : 'Reclasificar masivamente movimientos entre cuentas afectables'
              }
              leftIcon={<ArrowRightLeft className="w-3.5 h-3.5 text-amber-700" aria-hidden="true" />}
            >
              Reclasificar
            </Button>
          )}

          <Button
            variant="export"
            size="md"
            onClick={onExportCsv}
            leftIcon={<Download className="w-3.5 h-3.5" aria-hidden="true" />}
          >
            Exportar Excel (.CSV)
          </Button>

          <Button
            variant="primary"
            size="md"
            disabled={isWriteBlocked}
            onClick={onOpenCreateModal}
            title={
              isWriteBlocked
                ? blockedReason
                : 'Dar de alta nueva cuenta contable (Alt+N o Insert)'
            }
            leftIcon={
              isWriteBlocked ? (
                <Lock className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Plus className="w-4 h-4 text-blue-100" aria-hidden="true" />
              )
            }
          >
            <span>Nueva Cuenta</span>
            {!isWriteBlocked && (
              <kbd className="hidden sm:inline font-mono text-[9px] bg-blue-800 px-1 py-0.5 rounded border border-blue-400/50 text-blue-100">
                Alt+N
              </kbd>
            )}
          </Button>
        </div>
      }
    />
  );
}
