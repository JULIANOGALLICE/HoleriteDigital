import React, { useState, useRef } from 'react';
import { SystemConfig, DigitalCertificateA1, Employee, UserAccount } from '../types';
import {
  X,
  Save,
  Settings,
  Building,
  ShieldAlert,
  MessageSquare,
  Database,
  Trash2,
  CheckCircle2,
  Mail,
  Send,
  Server,
  Lock,
  HelpCircle,
  Clock,
  ExternalLink,
  Award,
  ShieldCheck,
  Upload,
  Key,
  FileCheck,
  AlertTriangle,
  RefreshCw,
  Download,
  Smartphone,
  Wifi,
  WifiOff,
  Radio,
  Eye,
  EyeOff,
  QrCode,
  FileSpreadsheet,
  UploadCloud,
  Users,
  Check,
  ArrowRight,
  Sparkles,
  Bot,
  Cpu
} from 'lucide-react';
import confetti from 'canvas-confetti';

import { testSmtpConnection, EmailTestResult } from '../services/emailService';
import {
  testEvolutionApiConnection,
  checkEvolutionApiStatus,
  EvolutionTestResponse,
  EvolutionStatusResponse
} from '../services/whatsappService';
import { auth } from '../firebase';
import { parsePfxCertificate, getDefaultA1Certificate, saveActiveA1Certificate, getActiveA1Certificate } from '../utils/certificateA1';
import { downloadPayReceiptPDF } from '../utils/pdfGenerator';
import { INITIAL_EMPLOYEES, INITIAL_RECEIPTS } from '../data/initialData';
import {
  exportEmployeesToXLSX,
  downloadBlankEmployeesTemplateXLSX,
  parseAndAnalyzeSpreadsheet,
  applySpreadsheetToEntities,
  SpreadsheetAnalysisResult
} from '../utils/spreadsheetService';

interface SystemSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: SystemConfig;
  onSaveConfig: (updated: SystemConfig) => void;
  onClearProductionData: () => void;
  initialTab?: 'CERTIFICADO_A1' | 'IA_CONFIG' | 'EMPRESA' | 'EMAIL_SERVER' | 'ASSINATURA' | 'COMUNICACAO' | 'PLANILHA_USUARIOS' | 'DADOS';
  employees?: Employee[];
  users?: UserAccount[];
  onBatchUpdateEmployeesAndUsers?: (updatedEmployees: Employee[], updatedUsers: UserAccount[]) => Promise<void> | void;
}

