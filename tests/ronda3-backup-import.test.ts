import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { db, initDatabase } from '../src/server/db';
import { createCompanyRecord, deleteCompanyRecord } from '../src/server/repositories/companies.repo';
import {
  exportCompanyBackupBundle,
  restoreCompanyBackupBundle
} from '../src/server/repositories/backup-restore.repo';
import { getCfdiDocuments } from '../src/server/repositories/cfdi.repo';
import {
  ensureAccountingRulesTable,
  listAccountingRulesRepo,
  upsertAccountingRuleRepo
} from '../src/server/repositories/accounting-rules.repo';
import {
  getAnnualTaxInputsRepo,
  saveAnnualTaxInputsRepo
} from '../src/server/repositories/annual-tax.repo';
import {
  getInventoryPeriodRepo,
  saveInventoryPeriodRepo
} from '../src/server/repositories/inventory.repo';
import {
  ensureBankN1MatchesTable,
  listBankN1MatchesRepo
} from '../src/server/repositories/bank-n1.repo';
import {
  clearCompanyChildTables,
  restoreBackupChildTables
} from '../src/lib/supabase/supabase-backup-mappers';
import { batchImportAccountsWithClient } from '../src/lib/supabase/supabase-backup-restore';
import { saveThirdPartyWithClient } from '../src/lib/supabase/supabase-fiscal-assets';
import type { CompanyBackupBundle } from '../src/shared/types';

