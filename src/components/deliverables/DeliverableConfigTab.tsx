interface DeliverableConfigTabProps {
  firmName: string;
  setFirmName: (val: string) => void;
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
  includeBalanza: boolean;
  setIncludeBalanza: (val: boolean) => void;
  includeResultados: boolean;
  setIncludeResultados: (val: boolean) => void;
  includeBalance: boolean;
  setIncludeBalance: (val: boolean) => void;
  includeDia17: boolean;
  setIncludeDia17: (val: boolean) => void;
  onPreviewDossier: () => void;
}

export function DeliverableConfigTab({
  firmName,
  setFirmName,
  issuanceCity,
  setIssuanceCity,
  issuanceDate,
  setIssuanceDate,
  auditorName,
  setAuditorName,
  auditorCedula,
  setAuditorCedula,
  legalRepName,
  setLegalRepName,
  legalRepTitle,
  setLegalRepTitle,
  includeBalanza,
  setIncludeBalanza,
  includeResultados,
  setIncludeResultados,
  includeBalance,
  setIncludeBalance,
  includeDia17,
  setIncludeDia17,
  onPreviewDossier
}: DeliverableConfigTabProps) {
  return (
    <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-slate-300 p-6 space-y-6 shadow-xs no-print">
      <div className="border-b border-slate-200 pb-3">
        <h2 className="text-base font-bold text-slate-900">
          Configuración del Membrete y Firmas del Dictamen
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Personaliza los datos del despacho contable, los auditores titulados y los documentos que se imprimirán en el Dossier.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div>
          <label htmlFor="deliv-firm-name" className="block font-semibold text-slate-700 mb-1">
            Firma Contable / Despacho Auditor
          </label>
          <input
            id="deliv-firm-name"
            type="text"
            value={firmName}
            onChange={(e) => setFirmName(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-300"
          />
        </div>

        <div>
          <label htmlFor="deliv-issuance-city" className="block font-semibold text-slate-700 mb-1">
            Lugar de Emisión
          </label>
          <input
            id="deliv-issuance-city"
            type="text"
            value={issuanceCity}
            onChange={(e) => setIssuanceCity(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-300"
          />
        </div>

        <div>
          <label htmlFor="deliv-issuance-date" className="block font-semibold text-slate-700 mb-1">
            Fecha Formal de Emisión
          </label>
          <input
            id="deliv-issuance-date"
            type="text"
            value={issuanceDate}
            onChange={(e) => setIssuanceDate(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-300"
          />
        </div>

        <div>
          <label htmlFor="deliv-auditor-name" className="block font-semibold text-slate-700 mb-1">
            Contador Público / Auditor (Revisó)
          </label>
          <input
            id="deliv-auditor-name"
            type="text"
            value={auditorName}
            onChange={(e) => setAuditorName(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-300"
          />
        </div>

        <div>
          <label htmlFor="deliv-auditor-cedula" className="block font-semibold text-slate-700 mb-1">
            Cédula Profesional del Auditor
          </label>
          <input
            id="deliv-auditor-cedula"
            type="text"
            value={auditorCedula}
            onChange={(e) => setAuditorCedula(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-300"
          />
        </div>

        <div>
          <label htmlFor="deliv-legal-rep-name" className="block font-semibold text-slate-700 mb-1">
            Representante Legal (Autorizó)
          </label>
          <input
            id="deliv-legal-rep-name"
            type="text"
            value={legalRepName}
            onChange={(e) => setLegalRepName(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-300"
          />
        </div>

        <div>
          <label htmlFor="deliv-legal-rep-title" className="block font-semibold text-slate-700 mb-1">
            Cargo o Título Legal
          </label>
          <input
            id="deliv-legal-rep-title"
            type="text"
            value={legalRepTitle}
            onChange={(e) => setLegalRepTitle(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-300"
          />
        </div>
      </div>

      <div className="border-t border-slate-200 pt-4">
        <span className="text-xs font-bold text-slate-900 block mb-2">
          Documentos incluidos al Imprimir o Generar PDF del Dossier Completo:
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <label htmlFor="deliv-include-balanza" className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
            <input
              id="deliv-include-balanza"
              type="checkbox"
              checked={includeBalanza}
              onChange={(e) => setIncludeBalanza(e.target.checked)}
              className="rounded text-blue-700"
            />
            <span>1. Balanza de Comprobación Anexo 24 (SAT)</span>
          </label>

          <label htmlFor="deliv-include-resultados" className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
            <input
              id="deliv-include-resultados"
              type="checkbox"
              checked={includeResultados}
              onChange={(e) => setIncludeResultados(e.target.checked)}
              className="rounded text-blue-700"
            />
            <span>2. Estado de Resultados Integral (NIF B-3)</span>
          </label>

          <label htmlFor="deliv-include-balance" className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
            <input
              id="deliv-include-balance"
              type="checkbox"
              checked={includeBalance}
              onChange={(e) => setIncludeBalance(e.target.checked)}
              className="rounded text-blue-700"
            />
            <span>3. Balance General (NIF B-6)</span>
          </label>

          <label htmlFor="deliv-include-dia17" className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
            <input
              id="deliv-include-dia17"
              type="checkbox"
              checked={includeDia17}
              onChange={(e) => setIncludeDia17(e.target.checked)}
              className="rounded text-blue-700"
            />
            <span>4. Cédula Impuestos Federales Día 17</span>
          </label>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={onPreviewDossier}
          className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-xs font-semibold text-white cursor-pointer"
        >
          Ver Vista Previa del Dossier →
        </button>
      </div>
    </div>
  );
}