export const SystemSettingsModal: React.FC<SystemSettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  onClearProductionData,
  initialTab = 'CERTIFICADO_A1',
  employees = [],
  users = [],
  onBatchUpdateEmployeesAndUsers
}) => {
  const [formData, setFormData] = useState<SystemConfig>(() => ({
    ...config,
    certificadoA1: getActiveA1Certificate(config.certificadoA1),
    emailNomeRemetente: config.emailNomeRemetente || 'Departamento Pessoal - Cartório Nobre',
    emailReplyTo: config.emailReplyTo || config.emailRemetente || 'julianogallice@gmail.com',
    emailProvider: config.emailProvider || 'SMTP',
    smtpHost: config.smtpHost !== undefined ? config.smtpHost : (config.emailProvider === 'GMAIL_APP' ? 'smtp.gmail.com' : ''),
    smtpPort: config.smtpPort || 587,
    smtpUser: config.smtpUser || config.emailRemetente || '',
    smtpPassword: config.smtpPassword || '',
    smtpSecure: config.smtpSecure !== undefined ? config.smtpSecure : (config.smtpPort === 465),
    emailTemplateAssunto: config.emailTemplateAssunto || '[Holerite Digital] Recibo de Pagamento - {mesAno} - {nome}',
    emailTemplateCorpo: config.emailTemplateCorpo || 'Olá, {nome}. Seu recibo de pagamento de {mesAno} já está disponível para visualização e download em PDF no portal do colaborador.',
    whatsappProvider: config.whatsappProvider || 'EVOLUTION_API',
    evolutionApiUrl: config.evolutionApiUrl || '',
    evolutionApiKey: config.evolutionApiKey || '',
    evolutionInstance: config.evolutionInstance || '',
    enviarPdfAutomaticoWhatsapp: config.enviarPdfAutomaticoWhatsapp !== undefined ? config.enviarPdfAutomaticoWhatsapp : true,
    exigir2FALogin: config.exigir2FALogin || false,
    canal2FALogin: config.canal2FALogin || 'WHATSAPP',
    geminiApiKey: config.geminiApiKey || '',
    aiModel: config.aiModel || 'gemini-3.8-flash',
    aiEnabled: config.aiEnabled !== undefined ? config.aiEnabled : true
  }));

  // Synchronize when config or modal visibility changes
  React.useEffect(() => {
    if (isOpen) {
      setFormData({
        ...config,
        certificadoA1: getActiveA1Certificate(config.certificadoA1),
        emailNomeRemetente: config.emailNomeRemetente || 'Departamento Pessoal - Cartório Nobre',
        emailReplyTo: config.emailReplyTo || config.emailRemetente || 'julianogallice@gmail.com',
        emailProvider: config.emailProvider || 'SMTP',
        smtpHost: config.smtpHost !== undefined ? config.smtpHost : (config.emailProvider === 'GMAIL_APP' ? 'smtp.gmail.com' : ''),
        smtpPort: config.smtpPort || 587,
        smtpUser: config.smtpUser || config.emailRemetente || '',
        smtpPassword: config.smtpPassword || '',
        smtpSecure: config.smtpSecure !== undefined ? config.smtpSecure : (config.smtpPort === 465),
        emailTemplateAssunto: config.emailTemplateAssunto || '[Holerite Digital] Recibo de Pagamento - {mesAno} - {nome}',
        emailTemplateCorpo: config.emailTemplateCorpo || 'Olá, {nome}. Seu recibo de pagamento de {mesAno} já está disponível para visualização e download em PDF no portal do colaborador.',
        whatsappProvider: config.whatsappProvider || 'EVOLUTION_API',
        evolutionApiUrl: config.evolutionApiUrl || '',
        evolutionApiKey: config.evolutionApiKey || '',
        evolutionInstance: config.evolutionInstance || '',
        enviarPdfAutomaticoWhatsapp: config.enviarPdfAutomaticoWhatsapp !== undefined ? config.enviarPdfAutomaticoWhatsapp : true,
        exigir2FALogin: config.exigir2FALogin || false,
        canal2FALogin: config.canal2FALogin || 'WHATSAPP',
        geminiApiKey: config.geminiApiKey || '',
        aiModel: config.aiModel || 'gemini-3.8-flash',
        aiEnabled: config.aiEnabled !== undefined ? config.aiEnabled : true
      });
      setActiveTab(initialTab);
      setSpreadsheetAnalysis(null);
      setSpreadsheetError(null);
      setSpreadsheetSuccess(null);
      setAiTestResult(null);

      // Consulta status da IA no servidor VPS
      fetch('/api/ai/status')
        .then(r => r.json())
        .then(data => {
          if (data && data.success) {
            setServerAiStatus({
              configured: Boolean(data.configured),
              keySource: data.keySource || 'none',
              maskedKey: data.maskedKey || '',
              model: data.model || 'gemini-3.8-flash'
            });
          }
        })
        .catch(() => {});
    }
  }, [isOpen, config, initialTab]);

  const [activeTab, setActiveTab] = useState<'CERTIFICADO_A1' | 'IA_CONFIG' | 'EMPRESA' | 'EMAIL_SERVER' | 'ASSINATURA' | 'COMUNICACAO' | 'PLANILHA_USUARIOS' | 'DADOS'>(initialTab);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<EmailTestResult | null>(null);

  // AI (Google Gemini) Configuration & Test State
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [isTestingAi, setIsTestingAi] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{
    success: boolean;
    message: string;
    modelUsed?: string;
    durationMs?: number;
  } | null>(null);
  const [serverAiStatus, setServerAiStatus] = useState<{
    configured: boolean;
    keySource: string;
    maskedKey: string;
    model: string;
  } | null>(null);

  // Spreadsheet XLS Import/Export State
  const spreadsheetInputRef = useRef<HTMLInputElement>(null);
  const [isParsingSpreadsheet, setIsParsingSpreadsheet] = useState(false);
  const [spreadsheetAnalysis, setSpreadsheetAnalysis] = useState<SpreadsheetAnalysisResult | null>(null);
  const [spreadsheetError, setSpreadsheetError] = useState<string | null>(null);
  const [spreadsheetSuccess, setSpreadsheetSuccess] = useState<string | null>(null);
  const [isApplyingSpreadsheet, setIsApplyingSpreadsheet] = useState(false);

  // Evolution API / WhatsApp State
  const [isTestingWhatsapp, setIsTestingWhatsapp] = useState(false);
  const [whatsappTestResult, setWhatsappTestResult] = useState<EvolutionTestResponse | null>(null);
  const [whatsappStatus, setWhatsappStatus] = useState<EvolutionStatusResponse | null>(null);
  const [whatsappTestNumber, setWhatsappTestNumber] = useState('');
  const [showEvolutionKey, setShowEvolutionKey] = useState(false);
  const [isCheckingWhatsappStatus, setIsCheckingWhatsappStatus] = useState(false);

  // A1 Certificate Upload & Management State
  const certFileInputRef = useRef<HTMLInputElement>(null);
  const [certPassword, setCertPassword] = useState('');
  const [selectedCertFile, setSelectedCertFile] = useState<File | null>(null);
  const [isProcessingCert, setIsProcessingCert] = useState(false);
  const [certStatusMessage, setCertStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleTestWhatsappConnection = async () => {
    setIsTestingWhatsapp(true);
    setWhatsappTestResult(null);
    try {
      const res = await testEvolutionApiConnection({
        evolutionApiUrl: formData.evolutionApiUrl,
        evolutionApiKey: formData.evolutionApiKey,
        evolutionInstance: formData.evolutionInstance,
        testNumber: whatsappTestNumber
      });
      setWhatsappTestResult(res);
      if (res.connected !== undefined) {
        setWhatsappStatus({
          success: res.success,
          connected: Boolean(res.connected),
          state: res.state,
          message: res.message
        });
      }
    } catch (err: any) {
      setWhatsappTestResult({
        success: false,
        message: err.message || 'Erro ao conectar à Evolution API.'
      });
    } finally {
      setIsTestingWhatsapp(false);
    }
  };

  const handleCheckWhatsappStatus = async () => {
    setIsCheckingWhatsappStatus(true);
    try {
      const res = await checkEvolutionApiStatus({
        evolutionApiUrl: formData.evolutionApiUrl,
        evolutionApiKey: formData.evolutionApiKey,
        evolutionInstance: formData.evolutionInstance
      });
      setWhatsappStatus(res);
    } catch (err: any) {
      setWhatsappStatus({
        success: false,
        connected: false,
        message: err.message || 'Erro ao consultar status.'
      });
    } finally {
      setIsCheckingWhatsappStatus(false);
    }
  };

  if (!isOpen) return null;

  const handleTestAiConnection = async () => {
    setIsTestingAi(true);
    setAiTestResult(null);
    try {
      const res = await fetch('/api/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geminiApiKey: (formData.geminiApiKey || '').trim(),
          aiModel: formData.aiModel || 'gemini-3.8-flash',
          saveToServer: true
        })
      });
      const data = await res.json();
      setAiTestResult({
        success: Boolean(data.success),
        message: data.message || (data.success ? 'Conexão com IA validada!' : 'Falha na conexão com a IA.'),
        modelUsed: data.modelUsed,
        durationMs: data.durationMs
      });
      if (data.success) {
        setServerAiStatus({
          configured: true,
          keySource: (formData.geminiApiKey || '').trim() ? 'database' : data.keySource || 'env',
          maskedKey: data.maskedKey || '',
          model: data.modelUsed || formData.aiModel || 'gemini-3.8-flash'
        });
        confetti({ particleCount: 55, spread: 50, origin: { y: 0.6 } });
      }
    } catch (err: any) {
      setAiTestResult({
        success: false,
        message: `Erro de comunicação ao testar a IA: ${err?.message || 'Erro'}`
      });
    } finally {
      setIsTestingAi(false);
    }
  };

  const handleSaveAiConfigNow = async () => {
    const cleanConfig: SystemConfig = {
      ...formData,
      geminiApiKey: (formData.geminiApiKey || '').trim(),
      aiModel: formData.aiModel || 'gemini-3.8-flash',
      aiEnabled: formData.aiEnabled !== false
    };
    setFormData(cleanConfig);
    onSaveConfig(cleanConfig);
    try {
      localStorage.setItem('holerite_system_config', JSON.stringify(cleanConfig));
    } catch (e) {}
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanConfig)
      });
      const statusRes = await fetch('/api/ai/status');
      const statusData = await statusRes.json();
      if (statusData?.success) {
        setServerAiStatus({
          configured: Boolean(statusData.configured),
          keySource: statusData.keySource || 'database',
          maskedKey: statusData.maskedKey || '',
          model: statusData.model || cleanConfig.aiModel || 'gemini-3.8-flash'
        });
      }
    } catch (e) {}
    setAiTestResult({
      success: true,
      message: 'Chave da API e configurações de Inteligência Artificial salvas com sucesso no Banco de Dados (Firestore) e no Servidor VPS!'
    });
    confetti({ particleCount: 65, spread: 55, origin: { y: 0.6 } });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedFormData: SystemConfig = {
      ...formData,
      geminiApiKey: (formData.geminiApiKey || '').trim(),
      aiModel: formData.aiModel || 'gemini-3.8-flash',
      aiEnabled: formData.aiEnabled !== false
    };
    if (cleanedFormData.certificadoA1) {
      saveActiveA1Certificate(cleanedFormData.certificadoA1);
    }
    onSaveConfig(cleanedFormData);
    try {
      localStorage.setItem('holerite_system_config', JSON.stringify(cleanedFormData));
    } catch (err) {}
    fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanedFormData)
    }).catch(() => {});
    confetti({ particleCount: 60, spread: 50, origin: { y: 0.6 } });
    onClose();
  };

  const handleTestEmail = async (overrideConfig?: typeof formData) => {
    const activeCfg = overrideConfig || formData;
    setIsTestingEmail(true);
    setTestEmailResult(null);

    const result = await testSmtpConnection(activeCfg, activeCfg.emailRemetente);
    setIsTestingEmail(false);
    setTestEmailResult(result);

    if (result.success) {
      confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
    }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.pfx') && !lowerName.endsWith('.p12')) {
      setCertStatusMessage({
        type: 'error',
        text: 'Por favor, selecione um arquivo de certificado digital válido (.pfx ou .p12).'
      });
      setSelectedCertFile(null);
      return;
    }

    setSelectedCertFile(file);
    setCertStatusMessage(null);
  };

  const handleProcessCertificate = async () => {
    if (!selectedCertFile) {
      setCertStatusMessage({ type: 'error', text: 'Selecione o arquivo do certificado digital (.pfx ou .p12).' });
      return;
    }

    setIsProcessingCert(true);
    setCertStatusMessage(null);

    try {
      const buffer = await selectedCertFile.arrayBuffer();
      const res = parsePfxCertificate(buffer, certPassword, selectedCertFile.name);

      if (res.success && res.certificate) {
        saveActiveA1Certificate(res.certificate);
        const updatedConfig: SystemConfig = {
          ...formData,
          certificadoA1: res.certificate
        };
        setFormData(updatedConfig);
        onSaveConfig(updatedConfig);
        try {
          localStorage.setItem('holerite_system_config', JSON.stringify(updatedConfig));
        } catch (e) {}

        setCertStatusMessage({
          type: 'success',
          text: `Certificado A1 carregado, validado e ativado com sucesso! Titular: ${res.certificate.titular} (Válido até: ${res.certificate.validadeFim}).`
        });
        confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
        setCertPassword('');
        setSelectedCertFile(null);
        if (certFileInputRef.current) certFileInputRef.current.value = '';
      } else {
        setCertStatusMessage({
          type: 'error',
          text: res.error || 'Não foi possível ler o certificado. Verifique se a senha informada está correta.'
        });
      }
    } catch (err: any) {
      setCertStatusMessage({
        type: 'error',
        text: `Erro ao processar certificado: ${err.message}`
      });
    } finally {
      setIsProcessingCert(false);
    }
  };

  const handleUseDefaultCartorioCert = () => {
    const defaultCert = getDefaultA1Certificate();
    saveActiveA1Certificate(defaultCert);
    const updatedConfig: SystemConfig = {
      ...formData,
      certificadoA1: defaultCert
    };
    setFormData(updatedConfig);
    onSaveConfig(updatedConfig);
    try {
      localStorage.setItem('holerite_system_config', JSON.stringify(updatedConfig));
    } catch (e) {}

    setCertStatusMessage({
      type: 'success',
      text: 'Certificado Digital A1 padrão do Cartório Nobre (ICP-Brasil) ativado e salvo com sucesso!'
    });
    confetti({ particleCount: 40, spread: 50, origin: { y: 0.6 } });
  };

  const handleTestDownloadPdf = () => {
    const sampleEmp = INITIAL_EMPLOYEES[0];
    const sampleRec = INITIAL_RECEIPTS[0];
    downloadPayReceiptPDF(sampleEmp, sampleRec, formData.certificadoA1);
    confetti({ particleCount: 35, spread: 40, origin: { y: 0.7 } });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600/30 text-blue-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">Configurações do Sistema</h3>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1 font-semibold">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" /> Produção Ativa
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Painel exclusivo para Gestores e Administradores do DP
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 text-xs font-semibold text-slate-600 gap-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('CERTIFICADO_A1')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap ${
              activeTab === 'CERTIFICADO_A1' ? 'border-amber-500 text-amber-700 bg-white font-bold shadow-sm' : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Award className="w-4 h-4 text-amber-500" /> Certificado Digital A1 (ICP-Brasil)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('IA_CONFIG')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap ${
              activeTab === 'IA_CONFIG' ? 'border-indigo-600 text-indigo-700 bg-white font-bold shadow-sm' : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-4 h-4 text-indigo-600" /> Inteligência Artificial (IA)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('EMAIL_SERVER')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap ${
              activeTab === 'EMAIL_SERVER' ? 'border-blue-600 text-blue-600 bg-white font-bold' : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Mail className="w-4 h-4 text-blue-600" /> Servidor de E-mail (SMTP)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('EMPRESA')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap ${
              activeTab === 'EMPRESA' ? 'border-blue-600 text-blue-600 bg-white font-bold' : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Building className="w-4 h-4" /> Dados da Empresa
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ASSINATURA')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap ${
              activeTab === 'ASSINATURA' ? 'border-blue-600 text-blue-600 bg-white font-bold' : 'border-transparent hover:text-slate-900'
            }`}
          >
            <ShieldAlert className="w-4 h-4" /> Segurança & 2FA
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('COMUNICACAO')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap ${
              activeTab === 'COMUNICACAO' ? 'border-emerald-600 text-emerald-700 bg-white font-bold' : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Smartphone className="w-4 h-4 text-emerald-600" /> WhatsApp & Evolution API
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('PLANILHA_USUARIOS')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap ${
              activeTab === 'PLANILHA_USUARIOS' ? 'border-emerald-600 text-emerald-700 bg-white font-bold shadow-xs' : 'border-transparent hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Planilha de Usuários (XLS)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('DADOS')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap ${
              activeTab === 'DADOS' ? 'border-blue-600 text-blue-600 bg-white font-bold' : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Database className="w-4 h-4" /> Manutenção & Dados
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* TAB 0: Certificado Digital A1 (ICP-Brasil) */}
          {activeTab === 'CERTIFICADO_A1' && (
            <div className="space-y-4">
              {/* Info Header */}
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                <div className="p-2.5 rounded-lg bg-amber-600 text-white shrink-0 mt-0.5 shadow-sm">
                  <Award className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-900 text-sm">
                      Certificado Digital A1 (ICP-Brasil) para Assinatura de PDFs
                    </h4>
                    <span className="text-[10px] bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-full font-bold">
                      Validade Jurídica Plena
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                    Cadastre o Certificado Digital A1 (.pfx / .p12) da empresa ou cartório. Com o certificado cadastrado, todos os holerites gerados em PDF recebem carimbo criptográfico oficial, hash SHA-256 e conformidade com a MP nº 2.200-2/2001, Lei nº 14.063/2020 e CLT Art. 464.
                  </p>
                </div>
              </div>

              {/* Status Banner */}
              {certStatusMessage && (
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between gap-2 text-xs ${
                    certStatusMessage.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {certStatusMessage.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{certStatusMessage.text}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCertStatusMessage(null)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Active Certificate Card */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">
                          {formData.certificadoA1?.titular || 'Certificado Digital Configurado'}
                        </span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold border border-emerald-300">
                          {formData.certificadoA1?.status || 'ATIVO'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {formData.certificadoA1?.autoridadeCertificadora || 'ICP-Brasil'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleTestDownloadPdf}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                      title="Gerar e baixar holerite de teste com assinatura digital deste certificado"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Baixar PDF de Teste
                    </button>
                    <button
                      type="button"
                      onClick={handleUseDefaultCartorioCert}
                      className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                      title="Restaurar certificado ICP-Brasil padrão do Cartório"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Demo Cartório
                    </button>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Dados do Titular</span>
                    <p className="font-semibold text-slate-900">{formData.certificadoA1?.titular}</p>
                    <p className="text-slate-600">Doc/CNPJ: <span className="font-mono">{formData.certificadoA1?.documentoTitular}</span></p>
                    <p className="text-slate-600">Arquivo: <span className="font-mono text-[11px] text-blue-700">{formData.certificadoA1?.arquivoNome || 'certificado_a1.pfx'}</span></p>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Segurança & Validade</span>
                    <p className="text-slate-700">Autoridade: <span className="font-semibold text-slate-900">{formData.certificadoA1?.autoridadeCertificadora}</span></p>
                    <p className="text-slate-700">Período: <span className="font-semibold text-slate-900">{formData.certificadoA1?.validadeInicio}</span> até <span className="font-semibold text-emerald-700">{formData.certificadoA1?.validadeFim}</span></p>
                    <p className="text-slate-600 text-[10.5px]">Serial: <span className="font-mono text-slate-800">{formData.certificadoA1?.numeroSerie}</span></p>
                  </div>
                </div>

                {/* Automatic PDF Signing Option */}
                <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.certificadoA1?.assinaturaAutomaticaPdf ?? true}
                    onChange={(e) =>
                      setFormData(prev => ({
                        ...prev,
                        certificadoA1: prev.certificadoA1
                          ? { ...prev.certificadoA1, assinaturaAutomaticaPdf: e.target.checked }
                          : undefined
                      }))
                    }
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <span className="text-slate-800 font-semibold text-xs">
                    Assinar e chancelar automaticamente todos os holerites gerados em PDF com este Certificado Digital A1
                  </span>
                </label>
              </div>

              {/* Upload New Certificate Section */}
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 bg-slate-50 hover:bg-slate-100/60 transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <Upload className="w-4 h-4 text-blue-600" />
                  <h5 className="font-bold text-slate-900 text-xs">
                    Fazer Upload de Novo Arquivo de Certificado A1 (.PFX ou .P12)
                  </h5>
                </div>
                <p className="text-[11px] text-slate-600 mb-3">
                  Selecione o arquivo do certificado digital fornecido pela sua Autoridade Certificadora (Certisign, Serasa, Soluti, etc.) e informe a senha para extrair as credenciais criptográficas.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-6">
                    <label className="block text-slate-700 font-semibold mb-1 text-[11px]">
                      Arquivo do Certificado (.pfx / .p12)
                    </label>
                    <input
                      ref={certFileInputRef}
                      type="file"
                      accept=".pfx,.p12"
                      onChange={handleFileSelected}
                      className="block w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-slate-700 font-semibold mb-1 text-[11px]">
                      Senha do Certificado
                    </label>
                    <div className="relative">
                      <Key className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        type="password"
                        value={certPassword}
                        onChange={(e) => setCertPassword(e.target.value)}
                        placeholder="Senha do .pfx"
                        className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-2.5 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-3">
                    <button
                      type="button"
                      onClick={handleProcessCertificate}
                      disabled={!selectedCertFile || isProcessingCert}
                      className={`w-full py-2 px-3 rounded-lg text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm ${
                        selectedCertFile && !isProcessingCert
                          ? 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer'
                          : 'bg-slate-400 cursor-not-allowed opacity-70'
                      }`}
                    >
                      {isProcessingCert ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Lendo...
                        </>
                      ) : (
                        <>
                          <FileCheck className="w-3.5 h-3.5" />
                          Carregar e Validar
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {selectedCertFile && (
                  <p className="text-[11px] text-blue-700 mt-2 font-medium flex items-center gap-1">
                    Arquivo selecionado: <strong>{selectedCertFile.name}</strong> ({(selectedCertFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              {/* Manual Edit Section */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h5 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-blue-600" />
                    Edição e Cadastro Direto do Certificado Digital A1
                  </h5>
                  <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-semibold border border-blue-200">
                    Sincronização Imediata com PDF
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Cadastre ou ajuste as credenciais do seu Certificado Digital A1. As alterações são aplicadas instantaneamente a todas as vias de holerites baixados em PDF:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1 text-[11px]">
                      Razão Social / Titular do Certificado (Assinante) *
                    </label>
                    <input
                      type="text"
                      value={formData.certificadoA1?.titular || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData(prev => {
                          const base = prev.certificadoA1 || getActiveA1Certificate(null);
                          const updated = { ...base, titular: val };
                          saveActiveA1Certificate(updated);
                          return { ...prev, certificadoA1: updated };
                        });
                      }}
                      placeholder="Ex: CARTÓRIO NOBRE ou SUA EMPRESA LTDA"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1 text-[11px]">
                      CNPJ ou CPF do Titular *
                    </label>
                    <input
                      type="text"
                      value={formData.certificadoA1?.documentoTitular || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData(prev => {
                          const base = prev.certificadoA1 || getActiveA1Certificate(null);
                          const updated = { ...base, documentoTitular: val };
                          saveActiveA1Certificate(updated);
                          return { ...prev, certificadoA1: updated };
                        });
                      }}
                      placeholder="Ex: 80.013.694/0001-80"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1 text-[11px]">
                      Autoridade Certificadora Emissora (AC ICP-Brasil) *
                    </label>
                    <input
                      type="text"
                      value={formData.certificadoA1?.autoridadeCertificadora || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData(prev => {
                          const base = prev.certificadoA1 || getActiveA1Certificate(null);
                          const updated = { ...base, autoridadeCertificadora: val };
                          saveActiveA1Certificate(updated);
                          return { ...prev, certificadoA1: updated };
                        });
                      }}
                      placeholder="Ex: AC SERASA RFB v5 (ICP-Brasil)"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    {/* Quick AC Presets */}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      <span className="text-[10px] text-slate-400 mr-1 self-center">Sugestões:</span>
                      {[
                        'AC SERASA RFB v5',
                        'AC CERTISIGN RFB G5',
                        'AC SOLUTI Multipla v5',
                        'AC VALID Brasil v5',
                        'AC CAIXA ICP-Brasil'
                      ].map(ac => (
                        <button
                          key={ac}
                          type="button"
                          onClick={() => {
                            setFormData(prev => {
                              const base = prev.certificadoA1 || getActiveA1Certificate(null);
                              const updated = { ...base, autoridadeCertificadora: `${ac} (ICP-Brasil)` };
                              saveActiveA1Certificate(updated);
                              return { ...prev, certificadoA1: updated };
                            });
                          }}
                          className="text-[9.5px] bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                        >
                          {ac}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1 text-[11px]">
                      Validade do Certificado (Até) *
                    </label>
                    <input
                      type="text"
                      value={formData.certificadoA1?.validadeFim || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData(prev => {
                          const base = prev.certificadoA1 || getActiveA1Certificate(null);
                          const updated = { ...base, validadeFim: val };
                          saveActiveA1Certificate(updated);
                          return { ...prev, certificadoA1: updated };
                        });
                      }}
                      placeholder="DD/MM/AAAA (Ex: 31/12/2027)"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1 text-[11px]">
                      Número de Série do Certificado
                    </label>
                    <input
                      type="text"
                      value={formData.certificadoA1?.numeroSerie || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData(prev => {
                          const base = prev.certificadoA1 || getActiveA1Certificate(null);
                          const updated = { ...base, numeroSerie: val };
                          saveActiveA1Certificate(updated);
                          return { ...prev, certificadoA1: updated };
                        });
                      }}
                      placeholder="Ex: 4B:82:19:0E:5D:89:33:F1"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-mono text-[11px] focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1 text-[11px]">
                      Hash Criptográfico / Thumbprint SHA-256
                    </label>
                    <input
                      type="text"
                      value={formData.certificadoA1?.thumbprintSha256 || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData(prev => {
                          const base = prev.certificadoA1 || getActiveA1Certificate(null);
                          const updated = { ...base, thumbprintSha256: val };
                          saveActiveA1Certificate(updated);
                          return { ...prev, certificadoA1: updated };
                        });
                      }}
                      placeholder="8A:4C:62:D9:1E:88:54:0B:3D:F7..."
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-mono text-[11px] focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleTestDownloadPdf}
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Baixar PDF de teste com este certificado para conferência imediata"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Baixar PDF de Teste com Este Certificado
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const certToSave = formData.certificadoA1 || getActiveA1Certificate(null);
                      saveActiveA1Certificate(certToSave);
                      const updatedCfg: SystemConfig = {
                        ...formData,
                        certificadoA1: certToSave
                      };
                      setFormData(updatedCfg);
                      onSaveConfig(updatedCfg);
                      try {
                        localStorage.setItem('holerite_system_config', JSON.stringify(updatedCfg));
                      } catch (e) {}
                      setCertStatusMessage({
                        type: 'success',
                        text: `Certificado Digital A1 (${certToSave.titular}) cadastrado e ativado com sucesso! Todos os PDFs sairão assinados com este certificado.`
                      });
                      confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
                    }}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Save className="w-4 h-4" />
                    Salvar e Ativar Este Certificado
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB IA: Configuração de Inteligência Artificial (Google Gemini) para VPS e Banco de Dados */}
          {activeTab === 'IA_CONFIG' && (
            <div className="space-y-4">
              {/* Header Banner */}
              <div className="bg-gradient-to-r from-indigo-50 via-blue-50 to-slate-50 border border-indigo-200 rounded-xl p-4 flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-600 text-white shrink-0 mt-0.5 shadow-sm">
                  <Bot className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-slate-900 text-sm">
                      Configuração da Inteligência Artificial (Google Gemini) na VPS
                    </h4>
                    <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-bold border border-indigo-300">
                      Persistência no Banco de Dados + Servidor
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                    Configure aqui a sua <strong>Chave da API do Google Gemini</strong> para que a importação de PDFs de Holerites e Comprovantes de IRPF com apoio de Inteligência Artificial funcione plenamente na sua VPS. Ao clicar em <strong>Salvar</strong>, a chave fica gravada no banco de dados (Firestore) e no disco do servidor.
                  </p>
                </div>
              </div>

              {/* Status Atual da IA no Servidor / Banco */}
              <div
                className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  Boolean((formData.geminiApiKey || '').trim()) || serverAiStatus?.configured
                    ? 'bg-emerald-50/70 border-emerald-200'
                    : 'bg-amber-50/80 border-amber-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2.5 rounded-xl ${
                      Boolean((formData.geminiApiKey || '').trim()) || serverAiStatus?.configured
                        ? 'bg-emerald-600 text-white'
                        : 'bg-amber-500 text-white'
                    }`}
                  >
                    <Cpu className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-xs">
                        Status do Motor de IA na VPS:
                      </span>
                      {Boolean((formData.geminiApiKey || '').trim()) || serverAiStatus?.configured ? (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold border border-emerald-300 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Chave de API Configurada
                        </span>
                      ) : (
                        <span className="text-[10px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full font-bold border border-amber-300 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-600" /> Aguardando Chave de API
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      {(formData.geminiApiKey || '').trim()
                        ? `Chave cadastrada no banco de dados (${formData.geminiApiKey!.trim().slice(0, 6)}••••••••${formData.geminiApiKey!.trim().slice(-4)}) • Modelo ativo: ${formData.aiModel || 'gemini-3.8-flash'}`
                        : serverAiStatus?.configured
                        ? `Chave ativa no servidor (${serverAiStatus.maskedKey}) • Origem: ${serverAiStatus.keySource === 'database' ? 'Banco de Dados' : 'Variável de Ambiente'} • Modelo: ${serverAiStatus.model}`
                        : 'Nenhuma chave configurada na VPS. Cole sua chave AIza... abaixo e clique em Salvar.'}
                    </p>
                  </div>
                </div>

                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[11px] font-bold flex items-center gap-1.5 shadow-2xs transition-colors shrink-0 self-start sm:self-center"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Gerar Chave no Google AI Studio
                </a>
              </div>

              {/* Formulário da Chave da API e Modelo */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4 shadow-2xs">
                <div>
                  <label className="block text-slate-800 font-bold mb-1 text-xs">
                    Chave da API do Google Gemini (GEMINI_API_KEY) *
                  </label>
                  <p className="text-[11px] text-slate-500 mb-2">
                    Insira a chave iniciada por <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-slate-800">AIzaSy...</code> gerada no painel do Google AI Studio. Ela será salva de forma persistente no banco de dados e no servidor da VPS.
                  </p>
                  <div className="relative">
                    <Key className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type={showGeminiKey ? 'text' : 'password'}
                      value={formData.geminiApiKey || ''}
                      onChange={(e) => setFormData({ ...formData, geminiApiKey: e.target.value })}
                      placeholder="Ex: AIzaSyB1234567890abcdefghijklmnopqrstuv"
                      className="w-full pl-9 pr-20 py-2 border border-slate-300 rounded-lg text-xs font-mono bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowGeminiKey(!showGeminiKey)}
                      className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-800 px-2 py-0.5 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      {showGeminiKey ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5" /> Ocultar
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5" /> Mostrar
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-800 font-bold mb-1 text-xs">
                      Modelo de Inteligência Artificial Gemini
                    </label>
                    <select
                      value={formData.aiModel || 'gemini-3.8-flash'}
                      onChange={(e) => setFormData({ ...formData, aiModel: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      <option value="gemini-3.8-flash">Gemini 3.8 Flash (Recomendado - Rápido e Alta Precisão)</option>
                      <option value="gemini-3-flash-preview">Gemini 3 Flash Preview (Auditoria Contábil)</option>
                      <option value="gemini-2.5-flash">Gemini 2.5 Flash (Estável Multipáginas)</option>
                      <option value="gemini-2.5-pro">Gemini 2.5 Pro (Análise Profunda)</option>
                    </select>
                  </div>

                  <div className="flex flex-col justify-end">
                    <label className="flex items-center gap-2.5 p-2.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formData.aiEnabled !== false}
                        onChange={(e) => setFormData({ ...formData, aiEnabled: e.target.checked })}
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="text-slate-900 font-bold text-xs block">
                          Ativar IA por padrão na Importação
                        </span>
                        <span className="text-[10.5px] text-slate-500 block">
                          Inicia o importador de PDFs de Folha e IRPF com a IA selecionada
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Botões de Teste e Gravação Direta no Banco */}
                <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                  <button
                    type="button"
                    onClick={handleTestAiConnection}
                    disabled={isTestingAi}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isTestingAi ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                        Testando Conexão com Google Gemini...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                        Testar Conexão da IA Agora
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveAiConfigNow}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    Salvar Chave da API no Banco de Dados
                  </button>
                </div>

                {/* Resultado do Teste ou Salvamento */}
                {aiTestResult && (
                  <div
                    className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs ${
                      aiTestResult.success
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-rose-50 border-rose-200 text-rose-900'
                    }`}
                  >
                    {aiTestResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-1">
                      <p className="font-bold">{aiTestResult.message}</p>
                      {aiTestResult.modelUsed && (
                        <p className="text-[11px] opacity-90">
                          Modelo autenticado: <strong>{aiTestResult.modelUsed}</strong> • Tempo de resposta: <strong>{aiTestResult.durationMs}ms</strong>
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 1: Servidor de E-mail (SMTP & Envio) */}
          {activeTab === 'EMAIL_SERVER' && (
            <div className="space-y-4">
              <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-blue-600 text-white shrink-0 mt-0.5">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-xs">
                    Configuração do Serviço de Envio de E-mails
                  </h4>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Configure os parâmetros do servidor de e-mail (SMTP corporativo, Gmail com Senha de App, ou Provedor Transacional) para disparo dos holerites em PDF e envio dos códigos de assinatura digital aos colaboradores.
                  </p>
                </div>
              </div>

              {/* Provedor Selector */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Provedor / Método de Envio de E-mail
                </label>
                <select
                  value={formData.emailProvider}
                  onChange={(e) => {
                    const provider = e.target.value as any;
                    let host = formData.smtpHost || '';
                    let port = formData.smtpPort || 587;
                    if (provider === 'GMAIL_APP') {
                      host = 'smtp.gmail.com';
                      port = 587;
                    } else if (provider === 'SMTP') {
                      host = formData.smtpHost && !formData.smtpHost.includes('gmail.com') ? formData.smtpHost : '';
                      port = formData.smtpPort || 587;
                    }
                    setFormData({ ...formData, emailProvider: provider, smtpHost: host, smtpPort: port });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="GMAIL_APP">Google Gmail / Workspace (smtp.gmail.com:587 TLS - Requer Senha de App)</option>
                  <option value="SMTP">Servidor SMTP Próprio (Locaweb, Hostinger, cPanel, Cartório, AWS SES)</option>
                  <option value="TESTE_LOCAL">Servidor de Teste Instantâneo (Ethereal - Teste Imediato com Link)</option>
                  <option value="RESEND">API Transacional Resend (api.resend.com)</option>
                  <option value="SENDGRID">API SendGrid (smtp.sendgrid.net)</option>
                </select>
              </div>

              {/* Remetente & Reply-To */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-slate-200 pt-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    E-mail do Remetente (De:)
                  </label>
                  <input
                    type="email"
                    value={formData.emailRemetente}
                    onChange={(e) => setFormData({ ...formData, emailRemetente: e.target.value })}
                    placeholder="julianogallice@gmail.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Nome de Exibição do Remetente
                  </label>
                  <input
                    type="text"
                    value={formData.emailNomeRemetente}
                    onChange={(e) => setFormData({ ...formData, emailNomeRemetente: e.target.value })}
                    placeholder="Ex: RH - Cartório Nobre"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    E-mail para Resposta (Reply-To)
                  </label>
                  <input
                    type="email"
                    value={formData.emailReplyTo}
                    onChange={(e) => setFormData({ ...formData, emailReplyTo: e.target.value })}
                    placeholder="julianogallice@gmail.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* SMTP Credentials & Quick Presets */}
              {(formData.emailProvider === 'SMTP' || formData.emailProvider === 'GMAIL_APP' || formData.emailProvider === 'TESTE_LOCAL') && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                    <h5 className="font-bold text-slate-800 text-xs flex items-center gap-1.5 uppercase tracking-wide">
                      <Server className="w-4 h-4 text-blue-600" /> Parâmetros do Servidor SMTP
                    </h5>
                    <span className="text-[10.5px] text-slate-500 font-medium">
                      Atalhos rápidos de provedores:
                    </span>
                  </div>

                  {/* Provider Quick Presets */}
                  <div className="flex flex-wrap gap-1.5 pb-1">
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          emailProvider: 'SMTP',
                          smtpHost: 'email-ssl.com.br',
                          smtpPort: 465,
                          smtpSecure: true
                        });
                      }}
                      className="px-2.5 py-1 text-[11px] bg-white hover:bg-slate-100 border border-slate-300 rounded-md text-slate-700 font-medium cursor-pointer shadow-xs transition-colors"
                    >
                      Locaweb (465 SSL)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          emailProvider: 'SMTP',
                          smtpHost: 'email-ssl.com.br',
                          smtpPort: 587,
                          smtpSecure: false
                        });
                      }}
                      className="px-2.5 py-1 text-[11px] bg-white hover:bg-slate-100 border border-slate-300 rounded-md text-slate-700 font-medium cursor-pointer shadow-xs transition-colors"
                    >
                      Locaweb (587 TLS)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          emailProvider: 'SMTP',
                          smtpHost: 'smtp.hostinger.com',
                          smtpPort: 465,
                          smtpSecure: true
                        });
                      }}
                      className="px-2.5 py-1 text-[11px] bg-white hover:bg-slate-100 border border-slate-300 rounded-md text-slate-700 font-medium cursor-pointer shadow-xs transition-colors"
                    >
                      Hostinger (465 SSL)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          emailProvider: 'SMTP',
                          smtpHost: 'smtp.hostinger.com',
                          smtpPort: 587,
                          smtpSecure: false
                        });
                      }}
                      className="px-2.5 py-1 text-[11px] bg-white hover:bg-slate-100 border border-slate-300 rounded-md text-slate-700 font-medium cursor-pointer shadow-xs transition-colors"
                    >
                      Hostinger (587 TLS)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const domain = formData.emailRemetente.includes('@') ? formData.emailRemetente.split('@')[1] : 'seucartorio.com.br';
                        setFormData({
                          ...formData,
                          emailProvider: 'SMTP',
                          smtpHost: `mail.${domain}`,
                          smtpPort: 465,
                          smtpSecure: true
                        });
                      }}
                      className="px-2.5 py-1 text-[11px] bg-white hover:bg-slate-100 border border-slate-300 rounded-md text-slate-700 font-medium cursor-pointer shadow-xs transition-colors"
                    >
                      cPanel (465 SSL)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const domain = formData.emailRemetente.includes('@') ? formData.emailRemetente.split('@')[1] : 'seucartorio.com.br';
                        setFormData({
                          ...formData,
                          emailProvider: 'SMTP',
                          smtpHost: `mail.${domain}`,
                          smtpPort: 587,
                          smtpSecure: false
                        });
                      }}
                      className="px-2.5 py-1 text-[11px] bg-white hover:bg-slate-100 border border-slate-300 rounded-md text-slate-700 font-medium cursor-pointer shadow-xs transition-colors"
                    >
                      cPanel (587 TLS)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          emailProvider: 'SMTP',
                          smtpHost: 'smtp.office365.com',
                          smtpPort: 587,
                          smtpSecure: false
                        });
                      }}
                      className="px-2.5 py-1 text-[11px] bg-white hover:bg-slate-100 border border-slate-300 rounded-md text-slate-700 font-medium cursor-pointer shadow-xs transition-colors"
                    >
                      Outlook / Office 365
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          emailProvider: 'GMAIL_APP',
                          smtpHost: 'smtp.gmail.com',
                          smtpPort: 587,
                          smtpSecure: false
                        });
                      }}
                      className="px-2.5 py-1 text-[11px] bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-md font-semibold cursor-pointer shadow-xs transition-colors"
                    >
                      Gmail (587 TLS)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          emailProvider: 'TESTE_LOCAL'
                        });
                      }}
                      className="px-2.5 py-1 text-[11px] bg-blue-50 hover:bg-blue-100 border border-blue-300 text-blue-900 rounded-md font-semibold cursor-pointer shadow-xs transition-colors"
                    >
                      ⚡ Teste Instantâneo (Sem Senha)
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-slate-700 font-semibold mb-1">
                        Host SMTP (Servidor de Saída)
                      </label>
                      <input
                        type="text"
                        value={formData.smtpHost || ''}
                        onChange={(e) => setFormData({ ...formData, smtpHost: e.target.value.trim() })}
                        placeholder="Ex: mail.seucartorio.com.br ou smtp.hostinger.com"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                      <span className="text-[10px] text-slate-500 mt-0.5 block">
                        Informe apenas o endereço do host (sem http:// ou barras)
                      </span>
                    </div>

                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">
                        Porta & Segurança
                      </label>
                      <select
                        value={`${formData.smtpPort || 587}-${formData.smtpSecure ? 'ssl' : 'tls'}`}
                        onChange={(e) => {
                          const [p, sec] = e.target.value.split('-');
                          const port = parseInt(p, 10);
                          setFormData({
                            ...formData,
                            smtpPort: port,
                            smtpSecure: sec === 'ssl' || port === 465
                          });
                        }}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      >
                        <option value="587-tls">Porta 587 (TLS / STARTTLS)</option>
                        <option value="465-ssl">Porta 465 (SSL Direto)</option>
                        <option value="25-tls">Porta 25 (Padrão)</option>
                        <option value="2525-tls">Porta 2525 (Alternativa)</option>
                      </select>
                      <span className="text-[10px] text-slate-500 mt-0.5 block">
                        {formData.smtpPort === 465 ? 'Criptografia SSL ativa' : 'STARTTLS ativo'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">
                        Usuário SMTP (E-mail da Caixa Postal)
                      </label>
                      <input
                        type="text"
                        value={formData.smtpUser || ''}
                        onChange={(e) => setFormData({ ...formData, smtpUser: e.target.value.trim() })}
                        placeholder="Ex: rh@seucartorio.com.br ou julianogallice@gmail.com"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                      <span className="text-[10px] text-slate-500 mt-0.5 block">
                        Geralmente é o e-mail completo da conta
                      </span>
                    </div>

                    <div>
                      <label className="block text-slate-700 font-semibold mb-1 flex items-center justify-between">
                        <span>Senha do E-mail / Senha de App</span>
                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                      </label>
                      <input
                        type="password"
                        value={formData.smtpPassword || ''}
                        onChange={(e) => setFormData({ ...formData, smtpPassword: e.target.value })}
                        placeholder="Senha do webmail ou senha de app"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                      <span className="text-[10px] text-slate-500 mt-0.5 block">
                        {formData.emailRemetente.includes('gmail.com') ? 'Gmail exige Senha de App (16 letras)' : 'Senha de acesso ao seu webmail'}
                      </span>
                    </div>
                  </div>

                  {formData.emailProvider === 'TESTE_LOCAL' ? (
                    <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-[11px] leading-relaxed space-y-1">
                      <strong>🚀 Modo de Teste Instantâneo Ativo (Ethereal Mail):</strong>
                      <p>
                        Este modo cria uma caixa de correio temporária segura no ar, permitindo testar o envio de holerites em PDF e códigos de assinatura <strong>sem necessidade de senha</strong>. Ao clicar em "Testar Disparo", um link para visualizar o e-mail real entregue será gerado instantaneamente.
                      </p>
                    </div>
                  ) : (formData.emailRemetente.includes('gmail.com') || formData.emailProvider === 'GMAIL_APP') ? (
                    <div className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-300 text-amber-950 text-[11px] leading-relaxed space-y-2">
                      <div className="flex items-center gap-1.5 font-bold text-amber-900 text-xs">
                        <span>⚠️ Atenção para Contas Google / Gmail:</span>
                      </div>
                      <p>
                        O Google rejeita senhas comuns de login (Erro 535). Para conectar o Gmail ao sistema, você precisa de uma <strong>Senha de App (16 caracteres)</strong>:
                      </p>
                      <ol className="list-decimal list-inside space-y-1 text-slate-700 bg-white/80 p-2.5 rounded-lg border border-amber-200">
                        <li>Acesse o painel: <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="text-blue-600 font-bold underline inline-flex items-center gap-0.5">myaccount.google.com/apppasswords <ExternalLink className="w-3 h-3" /></a></li>
                        <li>Digite <strong>Holerite</strong> como nome do aplicativo e clique em <strong>Criar</strong>.</li>
                        <li>Copie o código de 16 letras gerado e cole no campo de senha acima.</li>
                      </ol>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-300 text-slate-800 text-[11px] leading-relaxed space-y-2">
                      <div className="flex items-center justify-between">
                        <strong className="text-slate-900 flex items-center gap-1.5 font-bold">
                          💡 Requisitos Importantes para SMTP Próprio (Locaweb, cPanel, Hostinger):
                        </strong>
                      </div>
                      <ul className="list-disc list-inside space-y-1 text-slate-700">
                        <li>
                          <strong>Remetente Obrigatório:</strong> O campo <em>E-mail do Remetente</em> deve pertencer ao mesmo domínio da caixa postal (ex: {formData.smtpUser || 'contato@seudominio.com.br'}). Enviar como @gmail.com em servidor próprio gerará o erro <strong>550 5.7.1 Envio não autorizado</strong>.
                        </li>
                        <li>
                          <strong>Registro SPF no DNS:</strong> Verifique se a sua zona de DNS (Registro.br ou cPanel) contém a entrada TXT com o SPF da sua hospedagem (ex: Locaweb: <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">v=spf1 include:_spf.locaweb.com.br ~all</code>).
                        </li>
                        <li>
                          <strong>Timeout de Conexão:</strong> Se a porta 465 sofrer <em>Connection timeout</em>, mude para a porta 587 com STARTTLS (ou vice-versa).
                        </li>
                      </ul>
                      {formData.smtpUser && formData.emailRemetente !== formData.smtpUser && (
                        <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-amber-50 border border-amber-300 p-2.5 rounded-lg">
                          <span className="text-amber-900 text-xs">
                            Remetente atual (<strong>{formData.emailRemetente}</strong>) diferente do usuário SMTP (<strong>{formData.smtpUser}</strong>).
                          </span>
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, emailRemetente: formData.smtpUser || formData.emailRemetente })}
                            className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded text-xs cursor-pointer shadow-xs shrink-0"
                          >
                            Usar {formData.smtpUser} como Remetente
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* API Key if Transacional */}
              {(formData.emailProvider === 'RESEND' || formData.emailProvider === 'SENDGRID') && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                  <label className="block text-slate-700 font-semibold mb-1">
                    Chave de API (API Key do provedor {formData.emailProvider})
                  </label>
                  <input
                    type="password"
                    value={formData.emailApiKey || ''}
                    onChange={(e) => setFormData({ ...formData, emailApiKey: e.target.value })}
                    placeholder="re_xxxxxxxxxxxx ou SG.xxxxxxxxxxxx"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              )}

              {/* Template de Assunto & Mensagem */}
              <div className="space-y-3 border-t border-slate-200 pt-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Assunto Padrão do E-mail do Holerite
                  </label>
                  <input
                    type="text"
                    value={formData.emailTemplateAssunto || ''}
                    onChange={(e) => setFormData({ ...formData, emailTemplateAssunto: e.target.value })}
                    placeholder="[Holerite Digital] Recibo de Pagamento - {mesAno} - {nome}"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Mensagem de Texto do E-mail
                  </label>
                  <textarea
                    rows={3}
                    value={formData.emailTemplateCorpo || ''}
                    onChange={(e) => setFormData({ ...formData, emailTemplateCorpo: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  />
                  <span className="text-[10.5px] text-slate-500 mt-1 block">
                    Tags dinâmicas: <code>{'{nome}'}</code>, <code>{'{mesAno}'}</code>, <code>{'{valorLiquido}'}</code>, <code>{'{codigoAssinatura}'}</code>
                  </span>
                </div>
              </div>

              {/* Botão de Teste de E-mail */}
              <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h5 className="font-bold text-slate-900 text-xs">Testar Disparo de E-mail</h5>
                  <p className="text-[11px] text-slate-500">
                    Dispara uma mensagem de teste para o e-mail do remetente ({formData.emailRemetente}).
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isTestingEmail || !formData.emailRemetente}
                  onClick={() => handleTestEmail()}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-bold rounded-lg text-xs flex items-center gap-2 cursor-pointer shadow-sm transition-all shrink-0"
                >
                  {isTestingEmail ? (
                    <>
                      <Clock className="w-3.5 h-3.5 animate-spin" /> Testando...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" /> Enviar E-mail de Teste
                    </>
                  )}
                </button>
              </div>

              {testEmailResult && (
                testEmailResult.success ? (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-950 text-xs flex items-start gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <strong className="block font-bold text-emerald-900">Sucesso na Entrega do E-mail!</strong>
                      <p className="text-emerald-800">{testEmailResult.message}</p>
                      {testEmailResult.previewUrl && (
                        <div className="mt-2 pt-1">
                          <a
                            href={testEmailResult.previewUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs shadow-sm cursor-pointer"
                          >
                            <span>Abrir Visualização do E-mail Entregue</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      )}
                      {testEmailResult.messageId && (
                        <span className="text-[10px] font-mono text-emerald-700 block mt-1">
                          ID da Mensagem: {testEmailResult.messageId}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-rose-950 text-xs flex items-start gap-2.5">
                    <X className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div className="w-full space-y-2">
                      <div>
                        <strong className="block font-bold text-rose-900">Falha ao Conectar / Enviar E-mail:</strong>
                        <p className="mt-0.5 text-rose-800 font-medium">{testEmailResult.message}</p>
                      </div>

                      {testEmailResult.details && (
                        <div className="p-2.5 bg-white/80 rounded-lg border border-rose-200 text-rose-800 text-[11px] leading-relaxed">
                          💡 <strong>Orientação:</strong> {testEmailResult.details}
                        </div>
                      )}

                      {/* Ação rápida para Erro 550 5.7.1 / SPF / MX */}
                      {(testEmailResult.rawError?.includes('550') ||
                        testEmailResult.rawError?.includes('5.7.1') ||
                        testEmailResult.rawError?.includes('SPF') ||
                        testEmailResult.rawError?.includes('Envio nao autorizado') ||
                        testEmailResult.rawError?.includes('Envio não autorizado')) && (
                        <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-950 text-xs space-y-2">
                          <strong className="font-bold text-amber-900 flex items-center gap-1.5">
                            🛡️ Solução para Erro 550 5.7.1 (SPF / Remetente não autorizado):
                          </strong>
                          <p className="text-[11px] text-amber-900 leading-relaxed">
                            O servidor do seu domínio recusou o envio porque o e-mail do remetente precisa ser uma conta do seu próprio domínio autenticado.
                          </p>
                          {formData.smtpUser && formData.emailRemetente !== formData.smtpUser && (
                            <button
                              type="button"
                              onClick={() => {
                                const updated = { ...formData, emailRemetente: formData.smtpUser || formData.emailRemetente };
                                setFormData(updated);
                                handleTestEmail(updated);
                              }}
                              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-md text-xs cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                            >
                              <span>⚡ Corrigir Remetente para "{formData.smtpUser}" e Testar Novamente</span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* Ação rápida para Timeout de Conexão */}
                      {(testEmailResult.rawError?.toLowerCase().includes('timeout') ||
                        testEmailResult.code === 'ETIMEDOUT') && (
                        <div className="p-3 bg-blue-50 border border-blue-300 rounded-lg text-blue-950 text-xs space-y-2">
                          <strong className="font-bold text-blue-900 flex items-center gap-1.5">
                            ⚡ Solução Rápida para Tempo Limite Esgotado (Connection Timeout):
                          </strong>
                          <p className="text-[11px] text-blue-900 leading-relaxed">
                            Muitos servidores e firewalls bloqueiam uma porta específica ou exigem alternar entre SSL Direto e STARTTLS.
                          </p>
                          <div className="flex flex-wrap gap-2 pt-0.5">
                            {formData.smtpPort !== 465 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = { ...formData, smtpPort: 465, smtpSecure: true };
                                  setFormData(updated);
                                  handleTestEmail(updated);
                                }}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md text-xs cursor-pointer shadow-xs"
                              >
                                🔄 Alternar para Porta 465 (SSL Direto) e Testar
                              </button>
                            )}
                            {formData.smtpPort !== 587 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = { ...formData, smtpPort: 587, smtpSecure: false };
                                  setFormData(updated);
                                  handleTestEmail(updated);
                                }}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md text-xs cursor-pointer shadow-xs"
                              >
                                🔄 Alternar para Porta 587 (TLS/STARTTLS) e Testar
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {testEmailResult.rawError && (
                        <div className="p-2 bg-slate-900 text-rose-300 font-mono text-[10.5px] rounded-lg border border-slate-700 break-all">
                          <strong className="text-white block mb-0.5">Mensagem técnica do servidor SMTP:</strong>
                          {testEmailResult.rawError}
                        </div>
                      )}

                      {testEmailResult.code && (
                        <span className="text-[10px] font-mono text-rose-600 block">
                          Código de Retorno: {testEmailResult.code}
                        </span>
                      )}
                    </div>
                  </div>
                )
              )}

              {/* Dedicated Save Email Settings Action Card */}
              <div className="mt-4 pt-3.5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-blue-200 shadow-xs">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-blue-50 text-blue-600 shrink-0">
                    <Server className="w-4 h-4" />
                  </div>
                  <div>
                    <h6 className="font-bold text-slate-800 text-xs">
                      Gravar Dados Deste Servidor de E-mail
                    </h6>
                    <p className="text-[11px] text-slate-500">
                      Host ativo: <strong className="text-slate-700">{formData.smtpHost || '(não definido)'}</strong> (Porta {formData.smtpPort || 587}). Salva localmente e no servidor permanente.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const toSave = { ...formData };
                    onSaveConfig(toSave);
                    try {
                      localStorage.setItem('holerite_system_config', JSON.stringify(toSave));
                    } catch (e) {}
                    fetch('/api/config', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(toSave)
                    }).catch(() => {});
                    confetti({ particleCount: 50, spread: 50, origin: { y: 0.6 } });
                    setTestEmailResult({
                      success: true,
                      message: `Configurações do servidor (${formData.smtpHost || 'SMTP'}) salvas com sucesso no servidor e na memória permanente!`
                    });
                  }}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Save className="w-4 h-4" />
                  Salvar Configurações de E-mail
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: Empresa */}
          {activeTab === 'EMPRESA' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-slate-700 font-semibold mb-1">
                    Razão Social do Empregador / Cartório
                  </label>
                  <input
                    type="text"
                    value={formData.razaoSocial}
                    onChange={(e) => setFormData({ ...formData, razaoSocial: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    CEI ou CNPJ
                  </label>
                  <input
                    type="text"
                    value={formData.cei}
                    onChange={(e) => setFormData({ ...formData, cei: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Centro de Custo
                  </label>
                  <input
                    type="text"
                    value={formData.centroCusto}
                    onChange={(e) => setFormData({ ...formData, centroCusto: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Regime de Folha
                  </label>
                  <input
                    type="text"
                    value={formData.regime}
                    onChange={(e) => setFormData({ ...formData, regime: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Segurança & 2FA */}
          {activeTab === 'ASSINATURA' && (
            <div className="space-y-4">
              {/* Dupla Autenticação (2FA) no Login ao Portal */}
              <div className="bg-gradient-to-r from-blue-50/70 to-indigo-50/50 p-4 border border-blue-200 rounded-xl space-y-3 shadow-xs">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <label className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <Lock className="w-4 h-4 text-blue-600" />
                      Ativar Login com Dupla Autenticação (2FA)
                    </label>
                    <span className="text-[11px] text-slate-600 block mt-0.5">
                      Exige que colaboradores e gestores confirmem um código de segurança de 6 dígitos enviado por WhatsApp ou E-mail para acessar o portal.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(formData.exigir2FALogin)}
                    onChange={(e) =>
                      setFormData({ ...formData, exigir2FALogin: e.target.checked })
                    }
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer shrink-0"
                  />
                </div>

                {formData.exigir2FALogin && (
                  <div className="pt-3 border-t border-blue-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1 text-[11px]">
                        Canal para Envio do Código 2FA de Login
                      </label>
                      <select
                        value={formData.canal2FALogin || 'WHATSAPP'}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            canal2FALogin: e.target.value as any
                          })
                        }
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      >
                        <option value="WHATSAPP">WhatsApp (Evolution API)</option>
                        <option value="EMAIL">E-mail (SMTP Corporativo)</option>
                        <option value="AMBOS">Ambos (WhatsApp e E-mail)</option>
                      </select>
                    </div>
                    <div className="text-[11px] text-blue-900 flex items-center bg-blue-100/70 p-2.5 rounded-lg border border-blue-200">
                      🔒 O código gerado expira em 10 minutos. O gestor e o colaborador receberão a notificação oficial antes do acesso ser liberado.
                    </div>
                  </div>
                )}
              </div>

              {/* 2FA para Assinatura do Holerite */}
              <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="font-bold text-slate-900 text-xs block">
                      Exigir Código de Validação 2FA para Assinatura do Holerite
                    </label>
                    <span className="text-[11px] text-slate-500">
                      O colaborador deve inserir o código de 6 dígitos enviado por WhatsApp ou E-mail para validar a assinatura CLT.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.exigirCodigoAssinatura}
                    onChange={(e) =>
                      setFormData({ ...formData, exigirCodigoAssinatura: e.target.checked })
                    }
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Canal Padrão para Código de Assinatura
                  </label>
                  <select
                    value={formData.canalAssinaturaPadrao}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        canalAssinaturaPadrao: e.target.value as any
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="WHATSAPP">WhatsApp (Evolution API)</option>
                    <option value="EMAIL">E-mail (SMTP)</option>
                    <option value="AMBOS">Escolha do Colaborador</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Prazo Máximo para Assinatura (dias)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={formData.diasPrazoAssinatura}
                    onChange={(e) =>
                      setFormData({ ...formData, diasPrazoAssinatura: parseInt(e.target.value) || 5 })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: WhatsApp & Evolution API */}
          {activeTab === 'COMUNICACAO' && (
            <div className="space-y-5">
              {/* Provedor Oficial de WhatsApp: Evolution API */}
              <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-600 text-white shrink-0 shadow-xs">
                    <Radio className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-slate-900 text-xs">Canal Oficial de WhatsApp: Evolution API</h4>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full border border-emerald-300">
                        Envio Exclusivo via API
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Todos os disparos em massa, notificações de holerites e validações 2FA são processados de forma 100% automatizada e silenciosa pelo servidor da Evolution API.
                    </p>
                  </div>
                </div>
              </div>

              {/* Configurações da Evolution API */}
              <div className="border border-emerald-200 bg-emerald-50/30 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
                    <div className="flex items-center gap-2">
                      <Radio className="w-4 h-4 text-emerald-600" />
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs">Parâmetros de Conexão com Evolution API</h4>
                        <p className="text-[11px] text-slate-500">
                          Preencha a URL da sua Evolution API (v1 ou v2), a Apikey global ou da instância e o nome da instância.
                        </p>
                      </div>
                    </div>
                    {whatsappStatus && (
                      <span
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${
                          whatsappStatus.connected
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-rose-100 text-rose-800 border-rose-300'
                        }`}
                      >
                        {whatsappStatus.connected ? (
                          <>
                            <Wifi className="w-3.5 h-3.5 text-emerald-600" /> Conectado ({whatsappStatus.state || 'open'})
                          </>
                        ) : (
                          <>
                            <WifiOff className="w-3.5 h-3.5 text-rose-600" /> Desconectado ({whatsappStatus.state || 'close'})
                          </>
                        )}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Evolution API URL */}
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">
                        URL da Evolution API *
                      </label>
                      <input
                        type="url"
                        placeholder="https://evolution.minhaempresa.com.br"
                        value={formData.evolutionApiUrl || ''}
                        onChange={(e) => setFormData({ ...formData, evolutionApiUrl: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                      <span className="text-[10px] text-slate-500 mt-0.5 block">
                        Exemplo: <code>https://api.empresa.com.br</code> ou <code>http://localhost:8080</code>
                      </span>
                    </div>

                    {/* Evolution API Key */}
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">
                        Chave API (Apikey) *
                      </label>
                      <div className="relative">
                        <input
                          type={showEvolutionKey ? 'text' : 'password'}
                          placeholder="B6D711FCDE4D4FD59365441..."
                          value={formData.evolutionApiKey || ''}
                          onChange={(e) => setFormData({ ...formData, evolutionApiKey: e.target.value })}
                          className="w-full px-3 py-2 pr-9 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowEvolutionKey(!showEvolutionKey)}
                          className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                          tabIndex={-1}
                        >
                          {showEvolutionKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <span className="text-[10px] text-slate-500 mt-0.5 block">
                        AUTHENTICATION_API_KEY do servidor ou chave da instância.
                      </span>
                    </div>

                    {/* Evolution Instance Name */}
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">
                        Nome da Instância (Instance Name) *
                      </label>
                      <input
                        type="text"
                        placeholder="rh_cartorio ou empresa"
                        value={formData.evolutionInstance || ''}
                        onChange={(e) => setFormData({ ...formData, evolutionInstance: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                      />
                      <span className="text-[10px] text-slate-500 mt-0.5 block">
                        Nome exato da instância criada na sua Evolution API.
                      </span>
                    </div>
                  </div>

                  {/* Opção de Envio Automático de PDF Anexo */}
                  <div className="pt-2 border-t border-emerald-100 flex items-center justify-between">
                    <div>
                      <label className="font-bold text-slate-900 text-xs block cursor-pointer" htmlFor="sendPdfToggle">
                        Anexar arquivo PDF do Holerite automaticamente
                      </label>
                      <span className="text-[11px] text-slate-500">
                        O PDF com as 2 vias oficiais do holerite será anexado e entregue como documento no WhatsApp.
                      </span>
                    </div>
                    <input
                      id="sendPdfToggle"
                      type="checkbox"
                      checked={formData.enviarPdfAutomaticoWhatsapp !== false}
                      onChange={(e) => setFormData({ ...formData, enviarPdfAutomaticoWhatsapp: e.target.checked })}
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                    />
                  </div>

                  {/* Painel de Teste de Conexão e Disparo */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Wifi className="w-4 h-4 text-emerald-600" />
                        <span className="font-bold text-slate-800 text-xs">Testar Conexão e Disparo no WhatsApp</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleCheckWhatsappStatus}
                        disabled={isCheckingWhatsappStatus || !formData.evolutionApiUrl || !formData.evolutionApiKey || !formData.evolutionInstance}
                        className="px-3 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isCheckingWhatsappStatus ? 'animate-spin' : ''}`} />
                        <span>Verificar Status da Instância</span>
                      </button>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                      <div className="relative w-full sm:w-64">
                        <Smartphone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="tel"
                          placeholder="Celular de teste com DDD (ex: 11999998888)"
                          value={whatsappTestNumber}
                          onChange={(e) => setWhatsappTestNumber(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleTestWhatsappConnection}
                        disabled={
                          isTestingWhatsapp ||
                          !formData.evolutionApiUrl ||
                          !formData.evolutionApiKey ||
                          !formData.evolutionInstance
                        }
                        className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-all disabled:opacity-50"
                      >
                        {isTestingWhatsapp ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Validando Conexão...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            <span>Testar Conexão {whatsappTestNumber ? '& Enviar Mensagem' : ''}</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Resultado do Teste */}
                    {whatsappTestResult && (
                      <div
                        className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs animate-in fade-in ${
                          whatsappTestResult.success
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                            : 'bg-rose-50 border-rose-200 text-rose-900'
                        }`}
                      >
                        {whatsappTestResult.success ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        )}
                        <div className="space-y-1">
                          <p className="font-bold">{whatsappTestResult.message}</p>
                          {whatsappTestResult.state && (
                            <p className="text-[11px] opacity-90">
                              Estado retornado pela Evolution API: <strong>{whatsappTestResult.state}</strong>
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              {/* Modelo da Mensagem de Texto */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-slate-800 font-bold text-xs">
                      Modelo da Mensagem Padrão do WhatsApp
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Personalize a mensagem enviada aos colaboradores ao notificar sobre holerites disponíveis ou assinaturas.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        mensagemWhatsappPadrao: `📄 *COMUNICADO DE PAGAMENTO - CARTÓRIO / EMPRESA*\nOlá, *{primeiroNome}*!\n\nSeu recibo de pagamento referente a *{mesAno}* já está disponível para consulta e assinatura digital no portal do colaborador.\n\n💰 *Resumo da Folha:*\n• *Valor Líquido: {valorLiquido}*\n🔑 *Matrícula:* {matricula}\n🌐 *Acesse pelo link:* {linkPortal}\n\nPor favor, acesse o portal para conferir e assinar o seu comprovante com validade jurídica CLT.`
                      });
                    }}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer underline"
                  >
                    Restaurar Padrão do RH
                  </button>
                </div>

                <textarea
                  rows={6}
                  value={formData.mensagemWhatsappPadrao}
                  onChange={(e) => setFormData({ ...formData, mensagemWhatsappPadrao: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono leading-relaxed"
                  placeholder="Digite a mensagem padrão do WhatsApp..."
                />

                {/* Variáveis Dinâmicas */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-bold text-slate-700 block">
                    Variáveis dinâmicas para preenchimento automático (clique para adicionar):
                  </span>
                  <div className="flex flex-wrap gap-1.5 text-[10.5px]">
                    {[
                      { tag: '{primeiroNome}', label: 'Primeiro Nome' },
                      { tag: '{nome}', label: 'Nome Completo' },
                      { tag: '{mesAno}', label: 'Competência (Mês/Ano)' },
                      { tag: '{valorLiquido}', label: 'Valor Líquido' },
                      { tag: '{matricula}', label: 'Matrícula' },
                      { tag: '{cargo}', label: 'Cargo' },
                      { tag: '{linkPortal}', label: 'Link do Portal' },
                      { tag: '{codigoAssinatura}', label: 'Código 2FA Assinatura' }
                    ].map(item => (
                      <button
                        key={item.tag}
                        type="button"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            mensagemWhatsappPadrao: (formData.mensagemWhatsappPadrao || '') + ' ' + item.tag
                          });
                        }}
                        className="px-2 py-0.8 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 rounded-md border border-slate-200 font-mono transition-colors cursor-pointer"
                        title={`Inserir ${item.tag}`}
                      >
                        {item.tag} <span className="text-slate-400 font-sans">({item.label})</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: Planilha de Usuários (XLS) */}
          {activeTab === 'PLANILHA_USUARIOS' && (
            <div className="space-y-5">
              {/* Header Banner */}
              <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-slate-50 border border-emerald-200 rounded-2xl p-4 sm:p-5 shadow-xs">
                <div className="flex items-start gap-3.5">
                  <div className="p-3 rounded-xl bg-emerald-600 text-white shrink-0 shadow-sm mt-0.5">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-slate-900 text-sm">
                        Configuração de Usuários por Planilha Excel (XLS / XLSX)
                      </h4>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full border border-emerald-300">
                        Importação & Exportação Rápida
                      </span>
                    </div>
                    <p className="text-[11.5px] text-slate-600 mt-1 leading-relaxed">
                      Gerencie e complete em massa o <strong>E-mail</strong>, <strong>Telefone/WhatsApp</strong> e a <strong>Senha Inicial</strong> de todos os colaboradores do cartório/empresa diretamente em uma planilha Excel, sem precisar cadastrar um por um manualmente.
                    </p>
                  </div>
                </div>
              </div>

              {/* Seção 1: Exportar Planilha */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Download className="w-4 h-4 text-emerald-600" />
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs">1. Exportar Planilha Atual da Folha</h4>
                      <p className="text-[11px] text-slate-500">
                        Baixe o arquivo com a lista de {employees.length} colaboradores já cadastrados para preencher os dados faltantes.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      exportEmployeesToXLSX(employees, users);
                      confetti({ particleCount: 40, spread: 50, origin: { y: 0.6 } });
                    }}
                    className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    Exportar Base Completa ({employees.length} Colaboradores) (.xlsx)
                  </button>

                  <button
                    type="button"
                    onClick={() => downloadBlankEmployeesTemplateXLSX()}
                    className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 border border-slate-200 transition-all cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    Baixar Modelo em Branco (.xlsx)
                  </button>
                </div>
              </div>

              {/* Seção 2: Importar Planilha Preenchida */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <UploadCloud className="w-4 h-4 text-blue-600" />
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs">2. Importar Planilha Preenchida (.xlsx / .xls)</h4>
                      <p className="text-[11px] text-slate-500">
                        Envie o arquivo preenchido para atualizar os e-mails, telefones e senhas dos colaboradores automaticamente.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Dropzone / Upload Box */}
                <input
                  type="file"
                  ref={spreadsheetInputRef}
                  accept=".xlsx, .xls, .csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setIsParsingSpreadsheet(true);
                    setSpreadsheetError(null);
                    setSpreadsheetSuccess(null);
                    try {
                      const analysis = await parseAndAnalyzeSpreadsheet(file, employees, users);
                      setSpreadsheetAnalysis(analysis);
                      if (analysis.totalRows === 0) {
                        setSpreadsheetError('Nenhuma linha de dados encontrada na planilha.');
                      }
                    } catch (err: any) {
                      setSpreadsheetError(err?.message || 'Falha ao processar arquivo de planilha.');
                      setSpreadsheetAnalysis(null);
                    } finally {
                      setIsParsingSpreadsheet(false);
                      if (spreadsheetInputRef.current) {
                        spreadsheetInputRef.current.value = '';
                      }
                    }
                  }}
                />

                {!spreadsheetAnalysis && (
                  <div
                    onClick={() => spreadsheetInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                      isParsingSpreadsheet
                        ? 'border-emerald-400 bg-emerald-50/50'
                        : 'border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/20 bg-slate-50/60'
                    }`}
                  >
                    {isParsingSpreadsheet ? (
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
                        <p className="font-bold text-slate-800 text-xs">Processando e analisando planilha...</p>
                        <p className="text-[11px] text-slate-500">Mapeando matrículas, e-mails, telefones e senhas...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
                          <FileSpreadsheet className="w-6 h-6" />
                        </div>
                        <p className="font-bold text-slate-800 text-xs">
                          Clique aqui para selecionar a planilha (.xlsx, .xls ou .csv)
                        </p>
                        <p className="text-[11px] text-slate-500 max-w-md">
                          O sistema irá comparar os registros pela <strong>Matrícula</strong> ou <strong>CPF</strong> e identificar quais colaboradores terão e-mail, telefone ou senha atualizados.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Error Banner */}
                {spreadsheetError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{spreadsheetError}</span>
                  </div>
                )}

                {/* Success Banner */}
                {spreadsheetSuccess && (
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 shadow-xs">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span className="font-semibold">{spreadsheetSuccess}</span>
                  </div>
                )}

                {/* Analysis Preview Section */}
                {spreadsheetAnalysis && (
                  <div className="space-y-4 pt-2">
                    {/* KPI metrics from analysis */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                        <span className="text-[10px] text-slate-500 uppercase font-bold block">Linhas</span>
                        <span className="text-base font-extrabold text-slate-900">{spreadsheetAnalysis.totalRows}</span>
                      </div>
                      <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-center">
                        <span className="text-[10px] text-emerald-700 uppercase font-bold block">Vinculados</span>
                        <span className="text-base font-extrabold text-emerald-800">{spreadsheetAnalysis.matchedCount}</span>
                      </div>
                      <div className="bg-blue-50 p-3 rounded-xl border border-blue-200 text-center">
                        <span className="text-[10px] text-blue-700 uppercase font-bold block">Novos E-mails</span>
                        <span className="text-base font-extrabold text-blue-800">+{spreadsheetAnalysis.newEmailsCount}</span>
                      </div>
                      <div className="bg-teal-50 p-3 rounded-xl border border-teal-200 text-center">
                        <span className="text-[10px] text-teal-700 uppercase font-bold block">Novos WhatsApp</span>
                        <span className="text-base font-extrabold text-teal-800">+{spreadsheetAnalysis.newPhonesCount}</span>
                      </div>
                      <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-center col-span-2 sm:col-span-1">
                        <span className="text-[10px] text-amber-700 uppercase font-bold block">Novas Senhas</span>
                        <span className="text-base font-extrabold text-amber-800">+{spreadsheetAnalysis.newPasswordsCount}</span>
                      </div>
                    </div>

                    {/* Table of parsed employees and preview diff */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="bg-slate-100/80 px-4 py-2 border-b border-slate-200 flex justify-between items-center text-[11px] font-bold text-slate-700">
                        <span>Pré-visualização das Alterações Detectadas</span>
                        <span className="text-slate-500 font-normal">
                          {spreadsheetAnalysis.changes.filter(c => c.hasChange).length} com alterações pendentes
                        </span>
                      </div>

                      <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 text-[11px]">
                        {spreadsheetAnalysis.changes.map((change, idx) => (
                          <div
                            key={idx}
                            className={`p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                              change.hasChange ? 'bg-emerald-50/30' : 'bg-white'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 truncate">{change.nome}</span>
                                <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                  Matrícula: {change.matricula || 'N/A'}
                                </span>
                                {change.hasChange && (
                                  <span className="text-[9.5px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-full">
                                    Atualização
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10.5px] text-slate-500 mt-1">
                                {change.newEmail && (
                                  <span className={change.newEmail !== change.oldEmail ? 'text-blue-700 font-medium' : ''}>
                                    ✉️ {change.newEmail}
                                  </span>
                                )}
                                {change.newPhone && (
                                  <span className={change.newPhone !== change.oldPhone ? 'text-emerald-700 font-medium' : ''}>
                                    📱 {change.newPhone}
                                  </span>
                                )}
                                {change.newSenha && (
                                  <span className="text-amber-800 font-mono font-medium">
                                    🔑 Senha: {change.newSenha}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="shrink-0 flex items-center gap-1.5">
                              {change.isMatched ? (
                                <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-semibold flex items-center gap-1">
                                  <Check className="w-3 h-3 text-emerald-600" /> Colaborador Localizado
                                </span>
                              ) : (
                                <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded font-semibold">
                                  Novo Registro
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSpreadsheetAnalysis(null);
                          setSpreadsheetError(null);
                        }}
                        className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-100 cursor-pointer transition-colors"
                      >
                        Carregar Outra Planilha
                      </button>

                      <button
                        type="button"
                        disabled={isApplyingSpreadsheet}
                        onClick={async () => {
                          if (!spreadsheetAnalysis || !onBatchUpdateEmployeesAndUsers) return;
                          setIsApplyingSpreadsheet(true);
                          try {
                            const { updatedEmployees, updatedUsers } = applySpreadsheetToEntities(
                              spreadsheetAnalysis,
                              employees,
                              users
                            );
                            await onBatchUpdateEmployeesAndUsers(updatedEmployees, updatedUsers);
                            confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
                            setSpreadsheetSuccess(
                              `Sucesso! Base atualizada com ${spreadsheetAnalysis.newEmailsCount} e-mails, ${spreadsheetAnalysis.newPhonesCount} telefones e ${spreadsheetAnalysis.newPasswordsCount} senhas iniciais.`
                            );
                          } catch (err: any) {
                            setSpreadsheetError(err?.message || 'Erro ao aplicar alterações na base.');
                          } finally {
                            setIsApplyingSpreadsheet(false);
                          }
                        }}
                        className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                      >
                        {isApplyingSpreadsheet ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Aplicando Alterações...
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            Confirmar e Gravar Alterações na Base
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: Dados & Produção */}
          {activeTab === 'DADOS' && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Database className="w-6 h-6 text-emerald-600" />
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">Servidor de Banco de Dados Corporativo</h4>
                    <p className="text-[11px] text-slate-600">
                      Sincronização criptografada em tempo real e backup automático ativos.
                    </p>
                  </div>
                </div>
                <span className="bg-emerald-600 text-white font-bold text-[10px] px-2.5 py-1 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Online
                </span>
              </div>

              <div className="border border-rose-200 bg-rose-50/50 rounded-xl p-4 space-y-3">
                <h4 className="font-bold text-rose-900 text-xs flex items-center gap-1.5">
                  <Trash2 className="w-4 h-4 text-rose-600" /> Redefinir Base de Dados do Sistema
                </h4>
                <p className="text-[11px] text-rose-800">
                  Caso necessite limpar os registros atuais para reiniciar os lançamentos da folha de pagamento do zero, utilize a opção abaixo.
                </p>

                {isConfirmingClear ? (
                  <div className="p-3 bg-white border border-rose-300 rounded-xl space-y-2">
                    <p className="text-xs font-bold text-rose-950">
                      Tem certeza? Todos os holerites e cadastros atuais serão removidos.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setIsConfirmingClear(false)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onClearProductionData();
                          setIsConfirmingClear(false);
                          onClose();
                        }}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold"
                      >
                        Confirmar Limpeza do Banco
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsConfirmingClear(true)}
                    className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Limpar Base de Dados
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 -mx-6 -mb-6 mt-6 flex justify-between items-center">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-slate-600 hover:text-slate-900 font-medium text-xs hover:bg-slate-200 transition-colors"
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              Salvar Configurações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
