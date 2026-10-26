import { SystemLog, SystemLogEventType, SystemLogCategory, Employee, PayReceipt, UserAccount, IncomeReport } from '../types';
import { saveSystemLogFirestore } from './firestoreService';
import { formatBRL } from '../utils/pdfGenerator';

const STORAGE_KEY_LOGS = 'system_logs_data';

export function formatLogDate(d: Date = new Date()): string {
  const dateStr = d.toLocaleDateString('pt-BR');
  const timeStr = d.toLocaleTimeString('pt-BR');
  return `${dateStr} às ${timeStr}`;
}

/**
 * Cria e persiste um registro de log no sistema (Local, Servidor e Firestore)
 */
export async function recordSystemLog(
  entry: Omit<SystemLog, 'id' | 'timestamp' | 'formattedDate'>
): Promise<SystemLog> {
  const now = new Date();
  const log: SystemLog = {
    id: `log-${now.getTime()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: now.toISOString(),
    formattedDate: formatLogDate(now),
    ...entry
  };

  // 1. LocalStorage
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LOGS);
    const existing: SystemLog[] = raw ? JSON.parse(raw) : [];
    const updated = [log, ...existing].slice(0, 500); // Mantém até 500 registros locais
    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(updated));
  } catch (e) {}

  // 2. Servidor permanente (VPS)
  try {
    fetch('/api/system-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ log })
    }).catch(() => {});
  } catch (e) {}

  // 3. Firestore
  try {
    saveSystemLogFirestore(log).catch(() => {});
  } catch (e) {}

  // 4. Custom event para notificar componentes na interface
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('applet:system_log_created', { detail: log }));
  }

  return log;
}

/**
 * Registra evento de Login
 */
export async function recordLoginEvent(
  user: UserAccount,
  emp?: Employee,
  details?: {
    is2FA?: boolean;
    channel?: 'WHATSAPP' | 'EMAIL' | 'PORTAL';
    success: boolean;
    errorMsg?: string;
  }
): Promise<SystemLog> {
  const isSuccess = details?.success ?? true;
  const is2FA = details?.is2FA ?? false;

  return recordSystemLog({
    tipoEvento: !isSuccess ? 'LOGIN_FALHA' : is2FA ? 'LOGIN_2FA' : 'LOGIN',
    categoria: 'LOGIN',
    canal: details?.channel || 'PORTAL',
    usuarioNome: user.nome || emp?.nome || 'Usuário Não Identificado',
    usuarioEmail: user.email || emp?.email,
    usuarioMatricula: user.employeeCodigo || emp?.codigo,
    usuarioRole: user.role || 'COLABORADOR',
    descricao: !isSuccess
      ? `Tentativa de login sem sucesso: ${details?.errorMsg || 'Credenciais inválidas'}`
      : is2FA
      ? `Login autenticado com sucesso via Dupla Autenticação (2FA)`
      : `Login efetuado no ${user.role === 'GESTOR' ? 'Painel do Gestor' : 'Portal do Colaborador'}`,
    sucesso: isSuccess,
    mensagemErro: details?.errorMsg,
    detalhes: {
      role: user.role,
      uid: user.uid,
      canal: details?.channel,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined
    }
  });
}

/**
 * Registra evento de Logout
 */
export async function recordLogoutEvent(user: UserAccount): Promise<SystemLog> {
  return recordSystemLog({
    tipoEvento: 'LOGOUT',
    categoria: 'LOGIN',
    canal: 'PORTAL',
    usuarioNome: user.nome || 'Usuário',
    usuarioEmail: user.email,
    usuarioMatricula: user.employeeCodigo,
    usuarioRole: user.role || 'COLABORADOR',
    descricao: `Sessão encerrada pelo usuário (${user.role === 'GESTOR' ? 'Gestor' : 'Colaborador'})`,
    sucesso: true,
    detalhes: { uid: user.uid }
  });
}

/**
 * Registra envio de WhatsApp (Holerite ou Lembrete)
 */
export async function recordWhatsAppDispatchEvent(
  employee: Employee,
  receipt: PayReceipt,
  options: {
    isReminder?: boolean;
    success: boolean;
    phone: string;
    errorMsg?: string;
  }
): Promise<SystemLog> {
  const isReminder = options.isReminder ?? false;
  const tipoEvento: SystemLogEventType = isReminder ? 'WHATSAPP_LEMBRETE' : 'WHATSAPP_ENVIO';

  return recordSystemLog({
    tipoEvento,
    categoria: 'COMUNICACAO',
    canal: 'WHATSAPP',
    usuarioNome: employee.nome,
    usuarioEmail: employee.email,
    usuarioMatricula: employee.codigo,
    usuarioRole: 'COLABORADOR',
    descricao: options.success
      ? `${isReminder ? 'Lembrete de assinatura pendente' : 'Holerite de ' + receipt.mesAno} enviado via WhatsApp Evolution API para ${options.phone}`
      : `Falha no envio via WhatsApp para ${options.phone}: ${options.errorMsg || 'Erro desconhecido'}`,
    sucesso: options.success,
    mensagemErro: options.errorMsg,
    detalhes: {
      receiptId: receipt.id,
      mesAno: receipt.mesAno,
      valorLiquido: receipt.valorLiquido,
      telefone: options.phone,
      isReminder
    }
  });
}

/**
 * Registra envio de E-mail (Holerite ou Lembrete)
 */
export async function recordEmailDispatchEvent(
  employee: Employee,
  receipt: PayReceipt,
  options: {
    isReminder?: boolean;
    success: boolean;
    email: string;
    errorMsg?: string;
  }
): Promise<SystemLog> {
  const isReminder = options.isReminder ?? false;
  const tipoEvento: SystemLogEventType = isReminder ? 'EMAIL_LEMBRETE' : 'EMAIL_ENVIO';

  return recordSystemLog({
    tipoEvento,
    categoria: 'COMUNICACAO',
    canal: 'EMAIL',
    usuarioNome: employee.nome,
    usuarioEmail: options.email,
    usuarioMatricula: employee.codigo,
    usuarioRole: 'COLABORADOR',
    descricao: options.success
      ? `${isReminder ? 'Lembrete de assinatura' : 'Recibo de pagamento ' + receipt.mesAno} enviado por E-mail para ${options.email}`
      : `Falha no envio por e-mail para ${options.email}: ${options.errorMsg || 'Erro desconhecido'}`,
    sucesso: options.success,
    mensagemErro: options.errorMsg,
    detalhes: {
      receiptId: receipt.id,
      mesAno: receipt.mesAno,
      valorLiquido: receipt.valorLiquido,
      email: options.email,
      isReminder
    }
  });
}

/**
 * Registra Assinatura Digital do Holerite
 */
export async function recordSignatureEvent(
  employee: Employee,
  receipt: PayReceipt,
  options: {
    metodo: 'WHATSAPP' | 'EMAIL';
    sucesso: boolean;
    codigoVerificacao?: string;
  }
): Promise<SystemLog> {
  return recordSystemLog({
    tipoEvento: 'ASSINATURA_HOLERITE',
    categoria: 'ASSINATURA',
    canal: options.metodo,
    usuarioNome: employee.nome,
    usuarioEmail: employee.email,
    usuarioMatricula: employee.codigo,
    usuarioRole: 'COLABORADOR',
    descricao: `Holerite de ${receipt.mesAno} (Líquido: R$ ${formatBRL(receipt.valorLiquido)}) assinado digitalmente com validação 2FA via ${options.metodo}`,
    sucesso: options.sucesso,
    detalhes: {
      receiptId: receipt.id,
      mesAno: receipt.mesAno,
      metodo: options.metodo,
      salarioBase: receipt.salarioBase,
      totalVencimentos: receipt.totalVencimentos,
      totalDescontos: receipt.totalDescontos,
      valorLiquido: receipt.valorLiquido
    }
  });
}

/**
 * Registra importação ou atualização de planilha XLS
 */
export async function recordSpreadsheetImportEvent(
  user: UserAccount,
  summary: {
    totalRows: number;
    matchedCount: number;
    newEmailsCount: number;
    newPhonesCount: number;
    newPasswordsCount: number;
  }
): Promise<SystemLog> {
  return recordSystemLog({
    tipoEvento: 'IMPORTACAO_PLANILHA',
    categoria: 'SISTEMA',
    canal: 'PORTAL',
    usuarioNome: user.nome || 'Gestor RH',
    usuarioEmail: user.email,
    usuarioMatricula: user.employeeCodigo,
    usuarioRole: 'GESTOR',
    descricao: `Planilha Excel importada com sucesso: ${summary.matchedCount} colaboradores vinculados, ${summary.newEmailsCount} e-mails, ${summary.newPhonesCount} telefones e ${summary.newPasswordsCount} senhas atualizadas.`,
    sucesso: true,
    detalhes: summary
  });
}

/**
 * Registra envio ou disponibilização de Comprovante de Rendimentos (IRPF)
 */
export async function recordIncomeReportEvent(
  report: {
    id: string;
    anoCalendario: string;
    exercicio: string;
    beneficiario: {
      nomeCompleto: string;
      cpf: string;
      employeeCodigo: string;
    };
  },
  emp?: Employee,
  options?: {
    canal?: 'PORTAL' | 'WHATSAPP' | 'EMAIL';
    sucesso?: boolean;
    errorMsg?: string;
    destino?: string;
  }
): Promise<SystemLog> {
  const canal = options?.canal || 'PORTAL';
  const sucesso = options?.sucesso ?? true;
  const nome = emp?.nome || report.beneficiario.nomeCompleto;
  const matricula = emp?.codigo || report.beneficiario.employeeCodigo;

  return recordSystemLog({
    tipoEvento: 'ENVIO_COMPROVANTE_IRPF',
    categoria: canal === 'PORTAL' ? 'DOCUMENTO' : 'COMUNICACAO',
    canal,
    usuarioNome: nome,
    usuarioEmail: emp?.email,
    usuarioMatricula: matricula,
    usuarioRole: 'COLABORADOR',
    descricao: sucesso
      ? canal === 'PORTAL'
        ? `Comprovante de Rendimentos IRPF (Ano-Calendário ${report.anoCalendario} / Exercício ${report.exercicio}) enviado e disponibilizado no Portal do Colaborador`
        : `Comprovante de Rendimentos IRPF (Ano-Calendário ${report.anoCalendario} / Exercício ${report.exercicio}) enviado via ${canal} para ${options?.destino || nome}`
      : `Falha ao enviar Comprovante de Rendimentos IRPF (${report.anoCalendario}) via ${canal}: ${options?.errorMsg || 'Erro'}`,
    sucesso,
    mensagemErro: options?.errorMsg,
    detalhes: {
      reportId: report.id,
      anoCalendario: report.anoCalendario,
      exercicio: report.exercicio,
      cpf: report.beneficiario.cpf,
      canal,
      destino: options?.destino
    }
  });
}

/**
 * Registra exclusão individual de holerite
 */
export async function recordDeleteReceiptEvent(
  manager: UserAccount | null,
  emp: Employee | undefined,
  receipt: PayReceipt
): Promise<SystemLog> {
  const nomeEmp = emp?.nome || `Colaborador #${receipt.employeeCodigo}`;
  return recordSystemLog({
    tipoEvento: 'EXCLUSAO_HOLERITE',
    categoria: 'DOCUMENTO',
    canal: 'PORTAL',
    usuarioNome: manager?.nome || 'Gestor RH',
    usuarioEmail: manager?.email,
    usuarioMatricula: manager?.employeeCodigo,
    usuarioRole: 'GESTOR',
    descricao: `Holerite de ${receipt.mesAno} (Líquido: R$ ${formatBRL(receipt.valorLiquido)}) de ${nomeEmp} foi excluído do sistema`,
    sucesso: true,
    detalhes: {
      receiptId: receipt.id,
      employeeCodigo: receipt.employeeCodigo,
      mesAno: receipt.mesAno,
      valorLiquido: receipt.valorLiquido,
      gestor: manager?.nome
    }
  });
}

/**
 * Registra exclusão de holerites em lote (por mês ou por ano)
 */
export async function recordBatchDeleteReceiptsEvent(
  manager: UserAccount | null,
  type: 'MES' | 'ANO',
  target: string,
  count: number
): Promise<SystemLog> {
  const label = type === 'MES' ? `do mês de ${target}` : `do ano de ${target}`;
  return recordSystemLog({
    tipoEvento: 'EXCLUSAO_HOLERITE',
    categoria: 'DOCUMENTO',
    canal: 'PORTAL',
    usuarioNome: manager?.nome || 'Gestor RH',
    usuarioEmail: manager?.email,
    usuarioMatricula: manager?.employeeCodigo,
    usuarioRole: 'GESTOR',
    descricao: `Exclusão em lote realizada: ${count} holerite(s) ${label} foram removidos permanentemente`,
    sucesso: true,
    detalhes: {
      tipoLote: type,
      alvo: target,
      quantidadeExcluida: count,
      gestor: manager?.nome
    }
  });
}

/**
 * Registra exclusão individual de informe de rendimentos IRPF
 */
export async function recordDeleteIncomeReportEvent(
  manager: UserAccount | null,
  report: IncomeReport
): Promise<SystemLog> {
  return recordSystemLog({
    tipoEvento: 'EXCLUSAO_IRPF',
    categoria: 'DOCUMENTO',
    canal: 'PORTAL',
    usuarioNome: manager?.nome || 'Gestor RH',
    usuarioEmail: manager?.email,
    usuarioMatricula: manager?.employeeCodigo,
    usuarioRole: 'GESTOR',
    descricao: `Comprovante de Rendimentos IRPF (${report.anoCalendario}) de ${report.beneficiario.nomeCompleto} foi excluído`,
    sucesso: true,
    detalhes: {
      reportId: report.id,
      anoCalendario: report.anoCalendario,
      cpf: report.beneficiario.cpf,
      gestor: manager?.nome
    }
  });
}

/**
 * Registra exclusão em lote de informes de IRPF por ano-calendário
 */
export async function recordBatchDeleteIncomeReportsEvent(
  manager: UserAccount | null,
  anoCalendario: string,
  count: number
): Promise<SystemLog> {
  return recordSystemLog({
    tipoEvento: 'EXCLUSAO_IRPF',
    categoria: 'DOCUMENTO',
    canal: 'PORTAL',
    usuarioNome: manager?.nome || 'Gestor RH',
    usuarioEmail: manager?.email,
    usuarioMatricula: manager?.employeeCodigo,
    usuarioRole: 'GESTOR',
    descricao: `Exclusão anual de IRPF: ${count} comprovante(s) do Ano-Calendário ${anoCalendario} foram removidos`,
    sucesso: true,
    detalhes: {
      anoCalendario,
      quantidadeExcluida: count,
      gestor: manager?.nome
    }
  });
}

/**
 * Registra exclusão de colaborador em cascata (remove holerites e IRPF)
 */
export async function recordDeleteEmployeeCascadeEvent(
  manager: UserAccount | null,
  emp: Employee,
  receiptsCount: number,
  irpfCount: number
): Promise<SystemLog> {
  return recordSystemLog({
    tipoEvento: 'EXCLUSAO_COLABORADOR',
    categoria: 'SISTEMA',
    canal: 'PORTAL',
    usuarioNome: manager?.nome || 'Gestor RH',
    usuarioEmail: manager?.email,
    usuarioMatricula: manager?.employeeCodigo,
    usuarioRole: 'GESTOR',
    descricao: `Colaborador ${emp.nome} (#${emp.codigo}) foi excluído com limpeza em cascata de ${receiptsCount} holerite(s) e ${irpfCount} comprovante(s) de IRPF`,
    sucesso: true,
    detalhes: {
      employeeCodigo: emp.codigo,
      employeeNome: emp.nome,
      cpf: emp.cpf,
      receiptsCount,
      irpfCount,
      gestor: manager?.nome
    }
  });
}

/**
 * Registra bloqueio ou desbloqueio de acesso do colaborador
 */
export async function recordToggleEmployeeBlockEvent(
  manager: UserAccount | null,
  emp: Employee,
  bloqueado: boolean,
  motivo?: string
): Promise<SystemLog> {
  return recordSystemLog({
    tipoEvento: bloqueado ? 'BLOQUEIO_COLABORADOR' : 'DESBLOQUEIO_COLABORADOR',
    categoria: 'SISTEMA',
    canal: 'PORTAL',
    usuarioNome: manager?.nome || 'Gestor RH',
    usuarioEmail: manager?.email,
    usuarioMatricula: manager?.employeeCodigo,
    usuarioRole: 'GESTOR',
    descricao: bloqueado
      ? `Acesso à plataforma BLOQUEADO para ${emp.nome} (#${emp.codigo})${motivo ? ` - Motivo: ${motivo}` : ''}`
      : `Acesso à plataforma DESBLOQUEADO para ${emp.nome} (#${emp.codigo})`,
    sucesso: true,
    detalhes: {
      employeeCodigo: emp.codigo,
      employeeNome: emp.nome,
      bloqueado,
      motivo,
      gestor: manager?.nome
    }
  });
}

/**
 * Amostra de histórico inicial para demonstração caso o banco de logs esteja zerado
 */
export function getInitialSampleLogs(): SystemLog[] {
  const now = new Date();
  const subMinutes = (m: number) => new Date(now.getTime() - m * 60 * 1000);
  const subHours = (h: number) => new Date(now.getTime() - h * 3600 * 1000);
  const subDays = (d: number) => new Date(now.getTime() - d * 24 * 3600 * 1000);

  return [
    {
      id: 'log-sample-1',
      timestamp: subMinutes(12).toISOString(),
      formattedDate: formatLogDate(subMinutes(12)),
      tipoEvento: 'LOGIN_2FA',
      categoria: 'LOGIN',
      canal: 'WHATSAPP',
      usuarioNome: 'Juliano César Gallice',
      usuarioEmail: 'julianogallice@gmail.com',
      usuarioMatricula: '6',
      usuarioRole: 'GESTOR',
      descricao: 'Login autenticado com sucesso via Dupla Autenticação (2FA)',
      sucesso: true,
      detalhes: { role: 'GESTOR', canal: 'WHATSAPP' }
    },
    {
      id: 'log-sample-2',
      timestamp: subMinutes(45).toISOString(),
      formattedDate: formatLogDate(subMinutes(45)),
      tipoEvento: 'WHATSAPP_ENVIO',
      categoria: 'COMUNICACAO',
      canal: 'WHATSAPP',
      usuarioNome: 'Carlos Eduardo Mendes',
      usuarioEmail: 'carlos.mendes@cartoriouberaba.com.br',
      usuarioMatricula: '101',
      usuarioRole: 'COLABORADOR',
      descricao: 'Holerite de Março/2026 enviado via WhatsApp Evolution API para +55 (34) 99888-7711',
      sucesso: true,
      detalhes: { mesAno: '03/2026', valorLiquido: 4520.50, telefone: '5534998887711' }
    },
    {
      id: 'log-sample-3',
      timestamp: subHours(2).toISOString(),
      formattedDate: formatLogDate(subHours(2)),
      tipoEvento: 'ASSINATURA_HOLERITE',
      categoria: 'ASSINATURA',
      canal: 'WHATSAPP',
      usuarioNome: 'Carlos Eduardo Mendes',
      usuarioEmail: 'carlos.mendes@cartoriouberaba.com.br',
      usuarioMatricula: '101',
      usuarioRole: 'COLABORADOR',
      descricao: 'Holerite de 03/2026 (Líquido: R$ 4.520,50) assinado digitalmente com validação 2FA via WHATSAPP',
      sucesso: true,
      detalhes: { mesAno: '03/2026', valorLiquido: 4520.50, metodo: 'WHATSAPP' }
    },
    {
      id: 'log-sample-4',
      timestamp: subHours(4).toISOString(),
      formattedDate: formatLogDate(subHours(4)),
      tipoEvento: 'EMAIL_ENVIO',
      categoria: 'COMUNICACAO',
      canal: 'EMAIL',
      usuarioNome: 'Mariana Silveira Ramos',
      usuarioEmail: 'mariana.silveira@cartoriouberaba.com.br',
      usuarioMatricula: '102',
      usuarioRole: 'COLABORADOR',
      descricao: 'Recibo de pagamento 03/2026 enviado por E-mail para mariana.silveira@cartoriouberaba.com.br',
      sucesso: true,
      detalhes: { mesAno: '03/2026', email: 'mariana.silveira@cartoriouberaba.com.br' }
    },
    {
      id: 'log-sample-5',
      timestamp: subHours(5).toISOString(),
      formattedDate: formatLogDate(subHours(5)),
      tipoEvento: 'LOGIN',
      categoria: 'LOGIN',
      canal: 'PORTAL',
      usuarioNome: 'Mariana Silveira Ramos',
      usuarioEmail: 'mariana.silveira@cartoriouberaba.com.br',
      usuarioMatricula: '102',
      usuarioRole: 'COLABORADOR',
      descricao: 'Login efetuado no Portal do Colaborador',
      sucesso: true
    },
    {
      id: 'log-sample-6',
      timestamp: subDays(1).toISOString(),
      formattedDate: formatLogDate(subDays(1)),
      tipoEvento: 'WHATSAPP_LEMBRETE',
      categoria: 'COMUNICACAO',
      canal: 'WHATSAPP',
      usuarioNome: 'Lucas Fernando Souza',
      usuarioEmail: 'lucas.souza@cartoriouberaba.com.br',
      usuarioMatricula: '103',
      usuarioRole: 'COLABORADOR',
      descricao: 'Lembrete de assinatura pendente enviado via WhatsApp Evolution API para +55 (34) 99777-6622',
      sucesso: true,
      detalhes: { mesAno: '03/2026', telefone: '5534997776622', isReminder: true }
    },
    {
      id: 'log-sample-7',
      timestamp: subDays(1).toISOString(),
      formattedDate: formatLogDate(subDays(1)),
      tipoEvento: 'IMPORTACAO_PLANILHA',
      categoria: 'SISTEMA',
      canal: 'PORTAL',
      usuarioNome: 'Juliano César Gallice',
      usuarioEmail: 'julianogallice@gmail.com',
      usuarioMatricula: '6',
      usuarioRole: 'GESTOR',
      descricao: 'Planilha Excel importada com sucesso: 15 colaboradores vinculados, 15 e-mails, 15 telefones e 15 senhas atualizadas.',
      sucesso: true
    }
  ];
}
