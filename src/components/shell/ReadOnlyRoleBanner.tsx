import { Eye } from 'lucide-react';

export function ReadOnlyRoleBanner() {
  return (
    <div
      role="status"
      aria-label="Acceso de Cliente (Solo lectura)"
      className="bg-sky-50 border-b border-sky-200 text-sky-950 px-3 sm:px-5 py-2 no-print"
    >
      <div className="max-w-[1800px] mx-auto flex items-center gap-2.5 text-xs">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-sky-100 border border-sky-200 text-sky-700 shrink-0">
          <Eye className="w-3.5 h-3.5" aria-hidden="true" />
        </span>
        <p className="leading-snug">
          <strong className="font-bold text-sky-950">Acceso de Cliente (Solo lectura)</strong>
          {' — '}
          Puedes consultar reportes, pólizas, XML y exportar Excel/PDF. Las ediciones las gestiona tu Despacho.
        </p>
      </div>
    </div>
  );
}
