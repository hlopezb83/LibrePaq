import { describe, expect, it } from 'bun:test';
import { createPolizaTransaction } from '../repositories/polizas.repo';
import { getCompanyById } from '../repositories/companies.repo';
import { getAccounts } from '../repositories/accounts.repo';

describe('Pedimento Aduanal Import Accounting', () => {
  it('creates balanced journal entry for customs pedimento', () => {
    const comp = getCompanyById('comp_tnn_01');
    expect(comp).not.toBeNull();
    if (!comp) return;

    const accounts = getAccounts(comp.id);
    const affectable = accounts.filter((a) => a.isAffectable);
    expect(affectable.length).toBeGreaterThan(0);

    const accIva = affectable.find((a) => a.code.startsWith('118')) ?? affectable[0]!;
    const accGasto = affectable.find((a) => a.code.startsWith('601')) ?? affectable[1]!;
    const accBanco = affectable.find((a) => a.code.startsWith('102')) ?? affectable[2]!;

    const pedimentoNum = '24  240  3820  4001234';
    const ivaMonto = 40370;
    const dtaPrvMonto = 2310;
    const totalBanco = ivaMonto + dtaPrvMonto;

    const created = createPolizaTransaction({
      companyId: comp.id,
      ejercicio: comp.currentYear,
      periodo: comp.currentPeriod,
      tipo: 'EGRESO',
      fecha: `${comp.currentYear}-10-15`,
      concepto: `Pago Pedimento Aduanal A1 ${pedimentoNum} - Aduana 240`,
      cfdiUuid: null,
      origin: 'MANUAL',
      movements: [
        {
          accountId: accIva.id,
          referencia: 'PED-240-01',
          concepto: `IVA Acreditable Aduana Pedimento ${pedimentoNum}`,
          cargo: ivaMonto,
          abono: 0
        },
        {
          accountId: accGasto.id,
          referencia: 'PED-240-01',
          concepto: `DTA y Prevalidación Aduanal Pedimento ${pedimentoNum}`,
          cargo: dtaPrvMonto,
          abono: 0
        },
        {
          accountId: accBanco.id,
          referencia: 'PED-240-01',
          concepto: `Liquidación Contribuciones al Comercio Exterior Ped. ${pedimentoNum}`,
          cargo: 0,
          abono: totalBanco
        }
      ]
    });

    expect(created.isBalanced).toBe(true);
    expect(created.totalCargos).toBe(totalBanco);
    expect(created.totalAbonos).toBe(totalBanco);
    expect(created.concepto).toContain('Pedimento Aduanal');
  });
});
