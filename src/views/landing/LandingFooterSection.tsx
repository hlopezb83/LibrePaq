import { Link } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';
import { LibrePaqLogo } from '../../components/LibrePaqLogo';

interface LandingFooterSectionProps {
  onOpenAuth?: () => void;
}

export function LandingFooterSection({ onOpenAuth }: LandingFooterSectionProps) {
  return (
    <>
      {/* Llamado a la Acción Final (CTA Banner) */}
      <section className="dark-surface py-14 sm:py-20 lg:py-24 bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 relative overflow-hidden text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white text-balance">
            Moderniza la Contabilidad de Tu Despacho Hoy Mismo
          </h2>
          <p className="mt-4 text-base sm:text-lg text-blue-100 max-w-2xl mx-auto text-pretty">
            Comienza en menos de 2 minutos. Registra tu despacho con catálogo SAT precargado y descarga tus facturas CFDI directamente a la nube.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            {onOpenAuth ? (
              <button
                type="button"
                onClick={onOpenAuth}
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white hover:bg-slate-100 text-blue-900 font-extrabold text-base transition-all shadow-xl shadow-blue-950/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Acceder al Tablero Fiscal Gratis</span>
                <ArrowRight className="w-5 h-5 text-blue-700" aria-hidden="true" />
              </button>
            ) : (
              <Link
                to="/"
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white hover:bg-slate-100 text-blue-900 font-extrabold text-base transition-all shadow-xl shadow-blue-950/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Acceder al Tablero Fiscal Gratis</span>
                <ArrowRight className="w-5 h-5 text-blue-700" aria-hidden="true" />
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Footer Profesional Completo */}
      <footer className="dark-surface bg-slate-900 border-t border-slate-800 text-slate-300 text-xs py-14 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            <div>
              <LibrePaqLogo variant="horizontal" size="md" theme="dark" badge="PRO" />
              <p className="mt-4 text-slate-300 leading-relaxed">
                Sistema Contable y Fiscal Inteligente en la Nube con Facturación Electrónica SAT Anexo 24.
              </p>
              <p className="mt-3 text-cyan-300 font-mono font-medium">
                Hecho en México para Contadores Mexicanos <span aria-hidden="true">🇲🇽</span>
              </p>
            </div>

            <div>
              <h3 className="font-bold text-white text-sm mb-3">Módulos Contables</h3>
              <ul className="space-y-2">
                <li><a href="#mod-cierre" className="hover:text-white transition cursor-pointer">Candados y Cierre P13</a></li>
                <li><a href="#mod-polizas" className="hover:text-white transition cursor-pointer">Pólizas y Movimientos</a></li>
                <li><a href="#mod-catalogo" className="hover:text-white transition cursor-pointer">Catálogo de Cuentas SAT</a></li>
                <li><a href="#mod-boveda" className="hover:text-white transition cursor-pointer">Bóveda CFDI 4.0 (ADD)</a></li>
                <li><a href="#mod-bancos" className="hover:text-white transition cursor-pointer">DIOT y Bancos</a></li>
                <li><a href="#mod-activos" className="hover:text-white transition cursor-pointer">Activos Fijos e INPC</a></li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-white text-sm mb-3">Cumplimiento Fiscal</h3>
              <ul className="space-y-2">
                <li><span className="text-slate-300">Anexo 24 de la RMF (XML v1.3)</span></li>
                <li><span className="text-slate-300">CFDI 4.0 y Complemento de Pagos 2.0</span></li>
                <li><span className="text-slate-300">Art. 14 LISR (Pagos Provisionales)</span></li>
                <li><span className="text-slate-300">Art. 31 LISR (Depreciación e INPC)</span></li>
                <li><span className="text-slate-300">Validación RFC con Dígito Verificador</span></li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-white text-sm mb-3">Legal y Soporte</h3>
              <ul className="space-y-2">
                <li><Link to="/privacy" className="hover:text-white transition">Aviso de Privacidad Integral (LFPDPPP)</Link></li>
                <li><Link to="/terms" className="hover:text-white transition">Términos y Condiciones de Uso</Link></li>
                <li>
                  <a
                    href="/Manual_Usuario_LibrePaq_Pro.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-cyan-300 transition"
                  >
                    Manual de Usuario (PDF)
                    <span className="sr-only"> (abre en nueva pestaña)</span>
                  </a>
                </li>
                <li><span className="text-slate-300">Almacenamiento Cifrado y Respaldo 1-Clic</span></li>
                <li>
                  <a href="https://wa.me/528116362252" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 transition">
                    Soporte WhatsApp: +52 81 1636 2252
                    <span className="sr-only"> (abre en nueva pestaña)</span>
                  </a>
                </li>
                <li><a href="mailto:hlopezb@gmail.com" className="hover:text-white transition">Contacto: hlopezb@gmail.com</a></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-300">
            <p>© {new Date().getFullYear()} LibrePaq Pro. Todos los derechos reservados.</p>
            <p className="max-w-xl text-center sm:text-right">
              Aviso legal: CONTPAQi® es una marca registrada propiedad de Computación en Acción, S.A. de C.V.
              LibrePaq Pro es un software contable independiente y no guarda afiliación comercial con Computación en Acción.
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
