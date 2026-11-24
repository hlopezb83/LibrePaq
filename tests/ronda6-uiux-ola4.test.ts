import { describe, expect, test } from 'bun:test';
import { formatSatDypWorkpaperText } from '../src/shared/engine/sat-dyp-formatter';
import { checkRfc69BStatus } from '../src/shared/sat-69b';
import { extractThirdPartyDraft } from '../src/views/fiscal-bancos/usePadronProveedores';
import {
  DEFAULT_DELIVERABLE_CONFIG,
  hasAnyDefaultSignature
} from '../src/components/deliverables/useExecutiveDeliverables';
import { buildPapelFiscalCsvRows } from '../src/components/deliverables/deliverableCsvExport';
import { isFiscalParamsDirty } from '../src/views/ajustes/useAjustesFiscalParams';
import type { Company, FiscalWorkpaperResponse, ThirdPartyRecord } from '../src/shared/types';

function makeCompany(rfc: string, regimenFiscal: string): Company {
  return {
    id: 'comp-1',
    name: 'Empresa Prueba S.A. de C.V.',
    rfc,
    regimenFiscal,
    codigoPostal: '64000',
    maskFormat: 'XXX-XX-XXX',
    currentYear: 2026,
    currentPeriod: 10,
    createdAt: '2026-01-01T00:00:00.000Z'
  };
}

function makeWorkpaper(opts: {
  rfc: string;
  regimenClave: string;
  regimenFiscal: string;
  esResico: boolean;
}): FiscalWorkpaperResponse {
  return {
    company: makeCompany(opts.rfc, opts.regimenFiscal),
    ejercicio: 2026,
    periodo: 10,
    parameters: {
      companyId: 'comp-1',
      ejercicio: 2026,
      periodo: 10,
      coeficienteUtilidad: 0.1845,
      tipoCambioDofCierre: 19.5,
      perdidasFiscalesPendientes: 12000,
      pagosProvisionalesAnteriores: 8500,
      saldoFavorIvaAnterior: 1500
    },
    isrProvisional: {
      regimenClave: opts.regimenClave,
      esResico: opts.esResico,
      ingresosPeriodo: 100000,
      ingresosAcumuladosEjercicio: 500000,
      deduccionesAutorizadasPeriodo: 40000,
      deduccionesAcumuladasEjercicio: 180000,
      coeficienteUtilidadAplicado: 0.1845,
      utilidadFiscalEstimada: 60000,
      perdidasFiscalesAplicadas: 10000,
      baseGravableIsr: 50000,
      tasaIsrPct: opts.esResico && opts.rfc.length === 13 ? 1.5 : 30,
      isrCausado: 15000,
      pagosProvisionalesPrevios: 5000,
      isrRetenidoPeriodo: 1250,
      isrNetoAPagar: 8750
    },
    ivaDefinitivo: {
      actosGravadosCobrado16: 100000,
      ivaTrasladadoCobrado: 16000,
      ivaAcreditablePagado: 6400,
      ivaRetenidoPorPagar: 1066.67,
      ivaRetenidoAcreditable: 800,
      saldoFavorIvaAcreditable: 1500,
      ivaNetoAPagar: 7300,
      saldoFavorIvaRemanente: 0
    },
    fluctuacionCambiaria: {
      cfdisUsdCount: 0,
      saldoMonedaExtranjeraUsd: 0,
      tipoCambioPromedioRegistro: 19.5,
      tipoCambioDofCierre: 19.5,
      valuacionLibrosMxn: 0,
      valuacionCierreDofMxn: 0,
      diferenciaCambiariaMxn: 0,
      tipoDiferencia: 'SIN_CAMBIO'
    },
    resumenLineaCapturaSat: {
      isrProvisionalAPagar: 8750,
      ivaDefinitivoAPagar: 7300,
      retencionesIsrPorEnterar: 1250,
      retencionesIvaPorEnterar: 1066.67,
      totalEstimadoDia17: 18366.67
    }
  };
}

