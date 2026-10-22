import React, { useState, useEffect } from 'react';
import { Employee, PayReceipt, SystemConfig, UserAccount, MedicalCertificate, IncomeReport } from './types';
import { INITIAL_EMPLOYEES, INITIAL_RECEIPTS, INITIAL_USERS } from './data/initialData';
import { SAMPLE_INCOME_REPORTS } from './data/sampleIncomeReports';
import { Navbar } from './components/Navbar';
import { EmployeePortal } from './components/EmployeePortal';
import { AdminPortal } from './components/AdminPortal';
import { FileProcessorModal } from './components/FileProcessorModal';
import { EmployeeEditModal } from './components/EmployeeEditModal';
import { EmailDispatchModal } from './components/EmailDispatchModal';
import { ReceiptModal } from './components/ReceiptModal';
import { BatchDispatchModal } from './components/BatchDispatchModal';
import { DigitalSignatureModal } from './components/DigitalSignatureModal';
import { SystemSettingsModal } from './components/SystemSettingsModal';
import { LoginModal } from './components/LoginModal';
import { UserManagementModal } from './components/UserManagementModal';
import { VerificationModal } from './components/VerificationModal';
import { MedicalCertificatesAdminModal } from './components/MedicalCertificatesAdminModal';
import { MedicalCertificateViewModal } from './components/MedicalCertificateViewModal';
import { IncomeReportModal } from './components/IncomeReportModal';
import { IncomeReportsAdminModal } from './components/IncomeReportsAdminModal';
import {
  testConnection,
  auth
} from './firebase';
import {
  subscribeEmployees,
  subscribeReceipts,
  subscribeSystemConfig,
  subscribeUsers,
  subscribeMedicalCertificates,
  subscribeToIncomeReports,
  saveEmployeeFirestore,
  saveReceiptFirestore,
  saveSystemConfigFirestore,
  signReceiptFirestore,
  clearAllDatabaseData,
  saveUserAccount,
  saveUsersBatchFirestore,
  deleteUserAccountFirestore,
  saveMedicalCertificateFirestore,
  updateMedicalCertificateStatusFirestore,
  deleteMedicalCertificateFirestore,
  saveIncomeReportFirestore,
  saveIncomeReportsBatchFirestore,
  deleteIncomeReportFirestore,
  deleteIncomeReportsBatchFirestore,
  DEFAULT_CONFIG
} from './services/firestoreService';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { getActiveA1Certificate, saveActiveA1Certificate } from './utils/certificateA1';

const STORAGE_KEY_USER = 'holerite_user_v2';
const STORAGE_KEY_EMPLOYEES = 'holerite_employees_v2';
const STORAGE_KEY_RECEIPTS = 'holerite_receipts_v2';
const STORAGE_KEY_USERS = 'holerite_users_v2';

