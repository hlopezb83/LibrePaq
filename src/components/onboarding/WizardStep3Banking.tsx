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
  initialBankBalance: number;
  setInitialBankBalance: (balance: number) => void;
  createOpeningEntry: boolean;
  setCreateOpeningEntry: (create: boolean) => void;
}

export function WizardStep3Banking({
  initialBankName,
  setInitialBankName,
  initialBankAccount,
  setInitialBankAccount,
  initialBankBalance,
  setInitialBankBalance,
  createOpeningEntry,
  setCreateOpeningEntry
}: WizardStep3BankingProps) {
  return (
    <div className="space-y-4">
      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
        <Landmark className="w-4 h-4 text-blue-700 shrink-0" />
        <span>
          Configura la cuenta de cheques o tesorería con la que la empresa inicia operaciones para la conciliación bancaria.
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div>
          <label htmlFor="wizard-bank-name" className="block text-xs font-bold text-slate-700 mb-1">
            Institución Bancaria Principal
          </label>
          <select
            id="wizard-bank-name"
            value={initialBankName}
            onChange={(e) => setInitialBankName(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:border-blue-700 cursor-pointer"
          >
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
            type="text"
            value={initialBankAccount}
            onChange={(e) => setInitialBankAccount(e.target.value)}
            placeholder="Ej. 01948271"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:border-blue-700"
          />
        </div>
      </div>

      <div>
        <label htmlFor="wizard-bank-balance" className="block text-xs font-bold text-slate-700 mb-1">
          Saldo Inicial en Bancos (MXN)
        </label>
        <div className="relative">
          <span className="absolute left-3.5 top-2.5 text-sm font-bold text-slate-400">$</span>
          <input
            id="wizard-bank-balance"
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            value={initialBankBalance}
            onChange={(e) => setInitialBankBalance(Math.max(0, Number(e.target.value)))}
            className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono font-bold text-slate-900 focus:border-blue-700"
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
        {createOpeningEntry && initialBankBalance > 0 && (
          <p className="text-[11px] text-blue-800 pl-6">
            Se creará una póliza balanceada al día 1 del mes con:
            <br />• <strong>Cargo:</strong> 102-01-001 ({initialBankName}) por {formatCurrency(initialBankBalance)}
            <br />• <strong>Abono:</strong> 301-01-001 (Capital Social Fijo) por {formatCurrency(initialBankBalance)}
          </p>
        )}
      </div>
    </div>
  );
}
