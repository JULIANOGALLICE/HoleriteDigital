import React, { useState, useEffect } from 'react';
import { Employee, PayReceipt, SystemConfig, UserAccount, MedicalCertificate, IncomeReport, SystemLog } from './types';
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
import { SystemLogsModal } from './components/SystemLogsModal';
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
  subscribeSystemLogs,
  saveEmployeeFirestore,
  saveEmployeesBatchFirestore,
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
  deleteEmployeeFirestore,
  deleteReceiptFirestore,
  deleteReceiptsBatchFirestore,
  toggleEmployeeBlockFirestore,
  clearSystemLogsFirestore,
  DEFAULT_CONFIG
} from './services/firestoreService';
import {
  recordLoginEvent,
  recordLogoutEvent,
  recordSignatureEvent,
  recordEmailDispatchEvent,
  recordSpreadsheetImportEvent,
  recordIncomeReportEvent,
  recordDeleteReceiptEvent,
  recordBatchDeleteReceiptsEvent,
  recordDeleteIncomeReportEvent,
  recordBatchDeleteIncomeReportsEvent,
  recordDeleteEmployeeCascadeEvent,
  recordToggleEmployeeBlockEvent,
  getInitialSampleLogs
} from './services/loggerService';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { getActiveA1Certificate, saveActiveA1Certificate } from './utils/certificateA1';

