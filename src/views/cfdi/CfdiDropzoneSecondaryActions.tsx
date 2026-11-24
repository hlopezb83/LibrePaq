import { useState } from 'react';
import { ChevronDown, FileArchive, FilePlus2, FileSpreadsheet } from 'lucide-react';
import { Button } from '../../components/ui';

interface CfdiDropzoneSecondaryActionsProps {
  isReadOnlyClient: boolean;
  isExportingZip: boolean;
  hasVisibleCfdis: boolean;
  onOpenSimulator: () => void;
  onExportCsv: () => void;
  onExportZip?: () => void;
}

export function CfdiDropzoneSecondaryActions({
  isReadOnlyClient,
  isExportingZip,
  hasVisibleCfdis,
  onOpenSimulator,
  onExportCsv,
  onExportZip
}: CfdiDropzoneSecondaryActionsProps) {
  const [showSecondaryMenu, setShowSecondaryMenu] = useState(false);

  return (
    <>
      <div className="hidden lg:inline-flex items-center gap-2">
        {!isReadOnlyClient && (
          <Button
            variant="secondary"
            size="md"
            onClick={onOpenSimulator}
            title="Registrar comprobante o retención manual (Alt+S)"
            leftIcon={<FilePlus2 className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />}
          >
            <span>Captura Manual</span>
            <kbd className="font-mono text-[9px] bg-slate-100 px-1 py-0.5 rounded border border-slate-300 text-slate-600">
              Alt+S
            </kbd>
          </Button>
        )}
        <Button
          variant="export"
          size="md"
          onClick={onExportCsv}
          title="Exportar comprobantes visibles a formato Excel / CSV"
          leftIcon={<FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" />}
        >
          <span>Exportar Excel</span>
        </Button>
        {onExportZip && (
          <Button
            variant="export-outline"
            size="md"
            loading={isExportingZip}
            disabled={isExportingZip || !hasVisibleCfdis}
            onClick={onExportZip}
            title={
              hasVisibleCfdis
                ? 'Descargar los XML visibles en un archivo .ZIP'
                : 'No hay comprobantes visibles para empaquetar'
            }
            leftIcon={<FileArchive className="w-3.5 h-3.5" aria-hidden="true" />}
          >
            <span>{isExportingZip ? 'Empaquetando...' : 'Descargar XML (.zip)'}</span>
          </Button>
        )}
      </div>

      <div className="relative lg:hidden">
        <Button
          variant="secondary"
          size="md"
          aria-expanded={showSecondaryMenu}
          aria-haspopup="menu"
          onClick={() => setShowSecondaryMenu((v) => !v)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setShowSecondaryMenu(false);
          }}
          rightIcon={<ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />}
        >
          <span>Más acciones</span>
        </Button>
        {showSecondaryMenu && (
          <div
            role="menu"
            onKeyDown={(e) => {
              if (e.key === 'Escape') setShowSecondaryMenu(false);
            }}
            className="absolute right-0 mt-1.5 w-56 max-w-[calc(100vw-2rem)] rounded-xl bg-white border border-slate-200 shadow-lg p-1.5 z-30 space-y-1 text-xs"
          >
            {!isReadOnlyClient && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setShowSecondaryMenu(false);
                  onOpenSimulator();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <FilePlus2 className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
                <span>Captura Manual (Alt+S)</span>
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setShowSecondaryMenu(false);
                onExportCsv();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left font-semibold text-emerald-800 hover:bg-emerald-50 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
              <span>Exportar Excel</span>
            </button>
            {onExportZip && (
              <button
                type="button"
                role="menuitem"
                disabled={isExportingZip || !hasVisibleCfdis}
                onClick={() => {
                  setShowSecondaryMenu(false);
                  onExportZip();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
              >
                <FileArchive className="w-3.5 h-3.5 text-slate-700" aria-hidden="true" />
                <span>{isExportingZip ? 'Empaquetando...' : 'Descargar XML (.zip)'}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
