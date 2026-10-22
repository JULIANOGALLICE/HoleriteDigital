import { Employee, PayReceipt, UserAccount } from '../types';

export const INITIAL_EMPLOYERS = {
  razaoSocial: 'FRANCISCO JOSE BARBOSA NOBRE',
  cei: '800136945806',
  centroCusto: 'GERAL',
  regime: 'Mensalista'
};

export const INITIAL_EMPLOYEES: Employee[] = [
  {
    codigo: '6',
    nome: 'JULIANO CESAR GALLICE',
    cbo: '351405',
    cargo: 'ESCREVENTE II',
    departamento: 'CARTÓRIO GERAL',
    filial: '1',
    dataAdmissao: '02/03/2023',
    salarioBase: 8030.05,
    cpf: '284.912.758-44',
    rg: '34.812.905-1 SSP/SP',
    pisPasep: '170.82914.55-9',
    ctps: '048291/0023-SP',
    email: 'JulianoGallice@gmail.com',
    telefone: '(11) 98124-7763',
    status: 'ATIVO',
    endereco: {
      logradouro: 'Avenida Paulista',
      numero: '1842',
      complemento: 'Apto 102',
      bairro: 'Bela Vista',
      cidade: 'São Paulo',
      uf: 'SP',
      cep: '01310-200'
    },
    contatosFamiliares: [
      {
        id: 'cf-1',
        nome: 'Mariana Silva Gallice',
        parentesco: 'Esposa',
        telefone: '(11) 99341-8822',
        observacao: 'Contato principal em caso de emergência médica'
      },
      {
        id: 'cf-2',
        nome: 'Roberto Gallice',
        parentesco: 'Pai',
        telefone: '(11) 97112-4409',
        observacao: 'Avisar caso não consiga contato com esposa'
      }
    ],
    dadosBancarios: {
      banco: 'ITAÚ UNIBANCO S.A. (341)',
      agencia: '0451',
      conta: '38194-2',
      tipoConta: 'CORRENTE',
      chavePix: 'JulianoGallice@gmail.com'
    },
    dataNascimento: '1988-06-19',
    observacoes: 'Responsável pelo setor de escrituras e certidões.'
  },
  {
    codigo: '1',
    nome: 'ELAINE BLANSKY',
    cbo: '351405',
    cargo: 'ESCREVENTE SUBSTITUTA LEGAL',
    departamento: 'TABELIONATO DE NOTAS',
    filial: '1',
    dataAdmissao: '13/05/2010',
    salarioBase: 8787.49,
    cpf: '192.834.712-09',
    rg: '28.194.512-8 SSP/SP',
    pisPasep: '128.49120.34-1',
    ctps: '019284/0012-SP',
    email: 'elaine.blansky@cartorio.not.br',
    telefone: '(11) 98711-2345',
    status: 'ATIVO',
    endereco: {
      logradouro: 'Rua Bela Cintra',
      numero: '950',
      complemento: 'Conjunto 42',
      bairro: 'Consolação',
      cidade: 'São Paulo',
      uf: 'SP',
      cep: '01415-000'
    },
    contatosFamiliares: [
      {
        id: 'cf-3',
        nome: 'Carlos Eduardo Blansky',
        parentesco: 'Irmão',
        telefone: '(11) 98822-1144',
        observacao: 'Emergência'
      }
    ],
    dadosBancarios: {
      banco: 'CAIXA ECONOMICA FEDERAL 104',
      agencia: '3915 - 2',
      conta: '00008710-0',
      tipoConta: 'POUPANCA',
      chavePix: 'elaine.blansky@cartorio.not.br'
    },
    dataNascimento: '1982-04-12'
  },
  {
    codigo: '8',
    nome: 'ADRIANA DE FATIMA DA SILVA',
    cbo: '351405',
    cargo: 'ESCREVENTE I',
    departamento: 'REGISTRO CIVIL',
    filial: '1',
    dataAdmissao: '02/03/2023',
    salarioBase: 4110.54,
    cpf: '334.871.294-81',
    email: 'adriana.silva@cartorio.not.br',
    telefone: '(11) 97412-8991',
    status: 'ATIVO',
    endereco: {
      logradouro: 'Rua Vergueiro',
      numero: '2040',
      bairro: 'Vila Mariana',
      cidade: 'São Paulo',
      uf: 'SP',
      cep: '04102-000'
    },
    contatosFamiliares: [
      {
        id: 'cf-4',
        nome: 'Marcos Antonio da Silva',
        parentesco: 'Cônjuge',
        telefone: '(11) 99118-2390',
        observacao: 'Contato familiar'
      }
    ],
    dadosBancarios: {
      banco: 'BANCO DO BRASIL S.A. (001)',
      agencia: '1822-8',
      conta: '49120-1',
      tipoConta: 'CORRENTE',
      chavePix: '33487129481'
    },
    dataNascimento: '1990-09-14'
  },
  {
    codigo: '2',
    nome: 'LEONARDO SOUZA DE OLIVEIRA',
    cbo: '351405',
    cargo: 'ESCREVENTE',
    departamento: 'PROTESTO DE TÍTULOS',
    filial: '1',
    dataAdmissao: '07/01/2019',
    salarioBase: 3518.38,
    cpf: '409.112.873-19',
    email: 'leonardo.oliveira@cartorio.not.br',
    telefone: '(11) 96521-9988',
    status: 'ATIVO',
    endereco: {
      logradouro: 'Rua Domingos de Morais',
      numero: '1200',
      bairro: 'Vila Mariana',
      cidade: 'São Paulo',
      uf: 'SP',
      cep: '04010-100'
    },
    contatosFamiliares: [
      {
        id: 'cf-5',
        nome: 'Patricia Mendes de Oliveira',
        parentesco: 'Esposa',
        telefone: '(11) 97723-4411',
        observacao: 'Recente paternidade'
      }
    ],
    dadosBancarios: {
      banco: 'BRADESCO S/A 237',
      agencia: '1369 - 2',
      conta: '7371-7',
      tipoConta: 'CORRENTE'
    }
  },
  {
    codigo: '20',
    nome: 'ANDREA LUMARA CARMO MOTA',
    cbo: '351405',
    cargo: 'ESCREVENTE II',
    departamento: 'CARTÓRIO GERAL',
    filial: '1',
    dataAdmissao: '03/03/2023',
    salarioBase: 5094.21,
    cpf: '298.441.902-33',
    email: 'andrea.mota@cartorio.not.br',
    telefone: '(11) 99823-1100',
    status: 'ATIVO',
    endereco: {
      logradouro: 'Rua Haddock Lobo',
      numero: '710',
      bairro: 'Cerqueira César',
      cidade: 'São Paulo',
      uf: 'SP',
      cep: '01414-001'
    },
    contatosFamiliares: [
      {
        id: 'cf-6',
        nome: 'Lucia Carmo Mota',
        parentesco: 'Mãe',
        telefone: '(11) 98112-3344',
        observacao: 'Familiar próximo'
      }
    ],
    dadosBancarios: {
      banco: 'SANTANDER BRASIL (033)',
      agencia: '2109',
      conta: '13009841-2',
      tipoConta: 'CORRENTE'
    }
  },
  {
    codigo: '3',
    nome: 'MONA PAULA DA VEIGA MULLER',
    cbo: '351405',
    cargo: 'ESCREVENTE',
    departamento: 'AUTENTICAÇÕES E RECONHECIMENTO',
    filial: '1',
    dataAdmissao: '02/03/2023',
    salarioBase: 3319.23,
    cpf: '381.992.104-55',
    email: 'mona.muller@cartorio.not.br',
    telefone: '(11) 98451-2299',
    status: 'ATIVO',
    endereco: {
      logradouro: 'Alameda Santos',
      numero: '1432',
      bairro: 'Jardim Paulista',
      cidade: 'São Paulo',
      uf: 'SP',
      cep: '01418-100'
    },
    contatosFamiliares: [],
    dadosBancarios: {
      banco: 'ITAÚ UNIBANCO S.A. (341)',
      agencia: '0190',
      conta: '29104-5',
      tipoConta: 'CORRENTE'
    }
  },
  {
    codigo: '22',
    nome: 'ADRIANA PEREIRA DE SOUZA BRISOTI',
    cbo: '411025',
    cargo: 'AUXILIAR DE CARTORIO',
    departamento: 'ATENDIMENTO AO PÚBLICO',
    filial: '1',
    dataAdmissao: '03/03/2023',
    salarioBase: 3518.38,
    cpf: '210.998.412-76',
    email: 'adriana.brisoti@cartorio.not.br',
    telefone: '(11) 97200-4411',
    status: 'ATIVO',
    endereco: {
      logradouro: 'Rua Pamplona',
      numero: '512',
      bairro: 'Jardim Paulista',
      cidade: 'São Paulo',
      uf: 'SP',
      cep: '01405-000'
    },
    contatosFamiliares: [],
    dadosBancarios: {
      banco: 'BRADESCO S/A (237)',
      agencia: '0420',
      conta: '88210-9',
      tipoConta: 'CORRENTE'
    }
  },
  {
    codigo: '37',
    nome: 'AMANDA DE PAULA ANDOLFATO JAQUETTI',
    cbo: '411025',
    cargo: 'AUXILIAR DE CARTORIO',
    departamento: 'ATENDIMENTO AO PÚBLICO',
    filial: '1',
    dataAdmissao: '31/05/2024',
    salarioBase: 2759.17,
    cpf: '450.192.834-01',
    email: 'amanda.jaquetti@cartorio.not.br',
    telefone: '(11) 98334-1122',
    status: 'ATIVO',
    endereco: {
      logradouro: 'Rua Oscar Freire',
      numero: '220',
      bairro: 'Cerqueira César',
      cidade: 'São Paulo',
      uf: 'SP',
      cep: '01426-000'
    },
    contatosFamiliares: [],
    dadosBancarios: {
      banco: 'NUBANK (260)',
      agencia: '0001',
      conta: '9841290-3',
      tipoConta: 'CORRENTE'
    }
  },
  {
    codigo: '31',
    nome: 'ANA CAROLINA DE ANDRADE BORGES',
    cbo: '351405',
    cargo: 'ESCREVENTE',
    departamento: 'ESCRITURAS',
    filial: '1',
    dataAdmissao: '08/08/2023',
    salarioBase: 3151.65,
    cpf: '377.109.845-21',
    email: 'ana.andrade@cartorio.not.br',
    telefone: '(11) 96192-3344',
    status: 'ATIVO',
    endereco: {
      logradouro: 'Rua Augusta',
      numero: '2100',
      bairro: 'Consolação',
      cidade: 'São Paulo',
      uf: 'SP',
      cep: '01412-000'
    },
    contatosFamiliares: [],
    dadosBancarios: {
      banco: 'BANCO INTER (077)',
      agencia: '0001',
      conta: '551920-1',
      tipoConta: 'CORRENTE'
    }
  },
  {
    codigo: '78',
    nome: 'JULIANA FERREIRA SOARES',
    cbo: '514120',
    cargo: 'AUX. SERVIÇOS GERAIS',
    departamento: 'SUPORTE OPERACIONAL',
    filial: '1',
    dataAdmissao: '21/07/2026',
    salarioBase: 1880.48,
    cpf: '419.002.812-70',
    email: 'juliana.soares@cartorio.not.br',
    telefone: '(11) 97009-8811',
    status: 'ATIVO',
    endereco: {
      logradouro: 'Rua da Mooca',
      numero: '1540',
      bairro: 'Mooca',
      cidade: 'São Paulo',
      uf: 'SP',
      cep: '03104-001'
    },
    contatosFamiliares: [],
    dadosBancarios: {
      banco: 'CAIXA ECONOMICA FEDERAL (104)',
      agencia: '0281',
      conta: '19041-0',
      tipoConta: 'POUPANCA'
    }
  }
];

