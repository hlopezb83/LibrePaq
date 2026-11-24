import { afterEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateRfcModulo11 } from '../src/shared/engine/rfc-validator';
import { normalizeSatRegimenFiscal } from '../src/shared/gemini-csf-extractor';
import { filterRegimenesByPersonType } from '../src/components/onboarding/WizardStep1Identity';
import { DEFAULT_ACCOUNTING_SCOPES } from '../src/lib/api-client';
import { setGuestDemoMode } from '../src/lib/sandbox/guest-demo-mode';
import { guestDemoApi } from '../src/lib/sandbox/guest-demo-api';
import { guestDemoExtras } from '../src/lib/sandbox/guest-demo-extras';
import { getGuestDemoState, resetGuestDemoState } from '../src/lib/sandbox/guest-demo-store';
import { workspaceRbacClient } from '../src/lib/workspace-rbac-client';
import { mapSupabaseThirdParty } from '../src/lib/supabase/supabase-fiscal-assets-helpers';
import { resolveFiscalBancosTab } from '../src/views/fiscal-bancos/useDiotBancosManager';
import { translateAuthError } from '../src/components/auth/authErrorTranslator';
import { getSeedAccountsForPreset } from '../src/shared/catalogs/base-accounts.seed';

describe('Ronda 5 Ola 4 — Onboarding RESICO, RFC M11, RBAC, Sandbox & UI/UX', () => {
  afterEach(() => {
    setGuestDemoMode(false);
    resetGuestDemoState();
  });

  test('1. RFC Modulo 11 never returns null check digits for valid 12/13-char formats like GODE900101ABC', () => {
    const res = validateRfcModulo11('GODE900101ABC');
    expect(res.isValidFormat).toBe(true);
    expect(res.actualCheckDigit).toBe('C');
    expect(res.expectedCheckDigit).not.toBeNull();
    expect(String(res.message || '')).not.toContain("'null'");

    const generic = validateRfcModulo11('XAXX010101000');
    expect(generic.isValidFormat).toBe(true);
    expect(generic.isValidCheckDigit).toBe(true);
  });

  test('2. normalizeSatRegimenFiscal maps 626 raw text to full SAT RESICO label', () => {
    expect(normalizeSatRegimenFiscal('626 - Régimen Simplificado de Confianza', 'FISICA')).toBe(
      '626 - Régimen Simplificado de Confianza (RESICO)'
    );
    expect(normalizeSatRegimenFiscal('601', 'MORAL')).toBe(
      '601 - General de Ley Personas Morales'
    );
  });

  test('3. filterRegimenesByPersonType separates Persona Moral vs Persona Física regimes', () => {
    const moral = filterRegimenesByPersonType('MORAL');
    const fisica = filterRegimenesByPersonType('FISICA');

    expect(moral.some((r) => r.startsWith('601'))).toBe(true);
    expect(moral.some((r) => r.startsWith('626'))).toBe(true);
    expect(moral.some((r) => r.startsWith('612'))).toBe(false);
    expect(moral.some((r) => r.startsWith('625'))).toBe(false);

    expect(fisica.some((r) => r.startsWith('612'))).toBe(true);
    expect(fisica.some((r) => r.startsWith('626'))).toBe(true);
    expect(fisica.some((r) => r.startsWith('625'))).toBe(true);
    expect(fisica.some((r) => r.startsWith('601'))).toBe(false);
  });

  test('4. Guest Demo createCompany honors RESICO_SIMPLIFIED preset and opening bank poliza', async () => {
    resetGuestDemoState();
    const resicoSeedCount = getSeedAccountsForPreset('RESICO_SIMPLIFIED').length;
    const company = await guestDemoApi.createCompany({
      name: 'Consultoría RESICO Demo',
      rfc: 'GODE900101ABC',
      regimenFiscal: '626 - Régimen Simplificado de Confianza (RESICO)',
      codigoPostal: '64000',
      currentYear: 2026,
      currentPeriod: 10,
      catalogPreset: 'RESICO_SIMPLIFIED',
      initialBankName: 'BBVA',
      initialBankAccount: '0198',
      initialBankBalance: 50000,
      createOpeningEntry: true
    });

    const accounts = await guestDemoApi.getAccounts(company.id);
    expect(accounts.length).toBe(resicoSeedCount);
    const bankAcc = accounts.find((a) => a.code === '102-01-001');
    expect(bankAcc?.name).toContain('BBVA');
    expect(bankAcc?.name).toContain('0198');

    const polizas = await guestDemoApi.getPolizas(company.id, 2026, 10);
    expect(polizas.length).toBe(1);
    expect(polizas[0]?.totalCargos).toBe(50000);
    expect(polizas[0]?.totalAbonos).toBe(50000);
  });

  test('5. Guest Demo getBankReconciliation, getDiotReport, inventory period & N:1 apply return real computed figures', async () => {
    resetGuestDemoState();
    const state = getGuestDemoState();
    const demoComp = state.companies[0]!;
    const bankAcc = state.accounts.find((a) => a.companyId === demoComp.id && a.code === '102-01-001')!;

    const recon = await guestDemoExtras.getBankReconciliation(
      demoComp.id,
      bankAcc.id,
      demoComp.currentYear,
      demoComp.currentPeriod
    );
    expect(recon.account.id).toBe(bankAcc.id);
    expect(typeof recon.summary.saldoFinalLibros).toBe('number');
    expect(recon.summary.saldoFinalLibros).not.toBe(0);
    expect(recon.bookMovements.length).toBeGreaterThan(0);

    const diot = await guestDemoExtras.getDiotReport(
      demoComp.id,
      demoComp.currentYear,
      demoComp.currentPeriod
    );
    expect(diot.totals.ivaTrasladadoCobrado).toBeGreaterThan(0);

    const savedInv = await guestDemoExtras.saveInventoryPeriod(demoComp.id, {
      ejercicio: demoComp.currentYear,
      periodo: demoComp.currentPeriod,
      initialInventory: 10000,
      purchasesOverride: 25000,
      finalInventory: 12000
    });
    expect(savedInv.costOfSales).toBe(23000);

    const loadedInv = await guestDemoExtras.getInventoryPeriod(
      demoComp.id,
      demoComp.currentYear,
      demoComp.currentPeriod
    );
    expect(loadedInv.costOfSales).toBe(23000);
    expect(loadedInv.finalInventory).toBe(12000);

    const n1Propose = await guestDemoExtras.proposeBankN1Matches(
      demoComp.id,
      bankAcc.id,
      demoComp.currentYear,
      demoComp.currentPeriod
    );
    expect(Array.isArray(n1Propose.proposals)).toBe(true);

    const n1Apply = await guestDemoExtras.applyBankN1Matches(
      demoComp.id,
      bankAcc.id,
      [],
      demoComp.currentYear,
      demoComp.currentPeriod
    );
    expect(n1Apply.appliedCount).toBe(0);
    expect(n1Apply.reconciliation?.account.id).toBe(bankAcc.id);
    expect(n1Apply.reconciliation?.summary.saldoFinalLibros).toBe(recon.summary.saldoFinalLibros);
  });

  test('6. workspaceRbacClient returns in-memory demo RBAC data in Guest Demo mode without HTTP calls', async () => {
    setGuestDemoMode(true);
    const demoComp = getGuestDemoState().companies[0]!;
    const role = await workspaceRbacClient.getEffectiveCompanyRole(demoComp.id);
    const members = await workspaceRbacClient.listWorkspaceMembers('ws_demo');
    const audit = await workspaceRbacClient.listCompanyAuditLogs(demoComp.id, 10);

    expect(role.role).toBe('OWNER');
    expect(role.isReadOnlyClient).toBe(false);
    expect(members.length).toBeGreaterThan(0);
    expect(audit.length).toBeGreaterThan(0);
  });

  test('7. DEFAULT_ACCOUNTING_SCOPES and ThirdParty backup aliases include all required fields', () => {
    expect(DEFAULT_ACCOUNTING_SCOPES).toContain('inventory-cost');
    expect(DEFAULT_ACCOUNTING_SCOPES).toContain('payroll-settings');
    expect(DEFAULT_ACCOUNTING_SCOPES).toContain('annual-tax');
    expect(DEFAULT_ACCOUNTING_SCOPES).toContain('auxiliares-diario');
    expect(DEFAULT_ACCOUNTING_SCOPES).toContain('accounting-rules');
    expect(DEFAULT_ACCOUNTING_SCOPES).toContain('fiel-status');
    expect(DEFAULT_ACCOUNTING_SCOPES).toContain('sat-requests');

    const tp = mapSupabaseThirdParty({
      id: 'tp_1',
      company_id: 'c_1',
      rfc: 'AAA010101AAA',
      nombre: 'Proveedor Uno',
      deductible_pct: 85,
      estatus_69b: 'PRESUNTO_EFOS'
    });
    expect(tp.deductiblePct).toBe(85);
    expect(tp.estatus69B).toBe('PRESUNTO_EFOS');
    expect(tp.estatus69b).toBe('PRESUNTO_EFOS');
  });

  test('8. Route tab resolution, Spanish auth translator & Ronda 5 SQL migration integrity', () => {
    expect(resolveFiscalBancosTab('DIA17')).toBe('PAPEL_DIA_17');
    expect(resolveFiscalBancosTab('CONCILIACION')).toBe('CONCILIACION');
    expect(resolveFiscalBancosTab('UNKNOWN')).toBeNull();

    const errMsg = translateAuthError('Invalid login credentials');
    expect(errMsg).toContain('Correo o contraseña incorrectos');
    expect(errMsg.toLowerCase()).not.toContain('supabase');

    const sqlPath = resolve(
      process.cwd(),
      'supabase/migrations/20261125000008_ronda5_sat_resico_and_integrity.sql'
    );
    const sql = readFileSync(sqlPath, 'utf8');
    expect(sql).toContain('uq_cfdi_documents_company_uuid');
    expect(sql).toContain('trg_enforce_period_lock_poliza_cfdis');
    expect(sql).toContain('restore_company_backup_atomic');
    expect(sql).toContain('payroll_period_settings');
    expect(sql).toContain('poliza_cfdis');
    expect(sql).toContain('estatus69B');
    expect(sql).toContain('deductiblePct');
  });
});
