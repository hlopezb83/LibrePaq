import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getSeedAccountsForPreset,
  type CatalogPreset
} from '../../shared/catalogs/base-accounts.seed';
import { supabaseFielAndSoap } from './supabase-fiel-soap';

export interface CreateCompanyDefaultsInput {
  companyId: string;
  cleanRfc: string;
  name: string;
  currentYear: number;
  currentPeriod: number;
  catalogPreset?: CatalogPreset;
  initialBankName?: string;
  initialBankAccount?: string;
  initialBankBalance?: number;
  createOpeningEntry?: boolean;
  fielCerBase64?: string;
  fielKeyBase64?: string;
  fielPassword?: string;
}

export async function seedCompanyDefaultsInSupabase(
  client: SupabaseClient,
  input: CreateCompanyDefaultsInput
): Promise<void> {
  const { companyId, currentYear, currentPeriod } = input;
  const bankName = input.initialBankName
    ? `${input.initialBankName} Cta ${input.initialBankAccount || 'Principal'}`
    : null;

  const accountsToInsert = getSeedAccountsForPreset(input.catalogPreset ?? 'SAT_STANDARD').map(
    (base) => ({
    id: `${companyId}_${base.code}`,
    company_id: companyId,
    code: base.code,
    name: base.code === '102-01-001' && bankName ? bankName : base.name,
    parent_code: base.parentCode ?? null,
    type: base.type,
    nature: base.nature,
    level: base.level,
    is_affectable: base.isAffectable,
    sat_group_code: base.satGroupCode,
    currency: base.currency,
    initial_balance: 0.0
  }));

  for (let i = 0; i < accountsToInsert.length; i += 100) {
    const chunk = accountsToInsert.slice(i, i + 100);
    const { error: seedErr } = await client.from('accounts').insert(chunk);
    if (seedErr) {
      console.warn('[Supabase] Advertencia al sembrar lote de cuentas:', seedErr.message);
    }
  }

  const bankBalance = Number(input.initialBankBalance || 0);
  if (input.createOpeningEntry && bankBalance > 0) {
    const polizaId = `pol_${companyId}_apertura`;
    const fecha = `${currentYear}-${String(Math.min(12, currentPeriod)).padStart(2, '0')}-01`;
    const now = new Date().toISOString();

    const { error: polErr } = await client.from('polizas').insert({
      id: polizaId,
      company_id: companyId,
      tipo: 'DIARIO',
      folio: 1,
      fecha,
      ejercicio: currentYear,
      periodo: currentPeriod,
      concepto: `Asiento de Apertura - Saldo Inicial en Bancos (${input.initialBankName || 'Bancos'}) y Capital Social`,
      cfdi_uuid: null,
      origin: 'MANUAL',
      created_at: now
    });
    if (polErr) throw new Error(`Error creando póliza de apertura: ${polErr.message}`);

    const { error: movErr } = await client.from('poliza_movements').insert([
      {
        id: `mov_${polizaId}_1`,
        poliza_id: polizaId,
        account_id: `${companyId}_102-01-001`,
        account_code: '102-01-001',
        account_name: bankName || 'Bancos Nacionales Moneda Nacional',
        referencia: 'APERTURA',
        concepto: `Apertura cuenta bancaria ${input.initialBankName || 'Bancos'}`,
        cargo: bankBalance,
        abono: 0
      },
      {
        id: `mov_${polizaId}_2`,
        poliza_id: polizaId,
        account_id: `${companyId}_301-01-001`,
        account_code: '301-01-001',
        account_name: 'Capital Fijo',
        referencia: 'APERTURA',
        concepto: 'Aportación de Capital Social Inicial',
        cargo: 0,
        abono: bankBalance
      }
    ]);
    if (movErr) {
      await client.from('polizas').delete().eq('id', polizaId);
      throw new Error(`Error creando movimientos de apertura: ${movErr.message}`);
    }
  }

  if (input.fielCerBase64 && input.fielKeyBase64) {
    try {
      if (input.fielPassword) {
        await supabaseFielAndSoap.saveFielCredentials({
          companyId,
          cerBase64: input.fielCerBase64,
          keyBase64: input.fielKeyBase64,
          passphrase: input.fielPassword
        });
      } else {
        console.warn('[Supabase] FIEL omitida en onboarding: se requiere contraseña para cifrar la llave privada.');
      }
    } catch (fielErr) {
      console.warn('[Supabase] Advertencia al persistir FIEL en onboarding:', fielErr);
    }
  }
}
