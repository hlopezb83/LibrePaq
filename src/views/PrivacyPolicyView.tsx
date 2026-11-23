import { Link } from '@tanstack/react-router';
import { ArrowLeft, ShieldCheck, Lock, CheckCircle2 } from 'lucide-react';
import { LibrePaqLogo } from '../components/LibrePaqLogo';

export function PrivacyPolicyView() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Barra Superior */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 min-h-16 py-2 flex flex-wrap items-center justify-between gap-2">
          <Link to="/" aria-label="Ir al inicio de LibrePaq Pro" className="flex items-center gap-2">
            <LibrePaqLogo variant="horizontal" size="sm" theme="light" badge="PRO" />
          </Link>
          <div className="flex items-center gap-4">
            <Link
              to="/terms"
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
            >
              Términos de Servicio
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-900 transition"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              <span>Volver al Inicio</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Contenido Principal del Aviso de Privacidad */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white rounded-3xl p-6 sm:p-10 shadow-sm border border-slate-200/80 space-y-8">
          {/* Encabezado */}
          <div className="border-b border-slate-100 pb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold mb-3 border border-blue-200">
              <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Aviso de Privacidad Integral</span>
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Política de Privacidad y Protección de Datos
            </h1>
            <p className="mt-2 text-xs text-slate-500">
              Última actualización: 28 de octubre de 2026 • Conforme a la LFPDPPP y Políticas de Google API Services
            </p>
          </div>

          {/* Sección 1 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-black">
                1
              </span>
              Identidad y Responsable del Tratamiento
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              <strong>LibrePaq Pro</strong> (accesible a través de <code>https://librepaq.com</code>) es un sistema contable y fiscal en la nube diseñado para personas físicas, morales y despachos contables en México. Nos comprometemos a salvaguardar la privacidad de tus datos personales, fiscales y empresariales mediante los más altos estándares de cifrado y soberanía de la información.
            </p>
          </section>

          {/* Sección 2 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-black">
                2
              </span>
              Datos Personales que Recabamos
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Para brindarte acceso al sistema y permitir la contabilidad fiscal automatizada, recabamos exclusivamente:
            </p>
            <ul className="text-sm text-slate-600 space-y-2 list-disc pl-5">
              <li><strong>Datos de Identificación y Contacto:</strong> Nombre completo, dirección de correo electrónico y fotografía de perfil proporcionados voluntariamente mediante el registro directo o a través del inicio de sesión con Google (OAuth 2.0).</li>
              <li><strong>Datos Fiscales y Contables:</strong> RFC (Registro Federal de Contribuyentes), razón social o denominación, catálogo de cuentas SAT, comprobantes fiscales digitales por internet (CFDI 4.0 en formato XML) y pólizas contables registradas por el usuario.</li>
            </ul>
          </section>

          {/* Sección 3 - Cumplimiento específico Google API */}
          <section className="space-y-3 bg-blue-50/50 p-5 rounded-2xl border border-blue-100">
            <h2 className="text-lg font-bold text-blue-950 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-black shrink-0">
                3
              </span>
              <Lock className="w-4 h-4 text-blue-600 shrink-0" aria-hidden="true" />
              <span>Uso de Datos de Servicios de Google (Google API Limited Use)</span>
            </h2>
            <p className="text-sm text-slate-700 leading-relaxed">
              El uso y la transferencia que LibrePaq Pro hace de la información recibida desde las APIs de Google se apegan estrictamente a la <strong>Política de Datos de Usuario de los Servicios de Google API (Google API Services User Data Policy)</strong>, incluidos los requisitos de Uso Limitado (Limited Use):
            </p>
            <ul className="text-sm text-slate-700 space-y-2 pl-2">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                <span>Solo solicitamos los permisos básicos de autenticación (<code>email</code>, <code>profile</code> y <code>openid</code>) para verificar tu identidad y permitirte el acceso seguro.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                <span><strong>No vendemos, rentamos ni transferimos</strong> tus datos personales o fiscales a corredores de datos ni a terceros con fines comerciales o de publicidad.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                <span>No utilizamos tus datos personales ni tu información contable para entrenar modelos generalizados de inteligencia artificial sin tu expreso consentimiento.</span>
              </li>
            </ul>
          </section>

          {/* Sección 4 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-black">
                4
              </span>
              Finalidades del Tratamiento
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Tus datos son tratados exclusivamente para:
            </p>
            <ol className="text-sm text-slate-600 space-y-1.5 list-decimal pl-5">
              <li>Permitirte iniciar sesión y administrar tu sesión en la nube.</li>
              <li>Generar tus pólizas contables, libros diarios y balanzas de comprobación conforme al Anexo 24 del SAT.</li>
              <li>Almacenar de forma cifrada y respaldar tus CFDI en la bóveda digital (ADD).</li>
              <li>Permitirte descargar respaldos completos de tu contabilidad en tu computadora local.</li>
            </ol>
          </section>

          {/* Sección 5 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-black">
                5
              </span>
              Soberanía de Datos y Derechos ARCO
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              En LibrePaq Pro tu contabilidad nunca está secuestrada. Tienes pleno derecho de <strong>Acceso, Rectificación, Cancelación y Oposición (ARCO)</strong> sobre tus datos personales y contables. En cualquier momento puedes:
            </p>
            <ul className="text-sm text-slate-600 space-y-1.5 list-disc pl-5">
              <li>Descargar en 1 clic un respaldo total de todas tus empresas en formato JSON, Excel/CSV y XMLs oficiales en tu equipo local.</li>
              <li>Solicitar la eliminación definitiva de tu cuenta y de tus registros contables de nuestros servidores en la nube.</li>
            </ul>
            <p className="text-sm text-slate-600 mt-2">
              Para ejercer tus derechos ARCO o plantear cualquier consulta sobre privacidad, contacta a nuestro oficial de privacidad al correo: <a href="mailto:hlopezb@gmail.com" className="text-blue-600 font-semibold underline">hlopezb@gmail.com</a>.
            </p>
          </section>

          {/* Footer de la política */}
          <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
            <p>© {new Date().getFullYear()} LibrePaq Pro • librepaq.com</p>
            <div className="flex items-center gap-4">
              <Link to="/terms" className="hover:text-blue-600 transition font-medium">Términos y Condiciones</Link>
              <Link to="/" className="hover:text-blue-600 transition">Volver al Inicio</Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default PrivacyPolicyView;
