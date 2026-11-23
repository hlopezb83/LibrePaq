import { CheckCircle2 } from 'lucide-react';

interface LandingInteractivePreviewProps {
  activePreviewTab: 'polizas' | 'boveda' | 'balanza' | 'fiscal';
}

export function LandingInteractivePreview({ activePreviewTab }: LandingInteractivePreviewProps) {
  return (
    <div className="p-3.5 sm:p-6 bg-white min-h-[300px] sm:min-h-[380px]">
      {activePreviewTab === 'polizas' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 sm:p-4 rounded-xl bg-blue-50/60 border border-blue-200">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono">
                  PÓLIZA DE INGRESOS #042
                </span>
                <span className="text-xs font-mono text-slate-600">Periodo 10 (Octubre 2026)</span>
              </div>
              <p className="text-xs sm:text-sm font-bold text-slate-900 mt-1">
                Cobro Factura F-8419 — Cliente Corporativo Alfa S.A.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="sm:text-right">
                <p className="text-[11px] uppercase font-mono text-slate-500">Estado de Partida Doble</p>
                <p className="text-xs sm:text-sm font-bold font-mono text-emerald-700 flex items-center gap-1 sm:justify-end">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                  <span>CUADRADA ($0.00 DIFERENCIA)</span>
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-xs">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-mono uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th scope="col" className="py-2.5 px-3">Cuenta SAT</th>
                  <th scope="col" className="py-2.5 px-3">Nombre de la Cuenta</th>
                  <th scope="col" className="py-2.5 px-3">Concepto del Movimiento</th>
                  <th scope="col" className="py-2.5 px-3 text-right">Cargos (Debe)</th>
                  <th scope="col" className="py-2.5 px-3 text-right">Abonos (Haber)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-slate-800">
                <tr className="hover:bg-slate-50/80">
                  <td className="py-2 px-3 font-semibold text-blue-600">102.01.001</td>
                  <td className="py-2 px-3 font-medium text-slate-900">BBVA Bancomer Cta. 4819</td>
                  <td className="py-2 px-3 text-slate-600 font-sans">Transferencia SPEI recibida</td>
                  <td className="py-2 px-3 text-right font-bold text-slate-900">$116,000.00</td>
                  <td className="py-2 px-3 text-right text-slate-500">$0.00</td>
                </tr>
                <tr className="hover:bg-slate-50/80">
                  <td className="py-2 px-3 font-semibold text-blue-600">105.01.005</td>
                  <td className="py-2 px-3 font-medium text-slate-900">Clientes Nacionales — Alfa S.A.</td>
                  <td className="py-2 px-3 text-slate-600 font-sans">Cancelación saldo exigible</td>
                  <td className="py-2 px-3 text-right text-slate-500">$0.00</td>
                  <td className="py-2 px-3 text-right font-bold text-slate-900">$116,000.00</td>
                </tr>
                <tr className="hover:bg-slate-50/80">
                  <td className="py-2 px-3 font-semibold text-blue-600">208.01.001</td>
                  <td className="py-2 px-3 font-medium text-slate-900">IVA Trasladado Pendiente</td>
                  <td className="py-2 px-3 text-slate-600 font-sans">Reclasificación fiscal flujo</td>
                  <td className="py-2 px-3 text-right font-bold text-emerald-700">$16,000.00</td>
                  <td className="py-2 px-3 text-right text-slate-500">$0.00</td>
                </tr>
                <tr className="hover:bg-slate-50/80">
                  <td className="py-2 px-3 font-semibold text-blue-600">209.01.001</td>
                  <td className="py-2 px-3 font-medium text-slate-900">IVA Trasladado Cobrado (Efectivamente Pagado)</td>
                  <td className="py-2 px-3 text-slate-600 font-sans">Causación de IVA Art. 1-B LIVA</td>
                  <td className="py-2 px-3 text-right text-slate-500">$0.00</td>
                  <td className="py-2 px-3 text-right font-bold text-emerald-700">$16,000.00</td>
                </tr>
              </tbody>
              <tfoot className="bg-slate-100 font-mono font-bold text-xs border-t-2 border-slate-300">
                <tr>
                  <td colSpan={3} className="py-2.5 px-3 text-right uppercase text-slate-600">
                    Sumas Iguales:
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-900 text-sm">$132,000.00</td>
                  <td className="py-2.5 px-3 text-right text-slate-900 text-sm">$132,000.00</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {activePreviewTab === 'boveda' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2.5 p-3.5 sm:p-4 rounded-xl bg-blue-50/60 border border-blue-200">
            <div>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-300 font-mono">
                BÓVEDA CFDI 4.0 & XML (ADD NUBE)
              </span>
              <p className="text-xs text-slate-600 mt-1">20 Comprobantes fiscales validados ante el SAT con Anexo 20</p>
            </div>
            <span className="text-xs font-mono text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded border border-emerald-300 font-semibold">
              Auto-Contabilización: 100%
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-emerald-800 font-bold bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">CFDI I (Ingreso)</span>
                <span className="text-xs font-mono font-bold text-slate-900">$48,250.00</span>
              </div>
              <p className="text-xs font-semibold text-slate-900 mt-2 truncate">Soluciones Tecnológicas del Bajío</p>
              <p className="text-[11px] font-mono text-slate-600">UUID: 8F2A1C... • PPD / 99</p>
              <div className="mt-3 w-full py-1 text-center text-[11px] font-semibold rounded bg-blue-100 text-blue-800 border border-blue-200">
                Póliza Generada (I-014)
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-blue-800 font-bold bg-blue-100 px-2 py-0.5 rounded border border-blue-300">CFDI E (Gasto)</span>
                <span className="text-xs font-mono font-bold text-slate-900">$14,500.00</span>
              </div>
              <p className="text-xs font-semibold text-slate-900 mt-2 truncate">Arrendadora Inmobiliaria del Centro</p>
              <p className="text-[11px] font-mono text-slate-600">Ret. ISR 10% + Ret. IVA 10.6667%</p>
              <div className="mt-3 w-full py-1 text-center text-[11px] font-semibold rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                Retenciones Desglosadas
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-purple-800 font-bold bg-purple-100 px-2 py-0.5 rounded border border-purple-300">CFDI P (REP 2.0)</span>
                <span className="text-xs font-mono font-bold text-slate-900">$29,000.00</span>
              </div>
              <p className="text-xs font-semibold text-slate-900 mt-2 truncate">Complemento de Pago SPEI</p>
              <p className="text-[11px] font-mono text-slate-600">Reclasificación automática IVA</p>
              <div className="mt-3 w-full py-1 text-center text-[11px] font-semibold rounded bg-purple-100 text-purple-800 border border-purple-200">
                Póliza M10 Vinculada
              </div>
            </div>
          </div>
        </div>
      )}

      {activePreviewTab === 'balanza' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2.5 p-3.5 sm:p-4 rounded-xl bg-blue-50/60 border border-blue-200">
            <div>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono">
                BALANZA DE COMPROBACIÓN SAT ANEXO 24
              </span>
              <p className="text-xs text-slate-600 mt-1">270 Cuentas jerarquizadas N1 a N5 con código agrupador oficial</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono text-blue-800 bg-blue-100 px-2.5 py-1 rounded border border-blue-300 font-semibold">XML SAT v1.3</span>
              <span className="text-xs font-mono text-slate-700 bg-slate-100 px-2.5 py-1 rounded border border-slate-300 font-semibold">Excel Oficial</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 overflow-x-auto text-xs font-mono shadow-xs">
            <div className="min-w-[500px]">
              <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 text-slate-600 grid grid-cols-5 text-[10px] uppercase font-semibold">
                <div>Código SAT</div>
                <div className="col-span-2">Nombre Cuenta</div>
                <div className="text-right">Saldo Inicial</div>
                <div className="text-right">Saldo Final</div>
              </div>
              <div className="p-2 space-y-1 divide-y divide-slate-100 text-slate-800">
                <div className="grid grid-cols-5 py-1.5 px-2 font-bold text-slate-900">
                  <span className="text-blue-600">100.00</span>
                  <span className="col-span-2">ACTIVO</span>
                  <span className="text-right">$8,450,120.00</span>
                  <span className="text-right text-emerald-700 font-bold">$9,120,400.00</span>
                </div>
                <div className="grid grid-cols-5 py-1.5 px-2 pl-6">
                  <span className="text-blue-600">102.01</span>
                  <span className="col-span-2 text-slate-900 font-medium">Bancos Nacionales</span>
                  <span className="text-right">$2,100,500.00</span>
                  <span className="text-right text-slate-900 font-semibold">$2,450,800.00</span>
                </div>
                <div className="grid grid-cols-5 py-1.5 px-2 pl-10 text-slate-600">
                  <span className="text-slate-500">102.01.001</span>
                  <span className="col-span-2 font-sans text-slate-700">BBVA Bancomer Operativa</span>
                  <span className="text-right">$1,450,000.00</span>
                  <span className="text-right text-slate-900 font-medium">$1,680,300.00</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activePreviewTab === 'fiscal' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2.5 p-3.5 sm:p-4 rounded-xl bg-blue-50/60 border border-blue-200">
            <div>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 font-mono">
                HOJA DE TRABAJO DÍA 17 (PAGO PROVISIONAL)
              </span>
              <p className="text-xs text-slate-600 mt-1">Cálculo de ISR provisional Art. 14 LISR e IVA definitivo mensual</p>
            </div>
            <span className="text-xs font-mono text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded border border-emerald-300 font-semibold">
              INPC Actualizado: 138.412
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <p className="text-[10px] text-slate-500 uppercase">Ingresos Nominales Acumulados</p>
              <p className="text-lg font-bold text-slate-900 mt-1">$4,850,200.00</p>
              <p className="text-[10px] text-blue-600 mt-1 font-semibold">Coeficiente Utilidad: 0.1845</p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <p className="text-[10px] text-slate-500 uppercase">ISR a Enterar (Día 17)</p>
              <p className="text-lg font-bold text-amber-700 mt-1">$42,380.00</p>
              <p className="text-[10px] text-slate-500 mt-1">Menos pagos previos: $226,100.00</p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <p className="text-[10px] text-slate-500 uppercase">IVA a Pagar / Saldo a Favor</p>
              <p className="text-lg font-bold text-emerald-700 mt-1">$18,450.00</p>
              <p className="text-[10px] text-emerald-600 mt-1 font-semibold">Causado $96k - Acreditable $77.5k</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
