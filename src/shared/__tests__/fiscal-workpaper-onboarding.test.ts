import { describe, expect, test } from 'bun:test';
import {
  computeFiscalWorkpaper,
  computeFixedAssetWithDepreciation,
  toCents,
  validateDoubleEntryMovements,
  validateRfcModulo11,
  calculateRfcCheckDigit,
  fixRfcCheckDigit
} from '../accounting-engine';
import { validateCompanyPayload } from '../../server/validators';

describe('CONTPAQi Replacement Suite — Fixed Assets INPC & Day 17 Fiscal Workpaper', () => {
  test('computes monthly accounting depreciation and INPC fiscal update factor (Art. 31 LISR)', () => {
    const calc = computeFixedAssetWithDepreciation({
      id: 'af-test-1',
      companyId: 'comp-test',
      codigo: 'AF-001',
      nombre: 'Servidor Rack Dell PowerEdge',
      categoria: 'COMPUTO_30',
      fechaAdquisicion: '2026-01-15',
      cfdiUuid: null,
      montoOriginalInversion: 120000,
      tasaAnualPct: 30,
      mesesDepreciadosPrevios: 0,
      inpcAdquisicion: 130.0,
      inpcMedioPeriodo: 136.5,
      cuentaActivoCode: '154-01-001',
      cuentaDepAcumCode: '171-01-001',
      cuentaGastoDepCode: '601-01-006',
      estatus: 'ACTIVO',
      createdAt: '2026-01-15'
    });

    // 120,000 * 30% = 36,000 anual / 12 = 3,000 mensual
    expect(calc.depreciacionMensualContable).toBe(3000);
    // Factor INPC = 136.5 / 130.0 = 1.0500
    expect(calc.factorActualizacionInpc).toBe(1.05);
    // Depreciación fiscal actualizada = 3,000 * 1.05 = 3,150
    expect(calc.depreciacionMensualFiscalActualizada).toBe(3150);
  });

  test('computes Day 17 ISR Provisional (Art. 14 LISR C.U.) and Definitive IVA', () => {
    const wp = computeFiscalWorkpaper({
      company: {
        id: 'comp-test',
        name: 'SOLUCIONES LOGISTICAS',
        rfc: 'SLO2204159A1',
        regimenFiscal: '601 - General de Ley Personas Morales',
        codigoPostal: '64000',
        maskFormat: 'XXX-XX-XXX',
        currentYear: 2026,
        currentPeriod: 10,
        createdAt: '2026-01-01'
      },
      ejercicio: 2026,
      periodo: 10,
      parameters: {
        companyId: 'comp-test',
        ejercicio: 2026,
        coeficienteUtilidad: 0.2,
        perdidasFiscalesPendientes: 10000,
        pagosProvisionalesAnteriores: 5000,
        saldoFavorIvaAnterior: 2000,
        tipoCambioDofCierre: 20.0
      },
      ingresosPeriodo: 100000,
      ingresosAcumuladosEjercicio: 500000,
      deduccionesAutorizadasPeriodo: 60000,
      ivaTrasladadoCobrado: 16000,
      ivaAcreditablePagado: 9600,
      isrRetenidoPorPagar: 0,
      ivaRetenidoPorPagar: 1000,
      isrRetenidoFavorPeriodo: 1000,
      usdCfdis: [
        { total: 2500, tipoCambio: 19.2, direction: 'EMITIDO' }
      ]
    });

    // Ingresos acumulados = 500,000 * CU 0.20 = 100,000 utilidad estimada - 10,000 pérdida = 90,000 base * 30% = 27,000 ISR causado - 5,000 pagos ant - 1,000 ret = 21,000
    expect(wp.isrProvisional.ingresosAcumuladosEjercicio).toBe(500000);
    expect(wp.isrProvisional.utilidadFiscalEstimada).toBe(100000);
    expect(wp.isrProvisional.baseGravableIsr).toBe(90000);
    expect(wp.isrProvisional.isrCausado).toBe(27000);
    expect(wp.isrProvisional.isrNetoAPagar).toBe(21000);

    // IVA: 16,000 - 9,600 - 2,000 saldo a favor = 4,400 a cargo
    expect(wp.ivaDefinitivo.ivaNetoAPagar).toBe(4400);

    // USD: 2,500 USD * 20.00 = 50,000 MXN valuado vs 48,000 libros (2500 * 19.2) => +2,000 utilidad cambiaria
    expect(wp.fluctuacionCambiaria.diferenciaCambiariaMxn).toBe(2000);
    expect(wp.fluctuacionCambiaria.tipoDiferencia).toBe('UTILIDAD_CAMBIARIA');
  });

  test('computes RESICO Persona Física (Art. 113-E LISR) with progressive bracket and zero deductions', () => {
    const wpFisica = computeFiscalWorkpaper({
      company: {
        id: 'comp-resico-pf',
        name: 'CARLOS LOPEZ HERNANDEZ',
        rfc: 'LOHC880101AA1', // 13 chars = Persona Física
        regimenFiscal: '626 - Régimen Simplificado de Confianza',
        codigoPostal: '06700',
        maskFormat: 'XXX-XX-XXX',
        currentYear: 2026,
        currentPeriod: 10,
        createdAt: '2026-01-01'
      },
      ejercicio: 2026,
      periodo: 10,
      parameters: {
        companyId: 'comp-resico-pf',
        ejercicio: 2026,
        coeficienteUtilidad: 0,
        perdidasFiscalesPendientes: 0,
        pagosProvisionalesAnteriores: 0,
        saldoFavorIvaAnterior: 0,
        tipoCambioDofCierre: 20.0
      },
      ingresosPeriodo: 45000, // Bracket: up to 50k => 1.10%
      ingresosAcumuladosEjercicio: 350000,
      deduccionesAutorizadasPeriodo: 20000, // Non-deductible in PF RESICO
      ivaTrasladadoCobrado: 7200,
      ivaAcreditablePagado: 3200,
      isrRetenidoPorPagar: 0,
      ivaRetenidoPorPagar: 0,
      isrRetenidoFavorPeriodo: 562.5, // 1.25% withheld by PM (Art. 113-J)
      ivaRetenidoFavorPeriodo: 1000,
      usdCfdis: []
    });

    // Art. 113-E: Base = 45,000, Tasa = 1.10% (bracket 25k-50k)
    expect(wpFisica.isrProvisional.tasaIsrPct).toBe(1.1);
    expect(wpFisica.isrProvisional.baseGravableIsr).toBe(45000);
    // ISR causado: 45,000 * 1.1% = 495
    expect(wpFisica.isrProvisional.isrCausado).toBe(495);
    // ISR neto a pagar: 495 - 562.50 retención = 0 (remanente acreditable)
    expect(wpFisica.isrProvisional.isrNetoAPagar).toBe(0);

    // IVA con retención a favor deducida (Art. 5-D LIVA): 7,200 - 3,200 - 1,000 = 3,000
    expect(wpFisica.ivaDefinitivo.ivaNetoAPagar).toBe(3000);
  });

  test('computes RESICO Persona Moral (Art. 206 LISR) with cash flow and 30% corporate tax rate', () => {
    const wpMoral = computeFiscalWorkpaper({
      company: {
        id: 'comp-resico-pm',
        name: 'INNOVACIONES DIGITALES DEL NORTE SAS',
        rfc: 'IDN2201019K2', // 12 chars = Persona Moral
        regimenFiscal: '626 - Régimen Simplificado de Confianza',
        codigoPostal: '64000',
        maskFormat: 'XXX-XX-XXX',
        currentYear: 2026,
        currentPeriod: 10,
        createdAt: '2026-01-01'
      },
      ejercicio: 2026,
      periodo: 10,
      parameters: {
        companyId: 'comp-resico-pm',
        ejercicio: 2026,
        coeficienteUtilidad: 0,
        perdidasFiscalesPendientes: 15000,
        pagosProvisionalesAnteriores: 20000,
        saldoFavorIvaAnterior: 0,
        tipoCambioDofCierre: 20.0
      },
      ingresosPeriodo: 80000,
      ingresosAcumuladosEjercicio: 400000,
      deduccionesAutorizadasPeriodo: 250000, // Cumulative/period deductions
      ivaTrasladadoCobrado: 12800,
      ivaAcreditablePagado: 8000,
      isrRetenidoPorPagar: 0,
      ivaRetenidoPorPagar: 0,
      isrRetenidoFavorPeriodo: 0,
      usdCfdis: []
    });

    // Art. 206: Base = 400,000 - 250,000 = 150,000 - 15,000 pérdida = 135,000
    expect(wpMoral.isrProvisional.baseGravableIsr).toBe(135000);
    // Tasa corporativa PM Art. 9: 30%, nunca 2.5%
    expect(wpMoral.isrProvisional.tasaIsrPct).toBe(30);
    // ISR causado: 135,000 * 30% = 40,500
    expect(wpMoral.isrProvisional.isrCausado).toBe(40500);
    // ISR neto a pagar: 40,500 - 20,000 pagos provisionales previos = 20,500
    expect(wpMoral.isrProvisional.isrNetoAPagar).toBe(20500);
  });

  describe('Company Onboarding Wizard & Opening Journal Entry', () => {
    test('validates Persona Moral (12 chars) and Persona Física (13 chars) onboarding payloads', () => {
      // Persona Moral
      const moralPayload = validateCompanyPayload({
        name: 'ACEROS DEL NORTE S.A. DE C.V.',
        rfc: 'ano2101019k2',
        regimenFiscal: '601 - General de Ley Personas Morales',
        codigoPostal: '64000',
        currentYear: 2026,
        currentPeriod: 10,
        initialBankName: 'BBVA México',
        initialBankAccount: '0123456789',
        initialBankBalance: 75000,
        createOpeningEntry: true
      });

      expect(moralPayload.rfc).toBe('ANO2101019K2');
      expect(moralPayload.name).toBe('ACEROS DEL NORTE S.A. DE C.V.');
      expect(moralPayload.initialBankBalance).toBe(75000);
      expect(moralPayload.createOpeningEntry).toBe(true);

      // Persona Física
      const fisicaPayload = validateCompanyPayload({
        name: 'JUAN PEREZ GONZALEZ',
        rfc: 'PEGJ850615HA8',
        regimenFiscal: '612 - Personas Físicas con Actividades Empresariales y Profesionales',
        codigoPostal: '06700'
      });
      expect(fisicaPayload.rfc).toBe('PEGJ850615HA8');
      expect(fisicaPayload.codigoPostal).toBe('06700');

      // Invalid RFC length throws AccountingInvariantError
      expect(() => {
        validateCompanyPayload({
          name: 'EMPRESA INVALIDA',
          rfc: 'RFC_INVALIDO_LARGO_9999'
        });
      }).toThrow('Razón social y RFC válido');
    });

    test('validates RFC check digit using official SAT Weighted Sum Modulo 11', () => {
      // Persona Física válida con dígito 8
      const resFisica = validateRfcModulo11('GODE561231GR8');
      expect(resFisica.isValidFormat).toBe(true);
      expect(resFisica.isValidCheckDigit).toBe(true);
      expect(resFisica.actualCheckDigit).toBe('8');
      expect(resFisica.expectedCheckDigit).toBe('8');
      expect(resFisica.expectedRfc).toBe('GODE561231GR8');
      expect(resFisica.offset).toBe(0);
      expect(resFisica.steps.length).toBe(12);

      // Persona Moral oficial SAT: BBVA México (BBA830831LJ2)
      const resBbva = validateRfcModulo11('BBA830831LJ2');
      expect(resBbva.isValidFormat).toBe(true);
      expect(resBbva.isValidCheckDigit).toBe(true);
      expect(resBbva.actualCheckDigit).toBe('2');
      expect(resBbva.expectedCheckDigit).toBe('2');
      expect(resBbva.offset).toBe(481);
      expect(resBbva.steps.length).toBe(11);

      // Persona Moral oficial SAT: Bimbo (BIM011108DJ5)
      const resBimbo = validateRfcModulo11('BIM011108DJ5');
      expect(resBimbo.isValidCheckDigit).toBe(true);
      expect(resBimbo.expectedCheckDigit).toBe('5');

      // Persona Moral oficial SAT: IMSS (IMS421231I45)
      const resImss = validateRfcModulo11('IMS421231I45');
      expect(resImss.isValidCheckDigit).toBe(true);
      expect(resImss.expectedCheckDigit).toBe('5');

      // Dígito verificador erróneo (modificado a '9') y autocorregir
      const resError = validateRfcModulo11('GODE561231GR9');
      expect(resError.isValidFormat).toBe(true);
      expect(resError.isValidCheckDigit).toBe(false);
      expect(resError.actualCheckDigit).toBe('9');
      expect(resError.expectedCheckDigit).toBe('8');
      expect(resError.expectedRfc).toBe('GODE561231GR8');
      expect(fixRfcCheckDigit('GODE561231GR9')).toBe('GODE561231GR8');

      // calculateRfcCheckDigit a partir de prefijo sin dígito verificador
      expect(calculateRfcCheckDigit('GODE561231GR')).toBe('8');
      expect(calculateRfcCheckDigit('BBA830831LJ')).toBe('2');
      expect(calculateRfcCheckDigit('BIM011108DJ')).toBe('5');

      // RFCs genéricos del SAT
      const resPubGen = validateRfcModulo11('XAXX010101000');
      expect(resPubGen.isValidFormat).toBe(true);
      expect(resPubGen.isValidCheckDigit).toBe(true);
      expect(resPubGen.isGeneric).toBe(true);

      const resExtr = validateRfcModulo11('XEXX010101000');
      expect(resExtr.isValidFormat).toBe(true);
      expect(resExtr.isValidCheckDigit).toBe(true);
      expect(resExtr.isGeneric).toBe(true);
    });

    test('generates strictly balanced opening journal entry (Asiento de Apertura)', () => {
      const initialBalanceMxn = 50000;
      const initialBalanceCents = toCents(initialBalanceMxn);
      expect(initialBalanceCents).toBe(5000000);

      const movements = [
        {
          id: 'mov-banco',
          polizaId: 'pol-apertura',
          accountId: 'acc-banco-01',
          accountCode: '102-01-001',
          accountName: 'Santander México Cta 01948271',
          referencia: 'APERTURA',
          concepto: 'Apertura de cuenta bancaria',
          cargo: initialBalanceMxn,
          abono: 0,
          cfdiUuid: null
        },
        {
          id: 'mov-capital',
          polizaId: 'pol-apertura',
          accountId: 'acc-capital-01',
          accountCode: '301-01-001',
          accountName: 'Capital Social Fijo',
          referencia: 'APERTURA',
          concepto: 'Aportación de Capital Social Inicial',
          cargo: 0,
          abono: initialBalanceMxn,
          cfdiUuid: null
        }
      ];

      // Must validate with double-entry invariant
      const validated = validateDoubleEntryMovements(movements);
      expect(validated.totalCargo).toBe(50000);
      expect(validated.totalAbono).toBe(50000);
      expect(validated.totalCargo - validated.totalAbono).toBe(0);

      // Imbalance by even $0.01 fails
      const unbalancedMovements = [
        { accountId: 'acc-banco-01', cargo: 50000.01, abono: 0, concepto: 'Apertura' },
        { accountId: 'acc-capital-01', cargo: 0, abono: 50000, concepto: 'Capital' }
      ];
      expect(() => validateDoubleEntryMovements(unbalancedMovements)).toThrow('Póliza descuadrada');
    });
  });
});
