import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

const FAQ_ITEMS = [
  {
    q: '¿Por qué todos los planes son gratis por tiempo limitado?',
    a: 'Queremos que todos los contadores, despachos y empresarios de México comprueben de primera mano una alternativa ágil y confiable a CONTPAQi® sin gastar más de $20,000 MXN en licencias ni soporte técnico. Durante este periodo especial de lanzamiento, el acceso a todos los planes (incluyendo Pro y Corporativo) es 100% gratuito.'
  },
  {
    q: '¿Necesito instalar algún programa en mi computadora o pagarle a un técnico?',
    a: 'No, en lo absoluto. No instalas nada ni dependes de una computadora principal prendida en la oficina. Solo entras desde tu navegador web (en tu oficina, tu casa o cualquier laptop) y comienzas a llevar tus empresas de inmediato.'
  },
  {
    q: '¿Puedo descargar y guardar mis respaldos en mi propia computadora?',
    a: 'Sí, tu información siempre es tuya. En cualquier momento y con un solo clic puedes descargar un respaldo completo de tus empresas, pólizas, balanzas, catálogos y XMLs directamente a tu computadora (en Excel, XMLs oficiales y archivo de restauración). Tu contabilidad nunca queda atrapada.'
  },
  {
    q: '¿LibrePaq Pro genera el archivo XML oficial para enviar la Balanza al SAT?',
    a: 'Sí, totalmente. LibrePaq Pro genera la Balanza de Comprobación (mensual y cierre anual mes 13), el Catálogo de Cuentas y Pólizas en el formato XML oficial del Anexo 24 vigente, listo para subirse al Buzón Tributario del SAT.'
  },
  {
    q: '¿Puedo migrar mi catálogo de cuentas y saldos desde CONTPAQi® o Anexo 24?',
    a: 'Por supuesto. Puedes importar tu catálogo agrupador y saldos iniciales en menos de 1 minuto desde CSV, Excel, CT.xml / BN.xml Anexo 24 y catálogo TXT CONTPAQi®, o dar de alta tu empresa en segundos cargando tus XML CFDI 4.0.'
  },
  {
    q: '¿Funciona en cualquier computadora Windows, Mac o tablet?',
    a: 'Sí. Funciona al instante en Google Chrome, Microsoft Edge o Safari desde cualquier PC con Windows, Mac o iPad, sin pagar licencias adicionales por cada computadora donde entres.'
  },
  {
    q: '¿Cómo garantizan que mis pólizas y mi Balanza nunca tengan diferencias de centavos?',
    a: 'El sistema revisa cada cargo y cada abono exactamente al centavo en tiempo real y no permite guardar una póliza descuadrada. Así tus auxiliares, Estados Financieros y Balanza de Comprobación del SAT cuadran siempre al 100%.'
  }
];

export function LandingFaqSection() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const panelRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    const cleanups: Array<() => void> = [];
    panelRefs.current.forEach((el, idx) => {
      if (!el) return;
      const onBeforeMatch = () => setOpenFaq(idx);
      el.addEventListener('beforematch', onBeforeMatch);
      cleanups.push(() => el.removeEventListener('beforematch', onBeforeMatch));
    });
    return () => cleanups.forEach((fn) => fn());
  }, []);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <section id="faq" className="py-24 bg-slate-50/70 border-t border-slate-200">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-mono font-bold uppercase tracking-wider">
            RESOLVEMOS TUS DUDAS
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-slate-900 text-balance">
            Preguntas Frecuentes de Contadores y Asesores Fiscales
          </h2>
        </div>

        <div className="space-y-4">
          {FAQ_ITEMS.map((item, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={idx}
                className="rounded-xl border border-slate-200 bg-white overflow-hidden transition-all shadow-xs"
              >
                <h3>
                  <button
                    id={`faq-btn-${idx}`}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={`faq-panel-${idx}`}
                    onClick={() => toggleFaq(idx)}
                    className="w-full py-4 px-6 text-left flex items-center justify-between gap-4 font-semibold text-slate-900 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:-outline-offset-2 transition cursor-pointer"
                  >
                    <span className="text-base text-balance">{item.q}</span>
                    <ChevronDown
                      aria-hidden="true"
                      className={`w-5 h-5 text-slate-600 shrink-0 transition-transform ${
                        isOpen ? 'rotate-180 text-blue-700' : ''
                      }`}
                    />
                  </button>
                </h3>
                <div
                  ref={(el) => {
                    panelRefs.current[idx] = el;
                  }}
                  id={`faq-panel-${idx}`}
                  role="region"
                  aria-labelledby={`faq-btn-${idx}`}
                  hidden={!isOpen ? ('until-found' as unknown as boolean) : false}
                  className="px-6 pb-5 pt-2 text-sm text-slate-700 leading-relaxed border-t border-slate-100 text-pretty"
                >
                  {item.a}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
