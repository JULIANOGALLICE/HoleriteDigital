import { Employee, PayReceipt, ReceiptItem } from '../types';

export interface ParsedRecord {
  employee: Partial<Employee> & {
    codigo: string;
    nome: string;
    dataAdmissao: string;
    salarioBase: number;
    cargo?: string;
    cbo?: string;
    departamento?: string;
    filial?: string;
  };
  receipt: PayReceipt;
}

export interface ParseResult {
  records: ParsedRecord[];
  errors: string[];
}

export function parseCurrency(valStr: string | undefined): number {
  if (!valStr) return 0;
  const clean = valStr
    .replace(/\[[VD]\]/gi, '')
    .trim()
    .replace(/\./g, '')
    .replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

// Catálogo completo de rubricas conhecidas de folha de cartório / CLT
const KNOWN_RUBRICS: Record<string, { name: string; isProvento: boolean }> = {
  '1': { name: 'HORAS NORMAIS', isProvento: true },
  '3': { name: 'HORAS FERIAS', isProvento: true },
  '5': { name: 'HORAS AFAST.INSS (P/DOENC', isProvento: true },
  '16': { name: 'INSALUBRIDADE 20%', isProvento: true },
  '20': { name: 'GRATIFICACOES', isProvento: true },
  '25': { name: 'ADICIONAL NOTURNO (INFOR)', isProvento: true },
  '150': { name: 'HORAS EXTRAS', isProvento: true },
  '202': { name: 'ADICIONAL TEMPO DE SERVIÇO 4% CCT', isProvento: true },
  '203': { name: 'ADICIONAL TEMPO DE SERVIÇO 2% CCT', isProvento: true },
  '219': { name: 'ABONO - CLAUSULA 11ª CCT', isProvento: true },
  '250': { name: 'REFLEXO EXTRAS DSR', isProvento: true },
  '805': { name: 'MEDIA VALOR FERIAS', isProvento: true },
  '806': { name: 'MEDIA HORAS FERIAS', isProvento: true },
  '807': { name: 'VANTAGENS FERIAS', isProvento: true },
  '808': { name: 'MEDIA VALOR ABONO', isProvento: true },
  '809': { name: 'MEDIAS HORAS ABONO', isProvento: true },
  '836': { name: 'INSS DIF FER DESC A MAIOR', isProvento: true },
  '846': { name: 'DIFERENCA ABONO FERIAS', isProvento: true },
  '854': { name: 'REFLEXO ADIC. NOTURNO DSR', isProvento: true },
  '930': { name: 'ABONO PECUNIARIO (FERIAS)', isProvento: true },
  '931': { name: '1/3 DAS FERIAS', isProvento: true },
  '932': { name: '1/3 DO ABONO FERIAS', isProvento: true },
  '940': { name: 'DIFERENCA DE FERIAS', isProvento: true },
  '8112': { name: 'DIFERENCA DE 1/3 DE FERIAS', isProvento: true },
  '8136': { name: 'LICENÇA PATERNIDADE', isProvento: true },
  '8189': { name: 'DIFERENCA MEDIA HORA FERIAS', isProvento: true },
  '8190': { name: 'DIFERENCA MEDIA VALOR FERIAS', isProvento: true },
  '8197': { name: 'DIFERENCA MEDIA HORA ABONO FERIAS', isProvento: true },
  '8417': { name: 'DIFERENCA 1/3 ABONO DE FERIAS', isProvento: true },
  '8697': { name: 'HORAS AFAST. P/DOENCA C/DIR.INTEGRAIS', isProvento: true },
  '9524': { name: 'HORAS AFAST. P/DOENCA IGUAL/INF 15 DIAS', isProvento: true },
  '9755': { name: 'ESTORNO DESC PROV EMPRESTIMO TRAB ADIANT', isProvento: true },
  // Descontos
  '40': { name: 'HORAS FALTAS', isProvento: false },
  '42': { name: 'HORAS FALTAS DSR', isProvento: false },
  '201': { name: 'DESCONTO CONVENIO MEDICO', isProvento: false },
  '205': { name: 'PLANO DENTAL', isProvento: false },
  '208': { name: 'DESC. EMP. CRED. TRAB', isProvento: false },
  '210': { name: 'DESC. EMP. CRED. TRAB', isProvento: false },
  '217': { name: 'DESC. EMP. CRED. TRAB', isProvento: false },
  '812': { name: 'INSS FERIAS', isProvento: false },
  '821': { name: 'INSS DIFERENCA FERIAS', isProvento: false },
  '937': { name: 'ADIANTAMENTO DE FERIAS', isProvento: false },
  '981': { name: 'DESC.ADIANT.SALARIAL', isProvento: false },
  '988': { name: 'DESCONTO HORAS AFASTADAS', isProvento: false },
  '998': { name: 'I.N.S.S.', isProvento: false },
  '999': { name: 'IMPOSTO DE RENDA', isProvento: false },
  '8069': { name: 'HORAS FALTAS PARCIAL', isProvento: false },
  '9750': { name: 'DESC. EMP. CRED. TRAB', isProvento: false }
};

function classifyIsDiscount(itemCode: string, itemDesc: string, explicitTag?: string): boolean {
  if (explicitTag === 'D') return true;
  if (explicitTag === 'V') return false;

  const upperDesc = itemDesc.toUpperCase();
  if (upperDesc.startsWith('ESTORNO') || upperDesc.includes('DESC A MAIOR')) {
    return false;
  }

  const byCode = KNOWN_RUBRICS[itemCode];
  if (byCode) {
    return !byCode.isProvento;
  }

  if (
    upperDesc.startsWith('DESC') ||
    upperDesc.includes('DESCONTO') ||
    upperDesc.includes('I.N.S.S') ||
    upperDesc.includes('IMPOSTO DE RENDA') ||
    upperDesc.includes('ADIANTAMENTO DE FERIAS') ||
    upperDesc.includes('ADIANT.SALARIAL') ||
    upperDesc.includes('FALTA') ||
    upperDesc.includes('CONVENIO MEDICO') ||
    upperDesc.includes('PLANO DENTAL') ||
    upperDesc.includes('INSS FERIAS') ||
    upperDesc.includes('INSS DIFERENCA FERIAS')
  ) {
    return true;
  }

  return false;
}

export function parsePayrollText(rawText: string): ParseResult {
  const records: ParsedRecord[] = [];
  const errors: string[] = [];

  if (!rawText || rawText.trim().length === 0) {
    return { records: [], errors: ['Texto da folha vazio ou não fornecido.'] };
  }

  // 1. Identificar se o texto está estruturado por páginas ("=== PAGE X ===" ou "=== PÁGINA X ===")
  const hasPageMarkers = /===\s*P(?:AGE|ÁGINA|AGINA)\s*\d+\s*===/i.test(rawText);
  const sections: { text: string; pageNum: number }[] = [];

  if (hasPageMarkers) {
    const pageSplits = rawText.split(/(?====\s*P(?:AGE|ÁGINA|AGINA)\s*\d+\s*===)/gi);
    let pIdx = 1;
    for (const p of pageSplits) {
      const trimmed = p.trim();
      if (!trimmed) continue;
      const pageMatch = trimmed.match(/===\s*P(?:AGE|ÁGINA|AGINA)\s*(\d+)\s*===/i);
      const pageNum = pageMatch ? parseInt(pageMatch[1], 10) : pIdx;
      pIdx++;

      const subRecibos = trimmed.split(
        /(?=(?:FRANCISCO JOS[EÉ] BARBOSA NOBRE|Recibo de Pagamento de Sal[áa]rio|Recibo de Pagamento)\b)/gi
      );
      if (subRecibos.length > 1) {
        for (const sub of subRecibos) {
          if (sub.trim().length > 60) {
            sections.push({ text: sub.trim(), pageNum });
          }
        }
      } else {
        sections.push({ text: trimmed, pageNum });
      }
    }
  } else {
    const rawChunks = rawText.split(
      /(?=(?:FRANCISCO JOS[EÉ] BARBOSA NOBRE|Recibo de Pagamento de Sal[áa]rio|Recibo de Pagamento)\b)/gi
    );
    let pIdx = 1;
    for (const chunk of rawChunks) {
      const trimmed = chunk.trim();
      if (trimmed.length > 60) {
        sections.push({ text: trimmed, pageNum: pIdx++ });
      }
    }
  }

  if (sections.length === 0) {
    sections.push({ text: rawText.trim(), pageNum: 1 });
  }

  const IGNORE_NAME_TERMS = [
    'FRANCISCO', 'BARBOSA', 'NOBRE', 'CARTORIO', 'CARTÓRIO',
    'FOLHA', 'MENSAL', 'RECIBO', 'PAGAMENTO', 'SALARIO', 'SALÁRIO',
    'VENCIMENTOS', 'DESCONTOS', 'LIQUIDO', 'LÍQUIDO', 'HORAS',
    'NORMAIS', 'INSS', 'IRRF', 'FGTS', 'MENSALISTA', 'GERAL',
    'EMPREGADO', 'FUNCIONARIO', 'FUNCIONÁRIO', 'DEPARTAMENTO',
    'FILIAL', 'ADMISSAO', 'ADMISSÃO', 'SALARIO BASE', 'SALÁRIO BASE',
    'DESCRICAO', 'DESCRIÇÃO', 'REFERENCIA', 'REFERÊNCIA', 'DISCRIMINAÇÃO',
    'TRANSPORTAR', 'CAIXA ECONOMICA', 'BRADESCO', 'ITAU', 'BANCO'
  ];

  for (let i = 0; i < sections.length; i++) {
    const { text: section, pageNum } = sections[i];

    const isPaystub =
      section.includes('Admiss') ||
      section.includes('Salário Base') ||
      section.includes('Salario Base') ||
      section.includes('Total de Vencimentos') ||
      section.includes('Total Vencimentos') ||
      section.includes('Valor Líquido') ||
      section.includes('Valor Liquido') ||
      section.includes('CBO') ||
      section.includes('HORAS NORMAIS');

    if (!isPaystub) continue;

    try {
      // Remove tags [V] / [D] apenas para leitura limpa de cabeçalhos
      const cleanSectionHeader = section.replace(/\s*\[[VD]\]/g, '');
      const rawLines = section.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);
      const cleanLines = rawLines.map(l => l.replace(/\s*\[[VD]\]/g, '').trim());

      // 1. Extração de Competência / Mês e Ano
      let mesAno = 'Setembro de 2026';
      let competencia = '2026-09';

      const mesAnoMatch = cleanSectionHeader.match(
        /(?:Folha Mensal|Folha|M[êe]s|Compet[êe]ncia|Mensalista)[\s\r\n:]*([A-Za-zçãéíóú]+)\s+de\s+(20\d\d)/i
      );
      const numCompMatch = cleanSectionHeader.match(
        /(?:Compet[êe]ncia|Folha Mensal|M[êe]s)[\s\r\n:]*(\d{2})[\/\-](\d{4})/i
      );

      if (mesAnoMatch) {
        const monthName = mesAnoMatch[1];
        const year = mesAnoMatch[2];
        mesAno = `${monthName.charAt(0).toUpperCase() + monthName.slice(1).toLowerCase()} de ${year}`;
        const monthMap: Record<string, string> = {
          janeiro: '01', fevereiro: '02', marco: '03', março: '03', abril: '04',
          maio: '05', junho: '06', julho: '07', agosto: '08', setembro: '09',
          outubro: '10', novembro: '11', dezembro: '12'
        };
        const mKey = monthName.toLowerCase().replace('ç', 'c');
        const mNum = monthMap[mKey] || '09';
        competencia = `${year}-${mNum}`;
      } else if (numCompMatch) {
        const mNum = numCompMatch[1];
        const year = numCompMatch[2];
        competencia = `${year}-${mNum}`;
        const reverseMonths: Record<string, string> = {
          '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
          '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
          '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro'
        };
        mesAno = `${reverseMonths[mNum] || 'Mês ' + mNum} de ${year}`;
      }

      // 2. Extração de Código, Nome, CBO, Departamento e Filial
      let codigo = '';
      let nome = '';
      let cbo = '351405';
      let departamento = '1';
      let filial = '1';
      let employeeHeaderLineIndex = -1;

      // Estratégia A: Linha logo após "Código Nome do Funcionário CBO..."
      for (let l = 0; l < cleanLines.length; l++) {
        const line = cleanLines[l];
        if (/C[óo]digo/i.test(line) && /Nome/i.test(line)) {
          const nextLine = cleanLines[l + 1] || '';
          const matchNext = nextLine.match(
            /^(\d{1,5})\s+([A-ZÀ-Ú\s]{4,65}?)(?:\s+(\d{4,7}|\d{4}-\d{2}))?(?:\s+(\d+))?(?:\s+(\d+))?$/
          );
          if (matchNext) {
            codigo = matchNext[1].trim();
            nome = matchNext[2].trim();
            if (matchNext[3]) cbo = matchNext[3].replace('-', '');
            if (matchNext[4]) departamento = matchNext[4];
            if (matchNext[5]) filial = matchNext[5];
            employeeHeaderLineIndex = l + 1;
            break;
          }
        }
      }

      // Estratégia B: Linha com Código + Nome + CBO (6 dígitos) + Dept + Filial
      if (!codigo || !nome) {
        for (let l = 0; l < cleanLines.length; l++) {
          const line = cleanLines[l];
          const rowMatch = line.match(
            /^(\d{1,5})\s+([A-ZÀ-Ú\s]{4,65}?)\s+(\d{6}|\d{4}-\d{2})(?:\s+(\d+))?(?:\s+(\d+))?$/
          );
          if (rowMatch) {
            const potentialName = rowMatch[2].trim();
            const isInvalid = IGNORE_NAME_TERMS.some(t => potentialName.includes(t));
            if (!isInvalid) {
              codigo = rowMatch[1].trim();
              nome = potentialName;
              cbo = rowMatch[3].replace('-', '');
              if (rowMatch[4]) departamento = rowMatch[4];
              if (rowMatch[5]) filial = rowMatch[5];
              employeeHeaderLineIndex = l;
              break;
            }
          }
        }
      }

      // Estratégia C: Formato linear com rótulos
      if (!codigo || !nome) {
        const inlineMatch = cleanSectionHeader.match(
          /(?:Código|Codigo)\s*[:\s]*(\d{1,5})\s+(?:Nome(?:\s+do\s+Funcion[áa]rio|\s+do\s+Empregado)?\s*[:\s]*)?([A-ZÀ-Ú\s]{4,65}?)(?:\s+CBO|\s+Dep|\s+Filial|\r|\n|$)/i
        );
        if (inlineMatch) {
          codigo = inlineMatch[1].trim();
          nome = inlineMatch[2].trim();
        }
      }

      // Estratégia D: OCR onde Código aparece isolado antes de "Código / Nome do Funcionário"
      if (!codigo || !nome) {
        const ocrEmpMatch = cleanSectionHeader.match(
          /(\d{1,5})\s+C[óo]digo\s+([A-ZÀ-Ú\s]{4,65}?)\s+Nome\s+do\s+Funcion[áa]rio\s+CBO\s+(\d{4,7})/i
        );
        if (ocrEmpMatch) {
          codigo = ocrEmpMatch[1].trim();
          nome = ocrEmpMatch[2].trim();
          cbo = ocrEmpMatch[3].trim();
        }
      }

      if (!codigo) {
        const cMatch = cleanSectionHeader.match(/(?:Código|Codigo|Matr[íi]cula)\s*[:\s]+(\d{1,5})\b/i);
        if (cMatch) codigo = cMatch[1].trim();
      }

      if (!codigo) {
        codigo = String(pageNum);
      }

      if (nome) {
        nome = nome.replace(/\s+/g, ' ').trim();
      } else {
        nome = `COLABORADOR ${codigo}`;
      }

      // 3. Extração de Data de Admissão e Cargo
      let dataAdmissao = '';
      const admissaoMatch = cleanSectionHeader.match(/Admiss[ãa]o\s*[:\s]*(\d{2}\/\d{2}\/\d{4})/i);
      if (admissaoMatch) {
        dataAdmissao = admissaoMatch[1].trim();
      }

      let cargo = 'ESCREVENTE';
      if (employeeHeaderLineIndex >= 0 && cleanLines[employeeHeaderLineIndex + 1]) {
        const cargoLine = cleanLines[employeeHeaderLineIndex + 1];
        const cargoBeforeAdm = cargoLine.split(/Admiss[ãa]o/i)[0].trim();
        if (cargoBeforeAdm && cargoBeforeAdm.length >= 3 && !/C[óo]digo/i.test(cargoBeforeAdm)) {
          cargo = cargoBeforeAdm;
        }
      } else if (/ESCREVENTE SUBSTITUTA LEGAL|ESCREVENTE SUBSTITUTO LEGAL/i.test(cleanSectionHeader)) {
        cargo = 'ESCREVENTE SUBSTITUTA LEGAL';
      } else if (/ESCREVENTE II/i.test(cleanSectionHeader)) {
        cargo = 'ESCREVENTE II';
      } else if (/ESCREVENTE I/i.test(cleanSectionHeader)) {
        cargo = 'ESCREVENTE I';
      } else if (/AUXILIAR DE CARTORIO|AUXILIAR DE CARTÓRIO/i.test(cleanSectionHeader)) {
        cargo = 'AUXILIAR DE CARTORIO';
      } else if (/AUX\.\s*SERVI[ÇC]OS GERAIS/i.test(cleanSectionHeader)) {
        cargo = 'AUX. SERVIÇOS GERAIS';
      }

      // 4. Extração de Valores Totais e Bases de Cálculo
      let salarioBase = 0;
      let salContrINSS = 0;
      let baseCalcFGTS = 0;
      let fgtsDoMes = 0;
      let baseCalcIRRF = 0;
      let faixaIRRF = 0;
      let totalVencimentos = 0;
      let totalDescontos = 0;
      let valorLiquido = 0;
      let dadosBancariosTexto: string | undefined;
      let mensagemRodape: string | undefined;

      for (let l = 0; l < cleanLines.length; l++) {
        const line = cleanLines[l];

        // 4.1 Linha "Total de Vencimentos Total de Descontos" com valores na linha seguinte
        if (/Total\s+de\s+Vencimentos/i.test(line) && /Total\s+de\s+Descontos/i.test(line)) {
          const nextLine = cleanLines[l + 1] || '';
          if (!/TRANSPORTAR|\*{3,}/.test(nextLine)) {
            const nums = nextLine.match(/(\d[\d\.]*,\d{2})\s+(\d[\d\.]*,\d{2})/);
            if (nums) {
              totalVencimentos = parseCurrency(nums[1]);
              totalDescontos = parseCurrency(nums[2]);
            }
          }
        }

        // 4.2 Linha "Valor Líquido"
        if (/Valor\s+L[íi]quido/i.test(line)) {
          if (!/\*{3,}/.test(line)) {
            const liqNums = line.match(/Valor\s+L[íi]quido[^\d\n\r*]*(\d[\d\.]*,\d{2})/i);
            if (liqNums) {
              valorLiquido = parseCurrency(liqNums[1]);
            } else {
              const nextLine = cleanLines[l + 1] || '';
              const nextLiq = nextLine.match(/^(\d[\d\.]*,\d{2})$/);
              if (nextLiq) valorLiquido = parseCurrency(nextLiq[1]);
            }
          }

          // Verifica se há dados bancários na mesma linha ou linha anterior ao Valor Líquido
          const bankPart = line.split(/Valor\s+L[íi]quido/i)[0].trim();
          if (bankPart && /(?:conta|ag[êe]ncia)/i.test(bankPart)) {
            const prevLine = cleanLines[l - 1] || '';
            const bankName =
              prevLine && !/Total|\d[\d\.]*,\d{2}/i.test(prevLine) ? `${prevLine} ` : '';
            dadosBancariosTexto = `${bankName}${bankPart}`.replace(/\s+/g, ' ').trim();
          }
        }

        // 4.3 Linha de Bases: "Salário Base Sal. Contr. INSS Base Cálc. FGTS F.G.T.S do Mês Base Cálc. IRRF Faixa IRRF"
        if (/Sal[áa]rio\s+Base/i.test(line) && /Sal\.?\s*Contr\.?\s*INSS/i.test(line)) {
          const nextLine = cleanLines[l + 1] || '';
          const baseNums = nextLine.match(
            /(\d[\d\.]*,\d{2})\s+(\d[\d\.]*,\d{2})\s+(\d[\d\.]*,\d{2})\s+(\d[\d\.]*,\d{2})\s+(\d[\d\.]*,\d{2})(?:\s+(\d[\d\.]*,\d{2}))?/
          );
          if (baseNums) {
            salarioBase = parseCurrency(baseNums[1]);
            salContrINSS = parseCurrency(baseNums[2]);
            baseCalcFGTS = parseCurrency(baseNums[3]);
            fgtsDoMes = parseCurrency(baseNums[4]);
            baseCalcIRRF = parseCurrency(baseNums[5]);
            if (baseNums[6]) faixaIRRF = parseCurrency(baseNums[6]);
          }
        }

        // 4.4 Mensagem de aniversário / rodapé (ex: *** PARABÉNS ... ***)
        if (line.startsWith('***') && line.endsWith('***')) {
          mensagemRodape = line;
        }
      }

      // Fallbacks para texto linear onde cada rótulo tem seu número logo ao lado
      if (!salarioBase) {
        const m = cleanSectionHeader.match(/Sal[áa]rio\s+Base\s*:\s*(\d[\d\.]*,\d{2})/i);
        if (m) salarioBase = parseCurrency(m[1]);
      }
      if (!totalVencimentos) {
        const m = cleanSectionHeader.match(/Total\s+(?:de\s+)?Vencimentos\s*:\s*(\d[\d\.]*,\d{2})/i);
        if (m) totalVencimentos = parseCurrency(m[1]);
      }
      if (!totalDescontos) {
        const m = cleanSectionHeader.match(/Total\s+(?:de\s+)?Descontos\s*:\s*(\d[\d\.]*,\d{2})/i);
        if (m) totalDescontos = parseCurrency(m[1]);
      }
      if (!valorLiquido) {
        const m = cleanSectionHeader.match(/Valor\s+L[íi]quido\s*:\s*(\d[\d\.]*,\d{2})/i);
        if (m) valorLiquido = parseCurrency(m[1]);
      }

      // 5. Extração das Rubricas / Itens (somente dentro da tabela de rubricas)
      const itens: ReceiptItem[] = [];
      let inRubricTable = false;
      const hasRubricHeader = rawLines.some(
        l => /C[óo]digo/i.test(l) && /Descri[çc][ãa]o/i.test(l) && /Refer[êe]ncia/i.test(l)
      );

      for (let l = 0; l < rawLines.length; l++) {
        if (l === employeeHeaderLineIndex) continue;

        const rawLine = rawLines[l];
        const cleanLine = cleanLines[l];

        if (/C[óo]digo/i.test(cleanLine) && /Descri[çc][ãa]o/i.test(cleanLine) && /Refer[êe]ncia/i.test(cleanLine)) {
          inRubricTable = true;
          continue;
        }

        if (
          /Total\s+de\s+Vencimentos/i.test(cleanLine) ||
          /^A\s+TRANSPORTAR\b/i.test(cleanLine) ||
          /Sal[áa]rio\s+Base/i.test(cleanLine)
        ) {
          if (inRubricTable) break;
        }

        if (hasRubricTableGuard(hasRubricHeader, inRubricTable)) continue;

        // Padrão de rubrica:
        // <codigo> <descricao> <referencia (HH:MM ou 0,00)> <valor1 (0.000,00)> [valor2 (0.000,00)] [[V]|[D]]
        const rubricMatch = rawLine.match(
          /^(\d{1,5})\s+(.+?)\s+(\d+:\d+|\d[\d\.]*,\d{2})\s+(\d[\d\.]*,\d{2})(?:\s+(\d[\d\.]*,\d{2}))?(?:\s*\[([VD])\])?$/i
        );

        if (rubricMatch) {
          const itemCode = rubricMatch[1].trim();
          const itemDesc = rubricMatch[2].replace(/\s*\[[VD]\]/g, '').trim();
          const itemRef = rubricMatch[3].trim();
          const val1 = parseCurrency(rubricMatch[4]);
          const val2 = rubricMatch[5] ? parseCurrency(rubricMatch[5]) : null;
          const colTag = rubricMatch[6] ? rubricMatch[6].toUpperCase() : undefined;

          // Ignora caso seja cabeçalho de funcionário disfarçado
          if (itemDesc.toUpperCase() === nome.toUpperCase()) continue;
          if (itemDesc.includes('SALARIO BASE') || itemDesc.includes('TOTAL DE')) continue;

          const isDiscount = classifyIsDiscount(itemCode, itemDesc, colTag);
          const amount = val2 !== null ? val2 : val1;

          const alreadyExists = itens.some(
            it =>
              it.codigo === itemCode &&
              it.descricao === itemDesc &&
              it.referencia === itemRef
          );

          if (!alreadyExists) {
            itens.push({
              codigo: itemCode,
              descricao: itemDesc,
              referencia: itemRef,
              vencimento: !isDiscount ? amount : null,
              desconto: isDiscount ? amount : null
            });
          }
        }
      }

      // 6. Consolidação ou criação do registro do colaborador
      const existingIdx = records.findIndex(r => r.employee.codigo === codigo);

      if (existingIdx >= 0) {
        const existingRec = records[existingIdx].receipt;
        const existingEmp = records[existingIdx].employee;

        // Mescla itens de páginas de continuação ("A TRANSPORTAR" -> Página seguinte)
        // sem duplicar itens idênticos da 2ª via da mesma página
        for (const newItem of itens) {
          const dup = existingRec.itens.some(
            it =>
              it.codigo === newItem.codigo &&
              it.descricao === newItem.descricao &&
              it.referencia === newItem.referencia &&
              (it.vencimento || 0) === (newItem.vencimento || 0) &&
              (it.desconto || 0) === (newItem.desconto || 0)
          );
          if (!dup) {
            existingRec.itens.push(newItem);
          }
        }

        // Atualiza bases e totais se a seção atual possui os totais finais (ex: página 2 de um holerite "A TRANSPORTAR")
        if (salarioBase > 0) {
          existingRec.salarioBase = salarioBase;
          existingEmp.salarioBase = salarioBase;
        }
        if (salContrINSS > 0) existingRec.salContrINSS = salContrINSS;
        if (baseCalcFGTS > 0) existingRec.baseCalcFGTS = baseCalcFGTS;
        if (fgtsDoMes > 0) existingRec.fgtsDoMes = fgtsDoMes;
        if (baseCalcIRRF > 0) existingRec.baseCalcIRRF = baseCalcIRRF;
        if (faixaIRRF > 0) existingRec.faixaIRRF = faixaIRRF;
        if (totalVencimentos > 0) existingRec.totalVencimentos = totalVencimentos;
        if (totalDescontos > 0) existingRec.totalDescontos = totalDescontos;
        if (valorLiquido > 0) existingRec.valorLiquido = valorLiquido;
        if (dadosBancariosTexto && !existingRec.dadosBancariosTexto) {
          existingRec.dadosBancariosTexto = dadosBancariosTexto;
        }
        if (mensagemRodape && !existingRec.mensagemRodape) {
          existingRec.mensagemRodape = mensagemRodape;
        }
        if (dataAdmissao && !existingEmp.dataAdmissao) {
          existingEmp.dataAdmissao = dataAdmissao;
        }
      } else {
        const receipt: PayReceipt = {
          id: `rec-${codigo}-${competencia}`,
          employeeCodigo: codigo,
          competencia,
          mesAno,
          tipoFolha: 'Folha Mensal',
          empregador: {
            razaoSocial: 'FRANCISCO JOSE BARBOSA NOBRE',
            cei: '800136945806',
            centroCusto: 'GERAL',
            regime: 'Mensalista'
          },
          salarioBase,
          salContrINSS,
          baseCalcFGTS,
          fgtsDoMes,
          baseCalcIRRF,
          faixaIRRF,
          totalVencimentos,
          totalDescontos,
          valorLiquido,
          ...(dadosBancariosTexto ? { dadosBancariosTexto } : {}),
          ...(mensagemRodape ? { mensagemRodape } : {}),
          dataEmissao: '30/09/2026',
          statusAssinatura: 'PENDENTE',
          historicoEnvios: [],
          itens
        };

        records.push({
          employee: {
            codigo,
            nome,
            dataAdmissao: dataAdmissao || '',
            salarioBase,
            cargo,
            cbo,
            departamento,
            filial
          },
          receipt
        });
      }
    } catch (err: any) {
      errors.push(`Página ${pageNum} (Seção ${i + 1}): ${err?.message || 'Erro ao processar'}`);
    }
  }

  // 7. Reconciliação contábil final de cada recibo
  for (const recObj of records) {
    const { receipt, employee } = recObj;
    const sumVenc = +receipt.itens.reduce((acc, it) => acc + (it.vencimento || 0), 0).toFixed(2);
    const sumDesc = +receipt.itens.reduce((acc, it) => acc + (it.desconto || 0), 0).toFixed(2);

    if (!receipt.totalVencimentos && sumVenc > 0) {
      receipt.totalVencimentos = sumVenc;
    }
    if (!receipt.totalDescontos && sumDesc > 0) {
      receipt.totalDescontos = sumDesc;
    }
    if (!receipt.valorLiquido && receipt.totalVencimentos > 0) {
      receipt.valorLiquido = +(receipt.totalVencimentos - receipt.totalDescontos).toFixed(2);
    }
    if (!receipt.salarioBase) {
      const horasNormais = receipt.itens.find(it => it.codigo === '1');
      receipt.salarioBase = horasNormais?.vencimento || receipt.totalVencimentos || 0;
      employee.salarioBase = receipt.salarioBase;
    }
  }

  return { records, errors };
}

function hasRubricTableGuard(hasRubricHeader: boolean, inRubricTable: boolean): boolean {
  return hasRubricHeader && !inRubricTable;
}
