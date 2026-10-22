import React, { useState } from 'react';
import { Employee, PayReceipt, SystemConfig } from '../types';
import { formatBRL } from '../utils/pdfGenerator';
import { createSignatureVerificationCode, validateSignatureCode } from '../services/firestoreService';
import { dispatchRealEmail } from '../services/emailService';
import { sendEvolutionWhatsAppMessage } from '../services/whatsappService';
import {
  X,
  ShieldCheck,
  Share2,
  Mail,
  KeyRound,
  CheckCircle2,
  Clock,
  AlertCircle,
  Lock,
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface DigitalSignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee;
  receipt: PayReceipt;
  systemConfig: SystemConfig;
  onSignatureSuccess: (receiptId: string, code: string, canal: 'WHATSAPP' | 'EMAIL') => void;
}

export const DigitalSignatureModal: React.FC<DigitalSignatureModalProps> = ({
  isOpen,
  onClose,
  employee,
  receipt,
  systemConfig,
  onSignatureSuccess
}) => {
  const [step, setStep] = useState<'SELECT_CHANNEL' | 'ENTER_CODE' | 'SUCCESS'>('SELECT_CHANNEL');
  const [selectedChannel, setSelectedChannel] = useState<'WHATSAPP' | 'EMAIL'>(
    systemConfig.canalAssinaturaPadrao === 'EMAIL' ? 'EMAIL' : 'WHATSAPP'
  );
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [generatedCodePreview, setGeneratedCodePreview] = useState<string | null>(null);
  const [emailDeliveryNotice, setEmailDeliveryNotice] = useState<{
    success: boolean;
    message: string;
    previewUrl?: string;
  } | null>(null);
  const [enteredCode, setEnteredCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSendCode = async () => {
    setIsSendingCode(true);
    setErrorMessage(null);
    setEmailDeliveryNotice(null);

    try {
      const targetDestination = selectedChannel === 'WHATSAPP' ? employee.telefone : employee.email;

      if (selectedChannel === 'EMAIL' && !employee.email) {
        setIsSendingCode(false);
        setErrorMessage('Colaborador não possui e-mail cadastrado. Selecione a opção WhatsApp.');
        return;
      }

      if (selectedChannel === 'WHATSAPP' && !employee.telefone) {
        setIsSendingCode(false);
        setErrorMessage('Colaborador não possui telefone cadastrado. Selecione a opção E-mail.');
        return;
      }

      const code = await createSignatureVerificationCode(
        receipt.id,
        employee.codigo,
        selectedChannel,
        targetDestination
      );

      setGeneratedCodePreview(code);

      // Channel 1: WhatsApp (Evolution API or direct link)
      if (selectedChannel === 'WHATSAPP') {
        const rawPhone = employee.telefone.replace(/\D/g, '');
        const fullPhone = rawPhone.startsWith('55') ? rawPhone : `55${rawPhone}`;
        const msg = `🔐 *CÓDIGO DE ASSINATURA DIGITAL - HOLERITEDIGITAL*\nOlá, *${employee.nome.split(' ')[0]}*!\n\nSeu código de autenticação para assinar o holerite de *${receipt.mesAno}* é:\n👉 *${code}*\n\nInsira este código na tela para concluir sua assinatura com validade jurídica CLT.`;
        const waUrl = `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`;

        const isEvolutionConfigured =
          systemConfig.whatsappProvider === 'EVOLUTION_API' &&
          Boolean(systemConfig.evolutionApiUrl && systemConfig.evolutionApiKey && systemConfig.evolutionInstance);

        if (isEvolutionConfigured) {
          try {
            const evoResult = await sendEvolutionWhatsAppMessage({
              config: systemConfig,
              number: fullPhone,
              text: msg
            });

            if (evoResult.success) {
              setEmailDeliveryNotice({
                success: true,
                message: `Código 2FA enviado com sucesso para ${employee.telefone} via Evolution API.`
              });
            } else {
              window.open(waUrl, '_blank');
              setEmailDeliveryNotice({
                success: false,
                message: `Evolution API indisponível (${evoResult.message}). Abrimos o WhatsApp Web para envio manual.`
              });
            }
          } catch (e: any) {
            window.open(waUrl, '_blank');
          }
        } else {
          window.open(waUrl, '_blank');
        }
      }

      // Channel 2: Email Real Dispatch
      if (selectedChannel === 'EMAIL') {
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden;">
            <div style="background-color: #0f172a; padding: 20px; text-align: center; color: #ffffff;">
              <h2 style="margin: 0; font-size: 18px;">HoleriteDigital • Validação 2FA</h2>
              <p style="margin: 4px 0 0; font-size: 12px; color: #94a3b8;">Código de Assinatura Eletrônica do Recibo</p>
            </div>
            <div style="padding: 24px; color: #334155; text-align: center;">
              <p style="font-size: 14px; margin-bottom: 8px;">Olá, <strong>${employee.nome}</strong>!</p>
              <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
                Você solicitou o código de segurança para assinar digitalmente o recibo de pagamento referente a <strong>${receipt.mesAno}</strong> (Valor Líquido: <strong>R$ ${formatBRL(receipt.valorLiquido)}</strong>).
              </p>
              <div style="margin: 24px auto; display: inline-block; background-color: #eff6ff; border: 2px dashed #2563eb; border-radius: 12px; padding: 16px 36px; font-size: 28px; font-weight: 900; letter-spacing: 0.35em; color: #1e3a8a;">
                ${code}
              </div>
              <p style="font-size: 12px; color: #64748b; margin-top: 16px;">
                Digite este código de 6 dígitos no portal para formalizar sua ciência e quitação com validade jurídica (CLT Art. 464).
              </p>
            </div>
            <div style="background-color: #f8fafc; padding: 12px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0;">
              Mensagem confidencial enviada pelo Departamento Pessoal do Cartório.
            </div>
          </div>
        `;

        const res = await dispatchRealEmail(
          systemConfig,
          employee.email,
          `🔐 [Código 2FA] Assinatura do Holerite ${receipt.mesAno} - ${code}`,
          emailHtml,
          `Seu código de assinatura do holerite de ${receipt.mesAno} é: ${code}`
        );

        if (res.success) {
          setEmailDeliveryNotice({
            success: true,
            message: `Código enviado com sucesso para ${employee.email}!`,
            previewUrl: res.previewUrl
          });
        } else {
          setEmailDeliveryNotice({
            success: false,
            message: `Não foi possível entregar o e-mail (${res.message}). Por favor, verifique as configurações ou tente via WhatsApp.`
          });
        }
      }

      setIsSendingCode(false);
      setStep('ENTER_CODE');
    } catch (err: any) {
      setIsSendingCode(false);
      setErrorMessage('Erro ao gerar código de segurança. Tente novamente.');
    }
  };

  const handleVerifyCode = async () => {
    if (enteredCode.length < 6) {
      setErrorMessage('Digite o código de 6 dígitos completo.');
      return;
    }

    setIsValidating(true);
    setErrorMessage(null);

    try {
      const isValid = await validateSignatureCode(receipt.id, enteredCode);
      if (isValid || enteredCode === generatedCodePreview) {
        setIsValidating(false);
        setStep('SUCCESS');
        confetti({ particleCount: 90, spread: 60, origin: { y: 0.6 } });
        setTimeout(() => {
          onSignatureSuccess(receipt.id, enteredCode, selectedChannel);
          onClose();
        }, 1500);
      } else {
        setIsValidating(false);
        setErrorMessage('Código inválido ou expirado. Verifique os 6 dígitos digitados.');
      }
    } catch (err: any) {
      setIsValidating(false);
      setErrorMessage('Erro na validação do código.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-600/30 text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Assinatura Digital com Validação 2FA</h3>
              <p className="text-[11px] text-slate-400">
                Segurança com autenticação por código temporário
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

        {/* Body */}
        <div className="p-6 space-y-4 text-xs">
          {/* Paystub Summary Card */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
            <div className="flex justify-between items-center text-slate-600 text-[11px]">
              <span>Competência:</span>
              <strong className="text-slate-900 font-bold">{receipt.mesAno}</strong>
            </div>
            <div className="flex justify-between items-center text-slate-600 text-[11px]">
              <span>Colaborador:</span>
              <span className="text-slate-900 font-semibold">{employee.nome}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 text-[11px] border-t border-slate-200 pt-1.5">
              <span>Valor Líquido:</span>
              <span className="font-extrabold text-blue-950 text-sm">
                R$ {formatBRL(receipt.valorLiquido)}
              </span>
            </div>
          </div>

          {/* Legal statement */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-900 flex items-start gap-2">
            <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <strong>Declaração de Recebimento (CLT Art. 464):</strong>
              <p className="mt-0.5 text-amber-800">
                "Declaro ter recebido a importância líquida discriminada neste recibo de pagamento."
              </p>
            </div>
          </div>

          {/* Step 1: Select Channel */}
          {step === 'SELECT_CHANNEL' && (
            <div className="space-y-3 pt-2">
              <label className="block font-bold text-slate-800 text-xs">
                Como deseja receber o código de segurança para assinar?
              </label>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedChannel('WHATSAPP')}
                  className={`p-3.5 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                    selectedChannel === 'WHATSAPP'
                      ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-600/20'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                    <Share2 className="w-4 h-4 text-emerald-600" /> WhatsApp
                  </div>
                  <span className="text-[11px] text-slate-500 truncate">{employee.telefone || 'Sem telefone'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedChannel('EMAIL')}
                  className={`p-3.5 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                    selectedChannel === 'EMAIL'
                      ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-600/20'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-blue-800">
                    <Mail className="w-4 h-4 text-blue-600" /> E-mail
                  </div>
                  <span className="text-[11px] text-slate-500 truncate">{employee.email || 'Sem e-mail'}</span>
                </button>
              </div>

              {errorMessage && (
                <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-[11px] flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {errorMessage}
                </div>
              )}

              <button
                disabled={isSendingCode}
                onClick={handleSendCode}
                className="w-full mt-2 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:bg-slate-300"
              >
                {isSendingCode ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin" /> Gerando & Enviando Código...
                  </>
                ) : (
                  <>
                    Enviar Código de Assinatura <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          )}

          {/* Step 2: Enter Code */}
          {step === 'ENTER_CODE' && (
            <div className="space-y-4 pt-2">
              <div className="text-center space-y-1">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-slate-900 text-sm">Digite o Código de 6 Dígitos</h4>
                <p className="text-[11px] text-slate-500">
                  {selectedChannel === 'WHATSAPP'
                    ? `Enviamos a mensagem com o código para o WhatsApp ${employee.telefone}.`
                    : `Enviamos o código para o e-mail ${employee.email}.`}
                </p>

                {/* Email Delivery Feedback */}
                {emailDeliveryNotice && (
                  emailDeliveryNotice.success ? (
                    <div className="mt-2 p-2 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-800 text-[11px] flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{emailDeliveryNotice.message}</span>
                      {emailDeliveryNotice.previewUrl && (
                        <a
                          href={emailDeliveryNotice.previewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="underline font-bold text-blue-700 ml-1 inline-flex items-center gap-0.5"
                        >
                          Ver Caixa de Teste <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  ) : (
                    <div className="mt-2 p-2 bg-amber-50 rounded-lg border border-amber-200 text-amber-800 text-[11px] text-left">
                      ⚠️ <strong>Aviso de Entrega:</strong> {emailDeliveryNotice.message}
                    </div>
                  )
                )}
              </div>

              <div>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={enteredCode}
                  onChange={(e) => setEnteredCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full py-3.5 text-center font-mono text-2xl tracking-[0.4em] font-extrabold border-2 border-blue-500 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 bg-slate-50/50 min-h-[48px]"
                  autoFocus
                />
              </div>

              {errorMessage && (
                <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-[11px] flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {errorMessage}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep('SELECT_CHANNEL')}
                  className="w-1/3 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer min-h-[44px]"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  disabled={isValidating || enteredCode.length < 6}
                  onClick={handleVerifyCode}
                  className="w-2/3 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
                >
                  {isValidating ? (
                    <>
                      <Clock className="w-4 h-4 animate-spin" /> Validando...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" /> Confirmar e Assinar
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Success */}
          {step === 'SUCCESS' && (
            <div className="py-8 text-center space-y-3">
              <CheckCircle2 className="w-16 h-16 text-emerald-600 mx-auto animate-bounce" />
              <h4 className="font-extrabold text-base text-slate-900">
                Holerite Assinado com Sucesso!
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Sua assinatura foi validada e registrada digitalmente com carimbo de tempo e certificado de ciência.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
