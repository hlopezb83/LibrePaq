import './setup-test-db';
import { describe, expect, test } from 'bun:test';
import { BASE_COMPANY_ACCOUNTS } from '../src/shared/catalogs/base-accounts.seed';
import {
  buildAnnualMonthlyBalancesFromMovements,
  computeAnnualFixedAssetFiscalDeduction,
  computeArt57LossCarryforwards
} from '../src/shared/engine/annual-tax-balances.helper';
import { computeAnnualTaxSummary } from '../src/shared/engine/annual-tax.engine';
import type { JoinedPolizaMovementInput } from '../src/shared/engine/financial-reports.engine';
import { computeThreeWayTieout } from '../src/shared/engine/three-way-tieout.engine';
import { buildSatAnexo24Xml } from '../src/shared/sat-anexo24';
import { SAT_GROUP_CODES } from '../src/shared/sat-group-codes-catalog';
import type {
  AccountWithBalance,
  CfdiDocument,
  Company,
  FiscalLossCarryforward,
  FixedAssetRecord,
  Poliza
} from '../src/shared/types';

function makeCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: 'comp_r11_s2',
    rfc: 'R11260101BB2',
    name: 'Anexo 24 y Anual S.A. de C.V.',
    regimenFiscal: '601',
    codigoPostal: '06700',
    maskFormat: 'XXX-XX-XXX',
    currentYear: 2026,
    currentPeriod: 6,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides
  };
}

function makeSeedTb(companyId = 'comp_r11_s2'): AccountWithBalance[] {
  return BASE_COMPANY_ACCOUNTS.map((a) => ({
    ...a,
    id: `acc_${a.code}`,
    companyId,
    initialBalanceComputed: 0,
    periodCharges: 0,
    periodCredits: 0,
    finalBalance: 0
  }));
}