const STORAGE_KEY_USER = 'holerite_user_v2';
const STORAGE_KEY_EMPLOYEES = 'holerite_employees_v2';
const STORAGE_KEY_RECEIPTS = 'holerite_receipts_v2';
const STORAGE_KEY_USERS = 'holerite_users_v2';
const STORAGE_KEY_INCOME_REPORTS = 'holerite_income_reports_v2';

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
    'CERTIFICADO_A1' | 'EMPRESA' | 'EMAIL_SERVER' | 'ASSINATURA' | 'COMUNICACAO' | 'PLANILHA_USUARIOS' | 'DADOS'
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
      // Remove legacy v1 cache that contained un-sent demo reports
      localStorage.removeItem('holerite_income_reports_v1');
      const saved = localStorage.getItem(STORAGE_KEY_INCOME_REPORTS);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });
  const [isIncomeReportsAdminOpen, setIsIncomeReportsAdminOpen] = useState(false);
  const [viewingIncomeReport, setViewingIncomeReport] = useState<IncomeReport | null>(null);

  // Central de Auditoria & Logs do Sistema
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>(() => {
    try {
      const saved = localStorage.getItem('system_logs_data');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return getInitialSampleLogs();
  });
  const [isSystemLogsOpen, setIsSystemLogsOpen] = useState(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 1. Test connection to Firestore on boot (per SKILL.md) & load persistent server config and data backups
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

    // Fetch permanent server-side backups for users, employees, and receipts
    fetch('/api/users')
      .then(res => res.json())
      .then(data => {
        if (data?.success && Array.isArray(data.users) && data.users.length > 0) {
          setUsers(prev => {
            const map = new Map<string, UserAccount>();
            prev.forEach(u => map.set(u.uid || (u.employeeCodigo ? `user-${u.employeeCodigo}` : u.email.toLowerCase()), u));
            data.users.forEach((u: UserAccount) => {
              const key = u.uid || (u.employeeCodigo ? `user-${u.employeeCodigo}` : u.email.toLowerCase());
              map.set(key, u);
            });
            const list = Array.from(map.values());
            try { localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(list)); } catch (e) {}
            return list;
          });
        }
      })
      .catch(() => {});

    fetch('/api/employees')
      .then(res => res.json())
      .then(data => {
        if (data?.success && Array.isArray(data.employees) && data.employees.length > 0) {
          setEmployees(prev => {
            const map = new Map<string, Employee>();
            prev.forEach(e => map.set(e.codigo, e));
            data.employees.forEach((e: Employee) => map.set(e.codigo, e));
            const list = Array.from(map.values());
            try { localStorage.setItem(STORAGE_KEY_EMPLOYEES, JSON.stringify(list)); } catch (e) {}
            return list;
          });
        }
      })
      .catch(() => {});

    fetch('/api/receipts')
      .then(res => res.json())
      .then(data => {
        if (data?.success && Array.isArray(data.receipts) && data.receipts.length > 0) {
          setReceipts(prev => {
            const map = new Map<string, PayReceipt>();
            prev.forEach(r => map.set(r.id, r));
            data.receipts.forEach((r: PayReceipt) => map.set(r.id, r));
            const list = Array.from(map.values());
            try { localStorage.setItem(STORAGE_KEY_RECEIPTS, JSON.stringify(list)); } catch (e) {}
            return list;
          });
        }
      })
      .catch(() => {});

    fetch('/api/system-logs')
      .then(res => res.json())
      .then(data => {
        if (data?.success && Array.isArray(data.logs) && data.logs.length > 0) {
          setSystemLogs(prev => {
            const map = new Map<string, SystemLog>();
            prev.forEach(l => map.set(l.id, l));
            data.logs.forEach((l: SystemLog) => map.set(l.id, l));
            const list = Array.from(map.values()).sort(
              (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
            try {
              localStorage.setItem('system_logs_data', JSON.stringify(list));
            } catch (e) {}
            return list;
          });
        }
      })
      .catch(() => {});
  }, []);

  // 2. Setup Firestore Realtime Listeners with non-destructive merge
  useEffect(() => {
    const unsubEmployees = subscribeEmployees((remoteEmployees) => {
      if (remoteEmployees && remoteEmployees.length > 0) {
        setEmployees(prevEmployees => {
          const map = new Map<string, Employee>();
          remoteEmployees.forEach(e => map.set(e.codigo, e));
          prevEmployees.forEach(e => {
            if (!map.has(e.codigo)) {
              map.set(e.codigo, e);
              saveEmployeeFirestore(e).catch(() => {});
            }
          });
          const merged = Array.from(map.values());
          try {
            localStorage.setItem(STORAGE_KEY_EMPLOYEES, JSON.stringify(merged));
          } catch (e) {}
          return merged;
        });
      }
    });

    const unsubReceipts = subscribeReceipts((remoteReceipts) => {
      if (remoteReceipts && remoteReceipts.length > 0) {
        setReceipts(prevReceipts => {
          const map = new Map<string, PayReceipt>();
          remoteReceipts.forEach(r => map.set(r.id, r));
          prevReceipts.forEach(r => {
            if (!map.has(r.id)) {
              map.set(r.id, r);
              saveReceiptFirestore(r).catch(() => {});
            }
          });
          const merged = Array.from(map.values());
          try {
            localStorage.setItem(STORAGE_KEY_RECEIPTS, JSON.stringify(merged));
          } catch (e) {}
          return merged;
        });
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
      if (remoteUsers && remoteUsers.length > 0) {
        setUsers(prevUsers => {
          const map = new Map<string, UserAccount>();

          // First add all remote users from Firestore
          remoteUsers.forEach(u => {
            const key = u.uid || (u.employeeCodigo ? `user-${u.employeeCodigo}` : u.email.toLowerCase());
            map.set(key, u);
          });

          // Prevent deletion: preserve any local users not yet synced or with passwords configured
          prevUsers.forEach(u => {
            const key = u.uid || (u.employeeCodigo ? `user-${u.employeeCodigo}` : u.email.toLowerCase());
            const existing = map.get(key);
            if (!existing) {
              map.set(key, u);
              saveUserAccount(u).catch(() => {});
            } else if (u.senha && (!existing.senha || existing.senha.trim() === '')) {
              // Local has configured password, keep it and sync to Firestore
              const merged = { ...existing, senha: u.senha };
              map.set(key, merged);
              saveUserAccount(merged).catch(() => {});
            }
          });

          const mergedList = Array.from(map.values());
          try {
            localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(mergedList));
          } catch (e) {}
          return mergedList;
        });
      } else {
        // If Firestore has 0 users, seed it with initial/local users
        setUsers(prevUsers => {
          if (prevUsers.length > 0) {
            saveUsersBatchFirestore(prevUsers).catch(() => {});
          }
          return prevUsers;
        });
      }
    });

    const unsubMedical = subscribeMedicalCertificates((remoteCerts) => {
      setMedicalCertificates(remoteCerts);
    });

    const unsubIncome = subscribeToIncomeReports((remoteReports) => {
      setIncomeReports(remoteReports);
      try {
        localStorage.setItem(STORAGE_KEY_INCOME_REPORTS, JSON.stringify(remoteReports));
      } catch (e) {}
    });

    const unsubLogs = subscribeSystemLogs((remoteLogs) => {
      if (remoteLogs && remoteLogs.length > 0) {
        setSystemLogs(prev => {
          const map = new Map<string, SystemLog>();
          remoteLogs.forEach(l => map.set(l.id, l));
          prev.forEach(l => {
            if (!map.has(l.id)) map.set(l.id, l);
          });
          const list = Array.from(map.values()).sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
          try {
            localStorage.setItem('system_logs_data', JSON.stringify(list));
          } catch (e) {}
          return list;
        });
      }
    });

    const handleSystemLogCreated = (e: any) => {
      if (e.detail) {
        setSystemLogs(prev => {
          const exists = prev.some(l => l.id === e.detail.id);
          if (exists) return prev;
          const list = [e.detail, ...prev];
          try {
            localStorage.setItem('system_logs_data', JSON.stringify(list));
          } catch (err) {}
          return list;
        });
      }
    };
    window.addEventListener('applet:system_log_created', handleSystemLogCreated);

    return () => {
      unsubEmployees();
      unsubReceipts();
      unsubConfig();
      unsubUsers();
      unsubMedical();
      unsubIncome();
      unsubLogs();
      window.removeEventListener('applet:system_log_created', handleSystemLogCreated);
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

  const normalizeNameForMatch = (s?: string) =>
    (s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\(gestor.*?\)/gi, '')
      .trim()
      .toLowerCase();

  const findLinkedEmployee = (user: UserAccount | null, list: Employee[]): Employee | null => {
    if (!user || list.length === 0) return null;
    const uEmail = (user.email || '').trim().toLowerCase();
    const uName = normalizeNameForMatch(user.nome);
    const uCode = (user.employeeCodigo || '').trim();

    if (user.role === 'COLABORADOR') {
      if (uCode) {
        const byCode = list.find(e => String(e.codigo).trim() === uCode);
        if (byCode) return byCode;
      }
      if (uEmail) {
        const byEmail = list.find(e => (e.email || '').trim().toLowerCase() === uEmail);
        if (byEmail) return byEmail;
      }
      if (uName) {
        const byName = list.find(e => normalizeNameForMatch(e.nome) === uName);
        if (byName) return byName;
      }
      return null;
    }

    // Para GESTOR: só vincula a um colaborador se os dados do colaborador (e-mail ou nome) realmente corresponderem ao Gestor
    if (uCode) {
      const byCode = list.find(e => String(e.codigo).trim() === uCode);
      if (byCode) {
        const eEmail = (byCode.email || '').trim().toLowerCase();
        const eName = normalizeNameForMatch(byCode.nome);
        const sameEmail = Boolean(uEmail && eEmail && uEmail === eEmail);
        const sameName = Boolean(
          uName && eName && (eName === uName || eName.includes(uName) || uName.includes(eName))
        );
        if (sameEmail || sameName) {
          return byCode;
        }
      }
    }
    if (uEmail) {
      const byEmail = list.find(e => (e.email || '').trim().toLowerCase() === uEmail);
      if (byEmail) return byEmail;
    }
    if (uName) {
      const byName = list.find(e => {
        const eName = normalizeNameForMatch(e.nome);
        return Boolean(eName && (eName === uName || eName.includes(uName) || uName.includes(eName)));
      });
      if (byName) return byName;
    }
    return null;
  };

  // Colaborador estritamente vinculado ao usuário logado
  const linkedEmployee = findLinkedEmployee(currentUser, employees);

  // Se o colaborador logado tiver sido bloqueado pelo gestor, encerra o acesso imediatamente
  useEffect(() => {
    if (currentUser?.role === 'COLABORADOR' && linkedEmployee?.bloqueado) {
      handleLogout();
      showToast('Acesso bloqueado pelo Gestor do Cartório. Procure o RH / Administração.');
    }
  }, [currentUser, linkedEmployee]);

  // Actions
  const handleOpenDigitalSignature = (receipt: PayReceipt) => {
    if (currentView !== 'EMPLOYEE') {
      showToast('A assinatura do holerite só pode ser realizada pelo próprio colaborador no Portal do Colaborador.');
      return;
    }
    if (!currentUser || !linkedEmployee || receipt.employeeCodigo !== linkedEmployee.codigo) {
      showToast('Ação bloqueada: Você só pode assinar o holerite vinculado ao seu próprio usuário.');
      return;
    }
    setSigningModalData({ employee: linkedEmployee, receipt });
  };

  const handleDigitalSignatureSuccess = async (receiptId: string, code: string, canal: 'WHATSAPP' | 'EMAIL') => {
    const targetReceipt = receipts.find(r => r.id === receiptId);
    if (currentView !== 'EMPLOYEE' || !currentUser || !linkedEmployee || !targetReceipt || targetReceipt.employeeCodigo !== linkedEmployee.codigo) {
      showToast('Ação bloqueada: Somente o colaborador titular pode assinar seu próprio holerite pelo Portal do Colaborador.');
      return;
    }

    const now = new Date();
    const formattedDate = now.toLocaleDateString('pt-BR') + ' às ' + now.toLocaleTimeString('pt-BR');

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

    recordSignatureEvent(linkedEmployee, targetReceipt, {
      metodo: canal,
      sucesso: true,
      codigoVerificacao: code
    }).catch(() => {});

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
    let finalEmployees: Employee[] = [];
    let finalReceipts: PayReceipt[] = [];

    // Merge employees by codigo
    setEmployees(prev => {
      const map = new Map<string, Employee>();
      prev.forEach(emp => map.set(emp.codigo, emp));
      newOrUpdatedEmployees.forEach(emp => map.set(emp.codigo, emp));
      finalEmployees = Array.from(map.values());
      try {
        localStorage.setItem(STORAGE_KEY_EMPLOYEES, JSON.stringify(finalEmployees));
      } catch (e) {}
      return finalEmployees;
    });

    // Merge receipts by id
    setReceipts(prev => {
      const map = new Map<string, PayReceipt>();
      prev.forEach(r => map.set(r.id, r));
      newReceipts.forEach(r => map.set(r.id, r));
      finalReceipts = Array.from(map.values());
      try {
        localStorage.setItem(STORAGE_KEY_RECEIPTS, JSON.stringify(finalReceipts));
      } catch (e) {}
      return finalReceipts;
    });

    // Persist each in Firestore
    for (const emp of newOrUpdatedEmployees) {
      saveEmployeeFirestore(emp).catch(() => {});
    }
    for (const rec of newReceipts) {
      saveReceiptFirestore(rec).catch(() => {});
    }

    // Also persist to server disk (VPS backup)
    setTimeout(() => {
      if (finalEmployees.length > 0) {
        fetch('/api/employees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employees: finalEmployees })
        }).catch(() => {});
      }
      if (finalReceipts.length > 0) {
        fetch('/api/receipts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ receipts: finalReceipts })
        }).catch(() => {});
      }
    }, 100);

    // Cadastro automático dos colaboradores importados em Usuários vinculando nome e matrícula
    const usersToPersist: UserAccount[] = [];
    setUsers(prevUsers => {
      const updatedList = [...prevUsers];
      newOrUpdatedEmployees.forEach(emp => {
        const existingIdx = updatedList.findIndex(
          u =>
            u.role === 'COLABORADOR' &&
            (u.employeeCodigo === emp.codigo ||
              (u.nome && u.nome.trim().toLowerCase() === emp.nome.trim().toLowerCase()))
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
          // Cria o registro do usuário
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

      // Backup users to server disk
      fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users: updatedList })
      }).catch(() => {});

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

  const handleBatchUpdateEmployeesAndUsers = async (
    updatedEmployees: Employee[],
    updatedUsers: UserAccount[]
  ) => {
    setEmployees(updatedEmployees);
    try {
      localStorage.setItem(STORAGE_KEY_EMPLOYEES, JSON.stringify(updatedEmployees));
    } catch (e) {}

    setUsers(updatedUsers);
    try {
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(updatedUsers));
    } catch (e) {}

    // Sincronizar backup em disco do servidor
    fetch('/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employees: updatedEmployees })
    }).catch(() => {});

    fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ users: updatedUsers })
    }).catch(() => {});

    // Sincronizar em lote com o Firestore
    saveEmployeesBatchFirestore(updatedEmployees).catch(() => {});
    saveUsersBatchFirestore(updatedUsers).catch(() => {});

    if (currentUser) {
      recordSpreadsheetImportEvent(currentUser, {
        totalRows: updatedEmployees.length,
        matchedCount: updatedEmployees.length,
        newEmailsCount: updatedEmployees.filter(e => Boolean(e.email)).length,
        newPhonesCount: updatedEmployees.filter(e => Boolean(e.telefone)).length,
        newPasswordsCount: updatedUsers.filter(u => Boolean(u.senha)).length
      }).catch(() => {});
    }

    showToast(`Base atualizada! ${updatedEmployees.length} colaboradores e ${updatedUsers.length} usuários sincronizados.`);
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

    const targetEmp = employees.find(e => e.codigo === employeeCodigo);
    const targetRec = receipts.find(r => r.id === receiptId);
    if (targetEmp && targetRec) {
      recordEmailDispatchEvent(targetEmp, targetRec, {
        email,
        success: true
      }).catch(() => {});
    }

    showToast(`Comprovante enviado com sucesso para ${email}!`);
  };

  const handleSaveUser = async (userToSave: UserAccount) => {
    let nextUsersList: UserAccount[] = [];
    setUsers(prev => {
      const idx = prev.findIndex(u => u.uid === userToSave.uid);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = userToSave;
        nextUsersList = copy;
        return copy;
      }
      nextUsersList = [...prev, userToSave];
      return nextUsersList;
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

    // Also persist users array to server disk
    setTimeout(() => {
      if (nextUsersList.length > 0) {
        fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ users: nextUsersList })
        }).catch(() => {});
      }
    }, 50);

    showToast(`Usuário ${userToSave.nome} salvo com sucesso!`);
  };

  const handleDeleteUser = async (uid: string) => {
    let nextList: UserAccount[] = [];
    setUsers(prev => {
      const updated = prev.filter(u => u.uid !== uid);
      nextList = updated;
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

    // Sync updated list to server disk
    setTimeout(() => {
      fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users: nextList })
      }).catch(() => {});
    }, 50);
  };

  const handleUploadMedicalCertificate = async (cert: MedicalCertificate) => {
    try {
      await saveMedicalCertificateFirestore(cert);
      setMedicalCertificates(prev => {
        const exists = prev.some(c => c.id === cert.id);
        return exists ? prev.map(c => (c.id === cert.id ? cert : c)) : [cert, ...prev];
      });
      showToast('Atestado médico enviado e arquivado com sucesso!');
    } catch (err: any) {
      console.error('Erro ao arquivar atestado médico:', err);
      const reason = err?.message || 'Falha desconhecida ao comunicar com o servidor.';
      showToast(`Erro ao enviar atestado: ${reason}`);
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
      const nowIso = new Date().toISOString();
      const stampedReports: IncomeReport[] = newReports.map(r => ({
        ...r,
        enviadoEm: r.enviadoEm || nowIso,
        canalEnvio: r.canalEnvio || 'PORTAL'
      }));

      await saveIncomeReportsBatchFirestore(stampedReports);
      setIncomeReports(prev => {
        const map = new Map(prev.map(r => [r.id, r]));
        stampedReports.forEach(r => map.set(r.id, r));
        const merged = Array.from(map.values());
        try {
          localStorage.setItem(STORAGE_KEY_INCOME_REPORTS, JSON.stringify(merged));
        } catch (e) {}
        fetch('/api/income-reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reports: merged })
        }).catch(() => {});
        return merged;
      });

      // Registra no histórico de comunicações/auditoria para cada comprovante disponibilizado
      stampedReports.forEach(rep => {
        const matchedEmp = employees.find(
          e =>
            String(e.codigo).trim() === String(rep.beneficiario.employeeCodigo).trim() ||
            (e.cpf && rep.beneficiario.cpf && e.cpf.replace(/\D/g, '') === rep.beneficiario.cpf.replace(/\D/g, ''))
        );
        recordIncomeReportEvent(rep, matchedEmp, {
          canal: 'PORTAL',
          sucesso: true
        }).catch(() => {});
      });

      showToast(`${stampedReports.length} Comprovantes de Rendimentos salvos e disponibilizados no Portal!`);
    } catch (err: any) {
      console.error(err);
      showToast(`Erro ao salvar comprovantes: ${err?.message || 'Erro'}`);
      throw err;
    }
  };

  const handleDeleteIncomeReport = async (id: string) => {
    const targetReport = incomeReports.find(r => r.id === id);
    if (targetReport) {
      recordDeleteIncomeReportEvent(currentUser, targetReport).catch(() => {});
    }

    // Atualiza o estado local e localStorage imediatamente para resposta instantânea na interface
    setIncomeReports(prev => {
      const filtered = prev.filter(r => r.id !== id);
      try {
        localStorage.setItem(STORAGE_KEY_INCOME_REPORTS, JSON.stringify(filtered));
      } catch (e) {}
      fetch('/api/income-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reports: filtered })
      }).catch(() => {});
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

    recordBatchDeleteIncomeReportsEvent(currentUser, anoCalendario, count).catch(() => {});

    // Remove do estado local e localStorage imediatamente
    setIncomeReports(prev => {
      const filtered = prev.filter(r => r.anoCalendario !== anoCalendario);
      try {
        localStorage.setItem(STORAGE_KEY_INCOME_REPORTS, JSON.stringify(filtered));
      } catch (e) {}
      fetch('/api/income-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reports: filtered })
      }).catch(() => {});
      return filtered;
    });

    try {
      await deleteIncomeReportsBatchFirestore(toDelete.map(r => r.id));
    } catch (err: any) {
      console.warn('Erro ao sincronizar exclusão em lote no Firestore:', err);
    }
    showToast(`${count} comprovantes do Ano-Calendário ${anoCalendario} excluídos com sucesso.`);
  };

  // Exclusão individual de holerite
  const handleDeleteReceipt = async (receipt: PayReceipt, employee?: Employee) => {
    setReceipts(prev => {
      const filtered = prev.filter(r => r.id !== receipt.id);
      try { localStorage.setItem(STORAGE_KEY_RECEIPTS, JSON.stringify(filtered)); } catch (e) {}
      fetch('/api/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receipts: filtered })
      }).catch(() => {});
      return filtered;
    });

    try {
      await deleteReceiptFirestore(receipt.id);
    } catch (e) {
      console.warn('Erro ao excluir holerite no Firestore:', e);
    }

    recordDeleteReceiptEvent(currentUser, employee, receipt).catch(() => {});
    showToast(`Holerite de ${employee?.nome || `Matrícula #${receipt.employeeCodigo}`} (${receipt.mesAno}) excluído com sucesso.`);
  };

  // Exclusão em lote de holerites por mês
  const handleDeleteReceiptsByMonth = async (mesAno: string) => {
    const toDelete = receipts.filter(r => r.mesAno === mesAno);
    const count = toDelete.length;
    if (count === 0) {
      showToast(`Nenhum holerite encontrado no mês de ${mesAno}.`);
      return;
    }

    setReceipts(prev => {
      const filtered = prev.filter(r => r.mesAno !== mesAno);
      try { localStorage.setItem(STORAGE_KEY_RECEIPTS, JSON.stringify(filtered)); } catch (e) {}
      fetch('/api/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receipts: filtered })
      }).catch(() => {});
      return filtered;
    });

    try {
      await deleteReceiptsBatchFirestore(toDelete.map(r => r.id));
    } catch (e) {
      console.warn('Erro ao excluir holerites no Firestore:', e);
    }

    recordBatchDeleteReceiptsEvent(currentUser, 'MES', mesAno, count).catch(() => {});
    showToast(`${count} holerite(s) de ${mesAno} excluído(s) com sucesso.`);
  };

  // Exclusão em lote de holerites por ano
  const handleDeleteReceiptsByYear = async (ano: string) => {
    const toDelete = receipts.filter(
      r => (r.mesAno && r.mesAno.includes(ano)) || (r.competencia && r.competencia.startsWith(ano))
    );
    const count = toDelete.length;
    if (count === 0) {
      showToast(`Nenhum holerite encontrado para o ano ${ano}.`);
      return;
    }

    setReceipts(prev => {
      const filtered = prev.filter(
        r => !((r.mesAno && r.mesAno.includes(ano)) || (r.competencia && r.competencia.startsWith(ano)))
      );
      try { localStorage.setItem(STORAGE_KEY_RECEIPTS, JSON.stringify(filtered)); } catch (e) {}
      fetch('/api/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receipts: filtered })
      }).catch(() => {});
      return filtered;
    });

    try {
      await deleteReceiptsBatchFirestore(toDelete.map(r => r.id));
    } catch (e) {
      console.warn('Erro ao excluir holerites no Firestore:', e);
    }

    recordBatchDeleteReceiptsEvent(currentUser, 'ANO', ano, count).catch(() => {});
    showToast(`${count} holerite(s) do ano ${ano} excluído(s) com sucesso.`);
  };

  // Bloqueio e Desbloqueio de Colaborador
  const handleToggleBlockEmployee = async (employee: Employee, bloqueado: boolean, motivo?: string) => {
    const updatedEmployee: Employee = {
      ...employee,
      bloqueado,
      bloqueadoEm: bloqueado ? new Date().toISOString() : undefined,
      motivoBloqueio: motivo
    };

    setEmployees(prev => {
      const updated = prev.map(e => (e.codigo === employee.codigo ? updatedEmployee : e));
      try { localStorage.setItem(STORAGE_KEY_EMPLOYEES, JSON.stringify(updated)); } catch (e) {}
      fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employees: updated })
      }).catch(() => {});
      return updated;
    });

    try {
      await toggleEmployeeBlockFirestore(employee.codigo, bloqueado, motivo);
    } catch (e) {
      console.warn('Erro ao salvar status de bloqueio no Firestore:', e);
    }

    recordToggleEmployeeBlockEvent(currentUser, employee, bloqueado, motivo).catch(() => {});
    showToast(`Colaborador ${employee.nome} foi ${bloqueado ? 'BLOQUEADO' : 'DESBLOQUEADO'} com sucesso!`);
  };

  // Exclusão de Colaborador em Cascata (exclui colaborador, holerites, IRPF e usuário)
  const handleDeleteEmployeeWithCascade = async (employee: Employee) => {
    const codigo = String(employee.codigo).trim();
    const cleanCpf = employee.cpf ? employee.cpf.replace(/\D/g, '') : '';

    // 1. Encontra e remove holerites vinculados
    const receiptsToDelete = receipts.filter(r => String(r.employeeCodigo).trim() === codigo);
    const recCount = receiptsToDelete.length;

    setReceipts(prev => {
      const filtered = prev.filter(r => String(r.employeeCodigo).trim() !== codigo);
      try { localStorage.setItem(STORAGE_KEY_RECEIPTS, JSON.stringify(filtered)); } catch (e) {}
      fetch('/api/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receipts: filtered })
      }).catch(() => {});
      return filtered;
    });

    if (recCount > 0) {
      deleteReceiptsBatchFirestore(receiptsToDelete.map(r => r.id)).catch(() => {});
    }

    // 2. Encontra e remove comprovantes de IRPF vinculados
    const irpfToDelete = incomeReports.filter(r => {
      const bCod = String(r.beneficiario?.employeeCodigo || '').trim();
      const bCpf = r.beneficiario?.cpf ? r.beneficiario.cpf.replace(/\D/g, '') : '';
      if (bCod && bCod === codigo) return true;
      if (cleanCpf && bCpf && cleanCpf === bCpf) return true;
      return false;
    });
    const irpfCount = irpfToDelete.length;

    setIncomeReports(prev => {
      const filtered = prev.filter(r => {
        const bCod = String(r.beneficiario?.employeeCodigo || '').trim();
        const bCpf = r.beneficiario?.cpf ? r.beneficiario.cpf.replace(/\D/g, '') : '';
        if (bCod && bCod === codigo) return false;
        if (cleanCpf && bCpf && cleanCpf === bCpf) return false;
        return true;
      });
      try { localStorage.setItem(STORAGE_KEY_INCOME_REPORTS, JSON.stringify(filtered)); } catch (e) {}
      fetch('/api/income-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reports: filtered })
      }).catch(() => {});
      return filtered;
    });

    if (irpfCount > 0) {
      deleteIncomeReportsBatchFirestore(irpfToDelete.map(r => r.id)).catch(() => {});
    }

    // 3. Remove conta de usuário vinculado
    let userToRemoveUid: string | null = null;
    setUsers(prev => {
      const user = prev.find(
        u => u.role === 'COLABORADOR' && (u.employeeCodigo === codigo || (employee.email && u.email && u.email.toLowerCase() === employee.email.toLowerCase()))
      );
      if (user) {
        userToRemoveUid = user.uid;
      }
      const filtered = prev.filter(u => u.uid !== userToRemoveUid);
      try { localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(filtered)); } catch (e) {}
      fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users: filtered })
      }).catch(() => {});
      return filtered;
    });

    if (userToRemoveUid) {
      deleteUserAccountFirestore(userToRemoveUid).catch(() => {});
    }

    // 4. Remove o colaborador
    setEmployees(prev => {
      const filtered = prev.filter(e => String(e.codigo).trim() !== codigo);
      try { localStorage.setItem(STORAGE_KEY_EMPLOYEES, JSON.stringify(filtered)); } catch (e) {}
      fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employees: filtered })
      }).catch(() => {});
      return filtered;
    });

    deleteEmployeeFirestore(codigo).catch(() => {});

    // 5. Registra log de auditoria
    recordDeleteEmployeeCascadeEvent(currentUser, employee, recCount, irpfCount).catch(() => {});
    showToast(`Colaborador ${employee.nome} excluído! ${recCount} holerite(s) e ${irpfCount} informe(s) IRPF apagados em cascata.`);
  };

  const handleLoginSuccess = (user: UserAccount, employee?: Employee) => {
    setCurrentUser(user);
    const matchedEmp = employee || findLinkedEmployee(user, employees);
    if (user.role === 'GESTOR' && !matchedEmp) {
      setCurrentView('ADMIN');
    } else {
      setCurrentView('EMPLOYEE');
    }
    if (matchedEmp) {
      setSelectedEmployeeId(matchedEmp.codigo);
    }
    recordLoginEvent(user, matchedEmp || undefined, {
      is2FA: Boolean(systemConfig.exigir2FALogin),
      success: true
    }).catch(() => {});
    showToast(`Bem-vindo(a), ${user.nome}!`);
  };

  const handleLogout = () => {
    if (currentUser) {
      recordLogoutEvent(currentUser).catch(() => {});
    }
    setCurrentUser(null);
    localStorage.removeItem(STORAGE_KEY_USER);
    auth.signOut().catch(() => {});
    showToast('Sessão encerrada. Até logo!');
  };

  const handleOpenSettingsWithTab = (tab?: 'CERTIFICADO_A1' | 'EMPRESA' | 'EMAIL_SERVER' | 'ASSINATURA' | 'COMUNICACAO' | 'PLANILHA_USUARIOS' | 'DADOS') => {
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
          systemConfig={systemConfig}
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
            systemConfig={systemConfig}
          />
        </main>
      ) : (
        /* Conteúdo Autenticado: Portal do Colaborador ou Gestão RH */
        <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
          {currentView === 'EMPLOYEE' ? (
            linkedEmployee ? (
              <EmployeePortal
                currentUser={currentUser}
                employee={linkedEmployee}
                allReceipts={receipts}
                systemConfig={systemConfig}
                medicalCertificates={medicalCertificates.filter(c => c.employeeCodigo === linkedEmployee.codigo)}
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
              <div className="bg-white p-10 sm:p-12 text-center rounded-2xl border border-slate-200 shadow-sm space-y-3 max-w-xl mx-auto my-6">
                <ShieldCheck className="w-10 h-10 text-blue-600 mx-auto" />
                <h3 className="font-bold text-slate-800 text-base">
                  Nenhum Holerite Vinculado ao Seu Usuário ({currentUser.nome})
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                  Por segurança e conformidade com o Art. 464 da CLT, o <strong>Portal do Colaborador</strong> exibe e permite assinar exclusivamente o holerite vinculado ao próprio usuário logado.
                  {currentUser.role === 'GESTOR'
                    ? ' Utilize o painel Gestão RH / Admin para consultar os holerites de todos os colaboradores.'
                    : ' Solicite ao Gestor de RH a vinculação da sua matrícula ao seu usuário.'}
                </p>
                {currentUser.role === 'GESTOR' && (
                  <button
                    onClick={() => setCurrentView('ADMIN')}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors cursor-pointer"
                  >
                    Ir para Gestão RH / Admin
                  </button>
                )}
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
              onViewIncomeReport={(rep) => setViewingIncomeReport(rep)}
              onOpenSystemLogs={() => setIsSystemLogsOpen(true)}
              systemLogsCount={systemLogs.length}
              onDeleteReceipt={handleDeleteReceipt}
              onDeleteReceiptsByMonth={handleDeleteReceiptsByMonth}
              onDeleteReceiptsByYear={handleDeleteReceiptsByYear}
              onDeleteEmployee={handleDeleteEmployeeWithCascade}
              onToggleBlockEmployee={handleToggleBlockEmployee}
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
          onDeleteEmployee={handleDeleteEmployeeWithCascade}
          onToggleBlock={handleToggleBlockEmployee}
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
        onOpenEmailModal={(emp, rec) => setEmailModalData({ employee: emp, receipt: rec })}
        certificateConfig={systemConfig.certificadoA1}
        employerName={systemConfig.razaoSocial}
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
        employees={employees}
        users={users}
        onBatchUpdateEmployeesAndUsers={handleBatchUpdateEmployeesAndUsers}
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
        systemConfig={systemConfig}
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

      {/* Central de Auditoria, Histórico de Comunicações e Logs */}
      <SystemLogsModal
        isOpen={isSystemLogsOpen}
        onClose={() => setIsSystemLogsOpen(false)}
        logs={systemLogs}
        employees={employees}
        users={users}
        onClearLogs={() => {
          setSystemLogs([]);
          localStorage.removeItem('system_logs_data');
          clearSystemLogsFirestore().catch(() => {});
          showToast('Histórico de logs limpo com sucesso.');
        }}
      />
    </div>
  );
}
