import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import writeXlsx, { type SheetData } from 'write-excel-file/browser';
import { Button, Input, StatusBadge } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { getAuthHeaders, handleResponse } from '../../lib/api/api-helpers';
import { formatCurrency } from '../../lib/formatters';
import { isSupabaseConfigured } from '../../lib/supabase';
import { supabaseAnnualTax } from '../../lib/supabase/supabase-annual-tax';
import { sanitizeSpreadsheetText } from '../../shared/date-utils';
import { computeArt57LossCarryforwards } from '../../shared/engine/annual-tax-balances.helper';
import type { AnnualTaxRegimeType, AnnualTaxSummaryResponse } from '../../shared/types/annual-tax.types';
import type { FiscalLossCarryforward } from '../../shared/types/ronda11.types';

const useCloudLosses = () =>
  typeof window !== 'undefined' &&
  isSupabaseConfigured &&
  (window.location.hostname !== 'localhost' || window.location.search.includes('cloud=true'));

const sCell = (val: string, bold = false) => ({
  type: String as typeof String,
  value: sanitizeSpreadsheetText(val),
  ...(bold ? { fontWeight: 'bold' as const } : {})
});
const nCell = (val: number, bold = false) => ({
  type: Number as typeof Number,
  value: Number.isFinite(val) ? val : 0,
  format: '#,##0.00',
  ...(bold ? { fontWeight: 'bold' as const } : {})
});

