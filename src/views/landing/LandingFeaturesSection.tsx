import {
  Calculator,
  FileCode2,
  FolderTree,
  Landmark,
  Lock,
  Scale
} from 'lucide-react';

export function LandingFeaturesSection() {
  return (
    <section id="caracteristicas" className="py-24 bg-slate-50/70 border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-mono font-bold uppercase tracking-widest">
            Cumplimiento Fiscal 100% SAT
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-slate-900 text-balance">
            Todo lo que Necesita un Despacho Contable en México
          </h2>
          <p className="mt-4 text-base text-slate-600 text-pretty">
            La misma potencia contable y fiscal que exiges para tus cierres mensuales y anuales, ahora rápida y accesible desde cualquier computadora.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Card 1 */}
          <div className="p-7 rounded-2xl bg-white border border-slate-200/90 hover:border-blue-500/50 hover:shadow-lg transition-all group shadow-xs">
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 mb-5 group-hover:scale-110 transition-transform">
              <Scale className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold text-slate-900 mb-2">Pólizas y Balanza Siempre Cuadradas</h4>
            <p className="text-sm text-slate-600 leading-relaxed text-pretty">
              Olvídate de buscar diferencias de centavos antes de enviar la Balanza al SAT.
              El sistema verifica al instante que Cargos = Abonos en cada póliza de Ingresos, Egresos, Diario y Cierre.
            </p>
          </div>

          {/* Card 2 */}
          <div className="p-7 rounded-2xl bg-white border border-slate-200/90 hover:border-emerald-500/50 hover:shadow-lg transition-all group shadow-xs">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mb-5 group-hover:scale-110 transition-transform">
              <FileCode2 className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold text-slate-900 mb-2">Bóveda CFDI 4.0 & ADD en la Nube</h4>
            <p className="text-sm text-slate-600 leading-relaxed text-pretty">
              Sube tus facturas XML o paquetes ZIP en segundos sin que el visor se trabe. LibrePaq lee RFCs, IVA y retenciones (RESICO 1.25%, Honorarios 10%, Arrendamiento)
              y arma la póliza cuadrada al instante.
            </p>
          </div>

          {/* Card 3 */}
          <div className="p-7 rounded-2xl bg-white border border-slate-200/90 hover:border-cyan-500/50 hover:shadow-lg transition-all group shadow-xs">
            <div className="w-12 h-12 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-600 mb-5 group-hover:scale-110 transition-transform">
              <FolderTree className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold text-slate-900 mb-2">Catálogo SAT Anexo 24</h4>
            <p className="text-sm text-slate-600 leading-relaxed text-pretty">
              Árbol contable de hasta 5 niveles con códigos agrupadores oficiales del SAT preconfigurados.
              Navegación ultra rápida con teclado (flechas, F2, Insert) y validación de acumulación vs. afectables.
            </p>
          </div>

          {/* Card 4 */}
          <div className="p-7 rounded-2xl bg-white border border-slate-200/90 hover:border-blue-500/50 hover:shadow-lg transition-all group shadow-xs">
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 mb-5 group-hover:scale-110 transition-transform">
              <Landmark className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold text-slate-900 mb-2">Conciliación Bancaria & DIOT</h4>
            <p className="text-sm text-slate-600 leading-relaxed text-pretty">
              Sube el estado de cuenta descargado de tu banco (BBVA, Banorte, Santander, Banamex en Excel o CSV) para conciliar movimientos
              y genera el archivo oficial de la DIOT con IVA efectivamente pagado.
            </p>
          </div>

          {/* Card 5 */}
          <div className="p-7 rounded-2xl bg-white border border-slate-200/90 hover:border-amber-500/50 hover:shadow-lg transition-all group shadow-xs">
            <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-5 group-hover:scale-110 transition-transform">
              <Calculator className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold text-slate-900 mb-2">Activos Fijos e INPC Fiscal</h4>
            <p className="text-sm text-slate-600 leading-relaxed text-pretty">
              Depreciación contable y fiscal automatizada según el Art. 31 de la LISR.
              Aplica los factores de actualización con la tabla oficial de INPC publicada en el DOF.
            </p>
          </div>

          {/* Card 6 */}
          <div className="p-7 rounded-2xl bg-white border border-slate-200/90 hover:border-purple-500/50 hover:shadow-lg transition-all group shadow-xs">
            <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 mb-5 group-hover:scale-110 transition-transform">
              <Lock className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold text-slate-900 mb-2">Candados y Cierre P13 (M13)</h4>
            <p className="text-sm text-slate-600 leading-relaxed text-pretty">
              Cierre de periodos P01 a P12 y Póliza de Ajuste de Cierre P13 (M13).
              Bloqueo estricto contra modificaciones accidentales en meses ya declarados ante el SAT.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
