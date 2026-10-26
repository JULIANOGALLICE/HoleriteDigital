import React, { useState, useEffect } from 'react';
import { Employee, PayReceipt, SystemConfig } from '../types';
import { formatBRL } from '../utils/pdfGenerator';
import {
  createWhatsAppMessage,
  createSignatureReminderWhatsAppMessage,
  createSignatureReminderEmailTemplate,
  createEmailTemplate
} from '../utils/notifications';
import {
  X,
  Share2,
  Mail,
  CheckCircle2,
  Clock,
  ExternalLink,
  Users,
  Copy,
  Send,
  AlertCircle,
  Smartphone,
  Radio,
  Settings,
  RefreshCw,
  FileText,
  Lock,
  BellRing,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { dispatchRealEmail } from '../services/emailService';
import { generatePayReceiptPDF, generateSignedPayReceiptBase64 } from '../utils/pdfGenerator';
import {
  sendEvolutionWhatsAppMessage,
  formatWhatsAppPhone,
  renderWhatsAppTemplate
} from '../services/whatsappService';
import { recordWhatsAppDispatchEvent, recordEmailDispatchEvent } from '../services/loggerService';

interface BatchDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'WHATSAPP' | 'EMAIL';
  month: string;
  employees: Employee[];
  receipts: PayReceipt[];
  systemConfig: SystemConfig;
  onBatchCompleted: (type: 'WHATSAPP' | 'EMAIL', count: number) => void;
  onOpenSettings?: () => void;
  onlyUnsigned?: boolean;
  isReminder?: boolean;
}

