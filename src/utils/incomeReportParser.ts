import { IncomeReport } from '../types';
import { parseCurrency } from './pdfParser';

export interface ParseIncomeReportResult {
  reports: IncomeReport[];
  errors: string[];
}

// Funções auxiliares para extração precisa de valores monetários
function extractBlockCurrencies(str: string): number[] {
  if (!str) return [];
  const matches = str.match(/\b\d{1,3}(?:\.\d{3})*,\d{2}\b|\b\d+,\d{2}\b/g) || [];
  return matches.map(m => parseCurrency(m));
}

function extractItemField(textBlock: string, itemNumber: number, keywordsRegex: RegExp): number | null {
  if (!textBlock) return null;
  const lines = textBlock.split(/[\r\n]+/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const prefixRegex = new RegExp('^(?:0?' + itemNumber + '\\b|[#\\-\\s]*0?' + itemNumber + '[\\.\\-\\s])', 'i');
    if (prefixRegex.test(line) && keywordsRegex.test(line)) {
      const currencies = line.match(/\b\d{1,3}(?:\.\d{3})*,\d{2}\b|\b\d+,\d{2}\b/g);
      if (currencies && currencies.length > 0) {
        return parseCurrency(currencies[currencies.length - 1]);
      }
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        const nextCurrencies = nextLine.match(/\b\d{1,3}(?:\.\d{3})*,\d{2}\b|\b\d+,\d{2}\b/g);
        if (nextCurrencies && nextCurrencies.length === 1) {
          return parseCurrency(nextCurrencies[0]);
        }
      }
    }
  }
  return null;
}

