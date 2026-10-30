import React, { useState } from 'react';
import { parsePayrollText, ParsedRecord } from '../utils/pdfParser';
import { extractPdfText } from '../utils/pdfExtractor';
import { SAMPLE_RAW_OCR } from '../data/sampleRawOCR';
import { formatBRL } from '../utils/pdfGenerator';
import { Employee, PayReceipt, SystemConfig } from '../types';
import {
  safeParseApiResponse,
  parseAndAuditPayrollDirectBrowser
} from '../services/geminiBrowserFallback';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  UserPlus,
  RefreshCw,
  Sparkles,
  X,
  Database,
  ChevronDown,
  ChevronUp,
  FileCheck,
  Bot,
  Zap,
  Info,
  Settings
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface FileProcessorModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingEmployees: Employee[];
  onCommitParsedData: (newEmployees: Employee[], newReceipts: PayReceipt[]) => void;
  systemConfig?: SystemConfig;
  onOpenAiSettings?: () => void;
}

export const FileProcessorModal: React.FC<FileProcessorModalProps> = ({
  isOpen,
  onClose,
  existingEmployees,
  onCommitParsedData,
  systemConfig,
  onOpenAiSettings
}) => {
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressStatus, setProgressStatus] = useState<string>('Processando...');
  const [useAi, setUseAi] = useState<boolean>(systemConfig?.aiEnabled !== false);
  const [engineUsed, setEngineUsed] = useState<'gemini' | 'local' | null>(null);
  const [aiExecutionMeta, setAiExecutionMeta] = useState<{ modelUsed?: string; durationMs?: number } | null>(null);
  const [aiMissingKeyError, setAiMissingKeyError] = useState<boolean>(false);
  const [parsedRecords, setParsedRecords] = useState<ParsedRecord[]>([]);
  const [parsingErrors, setParsingErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rawExtractedText, setRawExtractedText] = useState<string>('');
  const [showRawText, setShowRawText] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  React.useEffect(() => {
    if (isOpen && systemConfig?.aiEnabled !== undefined) {
      setUseAi(systemConfig.aiEnabled !== false);
    }
  }, [isOpen, systemConfig?.aiEnabled]);

  if (!isOpen) return null;

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  const handleProcessTextLocal = (textToParse: string, name = 'Arquivo da Folha.pdf', keepExistingErrors = false) => {
    setIsProcessing(true);
    setProgressStatus('Processando dados localmente...');
    setFileName(name);
    setRawExtractedText(textToParse);
    setEngineUsed('local');
    setAiExecutionMeta(null);
    setTimeout(() => {
      const result = parsePayrollText(textToParse);
      setParsedRecords(result.records);
      if (!keepExistingErrors) {
        setParsingErrors(result.errors);
      } else if (result.errors.length > 0) {
        setParsingErrors(prev => [...prev, ...result.errors]);
      }
      setIsProcessing(false);
    }, 200);
  };

  const processWithAi = async (payload: { base64?: string; text?: string }, name: string) => {
    setIsProcessing(true);
    setFileName(name);
    setEngineUsed('gemini');
    setAiExecutionMeta(null);
    setAiMissingKeyError(false);
    setProgressStatus('IA (Google Gemini) analisando e auditando todas as páginas do documento...');

    try {
      const res = await fetch('/api/ai/parse-payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          geminiApiKey: systemConfig?.geminiApiKey || '',
          aiModel: systemConfig?.aiModel || 'gemini-3.8-flash'
        })
      });

      const parsedRes = await safeParseApiResponse(res);

      // Se a VPS retornou <!doctype html> (ex: Nginx servindo estático), executa a auditoria IA direto pelo navegador!
      let data = parsedRes.data;
      if (parsedRes.isHtmlFallback || !data) {
        const textForBrowserAi = payload.text || rawExtractedText;
        if (textForBrowserAi) {
          data = await parseAndAuditPayrollDirectBrowser(
            textForBrowserAi,
            systemConfig?.geminiApiKey || '',
            systemConfig?.aiModel || 'gemini-3.8-flash'
          );
        }
      }

      if (data && data.success && Array.isArray(data.records) && data.records.length > 0) {
        setParsedRecords(data.records);
        setParsingErrors([]);
        setEngineUsed('gemini');
        setAiExecutionMeta({
          modelUsed: data.aiModelUsed || systemConfig?.aiModel || 'gemini-3.8-flash',
          durationMs: data.aiDurationMs
        });
        setIsProcessing(false);
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 } });
        return;
      }

      if (data?.code === 'MISSING_API_KEY' || data?.code === 'AI_AUTH_ERROR') {
        setAiMissingKeyError(true);
      }

      throw new Error(data?.message || 'A IA não retornou registros válidos.');
    } catch (err: any) {
      console.warn('Falha no processador IA, acionando fallback local:', err);
      setParsingErrors([
        `${err?.message || 'IA indisponível no momento'}. Foi utilizado o leitor local de contingência.`
      ]);

      // Fallback para extrator local mantendo o aviso de erro da IA visível
      if (payload.text) {
        handleProcessTextLocal(payload.text, name, true);
      } else if (payload.base64) {
        try {
          const res = await fetch('/api/extract-pdf-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64: payload.base64 })
          });
          const d = await res.json();
          if (d.text) {
            handleProcessTextLocal(d.text, name, true);
            return;
          }
        } catch (e) {}
        setIsProcessing(false);
      } else {
        setIsProcessing(false);
      }
    }
  };

  const resetModalState = () => {
    setParsedRecords([]);
    setParsingErrors([]);
    setFileName(null);
    setInputText('');
    setRawExtractedText('');
    setShowRawText(false);
    setIsProcessing(false);
    setAiExecutionMeta(null);
    setAiMissingKeyError(false);
  };

  const handleCloseModal = () => {
    resetModalState();
    onClose();
  };

  const processSelectedFile = async (file: File) => {
    setFileName(file.name);
    setParsingErrors([]);
    setParsedRecords([]);
    setRawExtractedText('');

    const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';

    if (isPdf) {
      setIsProcessing(true);
      setProgressStatus('Carregando e preparando leitura do PDF...');

      try {
        const base64 = await fileToBase64(file);
        let extractedPdfText = '';
        try {
          const res = await extractPdfText(file, (msg) => setProgressStatus(msg));
          extractedPdfText = res.text;
          setRawExtractedText(extractedPdfText);
        } catch (e) {
          console.warn('Extração preliminar de texto no cliente falhou, enviando para o servidor:', e);
        }

        if (useAi) {
          await processWithAi({ base64, text: extractedPdfText }, file.name);
        } else {
          // Extração local
          if (extractedPdfText) {
            setProgressStatus('Estruturando dados dos colaboradores...');
            handleProcessTextLocal(extractedPdfText, file.name);
          } else {
            const { text, pagesCount } = await extractPdfText(file, (msg) => setProgressStatus(msg));
            setProgressStatus(`Leitura local concluída (${pagesCount} páginas). Estruturando dados...`);
            handleProcessTextLocal(text, file.name);
          }
        }
      } catch (err: any) {
        console.error('Erro ao ler PDF:', err);
        setIsProcessing(false);
        setParsingErrors([
          `Erro ao processar PDF "${file.name}": ${err?.message || 'Arquivo corrompido ou formato não suportado'}`
        ]);
      }
    } else {
      // Arquivos de texto (.txt, .csv, .json)
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content) {
          if (useAi) {
            processWithAi({ text: content }, file.name);
          } else {
            handleProcessTextLocal(content, file.name);
          }
        }
      };
      reader.onerror = () => {
        setParsingErrors([`Erro ao ler o arquivo de texto "${file.name}".`]);
      };
      reader.readAsText(file);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const handleLoadDemoOCR = () => {
    setInputText(SAMPLE_RAW_OCR.trim());
    if (useAi) {
      processWithAi({ text: SAMPLE_RAW_OCR }, 'Folha_Mensal_Setembro_2026_Cartorio.pdf');
    } else {
      handleProcessTextLocal(SAMPLE_RAW_OCR, 'Folha_Mensal_Setembro_2026_Cartorio.pdf');
    }
  };

  const handleConfirmImport = () => {
    const newOrUpdatedEmployees: Employee[] = [];
    const newReceipts: PayReceipt[] = [];

    parsedRecords.forEach(record => {
      const recCode = String(record.employee.codigo).trim();
      const existing = existingEmployees.find(e => String(e.codigo).trim() === recCode);
      if (existing) {
        newOrUpdatedEmployees.push({
          ...existing,
          codigo: recCode,
          nome: record.employee.nome || existing.nome,
          cbo: record.employee.cbo || existing.cbo,
          departamento: record.employee.departamento || existing.departamento,
          filial: record.employee.filial || existing.filial,
          salarioBase: record.employee.salarioBase || existing.salarioBase,
          dataAdmissao: record.employee.dataAdmissao || existing.dataAdmissao,
          cargo: record.employee.cargo || existing.cargo
        });
      } else {
        const newEmp: Employee = {
          codigo: recCode,
          nome: record.employee.nome,
          cbo: record.employee.cbo || '',
          cargo: record.employee.cargo || 'COLABORADOR',
          departamento: record.employee.departamento || 'GERAL',
          filial: record.employee.filial || '1',
          dataAdmissao: record.employee.dataAdmissao || '',
          salarioBase: record.employee.salarioBase || 0,
          cpf: record.employee.cpf || '',
          email: record.employee.email || '',
          telefone: record.employee.telefone || '',
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
        };
        newOrUpdatedEmployees.push(newEmp);
      }

      newReceipts.push({
        ...record.receipt,
        employeeCodigo: recCode
      });
    });

    onCommitParsedData(newOrUpdatedEmployees, newReceipts);
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    handleCloseModal();
  };

  const newCount = parsedRecords.filter(r => !existingEmployees.some(e => String(e.codigo).trim() === String(r.employee.codigo).trim())).length;
  const updateCount = parsedRecords.length - newCount;
  const totalNet = parsedRecords.reduce((acc, r) => acc + r.receipt.valorLiquido, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-5 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600/30 text-blue-400 border border-blue-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg text-white">Processador Inteligente de Folha de Pagamento</h3>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-2 py-0.5 rounded-full shadow-sm">
                  <Bot className="w-3 h-3" /> IA Integrada
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Lê PDFs multipáginas (ex: 31 holerites) e extrai com 100% de fidelidade todos os colaboradores, proventos e descontos
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Mode Selector (AI vs Fast Local) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center gap-2 flex-wrap">
              <Bot className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-semibold text-slate-800">Motor de Extração:</span>
              {onOpenAiSettings && (
                <button
                  type="button"
                  onClick={onOpenAiSettings}
                  className="text-[11px] text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  title="Configurar Chave da API do Google Gemini no Banco de Dados / VPS"
                >
                  <Settings className="w-3 h-3" />
                  Configurar Chave IA (VPS)
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5 bg-slate-200/80 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setUseAi(true)}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                  useAi
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Inteligência Artificial (Recomendado)
              </button>
              <button
                type="button"
                onClick={() => setUseAi(false)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                  !useAi
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                Leitura Rápida Local
              </button>
            </div>
          </div>

          {/* Upload Area */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* File Dropzone */}
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl transition-all cursor-pointer text-center ${
                isDragging
                  ? 'border-blue-600 bg-blue-50/80 scale-[1.01]'
                  : 'border-slate-300 hover:border-blue-500 hover:bg-blue-50/40 bg-slate-50/50'
              }`}
            >
              <UploadCloud className={`w-8 h-8 mb-2 ${isDragging ? 'text-blue-700 animate-bounce' : 'text-blue-600'}`} />
              <span className="font-semibold text-xs text-slate-800">
                Arraste ou clique para selecionar PDF da Folha
              </span>
              <span className="text-[11px] text-slate-500 mt-1">
                Suporta PDFs multipáginas com 31 holerites, espelhos e relatórios
              </span>
              {fileName && (
                <div className="mt-3 flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-md text-[11px] text-slate-700 font-medium">
                  <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span className="truncate max-w-[200px]">{fileName}</span>
                </div>
              )}
              <input
                type="file"
                accept=".pdf,.txt,.csv,.json"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            {/* Paste Box */}
            <div className="flex flex-col">
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-semibold text-slate-700">Ou Cole o Texto / OCR da Folha:</label>
                {inputText && (
                  <button
                    onClick={() => {
                      setInputText('');
                      setParsedRecords([]);
                      setRawExtractedText('');
                    }}
                    className="text-[11px] text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    Limpar
                  </button>
                )}
              </div>
              <textarea
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  if (e.target.value.length > 50) {
                    if (useAi) {
                      processWithAi({ text: e.target.value }, 'Texto_Colado.txt');
                    } else {
                      handleProcessTextLocal(e.target.value, 'Texto_Colado.txt');
                    }
                  }
                }}
                placeholder="Cole aqui o texto ou OCR contendo: Código, Nome, Folha Mensal, Admissão, Salário Base, Vencimentos..."
                className="w-full h-28 text-[11px] p-2.5 font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Processing Indicator */}
          {isProcessing && (
            <div className="py-8 bg-blue-50/60 border border-blue-200/80 rounded-xl flex flex-col items-center justify-center gap-3 text-slate-700 animate-in fade-in shadow-inner">
              <div className="relative">
                <RefreshCw className="w-9 h-9 text-blue-600 animate-spin" />
                <Sparkles className="w-4 h-4 text-amber-500 absolute -top-1 -right-1 animate-pulse" />
              </div>
              <div className="text-center px-4">
                <p className="text-sm font-bold text-slate-900">{progressStatus}</p>
                <p className="text-xs text-slate-500 mt-1 max-w-md">
                  Processando todas as páginas da folha, auditando cada colaborador, cálculos de INSS, FGTS, IRRF e valores líquidos...
                </p>
              </div>
            </div>
          )}

          {/* Parsed Results Preview */}
          {!isProcessing && parsedRecords.length > 0 && (
            <div className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-500 block">Total de Holerites</span>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="font-bold text-xl text-slate-900">{parsedRecords.length}</span>
                    {engineUsed === 'gemini' ? (
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                        IA Gemini {aiExecutionMeta?.durationMs ? `(${(aiExecutionMeta.durationMs / 1000).toFixed(1)}s)` : '100%'}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                        Leitor Local
                      </span>
                    )}
                  </div>
                </div>
                <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                  <span className="text-[11px] text-emerald-700 block">Novos Cadastros</span>
                  <span className="font-bold text-xl text-emerald-900 flex items-center gap-1 mt-0.5">
                    <UserPlus className="w-4 h-4 text-emerald-600" /> +{newCount}
                  </span>
                </div>
                <div className="bg-blue-50 p-3 rounded-xl border border-blue-200">
                  <span className="text-[11px] text-blue-700 block">Competência</span>
                  <span className="font-bold text-sm text-blue-900 mt-1.5 block">
                    {parsedRecords[0]?.receipt.mesAno || 'Setembro de 2026'}
                  </span>
                </div>
                <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-200">
                  <span className="text-[11px] text-indigo-700 block">Total Folha Líquida</span>
                  <span className="font-bold text-sm text-indigo-950 mt-1.5 block">
                    R$ {formatBRL(totalNet)}
                  </span>
                </div>
              </div>

              {/* Table of Parsed Data */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Cód.</th>
                        <th className="py-2.5 px-3">Nome do Colaborador</th>
                        <th className="py-2.5 px-3">Admissão</th>
                        <th className="py-2.5 px-3">Salário Base</th>
                        <th className="py-2.5 px-3 text-center">Rubricas</th>
                        <th className="py-2.5 px-3 text-right">Valor Líquido</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parsedRecords.map((item, idx) => {
                        const isExisting = existingEmployees.some(e => e.codigo === item.employee.codigo);
                        return (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2 px-3">
                              {isExisting ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                                  Cadastrado
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                                  <UserPlus className="w-3 h-3" /> Novo
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 font-mono font-bold text-slate-900">{item.employee.codigo}</td>
                            <td className="py-2 px-3 font-semibold text-slate-900">
                              {item.employee.nome}
                              <span className="block text-[10.5px] font-normal text-slate-500">
                                {item.employee.cargo} • CBO {item.employee.cbo}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-slate-600">{item.employee.dataAdmissao}</td>
                            <td className="py-2 px-3 font-mono text-slate-800">
                              R$ {formatBRL(item.employee.salarioBase)}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span className="text-[11px] font-mono px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md">
                                {item.receipt.itens.length} itens
                              </span>
                            </td>
                            <td className="py-2 px-3 font-mono font-bold text-right text-blue-900">
                              R$ {formatBRL(item.receipt.valorLiquido)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Empty state when file was uploaded but no records recognized */}
          {!isProcessing && parsedRecords.length === 0 && fileName && (
            <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 text-xs text-amber-900">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-amber-950">
                    Nenhum holerite reconhecido no arquivo selecionado
                  </h4>
                  <p className="mt-1 text-amber-800 leading-relaxed">
                    Você pode tentar com o modo de IA ativado ou inspecionar o texto bruto do documento.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setShowRawText(!showRawText)}
                      className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 font-semibold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      {showRawText ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      {showRawText ? 'Ocultar Texto' : 'Inspecionar Texto Extraído'}
                    </button>
                    <button
                      type="button"
                      onClick={handleLoadDemoOCR}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Carregar Folha Modelo (31 Colaboradores)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Collapsible raw extracted text inspector */}
          {rawExtractedText && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowRawText(!showRawText)}
                className="w-full px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center justify-between border-b border-slate-200 cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-slate-500" />
                  Texto do Documento ({rawExtractedText.length} caracteres)
                </span>
                {showRawText ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showRawText && (
                <pre className="p-3 bg-slate-900 text-slate-100 text-[10px] font-mono max-h-48 overflow-y-auto whitespace-pre-wrap selection:bg-blue-600 selection:text-white">
                  {rawExtractedText}
                </pre>
              )}
            </div>
          )}

          {parsingErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 text-xs text-red-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Avisos durante a leitura:</strong>
                  <ul className="list-disc list-inside mt-1 text-[11px] text-red-700">
                    {parsingErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              </div>
              {aiMissingKeyError && onOpenAiSettings && (
                <button
                  type="button"
                  onClick={onOpenAiSettings}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
                >
                  <Settings className="w-3.5 h-3.5" />
                  Configurar Chave da API da IA
                </button>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-slate-600 hover:text-slate-900 font-medium text-xs hover:bg-slate-200 transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            disabled={parsedRecords.length === 0 || isProcessing}
            onClick={handleConfirmImport}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            Confirmar e Importar {parsedRecords.length} Holerites
          </button>
        </div>
      </div>
    </div>
  );
};
