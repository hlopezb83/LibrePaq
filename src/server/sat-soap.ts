import {
  X509Certificate,
  createHash,
  createPrivateKey,
  createPublicKey,
  createSign,
  generateKeyPairSync
} from 'node:crypto';

export interface ParsedFielCertificate {
  rfcTitular: string;
  nombreTitular: string;
  numeroSerieCertificado: string;
  validFrom: string;
  validTo: string;
  isExpired: boolean;
  sha1Fingerprint: string;
  certificateBase64: string;
  privateKeyPem: string;
}

interface EmbeddedTestCerEnvelope {
  kind: 'LIBRE_CONTPAQ_SAT_FIEL_CER_V1';
  rfc: string;
  nombre: string;
  serialNumber: string;
  validFrom: string;
  validTo: string;
  publicKeyDerBase64: string;
}

function normalizeBase64Input(input: string): Buffer {
  const trimmed = input
    .trim()
    .replace(/-----BEGIN [A-Z0-9 ]+-----/g, '')
    .replace(/-----END [A-Z0-9 ]+-----/g, '')
    .replace(/\s+/g, '');
  return Buffer.from(trimmed, 'base64');
}

function extractRfcFromX509Subject(subject: string, fallbackRfc: string): string {
  const match = subject.match(/([A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3})/i);
  return match && match[1] ? match[1].toUpperCase() : fallbackRfc.toUpperCase();
}

function extractNameFromX509Subject(subject: string, fallbackName: string): string {
  const cnMatch = subject.match(/CN=([^,\n/]+)/i);
  if (cnMatch && cnMatch[1]) return cnMatch[1].trim();
  const oMatch = subject.match(/O=([^,\n/]+)/i);
  if (oMatch && oMatch[1]) return oMatch[1].trim();
  return fallbackName;
}

/**
 * Genera un par criptográfico RSA-2048 real (.cer y .key encriptado PKCS#8 con contraseña)
 * para pruebas locales o demostraciones de firma SOAP del SAT sin requerir una FIEL física.
 */
export function generateTestFielCredentials(
  rfc: string,
  nombre: string,
  passphrase: string
): {
  cerBase64: string;
  keyBase64: string;
  numeroSerie: string;
  validFrom: string;
  validTo: string;
} {
  if (!passphrase || passphrase.trim().length < 4) {
    throw new Error('La contraseña de la clave privada (.key) debe tener al menos 4 caracteres.');
  }

  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048
  });

  const publicKeyDer = publicKey.export({ type: 'spki', format: 'der' });
  const encryptedPrivateKeyDer = privateKey.export({
    type: 'pkcs8',
    format: 'der',
    cipher: 'aes-256-cbc',
    passphrase
  });

  const now = new Date();
  const validToDate = new Date(now.getTime() + 4 * 365 * 24 * 60 * 60 * 1000);
  const numeroSerie = '30001000000500003416';

  const cerEnvelope: EmbeddedTestCerEnvelope = {
    kind: 'LIBRE_CONTPAQ_SAT_FIEL_CER_V1',
    rfc: rfc.trim().toUpperCase(),
    nombre: nombre.trim(),
    serialNumber: numeroSerie,
    validFrom: now.toISOString(),
    validTo: validToDate.toISOString(),
    publicKeyDerBase64: Buffer.from(publicKeyDer).toString('base64')
  };

  const cerBase64 = Buffer.from(JSON.stringify(cerEnvelope), 'utf8').toString('base64');
  const keyBase64 = Buffer.from(encryptedPrivateKeyDer).toString('base64');

  return {
    cerBase64,
    keyBase64,
    numeroSerie,
    validFrom: cerEnvelope.validFrom,
    validTo: cerEnvelope.validTo
  };
}

/**
 * Valida criptográficamente el certificado .cer (DER X.509 o envoltorio de prueba) y
 * desencripta la llave privada .key (PKCS#8 DER/PEM) verificando la contraseña y correspondencia RSA.
 */
