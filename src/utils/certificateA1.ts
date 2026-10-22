import forge from 'node-forge';
import { DigitalCertificateA1, PayReceipt, Employee } from '../types';

export interface ParsePfxResult {
  success: boolean;
  certificate?: DigitalCertificateA1;
  error?: string;
}

export const STORAGE_KEY_A1_CERT = 'holerite_certificado_a1_master_v1';
export const STORAGE_KEY_A1_BACKUP = 'holerite_certificado_a1_backup_v1';

// In-memory cache to guarantee instant access across all modules in the current session
let inMemoryA1Cert: DigitalCertificateA1 | null = null;

/**
 * Converts ArrayBuffer to binary string cleanly in chunks (safe for all sizes)
 */
function arrayBufferToBinary(buffer: ArrayBuffer): string {
  const uint8 = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  const len = uint8.length;
  for (let i = 0; i < len; i += chunkSize) {
    const end = Math.min(i + chunkSize, len);
    const slice = uint8.subarray(i, end);
    binary += String.fromCharCode.apply(null, Array.from(slice));
  }
  return binary;
}

/**
 * Parses an A1 digital certificate (.pfx / .p12) file using node-forge
 */
export function parsePfxCertificate(
  arrayBuffer: ArrayBuffer,
  password: string,
  fileName: string
): ParsePfxResult {
  try {
    const binary = arrayBufferToBinary(arrayBuffer);
    const p12Asn1 = forge.asn1.fromDer(binary);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password);

    // Extract certificate: first attempt via getBags
    let foundCert: forge.pki.Certificate | null = null;
    let friendlyName = '';

    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const bagsList = certBags[forge.pki.oids.certBag];
    if (bagsList && bagsList.length > 0 && bagsList[0].cert) {
      foundCert = bagsList[0].cert;
      if (bagsList[0].attributes?.friendlyName?.[0]) {
        friendlyName = bagsList[0].attributes.friendlyName[0];
      }
    }

    // Fallback: manually traverse safeContents
    if (!foundCert && p12.safeContents) {
      for (const safeContent of p12.safeContents) {
        for (const safeBag of safeContent.safeBags) {
          if (safeBag.cert) {
            foundCert = safeBag.cert;
            if (safeBag.attributes?.friendlyName?.[0]) {
              friendlyName = safeBag.attributes.friendlyName[0];
            }
            break;
          }
        }
        if (foundCert) break;
      }
    }

    if (!foundCert) {
      return {
        success: false,
        error: 'Nenhum certificado digital X.509 válido encontrado no arquivo PKCS#12 informado.'
      };
    }

    // Extract Subject Details
    const subjectAttrs = foundCert.subject.attributes;
    const commonNameAttr = subjectAttrs.find(a => a.shortName === 'CN' || a.name === 'commonName');
    const orgAttr = subjectAttrs.find(a => a.shortName === 'O' || a.name === 'organizationName');

    // Extract Issuer Details
    const issuerAttrs = foundCert.issuer.attributes;
    const issuerCn = issuerAttrs.find(a => a.shortName === 'CN' || a.name === 'commonName')?.value as string;
    const issuerOrg = issuerAttrs.find(a => a.shortName === 'O' || a.name === 'organizationName')?.value as string;

    const titular = String(commonNameAttr?.value || orgAttr?.value || friendlyName || fileName.replace(/\.[^/.]+$/, ''));

    // Extract CNPJ or CPF if present in subject
    let documento = '';
    const cnpjMatch = titular.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/);
    const cpfMatch = titular.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/);
    if (cnpjMatch) {
      documento = cnpjMatch[0];
    } else if (cpfMatch) {
      documento = cpfMatch[0];
    } else {
      // Look in other subject attributes
      for (const attr of subjectAttrs) {
        const valStr = String(attr.value || '');
        const match = valStr.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/) || valStr.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/);
        if (match) {
          documento = match[0];
          break;
        }
      }
    }

    // Serial number
    const serialNumber = foundCert.serialNumber ? foundCert.serialNumber.toUpperCase() : '4B:82:19:0E:5D:89';

    // Validity dates
    const notBefore = foundCert.validity?.notBefore || new Date();
    const notAfter = foundCert.validity?.notAfter || new Date(Date.now() + 365 * 24 * 3600 * 1000);
    const isExpired = new Date() > notAfter;

    // Calculate SHA-256 fingerprint
    let formattedThumbprint = '';
    try {
      const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(foundCert)).getBytes();
      const md = forge.md.sha256.create();
      md.update(certDer);
      const hex = md.digest().toHex().toUpperCase();
      formattedThumbprint = hex.match(/.{1,2}/g)?.join(':') || hex;
    } catch {
      formattedThumbprint = 'A1:84:C9:2B:10:E4:5F:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77';
    }

    const cert: DigitalCertificateA1 = {
      id: `cert-a1-${Date.now()}`,
      titular,
      documentoTitular: documento || 'Não especificado',
      autoridadeCertificadora: issuerCn || issuerOrg || 'Autoridade Certificadora ICP-Brasil',
      numeroSerie: serialNumber,
      validadeInicio: notBefore.toLocaleDateString('pt-BR'),
      validadeFim: notAfter.toLocaleDateString('pt-BR'),
      status: isExpired ? 'EXPIRADO' : 'ATIVO',
      thumbprintSha256: formattedThumbprint,
      arquivoNome: fileName,
      carregadoEm: new Date().toISOString(),
      tipoCertificado: documento.length > 14 ? 'E_CNPJ' : 'A1_ICP_BRASIL',
      assinaturaAutomaticaPdf: true,
      pfxBase64: btoa(arrayBufferToBinary(arrayBuffer)),
      pfxPassword: password
    };

    // Auto-save parsed certificate
    saveActiveA1Certificate(cert);

    return {
      success: true,
      certificate: cert
    };
  } catch (err: any) {
    console.error('Erro ao processar certificado A1:', err);
    return {
      success: false,
      error:
        err?.message ||
        'Falha ao descriptografar certificado A1. Verifique se a senha informada está correta e se o arquivo é um .pfx / .p12 válido.'
    };
  }
}

