import { Lock, ShieldCheck, FileCheck } from 'lucide-react';

export function SatFielSecuritySeals() {
  return (
    <div className="p-3 sm:p-3.5 rounded-xl bg-slate-100/80 border border-slate-200/90 text-slate-700 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
        <span>Garantía de Privacidad y Seguridad Bancaria</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-[11px] text-slate-600">
        <div className="flex items-start gap-2 bg-white/70 p-2 rounded-lg border border-slate-200">
          <Lock className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <strong className="text-slate-800 block">Cifrado Local en Memoria</strong>
            <span>Tus certificados y contraseña jamás se almacenan en texto plano en la nube.</span>
          </div>
        </div>
        <div className="flex items-start gap-2 bg-white/70 p-2 rounded-lg border border-slate-200">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <strong className="text-slate-800 block">Conexión Cifrada SAT</strong>
            <span>Comunicación oficial y cifrada con los servidores centrales del SAT.</span>
          </div>
        </div>
        <div className="flex items-start gap-2 bg-white/70 p-2 rounded-lg border border-slate-200">
          <FileCheck className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <strong className="text-slate-800 block">Art. 17-D CFF Oficial</strong>
            <span>Uso exclusivo para la descarga de comprobantes fiscales de tu empresa.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
