import { Employee, PayReceipt, SystemConfig } from '../types';
import { formatBRL } from '../utils/pdfGenerator';
import { createWhatsAppMessage } from '../utils/notifications';

export interface EvolutionStatusResponse {
  success: boolean;
  connected: boolean;
  state?: string;
  message: string;
  details?: any;
}

export interface EvolutionTestResponse {
  success: boolean;
  connected?: boolean;
  state?: string;
  message: string;
  sendResult?: any;
}

export interface EvolutionSendResponse {
  success: boolean;
  message: string;
  mediaResult?: any;
  textResult?: any;
}

/**
 * Normaliza o telefone para o padrão do WhatsApp (apenas dígitos, com DDI 55 do Brasil)
 */
export function formatWhatsAppPhone(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }
  return digits;
}

/**
 * Preenche as tags dinâmicas no modelo de mensagem
 */
export function renderWhatsAppTemplate(
  template: string,
  employee: Employee,
  receipt?: PayReceipt,
  customParams?: Record<string, string>
): string {
  const primeiroNome = employee.nome.trim().split(' ')[0] || employee.nome;
  let text = template || '';

  text = text.replace(/\{nome\}/g, employee.nome);
  text = text.replace(/\{primeiroNome\}/g, primeiroNome);
  text = text.replace(/\{matricula\}/g, employee.codigo);
  text = text.replace(/\{codigo\}/g, employee.codigo);
  text = text.replace(/\{cargo\}/g, employee.cargo || '');

  if (receipt) {
    text = text.replace(/\{mesAno\}/g, receipt.mesAno);
    text = text.replace(/\{valorLiquido\}/g, `R$ ${formatBRL(receipt.valorLiquido)}`);
    text = text.replace(/\{totalVencimentos\}/g, `R$ ${formatBRL(receipt.totalVencimentos)}`);
    text = text.replace(/\{totalDescontos\}/g, `R$ ${formatBRL(receipt.totalDescontos)}`);
  }

  if (customParams) {
    Object.entries(customParams).forEach(([key, val]) => {
      text = text.replace(new RegExp(`\\{${key}\\}`, 'g'), val);
    });
  }

  // Tag de link portal
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  text = text.replace(/\{linkPortal\}/g, origin);

  return text;
}

/**
 * Testa a conexão com a Evolution API
 */
export async function testEvolutionApiConnection(config: {
  evolutionApiUrl?: string;
  evolutionApiKey?: string;
  evolutionInstance?: string;
  testNumber?: string;
}): Promise<EvolutionTestResponse> {
  try {
    const res = await fetch('/api/whatsapp/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    return {
      success: false,
      connected: false,
      message: err.message || 'Erro de rede ao conectar à Evolution API.'
    };
  }
}

/**
 * Consulta o status da instância na Evolution API
 */
export async function checkEvolutionApiStatus(config: {
  evolutionApiUrl?: string;
  evolutionApiKey?: string;
  evolutionInstance?: string;
}): Promise<EvolutionStatusResponse> {
  try {
    const res = await fetch('/api/whatsapp/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    return {
      success: false,
      connected: false,
      message: err.message || 'Erro ao consultar status da instância.'
    };
  }
}

/**
 * Envia uma mensagem via Evolution API (com ou sem mídia PDF)
 */
export async function sendEvolutionWhatsAppMessage(params: {
  config: SystemConfig;
  number: string;
  text: string;
  media?: string; // base64
  fileName?: string;
  caption?: string;
}): Promise<EvolutionSendResponse> {
  const { config, number, text, media, fileName, caption } = params;

  try {
    const res = await fetch('/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        evolutionApiUrl: config.evolutionApiUrl,
        evolutionApiKey: config.evolutionApiKey,
        evolutionInstance: config.evolutionInstance,
        number,
        text,
        media,
        fileName,
        caption
      })
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Erro ao enviar WhatsApp pela Evolution API.'
    };
  }
}

/**
 * Função inteligente de despacho de WhatsApp:
 * Se o provedor for EVOLUTION_API e as credenciais estiverem configuradas,
 * envia de forma automática e silenciosa via API.
 * Se falhar ou se for WHATSAPP_WEB_DIRECT, retorna a URL de fallback ou abre o WhatsApp Web.
 */
export async function dispatchWhatsAppSmart(
  config: SystemConfig,
  employee: Employee,
  receipt: PayReceipt,
  options?: {
    customText?: string;
    pdfBase64?: string;
    openFallbackWindow?: boolean;
  }
): Promise<{
  success: boolean;
  methodUsed: 'EVOLUTION_API' | 'WHATSAPP_WEB_DIRECT';
  message: string;
  fallbackUrl?: string;
}> {
  const phone = formatWhatsAppPhone(employee.telefone);
  if (!phone) {
    return {
      success: false,
      methodUsed: 'WHATSAPP_WEB_DIRECT',
      message: `Colaborador ${employee.nome} não possui telefone / WhatsApp cadastrado.`
    };
  }

  // Gera o texto personalizado da mensagem
  const text = options?.customText || (
    config.mensagemWhatsappPadrao
      ? renderWhatsAppTemplate(config.mensagemWhatsappPadrao, employee, receipt)
      : createWhatsAppMessage(employee, receipt)
  );

  const fallbackUrl = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;

  const isEvolutionConfigured =
    config.whatsappProvider === 'EVOLUTION_API' &&
    Boolean(config.evolutionApiUrl && config.evolutionApiKey && config.evolutionInstance);

  if (isEvolutionConfigured) {
    try {
      const media = config.enviarPdfAutomaticoWhatsapp && options?.pdfBase64
        ? options.pdfBase64
        : undefined;

      const fileName = `Holerite-${receipt.mesAno.replace(/[^a-zA-Z0-9]/g, '-')}-${employee.nome.split(' ')[0]}.pdf`;

      const result = await sendEvolutionWhatsAppMessage({
        config,
        number: phone,
        text,
        media,
        fileName,
        caption: `📄 Holerite de Pagamento - ${receipt.mesAno} - ${employee.nome}`
      });

      if (result.success) {
        return {
          success: true,
          methodUsed: 'EVOLUTION_API',
          message: `Mensagem enviada com sucesso para ${employee.nome} via Evolution API!`
        };
      } else {
        console.warn('Evolution API falhou, usando fallback WhatsApp Web:', result.message);
        if (options?.openFallbackWindow !== false) {
          window.open(fallbackUrl, '_blank');
        }
        return {
          success: false,
          methodUsed: 'WHATSAPP_WEB_DIRECT',
          message: `Evolution API indisponível (${result.message}). Link do WhatsApp Web aberto.`,
          fallbackUrl
        };
      }
    } catch (e: any) {
      if (options?.openFallbackWindow !== false) {
        window.open(fallbackUrl, '_blank');
      }
      return {
        success: false,
        methodUsed: 'WHATSAPP_WEB_DIRECT',
        message: `Erro na Evolution API. Abrindo WhatsApp Web.`,
        fallbackUrl
      };
    }
  }

  // Provedor padrão: WhatsApp Web
  if (options?.openFallbackWindow !== false) {
    window.open(fallbackUrl, '_blank');
  }

  return {
    success: true,
    methodUsed: 'WHATSAPP_WEB_DIRECT',
    message: `Janela do WhatsApp Web aberta para ${employee.nome}.`,
    fallbackUrl
  };
}
