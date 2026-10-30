import { parsePayrollText, ParsedRecord } from '../utils/pdfParser';

export interface SafeApiJsonResult<T = any> {
  isHtmlFallback: boolean;
  status: number;
  data: T | null;
  rawText: string;
}

/**
 * Lê a resposta de uma rota `/api/*` de forma segura, detectando quando o Nginx/Apache
 * na VPS devolve `index.html` (`<!doctype html>`) em vez de JSON.
 */
export async function safeParseApiResponse<T = any>(res: Response): Promise<SafeApiJsonResult<T>> {
  const rawText = await res.text();
  const trimmed = rawText.trim().toLowerCase();

  if (
    trimmed.startsWith('<!doctype') ||
    trimmed.startsWith('<html') ||
    trimmed.startsWith('<head') ||
    trimmed.startsWith('<body')
  ) {
    return {
      isHtmlFallback: true,
      status: res.status,
      data: null,
      rawText
    };
  }

  try {
    const parsed = JSON.parse(rawText) as T;
    return {
      isHtmlFallback: false,
      status: res.status,
      data: parsed,
      rawText
    };
  } catch {
    return {
      isHtmlFallback: true,
      status: res.status,
      data: null,
      rawText
    };
  }
}

export function resolveStoredGeminiKey(explicitKey?: string): string {
  const trimmed = (explicitKey || '').trim();
  if (trimmed.length >= 10) return trimmed;
  try {
    const raw = localStorage.getItem('holerite_system_config');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.geminiApiKey && String(parsed.geminiApiKey).trim().length >= 10) {
        return String(parsed.geminiApiKey).trim();
      }
    }
  } catch {}
  return '';
}

export function maskGeminiApiKey(key: string): string {
  const clean = (key || '').trim();
  if (clean.length <= 10) return '';
  return `${clean.slice(0, 6)}••••••••••••••••${clean.slice(-4)}`;
}

/**
 * Executa o teste real de autenticação e baixa latência diretamente com a API oficial
 * do Google Gemini via HTTPS quando o endpoint `/api/ai/test` da VPS não está acessível
 * (ex: Nginx servindo `index.html` estático ou processo Node desatualizado).
 */
export async function testGeminiDirectBrowser(
  providedKey?: string,
  preferredModel = 'gemini-3.8-flash'
): Promise<{
  success: boolean;
  message: string;
  modelUsed?: string;
  durationMs?: number;
  maskedKey?: string;
  keySource?: string;
}> {
  const startTime = Date.now();
  const apiKey = resolveStoredGeminiKey(providedKey);

  if (!apiKey) {
    return {
      success: false,
      message:
        'Nenhuma Chave de API do Google Gemini encontrada. Cole sua chave (AIzaSy...) no campo acima e clique em Salvar Chave da IA.'
    };
  }

  const candidateModels = Array.from(
    new Set([
      preferredModel || 'gemini-3.8-flash',
      'gemini-3.1-flash-lite',
      'gemini-3-flash-preview',
      'gemini-2.5-flash'
    ])
  );

  let usedModel = '';
  let lastError = '';

  for (const model of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model
      )}:generateContent?key=${encodeURIComponent(apiKey)}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Responda apenas: OK' }] }],
          generationConfig: {
            maxOutputTokens: 10,
            temperature: 0
          }
        }),
        signal: AbortSignal.timeout(3000)
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data?.candidates?.length > 0) {
        usedModel = model;
        break;
      }

      const errMsg = data?.error?.message || `HTTP ${res.status}`;
      lastError = errMsg;

      // Se a chave for inválida (400 API_KEY_INVALID / 403), interrompe imediatamente sem testar outros modelos
      if (
        res.status === 400 &&
        (errMsg.includes('API_KEY_INVALID') || errMsg.toLowerCase().includes('api key not valid'))
      ) {
        return {
          success: false,
          message: 'Chave da API inválida. Verifique se copiou a chave completa (iniciada por AIzaSy...) do Google AI Studio.'
        };
      }
    } catch (err: any) {
      lastError = err?.name === 'TimeoutError' || err?.name === 'AbortError'
        ? `Modelo ${model} excedeu 3s (alta demanda)`
        : err?.message || String(err);
    }
  }

  const durationMs = Date.now() - startTime;

  if (!usedModel) {
    return {
      success: false,
      message: `Falha ao autenticar no Google Gemini: ${lastError || 'Verifique sua Chave da API.'}`
    };
  }

  return {
    success: true,
    modelUsed: usedModel,
    durationMs,
    maskedKey: maskGeminiApiKey(apiKey),
    keySource: 'database',
    message: `Conexão com Google Gemini (${usedModel}) validada com sucesso em ${durationMs}ms!`
  };
}

