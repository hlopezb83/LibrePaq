import {
  createHash,
  createPrivateKey,
  createPublicKey,
  createSign,
  X509Certificate
} from 'node:crypto';
import { Buffer } from 'node:buffer';

// deno-lint-ignore no-explicit-any
let forge: any = null;
try {
  // @ts-ignore
  forge = await import('node-forge').then((m) => m.default || m);
} catch {
  try {
    // @ts-ignore
    forge = await import('npm:node-forge@1.3.1').then((m) => m.default || m);
  } catch {
    // fallback
  }
}

export function computeSha1Base64(content: string): string {
  return createHash('sha1').update(content, 'utf8').digest('base64');
}

export function signRsaSha1Base64(content: string, privateKeyPem: string): string {
  const signer = createSign('RSA-SHA1');
  signer.update(content, 'utf8');
  return signer.sign(privateKeyPem, 'base64');
}

export function escapeXmlAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function decodeSatSerialNumber(serial: string): string {
  if (serial.length === 40 && /^3[0-9]/.test(serial)) {
    try {
      const decoded = Buffer.from(serial, 'hex').toString('ascii');
      if (/^\d{20}$/.test(decoded)) return decoded;
    } catch {
      // fallback
    }
  }
  return serial;
}

export function extractRfcAndNameFromSubject(subject: string, fallbackRfc: string, fallbackName: string): {
  rfc: string;
  name: string;
} {
  let rfc = fallbackRfc.toUpperCase();
  let name = fallbackName;

  const cnMatch = subject.match(/CN=([^,\n/]+)/i);
  if (cnMatch && cnMatch[1]) name = cnMatch[1].trim();
  const oMatch = subject.match(/O=([^,\n/]+)/i);
  if (oMatch && oMatch[1] && (!name || name === fallbackName)) name = oMatch[1].trim();

  // SAT X.509 puts RFC in x500UniqueIdentifier
  const x500Match = subject.match(/x500UniqueIdentifier=([A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3})/i);
  if (x500Match && x500Match[1]) {
    rfc = x500Match[1].toUpperCase();
  } else {
    const generalRfcMatch = subject.match(/([A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3})/i);
    if (generalRfcMatch && generalRfcMatch[1]) {
      rfc = generalRfcMatch[1].toUpperCase();
    }
  }

  return { rfc, name };
}

export interface ValidatedFielData {
  rfcTitular: string;
  nombreTitular: string;
  numeroSerie: string;
  validFrom: string;
  validTo: string;
  isExpired: boolean;
  sha1Fingerprint: string;
  privateKeyPem: string;
  certificateBase64: string;
}

