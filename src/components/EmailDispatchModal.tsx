import React, { useState } from 'react';
import { Employee, PayReceipt, SystemConfig } from '../types';
import { createEmailTemplate } from '../utils/notifications';
import { dispatchRealEmail, EmailTestResult } from '../services/emailService';
import { generatePayReceiptPDF, generateSignedPayReceiptBase64 } from '../utils/pdfGenerator';
import { X, Mail, Send, CheckCircle2, Clock, AlertCircle, Settings, ExternalLink } from 'lucide-react';
import confetti from 'canvas-confetti';

interface EmailDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
  receipt: PayReceipt | null;
  systemConfig: SystemConfig;
  onConfirmSend: (employeeCodigo: string, receiptId: string, email: string) => void;
  onOpenSettings?: () => void;
}

export const EmailDispatchModal: React.FC<EmailDispatchModalProps> = ({
  isOpen,
  onClose,
  employee,
  receipt,
  systemConfig,
  onConfirmSend,
  onOpenSettings
}) => {
  const initialTemplate = employee && receipt ? createEmailTemplate(employee, receipt) : { assunto: '', html: '' };
  const [recipientEmail, setRecipientEmail] = useState(employee?.email || '');
  const [subject, setSubject] = useState(initialTemplate.assunto);
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sendError, setSendError] = useState<EmailTestResult | null>(null);

  if (!isOpen || !employee || !receipt) return null;

  const handleSend = async () => {
    setIsSending(true);
    setSendError(null);
    setPreviewUrl(null);

    try {
      // 1. Generate digitally signed PDF attachment in base64
      let pdfBase64: string | undefined;
      const filename = `Holerite_${employee.nome.replace(/\s+/g, '_')}_${receipt.mesAno.replace(/\s+/g, '_')}.pdf`;
      try {
        pdfBase64 = await generateSignedPayReceiptBase64(employee, receipt, systemConfig?.certificadoA1);
      } catch (pdfErr) {
        console.warn('Fallback gerando PDF direto:', pdfErr);
        const doc = generatePayReceiptPDF(employee, receipt, systemConfig?.certificadoA1);
        pdfBase64 = doc.output('datauristring');
      }

      // 2. Dispatch via real server endpoint
      const result = await dispatchRealEmail(
        systemConfig,
        recipientEmail,
        subject,
        initialTemplate.html,
        undefined,
        pdfBase64,
        filename
      );

      setIsSending(false);

      if (result.success) {
        setIsSent(true);
        if (result.previewUrl) {
          setPreviewUrl(result.previewUrl);
        }
        onConfirmSend(employee.codigo, receipt.id, recipientEmail);
        confetti({ particleCount: 60, spread: 50, origin: { y: 0.6 } });
        setTimeout(() => {
          if (!result.previewUrl) {
            setIsSent(false);
            onClose();
          }
        }, 1800);
      } else {
        setSendError(result);
      }
    } catch (err: any) {
      setIsSending(false);
      setSendError({
        success: false,
        message: 'Erro inesperado na comunicação com o servidor de e-mail.',
        details: err?.message
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-600/30 text-blue-400">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Disparo Oficial de Holerite por E-mail</h3>
              <p className="text-xs text-slate-400">
                Envio com anexo oficial em PDF via {systemConfig.emailProvider || 'SMTP'} ({systemConfig.smtpHost || 'Gmail'})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Destinatário</label>
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="email@colaborador.com"
              required
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Assunto</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-600 font-semibold mb-1.5 flex items-center justify-between">
              <span>Pré-visualização do E-mail Formatado</span>
              <span className="text-[11px] text-slate-400 font-normal">
                Anexo: Holerite_{employee.codigo}.pdf
              </span>
            </label>
            <div
              className="border border-slate-300 rounded-xl p-4 bg-slate-50 max-h-56 overflow-y-auto"
              dangerouslySetInnerHTML={{ __html: initialTemplate.html }}
            />
          </div>

          {/* Test server preview link if available */}
          {previewUrl && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs flex items-center justify-between">
              <span>Visualizar e-mail entregue na caixa de testes:</span>
              <a
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1 bg-blue-600 text-white rounded-lg font-bold flex items-center gap-1 text-[11px]"
              >
                Abrir Visualização <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

          {/* Diagnostic Error Banner */}
          {sendError && (
            <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-rose-950 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1.5 flex-1">
                <strong className="block font-bold text-rose-900">Falha ao Disparar E-mail:</strong>
                <p className="text-rose-800 font-medium">{sendError.message}</p>
                {sendError.details && (
                  <p className="text-rose-700 text-[11px] bg-white/80 p-2.5 rounded-lg border border-rose-200">
                    💡 <strong>Como resolver:</strong> {sendError.details}
                  </p>
                )}
                {sendError.rawError && (
                  <div className="p-2 bg-slate-900 text-rose-300 font-mono text-[10.5px] rounded-lg border border-slate-700 break-all">
                    <strong className="text-white block mb-0.5">Resposta do Servidor:</strong>
                    {sendError.rawError}
                  </div>
                )}
                {sendError.code && (
                  <span className="text-[10px] font-mono text-rose-600 block">
                    Código de Erro Técnico: {sendError.code}
                  </span>
                )}
                {onOpenSettings && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenSettings();
                    }}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5 text-blue-400" />
                    Abrir Configurações de E-mail (SMTP)
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-slate-600 hover:text-slate-900 font-medium text-xs hover:bg-slate-200 transition-colors cursor-pointer"
          >
            {isSent ? 'Fechar' : 'Cancelar'}
          </button>

          <button
            disabled={isSending || isSent || !recipientEmail}
            onClick={handleSend}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
          >
            {isSent ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                E-mail Enviado com Sucesso!
              </>
            ) : isSending ? (
              <>
                <Clock className="w-4 h-4 animate-spin" />
                Conectando ao Servidor SMTP...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Disparar Holerite por E-mail
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
