import { supabase } from '../supabase';
import { assertAccountingInvariant } from '../../shared/accounting-engine';
import { fetchAllRows, chunkArray } from './supabase-pagination';
import type {
  Account, AccountNature, AccountType, Company, CompanyBackupBundle,
  FixedAssetRecord, PeriodLock, Poliza, TaxParametersRecord
} from '../../shared/types';
import { mapSupabaseAccount, supabaseCompaniesAndAccounts } from './supabase-companies-accounts';
import { mapSupabasePoliza } from './supabase-polizas';
import { mapSupabaseCfdi } from './supabase-cfdi';
import { supabaseFiscalAndAssets } from './supabase-fiscal-assets';

export const supabaseBackupRestore = {
  async batchImportAccounts(
    companyId: string,
    rows: Array<{
      id?: string;
      code: string;
      name: string;
      parentCode?: string | null;
      type?: string;
      nature?: string;
      level?: number;
      satGroupCode?: string;
      isAffectable?: boolean;
      initialBalance?: number;
    }>
  ): Promise<{ importedCount: number; updatedCount: number }> {
    if (!supabase) throw new Error('Supabase no disponible');

    const accountsToUpsert = rows.map((r) => {
      const code = r.code.trim();
      const codeDigits = code.replace(/[^0-9]/g, '');
      const firstDigit = codeDigits[0] || '1';
      const dType: AccountType = firstDigit === '1' ? 'ACTIVO' : firstDigit === '2' ? 'PASIVO' : firstDigit === '3' ? 'CAPITAL' : firstDigit === '4' ? 'INGRESOS' : firstDigit === '5' ? 'COSTOS' : 'GASTOS';
      const dNat: AccountNature = dType === 'ACTIVO' || dType === 'COSTOS' || dType === 'GASTOS' ? 'DEUDORA' : 'ACREEDORA';

      return {
        id: r.id || `${companyId}_${code}`,
        company_id: companyId,
        code,
        name: r.name.trim(),
        parent_code: r.parentCode || null,
        level: r.level !== undefined && Number(r.level) >= 1 ? Number(r.level) : code.endsWith('00-000') ? 1 : code.endsWith('-000') ? 2 : 3,
        type: (r.type as AccountType) || dType,
        nature: (r.nature as AccountNature) || dNat,
        sat_group_code: r.satGroupCode || null,
        is_affectable: r.isAffectable !== undefined ? r.isAffectable : true,
        initial_balance: Number(r.initialBalance || 0)
      };
    });

    const { error } = await supabase.from('accounts').upsert(accountsToUpsert, {
      onConflict: 'id'
    });

    if (error) throw new Error(error.message);

    return {
      importedCount: accountsToUpsert.length,
      updatedCount: 0
    };
  },

  async exportCompanyBackup(companyId: string): Promise<CompanyBackupBundle> {
    const client = supabase;
    if (!client) throw new Error('Supabase no disponible');

    const companies = await supabaseCompaniesAndAccounts.getCompanies();
    const company = companies.find((c) => c.id === companyId);
    if (!company) throw new Error(`Empresa no encontrada: ${companyId}`);

    const [
      rawAccounts, rawCfdis, rawPolizas,
      thirdParties, fixedAssetsRes,
      periodLocksRes, taxParamsRes, rawBankLines
    ] = await Promise.all([
      fetchAllRows((from, to) => client.from('accounts').select('*').eq('company_id', companyId).order('id').range(from, to)),
      fetchAllRows((from, to) => client.from('cfdi_documents').select('*').eq('company_id', companyId).order('id').range(from, to)),
      fetchAllRows((from, to) => client.from('polizas').select('*, poliza_movements(*)').eq('company_id', companyId).order('id').range(from, to)),
      supabaseFiscalAndAssets.getThirdParties(companyId),
      supabaseFiscalAndAssets.getFixedAssets(companyId),
      client.from('period_locks').select('*').eq('company_id', companyId),
      client.from('tax_parameters').select('*').eq('company_id', companyId),
      fetchAllRows((from, to) => client.from('bank_statement_lines').select('*').eq('company_id', companyId).order('id').range(from, to))
    ]);

    const accounts: Account[] = rawAccounts.map((r) => mapSupabaseAccount(r as Record<string, unknown>));
    const cfdis = rawCfdis.map((r) => mapSupabaseCfdi(r as Record<string, unknown>));
    const polizas: Poliza[] = rawPolizas.map((r) =>
      mapSupabasePoliza(r as Record<string, unknown>, (r as Record<string, unknown>).poliza_movements)
    );
    const fixedAssets: FixedAssetRecord[] = fixedAssetsRes.assets;

    const periodLocks: PeriodLock[] = (periodLocksRes.data || []).map((r) => ({
      companyId: String(r.company_id),
      ejercicio: Number(r.ejercicio),
      periodo: Number(r.periodo),
      isLocked: Boolean(r.is_locked),
      lockedAt: r.locked_at ? String(r.locked_at) : null,
      notes: r.notes ? String(r.notes) : ''
    }));

    const taxParameters: TaxParametersRecord[] = (taxParamsRes.data || []).map((r) => ({
      companyId: String(r.company_id),
      ejercicio: Number(r.ejercicio),
      coeficienteUtilidad: Number(r.coeficiente_utilidad || 0.1845),
      perdidasFiscalesPendientes: Number(r.perdidas_fiscales_pendientes || 0),
      pagosProvisionalesAnteriores: Number(r.pagos_provisionales_anteriores || 0),
      saldoFavorIvaAnterior: Number(r.saldo_favor_iva_anterior || 0),
      tipoCambioDofCierre: Number(r.tipo_cambio_dof_cierre || 19.865)
    }));

    const bankStatementLines = (rawBankLines as Array<Record<string, unknown>>).map((b) => ({
      id: String(b.id), companyId: String(b.company_id), accountId: String(b.account_id),
      fecha: String(b.fecha), ejercicio: Number(b.ejercicio), periodo: Number(b.periodo),
      referencia: String(b.referencia || ''), descripcion: String(b.descripcion || ''),
      cargoBanco: Number(b.cargo_banco || 0), abonoBanco: Number(b.abono_banco || 0),
      matchedMovementId: b.matched_movement_id ? String(b.matched_movement_id) : null,
      matchedPolizaFolio: b.matched_poliza_folio ? String(b.matched_poliza_folio) : null
    }));

    return {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      company,
      accounts,
      cfdis,
      polizas,
      thirdParties,
      fixedAssets,
      periodLocks,
      taxParameters,
      bankStatementLines
    };
  },

  async restoreCompanyBackup(bundle: CompanyBackupBundle): Promise<Company> {
    const client = supabase;
    if (!client) throw new Error('Supabase no disponible');

    assertAccountingInvariant(
      Boolean(bundle && bundle.company && bundle.company.rfc),
      'INVALID_BACKUP_BUNDLE',
      'El archivo de respaldo JSON no tiene una estructura válida de LibrePaq.'
    );

    const comp = bundle.company;
    const { data: authData } = await client.auth.getUser();
    const userId = authData?.user?.id || comp.userId || null;

    const { error: compErr } = await client.from('companies').upsert({
      id: comp.id,
      name: comp.name,
      rfc: comp.rfc,
      regimen_fiscal: comp.regimenFiscal,
      codigo_postal: comp.codigoPostal,
      mask_format: comp.maskFormat || 'XXX-XX-XXX',
      current_year: comp.currentYear || 2026,
      current_period: comp.currentPeriod || 10,
      created_at: comp.createdAt || new Date().toISOString(),
      user_id: userId
    });

    if (compErr) throw new Error(compErr.message);

    // R6-CRIT-02: Limpieza previa de tablas hijas para evitar datos zombie post-respaldo
    await Promise.allSettled([
      client.from('bank_statement_lines').delete().eq('company_id', comp.id),
      client.from('cfdi_documents').delete().eq('company_id', comp.id),
      client.from('polizas').delete().eq('company_id', comp.id),
      client.from('fixed_assets').delete().eq('company_id', comp.id),
      client.from('third_parties').delete().eq('company_id', comp.id),
      client.from('period_locks').delete().eq('company_id', comp.id)
    ]);

    const assertUpsert = async (table: string, data: Record<string, unknown> | Array<Record<string, unknown>>, opts?: { onConflict?: string }) => {
      const { error } = await client.from(table).upsert(data, opts);
      if (error) throw new Error(`[Restore ${table}] Error: ${error.message}`);
    };

    if (Array.isArray(bundle.accounts) && bundle.accounts.length > 0) {
      await this.batchImportAccounts(comp.id, bundle.accounts);
    }

    if (Array.isArray(bundle.taxParameters) && bundle.taxParameters[0]) {
      const tp = bundle.taxParameters[0];
      await assertUpsert('tax_parameters', {
        company_id: comp.id,
        ejercicio: tp.ejercicio || comp.currentYear || 2026,
        coeficiente_utilidad: tp.coeficienteUtilidad,
        perdidas_fiscales_pendientes: tp.perdidasFiscalesPendientes,
        pagos_provisionales_anteriores: tp.pagosProvisionalesAnteriores,
        saldo_favor_iva_anterior: tp.saldoFavorIvaAnterior,
        tipo_cambio_dof_cierre: tp.tipoCambioDofCierre
      });
    }

    if (Array.isArray(bundle.polizas) && bundle.polizas.length > 0) {
      const polsToUpsert = bundle.polizas.map((p) => ({
        id: p.id,
        company_id: comp.id,
        tipo: p.tipo,
        folio: p.folio,
        fecha: p.fecha,
        ejercicio: p.ejercicio,
        periodo: p.periodo,
        concepto: p.concepto,
        cfdi_uuid: p.cfdiUuid || null,
        origin: p.origin || 'MANUAL',
        created_at: p.createdAt || new Date().toISOString()
      }));
      for (const chunk of chunkArray(polsToUpsert, 100)) {
        await assertUpsert('polizas', chunk, { onConflict: 'id' });
      }

      const movsToUpsert = bundle.polizas.flatMap((p) =>
        (p.movements || []).map((m) => ({
          id: m.id,
          poliza_id: p.id,
          account_id: m.accountId,
          account_code: m.accountCode || '',
          account_name: m.accountName || '',
          referencia: m.referencia || '',
          concepto: m.concepto || '',
          cargo: Number(m.cargo || 0),
          abono: Number(m.abono || 0),
          cfdi_uuid: m.cfdiUuid || null
        }))
      );
      for (const chunk of chunkArray(movsToUpsert, 150)) {
        await assertUpsert('poliza_movements', chunk, { onConflict: 'id' });
      }
    }

    if (Array.isArray(bundle.cfdis) && bundle.cfdis.length > 0) {
      const cfdisToUpsert = bundle.cfdis.map((c) => ({
        id: c.id,
        company_id: comp.id,
        uuid: c.uuid,
        fecha: c.fecha,
        tipo_comprobante: c.tipoComprobante,
        direction: c.direction,
        serie: c.serie || '',
        folio: c.folio || '',
        emisor_rfc: c.emisorRfc,
        emisor_nombre: c.emisorNombre,
        receptor_rfc: c.receptorRfc,
        receptor_nombre: c.receptorNombre,
        concepto_principal: c.conceptoPrincipal,
        clave_prod_serv: c.claveProdServ || '01010101',
        moneda: c.moneda || 'MXN',
        tipo_cambio: Number(c.tipoCambio || 1),
        subtotal: Number(c.subtotal || 0),
        descuento: Number(c.descuento || 0),
        iva_trasladado: Number(c.ivaTrasladado || 0),
        isr_retenido: Number(c.isrRetenido || 0),
        iva_retenido: Number(c.ivaRetenido || 0),
        total: Number(c.total || 0),
        metodo_pago: c.metodoPago || 'PUE',
        forma_pago: c.formaPago || '03',
        uso_cfdi: c.usoCfdi || 'G03',
        uuid_relacionado: c.uuidRelacionado || null,
        status_sat: c.statusSat || 'VIGENTE',
        poliza_id: c.polizaId || null,
        xml_raw: c.xmlRaw || ''
      }));
      for (const chunk of chunkArray(cfdisToUpsert, 100)) {
        await assertUpsert('cfdi_documents', chunk, { onConflict: 'id' });
      }
    }

    if (Array.isArray(bundle.fixedAssets) && bundle.fixedAssets.length > 0) {
      const faToUpsert = bundle.fixedAssets.map((fa) => ({
        id: fa.id,
        company_id: comp.id,
        codigo: fa.codigo,
        nombre: fa.nombre,
        categoria: fa.categoria,
        fecha_adquisicion: fa.fechaAdquisicion,
        cfdi_uuid: fa.cfdiUuid || null,
        monto_original_inversion: Number(fa.montoOriginalInversion || 0),
        tasa_anual_pct: Number(fa.tasaAnualPct || 0),
        meses_depreciados_previos: Number(fa.mesesDepreciadosPrevios || 0),
        inpc_adquisicion: Number(fa.inpcAdquisicion || 1),
        inpc_medio_periodo: Number(fa.inpcMedioPeriodo || 1),
        cuenta_activo_code: fa.cuentaActivoCode || '',
        cuenta_dep_acum_code: fa.cuentaDepAcumCode || '',
        cuenta_gasto_dep_code: fa.cuentaGastoDepCode || '',
        estatus: fa.estatus || 'ACTIVO',
        created_at: fa.createdAt || new Date().toISOString()
      }));
      await assertUpsert('fixed_assets', faToUpsert, { onConflict: 'id' });
    }

    if (Array.isArray(bundle.periodLocks) && bundle.periodLocks.length > 0) {
      const locksToUpsert = bundle.periodLocks.map((pl) => ({
        company_id: comp.id,
        ejercicio: pl.ejercicio,
        periodo: pl.periodo,
        is_locked: pl.isLocked,
        locked_at: pl.lockedAt || null,
        notes: pl.notes || ''
      }));
      await assertUpsert('period_locks', locksToUpsert, { onConflict: 'company_id, ejercicio, periodo' });
    }

    if (Array.isArray(bundle.thirdParties) && bundle.thirdParties.length > 0) {
      const tpToUpsert = bundle.thirdParties.map((tp) => ({
        id: tp.id,
        company_id: comp.id,
        rfc: tp.rfc,
        nombre: tp.nombre,
        rol: tp.rol || 'PROVEEDOR',
        cuenta_operacion_code: tp.cuentaOperacionCode,
        cuenta_contrapartida_code: tp.cuentaContrapartidaCode,
        tipo_tercero_diot: tp.tipoTerceroDiot || '04',
        tipo_operacion_diot: tp.tipoOperacionDiot || '85',
        tasa_iva_default: Number(tp.tasaIvaDefault || 16),
        estatus_69b: tp.estatus69B || 'NINGUNO'
      }));
      await assertUpsert('third_parties', tpToUpsert, { onConflict: 'id' });
    }

    if (Array.isArray(bundle.bankStatementLines) && bundle.bankStatementLines.length > 0) {
      const bLinesToUpsert = bundle.bankStatementLines.map((b) => ({
        id: b.id,
        company_id: comp.id,
        account_id: b.accountId,
        fecha: b.fecha,
        ejercicio: b.ejercicio,
        periodo: b.periodo,
        referencia: b.referencia || '',
        descripcion: b.descripcion || '',
        cargo_banco: Number(b.cargoBanco || 0),
        abono_banco: Number(b.abonoBanco || 0),
        matched_movement_id: b.matchedMovementId || null
      }));
      await assertUpsert('bank_statement_lines', bLinesToUpsert, { onConflict: 'id' });
    }

    const companies = await supabaseCompaniesAndAccounts.getCompanies();
    const restored = companies.find((c) => c.id === comp.id);
    if (!restored) throw new Error('No se pudo encontrar la empresa restaurada.');
    return restored;
  }
};
