import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Users
} from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { validateRfcModulo11 } from '../../shared/accounting-engine';
import { checkRfc69BStatus } from '../../shared/sat-69b';
import type { AccountWithBalance, Efos69BStatus } from '../../shared/types';
import { Importar69BModal } from './Importar69BModal';

export interface PadronProveedoresTabProps {
  companyId: string;
  accounts: AccountWithBalance[];
  onFeedback: (msg: string) => void;
}

export function PadronProveedoresTab({
  companyId,
  accounts,
  onFeedback
}: PadronProveedoresTabProps) {
  const queryClient = useQueryClient();
  const affectableAccounts = accounts.filter((a) => a.isAffectable);

  const { data: thirdParties = [], isLoading: loadingTp } = useQuery({
    queryKey: ['third-parties', companyId],
    queryFn: () => apiClient.getThirdParties(companyId)
  });

  const [tpRfc, setTpRfc] = useState('');
  const [tpNombre, setTpNombre] = useState('');
  const [tpOperacion, setTpOperacion] = useState<'03' | '06' | '85'>('03');
  const [tpExpenseAcc, setTpExpenseAcc] = useState('601-01-002');
  const [tpIvaRate, setTpIvaRate] = useState<16 | 8 | 0>(16);
  const [tpEfos, setTpEfos] = useState<Efos69BStatus>('LIMPIO');
  const [is69BModalOpen, setIs69BModalOpen] = useState(false);

  const tpRfcRes = useMemo(() => {
    if (!tpRfc.trim()) return null;
    return validateRfcModulo11(tpRfc);
  }, [tpRfc]);

  const handleRfcChange = (val: string) => {
    const clean = val.toUpperCase().replace(/[^A-Z0-9&Ñ]/g, '');
    setTpRfc(clean);
    if (clean.length >= 12) {
      const check = checkRfc69BStatus(clean);
      if (check.isEfos || check.status !== 'LIMPIO') {
        setTpEfos(check.status);
      }
    }
  };

  const saveThirdPartyMutation = useMutation({
    mutationFn: () =>
      apiClient.saveThirdParty({
        companyId,
        rfc: tpRfc,
        nombre: tpNombre,
        rol: 'PROVEEDOR',
        cuentaOperacionCode: tpExpenseAcc,
        cuentaContrapartidaCode: '201-01-001',
        tipoTerceroDiot: '04',
        tipoOperacionDiot: tpOperacion,
        tasaIvaDefault: tpIvaRate,
        estatus69B: tpEfos
      }),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['third-parties', companyId] });
      setTpRfc('');
      setTpNombre('');
      onFeedback(
        `RFC ${saved.rfc} guardado en el Padrón Fiscal con cuenta contable predeterminada ${saved.cuentaOperacionCode}.`
      );
    }
  });

  return (
    <div className="space-y-5">
      <div className="bg-white p-5 rounded-2xl border border-slate-300/90 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-blue-700" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Padrón Fiscal por RFC, Cuentas Contables Predeterminadas y Lista 69-B SAT
              </h2>
              <p className="text-xs text-slate-500">
                Asigna la cuenta de gasto/ingreso por proveedor o cliente para que el Contabilizador Automático de CFDIs use cuentas específicas
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIs69BModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 shadow-2xs cursor-pointer shrink-0"
          >
            <ShieldAlert className="w-4 h-4 text-red-600" aria-hidden="true" />
            Importar Lista 69-B del SAT (.CSV)
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveThirdPartyMutation.mutate();
          }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200"
        >
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="tp-rfc" className="block text-[11px] font-bold text-slate-700">
                RFC Proveedor / Cliente *
              </label>
              {tpRfcRes && tpRfcRes.isValidFormat && (
                <div className="flex items-center gap-1">
                  {tpRfcRes.isValidCheckDigit ? (
                    <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-0.5">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> M11 OK
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-800 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-600" /> M11: {tpRfcRes.expectedCheckDigit}
                      {tpRfcRes.expectedRfc && (
                        <button
                          type="button"
                          onClick={() => handleRfcChange(tpRfcRes.expectedRfc!)}
                          className="underline text-blue-700 hover:text-blue-900 cursor-pointer font-bold"
                        >
                          Corregir
                        </button>
                      )}
                    </span>
                  )}
                </div>
              )}
            </div>
            <input
              id="tp-rfc"
              type="text"
              required
              minLength={12}
              maxLength={13}
              value={tpRfc}
              onChange={(e) => handleRfcChange(e.target.value)}
              placeholder="TLE180920K71"
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-mono uppercase bg-white"
            />
          </div>

          <div className="lg:col-span-2">
            <label htmlFor="tp-nombre" className="block text-[11px] font-bold text-slate-700 mb-1">
              Razón Social *
            </label>
            <input
              id="tp-nombre"
              type="text"
              required
              value={tpNombre}
              onChange={(e) => setTpNombre(e.target.value)}
              placeholder="Transportes y Logística Empresarial SA de CV"
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
            />
          </div>

          <div>
            <label htmlFor="tp-expense-acc" className="block text-[11px] font-bold text-slate-700 mb-1">
              Cuenta Gasto / Operación
            </label>
            <select
              id="tp-expense-acc"
              value={tpExpenseAcc}
              onChange={(e) => setTpExpenseAcc(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono bg-white"
            >
              {affectableAccounts.map((acc) => (
                <option key={acc.id} value={acc.code}>
                  {acc.code} - {acc.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="tp-iva-rate" className="block text-[11px] font-bold text-slate-700 mb-1">
              Tasa IVA / Op. DIOT
            </label>
            <div className="flex gap-1.5">
              <select
                id="tp-iva-rate"
                aria-label="Tasa de IVA"
                value={tpIvaRate}
                onChange={(e) => setTpIvaRate(Number(e.target.value) as 16 | 8 | 0)}
                className="w-1/2 px-2 py-1.5 rounded-lg border border-slate-300 text-xs font-mono bg-white"
              >
                <option value={16}>16%</option>
                <option value={8}>8% Frontera</option>
                <option value={0}>0%</option>
              </select>
              <select
                id="tp-operacion-diot"
                aria-label="Tipo de Operación DIOT"
                value={tpOperacion}
                onChange={(e) => setTpOperacion(e.target.value as '03' | '06' | '85')}
                className="w-1/2 px-2 py-1.5 rounded-lg border border-slate-300 text-xs font-mono bg-white"
              >
                <option value="03">03 Serv. Prof.</option>
                <option value="06">06 Arrend.</option>
                <option value="85">85 Otros</option>
              </select>
            </div>
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label htmlFor="tp-efos" className="block text-[11px] font-bold text-slate-700 mb-1">
                Lista 69-B
              </label>
              <select
                id="tp-efos"
                value={tpEfos}
                onChange={(e) => setTpEfos(e.target.value as Efos69BStatus)}
                className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
              >
                <option value="LIMPIO">Limpio</option>
                <option value="PRESUNTO_EFOS">Presunto</option>
                <option value="DEFINITIVO_EFOS">Definitivo</option>
                <option value="DESVIRTUADO">Desvirtuado</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={saveThirdPartyMutation.isPending}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-700 hover:bg-blue-800 text-white cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              Guardar
            </button>
          </div>
        </form>

        {loadingTp ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Cargando padrón fiscal de terceros...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-300 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <th className="py-2.5 px-3">RFC</th>
                  <th className="py-2.5 px-3">Razón Social</th>
                  <th className="py-2.5 px-3">Rol</th>
                  <th className="py-2.5 px-3">Cuenta Asignada</th>
                  <th className="py-2.5 px-3">Contrapartida</th>
                  <th className="py-2.5 px-3">IVA / DIOT</th>
                  <th className="py-2.5 px-3 text-center">Estatus 69-B SAT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {thirdParties.map((tp) => {
                  const tpCheck = validateRfcModulo11(tp.rfc);
                  return (
                    <tr key={tp.id} className="hover:bg-blue-50/30">
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-bold text-blue-800">{tp.rfc}</span>
                          {tpCheck.isValidCheckDigit ? (
                            <span
                              className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"
                              title="Dígito verificador SAT Módulo 11 válido"
                            >
                              M11 OK
                            </span>
                          ) : (
                            <span
                              className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200"
                              title={`Discrepancia SAT Módulo 11: calcula '${tpCheck.expectedCheckDigit}'`}
                            >
                              M11: {tpCheck.expectedCheckDigit}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-900">
                        {tp.nombre}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[11px]">
                          {tp.rol}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-semibold text-slate-800">
                        {tp.cuentaOperacionCode}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">
                        {tp.cuentaContrapartidaCode}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">
                        IVA {tp.tasaIvaDefault}% • Op {tp.tipoOperacionDiot}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {tp.estatus69B === 'LIMPIO' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <ShieldCheck className="w-3 h-3" aria-hidden="true" />
                            69-B Limpio
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-900 border border-red-300">
                            <ShieldAlert className="w-3 h-3" aria-hidden="true" />
                            {tp.estatus69B}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Importar69BModal
        isOpen={is69BModalOpen}
        onClose={() => setIs69BModalOpen(false)}
        onImportComplete={(count) => {
          queryClient.invalidateQueries({ queryKey: ['third-parties', companyId] });
          onFeedback(`¡Lista 69-B del SAT actualizada con éxito! (${count.toLocaleString()} RFCs procesados)`);
        }}
      />
    </div>
  );
}
