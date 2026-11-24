import { Link } from '@tanstack/react-router';
import { ArrowLeft, FileCheck } from 'lucide-react';
import { LibrePaqLogo } from '../components/LibrePaqLogo';

export function TermsOfServiceView() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <a
        href="#main-content"
        className="visually-hidden focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:rounded-xl focus:bg-blue-700 focus:text-white focus:text-xs focus:font-bold focus:shadow-lg"
      >
        Saltar al contenido principal
      </a>
      {/* Barra Superior */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 min-h-14 py-2 flex flex-wrap items-center justify-between gap-2">
          <Link to="/" aria-label="Ir al inicio de LibrePaq Pro" className="flex items-center gap-2 shrink-0">
            <span className="sm:hidden">
              <LibrePaqLogo variant="horizontal" size="xs" theme="light" showSubtitle={false} />
            </span>
            <span className="hidden sm:inline-flex">
              <LibrePaqLogo variant="horizontal" size="sm" theme="light" badge="PRO" />
            </span>
          </Link>
          <nav aria-label="Navegación legal" className="flex items-center gap-2.5 sm:gap-4">
            <Link
              to="/privacy"
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition whitespace-nowrap"
            >
              Privacidad
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:text-blue-900 transition whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Inicio</span>
            </Link>
          </nav>
        </div>
      </header>

      {/* Contenido Principal de Términos del Servicio */}
      <main id="main-content" tabIndex={-1} className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 outline-none">
        <div className="bg-white rounded-3xl p-6 sm:p-10 shadow-sm border border-slate-200/80 space-y-8">
          {/* Encabezado */}
          <div className="border-b border-slate-100 pb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold mb-3 border border-blue-200">
              <FileCheck className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Contrato de Licencia y Términos de Uso</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Términos y Condiciones de Servicio
            </h1>
            <p className="mt-2 text-xs text-slate-500">
              Última actualización: 4 de noviembre de 2026 • Conforme al Código de Comercio y legislación mercantil de México
            </p>
          </div>

          {/* Sección 1: Aceptación */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-black shrink-0">
                1
              </span>
              Aceptación de los Términos
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Al registrarse, acceder o utilizar la plataforma <strong>LibrePaq Pro ERP</strong> (en adelante, el "Servicio"), usted acepta sujetarse legalmente a los presentes Términos y Condiciones. Si usted utiliza el Servicio en representación de una persona moral o despacho contable, declara contar con las facultades legales necesarias para obligar a dicha entidad.
            </p>
          </section>

          {/* Sección 2: Uso del Software y Soberanía Contable */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-black shrink-0">
                2
              </span>
              Uso del Software y Soberanía de Datos
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              LibrePaq Pro otorga al usuario una licencia no exclusiva, revocable e intransferible para el uso de su software contable en la nube. Toda la información financiera, pólizas contables, archivos CFDI 4.0 y catálogos de cuentas ingresados por el usuario son propiedad exclusiva del usuario. LibrePaq Pro no comercializa, transfiere ni utiliza su información contable para fines ajenos a la prestación del servicio.
            </p>
          </section>

          {/* Sección 3: Seguridad de la e.firma y Certificados SAT */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-black shrink-0">
                3
              </span>
              Seguridad de la Firma Electrónica Avanzada (e.firma)
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              El procesamiento de archivos de Firma Electrónica Avanzada (<code className="font-mono text-blue-700">.cer</code> y <code className="font-mono text-blue-700">.key</code>) se realiza mediante cifrado seguro local en el navegador o funciones protegidas de descarga masiva oficial ante el SAT. El usuario es el único custodio de su contraseña de clave privada. LibrePaq Pro nunca almacena contraseñas de e.firma en texto plano.
            </p>
          </section>

          {/* Sección 4: Cumplimiento Fiscal y Normativa SAT */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-black shrink-0">
                4
              </span>
              Cumplimiento Fiscal y Normativa SAT
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              LibrePaq Pro genera reportes, balanzas de comprobación y catálogos bajo las especificaciones técnicas del Anexo 24 y Anexo 20 de la Resolución Miscelánea Fiscal vigente. No obstante, la presentación formal de declaraciones, la exactitud de los datos capturados y el pago de tributos ante el SAT son responsabilidad exclusiva del contribuyente y su contador.
            </p>
          </section>

          {/* Sección 5: Disponibilidad y Cancelación */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-black shrink-0">
                5
              </span>
              Disponibilidad, Respaldos y Terminación
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              LibrePaq Pro ofrece mecanismos continuos para la exportación de respaldos completos de tu contabilidad y hojas de cálculo Excel. El usuario puede cancelar su cuenta o descargar su información contable íntegra en cualquier momento desde el módulo de Ajustes sin costo adicional.
            </p>
          </section>

          {/* Sección 6: Legislación y Jurisdicción */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-black shrink-0">
                6
              </span>
              Legislación Aplicable y Jurisdicción
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Estos términos se rigen por las leyes federales de los Estados Unidos Mexicanos y el Código de Comercio. Para la resolución de cualquier controversia, las partes se someten expresamente a la jurisdicción de los tribunales competentes en México, renunciando a cualquier otro fuero que pudiera corresponderles por razón de sus domicilios presentes o futuros.
            </p>
          </section>
        </div>
      </main>

      {/* Footer legal */}
      <footer className="max-w-4xl mx-auto px-4 sm:px-6 pt-2 pb-24 sm:pb-20 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
        <p>© {new Date().getFullYear()} LibrePaq Pro • librepaq.com</p>
        <div className="flex items-center gap-4">
          <Link to="/privacy" className="hover:text-blue-600 transition font-medium">Aviso de Privacidad</Link>
          <Link to="/" className="hover:text-blue-600 transition">Volver al Inicio</Link>
        </div>
      </footer>
    </div>
  );
}
