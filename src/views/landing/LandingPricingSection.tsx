import { Check, Download, HardDrive, Sparkles, Zap } from 'lucide-react';

interface LandingPricingSectionProps {
  onOpenAuth: () => void;
}

export function LandingPricingSection({ onOpenAuth }: LandingPricingSectionProps) {
  return (
    <section id="precios" className="py-24 bg-white relative border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono font-bold inline-flex items-center gap-1.5 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            PROMOCIÓN DE LANZAMIENTO: TODOS LOS PLANES $0 MXN
          </span>
          <h2 className="mt-4 text-3xl sm:text-4xl font-extrabold text-slate-900 text-balance">
            Elige Tu Plan Sin Costo — Nosotros Ponemos la Nube
          </h2>
          <p className="mt-4 text-base text-slate-600 text-pretty">
            Por tiempo limitado, <strong className="text-slate-900">todos los planes son 100% gratis</strong>. Entra desde cualquier computadora sin instalar programas ni pagar soporte técnico: tu despacho trabaja en la nube y puedes descargar respaldo a tu PC en 1 clic cuando gustes.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 max-w-5xl mx-auto items-stretch">
          {/* Plan Inicial */}
          <div className="p-5 sm:p-8 rounded-2xl bg-white border border-slate-200 flex flex-col justify-between shadow-xs">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-slate-500 uppercase tracking-widest">
                  Despacho Inicial
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  Siempre $0
                </span>
              </div>
              <h4 className="text-2xl font-bold text-slate-900 mt-2">Prueba Libre</h4>
              <p className="text-sm text-slate-500 mt-2">Para contadores independientes y profesionistas.</p>

              <div className="mt-6 mb-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-slate-900 font-mono">$0</span>
                  <span className="text-slate-500 text-sm">MXN / gratis</span>
                </div>
                <p className="text-xs text-emerald-700 mt-1 font-mono font-medium">Almacenamiento nube incluido</p>
              </div>

              <ul className="space-y-3 text-sm text-slate-700 border-t border-slate-200 pt-6">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Hasta 3 RFCs / Empresas</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Pólizas de Ingresos, Egresos y Diario</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Balanza de Comprobación Anexo 24 XML</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Almacenamiento en la nube listo</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-blue-700 font-medium">Respaldo local en 1 clic</span>
                </li>
              </ul>
            </div>

            <button
              type="button"
              onClick={onOpenAuth}
              className="mt-8 w-full py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm transition text-center cursor-pointer border border-slate-300"
            >
              Comenzar Gratis
            </button>
          </div>

          {/* Plan Pro (Destacado - $0 Promoción) */}
          <div className="p-5 sm:p-8 pt-7 sm:pt-8 rounded-2xl bg-gradient-to-b from-blue-50/70 via-white to-white border-2 border-blue-600 flex flex-col justify-between relative shadow-xl shadow-blue-500/10">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-blue-600 text-white font-extrabold text-[10px] sm:text-xs uppercase tracking-wider font-mono shadow-md flex items-center gap-1 whitespace-nowrap">
              <Zap className="w-3.5 h-3.5 fill-current text-yellow-300 shrink-0" />
              <span>100% Gratis por Lanzamiento</span>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-blue-700 uppercase tracking-widest">
                  Despacho Profesional
                </span>
                <span className="line-through text-xs font-mono text-slate-400">
                  Antes $499/mes
                </span>
              </div>
              <h4 className="text-2xl font-bold text-slate-900 mt-2">LibrePaq Pro</h4>
              <p className="text-sm text-slate-600 mt-2">Para despachos con cartera activa de clientes.</p>

              <div className="mt-6 mb-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-emerald-600 font-mono">$0</span>
                  <span className="text-slate-500 text-sm">MXN / mes</span>
                </div>
                <p className="text-xs text-blue-700 mt-1 font-mono font-bold">
                  ⚡ Tiempo Limitado • Nube Gestionada Incluida
                </p>
              </div>

              <ul className="space-y-3 text-sm text-slate-700 border-t border-slate-200 pt-6">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold text-slate-900">Empresas / RFCs Ilimitados</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-emerald-700 font-medium">Almacenamiento Seguro en la Nube LibrePaq Incluido</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-blue-700 font-medium">Descarga y Respaldo a Local cuando gustes</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Bóveda CFDI 4.0 con auto-contabilización</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Generador de layout oficial DIOT y Bancos</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Depreciación fiscal de Activos Fijos con INPC</span>
                </li>
              </ul>
            </div>

            <button
              type="button"
              onClick={onOpenAuth}
              className="mt-8 w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm transition-all shadow-lg shadow-blue-600/25 text-center cursor-pointer"
            >
              Activar Plan Pro Gratis
            </button>
          </div>

          {/* Plan Corporativo */}
          <div className="p-5 sm:p-8 rounded-2xl bg-white border border-slate-200 flex flex-col justify-between shadow-xs">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-slate-500 uppercase tracking-widest">
                  Firmas y Corporativos
                </span>
                <span className="line-through text-xs font-mono text-slate-400">
                  Antes $1,299/mes
                </span>
              </div>
              <h4 className="text-2xl font-bold text-slate-900 mt-2">Corporativo</h4>
              <p className="text-sm text-slate-500 mt-2">Para firmas con múltiples equipos y auditoría.</p>

              <div className="mt-6 mb-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-slate-900 font-mono">$0</span>
                  <span className="text-slate-500 text-sm">MXN / mes</span>
                </div>
                <p className="text-xs text-blue-700 mt-1 font-mono font-medium">Acceso total sin costo en fase de lanzamiento</p>
              </div>

              <ul className="space-y-3 text-sm text-slate-700 border-t border-slate-200 pt-6">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Todo lo incluido en el Plan Pro</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Contadores concurrentes ilimitados</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Bitácora de auditoría y candados fiscales P01-P13</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Servicio de Nube Dedicado y Seguro</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-blue-700 font-medium">Exportación masiva y respaldo local total</span>
                </li>
              </ul>
            </div>

            <button
              type="button"
              onClick={onOpenAuth}
              className="mt-8 w-full py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm transition text-center cursor-pointer border border-slate-300"
            >
              Comenzar en Corporativo
            </button>
          </div>
        </div>

        {/* Soberanía de Datos y Respaldo Local Callout */}
        <div className="mt-12 max-w-4xl mx-auto p-6 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center gap-5 shadow-xs">
          <div className="p-3.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
            <HardDrive className="w-7 h-7" />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h4 className="text-base font-bold text-slate-900 flex items-center justify-center sm:justify-start gap-2">
              <span>Soberanía Absoluta de Tus Datos Contables</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Tu Información es Tuya
              </span>
            </h4>
            <p className="mt-1 text-xs sm:text-sm text-slate-600 leading-relaxed text-pretty">
              Tu información contable nunca queda atrapada. Trabaja desde cualquier computadora con respaldo automático en la nube y, cuando lo desees, descarga en 1 clic toda tu contabilidad a tu equipo (Excel, XMLs oficiales del SAT y archivo de restauración completo).
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenAuth}
            className="shrink-0 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span>Probar Respaldo</span>
          </button>
        </div>
      </div>
    </section>
  );
}