export function parseAndDecryptFiel(params: {
  cerBase64: string;
  keyBase64: string;
  passphrase: string;
  fallbackRfc?: string;
  fallbackName?: string;
}): ValidatedFielData {
  const { cerBase64, keyBase64, passphrase } = params;
  if (!cerBase64?.trim()) throw new Error('Certificado (.cer) no proporcionado.');
  if (!keyBase64?.trim()) throw new Error('Llave privada (.key) no proporcionada.');
  if (!passphrase || passphrase.trim().length === 0) {
    throw new Error('Debes ingresar la contraseña de la e.firma.');
  }

  const keyBuffer = Buffer.from(keyBase64.replace(/\s+/g, ''), 'base64');
  const cerBuffer = Buffer.from(cerBase64.replace(/\s+/g, ''), 'base64');

  // 1. Desencriptar clave privada PKCS#8 (Forge soporta PBES2/PBKDF2/3DES-CBC nativamente)
  let privateKeyObj;
  let decryptedPem: string | null = null;

  try {
    const cleanB64 = keyBase64.replace(/\s+/g, '');
    const derBytes = forge.util.decode64(cleanB64);
    const asn1 = forge.asn1.fromDer(derBytes);
    const privateKeyInfo = forge.pki.decryptPrivateKeyInfo(asn1, passphrase);
    if (privateKeyInfo) {
      const rsaKey = forge.pki.privateKeyFromAsn1(privateKeyInfo);
      decryptedPem = forge.pki.privateKeyToPem(rsaKey);
    }
  } catch (forgeErr) {
    // Si forge falla, intentamos con node:crypto
  }

  if (decryptedPem) {
    privateKeyObj = createPrivateKey(decryptedPem);
  } else {
    try {
      privateKeyObj = createPrivateKey({
        key: keyBuffer,
        format: 'der',
        type: 'pkcs8',
        passphrase
      });
    } catch {
      throw new Error(
        'Contraseña incorrecta: no se pudo desencriptar la llave privada (.key) del SAT. Verifica mayúsculas y caracteres especiales.'
      );
    }
  }

  const privateKeyPem = privateKeyObj.export({ type: 'pkcs8', format: 'pem' }).toString();

  // 2. Analizar certificado X.509 o envoltorio de prueba
  let rfcTitular = params.fallbackRfc?.toUpperCase() || 'XAXX010101000';
  let nombreTitular = params.fallbackName || 'Contribuyente';
  let numeroSerie = '30001000000500003416';
  let validFrom = new Date().toISOString();
  let validTo = new Date(Date.now() + 365 * 86400_000).toISOString();
  let sha1Fingerprint = computeSha1Base64(cerBase64);
  let cerPublicPem = '';

  try {
    const asJson = JSON.parse(cerBuffer.toString('utf8'));
    if (asJson && asJson.kind === 'LIBRE_CONTPAQ_SAT_FIEL_CER_V1' && asJson.publicKeyDerBase64) {
      rfcTitular = asJson.rfc || rfcTitular;
      nombreTitular = asJson.nombre || nombreTitular;
      numeroSerie = asJson.serialNumber || numeroSerie;
      validFrom = asJson.validFrom || validFrom;
      validTo = asJson.validTo || validTo;
      cerPublicPem = createPublicKey({
        key: Buffer.from(asJson.publicKeyDerBase64, 'base64'),
        format: 'der',
        type: 'spki'
      }).export({ type: 'spki', format: 'pem' }).toString();
    }
  } catch {
    // No es JSON de prueba
  }

  if (!cerPublicPem) {
    try {
      const x509 = new X509Certificate(cerBuffer);
      const extracted = extractRfcAndNameFromSubject(x509.subject, rfcTitular, nombreTitular);
      rfcTitular = extracted.rfc;
      nombreTitular = extracted.name;
      numeroSerie = decodeSatSerialNumber(x509.serialNumber || '00001000000000000000');
      validFrom = new Date(x509.validFrom).toISOString();
      validTo = new Date(x509.validTo).toISOString();
      sha1Fingerprint = x509.fingerprint ? x509.fingerprint.replace(/:/g, '').toUpperCase() : sha1Fingerprint;
      cerPublicPem = x509.publicKey.export({ type: 'spki', format: 'pem' }).toString();
    } catch {
      throw new Error('El archivo .cer no es un certificado X.509 DER válido del SAT.');
    }
  }

  const isExpired = new Date(validTo).getTime() < Date.now();

  // 3. Validar correspondencia matemática entre pública y privada
  const derivedPublicPem = createPublicKey(privateKeyObj).export({ type: 'spki', format: 'pem' }).toString();

  if (derivedPublicPem !== cerPublicPem) {
    throw new Error('La llave privada (.key) no corresponde al certificado (.cer) cargado.');
  }

  return {
    rfcTitular,
    nombreTitular,
    numeroSerie,
    validFrom,
    validTo,
    isExpired,
    sha1Fingerprint,
    privateKeyPem,
    certificateBase64: cerBase64.replace(/\s+/g, '')
  };
}

/**
 * Genera sobre SOAP 1.1 para Autentica del SAT con WS-Security firmado
 */
export function buildSatAutenticaSoapXml(params: {
  certificateBase64: string;
  privateKeyPem: string;
  createdIso?: string;
  expiresIso?: string;
}): { soapXml: string } {
  const now = params.createdIso ? new Date(params.createdIso) : new Date();
  const exp = params.expiresIso ? new Date(params.expiresIso) : new Date(now.getTime() + 5 * 60 * 1000);
  const created = now.toISOString();
  const expires = exp.toISOString();
  const uuidToken = `uuid-${crypto.randomUUID()}-1`;

  const timestampCanonical = `<u:Timestamp xmlns:u="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd" u:Id="_0"><u:Created>${created}</u:Created><u:Expires>${expires}</u:Expires></u:Timestamp>`;
  const digestValue = computeSha1Base64(timestampCanonical);

  const signedInfoCanonical = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"></CanonicalizationMethod><SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"></SignatureMethod><Reference URI="#_0"><Transforms><Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"></Transform></Transforms><DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></DigestMethod><DigestValue>${digestValue}</DigestValue></Reference></SignedInfo>`;
  const signatureValue = signRsaSha1Base64(signedInfoCanonical, params.privateKeyPem);

  const soapXml = `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" xmlns:u="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
  <s:Header>
    <o:Security s:mustUnderstand="1" xmlns:o="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
      ${timestampCanonical}
      <o:BinarySecurityToken u:Id="${uuidToken}" ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3" EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">${params.certificateBase64}</o:BinarySecurityToken>
      <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
        ${signedInfoCanonical}
        <SignatureValue>${signatureValue}</SignatureValue>
        <KeyInfo>
          <o:SecurityTokenReference>
            <o:Reference ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3" URI="#${uuidToken}"/>
          </o:SecurityTokenReference>
        </KeyInfo>
      </Signature>
    </o:Security>
  </s:Header>
  <s:Body>
    <Autentica xmlns="http://DescargaMasivaTerceros.gob.mx"/>
  </s:Body>
</s:Envelope>`;

  return { soapXml };
}