describe('Ronda 11 Suite 2 — Anexo 24 v1.3, Amarre 3-Vías PM 601 y Declaración Anual LISR', () => {
  test('1. Anexo 24: catálogo sin 100..600/800, BN N2/omitZero, PL Transferencia/Cheque solo egresos + warn RFC y XC cronológico', () => {
    const invalidRoots = ['100', '200', '300', '400', '500', '600', '800'];
    expect(SAT_GROUP_CODES.some((c) => invalidRoots.includes(c.code))).toBe(false);

    const company = makeCompany();
    const tb = makeSeedTb(company.id).map((a) => {
      if (a.code === '102-01-001') return { ...a, initialBalanceComputed: 50_000, periodCharges: 10_000, periodCredits: 5_000, finalBalance: 55_000 };
      if (a.code === '102-00-000') return { ...a, initialBalanceComputed: 50_000, periodCharges: 10_000, periodCredits: 5_000, finalBalance: 55_000 };
      return a;
    });

    const ct = buildSatAnexo24Xml(company, 2026, 6, 'catalogo', tb);
    expect(ct.xml).not.toContain('NumCta="100-00-000"');

    const bnN2Omit = buildSatAnexo24Xml(company, 2026, 6, 'balanza', tb, [], {
      balanzaLevel: 'N2',
      omitZeroAccounts: true
    });
    expect(bnN2Omit.xml).toContain('NumCta="102-00-000"');
    expect(bnN2Omit.xml).not.toContain('NumCta="102-01-001"');
    expect(bnN2Omit.xml).not.toContain('NumCta="101-00-000"'); // saldo $0.00 omitido

    const polizas: Poliza[] = [
      {
        id: 'pol_eg_1',
        companyId: company.id,
        ejercicio: 2026,
        periodo: 6,
        tipo: 'EGRESO',
        folio: 2,
        fecha: '2026-06-20',
        concepto: 'Pago proveedor SPEI',
        totalCargos: 10_000,
        totalAbonos: 10_000,
        cfdiUuid: null,
        origin: 'MANUAL',
        isBalanced: true,
        createdAt: '2026-06-20T00:00:00Z',
        movements: [
          {
            id: 'm_trf',
            polizaId: 'pol_eg_1',
            accountId: 'acc_102-01-001',
            accountCode: '102-01-001',
            accountName: 'BBVA Bancos Nacionales',
            referencia: 'SPEI-99',
            concepto: 'Transferencia proveedor',
            cargo: 0,
            abono: 10_000,
            cfdiUuid: null,
            paymentMethodSat: '03',
            bankCodeOri: '012',
            accountOri: '0123456789',
            bankCodeDest: '014',
            accountDest: '014180000011223344',
            beneficiaryName: 'Proveedor Norte SA',
            beneficiaryRfc: 'PNO010101AA1'
          }
        ]
      },
      {
        id: 'pol_eg_2',
        companyId: company.id,
        ejercicio: 2026,
        periodo: 6,
        tipo: 'EGRESO',
        folio: 3,
        fecha: '2026-06-21',
        concepto: 'Pago proveedor con cheque',
        totalCargos: 5_000,
        totalAbonos: 5_000,
        cfdiUuid: null,
        origin: 'MANUAL',
        isBalanced: true,
        createdAt: '2026-06-21T00:00:00Z',
        movements: [
          {
            id: 'm_chq',
            polizaId: 'pol_eg_2',
            accountId: 'acc_102-01-001',
            accountCode: '102-01-001',
            accountName: 'BBVA Bancos Nacionales',
            referencia: 'CH-104',
            concepto: 'Cheque sin RFC capturado',
            cargo: 0,
            abono: 5_000,
            cfdiUuid: null,
            paymentMethodSat: '02',
            bankCodeOri: '012',
            accountOri: '0123456789',
            chequeNum: '104'
          }
        ]
      },
      {
        id: 'pol_ing_1',
        companyId: company.id,
        ejercicio: 2026,
        periodo: 6,
        tipo: 'INGRESO',
        folio: 1,
        fecha: '2026-06-05',
        concepto: 'Cobro cliente transferencia',
        totalCargos: 20_000,
        totalAbonos: 20_000,
        cfdiUuid: null,
        origin: 'MANUAL',
        isBalanced: true,
        createdAt: '2026-06-05T00:00:00Z',
        movements: [
          {
            id: 'm_ing',
            polizaId: 'pol_ing_1',
            accountId: 'acc_102-01-001',
            accountCode: '102-01-001',
            accountName: 'BBVA Bancos Nacionales',
            referencia: 'SPEI-IN',
            concepto: 'Cobro SPEI',
            cargo: 20_000,
            abono: 0,
            cfdiUuid: null,
            paymentMethodSat: '03',
            bankCodeOri: '014',
            accountOri: '998877',
            bankCodeDest: '012',
            accountDest: '0123456789'
          }
        ]
      }
    ];

    const pl = buildSatAnexo24Xml(company, 2026, 6, 'polizas', tb, polizas, {
      tipoSolicitud: 'AF',
      numOrden: 'ABC1234567/26'
    });
    expect(pl.xml).toContain('<PLZ:Transferencia ');
    expect(pl.xml).toContain('CtaDest="014180000011223344"');
    expect(pl.xml).toContain('<PLZ:Cheque Num="104"');
    // El ingreso (cargo a 102-*) no debe emitir PLZ:Transferencia
    const transferCount = (pl.xml.match(/<PLZ:Transferencia /g) ?? []).length;
    expect(transferCount).toBe(1);
    expect(pl.warnings?.some((w) => w.includes('XAXX010101000'))).toBe(true);

    const xc = buildSatAnexo24Xml(company, 2026, 6, 'xc', tb, polizas, {
      tipoSolicitud: 'AF',
      numOrden: 'ABC1234567/26'
    });
    const idxEarly = xc.xml.indexOf('Fecha="2026-06-05"');
    const idxLate = xc.xml.indexOf('Fecha="2026-06-20"');
    expect(idxEarly).toBeGreaterThan(-1);
    expect(idxLate).toBeGreaterThan(idxEarly);
  });

  test('2. Amarre 3-Vías PM 601 devengado con PPD sin falsos rojos y detección UUID cancelado con póliza viva', () => {
    const company = makeCompany({ regimenFiscal: '601' });
    const ppdVenta: CfdiDocument = {
      id: 'cfdi_ppd',
      companyId: company.id,
      uuid: '12345678-1234-4123-8123-1234567890AB',
      fecha: '2026-06-12',
      tipoComprobante: 'I',
      direction: 'EMITIDO',
      serie: 'F',
      folio: '100',
      emisorRfc: company.rfc,
      emisorNombre: company.name,
      receptorRfc: 'CLI010101AA1',
      receptorNombre: 'Cliente Crédito S.A.',
      conceptoPrincipal: 'Venta a crédito PPD',
      claveProdServ: '81112100',
      moneda: 'MXN',
      tipoCambio: 1,
      subtotal: 50_000,
      descuento: 0,
      ivaTrasladado: 8_000,
      isrRetenido: 0,
      ivaRetenido: 0,
      total: 58_000,
      metodoPago: 'PPD',
      formaPago: '99',
      usoCfdi: 'G03',
      uuidRelacionado: null,
      statusSat: 'VIGENTE',
      polizaId: 'pol_ppd',
      xmlRaw: '<cfdi:Comprobante/>'
    };

    const tb = makeSeedTb(company.id).map((a) => {
      if (a.code === '401-01-001') return { ...a, periodCredits: 50_000, finalBalance: 50_000 };
      if (a.code === '209-01-001') return { ...a, periodCredits: 8_000, finalBalance: 8_000 };
      return a;
    });
    const tieOk = computeThreeWayTieout({
      company,
      ejercicio: 2026,
      periodo: 6,
      cfdis: [ppdVenta],
      polizas: [
        {
          id: 'pol_ppd',
          companyId: company.id,
          ejercicio: 2026,
          periodo: 6,
          tipo: 'DIARIO',
          folio: 1,
          fecha: '2026-06-12',
          concepto: 'Provisión venta PPD',
          totalCargos: 58_000,
          totalAbonos: 58_000,
          cfdiUuid: ppdVenta.uuid,
          origin: 'ADD_AUTO',
          isBalanced: true,
          createdAt: '2026-06-12T00:00:00Z',
          movements: []
        }
      ],
      trialBalance: tb
    });
    expect(tieOk.satAdd.ingresosNetos).toBe(50_000);
    expect(tieOk.satAdd.ivaTrasladado).toBe(0); // IVA sigue flujo
    expect(tieOk.deltas.deltaIngresos).toBe(0);
    expect(tieOk.status).toBe('VERDE');

    // CFDI cancelado con póliza viva
    const cancelledDoc: CfdiDocument = { ...ppdVenta, id: 'cfdi_canc', uuid: '99999999-1111-4111-8111-111111111111', statusSat: 'CANCELADO', polizaId: 'pol_viva' };
    const tieCanc = computeThreeWayTieout({
      company,
      ejercicio: 2026,
      periodo: 6,
      cfdis: [cancelledDoc],
      polizas: [
        {
          id: 'pol_viva',
          companyId: company.id,
          ejercicio: 2026,
          periodo: 6,
          tipo: 'DIARIO',
          folio: 9,
          fecha: '2026-06-15',
          concepto: 'Póliza huérfana',
          totalCargos: 100,
          totalAbonos: 100,
          cfdiUuid: cancelledDoc.uuid,
          origin: 'ADD_AUTO',
          isBalanced: true,
          createdAt: '2026-06-15T00:00:00Z',
          movements: []
        }
      ],
      trialBalance: makeSeedTb(company.id)
    });
    expect(tieCanc.status).toBe('ROJO');
    expect(tieCanc.cancelledWithLivePoliza.map((c) => c.uuid)).toContain(cancelledDoc.uuid);
    expect(tieCanc.causes.some((c) => c.code === 'CFDIS_CANCELADOS_CON_POLIZA')).toBe(true);
  });

  test('3. Anual LISR: ajustes Periodo 13 (excl. CIERRE_ANUAL), pérdidas Art. 57 y depreciación proporcional previa a BAJA', () => {
    const company = makeCompany({ regimenFiscal: '601' });
    const accounts = BASE_COMPANY_ACCOUNTS.map((a) => ({ ...a, id: `acc_${a.code}`, companyId: company.id }));
    const acc401 = accounts.find((a) => a.code === '401-01-001')!;
    const acc601 = accounts.find((a) => a.code === '601-01-001')!;
    const acc102 = accounts.find((a) => a.code === '102-01-001')!;
    const acc305 = accounts.find((a) => a.code === '305-01-001')!;

    const movs: JoinedPolizaMovementInput[] = [
      { account_id: acc102.id, cargo: 300_000, abono: 0, polizas: { company_id: company.id, ejercicio: 2026, periodo: 6, origin: 'MANUAL' } },
      { account_id: acc401.id, cargo: 0, abono: 300_000, polizas: { company_id: company.id, ejercicio: 2026, periodo: 6, origin: 'MANUAL' } },
      // Ajuste Periodo 13: debe incluirse en balanza anual
      { account_id: acc601.id, cargo: 20_000, abono: 0, polizas: { company_id: company.id, ejercicio: 2026, periodo: 13, origin: 'AJUSTE_AUDIT' } },
      { account_id: acc102.id, cargo: 0, abono: 20_000, polizas: { company_id: company.id, ejercicio: 2026, periodo: 13, origin: 'AJUSTE_AUDIT' } },
      // CIERRE_ANUAL Periodo 13: debe excluirse para no cancelar resultados a 0
      { account_id: acc401.id, cargo: 300_000, abono: 0, polizas: { company_id: company.id, ejercicio: 2026, periodo: 13, origin: 'CIERRE_ANUAL' } },
      { account_id: acc601.id, cargo: 0, abono: 20_000, polizas: { company_id: company.id, ejercicio: 2026, periodo: 13, origin: 'CIERRE_ANUAL' } },
      { account_id: acc305.id, cargo: 0, abono: 280_000, polizas: { company_id: company.id, ejercicio: 2026, periodo: 13, origin: 'CIERRE_ANUAL' } }
    ];

    const { trialBalance, monthlyBalancesByPeriod } = buildAnnualMonthlyBalancesFromMovements(accounts, movs, 2026);
    const bal401 = trialBalance.find((a) => a.code === '401-01-001')!.finalBalance;
    const bal601 = trialBalance.find((a) => a.code === '601-01-001')!.finalBalance;
    expect(bal401).toBe(300_000);
    expect(bal601).toBe(20_000);

    // Depreciación proporcional previa a BAJA en mayo 2026 -> 4 meses usados (ene-abr)
    const assetBaja: FixedAssetRecord = {
      id: 'fa_baja',
      companyId: company.id,
      codigo: 'EQ-10',
      nombre: 'Equipo vendido en mayo',
      categoria: 'COMPUTO_30',
      fechaAdquisicion: '2025-01-10',
      montoOriginalInversion: 120_000,
      tasaAnualPct: 30,
      inpcAdquisicion: 138.0,
      inpcMedioPeriodo: 143.588,
      mesesDepreciadosPrevios: 11,
      estatus: 'BAJA',
      fechaBaja: '2026-05-15',
      precioVenta: 50_000,
      cuentaActivoCode: '156-01-001',
      cuentaDepAcumCode: '171-01-005',
      cuentaGastoDepCode: '601-01-006',
      cfdiUuid: null,
      createdAt: '2025-01-10T00:00:00Z'
    };
    const depBaja = computeAnnualFixedAssetFiscalDeduction([assetBaja], 2026);
    // 120,000 * 30% / 12 = 3,000/mes * 4 meses = 12,000 * factor INPC (>1)
    expect(depBaja).toBeGreaterThan(12_000);
    expect(depBaja).toBeLessThan(13_500);

    // Pérdidas Art. 57 LISR (vigencia 10 años, descarta 2015 expirada en 2026)
    const losses: FiscalLossCarryforward[] = [
      { id: 'l_exp', companyId: company.id, lossYear: 2015, originalAmount: 50_000, appliedAmount: 0, remainingAmount: 50_000 },
      { id: 'l_2024', companyId: company.id, lossYear: 2024, originalAmount: 30_000, appliedAmount: 0, remainingAmount: 30_000 }
    ];
    const art57 = computeArt57LossCarryforwards(losses, 2026, 80_000_00);
    expect(art57.pendientesNominalCents).toBe(30_000_00);
    expect(art57.actualizadasCents).toBeGreaterThanOrEqual(30_000_00);
    expect(art57.aplicadasCents).toBe(art57.actualizadasCents);

    const annual = computeAnnualTaxSummary({
      company,
      ejercicio: 2026,
      trialBalance,
      monthlyBalancesByPeriod,
      fixedAssetsFiscalDeduction: depBaja,
      paymentsProvisioned: 0,
      inputs: {},
      lossCarryforwards: losses
    });
    expect(annual.reconciliation.depreciacionFiscalInversiones).toBe(depBaja);
    expect(annual.reconciliation.perdidasFiscalesPendientes).toBe(30_000);
    expect(annual.reconciliation.perdidasFiscalesAplicadas).toBeGreaterThanOrEqual(30_000);
  });
});