export function parseAndValidateFielCredentials(params: {
  cerBase64: string;
  keyBase64: string;
  passphrase: string;
  fallbackRfc: string;
  fallbackNombre: string;
}): ParsedFielCertificate {
  const { cerBase64, keyBase64, passphrase, fallbackRfc, fallbackNombre } = params;
  if (!cerBase64.trim()) {
    throw new Error('Debes seleccionar el archivo de certificado (.cer) de la e.firma.');
  }
  if (!keyBase64.trim()) {
    throw new Error('Debes seleccionar el archivo de clave privada (.key) de la e.firma.');
  }
  if (!passphrase || passphrase.length < 4) {
    throw new Error('Debes ingresar la contraseña de la clave privada (.key).');
  }

  const cerBuffer = normalizeBase64Input(cerBase64);
  const keyBuffer = normalizeBase64Input(keyBase64);
  const sha1Fingerprint = createHash('sha1').update(cerBuffer).digest('hex').toUpperCase();

  let privateKeyObj;
  try {
    privateKeyObj = createPrivateKey({
      key: keyBuffer,
      format: 'der',
      type: 'pkcs8',
      passphrase
    });
  } catch {
    try {
      privateKeyObj = createPrivateKey({
        key: keyBuffer.toString('utf8'),
        passphrase
      });
    } catch {
      throw new Error(
        'No fue posible desencriptar el archivo .key. Verifica que la contraseña de la clave privada sea correcta y corresponda a una e.firma del SAT.'
      );
    }
  }

  const privateKeyPem = privateKeyObj.export({ type: 'pkcs8', format: 'pem' }).toString();

  let rfcTitular = fallbackRfc.toUpperCase();
  let nombreTitular = fallbackNombre;
  let numeroSerieCertificado = '30001000000500003416';
  let validFrom = new Date().toISOString();
  let validTo = new Date(Date.now() + 365 * 86400_000).toISOString();
  let publicKeyForCheck: ReturnType<typeof createPublicKey> | null = null;

  try {
    const asJson = JSON.parse(cerBuffer.toString('utf8')) as Partial<EmbeddedTestCerEnvelope>;
    if (asJson && asJson.kind === 'LIBRE_CONTPAQ_SAT_FIEL_CER_V1' && asJson.publicKeyDerBase64) {
      rfcTitular = (asJson.rfc || fallbackRfc).toUpperCase();
      nombreTitular = asJson.nombre || fallbackNombre;
      numeroSerieCertificado = asJson.serialNumber || '30001000000500003416';
      validFrom = asJson.validFrom || validFrom;
      validTo = asJson.validTo || validTo;
      publicKeyForCheck = createPublicKey({
        key: Buffer.from(asJson.publicKeyDerBase64, 'base64'),
        format: 'der',
        type: 'spki'
      });
    }
  } catch {
    // No es JSON de prueba
  }

  if (!publicKeyForCheck) {
    try {
      const x509 = new X509Certificate(cerBuffer);
      rfcTitular = extractRfcFromX509Subject(x509.subject, fallbackRfc);
      nombreTitular = extractNameFromX509Subject(x509.subject, fallbackNombre);
      numeroSerieCertificado = x509.serialNumber || numeroSerieCertificado;
      validFrom = new Date(x509.validFrom).toISOString();
      validTo = new Date(x509.validTo).toISOString();
      publicKeyForCheck = x509.publicKey;
    } catch {
      throw new Error(
        'El archivo .cer no tiene un formato X.509 DER válido del SAT. Sube tu certificado .cer oficial o usa el generador de e.firma de prueba.'
      );
    }
  }

  const challenge = Buffer.from(`SAT_FIEL_CHALLENGE_${rfcTitular}_${Date.now()}`, 'utf8');
  const signer = createSign('RSA-SHA1');
  signer.update(challenge);
  const signature = signer.sign(privateKeyObj);

  const derivedPublicPem = createPublicKey(privateKeyObj)
    .export({ type: 'spki', format: 'pem' })
    .toString();
  const cerPublicPem = publicKeyForCheck.export({ type: 'spki', format: 'pem' }).toString();

  if (derivedPublicPem !== cerPublicPem || signature.length === 0) {
    throw new Error(
      'La clave privada (.key) NO corresponde matemáticamente al certificado (.cer) proporcionado.'
    );
  }

  const isExpired = new Date(validTo).getTime() < Date.now();

  return {
    rfcTitular,
    nombreTitular,
    numeroSerieCertificado,
    validFrom,
    validTo,
    isExpired,
    sha1Fingerprint,
    certificateBase64: cerBuffer.toString('base64'),
    privateKeyPem
  };
}

export {
  buildSatAutenticaSoapXml,
  buildSatSolicitaDescargaSoapXml,
  buildSatConsultaCfdiSoapXml,
  querySatCfdiStatusSoap
} from './sat-soap-envelopes';
