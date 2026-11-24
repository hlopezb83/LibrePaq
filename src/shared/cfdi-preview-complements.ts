import { findNode, findNodes, getAttr, round2, type XmlNode } from './cfdi-xml-nodes';

export interface CfdiPreviewDrTaxItem {
  tipo: 'Traslado' | 'Retencion';
  impuesto: string;
  base: number;
  tipoFactor: string;
  tasaOCuota: string;
  importe: number;
}

export interface CfdiPreviewDoctoRelacionado {
  idDocumento: string;
  serie: string;
  folio: string;
  monedaDr: string;
  equivalenciaDr: string;
  numParcialidad: string;
  impSaldoAnt: number;
  impPagado: number;
  impSaldoInsoluto: number;
  objetoImpDr?: string;
  impuestosDr?: CfdiPreviewDrTaxItem[];
}

export interface CfdiPreviewPagoItem {
  fechaPago: string;
  formaDePagoP: string;
  monedaP: string;
  tipoCambioP: string;
  monto: number;
  numOperacion: string;
  doctosRelacionados: CfdiPreviewDoctoRelacionado[];
}

export interface CfdiPreviewNominaPercepcion {
  tipoPercepcion: string;
  clave: string;
  concepto: string;
  importeGravado: number;
  importeExento: number;
}

export interface CfdiPreviewNominaDeduccion {
  tipoDeduccion: string;
  clave: string;
  concepto: string;
  importe: number;
}

export interface CfdiPreviewNominaOtroPago {
  tipoOtroPago: string;
  clave: string;
  concepto: string;
  importe: number;
  subsidioCausado?: number;
}

export interface CfdiPreviewNomina {
  version: string;
  tipoNomina: string;
  fechaPago: string;
  fechaInicialPago: string;
  fechaFinalPago: string;
  numDiasPagados: number;
  totalPercepciones: number;
  totalDeducciones: number;
  totalOtrosPagos: number;
  numEmpleado: string;
  curp: string;
  numSeguridadSocial: string;
  puesto: string;
  departamento: string;
  salarioDiarioIntegrado: number;
  percepciones?: CfdiPreviewNominaPercepcion[];
  deducciones?: CfdiPreviewNominaDeduccion[];
  otrosPagos?: CfdiPreviewNominaOtroPago[];
}

export interface CfdiPreviewLocalTaxItem {
  tipo: 'Traslado' | 'Retencion';
  impuesto: string;
  tasa: string;
  importe: number;
}

