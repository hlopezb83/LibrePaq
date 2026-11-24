export interface PadronExtranjeroSubpanelProps {
  isReadOnly: boolean;
  tpIdFiscal: string;
  setTpIdFiscal: (val: string) => void;
  tpPais: string;
  setTpPais: (val: string) => void;
  tpJurisdiccionFiscal: string;
  setTpJurisdiccionFiscal: (val: string) => void;
}

export function PadronExtranjeroSubpanel({
  isReadOnly,
  tpIdFiscal,
  setTpIdFiscal,
  tpPais,
  setTpPais,
  tpJurisdiccionFiscal,
  setTpJurisdiccionFiscal
}: PadronExtranjeroSubpanelProps) {
  return (
    <div className="sm:col-span-2 lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-3 rounded-lg border border-blue-200">
      <div>
        <label htmlFor="tp-id-fiscal" className="block text-[11px] font-bold text-slate-700 mb-1">
          ID Fiscal Extranjero
        </label>
        <input
          id="tp-id-fiscal"
          type="text"
          disabled={isReadOnly}
          value={tpIdFiscal}
          onChange={(e) => setTpIdFiscal(e.target.value)}
          placeholder="US-99-123456"
          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono bg-white disabled:bg-slate-100"
        />
      </div>
      <div>
        <label htmlFor="tp-pais" className="block text-[11px] font-bold text-slate-700 mb-1">
          País (ISO / SAT)
        </label>
        <input
          id="tp-pais"
          type="text"
          list="diot-paises-sat"
          maxLength={3}
          disabled={isReadOnly}
          value={tpPais}
          onChange={(e) => setTpPais(e.target.value.toUpperCase())}
          placeholder="USA / ZZZ"
          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono uppercase bg-white disabled:bg-slate-100"
        />
        <datalist id="diot-paises-sat">
          <option value="USA">Estados Unidos</option>
          <option value="CAN">Canadá</option>
          <option value="ESP">España</option>
          <option value="GBR">Reino Unido</option>
          <option value="DEU">Alemania</option>
          <option value="CHN">China</option>
          <option value="ZZZ">Otro país (especificar jurisdicción)</option>
        </datalist>
        <p className="mt-0.5 text-[10px] text-slate-500">Usa ZZZ si el país no está en catálogo SAT.</p>
      </div>
      {tpPais.trim().toUpperCase() === 'ZZZ' && (
        <div>
          <label htmlFor="tp-jurisdiccion" className="block text-[11px] font-bold text-slate-700 mb-1">
            Jurisdicción (País ZZZ)
          </label>
          <input
            id="tp-jurisdiccion"
            type="text"
            disabled={isReadOnly}
            value={tpJurisdiccionFiscal}
            onChange={(e) => setTpJurisdiccionFiscal(e.target.value)}
            placeholder="Nombre de jurisdicción"
            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white disabled:bg-slate-100"
          />
        </div>
      )}
    </div>
  );
}
