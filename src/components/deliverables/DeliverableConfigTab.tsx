import { useState, type ChangeEvent } from 'react';
import { Cloud, ImagePlus, Trash2 } from 'lucide-react';

interface DeliverableConfigTabProps {
  firmName: string;
  setFirmName: (val: string) => void;
  preparerName: string;
  setPreparerName: (val: string) => void;
  issuanceCity: string;
  setIssuanceCity: (val: string) => void;
  issuanceDate: string;
  setIssuanceDate: (val: string) => void;
  auditorName: string;
  setAuditorName: (val: string) => void;
  auditorCedula: string;
  setAuditorCedula: (val: string) => void;
  legalRepName: string;
  setLegalRepName: (val: string) => void;
  legalRepTitle: string;
  setLegalRepTitle: (val: string) => void;
  logoDataUrl: string;
  setLogoDataUrl: (val: string) => void;
  accountantNotes: string;
  setAccountantNotes: (val: string) => void;
  includeCoverRatios: boolean;
  setIncludeCoverRatios: (val: boolean) => void;
  includeBalanza: boolean;
  setIncludeBalanza: (val: boolean) => void;
  includeResultados: boolean;
  setIncludeResultados: (val: boolean) => void;
  includeBalance: boolean;
  setIncludeBalance: (val: boolean) => void;
  includeNifAging: boolean;
  setIncludeNifAging: (val: boolean) => void;
  includeDia17: boolean;
  setIncludeDia17: (val: boolean) => void;
  hideZeroAccounts?: boolean;
  setHideZeroAccounts?: (val: boolean) => void;
  isReadOnly?: boolean;
  isSavingBranding?: boolean;
  onSaveBranding?: () => void;
  onPreviewDossier: () => void;
}

