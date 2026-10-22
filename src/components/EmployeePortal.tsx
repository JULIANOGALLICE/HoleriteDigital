import React, { useState } from 'react';
import { Employee, PayReceipt, SystemConfig, MedicalCertificate, IncomeReport, UserAccount } from '../types';
import { ReceiptViewer } from './ReceiptViewer';
import { MedicalCertificateUploadModal } from './MedicalCertificateUploadModal';
import { MedicalCertificateViewModal } from './MedicalCertificateViewModal';
import { MandatoryRegistrationModal } from './MandatoryRegistrationModal';
import { formatBRL, downloadPayReceiptPDF } from '../utils/pdfGenerator';
import { formatCurrencyBRL, generateIncomeReportPdf } from '../utils/incomeReportPdfGenerator';
import {
  Calendar,
  CreditCard,
  Download,
  CheckCircle,
  Clock,
  User,
  Users,
  MapPin,
  Building,
  ShieldCheck,
  TrendingUp,
  FileCheck,
  ChevronRight,
  PhoneCall,
  Edit3,
  Save,
  Plus,
  Trash2,
  Wallet,
  CheckCircle2,
  Stethoscope,
  Upload,
  Archive,
  XCircle,
  Eye,
  FileText,
  Lock
} from 'lucide-react';

interface EmployeePortalProps {
  employee: Employee;
  allReceipts: PayReceipt[];
  systemConfig?: SystemConfig;
  currentUser?: UserAccount | null;
  onSignReceipt: (receiptId: string) => void;
  onTriggerDigitalSignature?: (receipt: PayReceipt) => void;
  onOpenEmailModal: (employee: Employee, receipt: PayReceipt) => void;
  onUpdateEmployee?: (updated: Employee) => void;
  onSaveUserAccount?: (user: UserAccount) => Promise<void> | void;
  onLogout?: () => void;
  medicalCertificates?: MedicalCertificate[];
  onUploadMedicalCertificate?: (certificate: MedicalCertificate) => Promise<void>;
  incomeReports?: IncomeReport[];
  onViewIncomeReport?: (report: IncomeReport) => void;
}