function parseNum(raw: string, fallback: number): number {
  if (!raw) return fallback;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function extractPagosComplemento(comprobante: XmlNode): CfdiPreviewPagoItem[] | undefined {
  const pagoNodes = findNodes(comprobante, 'Pago');
  if (pagoNodes.length === 0) return undefined;
  return pagoNodes.map((p) => {
    const doctos = findNodes(p, 'DoctoRelacionado').map((d) => {
      const trasladosDr = findNodes(d, 'TrasladoDR').map(
        (t): CfdiPreviewDrTaxItem => ({
          tipo: 'Traslado',
          impuesto: getAttr(t, 'ImpuestoDR') || '002',
          base: round2(parseNum(getAttr(t, 'BaseDR'), 0)),
          tipoFactor: getAttr(t, 'TipoFactorDR') || 'Tasa',
          tasaOCuota: getAttr(t, 'TasaOCuotaDR'),
          importe: round2(parseNum(getAttr(t, 'ImporteDR'), 0))
        })
      );
      const retencionesDr = findNodes(d, 'RetencionDR').map(
        (r): CfdiPreviewDrTaxItem => ({
          tipo: 'Retencion',
          impuesto: getAttr(r, 'ImpuestoDR') || '001',
          base: round2(parseNum(getAttr(r, 'BaseDR'), 0)),
          tipoFactor: getAttr(r, 'TipoFactorDR') || 'Tasa',
          tasaOCuota: getAttr(r, 'TasaOCuotaDR'),
          importe: round2(parseNum(getAttr(r, 'ImporteDR'), 0))
        })
      );
      const impuestosDr = [...trasladosDr, ...retencionesDr];
      const objetoImpDr = getAttr(d, 'ObjetoImpDR') || undefined;
      return {
        idDocumento: getAttr(d, 'IdDocumento').toUpperCase(),
        serie: getAttr(d, 'Serie'),
        folio: getAttr(d, 'Folio'),
        monedaDr: getAttr(d, 'MonedaDR') || 'MXN',
        equivalenciaDr: getAttr(d, 'EquivalenciaDR') || getAttr(d, 'TipoCambioDR') || '1',
        numParcialidad: getAttr(d, 'NumParcialidad') || '1',
        impSaldoAnt: round2(parseNum(getAttr(d, 'ImpSaldoAnt'), 0)),
        impPagado: round2(parseNum(getAttr(d, 'ImpPagado'), 0)),
        impSaldoInsoluto: round2(parseNum(getAttr(d, 'ImpSaldoInsoluto'), 0)),
        ...(objetoImpDr ? { objetoImpDr } : {}),
        ...(impuestosDr.length > 0 ? { impuestosDr } : {})
      };
    });
    return {
      fechaPago: getAttr(p, 'FechaPago'),
      formaDePagoP: getAttr(p, 'FormaDePagoP'),
      monedaP: getAttr(p, 'MonedaP') || 'MXN',
      tipoCambioP: getAttr(p, 'TipoCambioP') || '1',
      monto: round2(parseNum(getAttr(p, 'Monto'), 0)),
      numOperacion: getAttr(p, 'NumOperacion'),
      doctosRelacionados: doctos
    };
  });
}

export function extractNominaComplemento(comprobante: XmlNode): CfdiPreviewNomina | undefined {
  const nomina = findNode(comprobante, 'Nomina');
  if (!nomina) return undefined;
  const nomReceptor = findNode(nomina, 'Receptor');

  const percepciones = findNodes(nomina, 'Percepcion').map((p) => ({
    tipoPercepcion: getAttr(p, 'TipoPercepcion'),
    clave: getAttr(p, 'Clave'),
    concepto: getAttr(p, 'Concepto'),
    importeGravado: round2(parseNum(getAttr(p, 'ImporteGravado'), 0)),
    importeExento: round2(parseNum(getAttr(p, 'ImporteExento'), 0))
  }));
  const deducciones = findNodes(nomina, 'Deduccion').map((d) => ({
    tipoDeduccion: getAttr(d, 'TipoDeduccion'),
    clave: getAttr(d, 'Clave'),
    concepto: getAttr(d, 'Concepto'),
    importe: round2(parseNum(getAttr(d, 'Importe'), 0))
  }));
  const otrosPagos = findNodes(nomina, 'OtroPago').map((o) => {
    const subNode = findNode(o, 'SubsidioAlEmpleo');
    const subCausado = subNode ? round2(parseNum(getAttr(subNode, 'SubsidioCausado'), 0)) : undefined;
    return {
      tipoOtroPago: getAttr(o, 'TipoOtroPago'),
      clave: getAttr(o, 'Clave'),
      concepto: getAttr(o, 'Concepto'),
      importe: round2(parseNum(getAttr(o, 'Importe'), 0)),
      ...(subCausado !== undefined && subCausado > 0 ? { subsidioCausado: subCausado } : {})
    };
  });

  return {
    version: getAttr(nomina, 'Version') || '1.2',
    tipoNomina: getAttr(nomina, 'TipoNomina') || 'O',
    fechaPago: getAttr(nomina, 'FechaPago'),
    fechaInicialPago: getAttr(nomina, 'FechaInicialPago'),
    fechaFinalPago: getAttr(nomina, 'FechaFinalPago'),
    numDiasPagados: parseNum(getAttr(nomina, 'NumDiasPagados'), 0),
    totalPercepciones: round2(parseNum(getAttr(nomina, 'TotalPercepciones'), 0)),
    totalDeducciones: round2(parseNum(getAttr(nomina, 'TotalDeducciones'), 0)),
    totalOtrosPagos: round2(parseNum(getAttr(nomina, 'TotalOtrosPagos'), 0)),
    numEmpleado: getAttr(nomReceptor, 'NumEmpleado'),
    curp: getAttr(nomReceptor, 'Curp'),
    numSeguridadSocial: getAttr(nomReceptor, 'NumSeguridadSocial'),
    puesto: getAttr(nomReceptor, 'Puesto'),
    departamento: getAttr(nomReceptor, 'Departamento'),
    salarioDiarioIntegrado: round2(parseNum(getAttr(nomReceptor, 'SalarioDiarioIntegrado'), 0)),
    ...(percepciones.length > 0 ? { percepciones } : {}),
    ...(deducciones.length > 0 ? { deducciones } : {}),
    ...(otrosPagos.length > 0 ? { otrosPagos } : {})
  };
}

export function extractImpuestosLocales(comprobante: XmlNode): CfdiPreviewLocalTaxItem[] {
  const tras = findNodes(comprobante, 'TrasladosLocales').map(
    (n): CfdiPreviewLocalTaxItem => ({
      tipo: 'Traslado',
      impuesto: getAttr(n, 'ImpLocTrasladado') || 'Impuesto Local',
      tasa: getAttr(n, 'TasadeTraslado'),
      importe: round2(parseNum(getAttr(n, 'Importe'), 0))
    })
  );
  const ret = findNodes(comprobante, 'RetencionesLocales').map(
    (n): CfdiPreviewLocalTaxItem => ({
      tipo: 'Retencion',
      impuesto: getAttr(n, 'ImpLocRetenido') || 'Retención Local',
      tasa: getAttr(n, 'TasadeRetencion'),
      importe: round2(parseNum(getAttr(n, 'Importe'), 0))
    })
  );
  return [...tras, ...ret];
}
