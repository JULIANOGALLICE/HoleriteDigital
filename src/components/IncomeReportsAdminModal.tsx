import React, { useState } from 'react';
import { IncomeReport, Employee, PayReceipt, SystemConfig } from '../types';
import { formatCurrencyBRL, generateIncomeReportPdf } from '../utils/incomeReportPdfGenerator';
import { SAMPLE_INCOME_REPORTS } from '../data/sampleIncomeReports';
import { sendEvolutionWhatsAppMessage, formatWhatsAppPhone } from '../services/whatsappService';
import {
  X,
  FileText,
  Upload,
  Download,
  Eye,
  Trash2,
  Share2,
  Search,
  CheckCircle2,
  AlertCircle,
  Building2,
  User,
  DollarSign,
  Sparkles,
  Calculator,
  RefreshCw,
  Calendar,
  Send,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface IncomeReportsAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  reports: IncomeReport[];
  employees: Employee[];
  receipts: PayReceipt[];
  onSaveReports: (reports: IncomeReport[]) => Promise<void>;
  onDeleteReport: (id: string) => Promise<void>;
  onDeleteReportsByYear?: (anoCalendario: string) => Promise<void>;
  onViewReport: (report: IncomeReport) => void;
  systemConfig?: SystemConfig;
}

export const IncomeReportsAdminModal: React.FC<IncomeReportsAdminModalProps> = ({
  isOpen,
  onClose,
  reports,
  employees,
  receipts,
  onSaveReports,
  onDeleteReport,
  onDeleteReportsByYear,
  onViewReport,
  systemConfig
}) => {
  const [activeTab, setActiveTab] = useState<'LIST' | 'IMPORT' | 'GENERATE'>('LIST');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('TODOS');

  // Import state
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressStatus, setProgressStatus] = useState('');
  const [useAi, setUseAi] = useState(true);
  const [importedReports, setImportedReports] = useState<IncomeReport[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Generate state
  const [generateYear, setGenerateYear] = useState<string>('2025');
  const [generateExercise, setGenerateExercise] = useState<string>('2026');

  // Delete confirmation modals state (without relying on blocked window.confirm)
  const [reportToDelete, setReportToDelete] = useState<IncomeReport | null>(null);
  const [yearToDelete, setYearToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen) return null;

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const handleConfirmDeleteIndividual = async () => {
    if (!reportToDelete) return;
    try {
      setIsDeleting(true);
      await onDeleteReport(reportToDelete.id);
      showFeedback(`Comprovante de ${reportToDelete.beneficiario.nomeCompleto} excluído com sucesso!`, 'success');
      setReportToDelete(null);
    } catch (err: any) {
      showFeedback(`Erro ao excluir comprovante: ${err?.message || 'Erro'}`, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmDeleteYear = async () => {
    if (!yearToDelete) return;
    try {
      setIsDeleting(true);
      if (onDeleteReportsByYear) {
        await onDeleteReportsByYear(yearToDelete);
      } else {
        const toDelete = reports.filter(r => r.anoCalendario === yearToDelete);
        for (const r of toDelete) {
          await onDeleteReport(r.id);
        }
      }
      showFeedback(`Todos os comprovantes do Ano-Calendário ${yearToDelete} foram excluídos com sucesso!`, 'success');
      if (selectedYear === yearToDelete) {
        setSelectedYear('TODOS');
      }
      setYearToDelete(null);
    } catch (err: any) {
      showFeedback(`Erro ao excluir comprovantes do ano: ${err?.message || 'Erro'}`, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered reports for list
  const filteredReports = reports.filter(r => {
    const matchesSearch =
      r.beneficiario.nomeCompleto.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.beneficiario.cpf.includes(searchTerm) ||
      r.beneficiario.employeeCodigo.includes(searchTerm);
    const matchesYear = selectedYear === 'TODOS' || r.anoCalendario === selectedYear;
    return matchesSearch && matchesYear;
  });

  const availableYears = Array.from(new Set(reports.map(r => r.anoCalendario))).sort().reverse();

  // Stats
  const totalRendimentos = filteredReports.reduce((acc, r) => acc + r.rendimentosTributaveis.totalRendimentos, 0);
  const totalIrrf = filteredReports.reduce((acc, r) => acc + r.rendimentosTributaveis.impostoRetidoFonte, 0);
  const total13 = filteredReports.reduce((acc, r) => acc + r.tributacaoExclusiva.decimoTerceiroSalario, 0);

  // File Upload & Parsing Handler
  const handleFileUpload = async (file: File) => {
    setIsProcessing(true);
    setProgressStatus('Lendo arquivo PDF do Comprovante de Rendimentos...');
    setImportErrors([]);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const base64 = await base64Promise;
      setProgressStatus('Processando e extraindo dados dos colaboradores...');

      const res = await fetch('/api/ai/parse-income-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64,
          useAi,
          employees: employees.map(e => ({
            codigo: e.codigo,
            nome: e.nome,
            cpf: e.cpf
          }))
        })
      });

      const data = await res.json();

      if (data.success && Array.isArray(data.reports) && data.reports.length > 0) {
        setImportedReports(data.reports);
        setProgressStatus(`Extração concluída com sucesso! ${data.reports.length} comprovantes identificados.`);
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.7 } });
        if (data.errors && data.errors.length > 0) {
          setImportErrors(data.errors);
        }
      } else {
        throw new Error(data.message || 'Nenhum comprovante de rendimentos pôde ser extraído deste arquivo.');
      }
    } catch (err: any) {
      console.error('Erro ao processar comprovante PDF:', err);
      setImportErrors([err?.message || 'Falha ao processar o arquivo. Verifique o formato do PDF.']);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCommitImported = async () => {
    if (importedReports.length === 0) return;
    try {
      setIsProcessing(true);
      setProgressStatus(`Salvando ${importedReports.length} comprovantes no banco de dados...`);
      await onSaveReports(importedReports);
      showFeedback(`${importedReports.length} Comprovantes de Rendimentos disponibilizados com sucesso no Portal!`, 'success');
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      setImportedReports([]);
      setActiveTab('LIST');
    } catch (err: any) {
      showFeedback(`Erro ao salvar comprovantes: ${err?.message || 'Erro desconhecido'}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLoadSampleDemo = async () => {
    try {
      setIsProcessing(true);
      setProgressStatus('Carregando comprovantes de demonstração dos 31 colaboradores...');
      await onSaveReports(SAMPLE_INCOME_REPORTS);
      showFeedback('31 Comprovantes de Rendimentos carregados com sucesso!', 'success');
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
      setActiveTab('LIST');
    } catch (err: any) {
      showFeedback(`Erro ao carregar demonstração: ${err?.message}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Generate Reports from Pay Receipts of the year
  const handleGenerateFromReceipts = async () => {
    try {
      setIsProcessing(true);
      setProgressStatus(`Consolidando holerites de ${generateYear}...`);

      const yearReceipts = receipts.filter(r => r.competencia.startsWith(generateYear));

      if (yearReceipts.length === 0) {
        showFeedback(`Nenhum holerite encontrado no sistema com competência do ano ${generateYear}.`, 'error');
        setIsProcessing(false);
        return;
      }

      // Group by employee
      const empGroups = new Map<string, PayReceipt[]>();
      yearReceipts.forEach(r => {
        const list = empGroups.get(r.employeeCodigo) || [];
        list.push(r);
        empGroups.set(r.employeeCodigo, list);
      });

      const generated: IncomeReport[] = [];

      empGroups.forEach((empReceipts, codigo) => {
        const emp = employees.find(e => e.codigo === codigo);
        const nomeCompleto = emp?.nome || empReceipts[0]?.empregador?.razaoSocial || `COLABORADOR ${codigo}`;
        const cpf = emp?.cpf || '000.000.000-00';

        // Separate monthly receipts from 13th
        const monthlyReceipts = empReceipts.filter(r => r.tipoFolha !== '13º Salário');
        const thirteenthReceipts = empReceipts.filter(r => r.tipoFolha === '13º Salário');

        const totalRend = monthlyReceipts.reduce((acc, r) => acc + r.totalVencimentos, 0);
        
        // Sum INSS and IRRF from items
        let inssTotal = 0;
        let irrfTotal = 0;
        monthlyReceipts.forEach(r => {
          r.itens.forEach(it => {
            const desc = it.descricao.toLowerCase();
            if (desc.includes('inss') || desc.includes('previdencia') || it.codigo === '998') {
              inssTotal += it.desconto || 0;
            } else if (desc.includes('irrf') || desc.includes('imposto de renda')) {
              irrfTotal += it.desconto || 0;
            }
          });
        });

        // 13º Salário
        const decimoSalario = thirteenthReceipts.reduce((acc, r) => acc + r.totalVencimentos, 0);
        let irrfDecimo = 0;
        thirteenthReceipts.forEach(r => {
          r.itens.forEach(it => {
            if (it.descricao.toLowerCase().includes('irrf')) {
              irrfDecimo += it.desconto || 0;
            }
          });
        });

        generated.push({
          id: `irpf-${codigo}-${generateYear}`,
          exercicio: generateExercise,
          anoCalendario: generateYear,
          fontePagadora: {
            cnpjCpf: '461.946.067-20',
            nomeEmpresarial: 'FRANCISCO JOSE BARBOSA NOBRE'
          },
          beneficiario: {
            cpf,
            nomeCompleto,
            employeeCodigo: codigo,
            naturezaRendimento: 'RENDIMENTO DO TRABALHO ASSALARIADO NO PAÍS'
          },
          rendimentosTributaveis: {
            totalRendimentos: +(totalRend.toFixed(2)),
            contribuicaoPrevidenciaria: +(inssTotal.toFixed(2)),
            previdenciaComplementar: 0,
            pensaoAlimenticia: 0,
            impostoRetidoFonte: +(irrfTotal.toFixed(2))
          },
          rendimentosIsentos: {
            parcelaIsentaAposentadoria: 0,
            parcelaIsenta13Aposentadoria: 0,
            diariasAjudaCusto: 0,
            pensaoMolestiaGrave: 0,
            lucrosDividendos: 0,
            valoresPagosSocio: 0,
            indenizacoesRescisao: 0,
            jurosMora: 0,
            outrosValor: 0
          },
          tributacaoExclusiva: {
            decimoTerceiroSalario: +(decimoSalario.toFixed(2)),
            irrfDecimoTerceiro: +(irrfDecimo.toFixed(2)),
            outros: 0
          },
          responsavel: {
            nome: 'PEDRO RAFAEL DA SILVEIRA',
            data: new Date().toLocaleDateString('pt-BR')
          },
          criadoEm: new Date().toISOString()
        });
      });

      await onSaveReports(generated);
      showFeedback(`${generated.length} Comprovantes de Rendimentos gerados com sucesso a partir dos holerites de ${generateYear}!`, 'success');
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      setActiveTab('LIST');
    } catch (err: any) {
      showFeedback(`Erro ao gerar comprovantes: ${err?.message}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendWhatsAppNotification = async (report: IncomeReport) => {
    const emp = employees.find(e => e.codigo === report.beneficiario.employeeCodigo);
    const rawPhone = emp?.telefone ? emp.telefone.replace(/\D/g, '') : '';
    const phone = formatWhatsAppPhone(rawPhone);
    const messageText = `Olá, *${report.beneficiario.nomeCompleto}*! 👋\n\nSeu *Comprovante de Rendimentos Pagos e IRRF* (Ano-Calendário ${report.anoCalendario} / Exercício ${report.exercicio}) do Cartório *FRANCISCO JOSE BARBOSA NOBRE* já está disponível para consulta e download no seu Portal do Colaborador.\n\nAcesse seu portal para visualizar e emitir o documento oficial para a Declaração de Imposto de Renda (IRPF).`;

    if (!phone) {
      showFeedback(`Colaborador ${report.beneficiario.nomeCompleto} não possui telefone / WhatsApp válido cadastrado.`, 'error');
      return;
    }

    const isEvolutionConfigured =
      Boolean(systemConfig?.evolutionApiUrl && systemConfig?.evolutionApiKey && systemConfig?.evolutionInstance);

    if (isEvolutionConfigured && systemConfig) {
      try {
        const res = await sendEvolutionWhatsAppMessage({
          config: systemConfig,
          number: phone,
          text: messageText
        });
        if (res.success) {
          showFeedback(`Notificação enviada com sucesso para ${report.beneficiario.nomeCompleto} via Evolution API!`, 'success');
        } else {
          showFeedback(`Falha no envio via Evolution API: ${res.message || 'Erro desconhecido'}.`, 'error');
        }
      } catch (e: any) {
        showFeedback(`Erro ao conectar com Evolution API: ${e?.message || 'Falha de conexão'}.`, 'error');
      }
    } else {
      showFeedback('Para envio via WhatsApp, configure a Evolution API nas Configurações do Sistema.', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600/30 text-blue-400 border border-blue-500/30 shadow-inner">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg text-white">Comprovantes de Rendimentos (IRPF)</h3>
                <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 text-[10px] font-bold rounded-full border border-blue-500/30">
                  Receita Federal
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Importação em lote de PDFs, cálculo a partir dos holerites e disponibilização para colaboradores
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Alert */}
        {feedbackMsg && (
          <div
            className={`px-4 py-2.5 text-xs font-semibold flex items-center gap-2 border-b ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            {feedbackMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="bg-slate-100 border-b border-slate-200 px-6 flex gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('LIST')}
            className={`py-3 px-4 font-bold text-xs border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'LIST'
                ? 'border-blue-600 text-blue-700 bg-white shadow-sm'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            Comprovantes Cadastrados ({reports.length})
          </button>
          <button
            onClick={() => setActiveTab('IMPORT')}
            className={`py-3 px-4 font-bold text-xs border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'IMPORT'
                ? 'border-blue-600 text-blue-700 bg-white shadow-sm'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="w-4 h-4" />
            Importar PDF (Receita Federal)
          </button>
          <button
            onClick={() => setActiveTab('GENERATE')}
            className={`py-3 px-4 font-bold text-xs border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'GENERATE'
                ? 'border-blue-600 text-blue-700 bg-white shadow-sm'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calculator className="w-4 h-4" />
            Gerar dos Holerites
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {/* TAB 1: LISTA DE COMPROVANTES */}
          {activeTab === 'LIST' && (
            <div className="space-y-5">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Total Comprovantes
                  </span>
                  <span className="text-2xl font-black text-slate-900">{filteredReports.length}</span>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Rendimentos Tributáveis
                  </span>
                  <span className="text-lg font-black text-slate-900">
                    R$ {formatCurrencyBRL(totalRendimentos)}
                  </span>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    IRRF Total Retido
                  </span>
                  <span className="text-lg font-black text-blue-700">
                    R$ {formatCurrencyBRL(totalIrrf)}
                  </span>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    13º Salário Total
                  </span>
                  <span className="text-lg font-black text-indigo-700">
                    R$ {formatCurrencyBRL(total13)}
                  </span>
                </div>
              </div>

              {/* Controls */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
                <div className="flex flex-1 items-center gap-3 w-full md:w-auto">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Buscar por colaborador, CPF ou código..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <select
                    value={selectedYear}
                    onChange={e => setSelectedYear(e.target.value)}
                    className="text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 font-semibold"
                  >
                    <option value="TODOS">Todos os Anos ({reports.length})</option>
                    {availableYears.map(yr => (
                      <option key={yr} value={yr}>
                        Ano-Calendário {yr} ({reports.filter(r => r.anoCalendario === yr).length})
                      </option>
                    ))}
                  </select>

                  {/* Botão de Excluir Ano Selecionado */}
                  {selectedYear !== 'TODOS' && reports.filter(r => r.anoCalendario === selectedYear).length > 0 && (
                    <button
                      onClick={() => setYearToDelete(selectedYear)}
                      className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0"
                      title={`Excluir todos os comprovantes do Ano-Calendário ${selectedYear}`}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      Excluir Ano {selectedYear} ({reports.filter(r => r.anoCalendario === selectedYear).length})
                    </button>
                  )}

                  {/* Botão de Excluir por Ano quando Todos os Anos está ativo */}
                  {selectedYear === 'TODOS' && availableYears.length > 0 && (
                    <button
                      onClick={() => setYearToDelete(availableYears[0])}
                      className="px-3 py-2 bg-slate-50 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-300 hover:border-rose-300 font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0"
                      title="Excluir comprovantes de um ano específico"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                      Excluir por Ano...
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                  <button
                    onClick={() => setActiveTab('IMPORT')}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Upload className="w-4 h-4" />
                    Importar PDF
                  </button>
                </div>
              </div>

              {/* Reports Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {filteredReports.length === 0 ? (
                  <div className="p-12 text-center space-y-3">
                    <FileText className="w-12 h-12 text-slate-300 mx-auto" />
                    <h4 className="font-bold text-slate-700 text-base">Nenhum comprovante encontrado</h4>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      Faça o upload do arquivo PDF oficial gerado pelo sistema de folha de pagamento para disponibilizar os comprovantes aos colaboradores.
                    </p>
                    <div className="pt-2 flex justify-center gap-3">
                      <button
                        onClick={() => setActiveTab('IMPORT')}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                      >
                        Importar PDF Oficial
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-4">Cód.</th>
                          <th className="py-3 px-4">Colaborador / CPF</th>
                          <th className="py-3 px-4">Ano-Cal. / Exerc.</th>
                          <th className="py-3 px-4 text-right">Rend. Tributáveis</th>
                          <th className="py-3 px-4 text-right">Previdência (INSS)</th>
                          <th className="py-3 px-4 text-right">IRRF Retido</th>
                          <th className="py-3 px-4 text-right">13º Salário</th>
                          <th className="py-3 px-4 text-center">Portal</th>
                          <th className="py-3 px-4 text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredReports.map(rep => (
                          <tr key={rep.id} className="hover:bg-blue-50/40 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-slate-800">
                              {rep.beneficiario.employeeCodigo}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-slate-900 block">
                                  {rep.beneficiario.nomeCompleto}
                                </span>
                                {rep.arquivoPdfOriginal && (
                                  <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-bold rounded-full" title={`Página ${rep.arquivoPdfOriginal.numeroPaginaOrigem} do PDF original`}>
                                    Pág. {rep.arquivoPdfOriginal.numeroPaginaOrigem} (PDF Original)
                                  </span>
                                )}
                              </div>
                              <span className="font-mono text-slate-500 text-[11px]">
                                {rep.beneficiario.cpf}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-semibold text-slate-800 block">
                                {rep.anoCalendario}
                              </span>
                              <span className="text-slate-500 text-[10px]">
                                Exercício {rep.exercicio}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                              R$ {formatCurrencyBRL(rep.rendimentosTributaveis.totalRendimentos)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-slate-700">
                              R$ {formatCurrencyBRL(rep.rendimentosTributaveis.contribuicaoPrevidenciaria)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-blue-700">
                              R$ {formatCurrencyBRL(rep.rendimentosTributaveis.impostoRetidoFonte)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-indigo-700 font-semibold">
                              R$ {formatCurrencyBRL(rep.tributacaoExclusiva.decimoTerceiroSalario)}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Disponível
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => onViewReport(rep)}
                                  className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                                  title="Visualizar documento oficial"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    if (rep.arquivoPdfOriginal?.base64) {
                                      const link = document.createElement('a');
                                      link.href = rep.arquivoPdfOriginal.base64;
                                      link.download = rep.arquivoPdfOriginal.nomeArquivo || `Informe_${rep.beneficiario.nomeCompleto.replace(/\s+/g, '_')}_${rep.anoCalendario}.pdf`;
                                      document.body.appendChild(link);
                                      link.click();
                                      document.body.removeChild(link);
                                    } else {
                                      const doc = generateIncomeReportPdf(rep);
                                      doc.save(`Informe_Rendimentos_${rep.beneficiario.nomeCompleto.replace(/\s+/g, '_')}_${rep.anoCalendario}.pdf`);
                                    }
                                  }}
                                  className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                                  title={rep.arquivoPdfOriginal ? "Baixar PDF Original Dividido da Página" : "Baixar PDF Oficial"}
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleSendWhatsAppNotification(rep)}
                                  className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
                                  title="Notificar colaborador via WhatsApp"
                                >
                                  <Share2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setReportToDelete(rep)}
                                  className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                                  title="Excluir comprovante deste colaborador"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: IMPORTAR PDF */}
          {activeTab === 'IMPORT' && (
            <div className="space-y-6 max-w-3xl mx-auto">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Upload e Divisão Automática do PDF de Rendimentos (IRPF)</h4>
                    <p className="text-xs text-slate-500">
                      O sistema dividirá o PDF página por página e usará IA para identificar o nome e CPF de cada colaborador no Quadro 2, disponibilizando exclusivamente o documento original correspondente a cada um.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useAi}
                      onChange={e => setUseAi(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    Inteligência Artificial (Gemini)
                  </label>
                </div>

                {/* Drag & Drop Area */}
                <label
                  onDragOver={e => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={e => {
                    e.preventDefault();
                    setIsDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                  className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${
                    isDragging
                      ? 'border-blue-500 bg-blue-50/50'
                      : 'border-slate-300 hover:border-blue-400 bg-slate-50 hover:bg-blue-50/20'
                  }`}
                >
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                    }}
                    disabled={isProcessing}
                  />
                  <div className="p-3 bg-white rounded-2xl shadow-md border border-slate-200 text-blue-600">
                    <Upload className="w-8 h-8" />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-slate-800 text-sm">
                      Clique para selecionar ou arraste o arquivo PDF aqui
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Suporta documentos multipáginas (ex: 31 colaboradores de uma só vez)
                    </p>
                  </div>
                </label>

                {/* Progress Indicator */}
                {isProcessing && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
                      <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
                      <span>{progressStatus}</span>
                    </div>
                    <div className="w-full bg-blue-200 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-blue-600 h-full w-2/3 animate-pulse" />
                    </div>
                  </div>
                )}

                {/* Errors */}
                {importErrors.length > 0 && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                      Avisos de processamento:
                    </div>
                    {importErrors.map((err, i) => (
                      <p key={i} className="pl-5">• {err}</p>
                    ))}
                  </div>
                )}
              </div>

              {/* Preview of Imported Reports */}
              {importedReports.length > 0 && (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">
                        PDF Dividido com Sucesso: {importedReports.length} Informes Individuais
                      </h4>
                      <p className="text-xs text-slate-500">
                        Cada colaborador receberá exclusivamente o PDF original da sua própria página. Confira a listagem abaixo antes de publicar no portal.
                      </p>
                    </div>
                    <button
                      onClick={handleCommitImported}
                      disabled={isProcessing}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Gravar e Disponibilizar ({importedReports.length})
                    </button>
                  </div>

                  <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700 text-[10px] font-bold uppercase sticky top-0">
                        <tr>
                          <th className="p-2.5">Cód.</th>
                          <th className="p-2.5">Nome / CPF</th>
                          <th className="p-2.5 text-right">Rendimentos</th>
                          <th className="p-2.5 text-right">INSS</th>
                          <th className="p-2.5 text-right">IRRF</th>
                          <th className="p-2.5 text-right">13º Salário</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {importedReports.map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="p-2.5 font-mono font-bold text-slate-700">
                              {r.beneficiario.employeeCodigo}
                            </td>
                            <td className="p-2.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-slate-900 block">{r.beneficiario.nomeCompleto}</span>
                                {r.arquivoPdfOriginal && (
                                  <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[9px] font-bold rounded">
                                    Pág. {r.arquivoPdfOriginal.numeroPaginaOrigem}
                                  </span>
                                )}
                              </div>
                              <span className="font-mono text-slate-500 text-[10px]">{r.beneficiario.cpf}</span>
                            </td>
                            <td className="p-2.5 text-right font-mono font-semibold">
                              R$ {formatCurrencyBRL(r.rendimentosTributaveis.totalRendimentos)}
                            </td>
                            <td className="p-2.5 text-right font-mono text-slate-600">
                              R$ {formatCurrencyBRL(r.rendimentosTributaveis.contribuicaoPrevidenciaria)}
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold text-blue-700">
                              R$ {formatCurrencyBRL(r.rendimentosTributaveis.impostoRetidoFonte)}
                            </td>
                            <td className="p-2.5 text-right font-mono text-indigo-700">
                              R$ {formatCurrencyBRL(r.tributacaoExclusiva.decimoTerceiroSalario)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: GERAR DOS HOLERITES */}
          {activeTab === 'GENERATE' && (
            <div className="space-y-6 max-w-2xl mx-auto">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-900 text-sm">
                    Geração Automática a partir dos Holerites Cadastrados
                  </h4>
                  <p className="text-xs text-slate-500">
                    O sistema consolida automaticamente os 12 meses de holerites e o 13º salário dos colaboradores cadastrados, calculando os rendimentos tributáveis, descontos oficiais de INSS e IRRF.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Ano-Calendário dos Rendimentos
                    </label>
                    <input
                      type="text"
                      value={generateYear}
                      onChange={e => setGenerateYear(e.target.value)}
                      placeholder="Ex: 2025"
                      className="w-full text-xs border border-slate-300 rounded-lg p-2.5 font-bold focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Exercício da Declaração
                    </label>
                    <input
                      type="text"
                      value={generateExercise}
                      onChange={e => setGenerateExercise(e.target.value)}
                      placeholder="Ex: 2026"
                      className="w-full text-xs border border-slate-300 rounded-lg p-2.5 font-bold focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                  <Calculator className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Como funciona a consolidação:</p>
                    <p className="text-amber-800 text-[11px] mt-0.5">
                      Serão somados todos os vencimentos tributáveis, contribuições previdenciárias e retenções de IRRF dos holerites com competência do ano {generateYear}. O 13º salário será alocado no Quadro 5 (Tributação Exclusiva).
                    </p>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleGenerateFromReceipts}
                    disabled={isProcessing}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Calculator className="w-4 h-4" />
                    Gerar e Publicar Comprovantes de {generateYear}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center shrink-0">
          <span className="text-xs text-slate-500">
            {reports.length} Comprovantes cadastrados no sistema
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-lg transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>

      {/* Modal de Confirmação: Exclusão Individual */}
      {reportToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900">Excluir Comprovante de Rendimentos</h4>
                  <p className="text-xs text-slate-500">Esta ação é irreversível e removerá o documento do sistema</p>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Colaborador:</span>
                  <strong className="text-slate-800 font-semibold">{reportToDelete.beneficiario.nomeCompleto}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">CPF / Código:</span>
                  <span className="font-mono text-slate-700">{reportToDelete.beneficiario.cpf} (Cód: {reportToDelete.beneficiario.employeeCodigo})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Ano-Calendário:</span>
                  <span className="font-bold text-blue-700">{reportToDelete.anoCalendario} (Exercício {reportToDelete.exercicio})</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1.5">
                  <span className="text-slate-500">Rendimentos Tributáveis:</span>
                  <strong className="font-mono text-slate-900">R$ {formatCurrencyBRL(reportToDelete.rendimentosTributaveis.totalRendimentos)}</strong>
                </div>
              </div>

              <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-100 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span>O colaborador não terá mais acesso a este comprovante nem ao PDF original no Portal do Colaborador.</span>
              </p>
            </div>

            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end gap-2.5">
              <button
                onClick={() => setReportToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDeleteIndividual}
                disabled={isDeleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Excluindo...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    Sim, Excluir Comprovante
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação: Exclusão em Lote por Ano */}
      {yearToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900">Excluir Comprovantes por Ano</h4>
                  <p className="text-xs text-slate-500">Remoção em lote de todos os informes do ano selecionado</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">
                  Ano-Calendário a ser excluído:
                </label>
                <select
                  value={yearToDelete}
                  onChange={e => setYearToDelete(e.target.value)}
                  disabled={isDeleting}
                  className="w-full text-xs font-bold border border-slate-300 rounded-xl p-2.5 bg-slate-50 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                >
                  {availableYears.map(yr => {
                    const count = reports.filter(r => r.anoCalendario === yr).length;
                    return (
                      <option key={yr} value={yr}>
                        Ano-Calendário {yr} ({count} comprovante{count === 1 ? '' : 's'})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  Atenção: Exclusão em Massa
                </div>
                <p>
                  Serão excluídos permanentemente todos os <strong>{reports.filter(r => r.anoCalendario === yearToDelete).length} comprovantes</strong> referentes ao ano <strong>{yearToDelete}</strong>.
                </p>
                <p className="text-[11px] text-rose-700">
                  Nenhum colaborador do cartório terá mais acesso aos informes deste ano no portal.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end gap-2.5">
              <button
                onClick={() => setYearToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDeleteYear}
                disabled={isDeleting || reports.filter(r => r.anoCalendario === yearToDelete).length === 0}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Excluindo {yearToDelete}...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    Excluir Todos de {yearToDelete} ({reports.filter(r => r.anoCalendario === yearToDelete).length})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
