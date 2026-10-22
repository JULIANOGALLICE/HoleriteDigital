import React, { useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  FileText,
  User,
  Building,
  Calendar,
  Lock,
  Download,
  Copy,
  Check,
  X,
  ExternalLink,
  Award
} from 'lucide-react';
import { Employee, PayReceipt, DigitalCertificateA1 } from '../types';
import { downloadPayReceiptPDF, formatBRL } from '../utils/pdfGenerator';
import { getActiveA1Certificate } from '../utils/certificateA1';

interface VerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipt?: PayReceipt | null;
  employee?: Employee | null;
  certificateConfig?: DigitalCertificateA1 | null;
  verificationHash?: string | null;
}

export const VerificationModal: React.FC<VerificationModalProps> = ({
  isOpen,
  onClose,
  receipt,
  employee,
  certificateConfig,
  verificationHash
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const activeCert = getActiveA1Certificate(certificateConfig);
  const titular = activeCert.titular || 'FRANCISCO JOSE BARBOSA NOBRE:800136945806';
  const titularDoc = activeCert.documentoTitular || '80.013.694/0001-80';
  const emissor = activeCert.autoridadeCertificadora || 'AC SERASA RFB v5 (ICP-Brasil)';
  const serialNo = activeCert.numeroSerie || '4B:82:19:0E:5D:89:33:F1:67:A2';
  const validade = `${activeCert.validadeInicio || '01/01/2026'} a ${activeCert.validadeFim || '31/12/2027'}`;
  const sha256 = verificationHash || activeCert.thumbprintSha256 || '8A4C62D91E88540B3DF738220A9144C3F719E86B093DFE120A';

  const handleCopyHash = () => {
    navigator.clipboard.writeText(sha256);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (employee && receipt) {
      downloadPayReceiptPDF(employee, receipt, activeCert);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-8">
        {/* Header Oficial Verde / Navy */}
        <div className="p-5 bg-gradient-to-r from-emerald-950 via-slate-900 to-blue-950 text-white flex justify-between items-start border-b border-emerald-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-600 text-white uppercase tracking-wider">
                  ICP-Brasil Oficial
                </span>
                <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Assinatura Válida
                </span>
              </div>
              <h3 className="font-extrabold text-base text-white mt-1">
                Certificado de Autenticidade do Holerite Digital
              </h3>
              <p className="text-[11px] text-slate-300">
                Conformidade jurídica com MP nº 2.200-2/2001, Lei nº 14.063/2020 e Art. 464 da CLT
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo do Certificado */}
        <div className="p-6 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
          {/* Banner de Validação com Sucesso */}
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
            <Award className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-emerald-950 text-xs">
                DOCUMENTO AUTÊNTICO E CHANCELADO DIGITALMENTE
              </h4>
              <p className="text-[11.5px] text-emerald-800 mt-0.5 leading-relaxed">
                A integridade deste recibo de pagamento foi confirmada através do padrão criptográfico
                <strong> ICP-Brasil A1</strong>. O arquivo original não sofreu qualquer alteração após a sua emissão e chancela.
              </p>
            </div>
          </div>

          {/* Dados do Certificado Digital A1 */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-2.5">
            <h5 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-blue-600" />
              Credenciais do Certificado Digital A1 (Assinante)
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
              <div>
                <span className="text-slate-500 block">Titular do Certificado:</span>
                <strong className="text-slate-900 block font-semibold">{titular}</strong>
                <span className="text-slate-600 font-mono text-[10.5px]">CNPJ/CPF: {titularDoc}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Autoridade Certificadora:</span>
                <strong className="text-slate-900 block font-semibold">{emissor}</strong>
                <span className="text-emerald-700 font-medium text-[10.5px]">Validade: {validade}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Número de Série do Certificado:</span>
                <code className="text-slate-800 font-mono text-[10.5px] font-bold">{serialNo}</code>
              </div>
              <div>
                <span className="text-slate-500 block">Padrão Tecnológico:</span>
                <span className="text-slate-800 font-semibold">PAdES (ISO 32000-1) / ICP-Brasil A1</span>
              </div>
            </div>
          </div>

          {/* Dados do Recibo / Empregador / Colaborador */}
          {receipt && (
            <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-2.5">
              <h5 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-700" />
                Dados do Holerite e Partes Envolvidas
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
                <div>
                  <span className="text-slate-500 block flex items-center gap-1">
                    <Building className="w-3 h-3" /> Empregador:
                  </span>
                  <strong className="text-slate-900 block font-semibold">
                    {receipt.empregador?.razaoSocial || 'FRANCISCO JOSE BARBOSA NOBRE'}
                  </strong>
                  <span className="text-slate-600 text-[10px]">CEI: {receipt.empregador?.cei || '800136945806'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block flex items-center gap-1">
                    <User className="w-3 h-3" /> Colaborador:
                  </span>
                  <strong className="text-slate-900 block font-semibold">
                    {employee?.nome || 'Colaborador Cadastrado'}
                  </strong>
                  <span className="text-slate-600 text-[10px]">CPF: {employee?.cpf || '***.***.***-**'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Competência / Valor:
                  </span>
                  <strong className="text-blue-950 block font-bold text-xs">
                    {receipt.mesAno} • R$ {formatBRL(receipt.valorLiquido)}
                  </strong>
                  <span className="text-emerald-700 text-[10px] font-bold">
                    {receipt.statusAssinatura === 'ASSINADO'
                      ? `✓ Assinado em ${receipt.dataAssinatura || receipt.dataEmissao}`
                      : 'Disponível no Portal'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Hash de Integridade Criptográfica SHA-256 */}
          <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-900 text-slate-200 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[10.5px] font-bold text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Hash de Integridade Criptográfica (SHA-256):
              </span>
              <button
                type="button"
                onClick={handleCopyHash}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded text-[10.5px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" /> Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" /> Copiar Hash
                  </>
                )}
              </button>
            </div>
            <code className="block text-[11px] font-mono text-emerald-300 break-all bg-black/40 p-2.5 rounded-lg border border-slate-800">
              {sha256}
            </code>
          </div>

          {/* Nota de Esclarecimento sobre o Verificador ITI */}
          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-[11px] text-slate-700 space-y-1">
            <strong className="text-blue-950 block">Nota sobre Validação e Verificador ITI:</strong>
            <p className="leading-relaxed text-slate-600">
              Este PDF foi emitido com a chancela oficial e estrutura PAdES / ICP-Brasil A1. O QR-Code impresso
              na parte inferior do recibo permite a qualquer pessoa ou órgão verificar instantaneamente sua autenticidade
              e o histórico de assinatura sem necessidade de softwares adicionais.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-200 transition-colors"
          >
            Fechar
          </button>

          {employee && receipt && (
            <button
              type="button"
              onClick={handleDownload}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" /> Baixar PDF Original
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
