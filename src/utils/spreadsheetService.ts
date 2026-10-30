import * as XLSX from 'xlsx';
import { Employee, UserAccount } from '../types';

export interface SpreadsheetChangeDetail {
  matricula: string;
  nome: string;
  cpf: string;
  oldEmail: string;
  newEmail: string;
  oldPhone: string;
  newPhone: string;
  oldSenha: string;
  newSenha: string;
  role: 'COLABORADOR' | 'GESTOR';
  status: string;
  isMatched: boolean;
  hasChange: boolean;
}

export interface SpreadsheetAnalysisResult {
  totalRows: number;
  matchedCount: number;
  unmatchedCount: number;
  newEmailsCount: number;
  newPhonesCount: number;
  newPasswordsCount: number;
  changes: SpreadsheetChangeDetail[];
  rawRows: any[];
}

/**
 * Normaliza strings para busca e comparacão de colunas
 */
function normalizeKey(key: string): string {
  return (key || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Exporta a base completa de colaboradores e usuários para planilha Excel (.xlsx)
 */
export function exportEmployeesToXLSX(employees: Employee[], users: UserAccount[]): void {
  // Mapa de usuários para lookup rápido por código de funcionário e e-mail
  const usersByCod = new Map<string, UserAccount>();
  const usersByEmail = new Map<string, UserAccount>();
  const usersByName = new Map<string, UserAccount>();

  users.forEach(u => {
    if (u.employeeCodigo) usersByCod.set(u.employeeCodigo.trim().toLowerCase(), u);
    if (u.email) usersByEmail.set(u.email.trim().toLowerCase(), u);
    if (u.nome) usersByName.set(u.nome.trim().toLowerCase(), u);
  });

  const sortedEmployees = [...employees].sort((a, b) =>
    (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' })
  );

  const rows = sortedEmployees.map(emp => {
    const codClean = (emp.codigo || '').trim().toLowerCase();
    const emailClean = (emp.email || '').trim().toLowerCase();
    const nameClean = (emp.nome || '').trim().toLowerCase();

    const matchedUser = usersByCod.get(codClean) || usersByEmail.get(emailClean) || usersByName.get(nameClean);

    return {
      'Matricula': emp.codigo || '',
      'Nome_Completo': emp.nome || '',
      'CPF': emp.cpf || '',
      'Cargo': emp.cargo || '',
      'Email_Acesso': matchedUser?.email || emp.email || '',
      'Telefone_WhatsApp': emp.telefone || '',
      'Senha_Inicial': matchedUser?.senha || '',
      'Perfil_Acesso': matchedUser?.role || 'COLABORADOR',
      'Status_Colaborador': emp.status || 'ATIVO'
    };
  });

  // Criar planilha de dados
  const ws = XLSX.utils.json_to_sheet(rows);

  // Configurar larguras ideais de colunas
  ws['!cols'] = [
    { wch: 12 }, // Matricula
    { wch: 34 }, // Nome_Completo
    { wch: 16 }, // CPF
    { wch: 26 }, // Cargo
    { wch: 32 }, // Email_Acesso
    { wch: 18 }, // Telefone_WhatsApp
    { wch: 16 }, // Senha_Inicial
    { wch: 15 }, // Perfil_Acesso
    { wch: 14 }  // Status_Colaborador
  ];

  // Criar planilha de instruções
  const instructions = [
    { 'Orientações para o Gestor de RH': '1. PREENCHIMENTO DOS CAMPOS:' },
    { 'Orientações para o Gestor de RH': '   - Matricula: Código do colaborador no sistema (NÃO ALTERE para garantir a vinculação).' },
    { 'Orientações para o Gestor de RH': '   - Nome_Completo e CPF: Dados cadastrais para conferência.' },
    { 'Orientações para o Gestor de RH': '   - Email_Acesso: E-mail que o funcionário usará para login e notificações de holerite.' },
    { 'Orientações para o Gestor de RH': '   - Telefone_WhatsApp: Celular com DDD (ex: 34999998888 ou (34) 99999-8888) para envio via Evolution API.' },
    { 'Orientações para o Gestor de RH': '   - Senha_Inicial: Senha temporária que o colaborador utilizará no primeiro acesso.' },
    { 'Orientações para o Gestor de RH': '   - Perfil_Acesso: COLABORADOR ou GESTOR.' },
    { 'Orientações para o Gestor de RH': '' },
    { 'Orientações para o Gestor de RH': '2. COMO ATUALIZAR:' },
    { 'Orientações para o Gestor de RH': '   - Preencha ou altere os e-mails, telefones e senhas nesta planilha.' },
    { 'Orientações para o Gestor de RH': '   - Salve o arquivo mantendo o formato Excel (.xlsx ou .xls).' },
    { 'Orientações para o Gestor de RH': '   - Acesse Configurações > Planilha de Usuários (XLS) no sistema e envie o arquivo preenchido.' }
  ];
  const wsInstructions = XLSX.utils.json_to_sheet(instructions);
  wsInstructions['!cols'] = [{ wch: 110 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Colaboradores_Usuarios');
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instrucoes_Preenchimento');

  const todayStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `HoleriteDigital_Usuarios_Colaboradores_${todayStr}.xlsx`);
}

/**
 * Baixa um modelo em branco com 2 linhas de exemplo
 */
export function downloadBlankEmployeesTemplateXLSX(): void {
  const sampleRows = [
    {
      'Matricula': '101',
      'Nome_Completo': 'Exemplo Silva da Silva',
      'CPF': '123.456.789-00',
      'Cargo': 'Escrevente',
      'Email_Acesso': 'exemplo.silva@cartorio.com.br',
      'Telefone_WhatsApp': '(34) 99888-7766',
      'Senha_Inicial': 'Mudar@123',
      'Perfil_Acesso': 'COLABORADOR',
      'Status_Colaborador': 'ATIVO'
    },
    {
      'Matricula': '102',
      'Nome_Completo': 'Maria Oliveira Santos',
      'CPF': '987.654.321-11',
      'Cargo': 'Auxiliar de Cartório',
      'Email_Acesso': 'maria.oliveira@cartorio.com.br',
      'Telefone_WhatsApp': '(34) 99777-6655',
      'Senha_Inicial': 'Mudar@456',
      'Perfil_Acesso': 'COLABORADOR',
      'Status_Colaborador': 'ATIVO'
    }
  ];

  const ws = XLSX.utils.json_to_sheet(sampleRows);
  ws['!cols'] = [
    { wch: 12 },
    { wch: 32 },
    { wch: 16 },
    { wch: 22 },
    { wch: 32 },
    { wch: 18 },
    { wch: 16 },
    { wch: 15 },
    { wch: 14 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Modelo_Preenchimento');
  XLSX.writeFile(wb, 'Modelo_Importacao_Usuarios_HoleriteDigital.xlsx');
}

/**
 * Faz a leitura de arquivo XLS/XLSX/CSV e analisa as alterações em relação à base atual
 */
export async function parseAndAnalyzeSpreadsheet(
  file: File,
  currentEmployees: Employee[],
  currentUsers: UserAccount[]
): Promise<SpreadsheetAnalysisResult> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });

  // Pega a primeira planilha ou a que tiver nome de colaboradores
  const sheetName = workbook.SheetNames.find(n => 
    n.toLowerCase().includes('colaborador') || n.toLowerCase().includes('usuario') || n.toLowerCase().includes('modelo')
  ) || workbook.SheetNames[0];

  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    throw new Error('Não foi possível ler as planilhas do arquivo fornecido.');
  }

  const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
  if (!rawRows || rawRows.length === 0) {
    throw new Error('A planilha está vazia ou não contém linhas de dados válidas.');
  }

  // Mapeamento de colaboradores atuais por código, CPF e nome
  const empByCod = new Map<string, Employee>();
  const empByCpf = new Map<string, Employee>();
  const empByName = new Map<string, Employee>();

  currentEmployees.forEach(e => {
    if (e.codigo) empByCod.set(String(e.codigo).trim().toLowerCase(), e);
    if (e.cpf) empByCpf.set(String(e.cpf).replace(/\D/g, ''), e);
    if (e.nome) empByName.set(String(e.nome).trim().toLowerCase(), e);
  });

  // Mapeamento de usuários atuais
  const userByCod = new Map<string, UserAccount>();
  const userByEmail = new Map<string, UserAccount>();
  currentUsers.forEach(u => {
    if (u.employeeCodigo) userByCod.set(String(u.employeeCodigo).trim().toLowerCase(), u);
    if (u.email) userByEmail.set(String(u.email).trim().toLowerCase(), u);
  });

  const changes: SpreadsheetChangeDetail[] = [];
  let newEmailsCount = 0;
  let newPhonesCount = 0;
  let newPasswordsCount = 0;
  let matchedCount = 0;
  let unmatchedCount = 0;

  for (const row of rawRows) {
    // Normalizar chaves das colunas
    const mapped: Record<string, string> = {};
    for (const rawKey of Object.keys(row)) {
      const norm = normalizeKey(rawKey);
      mapped[norm] = String(row[rawKey] || '').trim();
    }

    // Extrair valores usando mapeamentos comuns
    const matricula =
      mapped['matricula'] ||
      mapped['codigo'] ||
      mapped['cod'] ||
      mapped['id'] ||
      mapped['numfunc'] ||
      mapped['registro'] ||
      '';

    const nome =
      mapped['nomecompleto'] ||
      mapped['nome'] ||
      mapped['funcionario'] ||
      mapped['colaborador'] ||
      '';

    const cpf =
      mapped['cpf'] ||
      mapped['documento'] ||
      '';

    const email =
      mapped['emailacesso'] ||
      mapped['email'] ||
      mapped['correioeletronico'] ||
      mapped['e-mail'] ||
      '';

    const telefone =
      mapped['telefonewhatsapp'] ||
      mapped['telefone'] ||
      mapped['whatsapp'] ||
      mapped['celular'] ||
      mapped['contato'] ||
      '';

    const senha =
      mapped['senhainicial'] ||
      mapped['senha'] ||
      mapped['senhadeacesso'] ||
      mapped['password'] ||
      '';

    const roleRaw = mapped['perfilacesso'] || mapped['perfil'] || mapped['role'] || '';
    const role: 'COLABORADOR' | 'GESTOR' = roleRaw.toUpperCase().includes('GESTOR') ? 'GESTOR' : 'COLABORADOR';

    const status = mapped['statuscolaborador'] || mapped['status'] || 'ATIVO';

    // Pular linhas vazias
    if (!matricula && !nome && !cpf && !email) {
      continue;
    }

    // Tentar localizar o colaborador existente
    const cleanCod = matricula.toLowerCase();
    const cleanCpfDigits = cpf.replace(/\D/g, '');
    const cleanName = nome.toLowerCase();

    let matchedEmp: Employee | undefined = undefined;
    if (cleanCod && empByCod.has(cleanCod)) {
      matchedEmp = empByCod.get(cleanCod);
    } else if (cleanCpfDigits && empByCpf.has(cleanCpfDigits)) {
      matchedEmp = empByCpf.get(cleanCpfDigits);
    } else if (cleanName && empByName.has(cleanName)) {
      matchedEmp = empByName.get(cleanName);
    }

    const matchedUser = matchedEmp
      ? (userByCod.get(String(matchedEmp.codigo).toLowerCase()) || (matchedEmp.email ? userByEmail.get(matchedEmp.email.toLowerCase()) : undefined))
      : (cleanCod ? userByCod.get(cleanCod) : undefined);

    const isMatched = Boolean(matchedEmp);
    if (isMatched) {
      matchedCount++;
    } else {
      unmatchedCount++;
    }

    const oldEmail = matchedUser?.email || matchedEmp?.email || '';
    const oldPhone = matchedEmp?.telefone || '';
    const oldSenha = matchedUser?.senha || '';

    const willChangeEmail = Boolean(email && email !== oldEmail);
    const willChangePhone = Boolean(telefone && telefone !== oldPhone);
    const willChangeSenha = Boolean(senha && senha !== oldSenha);

    if (willChangeEmail) newEmailsCount++;
    if (willChangePhone) newPhonesCount++;
    if (willChangeSenha) newPasswordsCount++;

    const hasChange = willChangeEmail || willChangePhone || willChangeSenha;

    changes.push({
      matricula: matchedEmp?.codigo || matricula,
      nome: matchedEmp?.nome || nome,
      cpf: matchedEmp?.cpf || cpf,
      oldEmail,
      newEmail: email,
      oldPhone,
      newPhone: telefone,
      oldSenha,
      newSenha: senha,
      role,
      status: matchedEmp?.status || status,
      isMatched,
      hasChange
    });
  }

  changes.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' }));

  return {
    totalRows: changes.length,
    matchedCount,
    unmatchedCount,
    newEmailsCount,
    newPhonesCount,
    newPasswordsCount,
    changes,
    rawRows
  };
}

/**
 * Aplica os dados da planilha atualizada nas listas de colaboradores e usuários
 */
export function applySpreadsheetToEntities(
  analysis: SpreadsheetAnalysisResult,
  currentEmployees: Employee[],
  currentUsers: UserAccount[]
): {
  updatedEmployees: Employee[];
  updatedUsers: UserAccount[];
} {
  const employeesMap = new Map<string, Employee>();
  currentEmployees.forEach(e => employeesMap.set(String(e.codigo).trim().toLowerCase(), { ...e }));

  const usersMap = new Map<string, UserAccount>();
  currentUsers.forEach(u => {
    const key = u.uid || (u.employeeCodigo ? `user-${u.employeeCodigo}` : u.email.toLowerCase());
    usersMap.set(key, { ...u });
  });

  analysis.changes.forEach(change => {
    if (!change.isMatched && !change.matricula) return;

    const codClean = String(change.matricula).trim().toLowerCase();
    const existingEmp = employeesMap.get(codClean);

    // 1. Atualizar ou Criar Colaborador
    if (existingEmp) {
      if (change.newEmail) {
        existingEmp.email = change.newEmail.trim();
      }
      if (change.newPhone) {
        existingEmp.telefone = change.newPhone.trim();
      }
      employeesMap.set(codClean, existingEmp);
    } else if (change.matricula && change.nome) {
      employeesMap.set(codClean, {
        codigo: String(change.matricula).trim(),
        nome: change.nome.trim().toUpperCase(),
        cbo: '411025',
        cargo: 'COLABORADOR',
        departamento: '1',
        filial: '1',
        dataAdmissao: new Date().toLocaleDateString('pt-BR'),
        salarioBase: 0,
        cpf: change.cpf || '',
        email: (change.newEmail || change.oldEmail || '').trim(),
        telefone: (change.newPhone || change.oldPhone || '').trim(),
        status: 'ATIVO',
        endereco: {
          logradouro: '',
          numero: '',
          bairro: '',
          cidade: '',
          uf: '',
          cep: ''
        },
        contatosFamiliares: [],
        dadosBancarios: {
          banco: '',
          agencia: '',
          conta: '',
          tipoConta: 'CORRENTE'
        },
        cadastroCompleto: false
      });
    }

    // 2. Atualizar ou Criar Conta de Usuário
    let matchedUserKey: string | null = null;
    for (const [key, user] of usersMap.entries()) {
      if (
        (user.employeeCodigo && String(user.employeeCodigo).trim().toLowerCase() === codClean) ||
        (user.email && change.oldEmail && user.email.trim().toLowerCase() === change.oldEmail.trim().toLowerCase()) ||
        (user.nome && change.nome && user.nome.trim().toLowerCase() === change.nome.trim().toLowerCase())
      ) {
        matchedUserKey = key;
        break;
      }
    }

    const emailToSet = change.newEmail?.trim() || existingEmp?.email || change.oldEmail || '';
    const senhaToSet = change.newSenha?.trim() || change.oldSenha || '';

    if (matchedUserKey && usersMap.has(matchedUserKey)) {
      const existingUser = usersMap.get(matchedUserKey)!;
      usersMap.set(matchedUserKey, {
        ...existingUser,
        nome: change.nome || existingUser.nome,
        email: emailToSet || existingUser.email,
        senha: senhaToSet || existingUser.senha,
        role: change.role || existingUser.role || 'COLABORADOR',
        employeeCodigo: change.matricula || existingUser.employeeCodigo,
        senhaTemporaria: change.newSenha ? true : existingUser.senhaTemporaria
      });
    } else {
      // Cria novo usuário vinculado
      const newUid = `user-${change.matricula || Date.now()}`;
      usersMap.set(newUid, {
        uid: newUid,
        nome: change.nome || existingEmp?.nome || `Colaborador ${change.matricula}`,
        email: emailToSet,
        senha: senhaToSet,
        role: change.role || 'COLABORADOR',
        employeeCodigo: change.matricula,
        criadoEm: new Date().toISOString(),
        senhaTemporaria: true,
        precisaTrocarSenha: true,
        primeiroAcessoConcluido: false
      });
    }
  });

  return {
    updatedEmployees: Array.from(employeesMap.values()).sort((a, b) =>
      (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' })
    ),
    updatedUsers: Array.from(usersMap.values()).sort((a, b) =>
      (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' })
    )
  };
}
