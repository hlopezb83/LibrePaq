import {
  AlertCircle,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { REGIMENES_FISCALES_SAT, MESES_SAT } from '../../shared/sat-constants';
import type { RfcModulo11Result } from '../../shared/accounting-engine';
import type { CfdiCompanyCandidate } from '../../shared/cfdi-company-extractor';
import { WizardXmlAutofillBox } from './WizardXmlAutofillBox';
import { WizardModulo11Breakdown } from './WizardModulo11Breakdown';
import { WizardPersonTypeSelector } from './WizardPersonTypeSelector';

const MORAL_REGIMEN_CODES = new Set(['601', '603', '610', '620', '622', '623', '624', '626']);
const FISICA_REGIMEN_CODES = new Set([
  '605', '606', '607', '608', '610', '611', '612', '614', '615', '616', '621', '622', '625', '626'
]);

export function filterRegimenesByPersonType(personType: 'MORAL' | 'FISICA'): string[] {
  const allowed = personType === 'MORAL' ? MORAL_REGIMEN_CODES : FISICA_REGIMEN_CODES;
  return REGIMENES_FISCALES_SAT.filter((reg) => allowed.has(reg.slice(0, 3)));
}

interface WizardStep1IdentityProps {
  personType: 'MORAL' | 'FISICA';
  setPersonType: (type: 'MORAL' | 'FISICA') => void;
  name: string;
  setName: (name: string) => void;
  rfc: string;
  setRfc: (rfc: string) => void;
  codigoPostal: string;
  setCodigoPostal: (cp: string) => void;
  regimenFiscal: string;
  setRegimenFiscal: (regimen: string) => void;
  currentYear: number;
  setCurrentYear: (year: number) => void;
  currentPeriod: number;
  setCurrentPeriod: (period: number) => void;
  isRfcValid: boolean;
  rfcModulo11: RfcModulo11Result | null;
  showModulo11Breakdown: boolean;
  setShowModulo11Breakdown: (show: boolean) => void;
  setBypassRfcCheckDigit: (bypass: boolean) => void;
  onClearModulo11Error: () => void;
  xmlCandidates: CfdiCompanyCandidate[];
  activeXmlRole: 'EMISOR' | 'RECEPTOR' | null;
  onXmlLoaded: (xmlText: string) => void;
  onFileLoaded?: (file: File) => void | Promise<void>;
  onSelectXmlCandidate: (candidate: CfdiCompanyCandidate) => void;
}

export function WizardStep1Identity({
  personType,
  setPersonType,
  name,
  setName,
  rfc,
  setRfc,
  codigoPostal,
  setCodigoPostal,
  regimenFiscal,
  setRegimenFiscal,
  currentYear,
  setCurrentYear,
  currentPeriod,
  setCurrentPeriod,
  isRfcValid,
  rfcModulo11,
  showModulo11Breakdown,
  setShowModulo11Breakdown,
  setBypassRfcCheckDigit,
  onClearModulo11Error,
  xmlCandidates,
  activeXmlRole,
  onXmlLoaded,
  onFileLoaded,
  onSelectXmlCandidate
}: WizardStep1IdentityProps) {
  const regimenesDisponibles = filterRegimenesByPersonType(personType);
  const selectRegimenes = regimenesDisponibles.includes(regimenFiscal)
    ? regimenesDisponibles
    : regimenFiscal
      ? [regimenFiscal, ...regimenesDisponibles]
      : regimenesDisponibles;

  const showNameError = name.trim().length > 0 && name.trim().length < 3;
  const showRfcError = rfc.length > 0 && !isRfcValid;
  const showCpError = codigoPostal.length > 0 && !/^(?!00000)\d{5}$/.test(codigoPostal);

  const handleRfcChange = (rawVal: string) => {
    const nextRfc = rawVal.toUpperCase().replace(/[^A-Z0-9&Ñ]/g, '').slice(0, 13);
    if (nextRfc.length === 13 && /^[A-Z&Ñ]{4}\d{6}/.test(nextRfc) && personType !== 'FISICA') {
      setPersonType('FISICA');
      if (MORAL_REGIMEN_CODES.has(regimenFiscal.slice(0, 3)) && regimenFiscal.slice(0, 3) !== '626') {
        setRegimenFiscal('612 - Personas Físicas con Actividades Empresariales y Profesionales');
      }
    } else if (nextRfc.length === 12 && /^[A-Z&Ñ]{3}\d{6}/.test(nextRfc) && personType !== 'MORAL') {
      setPersonType('MORAL');
      if (!MORAL_REGIMEN_CODES.has(regimenFiscal.slice(0, 3))) {
        setRegimenFiscal(REGIMENES_FISCALES_SAT[0] ?? '601 - General de Ley Personas Morales');
      }
    }
    setRfc(nextRfc);
    setBypassRfcCheckDigit(false);
    onClearModulo11Error();
  };

  return (
    <div className="space-y-4">
      <WizardXmlAutofillBox
        candidates={xmlCandidates}
        activeRole={activeXmlRole}
        onXmlLoaded={onXmlLoaded}
        onFileLoaded={onFileLoaded}
        onSelectCandidate={onSelectXmlCandidate}
      />

      <WizardPersonTypeSelector
        personType={personType}
        onSelectPersonType={(nextType, defaultRegimen) => {
          setPersonType(nextType);
          setRegimenFiscal(defaultRegimen);
        }}
      />

      <div>
        <label htmlFor="wizard-comp-name" className="block text-xs font-bold text-slate-700 mb-1">
          Razón Social o Nombre Completo *
        </label>
        <input
          id="wizard-comp-name"
          type="text"
          required
          aria-invalid={showNameError}
          aria-describedby={showNameError ? 'wizard-name-error' : undefined}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={
            personType === 'MORAL'
              ? 'Ej. Soluciones Contables y Fiscales S.A. de C.V.'
              : 'Ej. Lic. Laura Gómez Morales'
          }
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-blue-700 focus:ring-1 focus:ring-blue-700"
        />
        {showNameError && (
          <p id="wizard-name-error" className="mt-1 text-[11px] font-medium text-red-700">
            Captura al menos 3 caracteres para la razón social o nombre.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="sm:col-span-1">
          <div className="flex items-center justify-between mb-1 flex-wrap gap-1">
            <label htmlFor="wizard-comp-rfc" className="block text-xs font-bold text-slate-700">
              RFC {personType === 'MORAL' ? '(12 caracteres)' : '(13 caracteres)'} *
            </label>
            {isRfcValid && rfcModulo11 && (rfcModulo11.isValidCheckDigit || rfcModulo11.expectedCheckDigit) && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {rfcModulo11.isValidCheckDigit ? (
                  <span
                    className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1"
                    title={rfcModulo11.message}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" /> Dígito SAT válido
                  </span>
                ) : (
                  <>
                    <span
                      className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 flex items-center gap-1"
                      title={rfcModulo11.message}
                    >
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
                      Dígito esperado: {rfcModulo11.expectedCheckDigit}
                    </span>
                    {rfcModulo11.expectedRfc && (
                      <button
                        type="button"
                        onClick={() => {
                          setRfc(rfcModulo11.expectedRfc!);
                          setBypassRfcCheckDigit(false);
                          onClearModulo11Error();
                        }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors shadow-xs cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3 text-blue-600" aria-hidden="true" />
                        Corregir a {rfcModulo11.expectedCheckDigit}
                      </button>
                    )}
                  </>
                )}
                {rfcModulo11.steps.length > 0 && (
                  <button
                    type="button"
                    aria-expanded={showModulo11Breakdown}
                    onClick={() => setShowModulo11Breakdown(!showModulo11Breakdown)}
                    className="text-[11px] font-medium text-slate-600 hover:text-slate-800 underline ml-0.5 cursor-pointer"
                  >
                    {showModulo11Breakdown ? 'Ocultar detalle' : 'Ver detalle'}
                  </button>
                )}
              </div>
            )}
          </div>
          <input
            id="wizard-comp-rfc"
            type="text"
            required
            spellCheck={false}
            maxLength={13}
            aria-invalid={showRfcError}
            aria-describedby={showRfcError ? 'wizard-rfc-error' : undefined}
            value={rfc}
            onChange={(e) => handleRfcChange(e.target.value)}
            placeholder={personType === 'MORAL' ? 'BBA830831LJ2' : 'GODE561231GR8'}
            className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono uppercase focus:ring-1 ${
              isRfcValid
                ? rfcModulo11?.isValidCheckDigit
                  ? 'border-emerald-500 bg-emerald-50/20 text-slate-900 focus:border-emerald-600 focus:ring-emerald-600'
                  : 'border-amber-400 bg-amber-50/20 text-slate-900 focus:border-amber-500 focus:ring-amber-500'
                : 'border-slate-300 focus:border-blue-700 focus:ring-blue-700'
            }`}
          />
          {showRfcError && (
            <p id="wizard-rfc-error" className="mt-1 text-[11px] font-medium text-red-700">
              {personType === 'MORAL'
                ? 'Formato esperado: 3 letras + 6 dígitos + 3 caracteres (puedes pegar RFC de 13 para Persona Física).'
                : 'Formato esperado para Persona Física: 4 letras + 6 dígitos + 3 caracteres.'}
            </p>
          )}
        </div>

        <div className="sm:col-span-1">
          <label htmlFor="wizard-comp-cp" className="block text-xs font-bold text-slate-700 mb-1">
            Código Postal Fiscal (5 dígitos) *
          </label>
          <input
            id="wizard-comp-cp"
            type="text"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={5}
            required
            aria-invalid={showCpError}
            aria-describedby={showCpError ? 'wizard-cp-error' : undefined}
            value={codigoPostal}
            onChange={(e) => setCodigoPostal(e.target.value.replace(/\D/g, ''))}
            placeholder="Ej. 06600"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:border-blue-700 focus:ring-1 focus:ring-blue-700"
          />
          {showCpError && (
            <p id="wizard-cp-error" className="mt-1 text-[11px] font-medium text-red-700">
              Ingresa un Código Postal válido de 5 dígitos (no 00000).
            </p>
          )}
        </div>
      </div>

      {showModulo11Breakdown && rfcModulo11 && rfcModulo11.steps.length > 0 && (
        <WizardModulo11Breakdown personType={personType} rfcModulo11={rfcModulo11} />
      )}

      <div>
        <label htmlFor="wizard-comp-regimen" className="block text-xs font-bold text-slate-700 mb-1">
          Régimen Fiscal SAT *
        </label>
        <select
          id="wizard-comp-regimen"
          required
          title={regimenFiscal}
          value={regimenFiscal}
          onChange={(e) => setRegimenFiscal(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm bg-white focus:border-blue-700 cursor-pointer"
        >
          {selectRegimenes.map((reg) => (
            <option key={reg} value={reg}>
              {reg}
            </option>
          ))}
        </select>
        {regimenFiscal && (
          <p className="mt-1 text-[11px] text-slate-600 leading-snug break-words">
            Seleccionado: <span className="font-medium text-slate-800">{regimenFiscal}</span>
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1 pb-2">
        <div>
          <label htmlFor="wizard-comp-year" className="block text-xs font-bold text-slate-700 mb-1">
            Ejercicio Fiscal de Arranque
          </label>
          <select
            id="wizard-comp-year"
            value={currentYear}
            onChange={(e) => setCurrentYear(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold font-mono bg-white cursor-pointer"
          >
            {Array.from(new Set([2022, 2023, 2024, 2025, 2026, 2027, currentYear]))
              .sort((a, b) => a - b)
              .map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
          </select>
        </div>

        <div>
          <label htmlFor="wizard-comp-period" className="block text-xs font-bold text-slate-700 mb-1">
            Mes de Inicio Contable
          </label>
          <select
            id="wizard-comp-period"
            value={currentPeriod}
            onChange={(e) => setCurrentPeriod(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white cursor-pointer"
          >
            {MESES_SAT.slice(0, 12).map((m) => (
              <option key={m.periodo} value={m.periodo}>
                P{String(m.periodo).padStart(2, '0')} - {m.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