export const INITIAL_RECEIPTS: PayReceipt[] = [
  // JULIANO CESAR GALLICE - Setembro 2026 (exact values from page 21)
  {
    id: 'rec-6-2026-09',
    employeeCodigo: '6',
    competencia: '2026-09',
    mesAno: 'Setembro de 2026',
    tipoFolha: 'Folha Mensal',
    empregador: INITIAL_EMPLOYERS,
    salarioBase: 8030.05,
    salContrINSS: 8475.55,
    baseCalcFGTS: 10784.68,
    fgtsDoMes: 862.77,
    baseCalcIRRF: 9972.61,
    faixaIRRF: 27.50,
    totalVencimentos: 10960.68,
    totalDescontos: 5829.79,
    valorLiquido: 5130.89,
    dataEmissao: '30/09/2026',
    statusAssinatura: 'ASSINADO',
    dataAssinatura: '01/10/2026 14:22:10',
    ipAssinatura: '189.120.44.18 (Certificado Digital)',
    historicoEnvios: [
      {
        id: 'env-1',
        tipo: 'WHATSAPP',
        data: '01/10/2026 09:30',
        destinatario: '(11) 98124-7763',
        status: 'ENTREGUE'
      },
      {
        id: 'env-2',
        tipo: 'EMAIL',
        data: '01/10/2026 09:31',
        destinatario: 'JulianoGallice@gmail.com',
        status: 'ENTREGUE'
      }
    ],
    itens: [
      { codigo: '1', descricao: 'HORAS NORMAIS', referencia: '220:00', vencimento: 8030.05, desconto: null },
      { codigo: '250', descricao: 'REFLEXO EXTRAS DSR', referencia: '0,00', vencimento: 400.77, desconto: null },
      { codigo: '150', descricao: 'HORAS EXTRAS', referencia: '36:36', vencimento: 2003.86, desconto: null },
      { codigo: '20', descricao: 'GRATIFICACOES', referencia: '350,00', vencimento: 350.00, desconto: null },
      { codigo: '219', descricao: 'ABONO - CLAUSULA 11ª CCT', referencia: '176,00', vencimento: 176.00, desconto: null },
      { codigo: '201', descricao: 'DESCONTO CONVENIO MEDICO', referencia: '', vencimento: null, desconto: 568.38 },
      { codigo: '205', descricao: 'PLANO DENTAL', referencia: '', vencimento: null, desconto: 30.58 },
      { codigo: '998', descricao: 'I.N.S.S.', referencia: '9,16', vencimento: null, desconto: 988.07 },
      { codigo: '999', descricao: 'IMPOSTO DE RENDA', referencia: '27,50', vencimento: null, desconto: 1833.74 },
      { codigo: '981', descricao: 'DESC.ADIANT.SALARIAL', referencia: '', vencimento: null, desconto: 2409.02 }
    ]
  },

  // JULIANO CESAR GALLICE - Agosto 2026 (Historical)
  {
    id: 'rec-6-2026-08',
    employeeCodigo: '6',
    competencia: '2026-08',
    mesAno: 'Agosto de 2026',
    tipoFolha: 'Folha Mensal',
    empregador: INITIAL_EMPLOYERS,
    salarioBase: 8030.05,
    salContrINSS: 8475.55,
    baseCalcFGTS: 10420.30,
    fgtsDoMes: 833.62,
    baseCalcIRRF: 9610.15,
    faixaIRRF: 27.50,
    totalVencimentos: 10596.30,
    totalDescontos: 5612.40,
    valorLiquido: 4983.90,
    dataEmissao: '31/08/2026',
    statusAssinatura: 'ASSINADO',
    dataAssinatura: '02/09/2026 11:05:43',
    ipAssinatura: '189.120.44.18',
    historicoEnvios: [
      {
        id: 'env-3',
        tipo: 'WHATSAPP',
        data: '01/09/2026 09:00',
        destinatario: '(11) 98124-7763',
        status: 'ENTREGUE'
      }
    ],
    itens: [
      { codigo: '1', descricao: 'HORAS NORMAIS', referencia: '220:00', vencimento: 8030.05, desconto: null },
      { codigo: '250', descricao: 'REFLEXO EXTRAS DSR', referencia: '0,00', vencimento: 340.25, desconto: null },
      { codigo: '150', descricao: 'HORAS EXTRAS', referencia: '30:00', vencimento: 1700.00, desconto: null },
      { codigo: '20', descricao: 'GRATIFICACOES', referencia: '350,00', vencimento: 350.00, desconto: null },
      { codigo: '219', descricao: 'ABONO - CLAUSULA 11ª CCT', referencia: '176,00', vencimento: 176.00, desconto: null },
      { codigo: '201', descricao: 'DESCONTO CONVENIO MEDICO', referencia: '', vencimento: null, desconto: 568.38 },
      { codigo: '205', descricao: 'PLANO DENTAL', referencia: '', vencimento: null, desconto: 30.58 },
      { codigo: '998', descricao: 'I.N.S.S.', referencia: '9,16', vencimento: null, desconto: 988.07 },
      { codigo: '999', descricao: 'IMPOSTO DE RENDA', referencia: '27,50', vencimento: null, desconto: 1616.35 },
      { codigo: '981', descricao: 'DESC.ADIANT.SALARIAL', referencia: '', vencimento: null, desconto: 2409.02 }
    ]
  },

  // JULIANO CESAR GALLICE - Julho 2026 (Historical)
  {
    id: 'rec-6-2026-07',
    employeeCodigo: '6',
    competencia: '2026-07',
    mesAno: 'Julho de 2026',
    tipoFolha: 'Folha Mensal',
    empregador: INITIAL_EMPLOYERS,
    salarioBase: 8030.05,
    salContrINSS: 8475.55,
    baseCalcFGTS: 10180.00,
    fgtsDoMes: 814.40,
    baseCalcIRRF: 9380.00,
    faixaIRRF: 27.50,
    totalVencimentos: 10356.05,
    totalDescontos: 5490.20,
    valorLiquido: 4865.85,
    dataEmissao: '31/07/2026',
    statusAssinatura: 'ASSINADO',
    dataAssinatura: '03/08/2026 16:40:02',
    historicoEnvios: [],
    itens: [
      { codigo: '1', descricao: 'HORAS NORMAIS', referencia: '220:00', vencimento: 8030.05, desconto: null },
      { codigo: '250', descricao: 'REFLEXO EXTRAS DSR', referencia: '0,00', vencimento: 300.00, desconto: null },
      { codigo: '150', descricao: 'HORAS EXTRAS', referencia: '26:00', vencimento: 1500.00, desconto: null },
      { codigo: '20', descricao: 'GRATIFICACOES', referencia: '350,00', vencimento: 350.00, desconto: null },
      { codigo: '219', descricao: 'ABONO - CLAUSULA 11ª CCT', referencia: '176,00', vencimento: 176.00, desconto: null },
      { codigo: '201', descricao: 'DESCONTO CONVENIO MEDICO', referencia: '', vencimento: null, desconto: 568.38 },
      { codigo: '205', descricao: 'PLANO DENTAL', referencia: '', vencimento: null, desconto: 30.58 },
      { codigo: '998', descricao: 'I.N.S.S.', referencia: '9,16', vencimento: null, desconto: 988.07 },
      { codigo: '999', descricao: 'IMPOSTO DE RENDA', referencia: '27,50', vencimento: null, desconto: 1494.15 },
      { codigo: '981', descricao: 'DESC.ADIANT.SALARIAL', referencia: '', vencimento: null, desconto: 2409.02 }
    ]
  },

  // ELAINE BLANSKY - Setembro 2026 (exact values from page 13)
  {
    id: 'rec-1-2026-09',
    employeeCodigo: '1',
    competencia: '2026-09',
    mesAno: 'Setembro de 2026',
    tipoFolha: 'Folha Mensal',
    empregador: INITIAL_EMPLOYERS,
    salarioBase: 8787.49,
    salContrINSS: 8475.55,
    baseCalcFGTS: 9138.99,
    fgtsDoMes: 731.11,
    baseCalcIRRF: 8326.92,
    faixaIRRF: 27.50,
    totalVencimentos: 9314.99,
    totalDescontos: 2679.47,
    valorLiquido: 6635.52,
    dadosBancariosTexto: 'CAIXA ECONOMICA FEDERAL 104 Agência: 3915 - 2 conta poupança: 00008710-0',
    dataEmissao: '30/09/2026',
    statusAssinatura: 'PENDENTE',
    historicoEnvios: [],
    itens: [
      { codigo: '1', descricao: 'HORAS NORMAIS', referencia: '220:00', vencimento: 8787.49, desconto: null },
      { codigo: '202', descricao: 'ADICIONAL TEMPO DE SERVIÇO 4% CCT', referencia: '4,00', vencimento: 351.50, desconto: null },
      { codigo: '219', descricao: 'ABONO - CLAUSULA 11ª CCT', referencia: '176,00', vencimento: 176.00, desconto: null },
      { codigo: '201', descricao: 'DESCONTO CONVENIO MEDICO', referencia: '310,23', vencimento: null, desconto: 310.23 },
      { codigo: '998', descricao: 'I.N.S.S.', referencia: '10,81', vencimento: null, desconto: 988.07 },
      { codigo: '999', descricao: 'IMPOSTO DE RENDA', referencia: '27,50', vencimento: null, desconto: 1381.17 }
    ]
  },

  // ADRIANA DE FATIMA DA SILVA - Setembro 2026 (exact values from page 1)
  {
    id: 'rec-8-2026-09',
    employeeCodigo: '8',
    competencia: '2026-09',
    mesAno: 'Setembro de 2026',
    tipoFolha: 'Folha Mensal',
    empregador: INITIAL_EMPLOYERS,
    salarioBase: 4110.54,
    salContrINSS: 4753.47,
    baseCalcFGTS: 4753.47,
    fgtsDoMes: 380.27,
    baseCalcIRRF: 4322.27,
    faixaIRRF: 22.50,
    totalVencimentos: 4929.47,
    totalDescontos: 1700.14,
    valorLiquido: 3229.33,
    mensagemRodape: '*** PARABÉNS PELO SEU ANIVERSÁRIO NO DIA 14 DE SETEMBRO ***',
    dataEmissao: '30/09/2026',
    statusAssinatura: 'ASSINADO',
    dataAssinatura: '02/10/2026 10:14:00',
    historicoEnvios: [],
    itens: [
      { codigo: '1', descricao: 'HORAS NORMAIS', referencia: '220:00', vencimento: 4110.54, desconto: null },
      { codigo: '250', descricao: 'REFLEXO EXTRAS DSR', referencia: '0,00', vencimento: 98.82, desconto: null },
      { codigo: '150', descricao: 'HORAS EXTRAS', referencia: '17:38', vencimento: 494.11, desconto: null },
      { codigo: '20', descricao: 'GRATIFICACOES', referencia: '50,00', vencimento: 50.00, desconto: null },
      { codigo: '219', descricao: 'ABONO - CLAUSULA 11ª CCT', referencia: '176,00', vencimento: 176.00, desconto: null },
      { codigo: '998', descricao: 'I.N.S.S.', referencia: '9,82', vencimento: null, desconto: 466.98 },
      { codigo: '981', descricao: 'DESC.ADIANT.SALARIAL', referencia: '1.233,16', vencimento: null, desconto: 1233.16 }
    ]
  },

  // LEONARDO SOUZA DE OLIVEIRA - Setembro 2026 (exact values from page 22)
  {
    id: 'rec-2-2026-09',
    employeeCodigo: '2',
    competencia: '2026-09',
    mesAno: 'Setembro de 2026',
    tipoFolha: 'Folha Mensal',
    empregador: INITIAL_EMPLOYERS,
    salarioBase: 3518.38,
    salContrINSS: 4222.59,
    baseCalcFGTS: 4222.59,
    fgtsDoMes: 337.80,
    baseCalcIRRF: 1478.55,
    faixaIRRF: 0.00,
    totalVencimentos: 4398.59,
    totalDescontos: 2477.09,
    valorLiquido: 1921.50,
    dadosBancariosTexto: 'BRADESCO S/A 237 Agência: 1369 - 2 conta corrente: 7371-7',
    dataEmissao: '30/09/2026',
    statusAssinatura: 'PENDENTE',
    historicoEnvios: [],
    itens: [
      { codigo: '1', descricao: 'HORAS NORMAIS', referencia: '80:40', vencimento: 1290.07, desconto: null },
      { codigo: '203', descricao: 'ADICIONAL TEMPO DE SERVIÇO 2% CCT', referencia: '2,00', vencimento: 25.80, desconto: null },
      { codigo: '8136', descricao: 'LICENÇA PATERNIDADE', referencia: '36:40', vencimento: 586.40, desconto: null },
      { codigo: '250', descricao: 'REFLEXO EXTRAS DSR', referencia: '0,00', vencimento: 1.36, desconto: null },
      { codigo: '150', descricao: 'HORAS EXTRAS', referencia: '0:15', vencimento: 6.12, desconto: null },
      { codigo: '3', descricao: 'HORAS FERIAS', referencia: '102:40', vencimento: 1641.91, desconto: null },
      { codigo: '805', descricao: 'MEDIA VALOR FERIAS', referencia: '13,07', vencimento: 13.07, desconto: null },
      { codigo: '806', descricao: 'MEDIA HORAS FERIAS', referencia: '46,81', vencimento: 46.81, desconto: null },
      { codigo: '807', descricao: 'VANTAGENS FERIAS', referencia: '32,84', vencimento: 32.84, desconto: null },
      { codigo: '931', descricao: '1/3 DAS FERIAS', referencia: '33,33', vencimento: 578.21, desconto: null },
      { codigo: '219', descricao: 'ABONO - CLAUSULA 11ª CCT', referencia: '176,00', vencimento: 176.00, desconto: null },
      { codigo: '937', descricao: 'ADIANTAMENTO DE FERIAS', referencia: '0,00', vencimento: null, desconto: 2081.79 },
      { codigo: '812', descricao: 'INSS FERIAS', referencia: '9,99', vencimento: null, desconto: 231.05 },
      { codigo: '821', descricao: 'INSS DIFERENCA FERIAS', referencia: '0,00', vencimento: null, desconto: 16.70 },
      { codigo: '998', descricao: 'I.N.S.S.', referencia: '7,73', vencimento: null, desconto: 147.55 }
    ]
  },

  // ANDREA LUMARA CARMO MOTA - Setembro 2026 (exact values from page 6)
  {
    id: 'rec-20-2026-09',
    employeeCodigo: '20',
    competencia: '2026-09',
    mesAno: 'Setembro de 2026',
    tipoFolha: 'Folha Mensal',
    empregador: INITIAL_EMPLOYERS,
    salarioBase: 5094.21,
    salContrINSS: 5465.17,
    baseCalcFGTS: 5465.17,
    fgtsDoMes: 437.21,
    baseCalcIRRF: 5033.97,
    faixaIRRF: 27.50,
    totalVencimentos: 5641.17,
    totalDescontos: 2873.25,
    valorLiquido: 2767.92,
    dataEmissao: '30/09/2026',
    statusAssinatura: 'PENDENTE',
    historicoEnvios: [],
    itens: [
      { codigo: '1', descricao: 'HORAS NORMAIS', referencia: '220:00', vencimento: 5094.21, desconto: null },
      { codigo: '250', descricao: 'REFLEXO EXTRAS DSR', referencia: '0,00', vencimento: 61.83, desconto: null },
      { codigo: '150', descricao: 'HORAS EXTRAS', referencia: '8:54', vencimento: 309.13, desconto: null },
      { codigo: '219', descricao: 'ABONO - CLAUSULA 11ª CCT', referencia: '176,00', vencimento: 176.00, desconto: null },
      { codigo: '201', descricao: 'DESCONTO CONVENIO MEDICO', referencia: '499,71', vencimento: null, desconto: 499.71 },
      { codigo: '205', descricao: 'PLANO DENTAL', referencia: '30,58', vencimento: null, desconto: 30.58 },
      { codigo: '998', descricao: 'I.N.S.S.', referencia: '10,37', vencimento: null, desconto: 566.62 },
      { codigo: '999', descricao: 'IMPOSTO DE RENDA', referencia: '27,50', vencimento: null, desconto: 248.08 },
      { codigo: '981', descricao: 'DESC.ADIANT.SALARIAL', referencia: '1.528,26', vencimento: null, desconto: 1528.26 }
    ]
  },

  // MONA PAULA DA VEIGA MULLER - Setembro 2026 (exact values from page 27)
  {
    id: 'rec-3-2026-09',
    employeeCodigo: '3',
    competencia: '2026-09',
    mesAno: 'Setembro de 2026',
    tipoFolha: 'Folha Mensal',
    empregador: INITIAL_EMPLOYERS,
    salarioBase: 3319.23,
    salContrINSS: 5248.22,
    baseCalcFGTS: 5248.22,
    fgtsDoMes: 419.85,
    baseCalcIRRF: 4698.38,
    faixaIRRF: 27.50,
    totalVencimentos: 5433.27,
    totalDescontos: 1667.98,
    valorLiquido: 3765.29,
    dataEmissao: '30/09/2026',
    statusAssinatura: 'PENDENTE',
    historicoEnvios: [],
    itens: [
      { codigo: '1', descricao: 'HORAS NORMAIS', referencia: '220:00', vencimento: 3319.23, desconto: null },
      { codigo: '250', descricao: 'REFLEXO EXTRAS DSR', referencia: '0,00', vencimento: 262.52, desconto: null },
      { codigo: '854', descricao: 'REFLEXO ADIC. NOTURNO DSR', referencia: '0,00', vencimento: 2.15, desconto: null },
      { codigo: '150', descricao: 'HORAS EXTRAS', referencia: '58:00', vencimento: 1312.60, desconto: null },
      { codigo: '25', descricao: 'ADICIONAL NOTURNO (INFOR)', referencia: '3:34', vencimento: 10.77, desconto: null },
      { codigo: '20', descricao: 'GRATIFICACOES', referencia: '350,00', vencimento: 350.00, desconto: null },
      { codigo: '219', descricao: 'ABONO - CLAUSULA 11ª CCT', referencia: '176,00', vencimento: 176.00, desconto: null },
      { codigo: '998', descricao: 'I.N.S.S.', referencia: '10,22', vencimento: null, desconto: 536.25 },
      { codigo: '999', descricao: 'IMPOSTO DE RENDA', referencia: '27,50', vencimento: null, desconto: 126.91 },
      { codigo: '981', descricao: 'DESC.ADIANT.SALARIAL', referencia: '995,77', vencimento: null, desconto: 995.77 },
      { codigo: '8069', descricao: 'HORAS FALTAS PARCIAL', referencia: '0:36', vencimento: null, desconto: 9.05 }
    ]
  },

  // AMANDA DE PAULA ANDOLFATO JAQUETTI - Setembro 2026 (exact values from page 4)
  {
    id: 'rec-37-2026-09',
    employeeCodigo: '37',
    competencia: '2026-09',
    mesAno: 'Setembro de 2026',
    tipoFolha: 'Folha Mensal',
    empregador: INITIAL_EMPLOYERS,
    salarioBase: 2759.17,
    salContrINSS: 3313.97,
    baseCalcFGTS: 3313.97,
    fgtsDoMes: 265.11,
    baseCalcIRRF: 2882.77,
    faixaIRRF: 15.00,
    totalVencimentos: 3490.60,
    totalDescontos: 317.47,
    valorLiquido: 3173.13,
    dataEmissao: '30/09/2026',
    statusAssinatura: 'PENDENTE',
    historicoEnvios: [],
    itens: [
      { codigo: '1', descricao: 'HORAS NORMAIS', referencia: '220:00', vencimento: 2759.17, desconto: null },
      { codigo: '250', descricao: 'REFLEXO EXTRAS DSR', referencia: '0,00', vencimento: 34.24, desconto: null },
      { codigo: '150', descricao: 'HORAS EXTRAS', referencia: '9:06', vencimento: 171.19, desconto: null },
      { codigo: '20', descricao: 'GRATIFICACOES', referencia: '350,00', vencimento: 350.00, desconto: null },
      { codigo: '219', descricao: 'ABONO - CLAUSULA 11ª CCT', referencia: '176,00', vencimento: 176.00, desconto: null },
      { codigo: '205', descricao: 'PLANO DENTAL', referencia: '30,58', vencimento: null, desconto: 30.58 },
      { codigo: '998', descricao: 'I.N.S.S.', referencia: '8,64', vencimento: null, desconto: 286.26 },
      { codigo: '8069', descricao: 'HORAS FALTAS PARCIAL', referencia: '0:03', vencimento: null, desconto: 0.63 }
    ]
  },

  // JULIANA FERREIRA SOARES - Setembro 2026 (exact values from page 20)
  {
    id: 'rec-78-2026-09',
    employeeCodigo: '78',
    competencia: '2026-09',
    mesAno: 'Setembro de 2026',
    tipoFolha: 'Folha Mensal',
    empregador: INITIAL_EMPLOYERS,
    salarioBase: 1880.48,
    salContrINSS: 2997.98,
    baseCalcFGTS: 2997.98,
    fgtsDoMes: 239.83,
    baseCalcIRRF: 2566.78,
    faixaIRRF: 7.50,
    totalVencimentos: 3174.15,
    totalDescontos: 248.51,
    valorLiquido: 2925.64,
    dataEmissao: '30/09/2026',
    statusAssinatura: 'PENDENTE',
    historicoEnvios: [],
    itens: [
      { codigo: '1', descricao: 'HORAS NORMAIS', referencia: '220:00', vencimento: 1880.48, desconto: null },
      { codigo: '250', descricao: 'REFLEXO EXTRAS DSR', referencia: '0,00', vencimento: 72.99, desconto: null },
      { codigo: '854', descricao: 'REFLEXO ADIC. NOTURNO DSR', referencia: '0,00', vencimento: 0.92, desconto: null },
      { codigo: '150', descricao: 'HORAS EXTRAS', referencia: '24:17', vencimento: 364.97, desconto: null },
      { codigo: '16', descricao: 'INSALUBRIDADE 20%', referencia: '20,00', vencimento: 324.17, desconto: null },
      { codigo: '25', descricao: 'ADICIONAL NOTURNO (INFOR)', referencia: '2:42', vencimento: 4.62, desconto: null },
      { codigo: '20', descricao: 'GRATIFICACOES', referencia: '350,00', vencimento: 350.00, desconto: null },
      { codigo: '219', descricao: 'ABONO - CLAUSULA 11ª CCT', referencia: '176,00', vencimento: 176.00, desconto: null },
      { codigo: '998', descricao: 'I.N.S.S.', referencia: '8,28', vencimento: null, desconto: 248.34 },
      { codigo: '8069', descricao: 'HORAS FALTAS PARCIAL', referencia: '0:01', vencimento: null, desconto: 0.17 }
    ]
  }
];

export const INITIAL_USERS: UserAccount[] = [
  {
    uid: 'gestor-juliano-master',
    email: 'julianogallice@gmail.com',
    senha: '@Def18441',
    role: 'GESTOR',
    employeeCodigo: '6',
    nome: 'Juliano César Gallice (Gestor Master)',
    criadoEm: '2026-01-01T08:00:00.000Z'
  },
  {
    uid: 'user-colab-1',
    email: 'elaine.blansky@cartorio.not.br',
    senha: '123456',
    role: 'COLABORADOR',
    employeeCodigo: '1',
    nome: 'Elaine Blansky',
    criadoEm: '2026-01-01T08:00:00.000Z'
  },
  {
    uid: 'user-colab-8',
    email: 'adriana.silva@cartorio.not.br',
    senha: '123456',
    role: 'COLABORADOR',
    employeeCodigo: '8',
    nome: 'Adriana de Fatima da Silva',
    criadoEm: '2026-01-01T08:00:00.000Z'
  }
];