/**
 * Genera sobre SOAP para SolicitaDescarga (Emitidos o Recibidos) firmado con XML-DSig
 */
export function buildSatSolicitaDescargaSoapXml(params: {
  rfcSolicitante: string;
  tipoSolicitud: 'EMITIDOS' | 'RECIBIDOS';
  fechaInicial: string;
  fechaFinal: string;
  certificateBase64: string;
  privateKeyPem: string;
}): { soapXml: string } {
  const rfc = escapeXmlAttr(params.rfcSolicitante.toUpperCase());
  const operationTag = params.tipoSolicitud === 'EMITIDOS' ? 'SolicitaDescargaEmitidos' : 'SolicitaDescargaRecibidos';
  const rfcFilterAttr = params.tipoSolicitud === 'EMITIDOS' ? `RfcEmisor="${rfc}"` : `RfcReceptor="${rfc}"`;

  const solicitudCanonical = `<des:${operationTag} xmlns:des="http://DescargaMasivaTerceros.sat.gob.mx"><des:solicitud EstadoComprobante="Vigente" FechaFinal="${escapeXmlAttr(params.fechaFinal)}T23:59:59" FechaInicial="${escapeXmlAttr(params.fechaInicial)}T00:00:00" ${rfcFilterAttr} RfcSolicitante="${rfc}" TipoSolicitud="CFDI"></des:solicitud></des:${operationTag}>`;
  const digestValue = computeSha1Base64(solicitudCanonical);

  const signedInfoCanonical = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"></CanonicalizationMethod><SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"></SignatureMethod><Reference URI=""><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></Transform></Transforms><DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></DigestMethod><DigestValue>${digestValue}</DigestValue></Reference></SignedInfo>`;
  const signatureValue = signRsaSha1Base64(signedInfoCanonical, params.privateKeyPem);

  const soapXml = `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" xmlns:des="http://DescargaMasivaTerceros.sat.gob.mx" xmlns:xd="http://www.w3.org/2000/09/xmldsig#">
  <s:Header/>
  <s:Body>
    <des:${operationTag}>
      <des:solicitud EstadoComprobante="Vigente" FechaFinal="${escapeXmlAttr(params.fechaFinal)}T23:59:59" FechaInicial="${escapeXmlAttr(params.fechaInicial)}T00:00:00" ${rfcFilterAttr} RfcSolicitante="${rfc}" TipoSolicitud="CFDI">
        <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
          ${signedInfoCanonical}
          <SignatureValue>${signatureValue}</SignatureValue>
          <KeyInfo>
            <X509Data>
              <X509Certificate>${params.certificateBase64}</X509Certificate>
            </X509Data>
          </KeyInfo>
        </Signature>
      </des:solicitud>
    </des:${operationTag}>
  </s:Body>
</s:Envelope>`;

  return { soapXml };
}

/**
 * Genera sobre SOAP para VerificaSolicitudDescarga
 */
export function buildSatVerificaDescargaSoapXml(params: {
  rfcSolicitante: string;
  idSolicitudSat: string;
  certificateBase64: string;
  privateKeyPem: string;
}): { soapXml: string } {
  const rfc = escapeXmlAttr(params.rfcSolicitante.toUpperCase());
  const idSol = escapeXmlAttr(params.idSolicitudSat);

  const solicitudCanonical = `<des:VerificaSolicitudDescarga xmlns:des="http://DescargaMasivaTerceros.sat.gob.mx"><des:solicitud IdSolicitud="${idSol}" RfcSolicitante="${rfc}"></des:solicitud></des:VerificaSolicitudDescarga>`;
  const digestValue = computeSha1Base64(solicitudCanonical);

  const signedInfoCanonical = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"></CanonicalizationMethod><SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"></SignatureMethod><Reference URI=""><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></Transform></Transforms><DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></DigestMethod><DigestValue>${digestValue}</DigestValue></Reference></SignedInfo>`;
  const signatureValue = signRsaSha1Base64(signedInfoCanonical, params.privateKeyPem);

  const soapXml = `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" xmlns:des="http://DescargaMasivaTerceros.sat.gob.mx">
  <s:Header/>
  <s:Body>
    <des:VerificaSolicitudDescarga>
      <des:solicitud IdSolicitud="${idSol}" RfcSolicitante="${rfc}">
        <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
          ${signedInfoCanonical}
          <SignatureValue>${signatureValue}</SignatureValue>
          <KeyInfo>
            <X509Data>
              <X509Certificate>${params.certificateBase64}</X509Certificate>
            </X509Data>
          </KeyInfo>
        </Signature>
      </des:solicitud>
    </des:VerificaSolicitudDescarga>
  </s:Body>
</s:Envelope>`;

  return { soapXml };
}

