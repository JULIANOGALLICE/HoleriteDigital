import { SystemConfig } from '../types';

export interface EmailTestResult {
  success: boolean;
  message: string;
  details?: string;
  code?: string;
  rawError?: string;
  messageId?: string;
  previewUrl?: string;
}

export async function testSmtpConnection(
  config: SystemConfig,
  recipientEmail?: string
): Promise<EmailTestResult> {
  try {
    const res = await fetch('/api/email/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        config,
        to: recipientEmail || config.emailRemetente
      })
    });

    let data: any;
    try {
      data = await res.json();
    } catch (parseErr) {
      return {
        success: false,
        message: 'O servidor retornou uma resposta inesperada.',
        details: `Código de status HTTP ${res.status} (${res.statusText}). O serviço de e-mail pode estar reiniciando.`
      };
    }

    if (!res.ok || !data.success) {
      return {
        success: false,
        message: data.message || 'Falha ao testar conexão SMTP.',
        details: data.details || 'Verifique se os dados de host, porta e senha estão corretos.',
        code: data.code,
        rawError: data.rawError
      };
    }

    return {
      success: true,
      message: data.message,
      messageId: data.messageId,
      previewUrl: data.previewUrl
    };
  } catch (error: any) {
    return {
      success: false,
      message: 'Não foi possível comunicar com o servidor de e-mail.',
      details: error?.message || 'Erro de conexão ou serviço offline.',
      rawError: error?.message
    };
  }
}

export async function dispatchRealEmail(
  config: SystemConfig,
  to: string,
  subject: string,
  html: string,
  text?: string,
  pdfBase64?: string,
  filename?: string
): Promise<EmailTestResult> {
  try {
    const res = await fetch('/api/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        config,
        to,
        subject,
        html,
        text,
        pdfBase64,
        filename
      })
    });

    let data: any;
    try {
      data = await res.json();
    } catch (parseErr) {
      return {
        success: false,
        message: 'Falha na resposta do servidor de e-mail.',
        details: `Código HTTP ${res.status}. Verifique se o servidor backend está online.`
      };
    }

    if (!res.ok || !data.success) {
      return {
        success: false,
        message: data.message || 'Erro ao enviar o e-mail.',
        details: data.details,
        code: data.code,
        rawError: data.rawError
      };
    }

    return {
      success: true,
      message: data.message,
      messageId: data.messageId,
      previewUrl: data.previewUrl
    };
  } catch (error: any) {
    return {
      success: false,
      message: 'Falha de comunicação com o serviço de envio.',
      details: error?.message,
      rawError: error?.message
    };
  }
}
