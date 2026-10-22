import React, { useState } from 'react';
import { Employee, PayReceipt, SystemConfig, MedicalCertificate, IncomeReport } from '../types';
import { formatBRL, downloadPayReceiptPDF, generateSignedPayReceiptBase64, generatePayReceiptPDF } from '../utils/pdfGenerator';
import { openWhatsAppDirect, openWhatsAppReminderDirect } from '../utils/notifications';
import { dispatchWhatsAppSmart } from '../services/whatsappService';
import {
  Users,
  FileText,
  DollarSign,
  TrendingUp,
  Search,
  Plus,
  Edit,
  Share2,
  Mail,
  Download,
  ShieldCheck,
  Clock,
  Sparkles,
  PhoneCall,
  Send,
  RefreshCw,
  CheckCircle,
  Filter,
  CheckSquare,
  Settings,
  KeyRound,
  Award,
  Stethoscope,
  BellRing,
  Lock,
  AlertCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface AdminPortalProps {
  employees: Employee[];
  receipts: PayReceipt[];
  systemConfig?: SystemConfig;
  medicalCertificates?: MedicalCertificate[];
  incomeReports?: IncomeReport[];
  onOpenProcessorModal: () => void;
  onOpenEditModal: (employee: Employee) => void;
  onOpenEmailModal: (employee: Employee, receipt: PayReceipt) => void;
  onViewReceipt: (employee: Employee, receipt: PayReceipt) => void;
  onBatchWhatsApp: (selectedMonth: string) => void;
  onBatchEmail: (selectedMonth: string) => void;
  onBatchWhatsAppReminder?: (selectedMonth: string) => void;
  onBatchEmailReminder?: (selectedMonth: string) => void;
  onOpenSettingsModal: (tab?: 'CERTIFICADO_A1' | 'EMPRESA' | 'EMAIL_SERVER' | 'ASSINATURA' | 'COMUNICACAO' | 'DADOS') => void;
  onOpenUserManagement?: () => void;
  onOpenMedicalCertificates?: () => void;
  onOpenIncomeReports?: () => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  employees,
  receipts,
  systemConfig,
  medicalCertificates = [],
  incomeReports = [],
  onOpenProcessorModal,
  onOpenEditModal,
  onOpenEmailModal,
  onViewReceipt,
  onBatchWhatsApp,
  onBatchEmail,
  onBatchWhatsAppReminder,
  onBatchEmailReminder,
  onOpenSettingsModal,
  onOpenUserManagement,
  onOpenMedicalCertificates,
  onOpenIncomeReports
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('TODOS');
  const [selectedMonth, setSelectedMonth] = useState('Setembro de 2026');
  const [signatureFilter, setSignatureFilter] = useState<'ALL' | 'PENDING' | 'SIGNED'>('ALL');

  // Filtered receipts for selected month
  const monthReceipts = receipts.filter(r => r.mesAno === selectedMonth);

  // Totals for the selected month
  const totalGross = monthReceipts.reduce((acc, r) => acc + r.totalVencimentos, 0);
  const totalNet = monthReceipts.reduce((acc, r) => acc + r.valorLiquido, 0);
  const totalFGTS = monthReceipts.reduce((acc, r) => acc + r.fgtsDoMes, 0);
  const signedCount = monthReceipts.filter(r => r.statusAssinatura === 'ASSINADO').length;
  const pendingCount = monthReceipts.length - signedCount;
  const signedPercent = monthReceipts.length > 0 ? Math.round((signedCount / monthReceipts.length) * 100) : 0;
  const pendingMedicalCount = medicalCertificates.filter(c => c.status === 'PENDENTE').length;

  // Filtered employees
  const filteredEmployees = employees.filter(emp => {
    const matchesSearch =
      emp.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.codigo.includes(searchTerm) ||
      (emp.cpf && emp.cpf.includes(searchTerm)) ||
      emp.cargo.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesDept = selectedDepartment === 'TODOS' || emp.departamento === selectedDepartment;

    const receipt = receipts.find(r => r.employeeCodigo === emp.codigo && r.mesAno === selectedMonth);
    const matchesSignature =
      signatureFilter === 'ALL' ||
      (signatureFilter === 'PENDING' && receipt && receipt.statusAssinatura !== 'ASSINADO') ||
      (signatureFilter === 'SIGNED' && receipt && receipt.statusAssinatura === 'ASSINADO');

    return matchesSearch && matchesDept && matchesSignature;
  });

  const departments = Array.from(new Set(employees.map(e => e.departamento || 'CARTÓRIO GERAL')));

  const [sendingWhatsappCodigo, setSendingWhatsappCodigo] = useState<string | null>(null);

  const handleSendWhatsApp = async (emp: Employee, receipt: PayReceipt) => {
    if (!systemConfig) {
      openWhatsAppDirect(emp, receipt);
      return;
    }

    setSendingWhatsappCodigo(emp.codigo);
    try {
      let pdfBase64: string | undefined;
      // CLT Art. 464: Bloqueia envio de anexo se não assinado
      if (receipt.statusAssinatura === 'ASSINADO' && systemConfig.enviarPdfAutomaticoWhatsapp !== false) {
        try {
          pdfBase64 = await generateSignedPayReceiptBase64(emp, receipt, systemConfig?.certificadoA1);
        } catch {
          try {
            const doc = generatePayReceiptPDF(emp, receipt, systemConfig?.certificadoA1);
            pdfBase64 = doc.output('datauristring');
          } catch {}
        }
      }

      await dispatchWhatsAppSmart(systemConfig, emp, receipt, {
        pdfBase64,
        openFallbackWindow: true
      });
    } finally {
      setSendingWhatsappCodigo(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Actions */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6 border border-slate-800">
        <div>
          <span className="text-xs uppercase tracking-wider text-blue-400 font-bold bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20 inline-block mb-2">
            Painel Administrativo • DP & Recursos Humanos
          </span>
          <h2 className="text-2xl font-black tracking-tight text-white">
            Gestão de Folha & Colaboradores
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Empresa: <strong className="text-slate-200">{systemConfig?.razaoSocial || 'FRANCISCO JOSE BARBOSA NOBRE'}</strong> • CEI: {systemConfig?.cei || '800136945806'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
          <button
            onClick={onOpenProcessorModal}
            className="px-3 sm:px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center sm:justify-start gap-1.5 cursor-pointer min-h-[40px]"
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>Processar PDF</span>
          </button>

          <button
            onClick={() => onBatchWhatsApp(selectedMonth)}
            className="px-3 sm:px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center sm:justify-start gap-1.5 cursor-pointer min-h-[40px]"
            title="Enviar holerite via WhatsApp para todos os colaboradores do mês"
          >
            <Share2 className="w-4 h-4 shrink-0" />
            <span>WhatsApp ({monthReceipts.length})</span>
          </button>

          {/* Lembretes de Assinatura Pendente em Lote */}
          {pendingCount > 0 && onBatchWhatsAppReminder && (
            <button
              onClick={() => onBatchWhatsAppReminder(selectedMonth)}
              className="px-3 sm:px-3.5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center sm:justify-start gap-1.5 cursor-pointer animate-in fade-in min-h-[40px]"
              title="Disparar lembrete de assinatura pendente via WhatsApp em lote (download bloqueado até assinatura)"
            >
              <BellRing className="w-4 h-4 text-amber-200 shrink-0" />
              <span>Cobrar WA ({pendingCount})</span>
            </button>
          )}

          {pendingCount > 0 && onBatchEmailReminder && (
            <button
              onClick={() => onBatchEmailReminder(selectedMonth)}
              className="px-3 sm:px-3.5 py-2.5 bg-amber-700/90 hover:bg-amber-800 text-amber-100 border border-amber-600 font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center sm:justify-start gap-1.5 cursor-pointer animate-in fade-in min-h-[40px]"
              title="Disparar lembrete de assinatura pendente por E-mail em lote"
            >
              <Mail className="w-4 h-4 text-amber-300 shrink-0" />
              <span>Cobrar E-mail ({pendingCount})</span>
            </button>
          )}

          <button
            onClick={() => onOpenSettingsModal('CERTIFICADO_A1')}
            className="px-3 sm:px-3.5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center sm:justify-start gap-1.5 cursor-pointer min-h-[40px]"
            title="Cadastrar e gerenciar Certificado Digital A1 (.pfx) para assinatura de holerites"
          >
            <Award className="w-4 h-4 text-amber-200 shrink-0" />
            <span>Certificado A1</span>
          </button>

          <button
            onClick={() => onOpenSettingsModal('EMAIL_SERVER')}
            className="px-3 sm:px-3.5 py-2.5 bg-blue-900/60 hover:bg-blue-800 text-blue-100 border border-blue-700/60 font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center sm:justify-start gap-1.5 cursor-pointer min-h-[40px]"
            title="Configurar servidor de e-mail, SMTP e remetente"
          >
            <Mail className="w-4 h-4 text-blue-400 shrink-0" />
            <span>E-mail (SMTP)</span>
          </button>

          {onOpenUserManagement && (
            <button
              onClick={onOpenUserManagement}
              className="px-3 sm:px-3.5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center sm:justify-start gap-1.5 cursor-pointer min-h-[40px]"
              title="Gerenciar usuários, definir papéis (Gestor/Colaborador) e alterar senhas"
            >
              <KeyRound className="w-4 h-4 text-amber-100 shrink-0" />
              <span>Usuários & Senhas</span>
            </button>
          )}

          {onOpenMedicalCertificates && (
            <button
              onClick={onOpenMedicalCertificates}
              className="relative px-3 sm:px-3.5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center sm:justify-start gap-1.5 cursor-pointer min-h-[40px]"
              title="Gerenciar e analisar atestados médicos enviados pelos colaboradores"
            >
              <Stethoscope className="w-4 h-4 text-rose-200 shrink-0" />
              <span>Atestados</span>
              {pendingMedicalCount > 0 ? (
                <span className="px-1.5 py-0.5 bg-white text-rose-700 font-black text-[10px] rounded-full shadow-sm animate-pulse">
                  {pendingMedicalCount}
                </span>
              ) : (
                <span className="px-1.5 py-0.5 bg-rose-800/80 text-rose-200 text-[10px] rounded-full">
                  {medicalCertificates.length}
                </span>
              )}
            </button>
          )}

          {onOpenIncomeReports && (
            <button
              onClick={onOpenIncomeReports}
              className="px-3 sm:px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center sm:justify-start gap-1.5 cursor-pointer min-h-[40px]"
              title="Gerenciar e disponibilizar Comprovantes de Rendimentos Pagos e IRRF (Receita Federal)"
            >
              <FileText className="w-4 h-4 text-indigo-200 shrink-0" />
              <span>Comprovantes IRPF</span>
              {incomeReports && incomeReports.length > 0 && (
                <span className="px-1.5 py-0.5 bg-white text-indigo-800 font-black text-[10px] rounded-full shadow-sm">
                  {incomeReports.length}
                </span>
              )}
            </button>
          )}

          <button
            onClick={() => onOpenSettingsModal('EMPRESA')}
            className="px-3 sm:px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl border border-slate-700 shadow-sm transition-all flex items-center justify-center sm:justify-start gap-1.5 cursor-pointer min-h-[40px]"
            title="Abrir configurações da empresa, 2FA e modelos de envio"
          >
            <Settings className="w-4 h-4 text-blue-400 shrink-0" />
            <span>Configurações</span>
          </button>
        </div>
      </div>

      {/* Pending Medical Certificates Alert Banner */}
      {pendingMedicalCount > 0 && onOpenMedicalCertificates && (
        <div className="bg-gradient-to-r from-rose-50 to-amber-50 border border-rose-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-slate-800 text-xs sm:text-sm">
                {pendingMedicalCount} {pendingMedicalCount === 1 ? 'atestado médico aguardando análise' : 'atestados médicos aguardando análise'} do RH
              </h4>
              <p className="text-[11px] text-slate-600">
                Colaboradores enviaram novos atestados com anexos arquivados com segurança no banco de dados.
              </p>
            </div>
          </div>
          <button
            onClick={onOpenMedicalCertificates}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
          >
            Analisar Atestados
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Net Payroll */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Total Folha Líquida
            </span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">
            R$ {formatBRL(totalNet)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Competência: <strong className="text-slate-800">{selectedMonth}</strong>
          </p>
        </div>

        {/* Total Gross */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Total Bruto (Vencimentos)
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-800 mt-2">
            R$ {formatBRL(totalGross)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Depósito FGTS: R$ {formatBRL(totalFGTS)}
          </p>
        </div>

        {/* Active Employees */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Colaboradores Ativos
            </span>
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-700">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">
            {employees.length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {monthReceipts.length} recibos processados neste mês
          </p>
        </div>

        {/* Digital Signatures Progress */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Ciência / Assinaturas
              </span>
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-black text-slate-900">{signedCount}</span>
              <span className="text-xs text-slate-500 font-medium">de {monthReceipts.length} assinados</span>
              <span className="text-xs font-bold text-emerald-700 ml-auto">{signedPercent}%</span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${signedPercent}%` }}
              />
            </div>
          </div>

          {/* Quick Reminder Action inside KPI if there are unsigned receipts */}
          {pendingCount > 0 && (
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-1 text-[11px]">
              <span className="text-amber-700 font-bold flex items-center gap-1">
                <Lock className="w-3 h-3 text-amber-600" /> {pendingCount} pendentes
              </span>
              <div className="flex items-center gap-1">
                {onBatchWhatsAppReminder && (
                  <button
                    onClick={() => onBatchWhatsAppReminder(selectedMonth)}
                    className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded font-semibold text-[10px] cursor-pointer flex items-center gap-1 transition-colors"
                    title="Cobrar pendentes por WhatsApp"
                  >
                    <Share2 className="w-3 h-3" /> WhatsApp
                  </button>
                )}
                {onBatchEmailReminder && (
                  <button
                    onClick={() => onBatchEmailReminder(selectedMonth)}
                    className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded font-semibold text-[10px] cursor-pointer flex items-center gap-1 transition-colors"
                    title="Cobrar pendentes por E-mail"
                  >
                    <Mail className="w-3 h-3" /> E-mail
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Employee & Paystub Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Filter Bar */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome, código, CPF ou cargo..."
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Signature Filter Switcher */}
            <div className="inline-flex rounded-xl border border-slate-300 bg-white p-0.5 shadow-xs">
              <button
                type="button"
                onClick={() => setSignatureFilter('ALL')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  signatureFilter === 'ALL'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Todos ({employees.length})
              </button>
              <button
                type="button"
                onClick={() => setSignatureFilter('PENDING')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg flex items-center gap-1 transition-all cursor-pointer ${
                  signatureFilter === 'PENDING'
                    ? 'bg-amber-600 text-white font-bold'
                    : 'text-amber-800 hover:bg-amber-50'
                }`}
              >
                <Lock className="w-3 h-3" />
                Pendentes ({pendingCount})
              </button>
              <button
                type="button"
                onClick={() => setSignatureFilter('SIGNED')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg flex items-center gap-1 transition-all cursor-pointer ${
                  signatureFilter === 'SIGNED'
                    ? 'bg-emerald-700 text-white font-bold'
                    : 'text-emerald-800 hover:bg-emerald-50'
                }`}
              >
                <ShieldCheck className="w-3 h-3" />
                Assinados ({signedCount})
              </button>
            </div>

            {/* Department Filter */}
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="TODOS">Todos os Departamentos</option>
                {departments.map((d, i) => (
                  <option key={i} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {/* Month Filter */}
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-blue-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="Setembro de 2026">Setembro de 2026</option>
              <option value="Agosto de 2026">Agosto de 2026</option>
              <option value="Julho de 2026">Julho de 2026</option>
            </select>
          </div>
        </div>

        {/* Mobile View: Cards dos Colaboradores (< md) */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredEmployees.map((emp) => {
            const receipt = receipts.find(
              r => r.employeeCodigo === emp.codigo && r.mesAno === selectedMonth
            );
            const isSigned = receipt?.statusAssinatura === 'ASSINADO';
            const familyCount = emp.contatosFamiliares?.length || 0;

            return (
              <div key={emp.codigo} className="p-4 space-y-3 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-xs font-bold text-slate-500">#{emp.codigo}</span>
                      <span className="font-bold text-slate-900 text-sm">{emp.nome}</span>
                      {emp.codigo === '6' && (
                        <span className="text-[9px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-semibold">
                          Você
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {emp.cargo} • {emp.departamento}
                    </p>
                  </div>
                  <div>
                    {receipt ? (
                      isSigned ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" /> Assinado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-300">
                          <Lock className="w-3 h-3 text-amber-600" /> Pendente
                        </span>
                      )
                    ) : (
                      <span className="text-slate-400 text-xs">-</span>
                    )}
                  </div>
                </div>

                {/* Values & Info strip */}
                <div className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Líquido ({selectedMonth.split(' ')[0]})</span>
                    <span className="font-bold font-mono text-slate-900">
                      {receipt ? `R$ ${formatBRL(receipt.valorLiquido)}` : 'Não gerado'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block">WhatsApp</span>
                    <span className="font-medium text-slate-700">{emp.telefone || 'Sem fone'}</span>
                  </div>
                </div>

                {/* Touch Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-slate-100">
                  <div className="flex items-center gap-1">
                    {receipt && !isSigned && (
                      <button
                        onClick={() => openWhatsAppReminderDirect(emp, receipt)}
                        className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer min-h-[36px]"
                        title="Cobrar Assinatura via WhatsApp"
                      >
                        <BellRing className="w-3.5 h-3.5 text-amber-600" /> Cobrar
                      </button>
                    )}
                    {receipt && (
                      <button
                        disabled={sendingWhatsappCodigo === emp.codigo}
                        onClick={() => handleSendWhatsApp(emp, receipt)}
                        className="p-2 text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center border border-slate-200"
                        title="Enviar via WhatsApp"
                      >
                        {sendingWhatsappCodigo === emp.codigo ? (
                          <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                        ) : (
                          <Share2 className="w-4 h-4" />
                        )}
                      </button>
                    )}
                    {receipt && (
                      <button
                        onClick={() => onOpenEmailModal(emp, receipt)}
                        className="p-2 text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center border border-slate-200"
                        title="Enviar E-mail"
                      >
                        <Mail className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onOpenEditModal(emp)}
                      className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center border border-slate-200"
                      title="Editar Cadastro"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    {receipt && (
                      <button
                        onClick={() => onViewReceipt(emp, receipt)}
                        className="px-2.5 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer min-h-[36px]"
                      >
                        <FileText className="w-3.5 h-3.5" /> Ver
                      </button>
                    )}
                    {receipt && (
                      <button
                        onClick={() => downloadPayReceiptPDF(emp, receipt, systemConfig?.certificadoA1)}
                        className="p-2 text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center border border-slate-200"
                        title="Baixar PDF"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop View: Full Table (md+) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/80 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Cód</th>
                <th className="py-3 px-4">Colaborador / Cargo</th>
                <th className="py-3 px-4">Departamento</th>
                <th className="py-3 px-4">Admissão</th>
                <th className="py-3 px-4">Telefone / Familiares</th>
                <th className="py-3 px-4 text-right">Líquido ({selectedMonth.split(' ')[0]})</th>
                <th className="py-3 px-4 text-center">Ciência</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEmployees.map((emp) => {
                const receipt = receipts.find(
                  r => r.employeeCodigo === emp.codigo && r.mesAno === selectedMonth
                );
                const isSigned = receipt?.statusAssinatura === 'ASSINADO';
                const familyCount = emp.contatosFamiliares?.length || 0;

                return (
                  <tr key={emp.codigo} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      #{emp.codigo}
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        {emp.nome}
                        {emp.codigo === '6' && (
                          <span className="text-[9px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-semibold">
                            Você
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>{emp.cargo}</span>
                        <span>•</span>
                        <span>CPF: {emp.cpf || 'Pendente'}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-slate-700 font-medium">
                      {emp.departamento}
                    </td>

                    <td className="py-3 px-4 text-slate-600">
                      {emp.dataAdmissao}
                    </td>

                    <td className="py-3 px-4">
                      <div className="text-slate-800 font-medium">{emp.telefone || '-'}</div>
                      <div className="text-[10.5px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Users className="w-3 h-3 text-emerald-600" />
                        {familyCount > 0 ? (
                          <span className="text-emerald-700 font-semibold">
                            {familyCount} familiar(es)
                          </span>
                        ) : (
                          <span className="text-amber-600 font-medium">Sem contato familiar</span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-950">
                      {receipt ? `R$ ${formatBRL(receipt.valorLiquido)}` : (
                        <span className="text-slate-400 font-normal">Não gerado</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center">
                      {receipt ? (
                        isSigned ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <ShieldCheck className="w-3 h-3" /> Assinado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-300">
                            <Lock className="w-3 h-3 text-amber-600" /> Pendente
                          </span>
                        )
                      ) : (
                        <span className="text-slate-400 text-[10px]">-</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Lembrete de Assinatura Rápido se Pendente */}
                        {receipt && !isSigned && (
                          <button
                            onClick={() => openWhatsAppReminderDirect(emp, receipt)}
                            className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                            title="Cobrar Assinatura via WhatsApp (Abre mensagem formal com link direto)"
                          >
                            <BellRing className="w-4 h-4" />
                          </button>
                        )}

                        {/* Edit Full Profile */}
                        <button
                          onClick={() => onOpenEditModal(emp)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Editar Cadastro Completo, Cargo, CPF e Familiares"
                        >
                          <Edit className="w-4 h-4" />
                        </button>

                        {/* Gerenciar Acesso & Senha */}
                        {onOpenUserManagement && (
                          <button
                            onClick={onOpenUserManagement}
                            className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                            title="Gerenciar Acesso: Cadastrar E-mail, Senha e Regras de Primeiro Acesso"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                        )}

                        {/* WhatsApp direct / Evolution API */}
                        {receipt && (
                          <button
                            disabled={sendingWhatsappCodigo === emp.codigo}
                            onClick={() => handleSendWhatsApp(emp, receipt)}
                            className="p-1.5 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                            title="Enviar Comprovante via WhatsApp (Evolution API / WhatsApp Web)"
                          >
                            {sendingWhatsappCodigo === emp.codigo ? (
                              <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                            ) : (
                              <Share2 className="w-4 h-4" />
                            )}
                          </button>
                        )}

                        {/* Email */}
                        {receipt && (
                          <button
                            onClick={() => onOpenEmailModal(emp, receipt)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="Disparar por E-mail"
                          >
                            <Mail className="w-4 h-4" />
                          </button>
                        )}

                        {/* View Paystub */}
                        {receipt && (
                          <button
                            onClick={() => onViewReceipt(emp, receipt)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Visualizar Holerite Oficial"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        )}

                        {/* Download PDF (Admin can always preview/download for HR archives) */}
                        {receipt && (
                          <button
                            onClick={() => downloadPayReceiptPDF(emp, receipt, systemConfig?.certificadoA1)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Baixar PDF Oficial para Arquivo do RH"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
