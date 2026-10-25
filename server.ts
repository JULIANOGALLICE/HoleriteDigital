import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { parsePayrollText } from './src/utils/pdfParser';
import { parseIncomeReportText } from './src/utils/incomeReportParser';
import { PDFDocument } from 'pdf-lib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

const app = express();
app.use(express.json({ limit: '30mb' }));

// Helper to format detailed and friendly SMTP diagnostic messages
function formatMailError(error: any, config: any) {
  const errMsg = error?.message || String(error);
  const code = error?.code || 'SMTP_ERROR';
  const host = config?.smtpHost || 'Servidor SMTP';
  const port = parseInt(config?.smtpPort, 10) || 587;
  const isGmail =
    config?.emailProvider === 'GMAIL_APP' ||
    (config?.smtpHost && config.smtpHost.includes('gmail.com')) ||
    (config?.emailRemetente && config.emailRemetente.includes('gmail.com'));

  let friendlyMessage = errMsg;
  let advice = 'Verifique as configurações do servidor SMTP, usuário e senha.';

  // 1. Erro específico de SPF / MX / 550 5.7.1 (Comum em servidores próprios brasileiros como Locaweb, cPanel)
  if (
    errMsg.includes('550 5.7.1') ||
    errMsg.includes('Envio nao autorizado') ||
    errMsg.includes('Envio não autorizado') ||
    (errMsg.includes('550') && (errMsg.includes('SPF') || errMsg.includes('MX') || errMsg.includes('dominio') || errMsg.includes('domínio')))
  ) {
    friendlyMessage = 'Envio não autorizado pelo servidor SMTP: verifique o MX e o SPF do seu domínio (Erro 550 5.7.1).';
    advice =
      'O servidor SMTP corporativo (Locaweb, cPanel ou similar) recusou o comando de envio pelos seguintes motivos: 1) O "E-mail do Remetente" deve pertencer obrigatoriamente ao mesmo domínio da caixa postal autenticada (não use e-mails @gmail.com em servidor SMTP próprio). 2) Verifique se a entrada TXT de SPF (ex: "v=spf1 include:_spf.locaweb.com.br ~all") está configurada no DNS do seu domínio (no Registro.br ou cPanel). 3) Se usa Locaweb, prefira a porta 465 (com SSL) no host email-ssl.com.br.';
  } else if (
    code === 'EAUTH' ||
    errMsg.includes('535') ||
    errMsg.includes('Username and Password not accepted') ||
    errMsg.includes('BadCredentials')
  ) {
    if (isGmail) {
      friendlyMessage = 'Credenciais recusadas pelo Google Gmail (Erro 535 de Autenticação).';
      advice =
        'O Google não aceita senhas comuns de login para envio automatizado SMTP. É obrigatório criar uma "Senha de App" de 16 letras em myaccount.google.com/apppasswords (com verificação em 2 etapas ligada) e colá-la no campo Senha.';
    } else {
      friendlyMessage = `Usuário ou senha recusados pelo servidor SMTP ${host} (Erro 535).`;
      advice =
        'Verifique se o "Usuário SMTP" é o endereço de e-mail completo da sua caixa postal (ex: contato@seudominio.com.br) e se a senha do seu webmail/cPanel está digitada corretamente.';
    }
  } else if (code === 'ENOTFOUND' || errMsg.includes('getaddrinfo ENOTFOUND')) {
    friendlyMessage = `Servidor host de e-mail não encontrado: "${host}".`;
    advice =
      'O endereço do host SMTP informado não existe ou foi digitado com erro. Remova prefixos como "http://", barras ou espaços (ex: use apenas mail.seudominio.com.br, smtp.hostinger.com ou email-ssl.com.br).';
  } else if (code === 'ECONNREFUSED') {
    friendlyMessage = `Conexão recusada pelo servidor ${host} na porta ${port}.`;
    advice = `A porta ${port} está fechada no host ou o servidor não aceita conexões SMTP neste endereço. Tente alternar entre a porta 465 (com SSL) e 587 (com TLS/STARTTLS).`;
  } else if (code === 'ETIMEDOUT' || errMsg.includes('timeout') || errMsg.includes('Connection timeout')) {
    if (port === 25) {
      friendlyMessage = `Tempo limite esgotado ao conectar ao servidor ${host} na porta 25 (Connection timeout).`;
      advice = `A porta 25 é bloqueada por padrão em conexões de servidores na nuvem para proteção contra spam. Altere a porta para 465 (com SSL Direto) ou 587 (com TLS/STARTTLS).`;
    } else if (port === 465) {
      friendlyMessage = `Tempo limite esgotado ao conectar ao servidor ${host} na porta 465 (Connection timeout).`;
      advice = `O servidor SMTP não respondeu na porta 465 (SSL). Alterne a configuração para a Porta 587 (TLS / STARTTLS) no menu de configurações do e-mail e teste novamente.`;
    } else if (port === 587) {
      friendlyMessage = `Tempo limite esgotado ao conectar ao servidor ${host} na porta 587 (Connection timeout).`;
      advice = `O servidor SMTP não respondeu na porta 587 (TLS). Alterne a configuração para a Porta 465 (SSL Direto) no menu de configurações do e-mail e teste novamente.`;
    } else {
      friendlyMessage = `Tempo limite esgotado ao conectar ao servidor ${host}:${port} (Connection timeout).`;
      advice = `O servidor SMTP não respondeu dentro do prazo. Teste alternar a porta entre 587 (TLS) e 465 (SSL) e verifique se o host "${host}" está correto e acessível.`;
    }
  } else if (
    errMsg.includes('Greeting never received') ||
    errMsg.includes('wrong version number') ||
    code === 'ESOCKET' ||
    errMsg.includes('Client network socket disconnected')
  ) {
    friendlyMessage = `Incompatibilidade de protocolo SSL/TLS na porta ${port}.`;
    advice = `Na porta 587 o protocolo correto é STARTTLS (não SSL direto). Na porta 465 o protocolo é SSL direto. O sistema ajusta isso automaticamente agora, verifique se a porta coincide com a do seu provedor.`;
  } else if (
    errMsg.includes('550') ||
    errMsg.includes('553') ||
    code === 'EENVELOPE' ||
    errMsg.includes('Sender address rejected') ||
    errMsg.includes('Relay access denied')
  ) {
    friendlyMessage = 'Endereço de remetente ou envio rejeitado pelo servidor SMTP (Erro 550/553).';
    advice =
      'A maioria dos servidores próprios (Locaweb, cPanel, Hostinger) exige que o "E-mail do Remetente" seja EXATAMENTE o mesmo que o "Usuário SMTP" autenticado para evitar rejeição por anti-spoofing.';
  }

  return {
    friendlyMessage,
    advice,
    code,
    rawError: errMsg
  };
}

// Helper to create nodemailer transporter based on user configuration
async function createMailTransporter(config: any) {
  const provider = config?.emailProvider || 'SMTP';
  const rawPass = config?.smtpPassword || '';
  // Strip whitespace from passwords (Google displays App Passwords as 4-character blocks separated by spaces)
  const pass = rawPass.replace(/\s+/g, '');
  const user = (config?.smtpUser || config?.emailRemetente || '').trim();

  // 1. Ethereal Test Account (Zero-setup instant live email preview)
  if (provider === 'TESTE_LOCAL' || provider === 'ETHEREAL') {
    const testAccount = await nodemailer.createTestAccount();
    return {
      transporter: nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      }),
      isTestAccount: true
    };
  }

  // 2. Gmail / Google Workspace Transport
  if (provider === 'GMAIL_APP' || (!config?.smtpHost && config?.emailRemetente?.includes('gmail.com'))) {
    return {
      transporter: nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: user,
          pass: pass
        }
      }),
      isTestAccount: false
    };
  }

  // 3. Custom SMTP (Hostinger, Locaweb, cPanel, Cartório corporativo, AWS SES, SendGrid SMTP)
  const port = parseInt(config?.smtpPort, 10) || 587;
  // Port 465 is SSL direct (secure: true). Port 587, 25, 2525 use STARTTLS (secure: false).
  // In nodemailer, setting secure: true on port 587 causes handshake failure / timeout!
  let isSecure = port === 465;
  if (config?.smtpSecure !== undefined) {
    if (port === 587) {
      isSecure = false;
    } else if (port === 465) {
      isSecure = true;
    } else {
      isSecure = Boolean(config.smtpSecure);
    }
  }

  const cleanHost = (config?.smtpHost || 'smtp.cartoriouberaba.com.br').trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');

  const transportOptions: any = {
    host: cleanHost,
    port: port,
    secure: isSecure,
    connectionTimeout: 15000,
    greetingTimeout: 12000,
    socketTimeout: 20000,
    tls: {
      rejectUnauthorized: false,
      minVersion: 'TLSv1'
    }
  };

  if (user || pass) {
    transportOptions.auth = {
      user: user,
      pass: pass
    };
  }

  return {
    transporter: nodemailer.createTransport(transportOptions),
    isTestAccount: false
  };
}