export async function exportDeclaracionAnualXlsx(
  summary: AnnualTaxSummaryResponse,
  losses: readonly FiscalLossCarryforward[] = []
): Promise<void> {
  const { company, ejercicio, reconciliation: rec, determination: det, inflation: inf } = summary;
  const isPf = det.tipoRegimenAnual === 'PF_RESICO' || det.tipoRegimenAnual === 'PF_ART152';
  const isPmResico = det.tipoRegimenAnual === 'PM_RESICO';
  const pmResicoDed = det.ingresosNominales - rec.utilidadFiscalAntesPtu;

  const baseRows: SheetData = [
    [sCell(`${company.name} (${company.rfc})`, true)],
    [sCell(`Declaración Anual LISR — Ejercicio ${ejercicio} (${det.tipoRegimenAnual})`, true)],
    [],
    [sCell('Sección', true), sCell('Concepto Fiscal', true), sCell('Importe MXN', true)],
    ...(isPf
      ? [
          [sCell('Base Gravable'), sCell('Ingresos Cobrados / Acumulables'), nCell(det.ingresosNominales)],
          ...(det.tipoRegimenAnual === 'PF_ART152'
            ? [
                [sCell('Base Gravable'), sCell('(-) Deducciones Autorizadas y PTU'), nCell(-(det.ingresosNominales - rec.utilidadFiscal))],
                [sCell('Base Gravable'), sCell('(-) Pérdidas Fiscales Aplicadas'), nCell(-rec.perdidasFiscalesAplicadas)],
                [sCell('Base Gravable'), sCell('(-) Deducciones Personales (Art. 151)'), nCell(-(rec.deduccionesPersonalesAplicadas ?? 0))]
              ]
            : []),
          [sCell('Base Gravable'), sCell('(=) Base / Resultado Fiscal'), nCell(det.tipoRegimenAnual === 'PF_RESICO' ? det.ingresosNominales : rec.resultadoFiscal), ]
        ]
      : isPmResico
        ? [
            [sCell('Conciliación Flujo PM RESICO'), sCell('Ingresos Efectivamente Cobrados'), nCell(det.ingresosNominales)],
            [sCell('Conciliación Flujo PM RESICO'), sCell('(-) Deducciones Autorizadas Pagadas e Inv. Art. 31'), nCell(-pmResicoDed)],
            [sCell('Conciliación Flujo PM RESICO'), sCell('(=) Utilidad Fiscal antes de PTU'), nCell(rec.utilidadFiscalAntesPtu)],
            [sCell('Conciliación Flujo PM RESICO'), sCell('(-) PTU Pagada en el Ejercicio'), nCell(-rec.ptuPagadaEjercicio)],
            [sCell('Conciliación Flujo PM RESICO'), sCell('(=) Utilidad / Pérdida Fiscal'), nCell(rec.utilidadFiscal, true)],
            [sCell('Conciliación Flujo PM RESICO'), sCell('(-) Pérdidas Fiscales Actualizadas Aplicadas'), nCell(-rec.perdidasFiscalesAplicadas)],
            [sCell('Conciliación Flujo PM RESICO'), sCell('(=) Resultado Fiscal Gravable'), nCell(rec.resultadoFiscal, true)]
          ]
        : [
            [sCell('Conciliación Contable-Fiscal'), sCell('Utilidad / Pérdida Contable'), nCell(rec.utilidadContable)],
            [sCell('Conciliación Contable-Fiscal'), sCell('(+) Ingresos Fiscales No Contables'), nCell(rec.ingresosFiscalesNoContables)],
            [sCell('Conciliación Contable-Fiscal'), sCell('(+) Deducciones Contables No Fiscales'), nCell(rec.deduccionesContablesNoFiscales)],
            [sCell('Conciliación Contable-Fiscal'), sCell('(-) Deducciones Fiscales No Contables'), nCell(-rec.deduccionesFiscalesNoContables)],
            [sCell('Conciliación Contable-Fiscal'), sCell('(-) PTU Pagada en el Ejercicio'), nCell(-rec.ptuPagadaEjercicio)],
            [sCell('Conciliación Contable-Fiscal'), sCell('(=) Utilidad / Pérdida Fiscal'), nCell(rec.utilidadFiscal, true)],
            [sCell('Conciliación Contable-Fiscal'), sCell('(-) Pérdidas Fiscales Actualizadas Aplicadas'), nCell(-rec.perdidasFiscalesAplicadas)],
            [sCell('Conciliación Contable-Fiscal'), sCell('(=) Resultado Fiscal Gravable'), nCell(rec.resultadoFiscal, true)]
          ]),
    ...(!isPf
      ? [
          [sCell('Ajuste Anual Inflación'), sCell('Promedio Anual Créditos'), nCell(inf.promedioCreditos)],
          [sCell('Ajuste Anual Inflación'), sCell('Promedio Anual Deudas'), nCell(inf.promedioDeudas)],
          [sCell('Ajuste Anual Inflación'), sCell(`Efecto (${inf.tipo})`), nCell(inf.tipo === 'ACUMULABLE' ? inf.ajusteAcumulable : -inf.ajusteDeducible)],
          [sCell('CUCA / CUFIN'), sCell('CUCA Final Actualizada'), nCell(det.cucaFinal)],
          [sCell('CUCA / CUFIN'), sCell('CUFIN Final Actualizada'), nCell(det.cufinFinal)]
        ]
      : []),
    [sCell('Determinación ISR'), sCell(`ISR Causado (${det.tasaAplicablePct.toFixed(2)}%)`), nCell(det.isrAnualCausado, true)],
    [sCell('Determinación ISR'), sCell('(-) Pagos Provisionales Efectuados'), nCell(-det.pagosProvisionalesEfectuados)],
    [sCell('Determinación ISR'), sCell('(-) ISR Retenido Acreditable'), nCell(-det.isrRetenidoAcreditable)],
    [sCell('Determinación ISR'), sCell(det.isrAnualCargoFavor >= 0 ? '(=) ISR Anual a Cargo' : '(=) Saldo a Favor ISR'), nCell(det.isrAnualCargoFavor >= 0 ? det.isrACargo : det.isrAFavor, true)],
    [sCell('Determinación ISR'), sCell('PTU por Pagar (10%)'), nCell(det.ptuPorPagar10Pct)],
    ...(losses.length > 0
      ? [
          [],
          [sCell('Pérdidas Fiscales Art. 57', true), sCell('Año Origen / Estatus', true), sCell('Remanente Nominal', true)],
          ...losses.map((l) => [
            sCell(`Pérdida ${l.lossYear}`),
            sCell(ejercicio - l.lossYear > 10 ? 'Expirada (>10 años)' : `Vigente (${10 - (ejercicio - l.lossYear)} años rest.)`),
            nCell(l.remainingAmount)
          ])
        ]
      : [])
  ];

  await writeXlsx([
    {
      sheet: 'Declaracion Anual',
      data: baseRows,
      columns: [{ width: 28 }, { width: 46 }, { width: 18 }]
    }
  ]).toFile(`Declaracion_Anual_${company.rfc}_${ejercicio}.xlsx`);
}

