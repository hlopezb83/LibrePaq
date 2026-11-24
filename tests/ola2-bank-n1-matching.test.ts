import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { Hono } from 'hono';
import {
  createCompanyRecord,
  createPolizaTransaction,
  db,
  deleteCompanyRecord,
  getAccounts,
  initDatabase
} from '../src/server/db';
import { addBankStatementLinesTransaction } from '../src/server/repositories/bank.repo';
import {
  applyManyToOneMatchesRepo,
  ensureBankN1MatchesTable,
  listBankN1MatchesRepo,
  proposeManyToOneMatchesRepo
} from '../src/server/repositories/bank-n1.repo';
import { bankN1Routes } from '../src/server/routes/bank-n1.routes';
import { findManyToOneBankMatches } from '../src/shared/engine/bank-and-closing.engine';
import type { BankReconciliationResponse, BankStatementLine } from '../src/shared/types';
import {
  extractBankStatementMovements,
  MAX_BASE64_LENGTH,
  validateBankPdfRequest
} from '../supabase/functions/extract-bank-statement/handler';

describe('Ola 2C — Conciliación Bancaria N-a-1 & Extractor PDF Gemini', () => {
  const createdCompanyIds: string[] = [];

  beforeAll(() => {
    initDatabase();
    ensureBankN1MatchesTable(db);
  });

  afterAll(() => {
    for (const id of createdCompanyIds) {
      deleteCompanyRecord(id, 'owner_2c');
      deleteCompanyRecord(id);
    }
  });

  test('1. Motor N-a-1 empareja 1 depósito ↔ 3 pólizas dentro de tolerancia de centavos', () => {
    const lines: BankStatementLine[] = [
      {
        id: 'bsl_dep_1',
        companyId: 'c1',
        accountId: 'acc_102',
        fecha: '2026-10-20',
        ejercicio: 2026,
        periodo: 10,
        referencia: 'SPEI-9901',
        descripcion: 'PAGO CLIENTE LOTE 3 FACTURAS',
        cargoBanco: 0,
        abonoBanco: 1500.0,
        matchedMovementId: null,
        matchedPolizaFolio: null
      }
    ];

    const books: BankReconciliationResponse['bookMovements'] = [
      {
        movementId: 'mov_1',
        polizaId: 'pol_1',
        polizaFolio: 'INGRESO #1',
        fecha: '2026-10-10',
        referencia: 'F-101',
        concepto: 'Cobro Factura 101',
        cargoContable: 600.0,
        abonoContable: 0,
        isMatched: false
      },
      {
        movementId: 'mov_2',
        polizaId: 'pol_2',
        polizaFolio: 'INGRESO #2',
        fecha: '2026-10-14',
        referencia: 'F-102',
        concepto: 'Cobro Factura 102',
        cargoContable: 500.0,
        abonoContable: 0,
        isMatched: false
      },
      {
        movementId: 'mov_3',
        polizaId: 'pol_3',
        polizaFolio: 'INGRESO #3',
        fecha: '2026-10-18',
        referencia: 'F-103',
        concepto: 'Cobro Factura 103',
        cargoContable: 400.03,
        abonoContable: 0,
        isMatched: false
      },
      {
        movementId: 'mov_wrong_sign',
        polizaId: 'pol_4',
        polizaFolio: 'EGRESO #4',
        fecha: '2026-10-18',
        referencia: 'E-1',
        concepto: 'Egreso mismo importe',
        cargoContable: 0,
        abonoContable: 1500.0,
        isMatched: false
      }
    ];

    const proposals = findManyToOneBankMatches(lines, books, 5, 5);
    expect(proposals.length).toBe(1);
    expect(proposals[0]?.bankLineId).toBe('bsl_dep_1');
    expect(proposals[0]?.direction).toBe('DEPOSIT');
    expect(proposals[0]?.diffCents).toBe(3);
    expect(proposals[0]?.movements.map((m) => m.movementId).sort()).toEqual([
      'mov_1',
      'mov_2',
      'mov_3'
    ]);
  });

  test('2. Motor N-a-1 rechaza sumas fuera de tolerancia o fuera de ventana de fechas', () => {
    const lines: BankStatementLine[] = [
      {
        id: 'bsl_out',
        companyId: 'c1',
        accountId: 'acc_102',
        fecha: '2026-10-20',
        ejercicio: 2026,
        periodo: 10,
        referencia: 'SPEI-OUT',
        descripcion: 'DEPOSITO FUERA DE TOLERANCIA',
        cargoBanco: 0,
        abonoBanco: 1500.0,
        matchedMovementId: null,
        matchedPolizaFolio: null
      }
    ];

    const outOfToleranceBooks: BankReconciliationResponse['bookMovements'] = [
      {
        movementId: 'm_a',
        polizaId: 'p_a',
        polizaFolio: 'INGRESO #1',
        fecha: '2026-10-15',
        referencia: 'F-1',
        concepto: 'F1',
        cargoContable: 1000.0,
        abonoContable: 0,
        isMatched: false
      },
      {
        movementId: 'm_b',
        polizaId: 'p_b',
        polizaFolio: 'INGRESO #2',
        fecha: '2026-10-16',
        referencia: 'F-2',
        concepto: 'F2',
        cargoContable: 500.1,
        abonoContable: 0,
        isMatched: false
      }
    ];

    expect(findManyToOneBankMatches(lines, outOfToleranceBooks, 5, 5)).toEqual([]);

    const outOfWindowBooks = outOfToleranceBooks.map((b, idx) => ({
      ...b,
      fecha: '2026-01-10',
      cargoContable: idx === 0 ? 1000.0 : 500.0
    }));
    expect(findManyToOneBankMatches(lines, outOfWindowBooks, 5, 5)).toEqual([]);
  });

  test('3. Persistencia SQLite en bank_statement_matches y rutas Hono N-a-1 + import-pdf-lines', async () => {
    const company = createCompanyRecord({
      name: 'Empresa Bancos N1 S.A. de C.V.',
      rfc: 'EBN2105148K2',
      regimenFiscal: '601 - General de Ley Personas Morales',
      codigoPostal: '06000',
      currentYear: 2026,
      currentPeriod: 10
    });
    createdCompanyIds.push(company.id);

    const accounts = getAccounts(company.id);
    const bankAcc = accounts.find((a) => a.isAffectable && a.code.startsWith('102'));
    const clientAcc = accounts.find((a) => a.isAffectable && a.code.startsWith('105'));
    expect(bankAcc).toBeDefined();
    expect(clientAcc).toBeDefined();

    for (const [idx, amount] of [600, 500, 400.02].entries()) {
      createPolizaTransaction({
        companyId: company.id,
        ejercicio: 2026,
        periodo: 10,
        tipo: 'INGRESO',
        fecha: `2026-10-0${idx + 2}`,
        concepto: `Cobro cliente parcial ${idx + 1}`,
        cfdiUuid: null,
        origin: 'MANUAL',
        movements: [
          {
            accountId: bankAcc!.id,
            referencia: `COB-${idx + 1}`,
            concepto: `Depósito parcial ${idx + 1}`,
            cargo: amount,
            abono: 0
          },
          {
            accountId: clientAcc!.id,
            referencia: `COB-${idx + 1}`,
            concepto: `Abono cliente ${idx + 1}`,
            cargo: 0,
            abono: amount
          }
        ]
      });
    }

    addBankStatementLinesTransaction(company, bankAcc!.id, [
      {
        fecha: '2026-10-15',
        referencia: 'LOTE-N1',
        descripcion: 'TRANSFERENCIA CONCENTRADA 3 COBROS',
        cargoBanco: 0,
        abonoBanco: 1500.0
      }
    ]);

    ensureBankN1MatchesTable(db);
    ensureBankN1MatchesTable(db);

    const proposed = proposeManyToOneMatchesRepo(company.id, bankAcc!.id, 2026, 10);
    expect(proposed?.proposals.length).toBe(1);
    expect(proposed?.proposals[0]?.movements.length).toBe(3);

    const applied = applyManyToOneMatchesRepo(
      company.id,
      bankAcc!.id,
      proposed!.proposals,
      2026,
      10
    );
    expect(applied?.appliedCount).toBe(1);
    expect(applied?.matches.length).toBe(3);

    const persisted = listBankN1MatchesRepo(company.id);
    expect(persisted.length).toBe(3);

    const afterProposed = proposeManyToOneMatchesRepo(company.id, bankAcc!.id, 2026, 10);
    expect(afterProposed?.proposals.length).toBe(0);

    // Probar rutas Hono directamente
    const testApp = new Hono().basePath('/api');
    testApp.route('/', bankN1Routes);

    const getRes = await testApp.request(
      `/api/companies/${company.id}/bank-reconciliation/n-to-1?accountId=${encodeURIComponent(bankAcc!.id)}`
    );
    expect(getRes.status).toBe(200);
    const getBody = (await getRes.json()) as { proposals: unknown[]; matches: unknown[] };
    expect(getBody.matches.length).toBe(3);

    const importRes = await testApp.request(
      `/api/companies/${company.id}/bank-reconciliation/import-pdf-lines`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: bankAcc!.id,
          lines: [
            {
              fecha: '2026-10-25',
              referencia: 'PDF-001',
              descripcion: 'COMISION MENSUAL PDF',
              cargo: 290,
              abono: 0
            }
          ]
        })
      }
    );
    expect(importRes.status).toBe(201);
    const importBody = (await importRes.json()) as BankReconciliationResponse;
    expect(importBody.statementLines.some((l) => l.referencia === 'PDF-001')).toBe(true);
  });

  test('4. Validación de payload y normalización en handler extract-bank-statement', async () => {
    expect(validateBankPdfRequest('', 'application/pdf')).toBe('INVALID_INPUT');
    expect(validateBankPdfRequest('JVBERi0x', 'text/plain')).toBe('INVALID_INPUT');
    expect(
      validateBankPdfRequest('A'.repeat(MAX_BASE64_LENGTH + 1), 'application/pdf')
    ).toBe('FILE_TOO_LARGE');
    expect(validateBankPdfRequest('JVBERi0xLjQK', 'application/pdf')).toBeNull();

    const noKey = await extractBankStatementMovements('JVBERi0xLjQK', 'application/pdf', undefined);
    expect(noKey).toEqual({ ok: false, code: 'AI_NOT_CONFIGURED' });

    let capturedUrl = '';
    let capturedBody: Record<string, unknown> = {};
    const mockFetch: typeof fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedBody = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      banco: 'BBVA México',
                      cuenta: '0123456789',
                      moneda: 'mxn',
                      periodo: '2026-10',
                      movimientos: [
                        {
                          fecha: '15/OCT/2026',
                          referencia: 'SPEI-77',
                          descripcion: 'DEPOSITO CLIENTE',
                          cargo: -50,
                          abono: '$1,250.50'
                        },
                        {
                          fecha: '20/10/2026',
                          referencia: 'COM-01',
                          descripcion: 'COMISION SPEI',
                          cargo: 5.8,
                          abono: 0
                        }
                      ]
                    })
                  }
                ]
              }
            }
          ]
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as typeof fetch;

    const extracted = await extractBankStatementMovements(
      'JVBERi0xLjQK',
      'application/pdf',
      'test-gemini-key',
      mockFetch
    );

    expect(capturedUrl).toContain('gemini-2.5-flash:generateContent');
    expect(JSON.stringify(capturedBody)).toContain('inline_data');
    expect(JSON.stringify(capturedBody)).toContain('"response_mime_type":"application/json"');
    expect(extracted.ok).toBe(true);
    if (extracted.ok) {
      expect(extracted.banco).toBe('BBVA México');
      expect(extracted.moneda).toBe('MXN');
      expect(extracted.movimientos).toEqual([
        {
          fecha: '2026-10-15',
          referencia: 'SPEI-77',
          descripcion: 'DEPOSITO CLIENTE',
          cargo: 50,
          abono: 1250.5
        },
        {
          fecha: '2026-10-20',
          referencia: 'COM-01',
          descripcion: 'COMISION SPEI',
          cargo: 5.8,
          abono: 0
        }
      ]);
    }
  });
});