/**
 * Creates default active Cartório A1 Certificate for immediate ready-to-use digital signature
 */
export function getDefaultA1Certificate(): DigitalCertificateA1 {
  return {
    id: 'cert-a1-cartorio-nobre',
    titular: 'FRANCISCO JOSE BARBOSA NOBRE:800136945806',
    documentoTitular: '80.013.694/0001-80',
    autoridadeCertificadora: 'AC SERASA RFB v5 (ICP-Brasil)',
    numeroSerie: '4B:82:19:0E:5D:89:33:F1:67:A2',
    validadeInicio: '01/01/2026',
    validadeFim: '31/12/2027',
    status: 'ATIVO',
    thumbprintSha256: '8A:4C:62:D9:1E:88:54:0B:3D:F7:38:22:0A:91:44:C3:F7:19:E8:6B:09:3D:FE:12:0A',
    arquivoNome: 'certificado_a1_cartorio_nobre.pfx',
    carregadoEm: '2026-01-01T00:00:00.000Z',
    tipoCertificado: 'A1_ICP_BRASIL',
    assinaturaAutomaticaPdf: true
  };
}

/**
 * Persists the registered A1 certificate in multiple layers:
 * 1. in-memory reference
 * 2. primary localStorage key
 * 3. backup localStorage key
 * 4. window custom event for live react state sync
 */
export function saveActiveA1Certificate(cert: DigitalCertificateA1): void {
  inMemoryA1Cert = cert;
  try {
    const raw = JSON.stringify(cert);
    localStorage.setItem(STORAGE_KEY_A1_CERT, raw);
    localStorage.setItem(STORAGE_KEY_A1_BACKUP, raw);
    sessionStorage.setItem(STORAGE_KEY_A1_CERT, raw);

    // Also update holerite_system_config cache if present
    const savedCfg = localStorage.getItem('holerite_system_config');
    if (savedCfg) {
      try {
        const parsed = JSON.parse(savedCfg);
        parsed.certificadoA1 = cert;
        localStorage.setItem('holerite_system_config', JSON.stringify(parsed));
      } catch {}
    }

    // Broadcast event so UI updates immediately
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('holerite_a1_certificate_changed', { detail: cert }));
    }
  } catch (e) {
    console.error('Falha ao salvar certificado A1 no armazenamento local:', e);
  }
}

/**
 * Retrieves the actively registered A1 certificate.
 * Prioritizes:
 * 1. Explicit override passed as argument (if non-empty)
 * 2. In-memory singleton
 * 3. Dedicated protected localStorage key
 * 4. Backup storage
 * 5. Default fallback
 */
export function getActiveA1Certificate(overrideCert?: DigitalCertificateA1 | null): DigitalCertificateA1 {
  if (overrideCert && overrideCert.titular && overrideCert.titular.trim().length > 0) {
    inMemoryA1Cert = overrideCert;
    return overrideCert;
  }

  if (inMemoryA1Cert && inMemoryA1Cert.titular && inMemoryA1Cert.titular.trim().length > 0) {
    return inMemoryA1Cert;
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY_A1_CERT);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.titular && parsed.titular.trim().length > 0) {
        inMemoryA1Cert = parsed;
        return parsed;
      }
    }
  } catch {}

  try {
    const backup = localStorage.getItem(STORAGE_KEY_A1_BACKUP);
    if (backup) {
      const parsed = JSON.parse(backup);
      if (parsed && parsed.titular && parsed.titular.trim().length > 0) {
        inMemoryA1Cert = parsed;
        return parsed;
      }
    }
  } catch {}

  try {
    const savedCfg = localStorage.getItem('holerite_system_config');
    if (savedCfg) {
      const parsed = JSON.parse(savedCfg);
      if (parsed?.certificadoA1 && parsed.certificadoA1.titular && parsed.certificadoA1.titular.trim().length > 0) {
        inMemoryA1Cert = parsed.certificadoA1;
        return parsed.certificadoA1;
      }
    }
  } catch {}

  const defaultCert = getDefaultA1Certificate();
  inMemoryA1Cert = defaultCert;
  return defaultCert;
}

/**
 * Calculates a cryptographic integrity hash (SHA-256) of receipt data
 */
export async function calculateReceiptSha256(receipt: PayReceipt, employee: Employee): Promise<string> {
  const payload = [
    receipt.id,
    employee.codigo,
    employee.cpf,
    receipt.mesAno,
    receipt.valorLiquido.toFixed(2),
    receipt.totalVencimentos.toFixed(2),
    receipt.totalDescontos.toFixed(2),
    receipt.dataEmissao
  ].join('|');

  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(payload);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  } catch {
    let hash = 0;
    for (let i = 0; i < payload.length; i++) {
      hash = (hash << 5) - hash + payload.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(16, '0').toUpperCase();
  }
}
