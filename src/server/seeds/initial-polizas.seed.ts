import type { Database } from 'bun:sqlite';

export function seedInitialPolizasOnDb(db: Database, c1Id: string, now: string): void {
  const insertPoliza = db.prepare(`
    INSERT INTO polizas (id, company_id, tipo, folio, fecha, ejercicio, periodo, concepto, cfdi_uuid, origin, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMov = db.prepare(`
    INSERT INTO poliza_movements (id, poliza_id, account_id, account_code, account_name, referencia, concepto, cargo, abono, cfdi_uuid)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertPoliza.run(
    'pol_01',
    c1Id,
    'INGRESO',
    1,
    '2026-10-03',
    2026,
    10,
    'Cobro Factura FAC-1041 Licenciamiento Software Contable - Corporativo Alfa',
    '8A4F92E1-10B4-4C7A-9E12-718293A4B5C1',
    'ADD_AUTO',
    now
  );
  insertMov.run(
    'mov_01_1',
    'pol_01',
    `${c1Id}_102-01-001`,
    '102-01-001',
    'BBVA Empresarial MXN Cta 01948271',
    'FAC-1041',
    'Depósito SPEI Corporativo Alfa',
    371200,
    0,
    '8A4F92E1-10B4-4C7A-9E12-718293A4B5C1'
  );
  insertMov.run(
    'mov_01_2',
    'pol_01',
    `${c1Id}_401-01-001`,
    '401-01-001',
    'Ventas y Servicios de Software / SaaS Tasa 16%',
    'FAC-1041',
    'Licenciamiento Anual Software Contable LibrePaq',
    0,
    320000,
    '8A4F92E1-10B4-4C7A-9E12-718293A4B5C1'
  );
  insertMov.run(
    'mov_01_3',
    'pol_01',
    `${c1Id}_208-01-001`,
    '208-01-001',
    'IVA Trasladado Cobrado 16%',
    'FAC-1041',
    'IVA 16% Cobrado FAC-1041',
    0,
    51200,
    '8A4F92E1-10B4-4C7A-9E12-718293A4B5C1'
  );

  insertPoliza.run(
    'pol_02',
    c1Id,
    'EGRESO',
    1,
    '2026-10-07',
    2026,
    10,
    'Pago Infraestructura Cloud AWS México Octubre 2026 (AWS-99201)',
    '3C91D8A4-55E2-4F19-8B20-901234F5E6D2',
    'ADD_AUTO',
    now
  );
  insertMov.run(
    'mov_02_1',
    'pol_02',
    `${c1Id}_501-01-001`,
    '501-01-001',
    'Costo de Infraestructura Cloud y Servidores',
    'AWS-99201',
    'Servicios EC2, RDS y S3 Octubre 2026',
    68000,
    0,
    '3C91D8A4-55E2-4F19-8B20-901234F5E6D2'
  );
  insertMov.run(
    'mov_02_2',
    'pol_02',
    `${c1Id}_118-01-001`,
    '118-01-001',
    'IVA Acreditable Pagado 16%',
    'AWS-99201',
    'IVA Acreditable 16% AWS-99201',
    10880,
    0,
    '3C91D8A4-55E2-4F19-8B20-901234F5E6D2'
  );
  insertMov.run(
    'mov_02_3',
    'pol_02',
    `${c1Id}_102-01-001`,
    '102-01-001',
    'BBVA Empresarial MXN Cta 01948271',
    'AWS-99201',
    'Transferencia pago AWS México',
    0,
    78880,
    '3C91D8A4-55E2-4F19-8B20-901234F5E6D2'
  );

  insertPoliza.run(
    'pol_03',
    c1Id,
    'EGRESO',
    2,
    '2026-10-10',
    2026,
    10,
    'Pago Arrendamiento Oficinas Reforma Piso 14 - Octubre 2026',
    '7E12B4C8-88A1-4D22-B104-445566A7B8C3',
    'ADD_AUTO',
    now
  );
  insertMov.run(
    'mov_03_1',
    'pol_03',
    `${c1Id}_601-01-002`,
    '601-01-002',
    'Arrendamiento de Oficinas Corporativas',
    'ARR-508',
    'Renta Octubre 2026 Inmobiliaria Reforma',
    45000,
    0,
    '7E12B4C8-88A1-4D22-B104-445566A7B8C3'
  );
  insertMov.run(
    'mov_03_2',
    'pol_03',
    `${c1Id}_118-01-001`,
    '118-01-001',
    'IVA Acreditable Pagado 16%',
    'ARR-508',
    'IVA Acreditable 16% ARR-508',
    7200,
    0,
    '7E12B4C8-88A1-4D22-B104-445566A7B8C3'
  );
  insertMov.run(
    'mov_03_3',
    'pol_03',
    `${c1Id}_102-01-001`,
    '102-01-001',
    'BBVA Empresarial MXN Cta 01948271',
    'ARR-508',
    'Transferencia SPEI Inmobiliaria Reforma',
    0,
    52200,
    '7E12B4C8-88A1-4D22-B104-445566A7B8C3'
  );

  insertPoliza.run(
    'pol_04',
    c1Id,
    'EGRESO',
    3,
    '2026-10-15',
    2026,
    10,
    'Pago de Nómina 1ra Quincena Octubre 2026 y Retención ISR',
    null,
    'MANUAL',
    now
  );
  insertMov.run(
    'mov_04_1',
    'pol_04',
    `${c1Id}_601-01-001`,
    '601-01-001',
    'Sueldos y Salarios Administrativos',
    'NOM-1Q-OCT',
    'Sueldos brutos 1Q Octubre 2026',
    95000,
    0,
    null
  );
  insertMov.run(
    'mov_04_2',
    'pol_04',
    `${c1Id}_216-01-001`,
    '216-01-001',
    'Retenciones de ISR por Pagar (Salarios, Honorarios, Arrend.)',
    'NOM-1Q-OCT',
    'ISR Retenido por salarios 1Q Oct',
    0,
    12400,
    null
  );
  insertMov.run(
    'mov_04_3',
    'pol_04',
    `${c1Id}_102-01-002`,
    '102-01-002',
    'Banorte PyME MXN Cta 08831920',
    'NOM-1Q-OCT',
    'Dispersión nómina Banorte',
    0,
    82600,
    null
  );
}
