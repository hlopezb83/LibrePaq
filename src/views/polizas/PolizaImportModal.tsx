import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Lock, Upload } from 'lucide-react';
import { AlertBanner, Button, EmptyState, ModalShell, StatusBadge } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { useDialogLightDismiss } from '../../hooks/useDialogLightDismiss';
import { apiClient, invalidateAccountingQueries } from '../../lib/api-client';
import { downloadCsvFile, formatCurrency } from '../../lib/formatters';
import type { Account } from '../../shared/types';
import { buildPolizaImportPreview, type PolizaImportPreview } from './polizaImportParser';

interface PolizaImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  currentYear: number;
  affectableAccounts: Account[];
  isReadOnlyClient: boolean;
}

export function PolizaImportModal({
  isOpen,
  onClose,
  companyId,
  currentYear,
  affectableAccounts,
  isReadOnlyClient
}: PolizaImportModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useDialogLightDismiss(dialogRef, onClose, { isOpen });
  const toast = useToast();
  const queryClient = useQueryClient();

  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<PolizaImportPreview | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const { data: lockChecks = [] } = useQuery({
    queryKey: ['period-locks-import', companyId, currentYear],
    queryFn: () =>
      Promise.all(
        Array.from({ length: 13 }, (_, idx) =>
          apiClient.getPeriodLock(companyId, currentYear, idx + 1).catch(() => null)
        )
      ),
    enabled: isOpen && Boolean(companyId)
  });

  const lockedPeriods = useMemo(() => {
    const set = new Set<string>();
    for (const row of lockChecks) {
      if (row?.isLocked) set.add(`${row.ejercicio}:${row.periodo}`);
    }
    return set;
  }, [lockChecks]);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.xlsx')) {
      const buffer = await file.arrayBuffer();
      setPreview(buildPolizaImportPreview({ fileName: file.name, arrayBuffer: buffer, affectableAccounts, lockedPeriods }));
    } else {
      const buffer = await file.arrayBuffer();
      let text = new TextDecoder('utf-8').decode(buffer);
      if (text.includes('\uFFFD')) text = new TextDecoder('windows-1252').decode(buffer);
      setPreview(buildPolizaImportPreview({ fileName: file.name, textContent: text, affectableAccounts, lockedPeriods }));
    }
    e.target.value = '';
  };

  const handleImportValid = async () => {
    if (!preview || preview.validCount === 0 || isImporting || isReadOnlyClient) return;
    setIsImporting(true);
    let createdCount = 0;
    const failedMessages: string[] = [];
    try {
      for (const pol of preview.polizas.filter((p) => p.canImport)) {
        try {
          await apiClient.createPoliza({
            companyId,
            tipo: pol.tipo,
            fecha: pol.fecha,
            periodo: pol.periodo,
            concepto: pol.concepto,
            origin: 'MANUAL',
            movements: pol.movements.map((m) => ({
              accountId: m.accountId,
              referencia: m.referencia,
              concepto: m.concepto,
              cargo: m.cargo,
              abono: m.abono,
              cfdiUuid: m.cfdiUuid
            }))
          });
          createdCount += 1;
        } catch (err) {
          failedMessages.push(`${pol.fecha} ${pol.concepto}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      invalidateAccountingQueries(queryClient, ['polizas', 'accounts', 'reports', 'dashboard', 'auxiliares-diario']);
      if (createdCount > 0) {
        toast.success(`${createdCount} póliza(s) importada(s) correctamente`);
      }
      if (failedMessages.length > 0) {
        toast.error('Algunas pólizas no se pudieron importar', failedMessages[0]!);
      } else if (createdCount > 0) {
        setPreview(null);
        setFileName('');
        onClose();
      }
    } finally {
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <ModalShell
      dialogRef={dialogRef}
      isOpen={isOpen}
      onClose={onClose}
      usePortal
      maxWidth="5xl"
      titleId="poliza-import-modal-title"
      closeLabel="Cerrar importador de pólizas"
      icon={<Upload className="w-5 h-5" aria-hidden="true" />}
      iconTone="blue"
      title="Importador de Pólizas (CSV / Excel .XLSX / CONTPAQi TXT)"
      subtitle="Vista previa con validación de partida doble, catálogo afectable y candados de periodo."
      bodyClassName="space-y-4 scrollable-panel text-xs"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isImporting}>Cancelar</Button>
          <Button
            variant="primary"
            loading={isImporting}
            disabled={isReadOnlyClient || isImporting || !preview || preview.validCount === 0}
            onClick={() => void handleImportValid()}
          >
            {isImporting ? 'Importando...' : `Importar ${preview?.validCount ?? 0} Póliza(s) Válida(s)`}
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50/70">
        <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-semibold cursor-pointer">
          <Upload className="w-4 h-4" aria-hidden="true" />
          <span>{fileName ? `Archivo: ${fileName}` : 'Seleccionar CSV / XLSX / CONTPAQi TXT'}</span>
          <input type="file" accept=".csv,.xlsx,.txt" onChange={(e) => void handleFileChange(e)} className="sr-only" />
        </label>
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" />}
          onClick={() =>
            downloadCsvFile(
              'plantilla_importar_polizas.csv',
              ['Fecha', 'Tipo', 'Folio', 'Concepto Poliza', 'Cuenta', 'Referencia', 'Concepto Partida', 'Cargo', 'Abono', 'UUID'],
              [
                [`${currentYear}-01-15`, 'EGRESO', '1', 'Pago servicios administrativos', affectableAccounts[0]?.code || '601-01-003', 'FAC-101', 'Honorarios', 1000, 0, ''],
                [`${currentYear}-01-15`, 'EGRESO', '1', 'Pago servicios administrativos', affectableAccounts[1]?.code || '102-01-001', 'FAC-101', 'Salida banco', 0, 1000, '']
              ]
            )
          }
        >
          Descargar Plantilla CSV
        </Button>
      </div>

      {preview && preview.globalErrors.length > 0 && (
        <AlertBanner tone="danger">{preview.globalErrors.join(' · ')}</AlertBanner>
      )}

      {preview && (
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone="emerald">Válidas: {preview.validCount}</StatusBadge>
          {preview.lockedCount > 0 && <StatusBadge tone="red">Periodo bloqueado: {preview.lockedCount}</StatusBadge>}
          {preview.unbalancedCount > 0 && <StatusBadge tone="amber">Descuadradas: {preview.unbalancedCount}</StatusBadge>}
          {preview.accountErrorCount > 0 && <StatusBadge tone="red">Cuenta inválida: {preview.accountErrorCount}</StatusBadge>}
        </div>
      )}

      {!preview ? (
        <EmptyState
          variant="dashed"
          tone="slate"
          icon={<Upload className="w-5 h-5" aria-hidden="true" />}
          title="Selecciona un archivo para previsualizar"
          description="Soporta CSV, Excel (.xlsx) y layout CONTPAQi TXT (registros P/M)."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                <th scope="col" className="py-2 px-3">Fecha</th>
                <th scope="col" className="py-2 px-3">Tipo</th>
                <th scope="col" className="py-2 px-3">Concepto</th>
                <th scope="col" className="py-2 px-3 text-right">Partidas</th>
                <th scope="col" className="py-2 px-3 text-right">Cargos</th>
                <th scope="col" className="py-2 px-3 text-right">Abonos</th>
                <th scope="col" className="py-2 px-3">Validación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {preview.polizas.map((pol) => (
                <tr key={pol.key} className={pol.canImport ? '' : 'bg-red-50/40'}>
                  <td className="py-2 px-3 font-mono whitespace-nowrap">{pol.fecha}</td>
                  <td className="py-2 px-3"><StatusBadge tone="slate" shape="tag">{pol.tipo}</StatusBadge></td>
                  <td className="py-2 px-3 max-w-xs truncate">{pol.concepto}</td>
                  <td className="py-2 px-3 text-right font-mono">{pol.movements.length}</td>
                  <td className="py-2 px-3 text-right font-mono">{formatCurrency(pol.totalCargos)}</td>
                  <td className="py-2 px-3 text-right font-mono">{formatCurrency(pol.totalAbonos)}</td>
                  <td className="py-2 px-3">
                    {pol.canImport ? (
                      <StatusBadge tone="emerald" icon={<CheckCircle2 className="w-3 h-3" aria-hidden="true" />}>Lista</StatusBadge>
                    ) : (
                      <StatusBadge
                        tone="red"
                        icon={pol.isPeriodLocked ? <Lock className="w-3 h-3" aria-hidden="true" /> : <AlertTriangle className="w-3 h-3" aria-hidden="true" />}
                      >
                        {pol.errors.join(' · ')}
                      </StatusBadge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ModalShell>
  );
}