export default function App() {
  // Current user account session: Starts as null so the initial screen shows the Login Screen
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);

  // Perspective: Portal do Colaborador vs Gestão RH / Admin (Portal do Colaborador como padrão)
  const [currentView, setCurrentView] = useState<'EMPLOYEE' | 'ADMIN'>('EMPLOYEE');

  // Selected employee code for viewing
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('6');

  // Users state (dynamically managed by Gestor)
  const [users, setUsers] = useState<UserAccount[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_USERS);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_USERS;
  });

  // Core state synced with Firebase Firestore
  const [employees, setEmployees] = useState<Employee[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_EMPLOYEES);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_EMPLOYEES;
  });

  const [receipts, setReceipts] = useState<PayReceipt[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_RECEIPTS);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_RECEIPTS;
  });

  const [systemConfig, setSystemConfig] = useState<SystemConfig>(() => {
    try {
      const saved = localStorage.getItem('holerite_system_config');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return DEFAULT_CONFIG;
  });
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(false);

  // Modals state
  const [isProcessorOpen, setIsProcessorOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<
    'CERTIFICADO_A1' | 'EMPRESA' | 'EMAIL_SERVER' | 'ASSINATURA' | 'COMUNICACAO' | 'DADOS'
  >('CERTIFICADO_A1');
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [emailModalData, setEmailModalData] = useState<{ employee: Employee; receipt: PayReceipt } | null>(null);
  const [viewingReceiptData, setViewingReceiptData] = useState<{ employee: Employee; receipt: PayReceipt } | null>(null);
  const [batchModalData, setBatchModalData] = useState<{
    type: 'WHATSAPP' | 'EMAIL';
    month: string;
    onlyUnsigned?: boolean;
    isReminder?: boolean;
  } | null>(null);
  const [signingModalData, setSigningModalData] = useState<{ employee: Employee; receipt: PayReceipt } | null>(null);
  const [verificationModalData, setVerificationModalData] = useState<{
    receipt: PayReceipt | null;
    employee: Employee | null;
    hash?: string | null;
  } | null>(null);

  // Medical Certificates state (synced with Firestore)
  const [medicalCertificates, setMedicalCertificates] = useState<MedicalCertificate[]>([]);
  const [isMedicalCertificatesAdminOpen, setIsMedicalCertificatesAdminOpen] = useState(false);
  const [viewingMedicalCertAdmin, setViewingMedicalCertAdmin] = useState<MedicalCertificate | null>(null);

  // Income Reports (Comprovante de Rendimentos IRPF) state (synced with Firestore)
  const [incomeReports, setIncomeReports] = useState<IncomeReport[]>(() => {
    try {
      const saved = localStorage.getItem('holerite_income_reports_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return SAMPLE_INCOME_REPORTS;
  });
  const [isIncomeReportsAdminOpen, setIsIncomeReportsAdminOpen] = useState(false);
  const [viewingIncomeReport, setViewingIncomeReport] = useState<IncomeReport | null>(null);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 1. Test connection to Firestore on boot (per SKILL.md) & load persistent server config
  useEffect(() => {
    testConnection().then(connected => {
      setIsFirebaseConnected(connected);
    });

    // Fetch permanent server-side configuration from disk
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        if (data && data.success && data.config) {
          const serverConfig = data.config;
          const activeCert = getActiveA1Certificate(serverConfig.certificadoA1);
          setSystemConfig(prev => {
            const merged = {
              ...prev,
              ...serverConfig,
              certificadoA1: activeCert
            };
            try {
              localStorage.setItem('holerite_system_config', JSON.stringify(merged));
            } catch (e) {}
            // Also synchronize with Firestore so cloud reflects the permanent server settings
            saveSystemConfigFirestore(merged).catch(() => {});
            return merged;
          });
        }
      })
      .catch(() => {});
  }, []);

  // 2. Setup Firestore Realtime Listeners
  useEffect(() => {
    const unsubEmployees = subscribeEmployees((remoteEmployees) => {
      if (remoteEmployees.length > 0) {
        setEmployees(remoteEmployees);
      }
    });

    const unsubReceipts = subscribeReceipts((remoteReceipts) => {
      if (remoteReceipts.length > 0) {
        setReceipts(remoteReceipts);
      }
    });

    const unsubConfig = subscribeSystemConfig((remoteConfig) => {
      if (!remoteConfig) return;
      const activeCert = getActiveA1Certificate(remoteConfig.certificadoA1);
      setSystemConfig(prev => {
        // Prevent cloud default from overwriting user configured SMTP host
        const isRemoteDefaultGmail = remoteConfig.smtpHost === 'smtp.gmail.com';
        const hasCustomLocalHost = prev.smtpHost && prev.smtpHost !== 'smtp.gmail.com';

        const mergedConfig = {
          ...prev,
          ...remoteConfig,
          smtpHost: hasCustomLocalHost && isRemoteDefaultGmail ? prev.smtpHost : (remoteConfig.smtpHost || prev.smtpHost),
          smtpUser: hasCustomLocalHost && isRemoteDefaultGmail ? prev.smtpUser : (remoteConfig.smtpUser || prev.smtpUser),
          smtpPassword: hasCustomLocalHost && isRemoteDefaultGmail ? prev.smtpPassword : (remoteConfig.smtpPassword || prev.smtpPassword),
          smtpPort: hasCustomLocalHost && isRemoteDefaultGmail ? prev.smtpPort : (remoteConfig.smtpPort || prev.smtpPort),
          smtpSecure: hasCustomLocalHost && isRemoteDefaultGmail ? prev.smtpSecure : (remoteConfig.smtpSecure ?? prev.smtpSecure),
          emailProvider: hasCustomLocalHost && isRemoteDefaultGmail ? prev.emailProvider : (remoteConfig.emailProvider || prev.emailProvider),
          certificadoA1: activeCert
        };
        try {
          localStorage.setItem('holerite_system_config', JSON.stringify(mergedConfig));
        } catch (e) {}
        return mergedConfig;
      });
    });

    const unsubUsers = subscribeUsers((remoteUsers) => {
      if (remoteUsers.length > 0) {
        setUsers(remoteUsers);
      }
    });

    const unsubMedical = subscribeMedicalCertificates((remoteCerts) => {
      setMedicalCertificates(remoteCerts);
    });

    const unsubIncome = subscribeToIncomeReports((remoteReports) => {
      if (remoteReports.length > 0) {
        setIncomeReports(remoteReports);
      }
    });

    return () => {
      unsubEmployees();
      unsubReceipts();
      unsubConfig();
      unsubUsers();
      unsubMedical();
      unsubIncome();
    };
  }, []);

  // Listen to live certificate changes across components
  useEffect(() => {
    const handleCertChange = (e: any) => {
      if (e.detail) {
        setSystemConfig(prev => ({
          ...prev,
          certificadoA1: e.detail
        }));
      }
    };
    window.addEventListener('holerite_a1_certificate_changed', handleCertChange);
    return () => window.removeEventListener('holerite_a1_certificate_changed', handleCertChange);
  }, []);

  // Listen for ?verify=ID or QR Code scanning
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const verifyId = params.get('verify');
      const hashParam = params.get('h');
      if (verifyId) {
        const matchedRec = receipts.find(r => r.id === verifyId);
        const matchedEmp = matchedRec ? employees.find(e => e.codigo === matchedRec.employeeCodigo) : (employees[0] || null);
        setVerificationModalData({
          receipt: matchedRec || (receipts[0] || null),
          employee: matchedEmp || (employees[0] || null),
          hash: hashParam
        });
      }
    } catch (err) {}
  }, [receipts, employees]);

  // 4. Persist to localStorage as robust offline cache
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_EMPLOYEES, JSON.stringify(employees));
    } catch (e) {}
  }, [employees]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_RECEIPTS, JSON.stringify(receipts));
    } catch (e) {}
  }, [receipts]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
    } catch (e) {}
  }, [users]);

  // 5. Restrict Colaborador from accessing Gestão RH / Admin tab
  useEffect(() => {
    if (currentUser?.role === 'COLABORADOR' && currentView === 'ADMIN') {
      setCurrentView('EMPLOYEE');
    }
  }, [currentUser, currentView]);

  // Current active employee for the employee view (strictly matched for Colaborador)
  const currentEmployee =
    (currentUser?.role === 'COLABORADOR'
      ? employees.find(
          e =>
            e.codigo === currentUser.employeeCodigo ||
            (currentUser.email && e.email.toLowerCase() === currentUser.email.toLowerCase())
        )
      : employees.find(e => e.codigo === selectedEmployeeId)) ||
    employees.find(e => e.codigo === selectedEmployeeId) ||
    employees[0] || {
      codigo: '0',
      nome: 'Nenhum colaborador cadastrado',
      cbo: '',
      cargo: '',
      departamento: '',
      filial: '',
      dataAdmissao: '',
      salarioBase: 0,
      cpf: '',
      email: '',
      telefone: '',
      status: 'ATIVO',
      endereco: { logradouro: '', numero: '', bairro: '', cidade: '', uf: '', cep: '' },
      contatosFamiliares: [],
      dadosBancarios: { banco: '', agencia: '', conta: '', tipoConta: 'CORRENTE' }
    };

  // Actions
  const handleOpenDigitalSignature = (receipt: PayReceipt) => {
    const emp = employees.find(e => e.codigo === receipt.employeeCodigo) || currentEmployee;
    setSigningModalData({ employee: emp, receipt });
  };

  const handleDigitalSignatureSuccess = async (receiptId: string, code: string, canal: 'WHATSAPP' | 'EMAIL') => {
    const now = new Date();
    const formattedDate = now.toLocaleDateString('pt-BR') + ' às ' + now.toLocaleTimeString('pt-BR');

    const targetReceipt = receipts.find(r => r.id === receiptId);
    let updatedReceipt: PayReceipt | undefined;

    // Local state update
    setReceipts(prev =>
      prev.map(r => {
        if (r.id === receiptId) {
          updatedReceipt = {
            ...r,
            statusAssinatura: 'ASSINADO',
            dataAssinatura: formattedDate,
            ipAssinatura: `Autenticado via 2FA (${canal})`,
            codigoAssinatura: code,
            metodoAssinatura: canal
          };
          return updatedReceipt;
        }
        return r;
      })
    );

    // Sync with Firestore (passing full receipt so that if not yet created, it merges completely)
    try {
      await signReceiptFirestore(receiptId, code, canal, updatedReceipt || targetReceipt);
    } catch (e) {
      console.warn('Fallback: saved in local state', e);
    }

    if (viewingReceiptData && viewingReceiptData.receipt.id === receiptId) {
      setViewingReceiptData({
        ...viewingReceiptData,
        receipt: {
          ...viewingReceiptData.receipt,
          statusAssinatura: 'ASSINADO',
          dataAssinatura: formattedDate,
          codigoAssinatura: code,
          metodoAssinatura: canal
        }
      });
    }

    showToast('Holerite assinado digitalmente com autenticação em duas etapas!');
  };

  const handleSaveEmployee = async (updatedEmployee: Employee) => {
    setEmployees(prev =>
      prev.map(emp => (emp.codigo === updatedEmployee.codigo ? updatedEmployee : emp))
    );
    try {
      await saveEmployeeFirestore(updatedEmployee);
    } catch (e) {
      console.warn('Saved in local cache');
    }
    showToast(`Dados de ${updatedEmployee.nome} salvos com sucesso!`);
  };

  const handleCommitParsedData = async (newOrUpdatedEmployees: Employee[], newReceipts: PayReceipt[]) => {
    // Merge employees by codigo
    setEmployees(prev => {
      const map = new Map<string, Employee>();
      prev.forEach(emp => map.set(emp.codigo, emp));
      newOrUpdatedEmployees.forEach(emp => map.set(emp.codigo, emp));
      return Array.from(map.values());
    });

    // Merge receipts by id
    setReceipts(prev => {
      const map = new Map<string, PayReceipt>();
      prev.forEach(r => map.set(r.id, r));
      newReceipts.forEach(r => map.set(r.id, r));
      return Array.from(map.values());
    });

    // Persist each in Firestore
    for (const emp of newOrUpdatedEmployees) {
      saveEmployeeFirestore(emp).catch(() => {});
    }
    for (const rec of newReceipts) {
      saveReceiptFirestore(rec).catch(() => {});
    }

    // Cadastro automático dos colaboradores importados em Usuários vinculando nome e matrícula
    const usersToPersist: UserAccount[] = [];
    setUsers(prevUsers => {
      const updatedList = [...prevUsers];
      newOrUpdatedEmployees.forEach(emp => {
        const existingIdx = updatedList.findIndex(
          u => u.employeeCodigo === emp.codigo || (u.nome && u.nome.trim().toLowerCase() === emp.nome.trim().toLowerCase())
        );

        if (existingIdx >= 0) {
          const existing = updatedList[existingIdx];
          const linkedUser: UserAccount = {
            ...existing,
            nome: emp.nome,
            employeeCodigo: emp.codigo,
            role: 'COLABORADOR',
            email: existing.email || emp.email || '',
            exigirCompletarCadastro: existing.exigirCompletarCadastro !== undefined ? existing.exigirCompletarCadastro : true,
            precisaTrocarSenha: existing.precisaTrocarSenha !== undefined ? existing.precisaTrocarSenha : true
          };
          updatedList[existingIdx] = linkedUser;
          usersToPersist.push(linkedUser);
        } else {
          // Cria o registro do usuário sem inventar dados
          const newUser: UserAccount = {
            uid: `user-${emp.codigo}`,
            nome: emp.nome,
            employeeCodigo: emp.codigo,
            email: emp.email || '',
            senha: '', // O gestor definirá o e-mail e a senha inicial
            role: 'COLABORADOR',
            primeiroAcessoConcluido: false,
            senhaTemporaria: true,
            precisaTrocarSenha: true,
            exigirCompletarCadastro: true,
            criadoEm: new Date().toISOString()
          };
          updatedList.push(newUser);
          usersToPersist.push(newUser);
        }
      });

      try {
        localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(updatedList));
      } catch (e) {}

      return updatedList;
    });

    // Salva em lote no Firestore
    saveUsersBatchFirestore(usersToPersist).catch(() => {});

    showToast(`${newReceipts.length} recibos importados. ${newOrUpdatedEmployees.length} colaboradores vinculados aos Usuários!`);
  };

  const handleSaveSystemConfig = async (newConfig: SystemConfig) => {
    if (newConfig.certificadoA1) {
      saveActiveA1Certificate(newConfig.certificadoA1);
    }
    setSystemConfig(newConfig);

    // 1. Local storage cache
    try {
      localStorage.setItem('holerite_system_config', JSON.stringify(newConfig));
    } catch (e) {}

    // 2. Server disk storage (permanent across reloads and updates)
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig)
      });
    } catch (e) {
      console.warn('Falha ao gravar no servidor:', e);
    }

    // 3. Firestore cloud storage
    try {
      await saveSystemConfigFirestore(newConfig);
      showToast('Configurações salvas no servidor e sincronizadas com a nuvem!');
    } catch (e) {
      showToast('Configurações salvas localmente e no servidor.');
    }
  };

  const handleClearProductionData = async () => {
    setEmployees([]);
    setReceipts([]);
    localStorage.removeItem(STORAGE_KEY_EMPLOYEES);
    localStorage.removeItem(STORAGE_KEY_RECEIPTS);
    await clearAllDatabaseData();
    showToast('Dados de teste apagados! O sistema está limpo para produção.');
  };

  const handleConfirmEmailSend = async (employeeCodigo: string, receiptId: string, email: string) => {
    const now = new Date();
    const formattedDate = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR').slice(0, 5);

    let updatedReceipt: PayReceipt | null = null;
    setReceipts(prev =>
      prev.map(r => {
        if (r.id === receiptId) {
          const newHistory = [
            ...(r.historicoEnvios || []),
            {
              id: 'env-' + Date.now(),
              tipo: 'EMAIL' as const,
              data: formattedDate,
              destinatario: email,
              status: 'ENTREGUE' as const
            }
          ];
          updatedReceipt = { ...r, historicoEnvios: newHistory };
          return updatedReceipt;
        }
        return r;
      })
    );

    if (updatedReceipt) {
      saveReceiptFirestore(updatedReceipt).catch(() => {});
    }

    showToast(`Comprovante enviado com sucesso para ${email}!`);
  };

  const handleSaveUser = async (userToSave: UserAccount) => {
    setUsers(prev => {
      const idx = prev.findIndex(u => u.uid === userToSave.uid);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = userToSave;
        return copy;
      }
      return [...prev, userToSave];
    });

    if (currentUser && currentUser.uid === userToSave.uid) {
      setCurrentUser(userToSave);
      try {
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(userToSave));
      } catch (e) {}
    }

    // Se o gestor cadastrou/atualizou o e-mail do usuário vinculado a uma matrícula, sincroniza com o Colaborador
    if (userToSave.employeeCodigo && userToSave.email) {
      setEmployees(prev =>
        prev.map(emp => {
          if (emp.codigo === userToSave.employeeCodigo && emp.email !== userToSave.email) {
            const updated = { ...emp, email: userToSave.email };
            saveEmployeeFirestore(updated).catch(() => {});
            return updated;
          }
          return emp;
        })
      );
    }

    try {
      await saveUserAccount(userToSave);
    } catch (e) {
      console.warn('Saved user locally');
    }
    showToast(`Usuário ${userToSave.nome} salvo com sucesso!`);
  };

  const handleDeleteUser = async (uid: string) => {
    setUsers(prev => {
      const updated = prev.filter(u => u.uid !== uid);
      try {
        localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
    try {
      await deleteUserAccountFirestore(uid);
    } catch (e) {
      console.warn('Deleted user locally');
    }
  };

  const handleUploadMedicalCertificate = async (cert: MedicalCertificate) => {
    try {
      await saveMedicalCertificateFirestore(cert);
      showToast('Atestado médico arquivado com sucesso no banco de dados!');
    } catch (err) {
      console.error(err);
      showToast('Erro ao arquivar atestado médico.');
      throw err;
    }
  };

  const handleUpdateMedicalCertificateStatus = async (
    id: string,
    status: MedicalCertificate['status'],
    parecerRH?: string,
    analisadoPor?: string
  ) => {
    try {
      await updateMedicalCertificateStatusFirestore(id, status, parecerRH, analisadoPor || currentUser?.nome || 'Gestor RH');
      showToast(`Atestado ${status === 'APROVADO' ? 'aprovado' : status === 'REJEITADO' ? 'recusado' : 'atualizado'} com sucesso!`);
      setViewingMedicalCertAdmin(prev =>
        prev && prev.id === id
          ? {
              ...prev,
              status,
              parecerRH: parecerRH ?? prev.parecerRH,
              analisadoPor: analisadoPor || currentUser?.nome || 'Gestor RH',
              analisadoEm: new Date().toISOString()
            }
          : prev
      );
    } catch (err) {
      console.error(err);
      showToast('Erro ao atualizar status do atestado.');
      throw err;
    }
  };

  const handleDeleteMedicalCertificate = async (id: string) => {
    try {
      await deleteMedicalCertificateFirestore(id);
      showToast('Atestado médico excluído com sucesso.');
      setViewingMedicalCertAdmin(null);
    } catch (err) {
      console.error(err);
      showToast('Erro ao excluir atestado médico.');
      throw err;
    }
  };

  const handleSaveIncomeReports = async (newReports: IncomeReport[]) => {
    try {
      await saveIncomeReportsBatchFirestore(newReports);
      setIncomeReports(prev => {
        const map = new Map(prev.map(r => [r.id, r]));
        newReports.forEach(r => map.set(r.id, r));
        const merged = Array.from(map.values());
        try {
          localStorage.setItem('holerite_income_reports_v1', JSON.stringify(merged));
        } catch (e) {}
        return merged;
      });
      showToast(`${newReports.length} Comprovantes de Rendimentos salvos no banco de dados!`);
    } catch (err: any) {
      console.error(err);
      showToast(`Erro ao salvar comprovantes: ${err?.message || 'Erro'}`);
      throw err;
    }
  };

  const handleDeleteIncomeReport = async (id: string) => {
    // Atualiza o estado local e localStorage imediatamente para resposta instantânea na interface
    setIncomeReports(prev => {
      const filtered = prev.filter(r => r.id !== id);
      try {
        localStorage.setItem('holerite_income_reports_v1', JSON.stringify(filtered));
      } catch (e) {}
      return filtered;
    });

    try {
      await deleteIncomeReportFirestore(id);
    } catch (err: any) {
      console.warn('Erro ao sincronizar exclusão do comprovante no Firestore:', err);
    }
    showToast('Comprovante de rendimentos excluído com sucesso.');
  };

  const handleDeleteIncomeReportsByYear = async (anoCalendario: string) => {
    const toDelete = incomeReports.filter(r => r.anoCalendario === anoCalendario);
    const count = toDelete.length;
    if (count === 0) return;

    // Remove do estado local e localStorage imediatamente
    setIncomeReports(prev => {
      const filtered = prev.filter(r => r.anoCalendario !== anoCalendario);
      try {
        localStorage.setItem('holerite_income_reports_v1', JSON.stringify(filtered));
      } catch (e) {}
      return filtered;
    });

    try {
      await deleteIncomeReportsBatchFirestore(toDelete.map(r => r.id));
    } catch (err: any) {
      console.warn('Erro ao sincronizar exclusão em lote no Firestore:', err);
    }
    showToast(`${count} comprovantes do Ano-Calendário ${anoCalendario} excluídos com sucesso.`);
  };

  const handleLoginSuccess = (user: UserAccount, employee?: Employee) => {
    setCurrentUser(user);
    setCurrentView('EMPLOYEE');
    if (employee) {
      setSelectedEmployeeId(employee.codigo);
    } else if (user.employeeCodigo) {
      setSelectedEmployeeId(user.employeeCodigo);
    }
    showToast(`Bem-vindo(a), ${user.nome}!`);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem(STORAGE_KEY_USER);
    auth.signOut().catch(() => {});
    showToast('Sessão encerrada. Até logo!');
  };

  const handleOpenSettingsWithTab = (tab?: 'CERTIFICADO_A1' | 'EMPRESA' | 'EMAIL_SERVER' | 'ASSINATURA' | 'COMUNICACAO' | 'DADOS') => {
    setSettingsInitialTab(tab || 'CERTIFICADO_A1');
    setIsSettingsOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 font-sans antialiased selection:bg-blue-100 selection:text-blue-900 flex flex-col">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-[110] bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-2.5 text-xs animate-in slide-in-from-top-4 duration-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Navigation Header - Exibida somente após o login */}
      {currentUser && (
        <Navbar
          currentView={currentView}
          onSwitchView={(view) => {
            if (currentUser?.role === 'COLABORADOR' && view === 'ADMIN') return;
            setCurrentView(view);
          }}
          employees={employees}
          selectedEmployeeId={selectedEmployeeId}
          onSelectEmployee={setSelectedEmployeeId}
          onOpenProcessor={() => setIsProcessorOpen(true)}
          currentUser={currentUser}
          onOpenLoginModal={() => setIsLoginOpen(true)}
          onLogout={handleLogout}
          isFirebaseConnected={isFirebaseConnected}
          onOpenEmailSettings={() => handleOpenSettingsWithTab('EMAIL_SERVER')}
          onOpenUserManagement={() => setIsUserManagementOpen(true)}
        />
      )}

      {/* Main Content Area */}
      {!currentUser ? (
        /* Tela Inicial: Login Screen Direto */
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex items-center justify-center">
          <LoginModal
            isFullScreen={true}
            employees={employees}
            users={users}
            onLoginSuccess={handleLoginSuccess}
          />
        </main>
      ) : (
        /* Conteúdo Autenticado: Portal do Colaborador ou Gestão RH */
        <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
          {currentView === 'EMPLOYEE' ? (
            employees.length > 0 ? (
              <EmployeePortal
                currentUser={currentUser}
                employee={currentEmployee}
                allReceipts={receipts}
                systemConfig={systemConfig}
                medicalCertificates={medicalCertificates.filter(c => c.employeeCodigo === currentEmployee?.codigo)}
                onUploadMedicalCertificate={handleUploadMedicalCertificate}
                incomeReports={incomeReports}
                onViewIncomeReport={(rep) => setViewingIncomeReport(rep)}
                onSignReceipt={(id) => {
                  const rec = receipts.find(r => r.id === id);
                  if (rec) handleOpenDigitalSignature(rec);
                }}
                onTriggerDigitalSignature={handleOpenDigitalSignature}
                onOpenEmailModal={(emp, rec) => setEmailModalData({ employee: emp, receipt: rec })}
                onUpdateEmployee={handleSaveEmployee}
                onSaveUserAccount={handleSaveUser}
                onLogout={handleLogout}
              />
            ) : (
              <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <ShieldCheck className="w-10 h-10 text-blue-600 mx-auto" />
                <h3 className="font-bold text-slate-800 text-base">Ambiente Corporativo em Produção</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Não há colaboradores cadastrados no momento. Acesse a Gestão RH para importar o primeiro arquivo PDF da folha de pagamento.
                </p>
                <button
                  onClick={() => setCurrentView('ADMIN')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors cursor-pointer"
                >
                  Ir para o Painel do Gestor
                </button>
              </div>
            )
          ) : (
            <AdminPortal
              employees={employees}
              receipts={receipts}
              systemConfig={systemConfig}
              medicalCertificates={medicalCertificates}
              incomeReports={incomeReports}
              onOpenProcessorModal={() => setIsProcessorOpen(true)}
              onOpenEditModal={(emp) => setEditingEmployee(emp)}
              onOpenEmailModal={(emp, rec) => setEmailModalData({ employee: emp, receipt: rec })}
              onViewReceipt={(emp, rec) => setViewingReceiptData({ employee: emp, receipt: rec })}
              onBatchWhatsApp={(month) => setBatchModalData({ type: 'WHATSAPP', month, onlyUnsigned: false, isReminder: false })}
              onBatchEmail={(month) => setBatchModalData({ type: 'EMAIL', month, onlyUnsigned: false, isReminder: false })}
              onBatchWhatsAppReminder={(month) => setBatchModalData({ type: 'WHATSAPP', month, onlyUnsigned: true, isReminder: true })}
              onBatchEmailReminder={(month) => setBatchModalData({ type: 'EMAIL', month, onlyUnsigned: true, isReminder: true })}
              onOpenSettingsModal={handleOpenSettingsWithTab}
              onOpenUserManagement={() => setIsUserManagementOpen(true)}
              onOpenMedicalCertificates={() => setIsMedicalCertificatesAdminOpen(true)}
              onOpenIncomeReports={() => setIsIncomeReportsAdminOpen(true)}
            />
          )}
        </main>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 pt-6 pb-24 md:pb-6 text-center text-xs text-slate-500 print:hidden">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            © 2026 <strong>HoleriteDigital</strong> • {systemConfig.razaoSocial} • CEI: {systemConfig.cei}
          </span>
          <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Ambiente Corporativo Certificado • Conformidade CLT Art. 464 e LGPD
          </span>
        </div>
      </footer>

      {/* Modals */}
      <FileProcessorModal
        isOpen={isProcessorOpen}
        onClose={() => setIsProcessorOpen(false)}
        existingEmployees={employees}
        onCommitParsedData={handleCommitParsedData}
      />

      {editingEmployee && (
        <EmployeeEditModal
          key={editingEmployee.codigo}
          isOpen={!!editingEmployee}
          onClose={() => setEditingEmployee(null)}
          employee={editingEmployee}
          onSave={handleSaveEmployee}
        />
      )}

      <EmailDispatchModal
        isOpen={!!emailModalData}
        onClose={() => setEmailModalData(null)}
        employee={emailModalData?.employee || null}
        receipt={emailModalData?.receipt || null}
        systemConfig={systemConfig}
        onConfirmSend={handleConfirmEmailSend}
        onOpenSettings={() => handleOpenSettingsWithTab('EMAIL_SERVER')}
      />

      <ReceiptModal
        isOpen={!!viewingReceiptData}
        onClose={() => setViewingReceiptData(null)}
        employee={viewingReceiptData?.employee || null}
        receipt={viewingReceiptData?.receipt || null}
        onSignReceipt={(id) => {
          const rec = receipts.find(r => r.id === id);
          if (rec) handleOpenDigitalSignature(rec);
        }}
        onTriggerDigitalSignature={handleOpenDigitalSignature}
        onOpenEmailModal={(emp, rec) => setEmailModalData({ employee: emp, receipt: rec })}
        certificateConfig={systemConfig.certificadoA1}
      />

      <BatchDispatchModal
        isOpen={!!batchModalData}
        onClose={() => setBatchModalData(null)}
        type={batchModalData?.type || 'WHATSAPP'}
        month={batchModalData?.month || 'Setembro de 2026'}
        onlyUnsigned={batchModalData?.onlyUnsigned ?? false}
        isReminder={batchModalData?.isReminder ?? false}
        employees={employees}
        receipts={receipts}
        systemConfig={systemConfig}
        onBatchCompleted={(type, count) => showToast(`Disparo em lote concluído para ${count} colaboradores!`)}
        onOpenSettings={() => handleOpenSettingsWithTab('COMUNICACAO')}
      />

      {/* 2FA Digital Signature Modal */}
      {signingModalData && (
        <DigitalSignatureModal
          isOpen={!!signingModalData}
          onClose={() => setSigningModalData(null)}
          employee={signingModalData.employee}
          receipt={signingModalData.receipt}
          systemConfig={systemConfig}
          onSignatureSuccess={handleDigitalSignatureSuccess}
        />
      )}

      {/* System Settings Modal for Managers */}
      <SystemSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={systemConfig}
        initialTab={settingsInitialTab}
        onSaveConfig={handleSaveSystemConfig}
        onClearProductionData={handleClearProductionData}
      />

      {/* User Management Modal for Gestor */}
      <UserManagementModal
        isOpen={isUserManagementOpen}
        onClose={() => setIsUserManagementOpen(false)}
        users={users}
        employees={employees}
        currentUser={currentUser}
        systemConfig={systemConfig}
        onUpdateSystemConfig={handleSaveSystemConfig}
        onSaveUser={handleSaveUser}
        onDeleteUser={handleDeleteUser}
        showToast={showToast}
      />

      {/* Login Modal for Switching User while Logged In */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        employees={employees}
        users={users}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* Authenticity & QR-Code Verification Modal */}
      <VerificationModal
        isOpen={!!verificationModalData}
        onClose={() => setVerificationModalData(null)}
        receipt={verificationModalData?.receipt}
        employee={verificationModalData?.employee}
        certificateConfig={systemConfig.certificadoA1}
        verificationHash={verificationModalData?.hash}
      />

      {/* Medical Certificates Admin List Modal */}
      <MedicalCertificatesAdminModal
        isOpen={isMedicalCertificatesAdminOpen}
        onClose={() => setIsMedicalCertificatesAdminOpen(false)}
        certificates={medicalCertificates}
        employees={employees}
        onViewCertificate={(cert) => setViewingMedicalCertAdmin(cert)}
        onQuickApprove={(id) => handleUpdateMedicalCertificateStatus(id, 'APROVADO', 'Aprovado via ação rápida do Gestor RH')}
      />

      {/* Medical Certificate View & Review Modal for Gestor RH */}
      {viewingMedicalCertAdmin && (
        <MedicalCertificateViewModal
          isOpen={!!viewingMedicalCertAdmin}
          onClose={() => setViewingMedicalCertAdmin(null)}
          certificate={viewingMedicalCertAdmin}
          isManager={true}
          onUpdateStatus={handleUpdateMedicalCertificateStatus}
          onDeleteCertificate={handleDeleteMedicalCertificate}
        />
      )}

      {/* Income Reports Admin Modal */}
      <IncomeReportsAdminModal
        isOpen={isIncomeReportsAdminOpen}
        onClose={() => setIsIncomeReportsAdminOpen(false)}
        reports={incomeReports}
        employees={employees}
        receipts={receipts}
        onSaveReports={handleSaveIncomeReports}
        onDeleteReport={handleDeleteIncomeReport}
        onDeleteReportsByYear={handleDeleteIncomeReportsByYear}
        onViewReport={(rep) => setViewingIncomeReport(rep)}
        systemConfig={systemConfig}
      />

      {/* Official Income Report Modal (Receita Federal RFB 2.060/2021) */}
      <IncomeReportModal
        report={viewingIncomeReport}
        onClose={() => setViewingIncomeReport(null)}
      />
    </div>
  );
}