interface DeclaracionAnualLossesCardProps {
  companyId: string;
  ejercicio: number;
  tipoRegimenAnual: AnnualTaxRegimeType;
  isReadOnly?: boolean;
}

export function DeclaracionAnualLossesCard({
  companyId,
  ejercicio,
  tipoRegimenAnual,
  isReadOnly = false
}: DeclaracionAnualLossesCardProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [lossYear, setLossYear] = useState(String(ejercicio - 1));
  const [originalAmount, setOriginalAmount] = useState('');
  const [remainingAmount, setRemainingAmount] = useState('');
  const [notes, setNotes] = useState('');

  const { data: losses = [] } = useQuery<FiscalLossCarryforward[]>({
    queryKey: ['annual-tax-losses', companyId],
    queryFn: async () => {
      if (useCloudLosses()) return supabaseAnnualTax.listFiscalLosses(companyId);
      const res = await fetch(`/api/companies/${encodeURIComponent(companyId)}/annual-tax/losses`, {
        headers: getAuthHeaders()
      });
      return handleResponse<FiscalLossCarryforward[]>(res);
    },
    enabled: Boolean(companyId) && tipoRegimenAnual !== 'PF_RESICO'
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const yr = Math.round(Number(lossYear));
      const orig = Number(originalAmount) || 0;
      const rem = remainingAmount.trim() ? Number(remainingAmount) : orig;
      const payload = {
        lossYear: yr,
        originalAmount: orig,
        appliedAmount: Math.max(0, orig - rem),
        remainingAmount: rem,
        inpcFirstUpdateMonth: 7,
        notes: notes.trim()
      };
      if (useCloudLosses()) return supabaseAnnualTax.upsertFiscalLoss(companyId, payload);
      const res = await fetch(`/api/companies/${encodeURIComponent(companyId)}/annual-tax/losses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(payload)
      });
      return handleResponse<FiscalLossCarryforward[]>(res);
    },
    onSuccess: (next) => {
      queryClient.setQueryData(['annual-tax-losses', companyId], next);
      void queryClient.invalidateQueries({ queryKey: ['annual-tax', companyId, ejercicio] });
      setOriginalAmount('');
      setRemainingAmount('');
      setNotes('');
      toast.success('Pérdida fiscal Art. 57 LISR guardada');
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Error al guardar pérdida fiscal');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (lossId: string) => {
      if (useCloudLosses()) return supabaseAnnualTax.deleteFiscalLoss(companyId, lossId);
      const res = await fetch(`/api/companies/${encodeURIComponent(companyId)}/annual-tax/losses/${encodeURIComponent(lossId)}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      return handleResponse<FiscalLossCarryforward[]>(res);
    },
    onSuccess: (next) => {
      queryClient.setQueryData(['annual-tax-losses', companyId], next);
      void queryClient.invalidateQueries({ queryKey: ['annual-tax', companyId, ejercicio] });
      toast.success('Pérdida fiscal eliminada');
    }
  });

  if (tipoRegimenAnual === 'PF_RESICO') return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (!Number(originalAmount) || Number(lossYear) >= ejercicio) {
      toast.error('Captura un año anterior al ejercicio y un monto mayor a $0.00');
      return;
    }
    saveMutation.mutate();
  };

  return (
    <section className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs p-4 sm:p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            Pérdidas Fiscales por Año de Origen (Art. 57 LISR · 10 años)
          </h3>
          <p className="text-xs text-slate-600">
            Actualización automática con INPC hasta junio de {ejercicio} y aplicación FIFO contra utilidad fiscal.
          </p>
        </div>
        <StatusBadge tone="slate">{losses.length} año(s) registrado(s)</StatusBadge>
      </div>

      {!isReadOnly && (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-end">
          <div>
            <label htmlFor="loss-year-input" className="block text-[11px] font-semibold text-slate-700 mb-1">Año Origen</label>
            <Input id="loss-year-input" size="sm" type="number" min={2000} max={ejercicio - 1} value={lossYear} onChange={(e) => setLossYear(e.target.value)} />
          </div>
          <div>
            <label htmlFor="loss-orig-input" className="block text-[11px] font-semibold text-slate-700 mb-1">Pérdida Original</label>
            <Input id="loss-orig-input" size="sm" type="number" step="0.01" min={0} placeholder="0.00" value={originalAmount} onChange={(e) => setOriginalAmount(e.target.value)} />
          </div>
          <div>
            <label htmlFor="loss-rem-input" className="block text-[11px] font-semibold text-slate-700 mb-1">Pendiente Nominal</label>
            <Input id="loss-rem-input" size="sm" type="number" step="0.01" min={0} placeholder="Igual original" value={remainingAmount} onChange={(e) => setRemainingAmount(e.target.value)} />
          </div>
          <div>
            <label htmlFor="loss-notes-input" className="block text-[11px] font-semibold text-slate-700 mb-1">Notas</label>
            <Input id="loss-notes-input" size="sm" type="text" placeholder="Opcional" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <Button type="submit" size="sm" variant="primary" loading={saveMutation.isPending} leftIcon={<Plus className="w-3.5 h-3.5" aria-hidden="true" />}>
            Agregar / Actualizar
          </Button>
        </form>
      )}

      {losses.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
              <tr>
                <th className="py-1.5 px-2 text-left">Año</th>
                <th className="py-1.5 px-2 text-left">Vigencia (10 años)</th>
                <th className="py-1.5 px-2 text-right">Original</th>
                <th className="py-1.5 px-2 text-right">Pendiente Nominal</th>
                <th className="py-1.5 px-2 text-right">Actualizada Art. 57</th>
                {!isReadOnly && <th className="py-1.5 px-2 text-right">Acción</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {losses.map((l) => {
                const age = ejercicio - l.lossYear;
                const expired = age > 10 || l.lossYear >= ejercicio;
                const upd = expired ? 0 : computeArt57LossCarryforwards([l], ejercicio, Number.MAX_SAFE_INTEGER).actualizadasCents / 100;
                return (
                  <tr key={l.id}>
                    <td className="py-1.5 px-2 font-mono font-bold">{l.lossYear}</td>
                    <td className="py-1.5 px-2">
                      <StatusBadge tone={expired ? 'red' : 'emerald'} shape="tag">
                        {expired ? 'Expirada (>10 años)' : `Vigente (${10 - age} años)`}
                      </StatusBadge>
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono tabular-nums">{formatCurrency(l.originalAmount)}</td>
                    <td className="py-1.5 px-2 text-right font-mono tabular-nums">{formatCurrency(l.remainingAmount)}</td>
                    <td className="py-1.5 px-2 text-right font-mono font-semibold tabular-nums text-blue-900">{formatCurrency(upd)}</td>
                    {!isReadOnly && (
                      <td className="py-1.5 px-2 text-right">
                        <button
                          type="button"
                          onClick={() => deleteMutation.mutate(l.id)}
                          aria-label={`Eliminar pérdida fiscal ${l.lossYear}`}
                          className="p-1 text-red-700 hover:bg-red-50 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
