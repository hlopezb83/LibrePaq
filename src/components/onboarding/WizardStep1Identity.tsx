import {
  AlertCircle,
  Building2,
  CheckCircle2,
  CreditCard,
  Sparkles
} from 'lucide-react';
import { REGIMENES_FISCALES_SAT, MESES_SAT } from '../../shared/sat-constants';
import type { RfcModulo11Result } from '../../shared/accounting-engine';
import type { CfdiCompanyCandidate } from '../../shared/cfdi-company-extractor';
import { WizardXmlAutofillBox } from './WizardXmlAutofillBox';

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
  return (
    <div className="space-y-4">
      <WizardXmlAutofillBox
        candidates={xmlCandidates}
        activeRole={activeXmlRole}
        onXmlLoaded={onXmlLoaded}
        onFileLoaded={onFileLoaded}
        onSelectCandidate={onSelectXmlCandidate}
      />

      <div>
        <span id="wizard-person-type-label" className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
          Tipo de Contribuyente SAT
        </span>
        <div role="group" aria-labelledby="wizard-person-type-label" className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            aria-pressed={personType === 'MORAL'}
            onClick={() => {
              setPersonType('MORAL');
              setRegimenFiscal(REGIMENES_FISCALES_SAT[0] ?? '601 - General de Ley Personas Morales');
            }}
            className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-center gap-2.5 ${
              personType === 'MORAL'
                ? 'border-blue-600 bg-blue-50/70 text-blue-900 shadow-2xs'
                : 'border-slate-300 hover:border-slate-400 text-slate-700'
            }`}
          >
            <Building2 className={`w-5 h-5 shrink-0 ${personType === 'MORAL' ? 'text-blue-700' : 'text-slate-500'}`} aria-hidden="true" />
            <div>
              <div className="text-xs font-bold">Persona Moral</div>
              <div className="text-[11px] text-slate-500">Empresas S.A., S.A.P.I., S. de R.L. (RFC 12)</div>
            </div>
          </button>

          <button
            type="button"
            aria-pressed={personType === 'FISICA'}
            onClick={() => {
              setPersonType('FISICA');
              setRegimenFiscal('612 - Personas Físicas con Actividades Empresariales y Profesionales');
            }}
            className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-center gap-2.5 ${
              personType === 'FISICA'
                ? 'border-blue-600 bg-blue-50/70 text-blue-900 shadow-2xs'
                : 'border-slate-300 hover:border-slate-400 text-slate-700'
            }`}
          >
            <CreditCard className={`w-5 h-5 shrink-0 ${personType === 'FISICA' ? 'text-blue-700' : 'text-slate-500'}`} aria-hidden="true" />
            <div>
              <div className="text-xs font-bold">Persona Física</div>
              <div className="text-[11px] text-slate-500">Honorarios, RESICO, Actividad Emp. (RFC 13)</div>
            </div>
          </button>
        </div>
      </div>

      <div>
        <label htmlFor="wizard-comp-name" className="block text-xs font-bold text-slate-700 mb-1">
          Razón Social o Nombre Completo *
        </label>
        <input
          id="wizard-comp-name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={
            personType === 'MORAL'
              ? 'Ej. Soluciones Contables y Fiscales S.A. de C.V.'
              : 'Ej. Lic. Laura Gómez Morales'
          }
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-blue-700 focus:ring-1 focus:ring-blue-700"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="sm:col-span-1">
          <div className="flex items-center justify-between mb-1 flex-wrap gap-1">
            <label htmlFor="wizard-comp-rfc" className="block text-xs font-bold text-slate-700">
              RFC {personType === 'MORAL' ? '(12 caracteres)' : '(13 caracteres)'} *
            </label>
            {isRfcValid && rfcModulo11 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {rfcModulo11.isValidCheckDigit ? (
                  <span
                    className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1"
                    title={rfcModulo11.message}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" /> SAT Módulo 11 OK
                  </span>
                ) : (
                  <>
                    <span
                      className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 flex items-center gap-1"
                      title={rfcModulo11.message}
                    >
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
                      M11: {rfcModulo11.expectedCheckDigit}
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
                <button
                  type="button"
                  aria-expanded={showModulo11Breakdown}
                  onClick={() => setShowModulo11Breakdown(!showModulo11Breakdown)}
                  className="text-[11px] font-medium text-slate-600 hover:text-slate-800 underline ml-0.5 cursor-pointer"
                >
                  {showModulo11Breakdown ? 'Ocultar M11' : 'Ver M11'}
                </button>
              </div>
            )}
          </div>
          <input
            id="wizard-comp-rfc"
            type="text"
            required
            spellCheck={false}
            maxLength={personType === 'MORAL' ? 12 : 13}
            value={rfc}
            onChange={(e) => {
              const nextRfc = e.target.value.toUpperCase().replace(/[^A-Z0-9&Ñ]/g, '');
              setRfc(nextRfc);
              setBypassRfcCheckDigit(false);
              onClearModulo11Error();
            }}
            placeholder={personType === 'MORAL' ? 'BBA830831LJ2' : 'GODE561231GR8'}
            className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono uppercase focus:ring-1 ${
              isRfcValid
                ? rfcModulo11?.isValidCheckDigit
                  ? 'border-emerald-500 bg-emerald-50/20 text-slate-900 focus:border-emerald-600 focus:ring-emerald-600'
                  : 'border-amber-400 bg-amber-50/20 text-slate-900 focus:border-amber-500 focus:ring-amber-500'
                : 'border-slate-300 focus:border-blue-700 focus:ring-blue-700'
            }`}
          />
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
            value={codigoPostal}
            onChange={(e) => setCodigoPostal(e.target.value.replace(/\D/g, ''))}
            placeholder="Ej. 06600"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:border-blue-700 focus:ring-1 focus:ring-blue-700"
          />
        </div>
      </div>

      {showModulo11Breakdown && rfcModulo11 && rfcModulo11.steps.length > 0 && (
        <div className="p-3 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono border border-slate-700 shadow-inner">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-700 text-[11px] text-slate-300 font-sans font-bold">
            <span>Desglose Matemático SAT Anexo 3 (Módulo 11)</span>
            <span className="text-amber-400">
              {personType === 'MORAL' ? 'Base Persona Moral (+481)' : 'Base Persona Física (0)'}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between text-[11px] text-slate-300 gap-2">
            <span>
              Suma Ponderada: <strong className="text-white">{rfcModulo11.sum}</strong> | Residuo:{' '}
              <strong>{rfcModulo11.remainder}</strong>
            </span>
            <span>
              Dígito SAT Oficial:{' '}
              <strong className="text-amber-400 font-bold">{rfcModulo11.expectedCheckDigit}</strong>
            </span>
          </div>
        </div>
      )}

      <div>
        <label htmlFor="wizard-comp-regimen" className="block text-xs font-bold text-slate-700 mb-1">
          Régimen Fiscal SAT *
        </label>
        <select
          id="wizard-comp-regimen"
          value={regimenFiscal}
          onChange={(e) => setRegimenFiscal(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm bg-white focus:border-blue-700 cursor-pointer"
        >
          {REGIMENES_FISCALES_SAT.map((reg) => (
            <option key={reg} value={reg}>
              {reg}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3.5 pt-1">
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
            <option value={2025}>2025</option>
            <option value={2026}>2026</option>
            <option value={2027}>2027</option>
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
