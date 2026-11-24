import { FormField, Input } from '../../components/ui';

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
      <FormField label="ID Fiscal Extranjero" htmlFor="tp-id-fiscal">
        <Input
          id="tp-id-fiscal"
          size="sm"
          type="text"
          disabled={isReadOnly}
          value={tpIdFiscal}
          onChange={(e) => setTpIdFiscal(e.target.value)}
          placeholder="US-99-123456"
          className="font-mono"
        />
      </FormField>

      <FormField
        label="País (ISO / SAT)"
        htmlFor="tp-pais"
        hint="Usa ZZZ si el país no está en catálogo SAT."
      >
        <Input
          id="tp-pais"
          size="sm"
          type="text"
          list="diot-paises-sat"
          maxLength={3}
          disabled={isReadOnly}
          value={tpPais}
          onChange={(e) => setTpPais(e.target.value.toUpperCase())}
          placeholder="USA / ZZZ"
          className="font-mono uppercase"
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
      </FormField>

      {tpPais.trim().toUpperCase() === 'ZZZ' && (
        <FormField label="Jurisdicción (País ZZZ)" htmlFor="tp-jurisdiccion">
          <Input
            id="tp-jurisdiccion"
            size="sm"
            type="text"
            disabled={isReadOnly}
            value={tpJurisdiccionFiscal}
            onChange={(e) => setTpJurisdiccionFiscal(e.target.value)}
            placeholder="Nombre de jurisdicción"
          />
        </FormField>
      )}
    </div>
  );
}