/**
 * Executa a extração por coordenadas + auditoria contábil real no Google Gemini
 * diretamente pelo navegador caso a rota `/api/ai/parse-payroll` da VPS retorne HTML (`<!doctype html>`).
 */
export async function parseAndAuditPayrollDirectBrowser(
  extractedText: string,
  providedKey?: string,
  preferredModel = 'gemini-3.8-flash'
): Promise<{
  success: boolean;
  records: ParsedRecord[];
  count: number;
  engine: 'gemini';
  aiModelUsed: string;
  aiDurationMs: number;
  message?: string;
  code?: string;
}> {
  const startTime = Date.now();
  const apiKey = resolveStoredGeminiKey(providedKey);

  if (!apiKey) {
    return {
      success: false,
      records: [],
      count: 0,
      engine: 'gemini',
      aiModelUsed: '',
      aiDurationMs: Date.now() - startTime,
      code: 'MISSING_API_KEY',
      message:
        'Chave da API do Google Gemini não configurada. Acesse Configurações do Sistema > Inteligência Artificial (IA) e salve sua Chave da API.'
    };
  }

  const localResult = parsePayrollText(extractedText);
  const localRecords = localResult.records || [];

  if (localRecords.length === 0) {
    return {
      success: false,
      records: [],
      count: 0,
      engine: 'gemini',
      aiModelUsed: '',
      aiDurationMs: Date.now() - startTime,
      message: 'Nenhum holerite pôde ser identificado no texto do PDF.'
    };
  }

  const auditSummary = localRecords.map(r => ({
    codigo: r.employee.codigo,
    nome: r.employee.nome,
    cargo: r.employee.cargo,
    cbo: r.employee.cbo,
    dataAdmissao: r.employee.dataAdmissao,
    salarioBase: r.receipt.salarioBase,
    totalVencimentos: r.receipt.totalVencimentos,
    totalDescontos: r.receipt.totalDescontos,
    valorLiquido: r.receipt.valorLiquido,
    qtdRubricas: r.receipt.itens.length
  }));

  const auditPrompt = `Você é um auditor contábil sênior especializado em folha de pagamento. Revise os ${localRecords.length} holerites extraídos do documento oficial abaixo e verifique a integridade cadastral (código, nome em MAIÚSCULAS, cargo, CBO, data de admissão) e contábil.
Retorne estritamente um JSON no formato:
{
  "verified": true,
  "checkedCount": ${localRecords.length},
  "corrections": [
    { "codigo": "string", "nome": "NOME CORRIGIDO", "cargo": "CARGO CORRIGIDO", "cbo": "CBO CORRIGIDO" }
  ]
}
Se todos os nomes e cargos já estiverem corretos, retorne "corrections": [].
Resumo dos holerites extraídos:
${JSON.stringify(auditSummary)}`;

  const candidateModels = Array.from(
    new Set([
      preferredModel || 'gemini-3.8-flash',
      'gemini-3.1-flash-lite',
      'gemini-3-flash-preview',
      'gemini-2.5-flash'
    ])
  );

  let aiModelUsed = '';
  let lastAiError = '';

  for (const model of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model
      )}:generateContent?key=${encodeURIComponent(apiKey)}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: auditPrompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1
          }
        }),
        signal: AbortSignal.timeout(6000)
      });

      const data = await res.json().catch(() => null);
      const rawJsonText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (res.ok && rawJsonText) {
        aiModelUsed = model;
        try {
          const parsedAudit = JSON.parse(rawJsonText);
          if (Array.isArray(parsedAudit?.corrections) && parsedAudit.corrections.length > 0) {
            for (const corr of parsedAudit.corrections) {
              const targetCode = String(corr?.codigo || '').trim();
              const targetRec = localRecords.find(r => String(r.employee.codigo).trim() === targetCode);
              if (targetRec) {
                if (corr.nome && String(corr.nome).trim().length > 3) {
                  targetRec.employee.nome = String(corr.nome).trim().toUpperCase();
                }
                if (corr.cargo && String(corr.cargo).trim().length > 2) {
                  targetRec.employee.cargo = String(corr.cargo).trim().toUpperCase();
                }
              }
            }
          }
        } catch {}
        break;
      }

      lastAiError = data?.error?.message || `HTTP ${res.status}`;
    } catch (err: any) {
      lastAiError = err?.message || String(err);
    }
  }

  if (!aiModelUsed) {
    return {
      success: false,
      records: [],
      count: 0,
      engine: 'gemini',
      aiModelUsed: '',
      aiDurationMs: Date.now() - startTime,
      code: 'AI_AUTH_ERROR',
      message: `Falha ao autenticar no Google Gemini: ${lastAiError || 'Verifique sua Chave da API.'}`
    };
  }

  return {
    success: true,
    records: localRecords,
    count: localRecords.length,
    engine: 'gemini',
    aiModelUsed,
    aiDurationMs: Date.now() - startTime
  };
}