// Config and database persistence on server disk
const CONFIG_FILE = path.resolve(__dirname, 'system-config.json');
const USERS_FILE = path.resolve(__dirname, 'users-data.json');
const EMPLOYEES_FILE = path.resolve(__dirname, 'employees-data.json');
const RECEIPTS_FILE = path.resolve(__dirname, 'receipts-data.json');

// 0. API: Get & Save System Configuration (Permanent Server-Side Storage)
app.get('/api/config', (_req, res) => {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const data = JSON.parse(content);
      return res.json({ success: true, config: data });
    }
  } catch (err: any) {
    console.error('Error reading system-config.json:', err);
  }
  return res.json({ success: true, config: null });
});

app.post('/api/config', (req, res) => {
  try {
    const config = req.body;
    if (config && typeof config === 'object') {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
      return res.json({ success: true, message: 'Configurações gravadas com sucesso no servidor.' });
    }
    return res.status(400).json({ success: false, message: 'Objeto de configuração inválido.' });
  } catch (err: any) {
    console.error('Error writing system-config.json:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// API: Servidor permanente de Usuários (Back-up no disco da VPS)
app.get('/api/users', (_req, res) => {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const content = fs.readFileSync(USERS_FILE, 'utf-8');
      const data = JSON.parse(content);
      return res.json({ success: true, users: Array.isArray(data) ? data : [] });
    }
  } catch (err: any) {
    console.error('Error reading users-data.json:', err);
  }
  return res.json({ success: true, users: [] });
});

app.post('/api/users', (req, res) => {
  try {
    const { users } = req.body;
    if (Array.isArray(users)) {
      fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
      return res.json({ success: true, message: 'Usuários gravados com sucesso no disco do servidor.' });
    }
    return res.status(400).json({ success: false, message: 'Array de usuários inválido.' });
  } catch (err: any) {
    console.error('Error writing users-data.json:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// API: Servidor permanente de Colaboradores (Back-up no disco da VPS)
app.get('/api/employees', (_req, res) => {
  try {
    if (fs.existsSync(EMPLOYEES_FILE)) {
      const content = fs.readFileSync(EMPLOYEES_FILE, 'utf-8');
      const data = JSON.parse(content);
      return res.json({ success: true, employees: Array.isArray(data) ? data : [] });
    }
  } catch (err: any) {
    console.error('Error reading employees-data.json:', err);
  }
  return res.json({ success: true, employees: [] });
});

app.post('/api/employees', (req, res) => {
  try {
    const { employees } = req.body;
    if (Array.isArray(employees)) {
      fs.writeFileSync(EMPLOYEES_FILE, JSON.stringify(employees, null, 2), 'utf-8');
      return res.json({ success: true, message: 'Colaboradores gravados com sucesso no disco do servidor.' });
    }
    return res.status(400).json({ success: false, message: 'Array de colaboradores inválido.' });
  } catch (err: any) {
    console.error('Error writing employees-data.json:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// API: Servidor permanente de Recibos/Holerites (Back-up no disco da VPS)
app.get('/api/receipts', (_req, res) => {
  try {
    if (fs.existsSync(RECEIPTS_FILE)) {
      const content = fs.readFileSync(RECEIPTS_FILE, 'utf-8');
      const data = JSON.parse(content);
      return res.json({ success: true, receipts: Array.isArray(data) ? data : [] });
    }
  } catch (err: any) {
    console.error('Error reading receipts-data.json:', err);
  }
  return res.json({ success: true, receipts: [] });
});

app.post('/api/receipts', (req, res) => {
  try {
    const { receipts } = req.body;
    if (Array.isArray(receipts)) {
      fs.writeFileSync(RECEIPTS_FILE, JSON.stringify(receipts, null, 2), 'utf-8');
      return res.json({ success: true, message: 'Recibos gravados com sucesso no disco do servidor.' });
    }
    return res.status(400).json({ success: false, message: 'Array de recibos inválido.' });
  } catch (err: any) {
    console.error('Error writing receipts-data.json:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// API: Extração de texto de PDF (Folha de Pagamento)
app.post('/api/extract-pdf-text', async (req, res) => {
  try {
    const { base64 } = req.body;
    if (!base64 || typeof base64 !== 'string') {
      return res.status(400).json({ success: false, message: 'Arquivo PDF não fornecido ou inválido.' });
    }

    const cleanBase64 = base64.replace(/^data:application\/pdf;base64,/, '').trim();
    const buffer = Buffer.from(cleanBase64, 'base64');

    if (buffer.length === 0) {
      return res.status(400).json({ success: false, message: 'O arquivo PDF está vazio.' });
    }

    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true
    });

    const doc = await loadingTask.promise;
    const numPages = doc.numPages;
    const pageTexts: string[] = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const content = await page.getTextContent();

      // Coleta todos os itens de texto com suas coordenadas X e Y
      const items: { str: string; x: number; y: number }[] = [];
      for (const item of content.items as any[]) {
        if (!item.str || !item.str.trim()) continue;
        items.push({
          str: item.str,
          x: item.transform[4],
          y: item.transform[5]
        });
      }

      // Ordena decrescente em Y (do topo para o rodapé da página)
      items.sort((a, b) => b.y - a.y);

      // Agrupa itens na mesma linha visual com tolerância de 3.5 pontos
      const lines: string[] = [];
      let currentLineItems: { str: string; x: number; y: number }[] = [];
      let currentLineY: number | null = null;

      for (const it of items) {
        if (currentLineY === null || Math.abs(currentLineY - it.y) <= 3.5) {
          currentLineItems.push(it);
          if (currentLineY === null) currentLineY = it.y;
        } else {
          currentLineItems.sort((a, b) => a.x - b.x);
          lines.push(currentLineItems.map(i => i.str).join(' '));
          currentLineItems = [it];
          currentLineY = it.y;
        }
      }
      if (currentLineItems.length > 0) {
        currentLineItems.sort((a, b) => a.x - b.x);
        lines.push(currentLineItems.map(i => i.str).join(' '));
      }

      pageTexts.push(`=== PAGE ${pageNum} ===\n` + lines.join('\n'));
    }

    return res.json({
      success: true,
      pagesCount: numPages,
      text: pageTexts.join('\n\n')
    });
  } catch (err: any) {
    console.error('Error extracting PDF text:', err);
    return res.status(500).json({
      success: false,
      message: `Erro ao extrair texto do PDF: ${err?.message || 'Arquivo corrompido ou formato não suportado'}`
    });
  }
});

// API: Processamento Inteligente de Folha com IA (Google Gemini)
app.post('/api/ai/parse-payroll', async (req, res) => {
  try {
    const { base64, text: providedText } = req.body;

    if (!base64 && !providedText) {
      return res.status(400).json({
        success: false,
        message: 'Arquivo PDF ou texto da folha não fornecido.'
      });
    }

    let extractedText = providedText || '';
    let cleanBase64 = '';

    if (base64) {
      cleanBase64 = base64.replace(/^data:application\/pdf;base64,/, '').trim();
      if (!extractedText) {
        try {
          const buffer = Buffer.from(cleanBase64, 'base64');
          const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
          const loadingTask = pdfjsLib.getDocument({
            data: new Uint8Array(buffer),
            useSystemFonts: true
          });
          const doc = await loadingTask.promise;
          const pageTexts: string[] = [];

          for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
            const page = await doc.getPage(pageNum);
            const content = await page.getTextContent();
            const items: { str: string; x: number; y: number }[] = [];
            for (const item of content.items as any[]) {
              if (!item.str || !item.str.trim()) continue;
              items.push({
                str: item.str,
                x: item.transform[4],
                y: item.transform[5]
              });
            }
            items.sort((a, b) => b.y - a.y);
            const lines: string[] = [];
            let currentLine: { str: string; x: number; y: number }[] = [];
            let curY: number | null = null;
            for (const it of items) {
              if (curY === null || Math.abs(curY - it.y) <= 3.5) {
                currentLine.push(it);
                if (curY === null) curY = it.y;
              } else {
                currentLine.sort((a, b) => a.x - b.x);
                lines.push(currentLine.map(i => i.str).join(' '));
                currentLine = [it];
                curY = it.y;
              }
            }
            if (currentLine.length > 0) {
              currentLine.sort((a, b) => a.x - b.x);
              lines.push(currentLine.map(i => i.str).join(' '));
            }
            pageTexts.push(`=== PÁGINA ${pageNum} ===\n` + lines.join('\n'));
          }
          extractedText = pageTexts.join('\n\n');
        } catch (pdfErr) {
          console.warn('Falha na pré-extração textual do PDF, enviando PDF binário para IA:', pdfErr);
        }
      }
    }

    const prompt = `Você é um auditor contábil e de departamento pessoal sênior especializado em folha de pagamento de Cartórios e empresas brasileiras.
Analise rigorosamente o documento fornecido e extraia TODOS os colaboradores e seus respectivos holerites com 100% de precisão e fidelidade ao arquivo original.
O documento possui múltiplas páginas (ex: 31 holerites). Em cada página há o holerite de um colaborador. Se houver duas vias do mesmo colaborador (empresa e empregado), consolide em 1 único registro para aquele colaborador.

Extraia TODOS os colaboradores do documento sem omitir nenhum.
Para cada colaborador, extraia:
- Código do colaborador (ex: '8', '22', '37', '31', '1', etc.)
- Nome completo oficial em MAIÚSCULAS
- Cargo exato (ex: 'ESCREVENTE I', 'AUXILIAR DE CARTÓRIO', 'ESCREVENTE SUBSTITUTA LEGAL', etc.)
- Código CBO (ex: '351405')
- Departamento (ex: '1' ou 'CARTÓRIO GERAL') e Filial (ex: '1')
- Data de admissão no formato DD/MM/AAAA
- Salário base (número)
- Sal. Contr. INSS, Base Calc FGTS, FGTS do Mês, Base Calc IRRF, Faixa IRRF
- Total de Vencimentos, Total de Descontos e Valor Líquido (números)
- Lista completa de todas as rubricas/itens (código, descrição, referência, vencimento ou desconto)

Retorne EXCLUSIVAMENTE um objeto JSON com o formato:
{
  "records": [
    {
      "employee": {
        "codigo": "string",
        "nome": "string",
        "cargo": "string",
        "cbo": "string",
        "departamento": "string",
        "filial": "string",
        "dataAdmissao": "DD/MM/AAAA",
        "salarioBase": 0
      },
      "receipt": {
        "competencia": "AAAA-MM",
        "mesAno": "Mês de AAAA",
        "tipoFolha": "Folha Mensal",
        "razaoSocial": "FRANCISCO JOSE BARBOSA NOBRE",
        "cei": "800136945806",
        "salarioBase": 0,
        "salContrINSS": 0,
        "baseCalcFGTS": 0,
        "fgtsDoMes": 0,
        "baseCalcIRRF": 0,
        "faixaIRRF": 0,
        "totalVencimentos": 0,
        "totalDescontos": 0,
        "valorLiquido": 0,
        "itens": [
          {
            "codigo": "string",
            "descricao": "string",
            "referencia": "string",
            "vencimento": 0,
            "desconto": null
          }
        ]
      }
    }
  ]
}

Documento a ser analisado:
${extractedText}`;

    // Executa extração local de alta precisão primeiro
    const localResult = parsePayrollText(extractedText);
    const localRecords = localResult.records || [];

    let rawList: any[] = [];
    let lastError: any = null;

    // Se a IA puder ser consultada para refinamento ou se a extração local estiver vazia
    try {
      const contents: any[] = [];
      if (!extractedText || extractedText.length < 150) {
        if (cleanBase64) {
          contents.push({
            inlineData: {
              mimeType: 'application/pdf',
              data: cleanBase64
            }
          });
        }
      }
      contents.push({ text: prompt });

      let rawJson = '';
      const models = ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];

      for (const model of models) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents,
            config: {
              responseMimeType: 'application/json'
            }
          });
          if (response && response.text) {
            rawJson = response.text;
            break;
          }
        } catch (err: any) {
          console.warn(`Model ${model} failed:`, err?.message || err);
          lastError = err;
        }
      }

      if (rawJson) {
        const parsedData = JSON.parse(rawJson);
        const aiList = Array.isArray(parsedData)
          ? parsedData
          : Array.isArray(parsedData.records)
          ? parsedData.records
          : [];
        // Se a IA retornou mais registros ou registros completos, usa a lista da IA
        if (aiList.length >= localRecords.length && aiList.length > 0) {
          rawList = aiList;
        }
      }
    } catch (aiErr) {
      console.warn('Erro ao chamar IA, utilizando leitor de precisão:', aiErr);
    }

    // Se a IA retornou vazio ou apenas 1 registro quando o documento tem múltiplos colaboradores,
    // garantimos a integridade de todos os 31 colaboradores utilizando a extração local fiel!
    if (rawList.length < localRecords.length && localRecords.length > 0) {
      return res.json({
        success: true,
        records: localRecords,
        count: localRecords.length,
        engine: 'hybrid-precision'
      });
    }

    const formattedRecords: any[] = [];
    const seenCodigos = new Set<string>();

    for (let i = 0; i < rawList.length; i++) {
      const item = rawList[i];
      const emp = item.employee || item.colaborador || {};
      const rec = item.receipt || item.holerite || item.folha || {};

      const codigo = String(emp.codigo || emp.matricula || i + 1).trim();
      const nome = String(emp.nome || `COLABORADOR ${codigo}`).trim().toUpperCase();

      if (seenCodigos.has(codigo)) continue;
      seenCodigos.add(codigo);

      const competencia = rec.competencia || '2026-09';
      const mesAno = rec.mesAno || 'Setembro de 2026';
      const parseNum = (val: any): number => {
        if (typeof val === 'number') return isNaN(val) ? 0 : val;
        if (!val) return 0;
        const s = String(val).trim();
        if (s.includes(',')) {
          const n = parseFloat(s.replace(/\./g, '').replace(',', '.'));
          return isNaN(n) ? 0 : n;
        }
        const n = parseFloat(s);
        return isNaN(n) ? 0 : n;
      };

      const parseItemVal = (val: any): number | null => {
        if (val === null || val === undefined) return null;
        const n = parseNum(val);
        return n > 0 ? n : null;
      };

      const salarioBase = parseNum(emp.salarioBase || rec.salarioBase) || 2000;
      let totalVenc = parseNum(rec.totalVencimentos);
      let totalDesc = parseNum(rec.totalDescontos);
      let valorLiq = parseNum(rec.valorLiquido);

      const rawItens = Array.isArray(rec.itens) ? rec.itens : Array.isArray(rec.rubricas) ? rec.rubricas : [];
      const seenItemKeys = new Set<string>();
      const itens: any[] = [];

      for (const it of rawItens) {
        const rawCode = String(it.codigo || '1').trim();
        const rawDesc = String(it.descricao || 'EVENTO').trim();
        const key = `${rawCode}|${rawDesc.toUpperCase()}`;
        if (seenItemKeys.has(key)) continue;
        seenItemKeys.add(key);

        const vVal = parseItemVal(it.vencimento ?? it.vencimentos ?? (it.tipo === 'PROVENTO' || it.tipo === 'VENCIMENTO' ? it.valor : null));
        const dVal = parseItemVal(it.desconto ?? it.descontos ?? it.valorDesconto ?? (it.tipo === 'DESCONTO' ? it.valor : null));

        itens.push({
          codigo: rawCode,
          descricao: rawDesc,
          referencia: String(it.referencia || ''),
          vencimento: vVal,
          desconto: dVal
        });
      }

      if (!totalDesc && itens.length > 0) {
        totalDesc = +itens.reduce((acc, it) => acc + (it.desconto || 0), 0).toFixed(2);
      }
      if (!totalVenc && itens.length > 0) {
        totalVenc = +itens.reduce((acc, it) => acc + (it.vencimento || 0), 0).toFixed(2);
      }
      if (!totalVenc) totalVenc = salarioBase;
      if (!valorLiq) valorLiq = +(totalVenc - totalDesc).toFixed(2);

      if (itens.length === 0) {
        itens.push({
          codigo: '1',
          descricao: 'HORAS NORMAIS',
          referencia: '220:00',
          vencimento: salarioBase,
          desconto: null
        });
        if (totalDesc > 0) {
          itens.push({
            codigo: '998',
            descricao: 'I.N.S.S.',
            referencia: '8,50',
            vencimento: null,
            desconto: totalDesc
          });
        }
      }

      formattedRecords.push({
        employee: {
          codigo,
          nome,
          cargo: emp.cargo || 'ESCREVENTE',
          cbo: String(emp.cbo || '351405').replace('-', ''),
          departamento: emp.departamento || 'CARTÓRIO GERAL',
          filial: String(emp.filial || '1'),
          dataAdmissao: emp.dataAdmissao || '02/03/2023',
          salarioBase
        },
        receipt: {
          id: `rec-${codigo}-${competencia}`,
          employeeCodigo: codigo,
          competencia,
          mesAno,
          tipoFolha: 'Folha Mensal',
          empregador: {
            razaoSocial: rec.razaoSocial || 'FRANCISCO JOSE BARBOSA NOBRE',
            cei: rec.cei || '800136945806',
            centroCusto: 'GERAL',
            regime: 'Mensalista'
          },
          salarioBase,
          salContrINSS: Number(rec.salContrINSS) || salarioBase,
          baseCalcFGTS: Number(rec.baseCalcFGTS) || salarioBase,
          fgtsDoMes: Number(rec.fgtsDoMes) || +(salarioBase * 0.08).toFixed(2),
          baseCalcIRRF: Number(rec.baseCalcIRRF) || salarioBase,
          faixaIRRF: Number(rec.faixaIRRF) || 0,
          totalVencimentos: totalVenc,
          totalDescontos: totalDesc,
          valorLiquido: valorLiq,
          dataEmissao: '30/09/2026',
          statusAssinatura: 'PENDENTE',
          historicoEnvios: [],
          itens
        }
      });
    }

    return res.json({
      success: true,
      records: formattedRecords,
      count: formattedRecords.length,
      engine: 'gemini'
    });
  } catch (err: any) {
    console.error('Error in /api/ai/parse-payroll:', err);
    return res.status(500).json({
      success: false,
      message: `Erro no processamento com IA: ${err?.message || 'Falha ao analisar a folha com IA'}`
    });
  }
});

// Diretório para armazenamento dos informes divididos
const IRPF_DIR = path.join(__dirname, 'data', 'irpf_reports');
if (!fs.existsSync(IRPF_DIR)) {
  fs.mkdirSync(IRPF_DIR, { recursive: true });
}

// API: Processamento e Divisão de Comprovantes de Rendimentos (IRPF) por Usuário
app.post('/api/ai/parse-income-report', async (req, res) => {
  try {
    const { base64, text: providedText, employees: employeeList = [], useAi = true } = req.body;

    if (!base64 && !providedText) {
      return res.status(400).json({
        success: false,
        message: 'Arquivo PDF ou texto do informe não fornecido.'
      });
    }

    let allReports: any[] = [];
    const errors: string[] = [];

    const cleanDigits = (s?: string) => (s || '').replace(/\D/g, '');
    const norm = (s?: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

    if (base64) {
      const cleanBase64 = base64.replace(/^data:application\/pdf;base64,/, '').trim();
      const buffer = Buffer.from(cleanBase64, 'base64');

      // 1. Carrega documento original com pdf-lib para divisão fiel de páginas sem compressão destrutiva
      const srcPdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const totalPages = srcPdfDoc.getPageCount();

      // 2. Carrega documento com pdfjs-dist para extração precisa de texto por coordenadas visuais
      const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
        useSystemFonts: true
      });
      const doc = await loadingTask.promise;

      // Lista para armazenar cada página processada e seu respectivo beneficiário identificado
      interface PageAnalysis {
        pageIndex: number;
        pageNum: number;
        pageText: string;
        report: any | null;
        isNewEmployee: boolean;
        beneficiaryKey: string;
      }

      const pageAnalyses: PageAnalysis[] = [];

      for (let pIdx = 0; pIdx < totalPages; pIdx++) {
        const pageNum = pIdx + 1;
        try {
          const page = await doc.getPage(pageNum);
          const content = await page.getTextContent();
          const items: { str: string; x: number; y: number }[] = [];
          for (const item of content.items as any[]) {
            if (!item.str || !item.str.trim()) continue;
            items.push({
              str: item.str,
              x: item.transform[4],
              y: item.transform[5]
            });
          }
          items.sort((a, b) => b.y - a.y);
          const lines: string[] = [];
          let currentLine: { str: string; x: number; y: number }[] = [];
          let curY: number | null = null;
          for (const it of items) {
            if (curY === null || Math.abs(curY - it.y) <= 3.5) {
              currentLine.push(it);
              if (curY === null) curY = it.y;
            } else {
              currentLine.sort((a, b) => a.x - b.x);
              lines.push(currentLine.map(i => i.str).join(' '));
              currentLine = [it];
              curY = it.y;
            }
          }
          if (currentLine.length > 0) {
            currentLine.sort((a, b) => a.x - b.x);
            lines.push(currentLine.map(i => i.str).join(' '));
          }
          const pageText = `=== PÁGINA ${pageNum} ===\n` + lines.join('\n');

          // Identificação primária via parser de layout
          const { reports: parsedReports } = parseIncomeReportText(pageText);
          let pageReport = parsedReports && parsedReports.length > 0 ? parsedReports[0] : null;

          // Se o parser não identificou o nome ou se precisa de refinamento dos valores via IA
          const hasIdentifiedName = pageReport?.beneficiario?.nomeCompleto &&
            !pageReport.beneficiario.nomeCompleto.startsWith('COLABORADOR') &&
            pageReport.beneficiario.nomeCompleto.trim().length > 4;

          const needsAiEnrichment = !hasIdentifiedName || !pageReport ||
            pageReport.tributacaoExclusiva.decimoTerceiroSalario === 0 ||
            pageReport.rendimentosTributaveis.totalRendimentos === 0;

          if (needsAiEnrichment && useAi) {
            try {
              const empSample = (employeeList || [])
                .slice(0, 40)
                .map((e: any) => `• ${e.nome} (Código: ${e.codigo}, CPF: ${e.cpf})`)
                .join('\n');

              const aiPrompt = `Você é um auditor contábil especialista em DIRF e Comprovantes de Rendimentos da Receita Federal (IRPF).
Analise o texto desta página ${pageNum} de ${totalPages} de um documento oficial da Receita Federal.
Identifique com precisão o NOME DO BENEFICIÁRIO (Quadro 2), CPF, Código e os Valores dos Rendimentos e Retenções.

REGRAS DE VALIDAÇÃO ESSENCIAIS (MUITO IMPORTANTE):
1. IMPOSTO RETIDO NA FONTE (impostoRetidoFonte):
   - Localiza-se no Quadro 3, item 5: "Imposto sobre a renda retido na fonte".
   - CUIDADO: NUNCA coloque "2026" ou o ano como imposto retido! "2026" é apenas o ano de exercício no cabeçalho do documento.
   - Se o item 5 estiver zerado, com traço ou for 0,00, retorne 0.
   - Retorne o valor monetário real em reais (ex: 0, 154.20, 1250.00).

2. 13º SALÁRIO (decimoTerceiroSalario):
   - Localiza-se no Quadro 5, item 1: "13º salário".
   - CUIDADO: NUNCA retorne 2 ou 2.00! O dígito "2" que aparece antes de "2. Imposto sobre..." é o número do item, NUNCA o valor do 13º salário!
   - O 13º salário é um valor monetário de remuneração (ex: 3500.00, 4850.50, ou 0 se não houver).

3. IRRF SOBRE 13º SALÁRIO (irrfDecimoTerceiro):
   - Localiza-se no Quadro 5, item 2: "Imposto sobre a renda retido na fonte sobre 13º salário".
   - Se estiver zerado ou em branco, retorne 0.

4. RENDIMENTOS TRIBUTÁVEIS (totalRendimentos):
   - Item 1 do Quadro 3 ("Total dos rendimentos (inclusive férias)").

5. PREVIDÊNCIA OFICIAL (contribuicaoPrevidenciaria):
   - Item 2 do Quadro 3 ("Contribuição previdenciária oficial").

Colaboradores cadastrados na empresa para correspondência exata de nome e código:
${empSample}

Retorne ESTRITAMENTE um objeto JSON:
{
  "nomeCompleto": "NOME DO BENEFICIÁRIO EM MAIÚSCULAS",
  "cpf": "000.000.000-00",
  "codigo": "código se informado",
  "anoCalendario": "2025",
  "exercicio": "2026",
  "cnpjFonte": "461.946.067-20",
  "nomeFonte": "FRANCISCO JOSE BARBOSA NOBRE",
  "totalRendimentos": 0,
  "contribuicaoPrevidenciaria": 0,
  "impostoRetidoFonte": 0,
  "decimoTerceiroSalario": 0,
  "irrfDecimoTerceiro": 0,
  "responsavelNome": "PEDRO RAFAEL DA SILVEIRA",
  "responsavelData": "13/02/2026"
}

Texto da página:
${pageText}`;

              const aiRes = await ai.models.generateContent({
                model: 'gemini-3.1-flash-lite',
                contents: [{ text: aiPrompt }],
                config: { responseMimeType: 'application/json' }
              });

              if (aiRes && aiRes.text) {
                const aiData = JSON.parse(aiRes.text);
                const empCod = String(aiData.codigo || pageNum);
                const anoCal = String(aiData.anoCalendario || '2025');

                const rawAiIrrf = Number(aiData.impostoRetidoFonte) || 0;
                const safeAiIrrf = (rawAiIrrf === 2026 || rawAiIrrf === 2025) ? 0 : rawAiIrrf;

                const rawAi13 = Number(aiData.decimoTerceiroSalario) || 0;
                const safeAi13 = (rawAi13 <= 3) ? 0 : rawAi13;

                const rawAiIrrf13 = Number(aiData.irrfDecimoTerceiro) || 0;
                const safeAiIrrf13 = (rawAiIrrf13 <= 3) ? 0 : rawAiIrrf13;

                if (pageReport) {
                  // Enriquece os dados existentes do layout parser com os valores da IA se mais precisos
                  if (pageReport.tributacaoExclusiva.decimoTerceiroSalario === 0 && safeAi13 > 0) {
                    pageReport.tributacaoExclusiva.decimoTerceiroSalario = safeAi13;
                  }
                  if (pageReport.tributacaoExclusiva.irrfDecimoTerceiro === 0 && safeAiIrrf13 > 0) {
                    pageReport.tributacaoExclusiva.irrfDecimoTerceiro = safeAiIrrf13;
                  }
                  if (pageReport.rendimentosTributaveis.totalRendimentos === 0 && Number(aiData.totalRendimentos) > 0) {
                    pageReport.rendimentosTributaveis.totalRendimentos = Number(aiData.totalRendimentos);
                  }
                  if (pageReport.rendimentosTributaveis.contribuicaoPrevidenciaria === 0 && Number(aiData.contribuicaoPrevidenciaria) > 0) {
                    pageReport.rendimentosTributaveis.contribuicaoPrevidenciaria = Number(aiData.contribuicaoPrevidenciaria);
                  }
                  if (pageReport.rendimentosTributaveis.impostoRetidoFonte === 0 && safeAiIrrf > 0) {
                    pageReport.rendimentosTributaveis.impostoRetidoFonte = safeAiIrrf;
                  }
                } else {
                  pageReport = {
                    id: `irpf-${empCod}-${anoCal}`,
                    exercicio: String(aiData.exercicio || '2026'),
                    anoCalendario: anoCal,
                    fontePagadora: {
                      cnpjCpf: aiData.cnpjFonte || '461.946.067-20',
                      nomeEmpresarial: aiData.nomeFonte || 'FRANCISCO JOSE BARBOSA NOBRE'
                    },
                    beneficiario: {
                      cpf: aiData.cpf || '000.000.000-00',
                      nomeCompleto: (aiData.nomeCompleto || `COLABORADOR ${empCod}`).toUpperCase(),
                      employeeCodigo: empCod,
                      naturezaRendimento: 'RENDIMENTO DO TRABALHO ASSALARIADO NO PAÍS'
                    },
                    rendimentosTributaveis: {
                      totalRendimentos: Number(aiData.totalRendimentos) || 0,
                      contribuicaoPrevidenciaria: Number(aiData.contribuicaoPrevidenciaria) || 0,
                      previdenciaComplementar: 0,
                      pensaoAlimenticia: 0,
                      impostoRetidoFonte: safeAiIrrf
                    },
                    rendimentosIsentos: {
                      parcelaIsentaAposentadoria: 0,
                      parcelaIsenta13Aposentadoria: 0,
                      diariasAjudaCusto: 0,
                      pensaoMolestiaGrave: 0,
                      lucrosDividendos: 0,
                      valoresPagosSocio: 0,
                      indenizacoesRescisao: 0,
                      jurosMora: 0,
                      outrosValor: 0
                    },
                    tributacaoExclusiva: {
                      decimoTerceiroSalario: safeAi13,
                      irrfDecimoTerceiro: safeAiIrrf13,
                      outros: 0
                    },
                    responsavel: {
                      nome: aiData.responsavelNome || 'PEDRO RAFAEL DA SILVEIRA',
                      data: aiData.responsavelData || '13/02/2026'
                    },
                    criadoEm: new Date().toISOString()
                  };
                }
              }
            } catch (aiErr) {
              console.warn(`IA falhou na identificação da página ${pageNum}:`, aiErr);
            }
          }

          // Validação final estrita de sanidade dos dados em todos os relatórios
          if (pageReport) {
            if (
              pageReport.rendimentosTributaveis.impostoRetidoFonte === 2026 ||
              pageReport.rendimentosTributaveis.impostoRetidoFonte === 2025 ||
              pageReport.rendimentosTributaveis.impostoRetidoFonte === Number(pageReport.exercicio) ||
              pageReport.rendimentosTributaveis.impostoRetidoFonte === Number(pageReport.anoCalendario)
            ) {
              pageReport.rendimentosTributaveis.impostoRetidoFonte = 0;
            }
            if (
              pageReport.tributacaoExclusiva.decimoTerceiroSalario === 1 ||
              pageReport.tributacaoExclusiva.decimoTerceiroSalario === 2 ||
              pageReport.tributacaoExclusiva.decimoTerceiroSalario === 3
            ) {
              pageReport.tributacaoExclusiva.decimoTerceiroSalario = 0;
            }
            if (
              pageReport.tributacaoExclusiva.irrfDecimoTerceiro === 1 ||
              pageReport.tributacaoExclusiva.irrfDecimoTerceiro === 2 ||
              pageReport.tributacaoExclusiva.irrfDecimoTerceiro === 3
            ) {
              pageReport.tributacaoExclusiva.irrfDecimoTerceiro = 0;
            }
          }

          // Cruzamento e correspondência com a lista de colaboradores cadastrados
          if (pageReport) {
            const rawName = pageReport.beneficiario.nomeCompleto;
            const rawCpf = pageReport.beneficiario.cpf;
            const rawCod = pageReport.beneficiario.employeeCodigo;

            const matched = employeeList.find((e: any) => {
              if (cleanDigits(e.cpf) && cleanDigits(rawCpf) && cleanDigits(e.cpf) === cleanDigits(rawCpf)) return true;
              if (e.nome && rawName) {
                const n1 = norm(e.nome);
                const n2 = norm(rawName);
                if (n1 === n2 || (n1.length > 5 && (n1.includes(n2) || n2.includes(n1)))) return true;
              }
              if (e.codigo && rawCod && String(e.codigo).padStart(6, '0') === String(rawCod).padStart(6, '0')) return true;
              return false;
            });

            if (matched) {
              pageReport.beneficiario.employeeCodigo = String(matched.codigo);
              pageReport.beneficiario.nomeCompleto = matched.nome;
              if (matched.cpf) pageReport.beneficiario.cpf = matched.cpf;
              pageReport.id = `irpf-${matched.codigo}-${pageReport.anoCalendario}`;
            }

            const isNew = Boolean(
              pageText.includes('Fonte Pagadora') ||
              pageText.includes('Pessoa Física Beneficiária') ||
              pageText.includes('1. Total dos rendimentos') ||
              pageText.includes('COMPROVANTE DE RENDIMENTOS')
            );

            const key = cleanDigits(pageReport.beneficiario.cpf) || norm(pageReport.beneficiario.nomeCompleto) || pageReport.beneficiario.employeeCodigo;

            pageAnalyses.push({
              pageIndex: pIdx,
              pageNum,
              pageText,
              report: pageReport,
              isNewEmployee: isNew,
              beneficiaryKey: key
            });
          }
        } catch (pageErr: any) {
          errors.push(`Erro ao analisar página ${pageNum}: ${pageErr?.message}`);
        }
      }

      // Agrupamento de páginas por colaborador (para relatórios de 1 ou múltiplas páginas por pessoa)
      interface EmployeeGroup {
        report: any;
        pageIndices: number[];
      }

      const employeeGroups: EmployeeGroup[] = [];

      for (const pa of pageAnalyses) {
        if (!pa.report) continue;

        // Verifica se a página atual pertence ao mesmo colaborador do grupo anterior
        const lastGroup = employeeGroups[employeeGroups.length - 1];
        const isSameBeneficiary = lastGroup && (
          (cleanDigits(lastGroup.report.beneficiario.cpf) && cleanDigits(lastGroup.report.beneficiario.cpf) === cleanDigits(pa.report.beneficiario.cpf)) ||
          (norm(lastGroup.report.beneficiario.nomeCompleto) && norm(lastGroup.report.beneficiario.nomeCompleto) === norm(pa.report.beneficiario.nomeCompleto)) ||
          (lastGroup.report.beneficiario.employeeCodigo === pa.report.beneficiario.employeeCodigo)
        );

        if (isSameBeneficiary && !pa.isNewEmployee) {
          // É uma continuação da página do mesmo colaborador
          lastGroup.pageIndices.push(pa.pageIndex);
        } else {
          // Novo colaborador
          employeeGroups.push({
            report: pa.report,
            pageIndices: [pa.pageIndex]
          });
        }
      }

      // Agora divide o PDF original de alta fidelidade para cada colaborador
      for (const group of employeeGroups) {
        try {
          const singleDoc = await PDFDocument.create();
          const copiedPages = await singleDoc.copyPages(srcPdfDoc, group.pageIndices);
          for (const cp of copiedPages) {
            singleDoc.addPage(cp);
          }
          const singleBytes = await singleDoc.save();
          const singleBase64 = Buffer.from(singleBytes).toString('base64');
          const singleDataUrl = `data:application/pdf;base64,${singleBase64}`;

          const rep = group.report;
          const safeName = rep.beneficiario.nomeCompleto.replace(/\s+/g, '_');
          const fileName = `Informe_IRPF_${safeName}_${rep.anoCalendario}.pdf`;

          rep.arquivoPdfOriginal = {
            nomeArquivo: fileName,
            base64: singleDataUrl,
            numeroPaginaOrigem: group.pageIndices.map(i => i + 1).join(', '),
            totalPaginasOrigem: totalPages
          };

          // Salva no disco do servidor para download direto e backup
          try {
            const diskFile = path.join(IRPF_DIR, `${rep.id}.pdf`);
            fs.writeFileSync(diskFile, singleBytes);
          } catch (diskErr) {
            console.warn('Falha ao gravar cópia em disco do informe:', diskErr);
          }

          allReports.push(rep);
        } catch (splitErr: any) {
          errors.push(`Erro ao dividir PDF para ${group.report.beneficiario.nomeCompleto}: ${splitErr?.message}`);
        }
      }
    } else if (providedText) {
      const { reports: parsed, errors: errs } = parseIncomeReportText(providedText);
      allReports = parsed;
      errors.push(...errs);
    }

    return res.json({
      success: true,
      reports: allReports,
      count: allReports.length,
      errors
    });
  } catch (err: any) {
    console.error('Error in /api/ai/parse-income-report:', err);
    return res.status(500).json({
      success: false,
      message: `Erro ao processar e dividir informes de rendimentos: ${err?.message || 'Falha no processamento'}`
    });
  }
});

// API: Download direto do arquivo PDF original dividido de um informe
app.get('/api/income-reports/:id/pdf', (req, res) => {
  try {
    const id = req.params.id;
    const safeId = id.replace(/[^a-zA-Z0-9_\-]/g, '');
    const filePath = path.join(IRPF_DIR, `${safeId}.pdf`);

    if (fs.existsSync(filePath)) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="Informe_${safeId}.pdf"`);
      return res.sendFile(filePath);
    }

    return res.status(404).json({ success: false, message: 'Arquivo PDF original não encontrado no servidor.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message });
  }
});

// 1. API: Test SMTP Connection & Send Test Email
app.post('/api/email/test', async (req, res) => {
  try {
    const { config, to } = req.body;

    if (!config) {
      return res.status(400).json({
        success: false,
        message: 'Configurações de e-mail não fornecidas.'
      });
    }

    const recipient = (to || config.emailRemetente || config.smtpUser || '').trim();
    if (!recipient) {
      return res.status(400).json({
        success: false,
        message: 'E-mail destinatário para teste não informado.'
      });
    }

    const isTestMode = config.emailProvider === 'TESTE_LOCAL' || config.emailProvider === 'ETHEREAL';

    if (!isTestMode && !config.smtpPassword) {
      return res.status(400).json({
        success: false,
        code: 'MISSING_PASSWORD',
        message: 'A senha do e-mail / senha de app SMTP não foi informada nas configurações.',
        details: 'Preencha o campo de senha no formulário de configurações do e-mail e clique em salvar.'
      });
    }

    const { transporter, isTestAccount } = await createMailTransporter(config);

    // Verify SMTP connection credentials
    await transporter.verify();

    // Prepare sender details
    const senderName = config.emailNomeRemetente || 'HoleriteDigital';
    const smtpUser = (config.smtpUser || '').trim();
    let senderEmail = (config.emailRemetente || smtpUser || 'rh@cartorionobre.com.br').trim();

    // In custom SMTP, if user logged into their corporate mailbox (e.g. usuario@cartorio.com.br)
    // but the sender was left as an external domain (@gmail.com), the SMTP server will reject with
    // 550 5.7.1 Envio não autorizado - Verifique o MX e/ou SPF.
    // We safeguard this by using smtpUser for the SMTP transaction while keeping replyTo intact!
    const isCustomSmtp = config.emailProvider === 'SMTP' && !config.smtpHost?.includes('gmail.com');
    if (isCustomSmtp && smtpUser.includes('@')) {
      const smtpUserDomain = smtpUser.split('@')[1]?.toLowerCase();
      const senderDomain = senderEmail.split('@')[1]?.toLowerCase();
      if (senderDomain !== smtpUserDomain) {
        senderEmail = smtpUser;
      }
    }

    const envelopeFrom = (smtpUser.includes('@') ? smtpUser : senderEmail);

    const info = await transporter.sendMail({
      from: `"${senderName}" <${senderEmail}>`,
      to: recipient,
      replyTo: config.emailReplyTo || config.emailRemetente || senderEmail,
      envelope: {
        from: envelopeFrom,
        to: recipient
      },
      subject: '✅ [Teste de Conexão] Servidor de E-mail HoleriteDigital',
      text: `Olá!\n\nEste é um e-mail de teste disparado pelo sistema HoleriteDigital.\nSe você está lendo esta mensagem, o servidor de e-mail (${config.smtpHost || 'Gmail'}) foi autenticado com sucesso e está pronto para o envio real de holerites e códigos de assinatura.\n\nData do teste: ${new Date().toLocaleString('pt-BR')}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden;">
          <div style="background-color: #0f172a; padding: 20px; text-align: center; color: #ffffff;">
            <h2 style="margin: 0; font-size: 18px;">HoleriteDigital • Cartório & RH</h2>
            <p style="margin: 4px 0 0; font-size: 12px; color: #94a3b8;">Verificação de Conexão SMTP</p>
          </div>
          <div style="padding: 24px; color: #334155;">
            <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 14px; margin-bottom: 16px;">
              <strong style="color: #065f46; font-size: 14px;">✅ Conexão SMTP Estabelecida com Sucesso!</strong>
              <p style="margin: 6px 0 0; color: #047857; font-size: 12px;">
                O servidor de e-mail respondeu positivamente e autenticou suas credenciais.
              </p>
            </div>
            <table style="width: 100%; font-size: 13px; color: #475569; margin-top: 12px;">
              <tr>
                <td style="padding: 4px 0;"><strong>Servidor Host:</strong></td>
                <td>${isTestAccount ? 'Ethereal Test Mail Server' : (config.smtpHost || 'SMTP')}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0;"><strong>Porta:</strong></td>
                <td>${config.smtpPort || 587}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0;"><strong>Remetente:</strong></td>
                <td>${senderEmail}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0;"><strong>Destinatário de Teste:</strong></td>
                <td>${recipient}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0;"><strong>Data / Hora:</strong></td>
                <td>${new Date().toLocaleString('pt-BR')}</td>
              </tr>
            </table>
          </div>
          <div style="background-color: #f8fafc; padding: 12px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0;">
            Mensagem gerada pelo painel administrativo do Departamento Pessoal.
          </div>
        </div>
      `
    });

    const previewUrl = isTestAccount ? (nodemailer.getTestMessageUrl(info) || undefined) : undefined;

    return res.json({
      success: true,
      messageId: info.messageId,
      previewUrl: previewUrl,
      message: isTestAccount
        ? `E-mail de teste gerado com sucesso no servidor de visualização!`
        : `E-mail de teste enviado com sucesso para ${recipient}!`
    });
  } catch (error: any) {
    console.error('SMTP Test Error: ', error);
    const { friendlyMessage, advice, code, rawError } = formatMailError(error, req.body?.config);

    return res.status(500).json({
      success: false,
      code,
      message: friendlyMessage,
      details: advice,
      rawError
    });
  }
});

// 2. API: Send Real Paystub Email with optional PDF Attachment
app.post('/api/email/send', async (req, res) => {
  try {
    const { config, to, subject, html, text, pdfBase64, filename } = req.body;

    if (!to || !config) {
      return res.status(400).json({
        success: false,
        message: 'Destinatário e configurações de e-mail são obrigatórios.'
      });
    }

    const isTestMode = config.emailProvider === 'TESTE_LOCAL' || config.emailProvider === 'ETHEREAL';

    if (!isTestMode && !config.smtpPassword) {
      return res.status(400).json({
        success: false,
        code: 'MISSING_PASSWORD',
        message: 'A senha do e-mail SMTP não está preenchida nas Configurações do Sistema.',
        details: 'Acesse o menu "Configurações de E-mail" e preencha sua senha SMTP ou Senha de App do Gmail.'
      });
    }

    const { transporter, isTestAccount } = await createMailTransporter(config);
    const senderName = config.emailNomeRemetente || 'Departamento Pessoal';
    const smtpUser = (config.smtpUser || '').trim();
    let senderEmail = (config.emailRemetente || smtpUser || 'rh@cartorionobre.com.br').trim();

    // In custom SMTP, prevent 550 5.7.1 Envio não autorizado by aligning senderEmail with the authenticated mailbox domain
    const isCustomSmtp = config.emailProvider === 'SMTP' && !config.smtpHost?.includes('gmail.com');
    if (isCustomSmtp && smtpUser.includes('@')) {
      const smtpUserDomain = smtpUser.split('@')[1]?.toLowerCase();
      const senderDomain = senderEmail.split('@')[1]?.toLowerCase();
      if (senderDomain !== smtpUserDomain) {
        senderEmail = smtpUser;
      }
    }

    const envelopeFrom = (smtpUser.includes('@') ? smtpUser : senderEmail);

    const mailOptions: any = {
      from: `"${senderName}" <${senderEmail}>`,
      to: to,
      replyTo: config.emailReplyTo || config.emailRemetente || senderEmail,
      envelope: {
        from: envelopeFrom,
        to: to
      },
      subject: subject || 'Recibo de Pagamento - HoleriteDigital',
      text: text || 'Seu recibo de pagamento está disponível em anexo.',
      html: html
    };

    // Attach PDF if provided in base64
    if (pdfBase64) {
      const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, '');
      mailOptions.attachments = [
        {
          filename: filename || 'Holerite.pdf',
          content: Buffer.from(cleanBase64, 'base64'),
          contentType: 'application/pdf'
        }
      ];
    }

    const info = await transporter.sendMail(mailOptions);
    const previewUrl = isTestAccount ? (nodemailer.getTestMessageUrl(info) || undefined) : undefined;

    return res.json({
      success: true,
      messageId: info.messageId,
      previewUrl: previewUrl,
      message: isTestAccount
        ? `Holerite disparado com sucesso para a caixa de teste!`
        : `Holerite enviado com sucesso para ${to}!`
    });
  } catch (error: any) {
    console.error('Email Send Error: ', error);
    const { friendlyMessage, advice, code, rawError } = formatMailError(error, req.body?.config);

    return res.status(500).json({
      success: false,
      code,
      message: friendlyMessage,
      details: advice,
      rawError
    });
  }
});

// ==========================================
// EVOLUTION API - WHATSAPP INTEGRATION ROUTES
// ==========================================

function cleanEvolutionUrl(rawUrl?: string): string {
  if (!rawUrl) return '';
  return String(rawUrl)
    .trim()
    .replace(/\/+(manager|dashboard|app|login)(\/.*)?$/i, '')
    .replace(/\/+$/, '');
}

async function parseEvolutionHttpResponse(resp: Response): Promise<{ isHtml: boolean; data: any; rawText: string }> {
  const rawText = await resp.text().catch(() => '');
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

// 1. Check Evolution API Instance Status & Connection
app.post('/api/whatsapp/status', async (req, res) => {
  try {
    const { evolutionApiUrl, evolutionApiKey, evolutionInstance } = req.body;
    if (!evolutionApiUrl || !evolutionApiKey || !evolutionInstance) {
      return res.status(400).json({
        success: false,
        connected: false,
        message: 'URL da Evolution API, Chave API e Nome da Instância são obrigatórios.'
      });
    }

    const baseUrl = cleanEvolutionUrl(evolutionApiUrl);
    const cleanInstance = encodeURIComponent(evolutionInstance.trim());
    const targetUrl = `${baseUrl}/instance/connectionState/${cleanInstance}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const resp = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'apikey': evolutionApiKey.trim()
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const { isHtml, data } = await parseEvolutionHttpResponse(resp);

    if (isHtml) {
      return res.status(400).json({
        success: false,
        connected: false,
        message: `A URL informada (${baseUrl}) retornou uma página HTML em vez da API. Verifique se a URL da Evolution API está correta (sem /manager no final).`
      });
    }

    if (!resp.ok) {
      return res.status(resp.status).json({
        success: false,
        connected: false,
        message: data?.message || `Evolution API retornou status HTTP ${resp.status}`,
        details: data
      });
    }

    const state = (data?.instance?.state || data?.state || 'unknown').toLowerCase();
    const connected = state === 'open' || state === 'connected';

    return res.json({
      success: true,
      connected,
      state,
      raw: data,
      message: connected
        ? 'Instância conectada e pronta para envio!'
        : `Instância detectada no estado: ${state}. Conecte o WhatsApp via QR Code na Evolution API.`
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      connected: false,
      message: err.name === 'AbortError' ? 'Tempo limite esgotado ao contatar Evolution API.' : (err.message || 'Erro ao conectar à Evolution API')
    });
  }
});

// 2. Test Connection & Send Test Message via Evolution API
app.post('/api/whatsapp/test', async (req, res) => {
  try {
    const { evolutionApiUrl, evolutionApiKey, evolutionInstance, testNumber } = req.body;
    if (!evolutionApiUrl || !evolutionApiKey || !evolutionInstance) {
      return res.status(400).json({
        success: false,
        message: 'URL, Chave de API e Nome da Instância são obrigatórios para o teste.'
      });
    }

    const baseUrl = cleanEvolutionUrl(evolutionApiUrl);
    const cleanInstance = encodeURIComponent(evolutionInstance.trim());

    // 1. Check connection
    const checkUrl = `${baseUrl}/instance/connectionState/${cleanInstance}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const statusResp = await fetch(checkUrl, {
      method: 'GET',
      headers: {
        'apikey': evolutionApiKey.trim()
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const { isHtml: statusIsHtml, data: statusData } = await parseEvolutionHttpResponse(statusResp);
    if (statusIsHtml) {
      return res.status(400).json({
        success: false,
        message: `A URL informada (${baseUrl}) retornou uma página HTML em vez da Evolution API. Verifique se a URL não contém /manager no final.`
      });
    }

    if (!statusResp.ok) {
      return res.status(statusResp.status).json({
        success: false,
        message: `Falha ao autenticar na Evolution API (HTTP ${statusResp.status}). Verifique a URL e a Chave API.`,
        details: statusData
      });
    }

    const state = (statusData?.instance?.state || statusData?.state || '').toLowerCase();
    const isConnected = state === 'open' || state === 'connected';

    // 2. If testNumber is provided, attempt sending test message
    let sendResult = null;
    if (testNumber && testNumber.trim()) {
      let rawPhone = testNumber.replace(/\D/g, '');
      if (rawPhone.length === 10 || rawPhone.length === 11) {
        rawPhone = `55${rawPhone}`;
      }

      const sendUrl = `${baseUrl}/message/sendText/${cleanInstance}`;
      const sendResp = await fetch(sendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': evolutionApiKey.trim()
        },
        body: JSON.stringify({
          number: rawPhone,
          text: `🤖 *Holerite Digital • Teste de Integração Evolution API*\n\nConexão estabelecida com sucesso! O sistema de RH está apto para o disparo automático de holerites e comunicados aos colaboradores via WhatsApp.`,
          delay: 1200,
          options: {
            delay: 1200,
            presence: 'composing',
            linkPreview: true
          }
        })
      });

      const { isHtml: sendIsHtml, data: sendData } = await parseEvolutionHttpResponse(sendResp);
      if (sendIsHtml || !sendResp.ok) {
        return res.status(sendResp.ok ? 400 : sendResp.status).json({
          success: false,
          connected: isConnected,
          message: sendIsHtml
            ? `O endpoint de envio em ${baseUrl} retornou HTML inválido.`
            : `Instância está no estado "${state}", porém o envio para ${rawPhone} retornou erro HTTP ${sendResp.status}.`,
          details: sendData
        });
      }
      sendResult = sendData;
    }

    return res.json({
      success: true,
      connected: isConnected,
      state,
      sendResult,
      message: testNumber
        ? `Conexão validada e mensagem de teste disparada para ${testNumber}!`
        : `Instância Evolution API conectada com sucesso (Estado: ${state || 'conectado'})!`
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.name === 'AbortError' ? 'Tempo limite esgotado ao comunicar com a Evolution API.' : (err.message || 'Erro inesperado ao testar Evolution API')
    });
  }
});

// 3. Send WhatsApp Text or Media (PDF) via Evolution API
app.post('/api/whatsapp/send', async (req, res) => {
  try {
    const {
      evolutionApiUrl,
      evolutionApiKey,
      evolutionInstance,
      number,
      text,
      media,
      fileName,
      caption
    } = req.body;

    if (!evolutionApiUrl || !evolutionApiKey || !evolutionInstance) {
      return res.status(400).json({
        success: false,
        message: 'Configuração da Evolution API incompleta (URL, Apikey ou Instância ausente).'
      });
    }

    if (!number) {
      return res.status(400).json({
        success: false,
        message: 'Número de telefone do destinatário não informado.'
      });
    }

    let rawPhone = String(number).replace(/\D/g, '');
    if (rawPhone.length === 10 || rawPhone.length === 11) {
      rawPhone = `55${rawPhone}`;
    }

    const baseUrl = cleanEvolutionUrl(evolutionApiUrl);
    const cleanInstance = encodeURIComponent(evolutionInstance.trim());

    let mediaResult = null;
    let mediaSentOk = false;
    let textResult = null;

    // 1. If media (base64 PDF document) is provided, sendMedia
    if (media) {
      const cleanBase64 = String(media).replace(/^data:[^;]+;base64,/, '').trim();
      const sendMediaUrl = `${baseUrl}/message/sendMedia/${cleanInstance}`;
      const mediaResp = await fetch(sendMediaUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': evolutionApiKey.trim()
        },
        body: JSON.stringify({
          number: rawPhone,
          mediatype: 'document',
          mimetype: 'application/pdf',
          caption: caption || text || '',
          media: cleanBase64,
          fileName: fileName || 'holerite.pdf',
          mediaMessage: {
            mediatype: 'document',
            caption: caption || text || '',
            media: cleanBase64,
            fileName: fileName || 'holerite.pdf'
          }
        })
      });

      const parsedMedia = await parseEvolutionHttpResponse(mediaResp);
      if (mediaResp.ok && !parsedMedia.isHtml) {
        mediaResult = parsedMedia.data;
        mediaSentOk = true;
      } else {
        console.warn('sendMedia returned non-ok:', mediaResp.status, parsedMedia.data);
      }
    }

    // 2. If no media (e.g. Lembrete de Assinatura) or if media failed, send text via sendText
    if (!media || !mediaSentOk) {
      const sendTextUrl = `${baseUrl}/message/sendText/${cleanInstance}`;
      const textResp = await fetch(sendTextUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': evolutionApiKey.trim()
        },
        body: JSON.stringify({
          number: rawPhone,
          text: text,
          delay: 1200,
          options: {
            delay: 1200,
            presence: 'composing',
            linkPreview: true
          }
        })
      });

      const parsedText = await parseEvolutionHttpResponse(textResp);
      if (parsedText.isHtml) {
        return res.status(400).json({
          success: false,
          message: `A URL da Evolution API (${baseUrl}) retornou uma página HTML em vez de JSON. Verifique se a URL não contém /manager no final.`
        });
      }

      textResult = parsedText.data;
      if (!textResp.ok && !mediaSentOk) {
        const evoErrMsg =
          (typeof textResult?.message === 'string' && textResult.message) ||
          (Array.isArray(textResult?.response?.message) && textResult.response.message.join(', ')) ||
          (typeof textResult?.error === 'string' && textResult.error) ||
          `Falha ao enviar mensagem via Evolution API (HTTP ${textResp.status})`;
        return res.status(textResp.status).json({
          success: false,
          message: evoErrMsg,
          details: textResult
        });
      }
    }

    return res.json({
      success: true,
      message: 'Mensagem enviada com sucesso pelo WhatsApp via Evolution API!',
      mediaResult,
      textResult
    });
  } catch (err: any) {
    console.error('WhatsApp send error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Erro ao disparar mensagem pela Evolution API.'
    });
  }
});

// Garantir que nenhuma rota /api/* inexistente retorne HTML (<!doctype html>)
app.all('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Rota de API não encontrada no servidor (${req.method} ${req.originalUrl}).`
  });
});

// Setup Vite development middleware or production static files
async function startServer() {
  // Determine port: AI Studio applet MUST listen on port 3000 (DEFAULT_APP_PORT)
  const portArgIdx = process.argv.indexOf('--port');
  let PORT = 3000;
  if (portArgIdx !== -1 && process.argv[portArgIdx + 1]) {
    PORT = parseInt(process.argv[portArgIdx + 1], 10);
  } else if (process.env.DEFAULT_APP_PORT) {
    PORT = parseInt(process.env.DEFAULT_APP_PORT, 10);
  } else if (process.env.APP_PORT) {
    PORT = parseInt(process.env.APP_PORT, 10);
  } else if (process.env.PORT) {
    PORT = parseInt(process.env.PORT, 10);
  }

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa'
    });
    app.use(vite.middlewares);

    // Explicit fallback for SPA index.html in dev mode
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        next(e);
      }
    });
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 HoleriteDigital Full-Stack Server running on port ${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
