import type { SupabaseClient } from '@supabase/supabase-js';
import { getCurrentFiscalPeriod } from '../../shared/date-utils';
import type { CompanyBackupBundle } from '../../shared/types';
import { chunkArray } from './supabase-pagination';

type UpsertRow = Record<string, unknown>;

async function assertTableUpsert(
  client: SupabaseClient,
  table: string,
  data: UpsertRow | UpsertRow[],
  opts?: { onConflict?: string }
): Promise<void> {
  const { error } = await client.from(table).upsert(data, opts);
  if (error) throw new Error(`[Restore ${table}] Error: ${error.message}`);
}

export async function clearCompanyChildTables(
  client: SupabaseClient,
  companyId: string
): Promise<void> {
  const tables = [
    'bank_statement_lines',
    'cfdi_documents',
    'polizas',
    'fixed_assets',
    'third_parties',
    'period_locks',
    'tax_parameters'
  ];
  for (const table of tables) {
    const { error } = await client.from(table).delete().eq('company_id', companyId);
    if (error) throw new Error(`[Clear ${table}] ${error.message}`);
  }
}

export async function restoreBackupChildTables(
  client: SupabaseClient,
  companyId: string,
  bundle: CompanyBackupBundle,
  batchImportAccounts: (
    cid: string,
    accounts: CompanyBackupBundle['accounts']
  ) => Promise<{ importedCount: number; updatedCount: number }>
): Promise<void> {
  if (Array.isArray(bundle.accounts) && bundle.accounts.length > 0) {
    await batchImportAccounts(companyId, bundle.accounts);
  }

  if (Array.isArray(bundle.taxParameters)) {
    for (const tp of bundle.taxParameters) {
      if (!tp) continue;
      await assertTableUpsert(
        client,
        'tax_parameters',
        {
          company_id: companyId,
          ejercicio: tp.ejercicio || bundle.company.currentYear || getCurrentFiscalPeriod().year,
          coeficiente_utilidad: tp.coeficienteUtilidad,
          perdidas_fiscales_pendientes: tp.perdidasFiscalesPendientes,
          pagos_provisionales_anteriores: tp.pagosProvisionalesAnteriores,
          saldo_favor_iva_anterior: tp.saldoFavorIvaAnterior,
          tipo_cambio_dof_cierre: tp.tipoCambioDofCierre
        },
        { onConflict: 'company_id,ejercicio' }
      );
    }
  }

  if (Array.isArray(bundle.polizas) && bundle.polizas.length > 0) {
    const polsToUpsert = bundle.polizas.map((p) => ({
      id: p.id,
      company_id: companyId,
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
      await assertTableUpsert(client, 'polizas', chunk, { onConflict: 'id' });
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
      await assertTableUpsert(client, 'poliza_movements', chunk, { onConflict: 'id' });
    }
  }

  if (Array.isArray(bundle.cfdis) && bundle.cfdis.length > 0) {
    const cfdisToUpsert = bundle.cfdis.map((c) => ({
      id: c.id,
      company_id: companyId,
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
      await assertTableUpsert(client, 'cfdi_documents', chunk, { onConflict: 'id' });
    }
  }

  if (Array.isArray(bundle.fixedAssets) && bundle.fixedAssets.length > 0) {
    const faToUpsert = bundle.fixedAssets.map((fa) => ({
      id: fa.id,
      company_id: companyId,
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
    await assertTableUpsert(client, 'fixed_assets', faToUpsert, { onConflict: 'id' });
  }

  if (Array.isArray(bundle.periodLocks) && bundle.periodLocks.length > 0) {
    const locksToUpsert = bundle.periodLocks.map((pl) => ({
      company_id: companyId,
      ejercicio: pl.ejercicio,
      periodo: pl.periodo,
      is_locked: pl.isLocked,
      locked_at: pl.lockedAt || null,
      notes: pl.notes || ''
    }));
    await assertTableUpsert(client, 'period_locks', locksToUpsert, {
      onConflict: 'company_id, ejercicio, periodo'
    });
  }

  if (Array.isArray(bundle.thirdParties) && bundle.thirdParties.length > 0) {
    const tpToUpsert = bundle.thirdParties.map((tp) => ({
      id: tp.id,
      company_id: companyId,
      rfc: tp.rfc,
      nombre: tp.nombre,
      rol: tp.rol || 'PROVEEDOR',
      cuenta_operacion_code: tp.cuentaOperacionCode,
      cuenta_contrapartida_code: tp.cuentaContrapartidaCode,
      tipo_tercero_diot: tp.tipoTerceroDiot || '04',
      tipo_operacion_diot: tp.tipoOperacionDiot || '85',
      tasa_iva_default: Number(tp.tasaIvaDefault || 16),
      estatus_69b: tp.estatus69B || 'LIMPIO'
    }));
    await assertTableUpsert(client, 'third_parties', tpToUpsert, { onConflict: 'id' });
  }

  if (Array.isArray(bundle.bankStatementLines) && bundle.bankStatementLines.length > 0) {
    const bLinesToUpsert = bundle.bankStatementLines.map((b) => ({
      id: b.id,
      company_id: companyId,
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
    await assertTableUpsert(client, 'bank_statement_lines', bLinesToUpsert, { onConflict: 'id' });
  }
}