describe('Ronda 3 — BUG-06 Backup/Restore SQLite & Supabase Mappers', () => {
  let companyId = '';

  beforeAll(() => {
    initDatabase();
    const created = createCompanyRecord({
      name: 'RONDA 3 BACKUP SA DE CV',
      rfc: 'R3B260101XYZ',
      regimenFiscal: '601',
      codigoPostal: '64000',
      currentYear: 2026,
      currentPeriod: 10
    });
    companyId = created.id;
  });

  afterAll(() => {
    if (companyId) {
      deleteCompanyRecord(companyId);
    }
  });

  test('SQLite export + restore preserves xmlRaw, taxBreakdown, relatedDocs, fixed_assets.estatus=BAJA, and Ola 2-4 tables', () => {
    const sampleXml = '<cfdi:Comprobante Version="4.0" Folio="901"><cfdi:Complemento/></cfdi:Comprobante>';
    const taxBreakdown = {
      base16: 1000,
      iva16: 160,
      base8: 500,
      iva8: 40,
      base0: 200,
      baseExento: 50,
      ieps: 25
    };
    const relatedDocs = [
      {
        idDocumento: '11111111-2222-4333-8444-555555555555',
        serie: 'A',
        folio: '12',
        monedaDr: 'MXN',
        equivalenciaDr: 1,
        numParcialidad: 1,
        impSaldoAnt: 1225,
        impPagado: 1225,
        impSaldoInsoluto: 0
      }
    ];

    const cfdiId = `cfdi_r3_${Date.now()}`;
    db.prepare(`
      INSERT INTO cfdi_documents (
        id, company_id, uuid, fecha, tipo_comprobante, direction, serie, folio,
        emisor_rfc, emisor_nombre, receptor_rfc, receptor_nombre,
        concepto_principal, clave_prod_serv, moneda, tipo_cambio,
        subtotal, descuento, iva_trasladado, isr_retenido, iva_retenido, total,
        metodo_pago, forma_pago, uso_cfdi, uuid_relacionado, status_sat, poliza_id,
        tax_breakdown, related_docs, xml_raw
      ) VALUES (?, ?, ?, '2026-10-15', 'P', 'RECIBIDO', 'A', '901',
        'PRO180214A99', 'PROVEEDOR DEMO', 'R3B260101XYZ', 'RONDA 3 BACKUP SA DE CV',
        'Pago factura multitasa', '84111506', 'MXN', 1,
        1775, 0, 200, 0, 0, 1975, 'PUE', '03', 'G03', NULL, 'VIGENTE', NULL,
        ?, ?, ?)
    `).run(
      cfdiId,
      companyId,
      'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE',
      JSON.stringify(taxBreakdown),
      JSON.stringify(relatedDocs),
      sampleXml
    );

    const faId = `fa_r3_baja_${Date.now()}`;
    db.prepare(`
      INSERT INTO fixed_assets (
        id, company_id, codigo, nombre, categoria, fecha_adquisicion, cfdi_uuid,
        monto_original_inversion, tasa_anual_pct, meses_depreciados_previos,
        inpc_adquisicion, inpc_medio_periodo, cuenta_activo_code, cuenta_dep_acum_code,
        cuenta_gasto_dep_code, estatus, created_at
      ) VALUES (?, ?, 'AF-BAJA-01', 'Equipo dado de baja', 'COMPUTO_30', '2025-01-10', NULL,
        50000, 30, 12, 132.54, 136.82, '156-01-001', '171-01-001', '601-01-006', 'BAJA', ?)
    `).run(faId, companyId, new Date().toISOString());

    ensureAccountingRulesTable(db);
    upsertAccountingRuleRepo({
      id: `rule_r3_${Date.now()}`,
      companyId,
      name: 'Regla R3',
      matchRfc: 'PRO180214A99',
      direction: 'RECIBIDO',
      operationAccountCode: '601-01-003',
      counterAccountCode: '201-01-001',
      deductiblePct: 85,
      priority: 50,
      autoLearned: true
    });

    saveAnnualTaxInputsRepo(companyId, 2026, {
      cucaInicial: 120000,
      cufinInicial: 85000,
      noDeduciblesManual: 4200
    });

    saveInventoryPeriodRepo(companyId, {
      ejercicio: 2026,
      periodo: 10,
      initialInventory: 30000,
      purchasesOverride: 15000,
      finalInventory: 12000,
      method: 'ANALITICO'
    });

    const bankLineId = `bsl_r3_${Date.now()}`;
    db.prepare(`
      INSERT INTO bank_statement_lines (
        id, company_id, account_id, fecha, ejercicio, periodo, referencia, descripcion,
        cargo_banco, abono_banco, matched_movement_id
      ) VALUES (?, ?, ?, '2026-10-15', 2026, 10, 'REF-N1', 'Pago combinado', 1000, 0, 'mov_dummy_1')
    `).run(bankLineId, companyId, `${companyId}_102-01-001`);

    ensureBankN1MatchesTable(db);
    const matchId = `bsm_r3_${Date.now()}`;
    db.prepare(`
      INSERT INTO bank_statement_matches (
        id, company_id, bank_line_id, movement_id, poliza_id, matched_amount, created_at
      ) VALUES (?, ?, ?, 'mov_dummy_1', 'pol_dummy_1', 600, ?)
    `).run(matchId, companyId, bankLineId, new Date().toISOString());

    const bundle = exportCompanyBackupBundle(companyId);

    const exportedCfdi = bundle.cfdis.find((c) => c.id === cfdiId);
    expect(exportedCfdi).toBeDefined();
    expect(exportedCfdi?.xmlRaw).toBe(sampleXml);
    expect(exportedCfdi?.taxBreakdown).toEqual(taxBreakdown);
    expect(exportedCfdi?.relatedDocs).toEqual(relatedDocs);

    const exportedAsset = bundle.fixedAssets.find((a) => a.id === faId);
    expect(exportedAsset?.estatus).toBe('BAJA');
    expect(bundle.accountingRules?.length).toBeGreaterThanOrEqual(1);
    expect(bundle.annualTaxSnapshots?.some((s) => s.ejercicio === 2026 && s.cucaInicial === 120000)).toBe(true);
    expect(bundle.inventoryPeriods?.some((i) => i.ejercicio === 2026 && i.periodo === 10 && i.finalInventory === 12000)).toBe(true);
    expect(bundle.bankStatementMatches?.some((m) => m.id === matchId && m.matchedAmount === 600)).toBe(true);

    // Wipe child rows to verify full restore
    db.prepare('DELETE FROM bank_statement_matches WHERE company_id = ?').run(companyId);
    db.prepare('DELETE FROM bank_statement_lines WHERE company_id = ?').run(companyId);
    db.prepare('DELETE FROM accounting_rules WHERE company_id = ?').run(companyId);
    db.prepare('DELETE FROM annual_tax_snapshots WHERE company_id = ?').run(companyId);
    db.prepare('DELETE FROM inventory_periods WHERE company_id = ?').run(companyId);
    db.prepare('DELETE FROM fixed_assets WHERE company_id = ?').run(companyId);
    db.prepare('DELETE FROM cfdi_documents WHERE company_id = ?').run(companyId);

    restoreCompanyBackupBundle(bundle);

    const restoredCfdi = getCfdiDocuments(companyId, { includeXml: true }).find((c) => c.id === cfdiId);
    expect(restoredCfdi?.xmlRaw).toBe(sampleXml);
    expect(restoredCfdi?.taxBreakdown).toEqual(taxBreakdown);
    expect(restoredCfdi?.relatedDocs).toEqual(relatedDocs);

    const restoredAsset = db
      .query('SELECT estatus FROM fixed_assets WHERE id = ?')
      .get(faId) as { estatus: string } | null;
    expect(restoredAsset?.estatus).toBe('BAJA');

    const restoredRules = listAccountingRulesRepo(companyId);
    expect(restoredRules.some((r) => r.name === 'Regla R3' && r.deductiblePct === 85)).toBe(true);

    const restoredAnnual = getAnnualTaxInputsRepo(companyId, 2026);
    expect(restoredAnnual.cucaInicial).toBe(120000);
    expect(restoredAnnual.cufinInicial).toBe(85000);
    expect(restoredAnnual.noDeduciblesManual).toBe(4200);

    const restoredInv = getInventoryPeriodRepo(companyId, 2026, 10);
    expect(restoredInv.initialInventory).toBe(30000);
    expect(restoredInv.purchasesOverride).toBe(15000);
    expect(restoredInv.finalInventory).toBe(12000);

    const restoredMatches = listBankN1MatchesRepo(companyId);
    expect(restoredMatches.some((m) => m.id === matchId && m.matchedAmount === 600)).toBe(true);
  });

  test('SQLite restoreCompanyBackupBundle stays backward-compatible with legacy JSON bundles without Ola 2-4 fields', () => {
    const exported = exportCompanyBackupBundle(companyId);
    const legacyBundle: CompanyBackupBundle = {
      version: exported.version,
      exportedAt: exported.exportedAt,
      company: exported.company,
      accounts: exported.accounts,
      cfdis: exported.cfdis.map((c) => ({
        ...c,
        taxBreakdown: undefined,
        relatedDocs: undefined
      })),
      polizas: exported.polizas,
      thirdParties: exported.thirdParties,
      fixedAssets: exported.fixedAssets,
      periodLocks: exported.periodLocks,
      taxParameters: exported.taxParameters
    };

    const restored = restoreCompanyBackupBundle(legacyBundle);
    expect(restored.id).toBe(companyId);
    // Optional tables from previous state should have been cleared cleanly without stale zombie rows
    expect(listAccountingRulesRepo(companyId)).toEqual([]);
    expect(listBankN1MatchesRepo(companyId)).toEqual([]);
  });

  test('Supabase backup mappers clear in FK order, tolerate missing optional tables, and map tax_breakdown/related_docs + Ola 2-4', async () => {
    const deleteOrder: string[] = [];
    const upsertCalls: Array<{ table: string; rows: Array<Record<string, unknown>>; onConflict?: string }> = [];

    const mockClient = {
      from(table: string) {
        return {
          delete() {
            return {
              async eq() {
                deleteOrder.push(table);
                if (table === 'accounting_rules') {
                  return { error: { code: 'PGRST205', message: 'Could not find the table public.accounting_rules' } };
                }
                return { error: null };
              }
            };
          },
          async upsert(data: Record<string, unknown> | Array<Record<string, unknown>>, opts?: { onConflict?: string }) {
            const rows = Array.isArray(data) ? data : [data];
            upsertCalls.push({ table, rows, onConflict: opts?.onConflict });
            return { error: null };
          }
        };
      }
    } as unknown as Parameters<typeof clearCompanyChildTables>[0];

    await clearCompanyChildTables(mockClient, companyId);
    expect(deleteOrder.indexOf('bank_statement_matches')).toBeGreaterThanOrEqual(0);
    expect(deleteOrder.indexOf('bank_statement_matches')).toBeLessThan(
      deleteOrder.indexOf('bank_statement_lines')
    );

    const bundle = exportCompanyBackupBundle(companyId);
    bundle.cfdis = [
      {
        id: 'cfdi_mock_1',
        companyId,
        uuid: '12345678-1234-4123-8123-123456789012',
        fecha: '2026-10-15',
        tipoComprobante: 'I',
        direction: 'RECIBIDO',
        serie: 'F',
        folio: '1',
        emisorRfc: 'AAA010101AAA',
        emisorNombre: 'Emisor',
        receptorRfc: bundle.company.rfc,
        receptorNombre: bundle.company.name,
        conceptoPrincipal: 'Servicio',
        claveProdServ: '84111506',
        moneda: 'MXN',
        tipoCambio: 1,
        subtotal: 100,
        descuento: 0,
        ivaTrasladado: 16,
        isrRetenido: 0,
        ivaRetenido: 0,
        total: 116,
        metodoPago: 'PUE',
        formaPago: '03',
        usoCfdi: 'G03',
        uuidRelacionado: null,
        statusSat: 'VIGENTE',
        polizaId: null,
        taxBreakdown: { base16: 100, iva16: 16, base8: 0, iva8: 0, base0: 0, baseExento: 0, ieps: 0 },
        relatedDocs: [{ idDocumento: 'REL-1', numParcialidad: 1, impSaldoAnt: 116, impPagado: 116, impSaldoInsoluto: 0, monedaDr: 'MXN', equivalenciaDr: 1 }],
        xmlRaw: '<xml/>'
      }
    ];
    bundle.accountingRules = [
      {
        id: 'rule_mock_1',
        companyId,
        name: 'Rule Mock',
        matchRfc: 'AAA010101AAA',
        matchClaveProdServ: null,
        matchUsoCfdi: null,
        direction: 'RECIBIDO',
        operationAccountCode: '601-01-003',
        counterAccountCode: '201-01-001',
        deductiblePct: 100,
        priority: 10,
        autoLearned: false,
        createdAt: '2026-10-01T00:00:00Z',
        updatedAt: '2026-10-01T00:00:00Z'
      }
    ];
    bundle.annualTaxSnapshots = [
      {
        companyId,
        ejercicio: 2026,
        inpcCierreAnterior: 139.38,
        inpcCierreActual: 145.4,
        cucaInicial: 50000,
        aportacionesCapital: 0,
        reduccionesCapital: 0,
        cufinInicial: 25000,
        dividendosPagados: 0,
        ptuPagadaAnterior: 0,
        noDeduciblesManual: 0
      }
    ];
    bundle.inventoryPeriods = [
      {
        id: `inv_${companyId}_2026_10`,
        companyId,
        ejercicio: 2026,
        periodo: 10,
        initialInventory: 1000,
        purchasesFromBalance: 0,
        purchasesOverride: 500,
        effectivePurchases: 500,
        finalInventory: 300,
        costOfSales: 1200,
        method: 'ANALITICO',
        polizaId: null
      }
    ];
    bundle.bankStatementMatches = [
      {
        id: 'bsm_mock_1',
        companyId,
        bankLineId: 'bsl_mock_1',
        movementId: 'mov_mock_1',
        polizaId: 'pol_mock_1',
        matchedAmount: 116,
        createdAt: '2026-10-15T00:00:00Z'
      }
    ];

    await restoreBackupChildTables(
      mockClient,
      companyId,
      bundle,
      async (_cid, accs) => ({ importedCount: accs.length, updatedCount: 0 })
    );

    const cfdiUpsert = upsertCalls.find((c) => c.table === 'cfdi_documents');
    expect(cfdiUpsert?.rows[0]?.tax_breakdown).toEqual(bundle.cfdis[0]?.taxBreakdown);
    expect(cfdiUpsert?.rows[0]?.related_docs).toEqual(bundle.cfdis[0]?.relatedDocs);

    expect(upsertCalls.some((c) => c.table === 'accounting_rules' && c.onConflict === 'id')).toBe(true);
    expect(upsertCalls.some((c) => c.table === 'annual_tax_snapshots' && c.onConflict === 'company_id,ejercicio')).toBe(true);
    expect(upsertCalls.some((c) => c.table === 'inventory_periods' && c.onConflict === 'company_id,ejercicio,periodo')).toBe(true);
    expect(upsertCalls.some((c) => c.table === 'bank_statement_matches' && c.onConflict === 'id')).toBe(true);
  });

  test('BUG-19: batchImportAccountsWithClient preserves existing id, defaults sat_group_code, checks period 1, and upserts on company_id,code', async () => {
    const upsertCalls: Array<{ rows: Array<Record<string, unknown>>; onConflict?: string }> = [];
    let periodCheckCalls: Array<{ cid: string; yr: number; per: number }> = [];

    const mockClient = {
      from(table: string) {
        if (table === 'accounts') {
          return {
            select() {
              return {
                eq() {
                  return {
                    order() {
                      return {
                        async range() {
                          return {
                            data: [
                              {
                                id: 'legacy_acc_uuid_102',
                                code: '102-01-001',
                                initial_balance: 1000,
                                nature: 'DEUDORA'
                              }
                            ],
                            error: null
                          };
                        }
                      };
                    }
                  };
                }
              };
            },
            async upsert(data: Array<Record<string, unknown>>, opts?: { onConflict?: string }) {
              upsertCalls.push({ rows: data, onConflict: opts?.onConflict });
              return { error: null };
            }
          };
        }
        if (table === 'poliza_movements') {
          return {
            select() {
              return {
                async in() {
                  return { data: [], error: null };
                }
              };
            }
          };
        }
        if (table === 'companies') {
          return {
            select() {
              return {
                eq() {
                  return {
                    async maybeSingle() {
                      return { data: { current_year: 2026 }, error: null };
                    }
                  };
                }
              };
            }
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }
    } as unknown as Parameters<typeof batchImportAccountsWithClient>[0];

    const res = await batchImportAccountsWithClient(
      mockClient,
      companyId,
      [
        { code: '102-01-001', name: 'Bancos Actualizado', initialBalance: 2500 },
        { code: '601-01-010', name: 'Gastos Papelería', initialBalance: 0 }
      ],
      async (cid, yr, per) => {
        periodCheckCalls.push({ cid, yr, per });
      }
    );

    expect(res).toEqual({ importedCount: 1, updatedCount: 1 });
    expect(periodCheckCalls).toEqual([{ cid: companyId, yr: 2026, per: 1 }]);
    expect(upsertCalls.length).toBe(1);
    expect(upsertCalls[0]?.onConflict).toBe('company_id,code');

    const updatedRow = upsertCalls[0]?.rows.find((r) => r.code === '102-01-001');
    const insertedRow = upsertCalls[0]?.rows.find((r) => r.code === '601-01-010');
    expect(updatedRow?.id).toBe('legacy_acc_uuid_102');
    expect(updatedRow?.sat_group_code).toBe('102');
    expect(insertedRow?.sat_group_code).toBe('601');

    // Also blocks when period 1 is locked and new account has non-zero balance
    await expect(
      batchImportAccountsWithClient(
        mockClient,
        companyId,
        [{ code: '601-01-011', name: 'Con saldo', initialBalance: 500 }],
        async () => {
          throw new Error('Periodo cerrado: 2026-01');
        }
      )
    ).rejects.toThrow('Periodo cerrado: 2026-01');
  });

  test('BUG-47: saveThirdPartyWithClient reuses existing id for (company_id, rfc) and upserts with onConflict company_id,rfc', async () => {
    const upsertCalls: Array<{ row: Record<string, unknown>; onConflict?: string }> = [];

    const mockClient = {
      from(table: string) {
        expect(table).toBe('third_parties');
        return {
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      async maybeSingle() {
                        return { data: { id: 'existing_tp_uuid_99' }, error: null };
                      }
                    };
                  }
                };
              }
            };
          },
          upsert(row: Record<string, unknown>, opts?: { onConflict?: string }) {
            upsertCalls.push({ row, onConflict: opts?.onConflict });
            return {
              select() {
                return {
                  async single() {
                    return { data: row, error: null };
                  }
                };
              }
            };
          }
        };
      }
    } as unknown as Parameters<typeof saveThirdPartyWithClient>[0];

    const saved = await saveThirdPartyWithClient(mockClient, {
      companyId,
      rfc: '  pro180214a99 ',
      nombre: 'Proveedor Actualizado',
      rol: 'PROVEEDOR',
      cuentaOperacionCode: '601-01-003',
      cuentaContrapartidaCode: '201-01-001',
      tipoTerceroDiot: '04',
      tipoOperacionDiot: '85',
      tasaIvaDefault: 16,
      estatus69B: 'LIMPIO'
    });

    expect(saved.id).toBe('existing_tp_uuid_99');
    expect(saved.rfc).toBe('PRO180214A99');
    expect(upsertCalls.length).toBe(1);
    expect(upsertCalls[0]?.onConflict).toBe('company_id,rfc');
    expect(upsertCalls[0]?.row.id).toBe('existing_tp_uuid_99');
  });
});
