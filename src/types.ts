export interface EmergencyContact {
  id: string;
  nome: string;
  parentesco: string;
  telefone: string;
  observacao?: string;
}

export interface BankAccount {
  banco: string;
  agencia: string;
  conta: string;
  tipoConta: 'CORRENTE' | 'POUPANCA' | 'SALARIO';
  chavePix?: string;
}

export interface Address {
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
}

export interface Employee {
  id?: string;
  codigo: string;
  nome: string;
  cbo: string;
  cargo: string;
  departamento: string;
  filial: string;
  dataAdmissao: string;
  salarioBase: number;
  cpf: string;
  rg?: string;
  pisPasep?: string;
  ctps?: string;
  email: string;
  telefone: string;
  endereco: Address;
  contatosFamiliares: EmergencyContact[];
  dadosBancarios?: BankAccount;
  dataNascimento?: string;
  observacoes?: string;
  status: 'ATIVO' | 'AFASTADO' | 'FERIAS' | 'DESLIGADO';
  role?: 'COLABORADOR' | 'GESTOR' | 'ADMIN';
  authUid?: string;
  cadastroCompleto?: boolean;
}

export interface ReceiptItem {
  codigo: string;
  descricao: string;
  referencia: string;
  vencimento: number | null;
  desconto: number | null;
}

export interface PayReceipt {
  id: string;
  employeeCodigo: string;
  competencia: string; // "2026-09"
  mesAno: string;      // "Setembro de 2026"
  tipoFolha: 'Folha Mensal' | 'Adiantamento Salarial' | '13º Salário' | 'Férias' | 'Rescisão';
  empregador: {
    razaoSocial: string;
    cei: string;
    centroCusto: string;
    regime: string;
  };
  salarioBase: number;
  salContrINSS: number;
  baseCalcFGTS: number;
  fgtsDoMes: number;
  baseCalcIRRF: number;
  faixaIRRF: number;
  totalVencimentos: number;
  totalDescontos: number;
  valorLiquido: number;
  mensagemRodape?: string;
  dadosBancariosTexto?: string;
  itens: ReceiptItem[];
  dataEmissao: string;
  statusAssinatura: 'PENDENTE' | 'ASSINADO';
  dataAssinatura?: string;
  ipAssinatura?: string;
  codigoAssinatura?: string;
  metodoAssinatura?: 'WHATSAPP' | 'EMAIL';
  historicoEnvios: Array<{
    id: string;
    tipo: 'WHATSAPP' | 'EMAIL';
    data: string;
    destinatario: string;
    status: 'ENVIADO' | 'ENTREGUE';
  }>;
}

export interface SignatureVerification {
  id?: string;
  codigo: string;
  receiptId: string;
  employeeCodigo: string;
  canal: 'EMAIL' | 'WHATSAPP';
  destinatario: string;
  criadoEm: string;
  status: 'PENDENTE' | 'UTILIZADO' | 'EXPIRADO';
}

export interface DigitalCertificateA1 {
  id?: string;
  titular: string;
  documentoTitular: string; // CNPJ ou CPF
  autoridadeCertificadora: string;
  numeroSerie: string;
  validadeInicio: string;
  validadeFim: string;
  status: 'ATIVO' | 'EXPIRADO' | 'PENDENTE';
  thumbprintSha256: string;
  arquivoNome?: string;
  carregadoEm: string;
  tipoCertificado: 'A1_ICP_BRASIL' | 'E_CNPJ' | 'E_CPF';
  assinaturaAutomaticaPdf: boolean;
  pfxBase64?: string;
  pfxPassword?: string;
}

export interface SystemConfig {
  id?: string;
  razaoSocial: string;
  cei: string;
  centroCusto: string;
  regime: string;
  exigirCodigoAssinatura: boolean;
  canalAssinaturaPadrao: 'WHATSAPP' | 'EMAIL' | 'AMBOS';
  mensagemWhatsappPadrao: string;
  emailRemetente: string;
  emailNomeRemetente: string;
  emailReplyTo: string;
  emailProvider: 'SMTP' | 'GMAIL_APP' | 'TESTE_LOCAL' | 'RESEND' | 'SENDGRID' | 'INTEGRADO';
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
  smtpSecure?: boolean;
  emailApiKey?: string;
  emailTemplateAssunto?: string;
  emailTemplateCorpo?: string;
  diasPrazoAssinatura: number;
  certificadoA1?: DigitalCertificateA1;
  exigirCompletarCadastroPrimeiroAcesso: boolean;
  whatsappProvider?: 'EVOLUTION_API';
  evolutionApiUrl?: string;
  evolutionApiKey?: string;
  evolutionInstance?: string;
  enviarPdfAutomaticoWhatsapp?: boolean;
}

