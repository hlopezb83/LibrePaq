import { Check, Sparkles, X } from 'lucide-react';

export function LandingComparisonSection() {
  return (
    <section id="comparativa" className="py-24 bg-slate-50/80 border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-mono font-bold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
            <span>Comparativa Frente a Frente</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 text-balance">
            ¿Por qué los Despachos Están Migrando de CONTPAQi® a LibrePaq Pro?
          </h2>
          <p className="mt-4 text-base text-slate-600 text-pretty">
            Diseñamos LibrePaq Pro para eliminar cada dolor de cabeza del software contable tradicional:
            renovaciones forzosas de más de $20,000 MXN, depender de una sola computadora en la oficina, visor de XML lento y cobros extra por cada contador.
          </p>
        </div>

        <div
          tabIndex={0}
          role="region"
          aria-label="Tabla comparativa entre CONTPAQi y LibrePaq Pro"
          className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
          <table className="w-full min-w-[600px] text-sm text-left">
            <caption className="sr-only">
              Comparativa de características técnicas, operativas y fiscales entre CONTPAQi tradicional y LibrePaq Pro en la nube
            </caption>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/80">
                <th scope="col" className="py-4 px-6 font-bold text-slate-800 w-1/3">Lo que Vive tu Despacho Día a Día</th>
                <th scope="col" className="py-4 px-6 font-bold text-rose-700 w-1/3">
                  <div className="flex items-center gap-2">
                    <span aria-hidden="true" className="w-2 h-2 rounded-full bg-rose-500" />
                    <span>CONTPAQi® Contabilidad / Bancos</span>
                  </div>
                </th>
                <th scope="col" className="py-4 px-6 font-bold text-emerald-800 w-1/3 bg-emerald-50/70 border-l border-emerald-200">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                    <span>LibrePaq Pro (En la Nube)</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              <tr className="hover:bg-slate-50 transition-colors">
                <th scope="row" className="py-4 px-6 font-semibold text-slate-900">Costo de Licencia Anual</th>
                <td className="py-4 px-6 text-rose-800">
                  <div className="flex items-start gap-2">
                    <X className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>$15,000 a $45,000+ MXN al año más cobro extra por cada usuario o máquina.</span>
                  </div>
                </td>
                <td className="py-4 px-6 text-emerald-800 font-semibold bg-emerald-50/30 border-l border-emerald-200">
                  <div className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>$0 MXN por tiempo limitado (Todos los planes gratis) sin cobro extra por computadora.</span>
                  </div>
                </td>
              </tr>

              <tr className="hover:bg-slate-50 transition-colors">
                <th scope="row" className="py-4 px-6 font-semibold text-slate-900">Acceso desde Oficina, Casa o Mac</th>
                <td className="py-4 px-6 text-slate-600">
                  <div className="flex items-start gap-2">
                    <X className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>Atado a la PC de la oficina; cada que formateas o cambias de laptop pagas soporte técnico.</span>
                  </div>
                </td>
                <td className="py-4 px-6 text-emerald-800 font-semibold bg-emerald-50/30 border-l border-emerald-200">
                  <div className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>Sin instalar nada. Entra en 2 segundos desde tu navegador en PC, Mac o laptop de casa.</span>
                  </div>
                </td>
              </tr>

              <tr className="hover:bg-slate-50 transition-colors">
                <th scope="row" className="py-4 px-6 font-semibold text-slate-900">Trabajo en Equipo y Respaldos</th>
                <td className="py-4 px-6 text-slate-600">
                  <div className="flex items-start gap-2">
                    <X className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>Si se apaga o falla la computadora principal, nadie en el despacho puede avanzar.</span>
                  </div>
                </td>
                <td className="py-4 px-6 text-emerald-800 font-semibold bg-emerald-50/30 border-l border-emerald-200">
                  <div className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>Nube rápida incluida para todo tu equipo + Descarga respaldo a tu PC en 1 clic.</span>
                  </div>
                </td>
              </tr>

              <tr className="hover:bg-slate-50 transition-colors">
                <th scope="row" className="py-4 px-6 font-semibold text-slate-900">Cuadre de Pólizas y Balanza SAT</th>
                <td className="py-4 px-6 text-slate-600">
                  <div className="flex items-start gap-2">
                    <X className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>Diferencias molestas de centavos en pólizas extensas o al cierre del mes.</span>
                  </div>
                </td>
                <td className="py-4 px-6 text-emerald-800 font-semibold bg-emerald-50/30 border-l border-emerald-200">
                  <div className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>Cuadre exacto al centavo: el sistema garantiza siempre que Cargos = Abonos antes de guardar.</span>
                  </div>
                </td>
              </tr>

              <tr className="hover:bg-slate-50 transition-colors">
                <th scope="row" className="py-4 px-6 font-semibold text-slate-900">Bóveda CFDI 4.0 vs. ADD</th>
                <td className="py-4 px-6 text-slate-600">
                  <div className="flex items-start gap-2">
                    <X className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>El visor ADD se traba al cargar muchos XMLs o pide horas de mantenimiento para abrir.</span>
                  </div>
                </td>
                <td className="py-4 px-6 text-emerald-800 font-semibold bg-emerald-50/30 border-l border-emerald-200">
                  <div className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>Bóveda CFDI 4.0 instantánea: sube tus XMLs, desglosa impuestos y genera pólizas automáticas.</span>
                  </div>
                </td>
              </tr>

              <tr className="hover:bg-slate-50 transition-colors">
                <th scope="row" className="py-4 px-6 font-semibold text-slate-900">Libertad sobre Tu Información</th>
                <td className="py-4 px-6 text-slate-600">
                  <div className="flex items-start gap-2">
                    <X className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>Tu información queda atrapada si decides no pagar la renovación anual.</span>
                  </div>
                </td>
                <td className="py-4 px-6 text-emerald-800 font-semibold bg-emerald-50/30 border-l border-emerald-200">
                  <div className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>Importa tu catálogo y pólizas de CONTPAQi® en Excel o TXT en 1 minuto y exporta cuando quieras.</span>
                  </div>
                </td>
              </tr>

              <tr className="hover:bg-slate-50 transition-colors">
                <th scope="row" className="py-4 px-6 font-semibold text-slate-900">Velocidad de Captura con Teclado</th>
                <td className="py-4 px-6 text-slate-600">
                  <div className="flex items-start gap-2">
                    <X className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>Pantallas antiguas y lentas con demasiados clics para capturar una sola póliza.</span>
                  </div>
                </td>
                <td className="py-4 px-6 text-emerald-800 font-semibold bg-emerald-50/30 border-l border-emerald-200">
                  <div className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>Buscador rápido (Ctrl+K), desglose de IVA en 1 tecla (F4), atajos (F1) y cambio de empresa (Ctrl+E).</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
