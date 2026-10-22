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
  // Converte formato brasileiro: "4.110,54" ou "1.233,16" -> 4110.54
  const clean = valStr.trim().replace(/\./g, '').replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

export function parsePayrollText(rawText: string): ParseResult {
  const records: ParsedRecord[] = [];
  const errors: string[] = [];

  if (!rawText || rawText.trim().length === 0) {
    return { records: [], errors: ['Texto da folha vazio ou não fornecido.'] };
  }

  // 1. Identificar se o texto está estruturado por páginas ("=== PAGE X ===")
  const hasPageMarkers = /===\s*PAGE\s*\d+\s*===/i.test(rawText);
  let sections: { text: string; pageNum: number }[] = [];

  if (hasPageMarkers) {
    const pageSplits = rawText.split(/(?====\s*PAGE\s*\d+\s*===)/gi);
    let pIdx = 1;
    for (const p of pageSplits) {
      const trimmed = p.trim();
      if (!trimmed) continue;
      const pageMatch = trimmed.match(/===\s*PAGE\s*(\d+)\s*===/i);
      const pageNum = pageMatch ? parseInt(pageMatch[1], 10) : pIdx;
      pIdx++;

      // Uma página pode conter 2 vias (Empresa e Empregado) do mesmo colaborador
      // ou 2 colaboradores distintos. Separamos apenas pelo empregador ou recibo de pagamento.
      const subRecibos = trimmed.split(/(?=(?:FRANCISCO JOS[EÉ] BARBOSA NOBRE|Recibo de Pagamento de Sal[áa]rio|Recibo de Pagamento)\b)/gi);
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
    // Sem marcadores de página (ex: texto colado ou OCR corrido)
    const rawChunks = rawText.split(/(?=(?:FRANCISCO JOS[EÉ] BARBOSA NOBRE|Recibo de Pagamento de Sal[áa]rio|Recibo de Pagamento)\b)/gi);
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

  // Termos de cabeçalho e títulos que NÃO são nomes de pessoas
  const IGNORE_NAME_TERMS = [
    'FRANCISCO', 'BARBOSA', 'NOBRE', 'CARTORIO', 'CARTÓRIO',
    'FOLHA', 'MENSAL', 'RECIBO', 'PAGAMENTO', 'SALARIO', 'SALÁRIO',
    'VENCIMENTOS', 'DESCONTOS', 'LIQUIDO', 'LÍQUIDO', 'HORAS',
    'NORMAIS', 'INSS', 'IRRF', 'FGTS', 'MENSALISTA', 'GERAL',
    'EMPREGADO', 'FUNCIONARIO', 'FUNCIONÁRIO', 'DEPARTAMENTO',
    'FILIAL', 'ADMISSAO', 'ADMISSÃO', 'SALARIO BASE', 'SALÁRIO BASE',
    'DESCRICAO', 'DESCRIÇÃO', 'REFERENCIA', 'REFERÊNCIA', 'DISCRIMINAÇÃO'
  ];

  for (let i = 0; i < sections.length; i++) {
    const { text: section, pageNum } = sections[i];

    // Verifica se a seção possui dados essenciais de holerite
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
      // 1. Extração de Competência / Mês e Ano
      let mesAno = 'Setembro de 2026';
      let competencia = '2026-09';

      const mesAnoMatch = section.match(/(?:Folha Mensal|Folha|M[êe]s|Compet[êe]ncia)[\s\r\n:]*([A-Za-zçãéíóú]+)\s+(?:de\s+)?(20\d\d)/i);
      const numCompMatch = section.match(/(?:Compet[êe]ncia|Folha Mensal|M[êe]s)[\s\r\n:]*(\d{2})[\/\-](\d{4})/i);

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

      // 2. Extração de Código e Nome do Colaborador
      let codigo = '';
      let nome = '';
      let cbo = '351405';
      let departamento = 'CARTÓRIO GERAL';
      let filial = '1';

      const lines = section.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);

      // Estratégia A: Linha após cabeçalho "Código Nome do Funcionário CBO..."
      for (let l = 0; l < lines.length; l++) {
        const line = lines[l];
        if (line.match(/C[óo]digo/i) && line.match(/Nome/i)) {
          const nextLine = lines[l + 1] || '';
          const matchNext = nextLine.match(/^(\d{1,5})\s+([A-ZÀ-Ú\s]{4,50}?)(?:\s+(\d{4,7}|\d{4}-\d{2}))?(?:\s+(\d+))?(?:\s+(\d+))?$/);
          if (matchNext) {
            codigo = matchNext[1];
            nome = matchNext[2].trim();
            if (matchNext[3]) cbo = matchNext[3].replace('-', '');
            if (matchNext[4]) departamento = matchNext[4];
            if (matchNext[5]) filial = matchNext[5];
            break;
          }
        }
      }

      // Estratégia B: Formato linear com rótulos
      // Ex: "Código 8 Nome do Funcionário ADRIANA DE FATIMA DA SILVA CBO 351405 Departamento 1 Filial 1"
      if (!codigo || !nome) {
        const inlineMatch = section.match(/(?:Código|Codigo)\s*[:\s]*(\d{1,5})\s+(?:Nome(?:\s+do\s+Funcion[áa]rio|\s+do\s+Empregado)?\s*[:\s]*)?([A-ZÀ-Ú\s]{4,50}?)(?:\s+CBO|\s+Dep|\s+Filial|\r|\n|$)/i);
        if (inlineMatch) {
          codigo = inlineMatch[1].trim();
          nome = inlineMatch[2].trim();
        }
      }

      // Estratégia C: Linha com número seguido de nome maiúsculo e CBO
      // Ex: "8 ADRIANA DE FATIMA DA SILVA 351405 1 1"
      if (!codigo || !nome) {
        for (const line of lines) {
          const rowMatch = line.match(/^(\d{1,5})\s+([A-ZÀ-Ú\s]{4,50}?)\s+(\d{4,7}|\d{4}-\d{2})(?:\s+(\d+))?(?:\s+(\d+))?$/);
          if (rowMatch) {
            const potentialName = rowMatch[2].trim();
            const isInvalid = IGNORE_NAME_TERMS.some(t => potentialName.includes(t));
            if (!isInvalid) {
              codigo = rowMatch[1];
              nome = potentialName;
              if (rowMatch[3]) cbo = rowMatch[3].replace('-', '');
              if (rowMatch[4]) departamento = rowMatch[4];
              if (rowMatch[5]) filial = rowMatch[5];
              break;
            }
          }
        }
      }

      // Estratégia D: Rótulos específicos com dois pontos
      if (!codigo) {
        const cMatch = section.match(/(?:Código|Codigo|Matr[íi]cula)\s*[:\s]+(\d{1,5})\b/i);
        if (cMatch) codigo = cMatch[1];
      }
      if (!nome) {
        const nMatch = section.match(/(?:Nome(?:\s+do\s+Funcion[áa]rio|\s+do\s+Empregado|\s+do\s+Trabalhador)?)\s*[:\s]+([A-ZÀ-Ú\s]{4,50})/i);
        if (nMatch) {
          const candidate = nMatch[1].replace(/(?:CBO|Departamento|Filial|Admiss[ãa]o|Cargo|Função).*$/i, '').trim();
          if (!IGNORE_NAME_TERMS.some(t => candidate === t)) {
            nome = candidate;
          }
        }
      }

      // Estratégia E: Padrão "8 - NOME"
      if (!codigo || !nome) {
        const dashMatch = section.match(/(?:^|\n)\s*(\d{1,5})\s*[-–]\s*([A-ZÀ-Ú\s]{4,50})/);
        if (dashMatch) {
          const candidate = dashMatch[2].trim();
          if (!IGNORE_NAME_TERMS.some(t => candidate.includes(t))) {
            codigo = dashMatch[1];
            nome = candidate;
          }
        }
      }

      // Estratégia F: Procura nome em maiúsculas na página
      if (!nome) {
        for (const line of lines) {
          if (
            line.match(/^[A-ZÀ-Ú\s]{5,50}$/) &&
            !IGNORE_NAME_TERMS.some(t => line.includes(t)) &&
            line.split(' ').length >= 2
          ) {
            nome = line;
            break;
          }
        }
      }

      // Se nenhum código foi identificado, utiliza o identificador único da página
      // para NUNCA sobrescrever outro colaborador!
      if (!codigo) {
        codigo = String(pageNum);
      }

      // Limpa nome
      if (nome) {
        nome = nome.replace(/\s+/g, ' ').trim();
      } else {
        nome = `COLABORADOR ${codigo}`;
      }

      // 3. Extração de CBO
      const cboMatch = section.match(/CBO\s*[:\s]*(\d{4,7}|\d{4}-\d{2})/i);
      if (cboMatch) {
        cbo = cboMatch[1].replace('-', '').trim();
      }

      // 4. Extração de Departamento / Filial
      const depMatch = section.match(/Departamento\s*[:\s]*([^\n\r\t]+)/i);
      if (depMatch) {
        const val = depMatch[1].split(/Filial|\n|\r/)[0].trim();
        if (val) departamento = val;
      }
      const filMatch = section.match(/Filial\s*[:\s]*(\d+)/i);
      if (filMatch) {
        filial = filMatch[1].trim();
      }

      // 5. Extração de Data de Admissão
      let dataAdmissao = '';
      const admissaoMatch = section.match(/Admiss[ãa]o\s*[:\s]*(\d{2}\/\d{2}\/\d{4})/i);
      if (admissaoMatch) {
        dataAdmissao = admissaoMatch[1].trim();
      }

      // 6. Extração de Cargo
      let cargo = 'ESCREVENTE';
      if (section.match(/ESCREVENTE SUBSTITUTA LEGAL|ESCREVENTE SUBSTITUTO LEGAL/i)) {
        cargo = 'ESCREVENTE SUBSTITUTA LEGAL';
      } else if (section.match(/ESCREVENTE II/i)) {
        cargo = 'ESCREVENTE II';
      } else if (section.match(/ESCREVENTE I/i)) {
        cargo = 'ESCREVENTE I';
      } else if (section.match(/AUXILIAR DE CARTORIO|AUXILIAR DE CARTÓRIO/i)) {
        cargo = 'AUXILIAR DE CARTÓRIO';
      } else if (section.match(/AUX\. SERVIÇOS GERAIS|AUX\. SERVICOS GERAIS|SERVIÇOS GERAIS/i)) {
        cargo = 'AUX. SERVIÇOS GERAIS';
      } else if (section.match(/ESCREVENTE/i)) {
        cargo = 'ESCREVENTE';
      } else {
        const cargoPreAdmissao = section.match(/([A-ZÀ-Ú\s\.\-]{3,40})\s+Admiss[ãa]o/i);
        if (cargoPreAdmissao && cargoPreAdmissao[1].trim().length > 3) {
          cargo = cargoPreAdmissao[1].trim();
        }
      }

      // 7. Extração de Valores e Totais
      let salarioBase = 0;
      let salContrINSS = 0;
      let baseCalcFGTS = 0;
      let fgtsDoMes = 0;
      let baseCalcIRRF = 0;
      let faixaIRRF = 0;
      let totalVencimentos = 0;
      let totalDescontos = 0;
      let valorLiquido = 0;

      // 7.1 Rótulos diretos ("Total de Vencimentos: 4.929,47")
      const salBaseMatch = section.match(/Sal[áa]rio\s+Base\s*[:\n\r\t\s]*([\d\.,]+)/i);
      if (salBaseMatch) salarioBase = parseCurrency(salBaseMatch[1]);

      const inssBaseMatch = section.match(/Sal\.?\s*Contr\.?\s*INSS\s*[:\n\r\t\s]*([\d\.,]+)/i);
      if (inssBaseMatch) salContrINSS = parseCurrency(inssBaseMatch[1]);

      const fgtsBaseMatch = section.match(/Base\s+C[áa]lc\.?\s+FGTS\s*[:\n\r\t\s]*([\d\.,]+)/i);
      if (fgtsBaseMatch) baseCalcFGTS = parseCurrency(fgtsBaseMatch[1]);

      const fgtsMesMatch = section.match(/F\.?G\.?T\.?S\.?\s+(?:do\s+)?M[êe]s\s*[:\n\r\t\s]*([\d\.,]+)/i);
      if (fgtsMesMatch) fgtsDoMes = parseCurrency(fgtsMesMatch[1]);

      const irrfBaseMatch = section.match(/Base\s+C[áa]lc\.?\s+IRRF\s*[:\n\r\t\s]*([\d\.,]+)/i);
      if (irrfBaseMatch) baseCalcIRRF = parseCurrency(irrfBaseMatch[1]);

      const faixaMatch = section.match(/Faixa\s+IRRF\s*[:\n\r\t\s]*([\d\.,]+)/i);
      if (faixaMatch) faixaIRRF = parseCurrency(faixaMatch[1]);

      const vencMatch = section.match(/(?:Total\s+de\s+Vencimentos|Total\s+Vencimentos)\s*[:\n\r\t\s]*([\d\.,]+)/i);
      if (vencMatch) totalVencimentos = parseCurrency(vencMatch[1]);

      const descMatch = section.match(/(?:Total\s+de\s+Descontos|Total\s+Descontos)\s*[:\n\r\t\s]*([\d\.,]+)/i);
      if (descMatch) totalDescontos = parseCurrency(descMatch[1]);

      const liqMatch = section.match(/(?:Valor\s+L[íi]quido|L[íi]quido\s+a\s+Receber|Total\s+L[íi]quido)\s*[^\d\n\r]*([\d\.,]+)/i);
      if (liqMatch) valorLiquido = parseCurrency(liqMatch[1]);

      // 7.2 Tabela colunar de totais
      if (!totalVencimentos || !valorLiquido) {
        const columnarTotals = section.match(/(?:Total\s+de\s+Vencimentos|Total\s+Vencimentos).*?(?:Total\s+de\s+Descontos|Total\s+Descontos).*?(?:Valor\s+L[íi]quido|L[íi]quido)[\r\n\s]+([\d\.,]+)\s+([\d\.,]+)\s+([\d\.,]+)/i);
        if (columnarTotals) {
          totalVencimentos = parseCurrency(columnarTotals[1]);
          totalDescontos = parseCurrency(columnarTotals[2]);
          valorLiquido = parseCurrency(columnarTotals[3]);
        }
      }

      // 7.3 Tabela colunar de bases
      if (!salarioBase) {
        const columnarBases = section.match(/Sal[áa]rio\s+Base.*?Sal\.?\s*Contr.*?Base\s+C[áa]lc.*?FGTS[\r\n\s]+([\d\.,]+)\s+([\d\.,]+)\s+([\d\.,]+)\s+([\d\.,]+)\s+([\d\.,]+)/i);
        if (columnarBases) {
          salarioBase = parseCurrency(columnarBases[1]);
          salContrINSS = parseCurrency(columnarBases[2]);
          baseCalcFGTS = parseCurrency(columnarBases[3]);
          fgtsDoMes = parseCurrency(columnarBases[4]);
          baseCalcIRRF = parseCurrency(columnarBases[5]);
        }
      }

      // 8. Extração das Rubricas / Itens
      const itens: ReceiptItem[] = [];
      const knownItems = [
        { code: '1', name: 'HORAS NORMAIS', isProvento: true },
        { code: '250', name: 'REFLEXO EXTRAS DSR', isProvento: true },
        { code: '854', name: 'REFLEXO ADIC. NOTURNO DSR', isProvento: true },
        { code: '150', name: 'HORAS EXTRAS', isProvento: true },
        { code: '20', name: 'GRATIFICACOES', isProvento: true },
        { code: '219', name: 'ABONO - CLAUSULA 11ª CCT', isProvento: true },
        { code: '202', name: 'ADICIONAL TEMPO DE SERVIÇO 4% CCT', isProvento: true },
        { code: '203', name: 'ADICIONAL TEMPO DE SERVIÇO 2% CCT', isProvento: true },
        { code: '16', name: 'INSALUBRIDADE 20%', isProvento: true },
        { code: '25', name: 'ADICIONAL NOTURNO (INFOR)', isProvento: true },
        { code: '940', name: 'DIFERENCA DE FERIAS', isProvento: true },
        { code: '8112', name: 'DIFERENCA DE 1/3 DE FERIAS', isProvento: true },
        { code: '8189', name: 'DIFERENCA MEDIA HORA FERIAS', isProvento: true },
        { code: '3', name: 'HORAS FERIAS', isProvento: true },
        { code: '931', name: '1/3 DAS FERIAS', isProvento: true },
        { code: '805', name: 'MEDIA VALOR FERIAS', isProvento: true },
        { code: '806', name: 'MEDIA HORAS FERIAS', isProvento: true },
        { code: '807', name: 'VANTAGENS FERIAS', isProvento: true },
        { code: '8136', name: 'LICENÇA PATERNIDADE', isProvento: true },
        { code: '9755', name: 'ESTORNO DESC PROV EMPRESTIMO TRAB ADIANT', isProvento: true },
        { code: '201', name: 'DESCONTO CONVENIO MEDICO', isProvento: false },
        { code: '205', name: 'PLANO DENTAL', isProvento: false },
        { code: '998', name: 'I.N.S.S.', isProvento: false },
        { code: '999', name: 'IMPOSTO DE RENDA', isProvento: false },
        { code: '981', name: 'DESC.ADIANT.SALARIAL', isProvento: false },
        { code: '8069', name: 'HORAS FALTAS PARCIAL', isProvento: false },
        { code: '937', name: 'ADIANTAMENTO DE FERIAS', isProvento: false },
        { code: '812', name: 'INSS FERIAS', isProvento: false },
        { code: '821', name: 'INSS DIFERENCA FERIAS', isProvento: false }
      ];

      for (const line of lines) {
        // Padrão genérico de rubrica:
        // Ex: "1 HORAS NORMAIS 220:00 4.110,54" ou "981 DESC.ADIANT.SALARIAL 1.233,16 1.233,16"
        const rubricMatch = line.match(/^(\d{1,5})\s+([A-ZÀ-Ú0-9\.\-\/\sªºçãéíóúÁÉÍÓÚÂÊÎÔÛÃÕ]+?)\s+([\d\.,]+|(?:\d+:\d+))\s+([\d\.,]+)(?:\s+([\d\.,]+))?$/);
        if (rubricMatch) {
          const itemCode = rubricMatch[1];
          const itemDesc = rubricMatch[2].trim();
          const itemRef = rubricMatch[3];
          const val1 = parseCurrency(rubricMatch[4]);
          const val2 = rubricMatch[5] ? parseCurrency(rubricMatch[5]) : null;

          if (
            !itens.some(it => it.codigo === itemCode) &&
            !itemDesc.includes('SALARIO BASE') &&
            !itemDesc.includes('TOTAL')
          ) {
            const known = knownItems.find(k => k.code === itemCode || itemDesc.includes(k.name));
            let isDiscount = false;
            if (known) {
              isDiscount = !known.isProvento;
            } else {
              isDiscount =
                parseInt(itemCode, 10) >= 900 ||
                itemDesc.includes('DESC') ||
                itemDesc.includes('INSS') ||
                itemDesc.includes('IRRF') ||
                itemDesc.includes('FALTA') ||
                itemDesc.includes('CONVENIO') ||
                itemDesc.includes('PLANO');
            }

            itens.push({
              codigo: itemCode,
              descricao: itemDesc,
              referencia: itemRef,
              vencimento: !isDiscount ? val1 : null,
              desconto: isDiscount ? (val2 || val1) : null
            });
          }
        }
      }

      // Se nenhum item foi lido, mas temos salário base, cria o padrão CLT
      if (itens.length === 0 && (salarioBase > 0 || totalVencimentos > 0)) {
        const base = salarioBase || totalVencimentos || 2000;
        itens.push({
          codigo: '1',
          descricao: 'HORAS NORMAIS',
          referencia: '220:00',
          vencimento: base,
          desconto: null
        });
        const inssVal = totalDescontos > 0 ? totalDescontos : +(base * 0.085).toFixed(2);
        itens.push({
          codigo: '998',
          descricao: 'I.N.S.S.',
          referencia: '8,50',
          vencimento: null,
          desconto: inssVal
        });
      }

      // Recalcula totais a partir dos itens se estavam zerados
      if (!totalVencimentos && itens.length > 0) {
        totalVencimentos = +itens.reduce((acc, it) => acc + (it.vencimento || 0), 0).toFixed(2);
      }
      if (!totalDescontos && itens.length > 0) {
        totalDescontos = +itens.reduce((acc, it) => acc + (it.desconto || 0), 0).toFixed(2);
      }
      if (!valorLiquido && totalVencimentos) {
        valorLiquido = +(totalVencimentos - totalDescontos).toFixed(2);
      }
      if (!salarioBase) {
        salarioBase = totalVencimentos || 2000;
      }

      // 9. Monta o registro do recibo
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
        salarioBase: salarioBase || 2000,
        salContrINSS: salContrINSS || salarioBase || 2000,
        baseCalcFGTS: baseCalcFGTS || salarioBase || 2000,
        fgtsDoMes: fgtsDoMes || +(salarioBase * 0.08).toFixed(2),
        baseCalcIRRF: baseCalcIRRF || salarioBase || 2000,
        faixaIRRF: faixaIRRF || 0,
        totalVencimentos: totalVencimentos || salarioBase || 2000,
        totalDescontos: totalDescontos || 0,
        valorLiquido: valorLiquido || +(totalVencimentos - totalDescontos).toFixed(2) || salarioBase || 2000,
        dataEmissao: '30/09/2026',
        statusAssinatura: 'PENDENTE',
        historicoEnvios: [],
        itens
      };

      const existingIdx = records.findIndex(r => r.employee.codigo === codigo);
      if (existingIdx >= 0) {
        // Se já existe (ex: via do empregado e via da empresa na mesma folha),
        // atualiza apenas se a nova leitura for mais rica em itens ou valores
        if (itens.length > records[existingIdx].receipt.itens.length || (valorLiquido > 0 && records[existingIdx].receipt.valorLiquido === 0)) {
          records[existingIdx].receipt = receipt;
          if (nome && nome !== `COLABORADOR ${codigo}`) {
            records[existingIdx].employee.nome = nome;
          }
        }
      } else {
        records.push({
          employee: {
            codigo,
            nome,
            dataAdmissao: dataAdmissao || '',
            salarioBase: salarioBase || 0,
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

  return { records, errors };
}