export const EmployeePortal: React.FC<EmployeePortalProps> = ({
  employee,
  allReceipts,
  systemConfig,
  currentUser,
  onSignReceipt,
  onTriggerDigitalSignature,
  onOpenEmailModal,
  onUpdateEmployee,
  onSaveUserAccount,
  onLogout,
  medicalCertificates = [],
  onUploadMedicalCertificate,
  incomeReports = [],
  onViewIncomeReport
}) => {
  // Filter receipts for this employee
  const employeeReceipts = allReceipts
    .filter(r => r.employeeCodigo === employee.codigo)
    .sort((a, b) => b.competencia.localeCompare(a.competencia));

  // Filter medical certificates for this employee
  const myCertificates = medicalCertificates.filter(
    c => c.employeeCodigo === employee.codigo
  );

  // Filter income reports for this employee (matching by code, CPF or normalized name)
  const normalizeText = (s?: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const cleanDigitsOnly = (s?: string) => (s || '').replace(/\D/g, '');

  const myIncomeReports = incomeReports.filter(r => {
    // 1. Direct code matching
    if (r.beneficiario.employeeCodigo && employee.codigo) {
      if (r.beneficiario.employeeCodigo === employee.codigo) return true;
      const codeA = parseInt(r.beneficiario.employeeCodigo, 10);
      const codeB = parseInt(employee.codigo, 10);
      if (!isNaN(codeA) && !isNaN(codeB) && codeA === codeB) return true;
    }
    // 2. CPF matching
    if (employee.cpf && r.beneficiario.cpf) {
      const cleanEmpCpf = cleanDigitsOnly(employee.cpf);
      const cleanRepCpf = cleanDigitsOnly(r.beneficiario.cpf);
      if (cleanEmpCpf && cleanRepCpf && cleanEmpCpf === cleanRepCpf) return true;
    }
    // 3. Name matching (crucial for PDF split by user name)
    if (employee.nome && r.beneficiario.nomeCompleto) {
      const nameEmp = normalizeText(employee.nome);
      const nameRep = normalizeText(r.beneficiario.nomeCompleto);
      if (nameEmp && nameRep && (nameEmp === nameRep || nameEmp.includes(nameRep) || nameRep.includes(nameEmp))) {
        return true;
      }
    }
    return false;
  });

  const [selectedReceiptId, setSelectedReceiptId] = useState<string>(
    employeeReceipts[0]?.id || ''
  );
  const [activeTab, setActiveTab] = useState<'HOLERITE' | 'HISTORICO' | 'ATESTADOS' | 'RENDIMENTOS' | 'MEUS_DADOS'>('HOLERITE');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editFormData, setEditFormData] = useState<Employee>(employee);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Medical Certificate Modal States
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [viewingCertificate, setViewingCertificate] = useState<MedicalCertificate | null>(null);

  // New emergency contact form
  const [newContactNome, setNewContactNome] = useState('');
  const [newContactParentesco, setNewContactParentesco] = useState('Familiar');
  const [newContactTelefone, setNewContactTelefone] = useState('');
  const [newContactObs, setNewContactObs] = useState('');

  // Check mandatory registration completion & first-access password change
  const hasEmergencyContact =
    Array.isArray(employee.contatosFamiliares) &&
    employee.contatosFamiliares.length > 0 &&
    employee.contatosFamiliares.some(c => c.nome?.trim() && c.telefone?.trim());

  const isCollaborator = currentUser?.role === 'COLABORADOR';
  const requiresPasswordChange = isCollaborator && currentUser?.precisaTrocarSenha === true;
  const requiresProfileCompletion =
    isCollaborator &&
    (currentUser?.exigirCompletarCadastro !== false) &&
    (!employee.cadastroCompleto || !hasEmergencyContact || !employee.telefone || !employee.endereco?.logradouro);

  const mustCompleteRegistration = requiresPasswordChange || requiresProfileCompletion;

  const handleCompleteRegistration = async (updatedEmp: Employee, updatedUser: UserAccount) => {
    if (onUpdateEmployee) {
      await onUpdateEmployee(updatedEmp);
    }
    if (onSaveUserAccount) {
      await onSaveUserAccount(updatedUser);
    }
  };

  // Keep form synced when employee changes
  React.useEffect(() => {
    setEditFormData(employee);
  }, [employee]);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const hasEmergency =
      Array.isArray(editFormData.contatosFamiliares) &&
      editFormData.contatosFamiliares.some(c => c.nome?.trim() && c.telefone?.trim());

    const completeData: Employee = {
      ...editFormData,
      cadastroCompleto: Boolean(editFormData.telefone && editFormData.endereco?.logradouro && hasEmergency)
    };

    if (onUpdateEmployee) {
      onUpdateEmployee(completeData);
    }
    setIsEditingProfile(false);
    setSaveSuccessMsg('Seus dados cadastrais foram atualizados com sucesso!');
    setTimeout(() => setSaveSuccessMsg(null), 4000);
  };

  const handleAddEmergencyContact = () => {
    if (!newContactNome.trim() || !newContactTelefone.trim()) return;
    const newContact = {
      id: `cf-${Date.now()}`,
      nome: newContactNome.trim(),
      parentesco: newContactParentesco.trim(),
      telefone: newContactTelefone.trim(),
      observacao: newContactObs.trim() || undefined
    };

    setEditFormData(prev => ({
      ...prev,
      contatosFamiliares: [...prev.contatosFamiliares, newContact]
    }));

    setNewContactNome('');
    setNewContactTelefone('');
    setNewContactObs('');
  };

  const handleRemoveEmergencyContact = (contactId: string) => {
    setEditFormData(prev => ({
      ...prev,
      contatosFamiliares: prev.contatosFamiliares.filter(c => c.id !== contactId)
    }));
  };

  const currentReceipt = employeeReceipts.find(r => r.id === selectedReceiptId) || employeeReceipts[0];

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white rounded-2xl p-4 sm:p-6 shadow-xl border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-extrabold text-xl text-white shadow-lg ring-4 ring-white/10">
              {employee.nome.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-white">{employee.nome}</h2>
                <span className="text-[11px] bg-blue-500/20 text-blue-300 font-mono px-2 py-0.5 rounded-full border border-blue-400/30">
                  Matrícula: {employee.codigo}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 flex flex-wrap items-center gap-3">
                <span className="font-semibold text-blue-200">{employee.cargo}</span>
                <span>•</span>
                <span>{employee.departamento}</span>
                <span>•</span>
                <span>Admissão: {employee.dataAdmissao}</span>
              </p>
            </div>
          </div>

          {/* Quick Month Switcher */}
          {employeeReceipts.length > 0 && (
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-2.5 border border-white/15 flex items-center gap-3">
              <Calendar className="w-4 h-4 text-blue-300" />
              <div className="flex flex-col">
                <span className="text-[10px] uppercase text-blue-200 tracking-wider font-semibold">
                  Mês de Referência
                </span>
                <select
                  value={selectedReceiptId}
                  onChange={(e) => setSelectedReceiptId(e.target.value)}
                  className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer"
                >
                  {employeeReceipts.map((r) => (
                    <option key={r.id} value={r.id} className="text-slate-900 font-medium">
                      {r.mesAno} ({r.tipoFolha})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center border-b border-slate-200 gap-2 text-xs font-semibold text-slate-600 overflow-x-auto">
        <button
          onClick={() => setActiveTab('HOLERITE')}
          className={`py-3 px-4 border-b-2 flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap ${
            activeTab === 'HOLERITE'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-lg'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          <FileCheck className="w-4 h-4" /> Recibo do Mês
        </button>

        <button
          onClick={() => setActiveTab('HISTORICO')}
          className={`py-3 px-4 border-b-2 flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap ${
            activeTab === 'HISTORICO'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-lg'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          <TrendingUp className="w-4 h-4" /> Histórico Completo ({employeeReceipts.length} Meses)
        </button>

        <button
          onClick={() => setActiveTab('ATESTADOS')}
          className={`py-3 px-4 border-b-2 flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap ${
            activeTab === 'ATESTADOS'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-lg'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          <Stethoscope className="w-4 h-4" /> Atestados Médicos
          {myCertificates.length > 0 && (
            <span className="ml-1 text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.2 rounded-full">
              {myCertificates.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('RENDIMENTOS')}
          className={`py-3 px-4 border-b-2 flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap ${
            activeTab === 'RENDIMENTOS'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-lg'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          <FileText className="w-4 h-4 text-indigo-600" /> Comprovante de Rendimentos (IRPF)
          {myIncomeReports.length > 0 && (
            <span className="ml-1 text-[10px] bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.2 rounded-full">
              {myIncomeReports.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('MEUS_DADOS')}
          className={`py-3 px-4 border-b-2 flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap ${
            activeTab === 'MEUS_DADOS'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-lg'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          <User className="w-4 h-4" /> Meus Dados & Contatos
        </button>
      </div>

      {/* Tab: Recibo do Mês */}
      {activeTab === 'HOLERITE' && (
        <div className="space-y-6">
          {mustCompleteRegistration ? (
            <div className="bg-amber-50/90 border-2 border-amber-300 rounded-2xl p-8 text-center space-y-3 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center mx-auto shadow-sm">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="font-black text-amber-950 text-base">
                Visualização do Holerite Bloqueada
              </h3>
              <p className="text-xs text-amber-800 max-w-lg mx-auto leading-relaxed">
                Por determinação da Gestão de Recursos Humanos, antes de poder visualizar e assinar seu holerite é obrigatório completar seu cadastro (endereço, dados bancários e ao menos um telefone de emergência) e alterar sua senha no primeiro acesso.
              </p>
            </div>
          ) : currentReceipt ? (
            <>
              {/* Highlight KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Net Pay Card */}
                <div className="bg-gradient-to-br from-blue-900 to-indigo-950 text-white rounded-2xl p-5 shadow-md relative overflow-hidden">
                  <div className="relative z-10">
                    <span className="text-[11px] font-semibold text-blue-200 uppercase tracking-wider block">
                      Valor Líquido a Receber
                    </span>
                    <div className="text-2xl lg:text-3xl font-extrabold mt-1 tracking-tight">
                      R$ {formatBRL(currentReceipt.valorLiquido)}
                    </div>
                    <p className="text-[11px] text-blue-300 mt-2 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5" />
                      {employee.dadosBancarios?.banco ? employee.dadosBancarios.banco.slice(0, 24) : 'Conta Bancária'}
                    </p>
                  </div>
                </div>

                {/* Gross Pay */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Total de Vencimentos
                  </span>
                  <div className="text-xl font-bold text-emerald-700 mt-1">
                    R$ {formatBRL(currentReceipt.totalVencimentos)}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2">
                    Salário base: R$ {formatBRL(currentReceipt.salarioBase)}
                  </p>
                </div>

                {/* Deductions */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Total de Descontos
                  </span>
                  <div className="text-xl font-bold text-rose-700 mt-1">
                    - R$ {formatBRL(currentReceipt.totalDescontos)}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2">
                    INSS, IRRF, Adiantamentos e Convênios
                  </p>
                </div>

                {/* FGTS */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Depósito FGTS do Mês
                  </span>
                  <div className="text-xl font-bold text-blue-900 mt-1">
                    R$ {formatBRL(currentReceipt.fgtsDoMes)}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2">
                    Base: R$ {formatBRL(currentReceipt.baseCalcFGTS)} (Recolhido)
                  </p>
                </div>
              </div>

              {/* The Official Paystub Viewer */}
              <ReceiptViewer
                employee={employee}
                receipt={currentReceipt}
                onSignReceipt={onSignReceipt}
                onTriggerDigitalSignature={onTriggerDigitalSignature}
                onOpenEmailModal={onOpenEmailModal}
                certificateConfig={systemConfig?.certificadoA1}
              />
            </>
          ) : (
            <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-500">
              <FileCheck className="w-10 h-10 mx-auto mb-2 text-slate-400" />
              <h4 className="font-bold text-slate-800 text-sm">Nenhum holerite encontrado</h4>
              <p className="text-xs text-slate-500 mt-1">
                Aguarde o processamento da folha pelo Departamento Pessoal.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab: Histórico Completo */}
      {activeTab === 'HISTORICO' && (
        <div className="space-y-6">
          {mustCompleteRegistration ? (
            <div className="bg-amber-50/90 border-2 border-amber-300 rounded-2xl p-8 text-center space-y-3 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center mx-auto shadow-sm">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="font-black text-amber-950 text-base">
                Histórico de Holerites Bloqueado
              </h3>
              <p className="text-xs text-amber-800 max-w-lg mx-auto leading-relaxed">
                Complete seu cadastro com telefone de emergência e altere sua senha inicial para acessar o histórico de comprovantes.
              </p>
            </div>
          ) : (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-base text-slate-900 mb-1">
              Histórico Completo de Recibos de Pagamento
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              Consulte e baixe os holerites de todos os meses anteriores com termo de ciência.
            </p>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {employeeReceipts.map((receipt) => {
                const isSigned = receipt.statusAssinatura === 'ASSINADO';
                return (
                  <div key={receipt.id} className="hover:bg-slate-50 transition-colors">
                    {/* Layout Mobile (< sm) */}
                    <div className="sm:hidden p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm text-slate-900">{receipt.mesAno}</h4>
                            <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
                              {receipt.tipoFolha}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Bruto: R$ {formatBRL(receipt.totalVencimentos)} • Desc: R$ {formatBRL(receipt.totalDescontos)}
                          </p>
                        </div>
                        {isSigned ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Assinado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-300">
                            <Lock className="w-3.5 h-3.5 text-amber-600" /> Pendente
                          </span>
                        )}
                      </div>

                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] text-slate-500 font-medium">Valor Líquido:</span>
                        <span className="font-extrabold text-sm text-blue-950 font-mono">
                          R$ {formatBRL(receipt.valorLiquido)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        {receipt.statusAssinatura === 'ASSINADO' ? (
                          <button
                            onClick={() => downloadPayReceiptPDF(employee, receipt, systemConfig?.certificadoA1)}
                            className="py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer min-h-[40px]"
                          >
                            <Download className="w-3.5 h-3.5" /> Baixar PDF
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              if (onTriggerDigitalSignature) {
                                onTriggerDigitalSignature(receipt);
                              } else {
                                onSignReceipt(receipt.id);
                              }
                            }}
                            className="py-2.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer min-h-[40px]"
                          >
                            <Lock className="w-3.5 h-3.5" /> Assinar 2FA
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setSelectedReceiptId(receipt.id);
                            setActiveTab('HOLERITE');
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[40px]"
                        >
                          <Eye className="w-3.5 h-3.5" /> Visualizar
                        </button>
                      </div>
                    </div>

                    {/* Layout Desktop (sm+) */}
                    <div className="hidden sm:flex p-4 items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-50 text-blue-700 rounded-xl font-bold text-xs flex flex-col items-center justify-center min-w-[58px]">
                          <span>{receipt.mesAno.split(' ')[0].slice(0, 3)}</span>
                          <span className="text-[10px] font-normal text-slate-500">
                            {receipt.mesAno.split(' ')[2] || '2026'}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm text-slate-900">{receipt.mesAno}</h4>
                            <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
                              {receipt.tipoFolha}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Bruto: R$ {formatBRL(receipt.totalVencimentos)} • Descontos: R${' '}
                            {formatBRL(receipt.totalDescontos)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-4">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 block uppercase font-medium">
                            Valor Líquido
                          </span>
                          <span className="font-bold text-sm text-blue-950">
                            R$ {formatBRL(receipt.valorLiquido)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {isSigned ? (
                            <span
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200"
                              title="Recibo assinado pelo colaborador"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" /> Assinado
                            </span>
                          ) : (
                            <button
                              onClick={() => {
                                if (onTriggerDigitalSignature) {
                                  onTriggerDigitalSignature(receipt);
                                } else {
                                  onSignReceipt(receipt.id);
                                }
                              }}
                              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold text-[11px] rounded-lg border border-amber-300 transition-colors cursor-pointer"
                            >
                              Assinar 2FA
                            </button>
                          )}

                          {receipt.statusAssinatura === 'ASSINADO' ? (
                            <button
                              onClick={() => downloadPayReceiptPDF(employee, receipt, systemConfig?.certificadoA1)}
                              className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                              title="Baixar PDF Oficial com Assinatura Digital"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                if (onTriggerDigitalSignature) {
                                  onTriggerDigitalSignature(receipt);
                                } else {
                                  onSignReceipt(receipt.id);
                                }
                              }}
                              className="p-1.5 px-2 text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-semibold"
                              title="Download de PDF bloqueado. Assine digitalmente o recibo para liberar o arquivo oficial (Art. 464 CLT)."
                            >
                              <Lock className="w-3.5 h-3.5 text-amber-600" />
                              <span className="hidden sm:inline">Assinar p/ Baixar</span>
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setSelectedReceiptId(receipt.id);
                              setActiveTab('HOLERITE');
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="px-3 py-1.5 bg-slate-900 hover:bg-blue-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            Visualizar <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          )}
        </div>
      )}

      {/* Tab: Meus Dados Cadastrais */}
      {activeTab === 'MEUS_DADOS' && (
        <div className="space-y-6">
          {/* Header & Edit Action Banner */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" /> Meus Dados Cadastrais & Emergência
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Mantenha seu telefone, e-mail, endereço residencial, conta bancária e contatos de emergência atualizados.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {isEditingProfile ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setEditFormData(employee);
                      setIsEditingProfile(false);
                    }}
                    className="px-3.5 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    Salvar Alterações
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Edit3 className="w-4 h-4" />
                  Editar Meus Dados
                </button>
              )}
            </div>
          </div>

          {/* Feedback Success Toast */}
          {saveSuccessMsg && (
            <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-900 flex items-center gap-2.5 text-xs font-bold animate-in fade-in slide-in-from-top-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}

          {isEditingProfile ? (
            /* Formulário de Edição pelo Próprio Colaborador */
            <form onSubmit={handleSaveProfile} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Contatos Pessoais */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                  <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
                    <User className="w-4 h-4 text-blue-600" /> Contatos Pessoais
                  </h4>

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Telefone WhatsApp *</label>
                      <input
                        type="text"
                        value={editFormData.telefone}
                        onChange={(e) => setEditFormData({ ...editFormData, telefone: e.target.value })}
                        placeholder="(11) 98765-4321"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-medium"
                        required
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">E-mail Cadastrado *</label>
                      <input
                        type="email"
                        value={editFormData.email}
                        onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                        placeholder="seuemail@exemplo.com"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-medium"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div>
                        <span className="text-slate-400 block text-[11px]">Matrícula (fixo)</span>
                        <span className="font-bold text-slate-800">{employee.codigo}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Cargo (fixo)</span>
                        <span className="font-bold text-slate-800">{employee.cargo}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dados Bancários & PIX */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                  <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
                    <Wallet className="w-4 h-4 text-emerald-600" /> Dados Bancários para Pagamento & Chave Pix
                  </h4>

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Chave Pix</label>
                      <input
                        type="text"
                        value={editFormData.dadosBancarios.chavePix || ''}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            dadosBancarios: { ...editFormData.dadosBancarios, chavePix: e.target.value }
                          })
                        }
                        placeholder="CPF, Telefone, E-mail ou Chave Aleatória"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 font-medium"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">Banco</label>
                        <input
                          type="text"
                          value={editFormData.dadosBancarios.banco}
                          onChange={(e) =>
                            setEditFormData({
                              ...editFormData,
                              dadosBancarios: { ...editFormData.dadosBancarios, banco: e.target.value }
                            })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 font-medium"
                        />
                      </div>

                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">Tipo de Conta</label>
                        <select
                          value={editFormData.dadosBancarios.tipoConta}
                          onChange={(e) =>
                            setEditFormData({
                              ...editFormData,
                              dadosBancarios: {
                                ...editFormData.dadosBancarios,
                                tipoConta: e.target.value as any
                              }
                            })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 font-medium bg-white"
                        >
                          <option value="CORRENTE">Conta Corrente</option>
                          <option value="POUPANCA">Conta Poupança</option>
                          <option value="SALARIO">Conta Salário</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">Agência</label>
                        <input
                          type="text"
                          value={editFormData.dadosBancarios.agencia}
                          onChange={(e) =>
                            setEditFormData({
                              ...editFormData,
                              dadosBancarios: { ...editFormData.dadosBancarios, agencia: e.target.value }
                            })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 font-medium"
                        />
                      </div>

                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">Conta com Dígito</label>
                        <input
                          type="text"
                          value={editFormData.dadosBancarios.conta}
                          onChange={(e) =>
                            setEditFormData({
                              ...editFormData,
                              dadosBancarios: { ...editFormData.dadosBancarios, conta: e.target.value }
                            })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 font-medium"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Endereço Residencial */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
                  <MapPin className="w-4 h-4 text-blue-600" /> Endereço Residencial
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="sm:col-span-2">
                    <label className="font-semibold text-slate-700 block mb-1">Logradouro / Rua</label>
                    <input
                      type="text"
                      value={editFormData.endereco.logradouro}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          endereco: { ...editFormData.endereco, logradouro: e.target.value }
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Número</label>
                    <input
                      type="text"
                      value={editFormData.endereco.numero}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          endereco: { ...editFormData.endereco, numero: e.target.value }
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Complemento / Apto</label>
                    <input
                      type="text"
                      value={editFormData.endereco.complemento || ''}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          endereco: { ...editFormData.endereco, complemento: e.target.value }
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Bairro</label>
                    <input
                      type="text"
                      value={editFormData.endereco.bairro}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          endereco: { ...editFormData.endereco, bairro: e.target.value }
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Cidade</label>
                    <input
                      type="text"
                      value={editFormData.endereco.cidade}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          endereco: { ...editFormData.endereco, cidade: e.target.value }
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">UF (Estado)</label>
                    <input
                      type="text"
                      value={editFormData.endereco.uf}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          endereco: { ...editFormData.endereco, uf: e.target.value }
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">CEP</label>
                    <input
                      type="text"
                      value={editFormData.endereco.cep}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          endereco: { ...editFormData.endereco, cep: e.target.value }
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Contatos de Emergência */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
                  <Users className="w-4 h-4 text-emerald-600" /> Contatos Familiares e de Emergência
                </h4>

                <div className="space-y-3">
                  {editFormData.contatosFamiliares.map((contact) => (
                    <div
                      key={contact.id}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{contact.nome}</span>
                          <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-semibold">
                            {contact.parentesco}
                          </span>
                        </div>
                        <p className="text-slate-500 mt-0.5">{contact.telefone}</p>
                        {contact.observacao && (
                          <p className="text-[11px] text-slate-400 italic">{contact.observacao}</p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveEmergencyContact(contact.id)}
                        className="text-rose-500 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Remover contato"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  {/* Adicionar Novo Contato de Emergência */}
                  <div className="p-4 bg-emerald-50/50 border border-emerald-200/70 rounded-xl space-y-3 text-xs">
                    <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5 text-emerald-600" /> Adicionar Parente ou Contato de Emergência
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        placeholder="Nome do parente"
                        value={newContactNome}
                        onChange={(e) => setNewContactNome(e.target.value)}
                        className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg"
                      />
                      <input
                        type="text"
                        placeholder="Parentesco (ex: Esposa, Mãe)"
                        value={newContactParentesco}
                        onChange={(e) => setNewContactParentesco(e.target.value)}
                        className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg"
                      />
                      <input
                        type="text"
                        placeholder="Telefone com DDD"
                        value={newContactTelefone}
                        onChange={(e) => setNewContactTelefone(e.target.value)}
                        className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Observação médica / aviso (opcional)"
                        value={newContactObs}
                        onChange={(e) => setNewContactObs(e.target.value)}
                        className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={handleAddEmergencyContact}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors cursor-pointer"
                      >
                        Adicionar
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Botão de Salvar Alterações */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditFormData(employee);
                    setIsEditingProfile(false);
                  }}
                  className="px-4 py-2.5 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  Salvar Alterações
                </button>
              </div>
            </form>
          ) : (
            /* Modo Visualização Normal com Meus Dados */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Personal Info */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-600" /> Dados Contratuais & Pessoais
                  </h3>
                  <button
                    onClick={() => setIsEditingProfile(true)}
                    className="text-blue-600 hover:text-blue-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Editar
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block">Nome Completo</span>
                    <span className="font-bold text-slate-900">{employee.nome}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Matrícula / Código</span>
                    <span className="font-bold font-mono text-slate-900">{employee.codigo}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Cargo / Função</span>
                    <span className="font-bold text-slate-900">{employee.cargo}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Departamento</span>
                    <span className="font-bold text-slate-900">{employee.departamento}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Data de Admissão</span>
                    <span className="font-bold text-slate-900">{employee.dataAdmissao}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Salário Base</span>
                    <span className="font-bold text-slate-900">R$ {formatBRL(employee.salarioBase)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">CPF</span>
                    <span className="font-bold text-slate-900">{employee.cpf || 'Não informado'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">PIS / PASEP</span>
                    <span className="font-bold text-slate-900">{employee.pisPasep || 'Não informado'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">E-mail Cadastrado</span>
                    <span className="font-bold text-slate-900 truncate">{employee.email}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Telefone WhatsApp</span>
                    <span className="font-bold text-slate-900">{employee.telefone}</span>
                  </div>
                </div>

                {/* Dados Bancários */}
                <div className="border-t border-slate-200 pt-4">
                  <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1.5 mb-2">
                    <Wallet className="w-3.5 h-3.5 text-emerald-600" /> Dados Bancários & PIX
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase">Banco / Agência / Conta</span>
                      <span className="font-semibold text-slate-800">
                        {employee.dadosBancarios.banco} • Ag: {employee.dadosBancarios.agencia} • CC: {employee.dadosBancarios.conta}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase">Chave Pix</span>
                      <span className="font-semibold text-emerald-800 font-mono">
                        {employee.dadosBancarios.chavePix || 'Não informada'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Family & Emergency Contacts */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-600" /> Contatos de Familiares & Emergência
                  </h3>
                  <button
                    onClick={() => setIsEditingProfile(true)}
                    className="text-blue-600 hover:text-blue-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Editar
                  </button>
                </div>

                {employee.contatosFamiliares.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-4">
                    Nenhum familiar cadastrado. Clique em "Editar Meus Dados" para cadastrar contatos para casos de emergência.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {employee.contatosFamiliares.map((contact, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-bold text-slate-900">{contact.nome}</span>
                            <span className="ml-2 text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-semibold">
                              {contact.parentesco}
                            </span>
                          </div>
                          <a
                            href={`tel:${contact.telefone.replace(/\D/g, '')}`}
                            className="text-emerald-700 font-bold hover:underline flex items-center gap-1"
                          >
                            <PhoneCall className="w-3 h-3" /> {contact.telefone}
                          </a>
                        </div>
                        {contact.observacao && (
                          <p className="text-[11px] text-slate-500 mt-1 italic">{contact.observacao}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Address */}
                <div className="border-t border-slate-200 pt-4">
                  <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1.5 mb-2">
                    <MapPin className="w-3.5 h-3.5 text-blue-600" /> Endereço Residencial
                  </h4>
                  <p className="text-xs text-slate-600">
                    {employee.endereco.logradouro}, {employee.endereco.numero}{' '}
                    {employee.endereco.complemento ? `- ${employee.endereco.complemento}` : ''}
                    <br />
                    {employee.endereco.bairro} • {employee.endereco.cidade} - {employee.endereco.uf} • CEP: {employee.endereco.cep}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Atestados Médicos */}
      {activeTab === 'ATESTADOS' && (
        <div className="space-y-6">
          {/* Top Info & Action Card */}
          <div className="bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-300 bg-blue-500/20 px-2.5 py-0.5 rounded-full border border-blue-400/30 inline-block mb-2">
                Arquivamento Eletrônico • CLT Art. 473
              </span>
              <h3 className="text-xl font-black text-white">Meus Atestados Médicos</h3>
              <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
                Envie aqui a foto ou PDF legível do seu atestado médico ou odontológico. O documento será arquivado no banco de dados e homologado pela equipe do Departamento Pessoal (DP) para abono de ausência.
              </p>
            </div>

            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
            >
              <Upload className="w-4 h-4" />
              Enviar Novo Atestado
            </button>
          </div>

          {/* List of Certificates */}
          {myCertificates.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-slate-300 shadow-sm">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 mb-4 border border-blue-100 shadow-sm">
                <Stethoscope className="w-8 h-8" />
              </div>
              <h4 className="text-base font-bold text-slate-800">Nenhum atestado médico enviado</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1.5 leading-relaxed">
                Você ainda não possui atestados médicos ou declarações cadastradas. Quando precisar justificar ausências por motivo de saúde ou consultas médicas, envie o documento pelo botão acima.
              </p>
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="mt-5 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Enviar Primeiro Atestado
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myCertificates.map((cert) => {
                const isApproved = cert.status === 'APROVADO';
                const isRejected = cert.status === 'REJEITADO';
                const isPending = cert.status === 'PENDENTE';

                return (
                  <div
                    key={cert.id}
                    className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Row: Type and Status */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {cert.protocolo}
                        </span>

                        {isApproved && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Homologado / Abonado
                          </span>
                        )}
                        {isPending && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300">
                            <Clock className="w-3 h-3 text-amber-600" />
                            Em Análise pelo RH
                          </span>
                        )}
                        {isRejected && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-800 bg-rose-100 px-2.5 py-0.5 rounded-full border border-rose-300">
                            <XCircle className="w-3 h-3 text-rose-600" />
                            Rejeitado / Pendente
                          </span>
                        )}
                        {cert.status === 'ARQUIVADO' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-800 bg-blue-100 px-2.5 py-0.5 rounded-full border border-blue-300">
                            <Archive className="w-3 h-3 text-blue-600" />
                            Arquivado no DP
                          </span>
                        )}
                      </div>

                      {/* Main Info */}
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center gap-2">
                          <Stethoscope className="w-4 h-4 text-blue-600 shrink-0" />
                          <span className="font-bold text-slate-800">
                            {cert.tipoAtestado === 'MEDICO' && 'Atestado Médico (Doença)'}
                            {cert.tipoAtestado === 'ODONTOLOGICO' && 'Atestado Odontológico'}
                            {cert.tipoAtestado === 'COMPARECIMENTO' && 'Declaração de Comparecimento'}
                            {cert.tipoAtestado === 'ACOMPANHAMENTO' && 'Acompanhamento Familiar'}
                            {cert.tipoAtestado === 'DECLARACAO_HORAS' && 'Declaração de Horas'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase block">Afastamento</span>
                            <span className="font-bold text-blue-900">
                              {cert.diasAfastamento} {cert.diasAfastamento === 1 ? 'dia' : 'dias'}
                            </span>
                            <span className="text-[10px] text-slate-500 block">
                              Início: {cert.dataInicioAfastamento ? cert.dataInicioAfastamento.split('-').reverse().join('/') : '-'}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] text-slate-500 uppercase block">Retorno Previsto</span>
                            <span className="font-bold text-emerald-700">
                              {cert.dataRetorno || '-'}
                            </span>
                            <span className="text-[10px] text-slate-500 block">
                              Emissão: {cert.dataEmissaoAtestado ? cert.dataEmissaoAtestado.split('-').reverse().join('/') : '-'}
                            </span>
                          </div>
                        </div>

                        {cert.cid && (
                          <div className="text-[11px] text-slate-600 flex items-center gap-1.5">
                            <span className="text-slate-500">CID-10:</span>
                            <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200">
                              {cert.cid}
                            </span>
                          </div>
                        )}

                        {cert.nomeMedico && (
                          <p className="text-[11px] text-slate-600 truncate">
                            <strong>Médico:</strong> {cert.nomeMedico} {cert.crmMedico ? `(${cert.crmMedico})` : ''}
                          </p>
                        )}

                        {cert.parecerRH && (
                          <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl text-[11px]">
                            <span className="font-bold text-emerald-900 block flex items-center gap-1">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Parecer do DP:
                            </span>
                            <span className="text-emerald-800">{cert.parecerRH}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-[10px] text-slate-400">
                        Enviado em {new Date(cert.criadoEm).toLocaleDateString('pt-BR')}
                      </span>

                      <button
                        onClick={() => setViewingCertificate(cert)}
                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Ver Atestado & Anexo
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: Comprovante de Rendimentos (IRPF) */}
      {activeTab === 'RENDIMENTOS' && (
        <div className="space-y-6">
          {/* Top Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 bg-indigo-500/20 px-2.5 py-0.5 rounded-full border border-indigo-400/30 inline-block mb-2">
                Receita Federal do Brasil • Declaração de IRPF
              </span>
              <h3 className="text-xl font-black text-white">Comprovante de Rendimentos Pagos e IRRF</h3>
              <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
                Documento oficial comprobatório de rendimentos tributáveis, contribuições previdenciárias e imposto retido na fonte para preenchimento da Declaração de Ajuste Anual do Imposto de Renda.
              </p>
            </div>
            <div className="text-left md:text-right">
              <span className="text-[10px] text-slate-400 block uppercase font-semibold">Fonte Pagadora</span>
              <span className="text-xs font-bold text-white block">FRANCISCO JOSE BARBOSA NOBRE</span>
              <span className="text-[11px] font-mono text-slate-300">CNPJ/CPF: 461.946.067-20</span>
            </div>
          </div>

          {/* List of Income Reports */}
          {myIncomeReports.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-slate-300 shadow-sm space-y-3">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100 shadow-sm">
                <FileText className="w-8 h-8" />
              </div>
              <h4 className="text-base font-bold text-slate-800">Nenhum comprovante de rendimentos publicado</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                O comprovante de rendimentos referente ao ano-calendário anterior é disponibilizado anualmente pelo Departamento Pessoal do Cartório. Assim que importado pelo RH, você poderá visualizá-lo e baixar o PDF oficial aqui.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {myIncomeReports.map((rep) => (
                <div
                  key={rep.id}
                  className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow space-y-5"
                >
                  {/* Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-slate-900 text-base">
                            Ano-Calendário {rep.anoCalendario}
                          </h4>
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded-full">
                            Exercício {rep.exercicio}
                          </span>
                          {rep.arquivoPdfOriginal && (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                              PDF Original
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">
                          Beneficiário: <strong className="text-slate-800">{rep.beneficiario.nomeCompleto}</strong> • CPF: {rep.beneficiario.cpf}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (onViewIncomeReport) {
                            onViewIncomeReport(rep);
                          }
                        }}
                        className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                        Visualizar Declaração
                      </button>
                      <button
                        onClick={() => {
                          if (rep.arquivoPdfOriginal?.base64) {
                            const link = document.createElement('a');
                            link.href = rep.arquivoPdfOriginal.base64;
                            link.download = rep.arquivoPdfOriginal.nomeArquivo || `Informe_Rendimentos_${rep.beneficiario.nomeCompleto.replace(/\s+/g, '_')}_${rep.anoCalendario}.pdf`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          } else {
                            const doc = generateIncomeReportPdf(rep);
                            doc.save(`Informe_Rendimentos_${rep.beneficiario.nomeCompleto.replace(/\s+/g, '_')}_${rep.anoCalendario}.pdf`);
                          }
                        }}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                        {rep.arquivoPdfOriginal ? 'Baixar PDF Original' : 'Baixar PDF Oficial'}
                      </button>
                    </div>
                  </div>

                  {/* Financial Fields Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                        1. Rendimentos Tributáveis
                      </span>
                      <span className="text-base font-black text-slate-900 block font-mono">
                        R$ {formatCurrencyBRL(rep.rendimentosTributaveis.totalRendimentos)}
                      </span>
                      <span className="text-[10px] text-slate-400">Inclusive férias</span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                        2. Previdência Oficial
                      </span>
                      <span className="text-base font-black text-slate-800 block font-mono">
                        R$ {formatCurrencyBRL(rep.rendimentosTributaveis.contribuicaoPrevidenciaria)}
                      </span>
                      <span className="text-[10px] text-slate-400">Dedução INSS</span>
                    </div>

                    <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
                      <span className="text-[10px] uppercase font-bold text-blue-700 block mb-1">
                        5. Imposto Retido (IRRF)
                      </span>
                      <span className="text-base font-black text-blue-900 block font-mono">
                        R$ {formatCurrencyBRL(rep.rendimentosTributaveis.impostoRetidoFonte)}
                      </span>
                      <span className="text-[10px] text-blue-600">Retenção na fonte</span>
                    </div>

                    <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100">
                      <span className="text-[10px] uppercase font-bold text-indigo-700 block mb-1">
                        13º Salário Líquido
                      </span>
                      <span className="text-base font-black text-indigo-950 block font-mono">
                        R$ {formatCurrencyBRL(rep.tributacaoExclusiva.decimoTerceiroSalario)}
                      </span>
                      <span className="text-[10px] text-indigo-600">
                        IRRF 13º: R$ {formatCurrencyBRL(rep.tributacaoExclusiva.irrfDecimoTerceiro)}
                      </span>
                    </div>
                  </div>

                  {/* Official Notice */}
                  <div className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-xl flex items-center justify-between border border-slate-100">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      Documento emitido conforme Instrução Normativa RFB nº 2.060/2021
                    </span>
                    <span className="font-semibold text-slate-700">
                      Responsável: {rep.responsavel.nome} ({rep.responsavel.data})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Upload Medical Certificate Modal */}
      {isUploadModalOpen && (
        <MedicalCertificateUploadModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          employee={employee}
          onSubmit={async (newCert) => {
            if (onUploadMedicalCertificate) {
              await onUploadMedicalCertificate(newCert);
            }
          }}
        />
      )}

      {/* View Medical Certificate Modal */}
      {viewingCertificate && (
        <MedicalCertificateViewModal
          isOpen={!!viewingCertificate}
          onClose={() => setViewingCertificate(null)}
          certificate={viewingCertificate}
          isManager={false}
        />
      )}

      {/* Mandatory First-Access Registration & Password Reset Modal */}
      {mustCompleteRegistration && currentUser && (
        <MandatoryRegistrationModal
          isOpen={true}
          employee={employee}
          currentUser={currentUser}
          onComplete={handleCompleteRegistration}
          onLogout={onLogout || (() => {})}
        />
      )}

      {/* Mobile Bottom Navigation Bar (Fácil Utilização em Smartphones) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 flex justify-around items-center shadow-2xl print:hidden">
        <button
          type="button"
          onClick={() => {
            setActiveTab('HOLERITE');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer min-w-[54px] ${
            activeTab === 'HOLERITE'
              ? 'text-blue-600 font-bold bg-blue-50/80'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <FileCheck className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Holerite</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('HISTORICO');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer min-w-[54px] ${
            activeTab === 'HISTORICO'
              ? 'text-blue-600 font-bold bg-blue-50/80'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <TrendingUp className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Histórico</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('ATESTADOS');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer min-w-[54px] relative ${
            activeTab === 'ATESTADOS'
              ? 'text-blue-600 font-bold bg-blue-50/80'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Stethoscope className="w-5 h-5" />
          {myCertificates.length > 0 && (
            <span className="absolute top-1 right-2 w-2 h-2 bg-blue-600 rounded-full" />
          )}
          <span className="text-[10px] mt-0.5">Atestados</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('RENDIMENTOS');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer min-w-[54px] relative ${
            activeTab === 'RENDIMENTOS'
              ? 'text-blue-600 font-bold bg-blue-50/80'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <FileText className="w-5 h-5" />
          {myIncomeReports.length > 0 && (
            <span className="absolute top-1 right-2 w-2 h-2 bg-indigo-600 rounded-full" />
          )}
          <span className="text-[10px] mt-0.5">IRPF</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('MEUS_DADOS');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer min-w-[54px] ${
            activeTab === 'MEUS_DADOS'
              ? 'text-blue-600 font-bold bg-blue-50/80'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <User className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Meus Dados</span>
        </button>
      </nav>
    </div>
  );
};
