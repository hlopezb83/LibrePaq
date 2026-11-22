import { createHash, createSign } from 'node:crypto';
import { escapeXmlAttr } from '../shared/cfdi-xml';

function computeSha1Base64(content: string): string {
  return createHash('sha1').update(content, 'utf8').digest('base64');
}

function signRsaSha1Base64(content: string, privateKeyPem: string): string {
  const signer = createSign('RSA-SHA1');
  signer.update(content, 'utf8');
  return signer.sign(privateKeyPem, 'base64');
}

/**
 * Construye el sobre SOAP 1.1 de Autenticación WS-Security firmado con XML-DSig (RSA-SHA1)
 * conforme al estándar del Web Service de Descarga Masiva del SAT v1.5.
 */
export function buildSatAutenticaSoapXml(params: {
  certificateBase64: string;
  privateKeyPem: string;
  createdIso?: string;
  expiresIso?: string;
}): { soapXml: string; digestValue: string; signatureValue: string } {
  const now = params.createdIso ? new Date(params.createdIso) : new Date();
  const exp = params.expiresIso
    ? new Date(params.expiresIso)
    : new Date(now.getTime() + 5 * 60 * 1000);
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

  return { soapXml, digestValue, signatureValue };
}

/**
 * Construye el sobre SOAP 1.1 de SolicitaDescargaEmitidos / SolicitaDescargaRecibidos
 * firmado con XML-DSig usando la llave privada .key del contribuyente.
 */
export function buildSatSolicitaDescargaSoapXml(params: {
  rfcSolicitante: string;
  tipoSolicitud: 'EMITIDOS' | 'RECIBIDOS';
  fechaInicial: string;
  fechaFinal: string;
  certificateBase64: string;
  privateKeyPem: string;
}): { soapXml: string; digestValue: string; signatureValue: string } {
  const rfc = escapeXmlAttr(params.rfcSolicitante.toUpperCase());
  const operationTag =
    params.tipoSolicitud === 'EMITIDOS'
      ? 'SolicitaDescargaEmitidos'
      : 'SolicitaDescargaRecibidos';
  const rfcFilterAttr =
    params.tipoSolicitud === 'EMITIDOS'
      ? `RfcEmisor="${rfc}"`
      : `RfcReceptor="${rfc}"`;

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

  return { soapXml, digestValue, signatureValue };
}

export {
  buildSatConsultaCfdiSoapXml,
  querySatCfdiStatusSoap
} from '../shared/sat-cfdi-status';
