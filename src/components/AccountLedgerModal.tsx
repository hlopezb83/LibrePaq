import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { BookOpen, Download, Printer, Search, X } from 'lucide-react';
import { useCompany } from '../context/CompanyContext';
import { apiClient } from '../lib/api-client';
import { downloadCsvFile, formatCurrency } from '../lib/formatters';
import { exportAccountLedgerXlsx } from '../lib/excel-export';
import { MESES_SAT } from '../shared/sat-catalog';
import { AccountLedgerTable } from './account-ledger/AccountLedgerTable';
import { useDialogLightDismiss } from '../hooks/useDialogLightDismiss';

interface AccountLedgerModalProps {
  companyId: string;
  accountId: string | null;
  onClose: () => void;
}

export function AccountLedgerModal({
  companyId,
  accountId,
  onClose
}: AccountLedgerModalProps) {
  const { activeCompany } = useCompany();
  const navigate = useNavigate();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const currentYear = activeCompany?.currentYear;
  const currentPeriod = activeCompany?.currentPeriod;
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  useDialogLightDismiss(dialogRef, onClose);

  const prevCompanyIdRef = useRef(companyId);
  useEffect(() => {
    if (prevCompanyIdRef.current !== companyId) {
      prevCompanyIdRef.current = companyId;
      if (accountId) onClose();
    }
  }, [companyId, accountId, onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (accountId) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [accountId]);

  const { data, isLoading } = useQuery({
    queryKey: ['account-ledger', companyId, accountId, currentYear, currentPeriod],
    queryFn: () =>
      apiClient.getAccountLedger(companyId, accountId ?? '', currentYear, currentPeriod),
    enabled: Boolean(accountId)
  });

  const mesNombre = data
    ? MESES_SAT.find((m) => m.periodo === data.periodo)?.nombre || 'Octubre'
    : '';

  const filteredEntries = useMemo(() => {
    if (!data) return [];
    if (!ledgerSearch.trim()) return data.entries;
    const q = ledgerSearch.toLowerCase().trim();
    return data.entries.filter(
      (e) =>
        e.concepto.toLowerCase().includes(q) ||
        e.referencia.toLowerCase().includes(q) ||
        String(e.folioPoliza).includes(q) ||
        e.tipoPoliza.toLowerCase().includes(q) ||
        (e.cfdiUuid && e.cfdiUuid.toLowerCase().includes(q))
    );
  }, [data, ledgerSearch]);

  const handleGoToPoliza = (folio: number) => {
    onClose();
    void navigate({
      to: '/polizas',
      search: { search: String(folio) } as unknown as Record<string, string>
    });
  };

  const handleExportXlsx = async () => {
    if (!data || isExporting) return;
    try {
      setIsExporting(true);
      await exportAccountLedgerXlsx(data, mesNombre, activeCompany?.rfc || 'XAXX010101000');
    } catch {
      handleExportCsv();
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCsv = () => {
    if (!data) return;
    const headers = [
      'Fecha',
      'Póliza',
      'Código Cuenta',
      'Nombre Cuenta',
      'Referencia',
      'Concepto',
      'UUID CFDI',
      'Cargo (Debe)',
      'Abono (Haber)',
      'Saldo Progresivo'
    ];
    const rows: Array<Array<string | number>> = [
      [
        `${data.ejercicio}-${String(data.periodo).padStart(2, '0')}-01`,
        'SALDO INICIAL',
        data.account.code,
        data.account.name,
        'APERTURA',
        `Saldo Inicial Acumulado al inicio de ${mesNombre} ${data.ejercicio}`,
        '',
        0,
        0,
        data.initialBalance
      ],
      ...data.entries.map((e) => [
        e.fecha,
        `${e.tipoPoliza} #${e.folioPoliza}`,
        e.accountCode,
        e.accountName,
        e.referencia,
        e.concepto,
        e.cfdiUuid || '',
        e.cargo,
        e.abono,
        e.runningBalance
      ])
    ];
    downloadCsvFile(
      `Auxiliar_${data.account.code}_${data.ejercicio}_P${String(data.periodo).padStart(2, '0')}.csv`,
      headers,
      rows
    );
  };

  return createPortal(
    <dialog
      ref={dialogRef}
      closedby="any"
      onClose={onClose}
      aria-labelledby="ledger-modal-title"
      className="rounded-2xl shadow-2xl border border-slate-300 bg-white w-full max-w-5xl overflow-hidden backdrop:bg-slate-900/60"
    >
      <div className="p-4 sm:p-5 max-h-[86dvh] scrollable-panel space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="ledger-modal-title" className="text-base font-bold text-slate-900">
                Tarjeta Auxiliar de Movimientos (Libro Mayor)
              </h2>
              {data && (
                <p className="text-xs text-slate-600">
                  <span className="font-mono font-bold text-blue-800 mr-1.5">
                    {data.account.code}
                  </span>
                  <strong className="text-slate-900">{data.account.name}</strong> • SAT:{' '}
                  <span className="font-mono">{data.account.satGroupCode}</span> • Periodo:{' '}
                  {mesNombre} {data.ejercicio}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 no-print">
            {data && (
              <>
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={handleExportXlsx}
                  title="Descargar libro mayor en formato nativo Excel (.xlsx)"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  {isExporting ? 'Generando...' : 'Excel (.XLSX)'}
                </button>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  title="Descargar datos en texto plano (.csv)"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition cursor-pointer"
                >
                  CSV
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" aria-hidden="true" />
                  Imprimir
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar auxiliar de cuenta"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {isLoading || !data ? (
          <div className="p-10 text-center text-xs text-slate-500">
            Consultando movimientos auxiliares y calculando saldo progresivo...
          </div>
        ) : (
          <>
            {/* Resumen del Auxiliar con Arrastre de Saldos */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[11px] font-bold text-slate-500 uppercase">
                  Saldo Inicial ({mesNombre})
                </div>
                <div className="mt-1 text-base font-bold font-mono text-slate-900">
                  {formatCurrency(data.initialBalance)}
                </div>
                <div className="text-[10px] text-slate-500">
                  Incluye arrastre de meses previos
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[11px] font-bold text-slate-500 uppercase">
                  (+) Cargos del Periodo
                </div>
                <div className="mt-1 text-base font-bold font-mono text-slate-900">
                  {formatCurrency(data.totalCharges)}
                </div>
                <div className="text-[10px] text-slate-500">Movimientos en el Debe</div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[11px] font-bold text-slate-500 uppercase">
                  (-) Abonos del Periodo
                </div>
                <div className="mt-1 text-base font-bold font-mono text-slate-900">
                  {formatCurrency(data.totalCredits)}
                </div>
                <div className="text-[10px] text-slate-500">Movimientos en el Haber</div>
              </div>

              <div className="p-3.5 rounded-xl bg-blue-50/80 border border-blue-200">
                <div className="text-[11px] font-bold text-blue-900 uppercase">
                  (=) Saldo Final Acumulado
                </div>
                <div className="mt-1 text-base font-bold font-mono text-blue-950">
                  {formatCurrency(data.finalBalance)}
                </div>
                <div className="text-[10px] text-blue-800">
                  Naturaleza {data.account.nature}
                </div>
              </div>
            </div>

            {/* Barra de Filtro en Vivo dentro del Auxiliar */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs no-print">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search
                  className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={ledgerSearch}
                  onChange={(e) => setLedgerSearch(e.target.value)}
                  aria-label="Filtrar por concepto, referencia o UUID en el auxiliar"
                  placeholder="Filtrar por concepto, referencia o UUID..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>
              <div className="text-slate-500 text-[11px] font-medium">
                {ledgerSearch.trim() ? (
                  <span>
                    Mostrando <strong>{filteredEntries.length}</strong> de {data.entries.length} movimientos
                  </span>
                ) : (
                  <span>
                    Total de movimientos: <strong>{data.entries.length}</strong>
                  </span>
                )}
              </div>
            </div>

            {/* Tabla Cronológica de Movimientos */}
            <AccountLedgerTable
              data={data}
              mesNombre={mesNombre}
              filteredEntries={filteredEntries}
              ledgerSearch={ledgerSearch}
              onGoToPoliza={handleGoToPoliza}
            />
          </>
        )}
      </div>
    </dialog>,
    document.body
  );
}