export const BatchDispatchModal: React.FC<BatchDispatchModalProps> = ({
  isOpen,
  onClose,
  type,
  month,
  employees,
  receipts,
  systemConfig,
  onBatchCompleted,
  onOpenSettings,
  onlyUnsigned = false,
  isReminder = false
}) => {
  const [filterOnlyUnsigned, setFilterOnlyUnsigned] = useState<boolean>(onlyUnsigned);
  const [isReminderMode, setIsReminderMode] = useState<boolean>(isReminder);
  const [isProcessing, setIsProcessing] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState(0);
  const [currentProgressIndex, setCurrentProgressIndex] = useState<number>(0);
  const [itemStatuses, setItemStatuses] = useState<Record<string, 'idle' | 'sending' | 'sent' | 'failed'>>({});
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setFilterOnlyUnsigned(onlyUnsigned);
      setIsReminderMode(isReminder);
      setCompleted(false);
      setBatchError(null);
      setSuccessCount(0);
      setItemStatuses({});
      setItemErrors({});
    }
  }, [isOpen, onlyUnsigned, isReminder]);

  if (!isOpen) return null;

  const isEvolutionConfigured =
    systemConfig.whatsappProvider === 'EVOLUTION_API' &&
    Boolean(systemConfig.evolutionApiUrl && systemConfig.evolutionApiKey && systemConfig.evolutionInstance);

  // Match employees with receipts in this month
  const rawTargets = employees
    .map(emp => {
      const receipt = receipts.find(r => r.employeeCodigo === emp.codigo && r.mesAno === month);
      return { emp, receipt };
    })
    .filter(item => item.receipt !== undefined) as Array<{ emp: Employee; receipt: PayReceipt }>;

  const pendingSignaturesTotal = rawTargets.filter(item => item.receipt.statusAssinatura !== 'ASSINADO').length;

  const targets = filterOnlyUnsigned
    ? rawTargets.filter(item => item.receipt.statusAssinatura !== 'ASSINADO')
    : rawTargets;

  const targetsWithEmail = targets.filter(t => Boolean(t.emp.email));
  const targetsWithPhone = targets.filter(t => Boolean(t.emp.telefone && t.emp.telefone.trim() !== ''));

  const activeIsReminder = isReminderMode || filterOnlyUnsigned;

  // Disparo em Lote por WhatsApp via Evolution API
  const handleExecuteBatchWhatsApp = async () => {
    if (targetsWithPhone.length === 0) {
      setBatchError('Nenhum colaborador elegível para este envio possui telefone/WhatsApp cadastrado.');
      return;
    }

    setIsProcessing(true);
    setBatchError(null);
    let sent = 0;
    let failed = 0;
    let lastErrorMsg = '';

    for (let i = 0; i < targetsWithPhone.length; i++) {
      const { emp, receipt } = targetsWithPhone[i];
      setCurrentProgressIndex(i + 1);
      setItemStatuses(prev => ({ ...prev, [emp.codigo]: 'sending' }));

      const phone = formatWhatsAppPhone(emp.telefone);
      const text = activeIsReminder
        ? createSignatureReminderWhatsAppMessage(emp, receipt)
        : (systemConfig.mensagemWhatsappPadrao
            ? renderWhatsAppTemplate(systemConfig.mensagemWhatsappPadrao, emp, receipt)
            : createWhatsAppMessage(emp, receipt));

      let pdfBase64: string | undefined;
      // REGRA CLT Art. 464: No lembrete de assinatura pendente, NUNCA enviar o PDF do holerite anexado!
      // O PDF fica bloqueado até o colaborador realizar a assinatura no portal.
      if (!activeIsReminder && systemConfig.enviarPdfAutomaticoWhatsapp !== false) {
        try {
          pdfBase64 = await generateSignedPayReceiptBase64(emp, receipt, systemConfig?.certificadoA1);
        } catch (e) {
          try {
            const doc = generatePayReceiptPDF(emp, receipt, systemConfig?.certificadoA1);
            pdfBase64 = doc.output('datauristring');
          } catch {}
        }
      }

      const fileName = `Holerite_${receipt.mesAno.replace(/[^a-zA-Z0-9]/g, '_')}_${emp.codigo}.pdf`;

      try {
        const res = await sendEvolutionWhatsAppMessage({
          config: systemConfig,
          number: phone,
          text,
          media: pdfBase64,
          fileName,
          caption: activeIsReminder
            ? `🔔 Lembrete de Assinatura Digital de Holerite - ${receipt.mesAno} - ${emp.nome}`
            : `📄 Holerite de Pagamento - ${receipt.mesAno} - ${emp.nome}`
        });

        if (res.success) {
          sent++;
          setItemStatuses(prev => ({ ...prev, [emp.codigo]: 'sent' }));
          recordWhatsAppDispatchEvent(emp, receipt, {
            phone,
            success: true,
            isReminder: activeIsReminder
          }).catch(() => {});
        } else {
          failed++;
          lastErrorMsg = res.message || 'Falha no envio';
          setItemStatuses(prev => ({ ...prev, [emp.codigo]: 'failed' }));
          setItemErrors(prev => ({ ...prev, [emp.codigo]: res.message || 'Erro' }));
          recordWhatsAppDispatchEvent(emp, receipt, {
            phone,
            success: false,
            isReminder: activeIsReminder,
            errorMsg: res.message
          }).catch(() => {});
        }
      } catch (err: any) {
        failed++;
        lastErrorMsg = err?.message || 'Erro ao contatar Evolution API';
        setItemStatuses(prev => ({ ...prev, [emp.codigo]: 'failed' }));
        setItemErrors(prev => ({ ...prev, [emp.codigo]: err?.message || 'Erro de conexão' }));
        recordWhatsAppDispatchEvent(emp, receipt, {
          phone,
          success: false,
          isReminder: activeIsReminder,
          errorMsg: err?.message
        }).catch(() => {});
      }

      // Pequena pausa entre envios para evitar taxa de limite da Evolution API
      await new Promise(r => setTimeout(r, 800));
    }

    setIsProcessing(false);
    setSuccessCount(sent);

    if (sent > 0 && failed === 0) {
      setCompleted(true);
      onBatchCompleted('WHATSAPP', sent);
      try {
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
      } catch {}
    } else if (sent > 0 && failed > 0) {
      setCompleted(true);
      onBatchCompleted('WHATSAPP', sent);
      setBatchError(`Disparo parcial: ${sent} mensagens enviadas, mas ${failed} apresentaram falha. Detalhe: ${lastErrorMsg}`);
    } else {
      setBatchError(lastErrorMsg || 'Falha no disparo via Evolution API. Verifique a conexão nas configurações.');
    }
  };

  // Envio individual via Evolution API
  const handleSendSingleWhatsApp = async (emp: Employee, receipt: PayReceipt) => {
    setItemStatuses(prev => ({ ...prev, [emp.codigo]: 'sending' }));
    setItemErrors(prev => {
      const copy = { ...prev };
      delete copy[emp.codigo];
      return copy;
    });

    const phone = formatWhatsAppPhone(emp.telefone);
    const text = activeIsReminder
      ? createSignatureReminderWhatsAppMessage(emp, receipt)
      : (systemConfig.mensagemWhatsappPadrao
          ? renderWhatsAppTemplate(systemConfig.mensagemWhatsappPadrao, emp, receipt)
          : createWhatsAppMessage(emp, receipt));

    let pdfBase64: string | undefined;
    if (!activeIsReminder && systemConfig.enviarPdfAutomaticoWhatsapp !== false) {
      try {
        pdfBase64 = await generateSignedPayReceiptBase64(emp, receipt, systemConfig?.certificadoA1);
      } catch (e) {
        try {
          const doc = generatePayReceiptPDF(emp, receipt, systemConfig?.certificadoA1);
          pdfBase64 = doc.output('datauristring');
        } catch {}
      }
    }

    const fileName = `Holerite_${receipt.mesAno.replace(/[^a-zA-Z0-9]/g, '_')}_${emp.codigo}.pdf`;

    try {
      const res = await sendEvolutionWhatsAppMessage({
        config: systemConfig,
        number: phone,
        text,
        media: pdfBase64,
        fileName,
        caption: activeIsReminder
          ? `🔔 Lembrete de Assinatura - ${receipt.mesAno} - ${emp.nome}`
          : `📄 Holerite de Pagamento - ${receipt.mesAno} - ${emp.nome}`
      });

      if (res.success) {
        setItemStatuses(prev => ({ ...prev, [emp.codigo]: 'sent' }));
        recordWhatsAppDispatchEvent(emp, receipt, {
          phone,
          success: true,
          isReminder: activeIsReminder
        }).catch(() => {});
      } else {
        setItemStatuses(prev => ({ ...prev, [emp.codigo]: 'failed' }));
        setItemErrors(prev => ({ ...prev, [emp.codigo]: res.message || 'Falha' }));
        recordWhatsAppDispatchEvent(emp, receipt, {
          phone,
          success: false,
          isReminder: activeIsReminder,
          errorMsg: res.message
        }).catch(() => {});
      }
    } catch (err: any) {
      setItemStatuses(prev => ({ ...prev, [emp.codigo]: 'failed' }));
      setItemErrors(prev => ({ ...prev, [emp.codigo]: err?.message || 'Erro de rede' }));
      recordWhatsAppDispatchEvent(emp, receipt, {
        phone,
        success: false,
        isReminder: activeIsReminder,
        errorMsg: err?.message
      }).catch(() => {});
    }
  };

  const handleExecuteBatchEmail = async () => {
    if (targetsWithEmail.length === 0) {
      setBatchError('Nenhum colaborador elegível para este envio possui e-mail cadastrado. Edite o cadastro dos funcionários antes de disparar.');
      return;
    }

    setIsProcessing(true);
    setBatchError(null);
    let sent = 0;
    let failed = 0;
    let lastErrorMsg = '';

    for (let i = 0; i < targetsWithEmail.length; i++) {
      const { emp, receipt } = targetsWithEmail[i];
      setCurrentProgressIndex(i + 1);

      const template = activeIsReminder
        ? createSignatureReminderEmailTemplate(emp, receipt)
        : createEmailTemplate(emp, receipt);

      let pdfBase64: string | undefined;
      // Bloqueio CLT Art. 464: Em lembretes de assinatura, NÃO anexa o PDF!
      if (!activeIsReminder) {
        try {
          pdfBase64 = await generateSignedPayReceiptBase64(emp, receipt, systemConfig?.certificadoA1);
        } catch (e) {
          try {
            const doc = generatePayReceiptPDF(emp, receipt, systemConfig?.certificadoA1);
            pdfBase64 = doc.output('datauristring');
          } catch {}
        }
      }

      const res = await dispatchRealEmail(
        systemConfig,
        emp.email,
        template.assunto,
        template.html,
        undefined,
        pdfBase64,
        pdfBase64 ? `Holerite_${emp.codigo}.pdf` : undefined
      );

      if (res.success) {
        sent++;
        recordEmailDispatchEvent(emp, receipt, {
          email: emp.email,
          success: true,
          isReminder: activeIsReminder
        }).catch(() => {});
      } else {
        failed++;
        lastErrorMsg = res.message + (res.details ? ` (${res.details})` : '');
        recordEmailDispatchEvent(emp, receipt, {
          email: emp.email,
          success: false,
          isReminder: activeIsReminder,
          errorMsg: lastErrorMsg
        }).catch(() => {});
      }

      await new Promise(r => setTimeout(r, 600));
    }

    setIsProcessing(false);
    setSuccessCount(sent);

    if (sent > 0 && failed === 0) {
      setCompleted(true);
      onBatchCompleted('EMAIL', sent);
      try {
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
      } catch {}
    } else if (sent > 0 && failed > 0) {
      setCompleted(true);
      onBatchCompleted('EMAIL', sent);
      setBatchError(`Envio parcial: ${sent} e-mails enviados com sucesso, mas ${failed} apresentaram falha. Erro: ${lastErrorMsg}`);
    } else {
      setBatchError(lastErrorMsg || 'Falha no envio de e-mails. Verifique as configurações do servidor SMTP.');
    }
  };

  const handleCopyMessage = (emp: Employee, receipt: PayReceipt, idx: number) => {
    const text = activeIsReminder
      ? createSignatureReminderWhatsAppMessage(emp, receipt)
      : (systemConfig.mensagemWhatsappPadrao
          ? renderWhatsAppTemplate(systemConfig.mensagemWhatsappPadrao, emp, receipt)
          : createWhatsAppMessage(emp, receipt));
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[92vh]">
        {/* Header */}
        <div className={`p-4 sm:p-5 text-white flex justify-between items-center border-b ${
          activeIsReminder ? 'bg-amber-950 border-amber-900' : 'bg-slate-900 border-slate-800'
        }`}>
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className={`p-2 sm:p-2.5 rounded-xl shrink-0 ${
              activeIsReminder
                ? 'bg-amber-600/30 text-amber-300'
                : type === 'WHATSAPP'
                  ? 'bg-emerald-600/30 text-emerald-400'
                  : 'bg-blue-600/30 text-blue-400'
            }`}>
              {activeIsReminder ? (
                <BellRing className="w-5 h-5 text-amber-300" />
              ) : type === 'WHATSAPP' ? (
                <Share2 className="w-5 h-5" />
              ) : (
                <Mail className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">
                  {activeIsReminder
                    ? type === 'WHATSAPP'
                      ? 'Lembrete em Lote por WhatsApp (Assinaturas Pendentes)'
                      : 'Lembrete em Lote por E-mail (Assinaturas Pendentes)'
                    : type === 'WHATSAPP'
                      ? 'Disparo em Lote por WhatsApp'
                      : 'Disparo em Lote por E-mail'}
                </h3>
                {type === 'WHATSAPP' && isEvolutionConfigured && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                    <Radio className="w-3 h-3 text-emerald-400" /> Evolution API Ativa
                  </span>
                )}
                {activeIsReminder && (
                  <span className="text-[10px] bg-amber-500/30 text-amber-200 font-bold px-2 py-0.5 rounded-full border border-amber-400/40 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Cobrança de Assinatura
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300">
                Competência: <strong className="text-white">{month}</strong> • {targets.length} destinatários selecionados (
                {type === 'WHATSAPP' ? `${targetsWithPhone.length} com telefone` : `${targetsWithEmail.length} com e-mail`})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Switcher Toolbar */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">Filtro de Destinatários:</span>
            <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 shadow-xs">
              <button
                type="button"
                onClick={() => {
                  setFilterOnlyUnsigned(false);
                  setIsReminderMode(false);
                }}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  !filterOnlyUnsigned
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Todos os Holerites ({rawTargets.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilterOnlyUnsigned(true);
                  setIsReminderMode(true);
                }}
                className={`px-3 py-1 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                  filterOnlyUnsigned
                    ? 'bg-amber-600 text-white shadow-xs font-bold'
                    : 'text-amber-800 hover:bg-amber-50'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                Apenas Pendentes de Assinatura ({pendingSignaturesTotal})
              </button>
            </div>
          </div>

          {activeIsReminder ? (
            <div className="flex items-center gap-1.5 text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 font-semibold text-[11px]">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Download do PDF bloqueado até a assinatura do recibo (Art. 464 CLT)</span>
            </div>
          ) : (
            <span className="text-slate-500 text-[11px]">
              {pendingSignaturesTotal > 0
                ? `${pendingSignaturesTotal} de ${rawTargets.length} holerites ainda não foram assinados.`
                : 'Todos os holerites deste mês já estão assinados!'}
            </span>
          )}
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Active Reminder Warning Callout */}
          {activeIsReminder && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-amber-950 flex items-start gap-3">
              <Lock className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <h4 className="font-bold text-xs flex items-center gap-1.5">
                  Lembrete Formal de Assinatura Digital Obrigatória
                </h4>
                <p className="text-[11px] text-amber-900 mt-0.5 leading-relaxed">
                  Esta mensagem reforça que, conforme as exigências da CLT e compliance do Cartório/Empresa, 
                  <strong> o colaborador deve assinar digitalmente seu holerite para liberar o download oficial em PDF</strong>. 
                  O arquivo PDF <em>não</em> é enviado como anexo neste lembrete para assegurar a obrigatoriedade da assinatura prévia.
                </p>
              </div>
            </div>
          )}

          {type === 'WHATSAPP' ? (
            <div className="space-y-4">
              {/* Status Banner */}
              {isEvolutionConfigured ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-emerald-950 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <Smartphone className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="font-bold text-xs flex items-center gap-1.5">
                        <span>Disparo Automático Integrado à Evolution API</span>
                        <span className="text-[10px] font-mono bg-emerald-200/70 text-emerald-900 px-1.5 py-0.2 rounded">
                          {systemConfig.evolutionInstance}
                        </span>
                      </h4>
                      <p className="text-[11px] text-emerald-800 mt-0.5 leading-relaxed">
                        {activeIsReminder ? (
                          <>O sistema enviará o <strong>texto de lembrete com link direto de assinatura</strong> ao WhatsApp de cada colaborador com recibo pendente.</>
                        ) : (
                          <>
                            O sistema enviará o comunicado oficial de pagamento
                            {systemConfig.enviarPdfAutomaticoWhatsapp !== false ? ' juntamente com o holerite em PDF anexado' : ''} diretamente ao WhatsApp de cada colaborador.
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  {onOpenSettings && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenSettings();
                      }}
                      className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 underline shrink-0 cursor-pointer flex items-center gap-1"
                    >
                      <Settings className="w-3.5 h-3.5" /> Ajustar API
                    </button>
                  )}
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-amber-950 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="font-bold text-xs">Evolution API não configurada</h4>
                      <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                        Para realizar disparos pelo WhatsApp, configure os parâmetros de conexão com a sua <strong>Evolution API</strong> na aba <em>WhatsApp & Evolution API</em> das Configurações do Gestor.
                      </p>
                    </div>
                  </div>
                  {onOpenSettings && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenSettings();
                      }}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shrink-0 cursor-pointer shadow-xs transition-colors"
                    >
                      Configurar API
                    </button>
                  )}
                </div>
              )}

              {/* Progress bar during batch */}
              {isProcessing && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 animate-in fade-in">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                      Enviando {currentProgressIndex} de {targetsWithPhone.length}...
                    </span>
                    <span className="font-mono text-slate-500 font-semibold">
                      {Math.round((currentProgressIndex / (targetsWithPhone.length || 1)) * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-emerald-600 h-2 transition-all duration-300 rounded-full"
                      style={{ width: `${(currentProgressIndex / (targetsWithPhone.length || 1)) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {batchError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold">Aviso no Disparo:</strong>
                    <span>{batchError}</span>
                  </div>
                </div>
              )}

              {completed && successCount > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center text-emerald-900 space-y-2">
                  <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-600" />
                  <h4 className="font-bold text-sm">
                    {activeIsReminder ? 'Lembretes de Assinatura Disparados!' : 'Disparo pelo WhatsApp Concluído!'}
                  </h4>
                  <p className="text-xs text-emerald-700">
                    Foram enviados com sucesso <strong>{successCount}</strong> comunicados via Evolution API para a competência {month}.
                  </p>
                </div>
              )}

              {/* Targets List */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {targets.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
                    <p className="font-bold text-slate-700">Nenhum colaborador nesta lista!</p>
                    <p className="text-xs text-slate-500">
                      {filterOnlyUnsigned ? 'Todos os colaboradores já assinaram seus holerites.' : 'Nenhum holerite emitido nesta competência.'}
                    </p>
                  </div>
                ) : (
                  targets.map(({ emp, receipt }, idx) => {
                    const status = itemStatuses[emp.codigo];
                    const error = itemErrors[emp.codigo];
                    const isSigned = receipt.statusAssinatura === 'ASSINADO';

                    return (
                      <div key={emp.codigo} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-slate-50 gap-2.5">
                        <div>
                          <div className="font-bold text-slate-900 text-xs flex items-center gap-2 flex-wrap">
                            <span>#{emp.codigo} - {emp.nome}</span>
                            {isSigned ? (
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded-md flex items-center gap-0.5">
                                <ShieldCheck className="w-3 h-3 text-emerald-600" /> Assinado
                              </span>
                            ) : (
                              <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded-md flex items-center gap-0.5">
                                <Lock className="w-3 h-3 text-amber-600" /> Pendente
                              </span>
                            )}
                            {status === 'sent' && (
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded-md flex items-center gap-0.5">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Enviado
                              </span>
                            )}
                            {status === 'sending' && (
                              <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded-md flex items-center gap-0.5">
                                <RefreshCw className="w-3 h-3 animate-spin text-amber-600" /> Enviando...
                              </span>
                            )}
                            {status === 'failed' && (
                              <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-1.5 py-0.2 rounded-md flex items-center gap-0.5" title={error}>
                                <AlertCircle className="w-3 h-3 text-rose-600" /> Falha ({error})
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                            <span>{emp.telefone || 'Sem telefone'}</span>
                            <span>•</span>
                            <span className="font-semibold text-emerald-700">Líquido: R$ {formatBRL(receipt.valorLiquido)}</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 self-end sm:self-auto">
                          <button
                            onClick={() => handleCopyMessage(emp, receipt, idx)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                            title="Copiar mensagem personalizada"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            {copiedIndex === idx ? 'Copiado!' : 'Copiar'}
                          </button>

                          {/* Botão de envio exclusivo via Evolution API */}
                          {isEvolutionConfigured ? (
                            <button
                              disabled={!emp.telefone || isProcessing || status === 'sending'}
                              onClick={() => handleSendSingleWhatsApp(emp, receipt)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-[11px] font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                              title="Disparar via Evolution API"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>{status === 'sent' ? 'Reenviar' : activeIsReminder ? 'Lembrete API' : 'Enviar API'}</span>
                            </button>
                          ) : (
                            onOpenSettings && (
                              <button
                                onClick={() => {
                                  onClose();
                                  onOpenSettings();
                                }}
                                className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                                title="Configurar Evolution API"
                              >
                                <Settings className="w-3.5 h-3.5 text-amber-600" />
                                <span>Configurar API</span>
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className={`p-3 rounded-xl flex items-start gap-2.5 ${
                activeIsReminder ? 'bg-amber-50 border border-amber-200 text-amber-950' : 'bg-blue-50 border border-blue-200 text-blue-950'
              }`}>
                <Mail className={`w-4 h-4 mt-0.5 shrink-0 ${activeIsReminder ? 'text-amber-600' : 'text-blue-600'}`} />
                <div>
                  <h4 className="font-bold text-xs">
                    {activeIsReminder
                      ? 'Disparo em Lote de Lembretes de Assinatura por E-mail'
                      : 'Envio Automatizado de Todos os Holerites em PDF'}
                  </h4>
                  <p className="text-[11px] mt-0.5 leading-relaxed">
                    {activeIsReminder ? (
                      <>
                        O sistema enviará um e-mail formal com alerta urgente e botão de acesso direto para todos os colaboradores que ainda <strong>não assinaram o holerite de {month}</strong>. O PDF oficial permanecerá bloqueado até que o colaborador entre no portal e confirme a assinatura digital com 2FA.
                      </>
                    ) : (
                      <>
                        O sistema disparará um e-mail formal via servidor <strong>{systemConfig.emailProvider || 'SMTP'}</strong> com o holerite oficial anexado em PDF e link de acesso para todos os colaboradores da competência {month}.
                      </>
                    )}
                  </p>
                </div>
              </div>

              {batchError && (
                <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-rose-950 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold text-rose-900">Atenção no Disparo em Lote:</strong>
                    <p className="mt-0.5 text-rose-800">{batchError}</p>
                  </div>
                </div>
              )}

              {completed && successCount > 0 ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center text-emerald-900 space-y-2">
                  <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-600" />
                  <h4 className="font-bold text-sm">Disparo em Lote Realizado com Sucesso!</h4>
                  <p className="text-xs text-emerald-700">
                    Foram entregues com sucesso {successCount} e-mails para a competência {month}.
                  </p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-2">
                  <div className="flex justify-between items-center text-xs font-semibold text-slate-700">
                    <span>
                      {activeIsReminder
                        ? 'Colaboradores com assinatura pendente e e-mail cadastrado'
                        : 'Colaboradores com e-mail cadastrado'}
                    </span>
                    <span className="font-bold text-slate-900">{targetsWithEmail.length} destinatários</span>
                  </div>
                  <div className="max-h-52 overflow-y-auto divide-y divide-slate-200 text-[11px] text-slate-600">
                    {targetsWithEmail.length === 0 ? (
                      <div className="py-4 text-center text-slate-400">
                        Nenhum colaborador elegível possui e-mail cadastrado no sistema.
                      </div>
                    ) : (
                      targetsWithEmail.slice(0, 15).map(({ emp, receipt }) => (
                        <div key={emp.codigo} className="py-1.5 flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-900">{emp.nome}</span>
                            {receipt.statusAssinatura !== 'ASSINADO' && (
                              <span className="text-[10px] bg-amber-100 text-amber-800 font-semibold px-1.5 py-0.2 rounded">
                                Não assinado
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-slate-500">{emp.email}</span>
                        </div>
                      ))
                    )}
                    {targetsWithEmail.length > 15 && (
                      <div className="py-1 text-center text-slate-400 italic">
                        + {targetsWithEmail.length - 15} outros colaboradores
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-col-reverse sm:flex-row sm:justify-between items-stretch sm:items-center gap-2">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-slate-600 hover:text-slate-900 font-semibold text-xs hover:bg-slate-200 transition-colors cursor-pointer text-center min-h-[40px] flex items-center justify-center"
          >
            {completed ? 'Concluir' : 'Cancelar'}
          </button>

          {/* Botão de Disparo em Lote para WhatsApp via Evolution API */}
          {type === 'WHATSAPP' && !completed && isEvolutionConfigured && (
            <button
              disabled={isProcessing || targetsWithPhone.length === 0}
              onClick={handleExecuteBatchWhatsApp}
              className={`w-full sm:w-auto px-5 py-2.5 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:bg-slate-300 min-h-[44px] ${
                activeIsReminder ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {isProcessing ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  Disparando via Evolution API...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  {activeIsReminder
                    ? `Disparar Lembretes WhatsApp (${targetsWithPhone.length})`
                    : `Iniciar Disparo para ${targetsWithPhone.length} Colaboradores`}
                </>
              )}
            </button>
          )}

          {/* Botão de Disparo em Lote para E-mail */}
          {type === 'EMAIL' && !completed && (
            <button
              disabled={isProcessing || targetsWithEmail.length === 0}
              onClick={handleExecuteBatchEmail}
              className={`w-full sm:w-auto px-5 py-2.5 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:bg-slate-300 min-h-[44px] ${
                activeIsReminder ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isProcessing ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  Processando Disparo em Lote...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  {activeIsReminder
                    ? `Disparar Lembretes por E-mail (${targetsWithEmail.length})`
                    : `Confirmar Envio para ${targetsWithEmail.length} Colaboradores`}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
