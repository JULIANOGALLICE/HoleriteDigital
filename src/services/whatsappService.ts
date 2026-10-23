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
 * Limpa e normaliza a URL base da Evolution API (remove barras extras e sufixos de painel como /manager)
 */
export function cleanEvolutionBaseUrl(rawUrl?: string): string {
  if (!rawUrl) return '';
  return rawUrl
    .trim()
    .replace(/\/+(manager|dashboard|app|login)(\/.*)?$/i, '')
    .replace(/\/+$/, '');
}

/**
 * Faz o parse seguro de uma resposta HTTP que deveria ser JSON, detectando páginas HTML (<!doctype html>)
 */
async function safeParseJsonResponse(res: Response): Promise<{ isHtml: boolean; data: any; rawText: string }> {
  const rawText = await res.text();
  const trimmed = rawText.trim();
  if (
    trimmed.toLowerCase().startsWith('<!doctype') ||
    trimmed.toLowerCase().startsWith('<html') ||
    trimmed.startsWith('<')
  ) {
    return { isHtml: true, data: null, rawText: trimmed };
  }
  try {
    return { isHtml: false, data: trimmed ? JSON.parse(trimmed) : null, rawText: trimmed };
  } catch {
    return { isHtml: false, data: null, rawText: trimmed };
  }
}

/**
 * Extrai mensagem de erro amigável de respostas da Evolution API
 */
function extractEvolutionErrorMessage(data: any, status: number, baseUrl: string, isHtml: boolean): string {
  if (isHtml) {
    return `A URL configurada (${baseUrl}) retornou uma página HTML em vez da Evolution API (HTTP ${status}). Verifique nas Configurações se a URL aponta para a API da Evolution (sem /manager no final).`;
  }
  if (data) {
    if (typeof data.message === 'string') return data.message;
    if (Array.isArray(data.response?.message)) return data.response.message.join(', ');
    if (typeof data.response?.message === 'string') return data.response.message;
    if (typeof data.error === 'string') return data.error;
  }
  return `Evolution API retornou status HTTP ${status}. Verifique a instância e a chave de API.`;
}

/**
 * Chamada direta (Client -> Evolution API) usada automaticamente na VPS caso a rota /api/* caia no fallback HTML do Nginx/Vite
 */
async function checkEvolutionStatusDirectClient(config: {
  evolutionApiUrl?: string;
  evolutionApiKey?: string;
  evolutionInstance?: string;
}): Promise<EvolutionStatusResponse> {
  const baseUrl = cleanEvolutionBaseUrl(config.evolutionApiUrl);
  const apiKey = (config.evolutionApiKey || '').trim();
  const cleanInstance = encodeURIComponent((config.evolutionInstance || '').trim());

  if (!baseUrl || !apiKey || !cleanInstance) {
    return {
      success: false,
      connected: false,
      message: 'URL da Evolution API, Chave API e Nome da Instância são obrigatórios.'
    };
  }

  try {
    const resp = await fetch(`${baseUrl}/instance/connectionState/${cleanInstance}`, {
      method: 'GET',
      headers: { apikey: apiKey }
    });
    const { isHtml, data } = await safeParseJsonResponse(resp);

    if (isHtml || !resp.ok) {
      return {
        success: false,
        connected: false,
        message: extractEvolutionErrorMessage(data, resp.status, baseUrl, isHtml),
        details: data
      };
    }

    const state = (data?.instance?.state || data?.state || 'unknown').toLowerCase();
    const connected = state === 'open' || state === 'connected';

    return {
      success: true,
      connected,
      state,
      message: connected
        ? 'Instância conectada e pronta para envio!'
        : `Instância detectada no estado: ${state}. Conecte o WhatsApp via QR Code na Evolution API.`
    };
  } catch (err: any) {
    return {
      success: false,
      connected: false,
      message: `Não foi possível conectar em ${baseUrl}: ${err?.message || 'Falha de rede ou CORS'}`
    };
  }
}