export function DeliverableConfigTab({
  firmName, setFirmName,
  preparerName, setPreparerName,
  issuanceCity, setIssuanceCity,
  issuanceDate, setIssuanceDate,
  auditorName, setAuditorName,
  auditorCedula, setAuditorCedula,
  legalRepName, setLegalRepName,
  legalRepTitle, setLegalRepTitle,
  logoDataUrl, setLogoDataUrl,
  accountantNotes, setAccountantNotes,
  includeCoverRatios, setIncludeCoverRatios,
  includeBalanza, setIncludeBalanza,
  includeResultados, setIncludeResultados,
  includeBalance, setIncludeBalance,
  includeNifAging, setIncludeNifAging,
  includeDia17, setIncludeDia17,
  hideZeroAccounts = false, setHideZeroAccounts,
  isReadOnly = false, isSavingBranding = false, onSaveBranding,
  onPreviewDossier
}: DeliverableConfigTabProps) {
  const [logoError, setLogoError] = useState<string | null>(null);

  const handleLogoFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      setLogoError('El logotipo debe pesar máximo 500 KB (PNG, JPG, WEBP o SVG).');
      return;
    }
    setLogoError(null);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setLogoDataUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const docsList = [
    { id: 'deliv-include-cover', label: '0. Portada Ejecutiva, Razones Financieras y Notas', checked: includeCoverRatios, set: setIncludeCoverRatios },
    { id: 'deliv-include-balanza', label: '1. Balanza de Comprobación Anexo 24 (SAT)', checked: includeBalanza, set: setIncludeBalanza },
    { id: 'deliv-include-resultados', label: '2. Estado de Resultados Integral (NIF B-3 Mes + YTD)', checked: includeResultados, set: setIncludeResultados },
    { id: 'deliv-include-balance', label: '3. Balance General Clasificado (NIF B-6)', checked: includeBalance, set: setIncludeBalance },
    { id: 'deliv-include-nif-aging', label: '4. Flujos (NIF B-2), Capital (NIF B-4) y Aging CxC/CxP', checked: includeNifAging, set: setIncludeNifAging },
    { id: 'deliv-include-dia17', label: '5. Cédula Impuestos Federales Día 17', checked: includeDia17, set: setIncludeDia17 }
  ];

  return (
    <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-slate-300 p-6 space-y-5 shadow-xs no-print">
      <div className="border-b border-slate-200 pb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Configuración del Membrete, Logotipo, Notas y Firmas del Dictamen
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Personaliza los datos del despacho contable, auditores titulados, notas ejecutivas y secciones del Dossier.
          </p>
        </div>
        {onSaveBranding && !isReadOnly && (
          <button
            type="button"
            disabled={isSavingBranding}
            onClick={onSaveBranding}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-xs font-bold text-white transition cursor-pointer"
          >
            <Cloud className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{isSavingBranding ? 'Guardando...' : 'Guardar en la Nube'}</span>
          </button>
        )}
      </div>

      {isReadOnly && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs text-blue-900">
          Modo solo lectura: visualizas el membrete oficial configurado por tu despacho contable.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div>
          <label htmlFor="deliv-firm-name" className="block font-semibold text-slate-700 mb-1">Firma Contable / Despacho Auditor</label>
          <input id="deliv-firm-name" type="text" disabled={isReadOnly} value={firmName} onChange={(e) => setFirmName(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-300 disabled:bg-slate-100" />
        </div>
        <div>
          <label htmlFor="deliv-issuance-city" className="block font-semibold text-slate-700 mb-1">Lugar de Emisión</label>
          <input id="deliv-issuance-city" type="text" disabled={isReadOnly} value={issuanceCity} onChange={(e) => setIssuanceCity(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-300 disabled:bg-slate-100" />
        </div>
        <div>
          <label htmlFor="deliv-issuance-date" className="block font-semibold text-slate-700 mb-1">Fecha Formal de Emisión</label>
          <input id="deliv-issuance-date" type="text" disabled={isReadOnly} value={issuanceDate} onChange={(e) => setIssuanceDate(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-300 disabled:bg-slate-100" />
        </div>
        <div>
          <label htmlFor="deliv-preparer-name" className="block font-semibold text-slate-700 mb-1">Preparó / Elaboró (Contador o Auxiliar)</label>
          <input id="deliv-preparer-name" type="text" disabled={isReadOnly} value={preparerName} onChange={(e) => setPreparerName(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-300 disabled:bg-slate-100" />
        </div>
        <div>
          <label htmlFor="deliv-auditor-name" className="block font-semibold text-slate-700 mb-1">Contador Público / Auditor (Revisó)</label>
          <input id="deliv-auditor-name" type="text" disabled={isReadOnly} value={auditorName} onChange={(e) => setAuditorName(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-300 disabled:bg-slate-100" />
        </div>
        <div>
          <label htmlFor="deliv-auditor-cedula" className="block font-semibold text-slate-700 mb-1">Cédula Profesional del Auditor</label>
          <input id="deliv-auditor-cedula" type="text" disabled={isReadOnly} value={auditorCedula} onChange={(e) => setAuditorCedula(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-300 disabled:bg-slate-100" />
        </div>
        <div>
          <label htmlFor="deliv-legal-rep-name" className="block font-semibold text-slate-700 mb-1">Representante Legal (Autorizó)</label>
          <input id="deliv-legal-rep-name" type="text" disabled={isReadOnly} value={legalRepName} onChange={(e) => setLegalRepName(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-300 disabled:bg-slate-100" />
        </div>
        <div>
          <label htmlFor="deliv-legal-rep-title" className="block font-semibold text-slate-700 mb-1">Cargo o Título Legal</label>
          <input id="deliv-legal-rep-title" type="text" disabled={isReadOnly} value={legalRepTitle} onChange={(e) => setLegalRepTitle(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-300 disabled:bg-slate-100" />
        </div>
      </div>

      <div className="border-t border-slate-200 pt-4 space-y-3 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-bold text-slate-900">Logotipo del Despacho (Opcional)</div>
            <p className="text-[11px] text-slate-500">Se muestra en los encabezados impresos y PDF (máx. 500 KB).</p>
          </div>
          {!isReadOnly && (
            <div className="flex items-center gap-2">
              <label htmlFor="deliv-logo-upload" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 font-semibold text-slate-700 cursor-pointer">
                <ImagePlus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Subir Imagen</span>
                <input id="deliv-logo-upload" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleLogoFileChange} className="sr-only" />
              </label>
              {logoDataUrl && (
                <button type="button" onClick={() => setLogoDataUrl('')} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-red-200 text-red-700 hover:bg-red-50 cursor-pointer">
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> Quitar
                </button>
              )}
            </div>
          )}
        </div>
        {logoError && <p className="text-red-700 font-medium">{logoError}</p>}
        {logoDataUrl && (
          <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 inline-flex items-center gap-3">
            <img src={logoDataUrl} alt="Logotipo del despacho" className="max-h-12 w-auto object-contain rounded" />
            <span className="text-[11px] text-slate-600">Vista previa del membrete</span>
          </div>
        )}

        <div>
          <label htmlFor="deliv-accountant-notes" className="block font-bold text-slate-900 mb-1">
            Notas Ejecutivas del Contador / Observaciones a Socios
          </label>
          <textarea
            id="deliv-accountant-notes"
            rows={3}
            disabled={isReadOnly}
            value={accountantNotes}
            onChange={(e) => setAccountantNotes(e.target.value)}
            placeholder="Ej. Comentarios sobre flujo de efectivo, variaciones de márgenes, cumplimiento SAT Día 17 o recomendaciones fiscales..."
            className="w-full px-3 py-2 rounded-xl border border-slate-300 disabled:bg-slate-100"
          />
        </div>
      </div>

      <fieldset className="border-t border-slate-200 pt-4">
        <legend className="text-xs font-bold text-slate-900 mb-2">
          Secciones incluidas en Impresión / PDF y Exportación Excel / ZIP:
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
          {docsList.map((doc) => (
            <label key={doc.id} htmlFor={doc.id} className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
              <input id={doc.id} type="checkbox" checked={doc.checked} onChange={(e) => doc.set(e.target.checked)} className="rounded text-blue-700" />
              <span>{doc.label}</span>
            </label>
          ))}
        </div>
        {setHideZeroAccounts && (
          <label htmlFor="deliv-hide-zero-accounts" className="mt-3 flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer text-xs">
            <input id="deliv-hide-zero-accounts" type="checkbox" checked={hideZeroAccounts} onChange={(e) => setHideZeroAccounts(e.target.checked)} className="rounded text-blue-700" />
            <span>Ocultar cuentas sin movimiento ni saldo ($0.00) en PDF, Excel y ZIP</span>
          </label>
        )}
      </fieldset>

      <div className="flex justify-end pt-2">
        <button type="button" onClick={onPreviewDossier} className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-xs font-semibold text-white cursor-pointer">
          Ver Vista Previa del Dossier →
        </button>
      </div>
    </div>
  );
}