export interface UserAccount {
  uid: string;
  email: string;
  senha?: string;
  role: 'GESTOR' | 'COLABORADOR';
  employeeCodigo?: string;
  nome: string;
  criadoEm: string;
  ultimoAcesso?: string;
  primeiroAcessoConcluido?: boolean;
  senhaTemporaria?: boolean;
  precisaTrocarSenha?: boolean;
  exigirCompletarCadastro?: boolean;
}

export interface MedicalCertificate {
  id: string;
  protocolo: string; // Ex: #AT-2026-0042
  employeeCodigo: string;
  employeeNome: string;
  employeeCpf?: string;
  employeeDepartamento?: string;
  dataEmissaoAtestado: string; // YYYY-MM-DD
  dataInicioAfastamento: string; // YYYY-MM-DD
  diasAfastamento: number; // Quantidade de dias
  dataRetorno: string; // Data prevista de retorno
  cid?: string; // Código CID-10
  nomeMedico?: string;
  crmMedico?: string; // CRM / CRO e UF
  tipoAtestado: 'MEDICO' | 'ODONTOLOGICO' | 'COMPARECIMENTO' | 'ACOMPANHAMENTO' | 'DECLARACAO_HORAS';
  motivoObservacao?: string;
  arquivoNome: string;
  arquivoBase64: string; // Base64 data URL
  arquivoTipo: string;   // 'image/jpeg' | 'image/png' | 'application/pdf'
  arquivoTamanhoBytes?: number;
  status: 'PENDENTE' | 'APROVADO' | 'REJEITADO' | 'ARQUIVADO';
  criadoEm: string; // ISO date string
  analisadoPor?: string; // Nome ou email do Gestor/RH
  analisadoEm?: string;
  parecerRH?: string;
}

export interface IncomeReport {
  id: string; // Ex: "irpf-000008-2025"
  exercicio: string; // "2026"
  anoCalendario: string; // "2025"
  
  // 1. Fonte Pagadora Pessoa Jurídica ou Pessoa Física
  fontePagadora: {
    cnpjCpf: string; // "461.946.067-20"
    nomeEmpresarial: string; // "FRANCISCO JOSE BARBOSA NOBRE"
  };

  // 2. Pessoa Física Beneficiária dos Rendimentos
  beneficiario: {
    cpf: string; // "071.867.799-48"
    nomeCompleto: string; // "ADRIANA DE FATIMA DA SILVA"
    employeeCodigo: string; // "8" ou "000008"
    naturezaRendimento: string; // "RENDIMENTO DO TRABALHO ASSALARIADO NO PAÍS"
  };

  // 3. Rendimentos Tributáveis, Deduções e Imposto sobre a Renda Retido na Fonte
  rendimentosTributaveis: {
    totalRendimentos: number; // 1. Total dos rendimentos (inclusive férias)
    contribuicaoPrevidenciaria: number; // 2. Contribuição previdenciária oficial
    previdenciaComplementar: number; // 3. Previdência complementar / Fapi
    pensaoAlimenticia: number; // 4. Pensão alimentícia
    impostoRetidoFonte: number; // 5. Imposto sobre a Renda Retido na Fonte (IRRF)
  };

  // 4. Rendimentos Isentos e Não Tributáveis
  rendimentosIsentos: {
    parcelaIsentaAposentadoria: number;
    parcelaIsenta13Aposentadoria: number;
    diariasAjudaCusto: number;
    pensaoMolestiaGrave: number;
    lucrosDividendos: number;
    valoresPagosSocio: number;
    indenizacoesRescisao: number; // 7. Indenizações por rescisão de contrato
    jurosMora: number;
    outrosEspecificar?: string; // Ex: "Abono Pecuniário"
    outrosValor: number; // 9. Outros
  };

  // 5. Rendimentos Sujeitos a Tributação Exclusiva (rendimento líquido)
  tributacaoExclusiva: {
    decimoTerceiroSalario: number; // 1. 13º salário
    irrfDecimoTerceiro: number; // 2. IRRF sobre 13º salário
    outros: number; // 3. Outros
  };

  // 6. Rendimentos Recebidos Acumuladamente (RRA) - Art. 12-A
  rendimentosRRA?: {
    totalRendimentosTributaveis: number;
    exclusaoDespesasAcaoJudicial: number;
    deducaoContribuicaoPrevidenciaria: number;
    deducaoPensaoAlimenticia: number;
    impostoRetidoFonte: number;
    rendimentosIsentosMolestia: number;
    quantidadeMeses?: number;
  };

  // 7. Informações Complementares
  informacoesComplementares?: string;

  // 8. Responsável pelas Informações
  responsavel: {
    nome: string; // "PEDRO RAFAEL DA SILVEIRA"
    data: string; // "13/02/2026"
  };

  // Arquivo PDF original dividido exclusivamente para este colaborador
  arquivoPdfOriginal?: {
    nomeArquivo: string;
    base64: string; // Data URL do PDF de 1 página extraído do documento original
    numeroPaginaOrigem?: number;
    totalPaginasOrigem?: number;
  };

  criadoEm: string;
}
