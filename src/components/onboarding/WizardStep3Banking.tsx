import { Landmark } from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';

export const COMMON_BANKS = [
  'BBVA México',
  'Banorte',
  'Santander México',
  'Citibanamex',
  'HSBC México',
  'Scotiabank',
  'Banco del Bajío',
  'Inbursa',
  'Hey Banco / Banregio',
  'Otro Banco Nacional'
];

interface WizardStep3BankingProps {
  initialBankName: string;
  setInitialBankName: (name: string) => void;
  initialBankAccount: string;
  setInitialBankAccount: (account: string) => void;
  initialBankBalanceDraft: string;
  setInitialBankBalanceDraft: (draft: string) => void;
  initialBankBalance: number;
  createOpeningEntry: boolean;
  setCreateOpeningEntry: (create: boolean) => void;
}

export function WizardStep3Banking({
  initialBankName,
  setInitialBankName,
  initialBankAccount,
  setInitialBankAccount,
  initialBankBalanceDraft,
  setInitialBankBalanceDraft,
  initialBankBalance,
  createOpeningEntry,
  setCreateOpeningEntry
}: WizardStep3BankingProps) {
  const isBankingOmitted = !initialBankName;

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Landmark className="w-4 h-4 text-blue-700 shrink-0" aria-hidden="true" />
          <span>
            Configura opcionalmente tu cuenta bancaria inicial para conciliación o déjalo pendiente para después.
          </span>
        </div>
        <button
          type="button"
          aria-pressed={isBankingOmitted}
          onClick={() => {
            if (isBankingOmitted) {
              setInitialBankName(COMMON_BANKS[0] ?? 'BBVA México');
            } else {
              setInitialBankName('');
              setInitialBankAccount('');
              setInitialBankBalanceDraft('');
              setCreateOpeningEntry(false);
            }
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer shrink-0 ${
            isBankingOmitted
              ? 'bg-amber-100 text-amber-900 border-amber-300'
              : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
          }`}
        >
          {isBankingOmitted ? 'Omitir por ahora (Activo)' : 'Omitir por ahora'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div>
          <label htmlFor="wizard-bank-name" className="block text-xs font-bold text-slate-700 mb-1">
            Institución Bancaria Principal
          </label>
          <select
            id="wizard-bank-name"
            value={initialBankName}
            onChange={(e) => {
              const next = e.target.value;
              setInitialBankName(next);
              if (!next) {
                setInitialBankAccount('');
                setInitialBankBalanceDraft('');
                setCreateOpeningEntry(false);
              }
            }}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:border-blue-700 cursor-pointer"
          >
            <option value="">Omitir por ahora (configurar después)</option>
            {COMMON_BANKS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="wizard-bank-account" className="block text-xs font-bold text-slate-700 mb-1">
            Número de Cuenta o CLABE
          </label>
          <input
            id="wizard-bank-account"
            name="bank_account_number_no_autofill"
            type="text"
            autoComplete="off"
            disabled={isBankingOmitted}
            value={initialBankAccount}
            onChange={(e) => setInitialBankAccount(e.target.value)}
            placeholder={
              isBankingOmitted
                ? 'Selecciona un banco primero'
                : 'Ej. últimos 4 dígitos o cuenta (opcional)'
            }
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:border-blue-700 disabled:bg-slate-100 disabled:text-slate-500"
          />
        </div>
      </div>

      {!isBankingOmitted ? (
        <>
          <div>
            <label htmlFor="wizard-bank-balance" className="block text-xs font-bold text-slate-700 mb-1">
              Saldo Inicial en Bancos (MXN)
            </label>
            <div className="relative">
              <span aria-hidden="true" className="absolute left-3.5 top-2.5 text-sm font-bold text-slate-600">
                $
              </span>
              <input
                id="wizard-bank-balance"
                type="number"
                inputMode="decimal"
                autoComplete="off"
                step="any"
                min="0"
                placeholder="0.00"
                value={initialBankBalanceDraft}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || /^\d*\.?\d*$/.test(val)) {
                    setInitialBankBalanceDraft(val);
                  }
                }}
                className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono font-bold text-slate-900 placeholder:text-slate-500 focus:border-blue-700"
              />
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 space-y-2">
            <label htmlFor="wizard-create-opening-entry" className="flex items-center gap-2.5 cursor-pointer">
              <input
                id="wizard-create-opening-entry"
                type="checkbox"
                checked={createOpeningEntry}
                onChange={(e) => setCreateOpeningEntry(e.target.checked)}
                className="w-4 h-4 rounded text-blue-700 focus:ring-0"
              />
              <span className="text-xs font-bold text-blue-950">
                Generar Asiento de Apertura Automático (Póliza de Diario #1)
              </span>
            </label>
            {createOpeningEntry && initialBankBalance > 0 ? (
              <p className="text-[11px] text-blue-800 pl-6">
                Se creará una póliza balanceada al día 1 del mes con:
                <br />• <strong>Cargo:</strong> 102-01-001 ({initialBankName}) por {formatCurrency(initialBankBalance)}
                <br />• <strong>Abono:</strong> 301-01-001 (Capital Social Fijo) por {formatCurrency(initialBankBalance)}
              </p>
            ) : createOpeningEntry && initialBankBalance <= 0 ? (
              <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 ml-6">
                Captura un saldo inicial mayor a $0.00 para generar la Póliza de Apertura; sin saldo capturado se omitirá automáticamente.
              </p>
            ) : null}
          </div>
        </>
      ) : (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
          Omitiste la cuenta bancaria inicial. Podrás registrar cuentas bancarias y conciliar estados de cuenta en cualquier momento desde <strong>Bancos, DIOT y Fiscal</strong>.
        </div>
      )}
    </div>
  );
}