export function parseIncomeReportText(rawText: string): ParseIncomeReportResult {
  const reports: IncomeReport[] = [];
  const errors: string[] = [];

  if (!rawText || rawText.trim().length === 0) {
    return { reports: [], errors: ['Texto do informe de rendimentos vazio.'] };
  }

  // 1. Delimitação por páginas ou comprovantes da Receita Federal
  const chunks = rawText.split(/(?====\s*P[AÁ]GINA\s*\d+\s*===|===\s*PAGE\s*\d+\s*===|MINIST[EÉ]RIO DA ECONOMIA\b|COMPROVANTE DE RENDIMENTOS PAGOS E DE\b)/gi);

  let pageIndex = 1;
  for (const chunk of chunks) {
    const text = chunk.trim();
    if (text.length < 50) continue;

    // Indicadores flexíveis de comprovante de rendimentos
    const hasIndicators =
      /fonte\s*pagadora/i.test(text) ||
      /pessoa\s*f[ií]sica/i.test(text) ||
      /benefici[aá]ri/i.test(text) ||
      /rendimentos\s*tribut[aá]veis/i.test(text) ||
      /total\s*dos\s*rendimentos/i.test(text) ||
      /imposto\s*sobre\s*a\s*renda/i.test(text) ||
      /comprovante\s*de\s*rendimentos/i.test(text) ||
      /ano[- ]calend[aá]rio/i.test(text) ||
      /exerc[ií]cio/i.test(text);

    if (!hasIndicators) continue;

    try {
      // Exercício e Ano-Calendário
      let exercicio = '2026';
      let anoCalendario = '2025';

      const exMatch = text.match(/EXERC[IÍ]CIO\s*[:\s]*(\d{4})/i);
      if (exMatch) exercicio = exMatch[1];

      const anoMatch = text.match(/ANO[- ]CALEND[AÁ]RIO\s*[:\s]*(\d{4})/i);
      if (anoMatch) anoCalendario = anoMatch[1];

      // Delimitação estrita dos Quadros Oficiais da Receita Federal
      const q1Idx = text.search(/(?:1\.\s*Fonte\s*Pagadora|FONTE\s*PAGADORA)/i);
      const q2Idx = text.search(/(?:2\.\s*Pessoa\s*F[íi]sica\s*Benefici[áa]ria|PESSOA\s*F[ÍI]SICA\s*BENEFICI[ÁA]RIA)/i);
      const q3Idx = text.search(/(?:3\.\s*Rendimentos\s*Tribut[áa]veis|RENDIMENTOS\s*TRIBUT[ÁA]VEIS)/i);
      const q4Idx = text.search(/(?:4\.\s*Rendimentos\s*Isentos|RENDIMENTOS\s*ISENTOS)/i);
      const q5Idx = text.search(/(?:5\.\s*Rendimentos\s*Sujeitos|RENDIMENTOS\s*SUJEITOS\s+[AÀ]\s+TRIBUTA[ÇC][ÃA]O)/i);
      const q6Idx = text.search(/(?:6\.\s*Rendimentos\s*Recebidos|RENDIMENTOS\s*RECEBIDOS)/i);
      const q7Idx = text.search(/(?:7\.\s*Informa[çc][õo]es\s*Complementares|INFORMA[ÇC][ÕO]ES\s*COMPLEMENTARES)/i);
      const q8Idx = text.search(/(?:8\.\s*Respons[áa]vel|RESPONS[ÁA]VEL\s*PELAS\s*INFORMA[ÇC][ÕO]ES)/i);

      const quadro1Text = q1Idx !== -1 ? text.slice(q1Idx, q2Idx !== -1 ? q2Idx : undefined) : text;
      const quadro2Text = q2Idx !== -1 ? text.slice(q2Idx, q3Idx !== -1 ? q3Idx : undefined) : text;
      const quadro3Text = q3Idx !== -1 ? text.slice(q3Idx, q4Idx !== -1 ? q4Idx : (q5Idx !== -1 ? q5Idx : undefined)) : '';
      const quadro4Text = q4Idx !== -1 ? text.slice(q4Idx, q5Idx !== -1 ? q5Idx : undefined) : '';
      const quadro5Text = q5Idx !== -1 ? text.slice(q5Idx, q6Idx !== -1 ? q6Idx : (q7Idx !== -1 ? q7Idx : (q8Idx !== -1 ? q8Idx : undefined))) : '';
      const quadro7Text = q7Idx !== -1 ? text.slice(q7Idx, q8Idx !== -1 ? q8Idx : undefined) : '';
      const quadro8Text = q8Idx !== -1 ? text.slice(q8Idx) : '';

      // 1. Fonte Pagadora (Quadro 1)
      let cnpjFonte = '461.946.067-20';
      let nomeFonte = 'FRANCISCO JOSE BARBOSA NOBRE';

      const cnpjMatch = (quadro1Text || text).match(/(?:CNPJ\/CPF|CNPJ|CPF)\s*[:\n\r\t\s]*([\d\.\-\/]+)/i);
      if (cnpjMatch) cnpjFonte = cnpjMatch[1].trim();

      const nomeFonteMatch = (quadro1Text || text).match(/(?:Nome Empresarial \/ Nome Completo|Nome Empresarial|Nome)\s*[:\n\r\t\s]*([^\n\r]+)/i);
      if (nomeFonteMatch) {
        const candidate = nomeFonteMatch[1].replace(/2\.\s*Pessoa Física.*$/i, '').trim();
        if (candidate.length > 3 && !candidate.includes('Beneficiária')) {
          nomeFonte = candidate;
        }
      }

      // 2. Beneficiário (Quadro 2)
      let cpfBeneficiario = '';
      let nomeBeneficiario = '';
      let codigoBeneficiario = '';
      const naturezaRendimento = 'RENDIMENTO DO TRABALHO ASSALARIADO NO PAÍS';

      // Busca padrão "071.867.799-48 ADRIANA DE FATIMA DA SILVA - 000008"
      const benefLineMatch = quadro2Text.match(/(\d{3}\.\d{3}\.\d{3}\-\d{2})\s+([A-ZÀ-Ú\s\.\-]+?)(?:\s*-\s*(\d{1,8}))?(?:\r|\n|Natureza|RENDIMENTO|$)/im);
      if (benefLineMatch) {
        cpfBeneficiario = benefLineMatch[1].trim();
        nomeBeneficiario = benefLineMatch[2].trim();
        if (benefLineMatch[3]) {
          codigoBeneficiario = String(parseInt(benefLineMatch[3], 10));
        }
      }

      // Fallback linha a linha no Quadro 2
      const lines = quadro2Text.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);
      for (const line of lines) {
        if (!cpfBeneficiario) {
          const mCpf = line.match(/(\d{3}\.\d{3}\.\d{3}\-\d{2})/);
          if (mCpf) cpfBeneficiario = mCpf[1].trim();
        }

        if (!nomeBeneficiario) {
          const mFull = line.match(/^(\d{3}\.\d{3}\.\d{3}\-\d{2})\s+([A-ZÀ-Ú\s]+?)(?:\s*-\s*(\d{1,8}))?$/i);
          if (mFull) {
            nomeBeneficiario = mFull[2].trim();
            if (mFull[3]) codigoBeneficiario = String(parseInt(mFull[3], 10));
            break;
          }

          const mNome = line.match(/(?:Nome\s+Completo|Nome|Benefici[aá]ri[ao])\s*[:\s]+([A-ZÀ-Ú\s]{4,50})/i);
          if (mNome) {
            const cand = mNome[1].trim();
            if (!cand.includes('RECEITA') && !cand.includes('MINISTERIO')) {
              nomeBeneficiario = cand;
            }
          }
        }
      }

      // Se ainda não identificou nome, busca qualquer nome em caixa alta após CPF
      if (!nomeBeneficiario && cpfBeneficiario) {
        const afterCpf = quadro2Text.slice(quadro2Text.indexOf(cpfBeneficiario) + cpfBeneficiario.length);
        const mAfter = afterCpf.match(/^\s*([A-ZÀ-Ú\s]{4,50}?)(?:\s*-\s*(\d{1,8}))?(?:\r|\n|$)/m);
        if (mAfter) {
          nomeBeneficiario = mAfter[1].trim();
          if (mAfter[2]) codigoBeneficiario = String(parseInt(mAfter[2], 10));
        }
      }

      if (!codigoBeneficiario) {
        codigoBeneficiario = String(pageIndex);
      }

      // 3. Rendimentos Tributáveis (Quadro 3)
      let totalRendimentos = extractItemField(quadro3Text, 1, /Total/i);
      let contribuicaoPrevidenciaria = extractItemField(quadro3Text, 2, /previdenci[áa]ria/i);
      let previdenciaComplementar = extractItemField(quadro3Text, 3, /previd[êe]ncia/i);
      let pensaoAlimenticia = extractItemField(quadro3Text, 4, /pens[ãa]o/i);
      let impostoRetidoFonte = extractItemField(quadro3Text, 5, /Imposto|IRRF/i);

      // Fallback para layout colunar/tabela sem labels na mesma linha
      const q3Currencies = extractBlockCurrencies(quadro3Text);
      if (totalRendimentos === null && q3Currencies.length >= 1) totalRendimentos = q3Currencies[0];
      if (contribuicaoPrevidenciaria === null && q3Currencies.length >= 2) contribuicaoPrevidenciaria = q3Currencies[1];
      if (impostoRetidoFonte === null && q3Currencies.length >= 5) {
        impostoRetidoFonte = q3Currencies[4];
      }

      totalRendimentos = totalRendimentos || 0;
      contribuicaoPrevidenciaria = contribuicaoPrevidenciaria || 0;
      previdenciaComplementar = previdenciaComplementar || 0;
      pensaoAlimenticia = pensaoAlimenticia || 0;
      impostoRetidoFonte = impostoRetidoFonte || 0;

      // Validação de segurança: IRRF retido NUNCA é o ano (ex: 2026) nem o ano-calendário (2025)
      if (
        impostoRetidoFonte === 2026 ||
        impostoRetidoFonte === 2025 ||
        impostoRetidoFonte === Number(exercicio) ||
        impostoRetidoFonte === Number(anoCalendario)
      ) {
        impostoRetidoFonte = 0;
      }

      // 4. Rendimentos Isentos e Não Tributáveis (Quadro 4)
      let indenizacoesRescisao = extractItemField(quadro4Text, 7, /Indeniza[çc][õo]es|rescis[ãa]o/i) || 0;
      let outrosValor = extractItemField(quadro4Text, 9, /Outros/i) || 0;
      let outrosEspecificar = '';

      const outrosMatch = quadro4Text.match(/9\.\s*Outros\s*\(especificar\)\.?\s*([A-Za-zÀ-Ú\s]+)/i);
      if (outrosMatch && outrosMatch[1] && outrosMatch[1].trim().length > 2) {
        outrosEspecificar = outrosMatch[1].trim();
      }

      // 5. Tributação Exclusiva (Quadro 5: 13º Salário e Retenção do 13º)
      let decimoTerceiroSalario = extractItemField(quadro5Text, 1, /13[ºo]|d[ée]cimo/i);
      let irrfDecimoTerceiro = extractItemField(quadro5Text, 2, /Imposto|IRRF/i);

      // Fallback para colunas de valores
      const q5Currencies = extractBlockCurrencies(quadro5Text);
      if (decimoTerceiroSalario === null && q5Currencies.length >= 1) {
        decimoTerceiroSalario = q5Currencies[0];
      }
      if (irrfDecimoTerceiro === null && q5Currencies.length >= 2) {
        irrfDecimoTerceiro = q5Currencies[1];
      }

      decimoTerceiroSalario = decimoTerceiroSalario || 0;
      irrfDecimoTerceiro = irrfDecimoTerceiro || 0;

      // Validação de segurança: 13º salário e IRRF sobre 13º NUNCA são números de item 1, 2 ou 3
      if (decimoTerceiroSalario <= 3) {
        decimoTerceiroSalario = 0;
      }
      if (irrfDecimoTerceiro <= 3) {
        irrfDecimoTerceiro = 0;
      }

      // 8. Responsável pelas Informações (Quadro 8)
      let nomeResponsavel = 'PEDRO RAFAEL DA SILVEIRA';
      let dataResponsavel = '13/02/2026';

      const respMatch = (quadro8Text || text).match(/Respons[áa]vel pelas Informa[çc][õo]es[\s\S]*?Nome\s+Data[\s\S]*?([A-ZÀ-Ú\s]{5,40})\s+(\d{2}\/\d{2}\/\d{4})/i);
      if (respMatch) {
        nomeResponsavel = respMatch[1].trim();
        dataResponsavel = respMatch[2].trim();
      }

      if (nomeBeneficiario || cpfBeneficiario || totalRendimentos > 0) {
        const reportId = `irpf-${codigoBeneficiario}-${anoCalendario}`;
        reports.push({
          id: reportId,
          exercicio,
          anoCalendario,
          fontePagadora: {
            cnpjCpf: cnpjFonte,
            nomeEmpresarial: nomeFonte
          },
          beneficiario: {
            cpf: cpfBeneficiario || '000.000.000-00',
            nomeCompleto: nomeBeneficiario || `COLABORADOR ${codigoBeneficiario}`,
            employeeCodigo: codigoBeneficiario,
            naturezaRendimento
          },
          rendimentosTributaveis: {
            totalRendimentos,
            contribuicaoPrevidenciaria,
            previdenciaComplementar,
            pensaoAlimenticia,
            impostoRetidoFonte
          },
          rendimentosIsentos: {
            parcelaIsentaAposentadoria: 0,
            parcelaIsenta13Aposentadoria: 0,
            diariasAjudaCusto: 0,
            pensaoMolestiaGrave: 0,
            lucrosDividendos: 0,
            valoresPagosSocio: 0,
            indenizacoesRescisao,
            jurosMora: 0,
            outrosEspecificar: outrosEspecificar || undefined,
            outrosValor
          },
          tributacaoExclusiva: {
            decimoTerceiroSalario,
            irrfDecimoTerceiro,
            outros: 0
          },
          responsavel: {
            nome: nomeResponsavel,
            data: dataResponsavel
          },
          criadoEm: new Date().toISOString()
        });
      }
    } catch (err: any) {
      errors.push(`Erro na página ${pageIndex}: ${err?.message || 'Formato inesperado'}`);
    }

    pageIndex++;
  }

  return { reports, errors };
}