describe('Ronda 6 Ola 4 — Regímenes DyP, Padrón 69-B, Entregables y Ajustes', () => {
  test('formatSatDypWorkpaperText alinea cálculo según RESICO PF, RESICO PM, PF General y PM General', () => {
    const resicoPf = formatSatDypWorkpaperText(
      makeWorkpaper({
        rfc: 'GOME850101AB1',
        regimenClave: '626',
        regimenFiscal: '626 - RESICO PF',
        esResico: true
      }),
      2026,
      10
    );
    expect(resicoPf).toContain('RESICO Persona Física (Flujo)');
    expect(resicoPf).not.toContain('Deducciones del Mes');
    expect(resicoPf).not.toContain('Pérdidas Fiscales');
    expect(resicoPf).not.toContain('Pagos Provisionales Previos');
    expect(resicoPf).not.toContain('IVA Trasladado Cobrado (16%)');
    expect(resicoPf).toContain('IVA Retenido Acreditable (por Clientes)');

    const resicoPm = formatSatDypWorkpaperText(
      makeWorkpaper({
        rfc: 'ABC210101XY9',
        regimenClave: '626',
        regimenFiscal: '626 - RESICO PM',
        esResico: true
      }),
      2026,
      10
    );
    expect(resicoPm).toContain('RESICO Persona Moral (Flujo)');
    expect(resicoPm).toContain('Deducciones del Mes');
    expect(resicoPm).toContain('Utilidad Fiscal (Ingresos - Deducciones)');

    const pfGeneral = formatSatDypWorkpaperText(
      makeWorkpaper({
        rfc: 'GOME850101AB1',
        regimenClave: '612',
        regimenFiscal: '612 - Personas Físicas con Actividades Empresariales',
        esResico: false
      }),
      2026,
      10
    );
    expect(pfGeneral).toContain('Art. 106 LISR — Tarifa Progresiva');
    expect(pfGeneral).toContain('Deducciones Acumuladas del Ejercicio');

    const pmGeneral = formatSatDypWorkpaperText(
      makeWorkpaper({
        rfc: 'ABC210101XY9',
        regimenClave: '601',
        regimenFiscal: '601 - General de Ley Personas Morales',
        esResico: false
      }),
      2026,
      10
    );
    expect(pmGeneral).toContain('Art. 14 C.U. 0.1845');
    expect(pmGeneral).toContain('Utilidad Fiscal Estimada');
  });

  test('extractThirdPartyDraft preserva rol, tipoTerceroDiot y cuentaContrapartidaCode al editar', () => {
    const existing: ThirdPartyRecord = {
      id: 'tp-existing',
      companyId: 'comp-1',
      rfc: 'EXT990101AA1',
      nombre: 'Servicios Internacionales LLC',
      rol: 'AMBOS',
      cuentaOperacionCode: '601-01-010',
      cuentaContrapartidaCode: '205-01-002',
      tipoTerceroDiot: '05',
      tipoOperacionDiot: '85',
      tasaIvaDefault: 0,
      estatus69B: 'DESVIRTUADO',
      updatedAt: '2026-01-01T00:00:00.000Z'
    };

    const draft = extractThirdPartyDraft(existing);
    expect(draft.rol).toBe('AMBOS');
    expect(draft.tipoTerceroDiot).toBe('05');
    expect(draft.cuentaContrapartidaCode).toBe('205-01-002');
    expect(draft.estatus69B).toBe('DESVIRTUADO');
    expect(draft.tasaIvaDefault).toBe(0);
    expect(draft.tipoOperacionDiot).toBe('85');
  });

  test('checkRfc69BStatus no marca DESVIRTUADO como EFOS riesgoso (isEfos === false)', () => {
    // RFC de muestra DESVIRTUADO incluido en sat-69b.ts
    const desvirtuado = checkRfc69BStatus('CON080912M45');
    expect(desvirtuado.status).toBe('DESVIRTUADO');
    expect(desvirtuado.isEfos).toBe(false);
  });

  test('hasAnyDefaultSignature detecta firmas de muestra vs personalizadas', () => {
    expect(hasAnyDefaultSignature({ ...DEFAULT_DELIVERABLE_CONFIG })).toBe(true);
    expect(
      hasAnyDefaultSignature({
        firmName: 'Despacho Fiscal Norte S.C.',
        auditorName: 'C.P. Laura Méndez Ruiz',
        auditorCedula: 'Céd. Prof. 7712345',
        legalRepName: 'Lic. Carlos Torres Vega'
      })
    ).toBe(false);
  });

  test('buildPapelFiscalCsvRows genera filas fieles al régimen RESICO y retenciones', () => {
    const wpPf = makeWorkpaper({
      rfc: 'GOME850101AB1',
      regimenClave: '626',
      regimenFiscal: '626 - RESICO PF',
      esResico: true
    });
    const rowsPf = buildPapelFiscalCsvRows(wpPf.company, wpPf);
    const labelsPf = rowsPf.map((r) => String(r[0]));
    expect(labelsPf).not.toContain('Coeficiente de Utilidad Aplicado');
    expect(labelsPf).not.toContain('(-) Pérdidas Fiscales Aplicadas');
    expect(labelsPf).toContain('(-) IVA Retenido Acreditable (por Clientes)');
    expect(labelsPf).toContain('Retenciones de ISR por Enterar');
    expect(labelsPf).toContain('Retenciones de IVA por Enterar');

    const wpPm = makeWorkpaper({
      rfc: 'ABC210101XY9',
      regimenClave: '626',
      regimenFiscal: '626 - RESICO PM',
      esResico: true
    });
    const labelsPm = buildPapelFiscalCsvRows(wpPm.company, wpPm).map((r) => String(r[0]));
    expect(labelsPm).toContain('(-) Deducciones Autorizadas Periodo');
    expect(labelsPm).toContain('(=) Utilidad Fiscal (Ingresos - Deducciones)');
  });

  test('isFiscalParamsDirty permite guardar cuando no hay parámetros guardados y detecta cambios reales', () => {
    const baseDraft = {
      coefUtilidad: '0.1845',
      tcDof: '0',
      perdidasAnt: '0',
      pagosAnt: '0',
      saldoIvaAnt: '0'
    };
    const saved = {
      coeficienteUtilidad: 0.1845,
      tipoCambioDofCierre: 0,
      perdidasFiscalesPendientes: 0,
      pagosProvisionalesAnteriores: 0,
      saldoFavorIvaAnterior: 0
    };

    expect(isFiscalParamsDirty(baseDraft, null)).toBe(true);
    expect(isFiscalParamsDirty(baseDraft, undefined)).toBe(true);
    expect(isFiscalParamsDirty(baseDraft, saved)).toBe(false);
    expect(isFiscalParamsDirty({ ...baseDraft, tcDof: '19.85' }, saved)).toBe(true);
  });
});