async function sendEvolutionDirectClient(params: {
  evolutionApiUrl?: string;
  evolutionApiKey?: string;
  evolutionInstance?: string;
  number: string;
  text: string;
  media?: string;
  fileName?: string;
  caption?: string;
}): Promise<EvolutionSendResponse> {
  const baseUrl = cleanEvolutionBaseUrl(params.evolutionApiUrl);
  const apiKey = (params.evolutionApiKey || '').trim();
  const cleanInstance = encodeURIComponent((params.evolutionInstance || '').trim());

  if (!baseUrl || !apiKey || !cleanInstance) {
    return {
      success: false,
      message: 'Configuração da Evolution API incompleta (URL, Apikey ou Instância ausente).'
    };
  }

  let rawPhone = String(params.number || '').replace(/\D/g, '');
  if (rawPhone.length === 10 || rawPhone.length === 11) {
    rawPhone = `55${rawPhone}`;
  }

  try {
    let mediaResult: any = null;
    let mediaSentOk = false;

    if (params.media) {
      const cleanBase64 = params.media.replace(/^data:[^;]+;base64,/, '').trim();
      const mediaResp = await fetch(`${baseUrl}/message/sendMedia/${cleanInstance}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: apiKey
        },
        body: JSON.stringify({
          number: rawPhone,
          mediatype: 'document',
          mimetype: 'application/pdf',
          caption: params.caption || params.text || '',
          media: cleanBase64,
          fileName: params.fileName || 'holerite.pdf',
          mediaMessage: {
            mediatype: 'document',
            caption: params.caption || params.text || '',
            media: cleanBase64,
            fileName: params.fileName || 'holerite.pdf'
          }
        })
      });

      const parsedMedia = await safeParseJsonResponse(mediaResp);
      if (mediaResp.ok && !parsedMedia.isHtml) {
        mediaResult = parsedMedia.data;
        mediaSentOk = true;
      }
    }

    let textResult: any = null;
    if (!params.media || !mediaSentOk) {
      const textResp = await fetch(`${baseUrl}/message/sendText/${cleanInstance}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: apiKey
        },
        body: JSON.stringify({
          number: rawPhone,
          text: params.text,
          delay: 1200,
          options: {
            delay: 1200,
            presence: 'composing',
            linkPreview: true
          }
        })
      });

      const parsedText = await safeParseJsonResponse(textResp);
      if (parsedText.isHtml || !textResp.ok) {
        return {
          success: false,
          message: extractEvolutionErrorMessage(parsedText.data, textResp.status, baseUrl, parsedText.isHtml)
        };
      }
      textResult = parsedText.data;
    }

    return {
      success: true,
      message: 'Mensagem enviada com sucesso pelo WhatsApp via Evolution API!',
      mediaResult,
      textResult
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Falha ao conectar na Evolution API (${baseUrl}): ${err?.message || 'Erro de conexão'}`
    };
  }
}

/**
 * Testa a conexão com a Evolution API (com fallback direto caso /api retorne HTML na VPS)
 */
export async function testEvolutionApiConnection(config: {
  evolutionApiUrl?: string;
  evolutionApiKey?: string;
  evolutionInstance?: string;
  testNumber?: string;
}): Promise<EvolutionTestResponse> {
  const cleanedConfig = {
    ...config,
    evolutionApiUrl: cleanEvolutionBaseUrl(config.evolutionApiUrl)
  };

  try {
    const res = await fetch('/api/whatsapp/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanedConfig)
    });

    const { isHtml, data } = await safeParseJsonResponse(res);

    // Se a VPS retornou o index.html (<!doctype html>) ou 404/405/502, executa direto do navegador para a Evolution API
    if (isHtml || res.status === 404 || res.status === 405 || res.status === 502) {
      const statusCheck = await checkEvolutionStatusDirectClient(cleanedConfig);
      if (!statusCheck.success) {
        return statusCheck;
      }
      if (cleanedConfig.testNumber && cleanedConfig.testNumber.trim()) {
        const sendCheck = await sendEvolutionDirectClient({
          ...cleanedConfig,
          number: cleanedConfig.testNumber,
          text: `🤖 *Holerite Digital • Teste de Integração Evolution API*\n\nConexão estabelecida com sucesso! O sistema de RH está apto para o disparo automático de holerites e comunicados aos colaboradores via WhatsApp.`
        });
        if (!sendCheck.success) {
          return {
            success: false,
            connected: statusCheck.connected,
            state: statusCheck.state,
            message: sendCheck.message
          };
        }
        return {
          success: true,
          connected: statusCheck.connected,
          state: statusCheck.state,
          message: `Conexão validada e mensagem de teste disparada para ${cleanedConfig.testNumber}!`
        };
      }
      return {
        success: true,
        connected: statusCheck.connected,
        state: statusCheck.state,
        message: statusCheck.message
      };
    }

    if (!data) {
      return {
        success: false,
        connected: false,
        message: `Resposta inválida do servidor (HTTP ${res.status}).`
      };
    }

    return data;
  } catch (err: any) {
    // Fallback direto em caso de erro de rede com o backend local
    const statusCheck = await checkEvolutionStatusDirectClient(cleanedConfig);
    return {
      success: statusCheck.success,
      connected: statusCheck.connected,
      state: statusCheck.state,
      message: statusCheck.message
    };
  }
}

/**
 * Consulta o status da instância na Evolution API (com fallback direto na VPS)
 */
export async function checkEvolutionApiStatus(config: {
  evolutionApiUrl?: string;
  evolutionApiKey?: string;
  evolutionInstance?: string;
}): Promise<EvolutionStatusResponse> {
  const cleanedConfig = {
    ...config,
    evolutionApiUrl: cleanEvolutionBaseUrl(config.evolutionApiUrl)
  };

  try {
    const res = await fetch('/api/whatsapp/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanedConfig)
    });

    const { isHtml, data } = await safeParseJsonResponse(res);

    if (isHtml || res.status === 404 || res.status === 405 || res.status === 502 || !data) {
      return await checkEvolutionStatusDirectClient(cleanedConfig);
    }

    return data;
  } catch {
    return await checkEvolutionStatusDirectClient(cleanedConfig);
  }
}

/**
 * Envia uma mensagem via Evolution API (com ou sem mídia PDF), com fallback direto automático para VPS
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
  const cleanUrl = cleanEvolutionBaseUrl(config.evolutionApiUrl);
  const cleanMedia = media ? media.replace(/^data:[^;]+;base64,/, '').trim() : undefined;

  try {
    const res = await fetch('/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        evolutionApiUrl: cleanUrl,
        evolutionApiKey: config.evolutionApiKey,
        evolutionInstance: config.evolutionInstance,
        number,
        text,
        media: cleanMedia,
        fileName,
        caption
      })
    });

    const { isHtml, data } = await safeParseJsonResponse(res);

    // Se na VPS a rota /api/whatsapp/send retornou <!doctype html> (ex: Nginx estático ou vite preview), envia direto para a Evolution API!
    if (isHtml || res.status === 404 || res.status === 405 || res.status === 502 || !data) {
      return await sendEvolutionDirectClient({
        evolutionApiUrl: cleanUrl,
        evolutionApiKey: config.evolutionApiKey,
        evolutionInstance: config.evolutionInstance,
        number,
        text,
        media: cleanMedia,
        fileName,
        caption
      });
    }

    return data;
  } catch {
    return await sendEvolutionDirectClient({
      evolutionApiUrl: cleanUrl,
      evolutionApiKey: config.evolutionApiKey,
      evolutionInstance: config.evolutionInstance,
      number,
      text,
      media: cleanMedia,
      fileName,
      caption
    });
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