/**
 * Genera sobre SOAP para DescargaMasiva
 */
export function buildSatDescargaPaqueteSoapXml(params: {
  rfcSolicitante: string;
  idPaqueteSat: string;
  certificateBase64: string;
  privateKeyPem: string;
}): { soapXml: string } {
  const rfc = escapeXmlAttr(params.rfcSolicitante.toUpperCase());
  const idPaq = escapeXmlAttr(params.idPaqueteSat);

  const peticionCanonical = `<des:PeticionDescargaMasivaTercerosEntrada xmlns:des="http://DescargaMasivaTerceros.sat.gob.mx"><des:peticionDescarga IdPaquete="${idPaq}" RfcSolicitante="${rfc}"></des:peticionDescarga></des:PeticionDescargaMasivaTercerosEntrada>`;
  const digestValue = computeSha1Base64(peticionCanonical);

  const signedInfoCanonical = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"></CanonicalizationMethod><SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"></SignatureMethod><Reference URI=""><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></Transform></Transforms><DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></DigestMethod><DigestValue>${digestValue}</DigestValue></Reference></SignedInfo>`;
  const signatureValue = signRsaSha1Base64(signedInfoCanonical, params.privateKeyPem);

  const soapXml = `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" xmlns:des="http://DescargaMasivaTerceros.sat.gob.mx">
  <s:Header/>
  <s:Body>
    <des:PeticionDescargaMasivaTercerosEntrada>
      <des:peticionDescarga IdPaquete="${idPaq}" RfcSolicitante="${rfc}">
        <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
          ${signedInfoCanonical}
          <SignatureValue>${signatureValue}</SignatureValue>
          <KeyInfo>
            <X509Data>
              <X509Certificate>${params.certificateBase64}</X509Certificate>
            </X509Data>
          </KeyInfo>
        </Signature>
      </des:peticionDescarga>
    </des:PeticionDescargaMasivaTercerosEntrada>
  </s:Body>
</s:Envelope>`;

  return { soapXml };
}

export interface ParsedCfdiQuick {
  uuid: string;
  fecha: string;
  tipoComprobante: string;
  serie: string;
  folio: string;
  emisorRfc: string;
  emisorNombre: string;
  receptorRfc: string;
  receptorNombre: string;
  conceptoPrincipal: string;
  claveProdServ: string;
  moneda: string;
  tipoCambio: number;
  subtotal: number;
  descuento: number;
  ivaTrasladado: number;
  isrRetenido: number;
  ivaRetenido: number;
  total: number;
  metodoPago: string;
  formaPago: string;
  usoCfdi: string;
}

export function parseCfdiQuick(xmlRaw: string): ParsedCfdiQuick | null {
  const getAttr = (tag: string, attr: string): string => {
    const m = tag.match(new RegExp(`\\b${attr}\\s*=\\s*["']([^"']*)["']`, 'i'));
    return m && m[1] ? m[1].trim() : '';
  };
  const getTagFrom = (source: string, name: string): string => {
    const m = source.match(new RegExp(`<(?:\\w+:)?${name}\\b([^>]*)>`, 'i'));
    return m && m[1] ? m[1] : '';
  };

  const tfd = getTagFrom(xmlRaw, 'TimbreFiscalDigital');
  const uuid = getAttr(tfd, 'UUID').toUpperCase();
  if (!uuid) return null;

  const comp = getTagFrom(xmlRaw, 'Comprobante');
  const emisor = getTagFrom(xmlRaw, 'Emisor');
  const receptor = getTagFrom(xmlRaw, 'Receptor');
  const concepto = getTagFrom(xmlRaw, 'Concepto');

  // CRIT: Remover <Conceptos> para aislar el nodo raíz <cfdi:Impuestos> y evitar
  // colisionar con los <cfdi:Impuestos> interiores de cada concepto en CFDI 4.0
  const xmlWithoutConceptos = xmlRaw.replace(/<(?:cfdi:)?Conceptos\b[\s\S]*?<\/(?:cfdi:)?Conceptos>/i, '');
  const imp = getTagFrom(xmlWithoutConceptos, 'Impuestos');

  const tipoComprobante = (getAttr(comp, 'TipoDeComprobante') || 'I').toUpperCase();

  let subtotal = parseFloat(getAttr(comp, 'SubTotal') || '0') || 0;
  let total = parseFloat(getAttr(comp, 'Total') || '0') || 0;
  const descuento = parseFloat(getAttr(comp, 'Descuento') || '0') || 0;
  let ivaTrasladado = parseFloat(getAttr(imp, 'TotalImpuestosTrasladados') || '0') || 0;
  let formaPago = getAttr(comp, 'FormaPago') || '03';
  let moneda = getAttr(comp, 'Moneda') || 'MXN';
  let tipoCambio = parseFloat(getAttr(comp, 'TipoCambio') || '1') || 1;
  let metodoPago = getAttr(comp, 'MetodoPago') || 'PUE';

  // Soporte de Complemento de Pagos 2.0 / 1.0 (Comprobante Tipo "P")
  if (tipoComprobante === 'P') {
    const pagoTag = getTagFrom(xmlRaw, 'Pago');
    if (pagoTag) {
      const monto = parseFloat(getAttr(pagoTag, 'Monto') || '0') || 0;
      if (monto > 0) {
        subtotal = monto;
        total = monto;
      }
      formaPago = getAttr(pagoTag, 'FormaDePagoP') || formaPago;
      moneda = getAttr(pagoTag, 'MonedaP') || moneda;
      tipoCambio = parseFloat(getAttr(pagoTag, 'TipoCambioP') || '1') || 1;
      metodoPago = 'PUE';
    }
  }

  // Si TotalImpuestosTrasladados no viene explícito pero existen traslados raíz
  if (ivaTrasladado === 0 && xmlWithoutConceptos.includes('Traslado')) {
    const matches = xmlWithoutConceptos.matchAll(/<(?:cfdi:)?Traslado\b[^>]*\bImporte=["']([\d.]+)["']/gi);
    for (const m of matches) ivaTrasladado += parseFloat(m[1] ?? '0') || 0;
  }

  return {
    uuid,
    fecha: getAttr(comp, 'Fecha') || new Date().toISOString(),
    tipoComprobante,
    serie: getAttr(comp, 'Serie'),
    folio: getAttr(comp, 'Folio'),
    emisorRfc: getAttr(emisor, 'Rfc').toUpperCase(),
    emisorNombre: getAttr(emisor, 'Nombre') || 'EMISOR SAT',
    receptorRfc: getAttr(receptor, 'Rfc').toUpperCase(),
    receptorNombre: getAttr(receptor, 'Nombre') || 'RECEPTOR SAT',
    conceptoPrincipal: getAttr(concepto, 'Descripcion') || 'Operación comercial',
    claveProdServ: getAttr(concepto, 'ClaveProdServ') || '01010101',
    moneda,
    tipoCambio,
    subtotal,
    descuento,
    ivaTrasladado,
    isrRetenido: (() => {
      let isr = 0;
      const matches = xmlWithoutConceptos.matchAll(/<(?:cfdi:)?Retencion\b[^>]*\bImpuesto=["']001["'][^>]*\bImporte=["']([\d.]+)["']/gi);
      for (const m of matches) isr += parseFloat(m[1] ?? '0') || 0;
      return isr;
    })(),
    ivaRetenido: (() => {
      let iva = 0;
      const matches = xmlWithoutConceptos.matchAll(/<(?:cfdi:)?Retencion\b[^>]*\bImpuesto=["']002["'][^>]*\bImporte=["']([\d.]+)["']/gi);
      for (const m of matches) iva += parseFloat(m[1] ?? '0') || 0;
      if (iva === 0) {
        iva = parseFloat(getAttr(imp, 'TotalImpuestosRetenidos') || '0') || 0;
      }
      return iva;
    })(),
    total,
    metodoPago,
    formaPago,
    usoCfdi: getAttr(receptor, 'UsoCFDI') || 'G03'
  };
}
