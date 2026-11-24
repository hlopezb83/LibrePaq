import { useState } from 'react';
import { ArrowRight, Database, Users } from 'lucide-react';

interface LandingRoiCalculatorProps {
  onOpenAuth?: () => void;
}

export function LandingRoiCalculator({ onOpenAuth }: LandingRoiCalculatorProps) {
  const [numRfcs, setNumRfcs] = useState(12);
  const [numUsers, setNumUsers] = useState(3);

  // CONTPAQi anual estimado: ~$9,500 base + ~$4,200 por usuario adicional + servidor/respaldos ~$6,000 + timbres/actualizaciones
  const costContpaqi = Math.round(9500 + (numUsers - 1) * 4500 + numRfcs * 350 + 6000);
  // LibrePaq Pro: $0 MXN por tiempo limitado (Promoción de Lanzamiento)
  const costLibrePaq = 0;
  const annualSavings = Math.max(0, costContpaqi - costLibrePaq);
  const monthlySavings = Math.round(annualSavings / 12);
  const savingsPercent = 100;

  return (
    <section id="calculadora" className="scroll-mt-16 py-14 sm:py-20 lg:py-24 bg-white relative border-t border-slate-200">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
          <span className="px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono font-bold tracking-wider">
            CALCULADORA DE RETORNO DE INVERSIÓN
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-slate-900 text-balance">
            Calcula Cuánto Dinero Ahorrará Tu Despacho al Año
          </h2>
          <p className="mt-3 text-sm text-slate-600 text-pretty">
            Ajusta el número de empresas (RFCs) y contadores en tu equipo para estimar cuánto le dejas de pagar a CONTPAQi®.
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-3xl p-4 sm:p-8 lg:p-10 shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-center">
          {/* Controles deslizantes y Presets Rápidos */}
          <div className="lg:col-span-7 space-y-6 sm:space-y-8">
            {/* Presets rápidos para despachos en México */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                Escenarios Típicos de Despachos en México:
              </span>
              <div
                role="group"
                aria-label="Escenarios rápidos de despachos contables"
                className="flex flex-wrap gap-2"
              >
                {[
                  { rfcs: 1, users: 1, label: '1 RFC · Independiente' },
                  { rfcs: 12, users: 3, label: '12 RFCs · Despacho PyME' },
                  { rfcs: 30, users: 6, label: '30 RFCs · Firma Mediana' }
                ].map((preset) => {
                  const isActive = numRfcs === preset.rfcs && numUsers === preset.users;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => {
                        setNumRfcs(preset.rfcs);
                        setNumUsers(preset.users);
                      }}
                      className={`min-h-[40px] px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer border inline-flex items-center ${
                        isActive
                          ? 'bg-blue-700 text-white border-blue-700 shadow-2xs font-bold'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Slider RFCs */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <label htmlFor="rfcs-slider" className="text-xs sm:text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Database className="w-4 h-4 text-blue-600 shrink-0" aria-hidden="true" />
                  <span>Empresas / RFCs Administrados:</span>
                </label>
                <span className="text-base sm:text-xl font-bold font-mono text-blue-700 bg-blue-50 px-3 py-0.5 sm:px-3.5 sm:py-1 rounded-lg border border-blue-200">
                  {numRfcs === 1 ? '1 RFC' : `${numRfcs} RFCs`}
                </span>
              </div>
              <div className="min-h-[44px] flex items-center">
                <input
                  id="rfcs-slider"
                  type="range"
                  min="1"
                  max="60"
                  value={numRfcs}
                  aria-valuemin={1}
                  aria-valuemax={60}
                  aria-valuenow={numRfcs}
                  aria-valuetext={numRfcs === 1 ? '1 empresa o RFC administrado' : `${numRfcs} empresas o RFCs administrados`}
                  onChange={(e) => setNumRfcs(Number(e.target.value))}
                  className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 [--slider-thumb-color:#2563eb] focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-4"
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-600 mt-1 font-mono">
                <span>1 Empresa</span>
                <span>30 Empresas</span>
                <span>60+ Empresas</span>
              </div>
            </div>

            {/* Slider Contadores / Máquinas */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <label htmlFor="users-slider" className="text-xs sm:text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                  <span>Contadores / Computadoras Concurrentes:</span>
                </label>
                <span className="text-base sm:text-xl font-bold font-mono text-emerald-700 bg-emerald-50 px-3 py-0.5 sm:px-3.5 sm:py-1 rounded-lg border border-emerald-200">
                  {numUsers} {numUsers === 1 ? 'Usuario' : 'Usuarios'}
                </span>
              </div>
              <div className="min-h-[44px] flex items-center">
                <input
                  id="users-slider"
                  type="range"
                  min="1"
                  max="12"
                  value={numUsers}
                  aria-valuemin={1}
                  aria-valuemax={12}
                  aria-valuenow={numUsers}
                  aria-valuetext={`${numUsers} ${numUsers === 1 ? 'contador o máquina concurrente' : 'contadores o máquinas concurrentes'}`}
                  onChange={(e) => setNumUsers(Number(e.target.value))}
                  className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600 [--slider-thumb-color:#059669] focus-visible:outline-2 focus-visible:outline-emerald-600 focus-visible:outline-offset-4"
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-600 mt-1 font-mono">
                <span>1 Contador</span>
                <span>6 Contadores</span>
                <span>12+ Contadores</span>
              </div>
            </div>

            {/* Detalle de costos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-4 border-t border-slate-200">
              <div className="p-4 rounded-xl bg-white border border-slate-200">
                <p className="text-xs text-slate-600">Gasto Estimado CONTPAQi®:</p>
                <p className="text-xl font-bold font-mono tabular-nums text-rose-700 mt-1">
                  ${costContpaqi.toLocaleString('es-MX')} MXN/año
                </p>
                <p className="text-[11px] text-slate-600 mt-0.5">Renovación anual + cobro por PC extra + soporte técnico</p>
              </div>

              <div className="p-4 rounded-xl bg-white border border-emerald-300">
                <p className="text-xs text-slate-600">Costo LibrePaq Pro:</p>
                <p className="text-xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
                  ${costLibrePaq.toLocaleString('es-MX')} MXN
                </p>
                <p className="text-[11px] text-emerald-700 mt-0.5 font-semibold">Promoción $0 por Tiempo Limitado</p>
              </div>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Estimación referencial anual: licencias, módulos, usuarios extra y soporte técnico frente al plan promocional vigente.
            </p>
          </div>

          {/* Tarjeta de Ahorro Destacado en Navy Focal Contrast */}
          <div className="lg:col-span-5 bg-gradient-to-br from-[#0B254E] via-[#0E336B] to-[#081C3C] text-white rounded-2xl p-6 sm:p-8 text-center relative overflow-hidden shadow-xl">
            <div className="absolute top-0 right-0 -mr-10 -mt-10 w-44 h-44 bg-cyan-500/10 blur-2xl rounded-full pointer-events-none" />

            <div aria-live="polite" aria-atomic="true">
              <span className="inline-block px-3.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                ¡AHORRO DEL {savingsPercent}%!
              </span>

              <p className="mt-4 text-xs font-medium uppercase tracking-wider text-slate-300">
                Ahorro Neto Anual para Tu Firma
              </p>

              <p className="mt-2 text-3xl sm:text-4xl font-extrabold font-mono tabular-nums text-emerald-400 tracking-tight">
                ${annualSavings.toLocaleString('es-MX')} <span className="text-lg font-sans font-medium text-emerald-300">MXN</span>
              </p>

              <p className="mt-1.5 text-xs font-mono font-semibold text-cyan-200 tabular-nums">
                Equivalente a ${monthlySavings.toLocaleString('es-MX')} MXN/mes retenidos
              </p>
            </div>

            <p className="mt-3 text-xs text-slate-300 leading-relaxed text-pretty">
              Capital directo que tu despacho retiene en lugar de pagar renovaciones y pólizas de soporte.
            </p>

            <button
              type="button"
              onClick={onOpenAuth}
              className="mt-6 w-full py-3.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
            >
              <span>Empezar a Ahorrar Hoy</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
