import React, { useState } from 'react';
import { Employee, PayReceipt, DigitalCertificateA1 } from '../types';
import { formatBRL, downloadPayReceiptPDF } from '../utils/pdfGenerator';
import { getDefaultA1Certificate, getActiveA1Certificate } from '../utils/certificateA1';
import {
  Download,
  CheckCircle,
  FileText,
  ShieldCheck,
  Mail,
  Award,
  FileBadge,
  Lock,
  AlertCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface ReceiptViewerProps {
  employee: Employee;
  receipt: PayReceipt;
  onSignReceipt?: (receiptId: string) => void;
  onTriggerDigitalSignature?: (receipt: PayReceipt) => void;
  onOpenEmailModal?: (employee: Employee, receipt: PayReceipt) => void;
  isAdmin?: boolean;
  canSign?: boolean;
  employerName?: string;
  certificateConfig?: DigitalCertificateA1 | null;
}

export const ReceiptViewer: React.FC<ReceiptViewerProps> = ({
  employee,
  receipt,
  onSignReceipt,
  onTriggerDigitalSignature,
  onOpenEmailModal,
  isAdmin = false,
  canSign = true,
  employerName,
  certificateConfig
}) => {
  const [downloadBlockedNotice, setDownloadBlockedNotice] = useState<string | null>(null);
  const isSigned = receipt.statusAssinatura === 'ASSINADO';
  const allowSign = !isAdmin && canSign;

  // Active A1 certificate resolution
  const activeCert = getActiveA1Certificate(certificateConfig);

  const handleSign = () => {
    if (!allowSign) return;
    if (onTriggerDigitalSignature) {
      onTriggerDigitalSignature(receipt);
    } else if (onSignReceipt) {
      onSignReceipt(receipt.id);
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7 }
      });
    }
  };

  const renderSingleSlip = (copyType: 'EMPREGADOR' | 'EMPREGADO') => {
    return (
      <div className="relative border-2 border-slate-700 bg-white font-mono text-[11px] leading-tight text-slate-900 shadow-sm transition-all print:border-black print:shadow-none mb-6">
        {/* Slip Tag */}
        <div className="absolute -top-3 left-4 z-10 bg-slate-800 text-white text-[10px] px-3 py-0.5 rounded-full font-sans tracking-wide uppercase font-semibold print:hidden flex items-center gap-1.5 shadow-sm border border-slate-700">
          <FileBadge className="w-3 h-3 text-blue-400" />
          {copyType === 'EMPREGADOR' ? 'Via Única - Recibo Oficial de Salário' : '2ª Via - Cópia de Arquivo'}
        </div>

        {/* Full Slip Body (No lateral sidebar - full width!) */}
        <div className="w-full">
          {/* Top Company Header */}
          <div className="pt-5 pb-3.5 px-3.5 border-b-2 border-slate-700 bg-slate-50/70">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
              <div>
                <div className="font-bold text-sm tracking-wide text-slate-950 uppercase">
                  {employerName || receipt.empregador.razaoSocial}
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-slate-700 mt-1">
                  <span><strong>CEI/CNPJ:</strong> {receipt.empregador.cei}</span>
                  <span><strong>CC:</strong> {receipt.empregador.centroCusto}</span>
                  <span className="italic">{receipt.empregador.regime}</span>
                  <span><strong>Emissão:</strong> {receipt.dataEmissao || '30/09/2026'}</span>
                </div>
              </div>
              <div className="sm:text-right">
                <div className="font-bold text-xs uppercase tracking-wider text-blue-900">{receipt.tipoFolha}</div>
                <div className="font-bold text-base text-slate-900 mt-0.5">{receipt.mesAno}</div>
              </div>
            </div>
          </div>

          {/* Employee Header Box */}
          <div className="p-3 border-b-2 border-slate-700 bg-white text-[11px]">
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-2 sm:col-span-1">
                <span className="text-[9px] text-slate-500 block uppercase">Código</span>
                <span className="font-bold text-sm text-slate-950">{employee.codigo}</span>
              </div>
              <div className="col-span-6 sm:col-span-5">
                <span className="text-[9px] text-slate-500 block uppercase">Nome do Colaborador</span>
                <span className="font-bold text-xs text-slate-950">{employee.nome}</span>
              </div>
              <div className="col-span-2">
                <span className="text-[9px] text-slate-500 block uppercase">CBO</span>
                <span className="font-semibold">{employee.cbo || '351405'}</span>
              </div>
              <div className="col-span-2">
                <span className="text-[9px] text-slate-500 block uppercase">Departamento</span>
                <span className="font-semibold">{employee.departamento || 'GERAL'}</span>
              </div>
              <div className="col-span-12 sm:col-span-2">
                <span className="text-[9px] text-slate-500 block uppercase">Admissão</span>
                <span className="font-semibold">{employee.dataAdmissao || '02/03/2023'}</span>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-2 mt-2 pt-2 border-t border-dashed border-slate-200">
              <div className="col-span-6">
                <span className="text-slate-500 text-[9px] mr-2 uppercase">Cargo / Função:</span>
                <span className="font-semibold text-slate-800">{employee.cargo}</span>
              </div>
              <div className="col-span-3">
                <span className="text-slate-500 text-[9px] mr-2 uppercase">CPF:</span>
                <span className="font-semibold text-slate-800">{employee.cpf || '***.***.***-**'}</span>
              </div>
              <div className="col-span-3">
                <span className="text-slate-500 text-[9px] mr-2 uppercase">PIS:</span>
                <span className="font-semibold text-slate-800">{employee.pisPasep || '-'}</span>
              </div>
            </div>
          </div>

          {/* Table Header: Código | Descrição | Referência | Vencimentos | Descontos */}
          <div className="grid grid-cols-12 bg-slate-100/90 text-slate-800 font-bold border-b-2 border-slate-700 py-1.5 px-3 text-[10px] uppercase tracking-wider">
            <div className="col-span-1">Cód</div>
            <div className="col-span-6">Descrição dos Eventos</div>
            <div className="col-span-1 text-center">Ref.</div>
            <div className="col-span-2 text-right">Vencimentos</div>
            <div className="col-span-2 text-right">Descontos</div>
          </div>

          {/* Items Rows */}
          <div className="divide-y divide-slate-100 min-h-[160px] bg-white">
            {(() => {
              const seenKeys = new Set<string>();
              const displayItens = (receipt.itens || []).filter(item => {
                const key = `${item.codigo || ''}|${(item.descricao || '').trim().toUpperCase()}`;
                if (seenKeys.has(key)) return false;
                seenKeys.add(key);
                return true;
              });

              return displayItens.map((item, idx) => {
                const rawVenc = item.vencimento ?? (item as any).vencimentos ?? ((item as any).tipo === 'PROVENTO' || (item as any).tipo === 'VENCIMENTO' ? (item as any).valor : null);
                const rawDesc = item.desconto ?? (item as any).descontos ?? (item as any).valorDesconto ?? ((item as any).tipo === 'DESCONTO' ? (item as any).valor : null);

                return (
                  <div
                    key={idx}
                    className={`grid grid-cols-12 py-1.5 px-3 hover:bg-slate-50 transition-colors ${
                      idx % 2 === 1 ? 'bg-slate-50/40' : ''
                    }`}
                  >
                    <div className="col-span-1 text-slate-600 font-mono">{item.codigo}</div>
                    <div className="col-span-6 font-medium text-slate-900">{item.descricao}</div>
                    <div className="col-span-1 text-center text-slate-600">{item.referencia || ''}</div>
                    <div className="col-span-2 text-right font-mono text-emerald-800 font-semibold">
                      {rawVenc && Number(rawVenc) > 0 ? formatBRL(rawVenc) : ''}
                    </div>
                    <div className="col-span-2 text-right font-mono text-rose-800 font-semibold">
                      {rawDesc && Number(rawDesc) > 0 ? formatBRL(rawDesc) : ''}
                    </div>
                  </div>
                );
              });
            })()}
          </div>

          {/* Totals & Net Pay Box */}
          <div className="border-t-2 border-slate-700 bg-slate-50/50">
            <div className="grid grid-cols-12 p-3 gap-3 items-center">
              <div className="col-span-6 text-[10px] text-slate-600">
                <span className="font-semibold text-slate-800 block mb-0.5">DOCUMENTO ELETRÔNICO OFICIAL</span>
                <p className="leading-tight text-slate-600">
                  Emitido nos termos do Art. 464 da CLT e Lei Federal nº 14.063/2020.
                </p>
                <p className="text-slate-500 mt-1">
                  Assinatura digital e autenticidade chanceladas por Certificado Digital ICP-Brasil.
                </p>
                {receipt.mensagemRodape && (
                  <p className="italic text-slate-500 mt-1">{receipt.mensagemRodape}</p>
                )}
              </div>

              <div className="col-span-6 space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600">Total de Vencimentos:</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    R$ {formatBRL(receipt.totalVencimentos)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600">Total de Descontos:</span>
                  <span className="font-mono font-bold text-rose-700 text-sm">
                    R$ {formatBRL(receipt.totalDescontos)}
                  </span>
                </div>
                <div className="pt-2 border-t-2 border-slate-700 flex justify-between items-center bg-blue-50/80 p-2 rounded-lg border border-blue-200">
                  <span className="font-bold text-blue-950 uppercase text-xs">Valor Líquido a Receber:</span>
                  <span className="font-mono font-extrabold text-blue-900 text-base">
                    R$ {formatBRL(receipt.valorLiquido)}
                  </span>
                </div>
              </div>
            </div>

            {/* Tax Bases Grid (6 columns) */}
            <div className="border-t border-slate-300 grid grid-cols-6 divide-x divide-slate-300 text-center py-2 text-[9.5px] bg-slate-100/60 font-sans">
              <div className="px-1">
                <span className="block text-slate-500 text-[8.5px] uppercase">Salário Base</span>
                <span className="font-bold text-slate-900 font-mono">{formatBRL(receipt.salarioBase)}</span>
              </div>
              <div className="px-1">
                <span className="block text-slate-500 text-[8.5px] uppercase">Sal. Contr. INSS</span>
                <span className="font-bold text-slate-900 font-mono">{formatBRL(receipt.salContrINSS)}</span>
              </div>
              <div className="px-1">
                <span className="block text-slate-500 text-[8.5px] uppercase">Base Cálc. FGTS</span>
                <span className="font-bold text-slate-900 font-mono">{formatBRL(receipt.baseCalcFGTS)}</span>
              </div>
              <div className="px-1">
                <span className="block text-slate-500 text-[8.5px] uppercase">F.G.T.S do Mês</span>
                <span className="font-bold text-slate-900 font-mono">{formatBRL(receipt.fgtsDoMes)}</span>
              </div>
              <div className="px-1">
                <span className="block text-slate-500 text-[8.5px] uppercase">Base Cálc. IRRF</span>
                <span className="font-bold text-slate-900 font-mono">{formatBRL(receipt.baseCalcIRRF)}</span>
              </div>
              <div className="px-1">
                <span className="block text-slate-500 text-[8.5px] uppercase">Faixa IRRF</span>
                <span className="font-bold text-slate-900 font-mono">{formatBRL(receipt.faixaIRRF)}%</span>
              </div>
            </div>

            {/* ASSINATURA NA PARTE DE BAIXO (Moved from sidebar to bottom) */}
            <div className="border-t-2 border-slate-700 p-4 bg-white font-sans">
              <p className="text-[10px] text-slate-600 italic text-center mb-3">
                DECLARO TER RECEBIDO A IMPORTÂNCIA LÍQUIDA DISCRIMINADA NESTE RECIBO, REFERENTE AOS MEUS SERVIÇOS PRESTADOS NO PERÍODO ACIMA.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                <div className="text-xs text-slate-700 font-medium">
                  <strong>DATA:</strong> ____ / ____ / ________
                </div>

                <div className="flex-1 max-w-md w-full flex flex-col items-center">
                  {isSigned ? (
                    <div className="flex items-center gap-2 text-emerald-700 mb-1 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-300">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-bold uppercase tracking-wider">Assinado Eletronicamente</span>
                    </div>
                  ) : (
                    <div className="w-full border-b border-slate-400 mb-1"></div>
                  )}
                  <span className="text-[10px] font-semibold text-slate-700 uppercase tracking-wide">
                    Assinatura do Colaborador: {employee.nome}
                  </span>
                </div>
              </div>
            </div>

            {/* CERTIFICADO DIGITAL A1 (ICP-BRASIL) BOTTOM SEAL BLOCK */}
            <div className="border-t-2 border-blue-600 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-3.5 font-sans">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/20 pb-2 mb-2">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="font-bold text-xs tracking-wider text-amber-300 uppercase">
                    Documento Assinado Digitalmente com Certificado Digital A1 (ICP-Brasil)
                  </span>
                </div>
                <span className="text-[9.5px] bg-blue-600/40 text-blue-200 px-2.5 py-0.5 rounded border border-blue-400/30 whitespace-nowrap font-medium">
                  MP nº 2.200-2/2001 • Lei nº 14.063/2020 • CLT Art. 464
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10.5px]">
                <div className="space-y-0.5 text-slate-300">
                  <p><strong className="text-white">Titular (Assinante):</strong> {activeCert.titular} (Doc: {activeCert.documentoTitular})</p>
                  <p><strong className="text-white">Autoridade Certificadora:</strong> {activeCert.autoridadeCertificadora}</p>
                  <p><strong className="text-white">Nº de Série:</strong> <span className="font-mono">{activeCert.numeroSerie}</span> • Validade até: {activeCert.validadeFim}</p>
                </div>

                <div className="space-y-0.5 text-slate-300 sm:text-right">
                  <p><strong className="text-white">Carimbo do Tempo:</strong> {receipt.dataAssinatura || `${receipt.dataEmissao || '30/09/2026'} às 14:00:00 (BRT)`}</p>
                  <p><strong className="text-white">Padrão Criptográfico:</strong> PKCS#12 A1 / SHA-256 (Validade Plena)</p>
                  <p className="flex items-center sm:justify-end gap-1.5 text-emerald-400 font-semibold">
                    <CheckCircle className="w-3.5 h-3.5" /> Certificado A1 Ativo e Autenticado no PDF
                  </p>
                </div>
              </div>

              {/* 2FA Acknowledgment Badge if Signed */}
              {isSigned && (
                <div className="mt-2.5 pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[10px] text-emerald-300 bg-emerald-950/40 px-2.5 py-1.5 rounded-lg border border-emerald-500/30">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>
                      <strong>Ciência do Colaborador:</strong> Confirmada por {employee.nome} em {receipt.dataAssinatura} via {receipt.metodoAssinatura || 'WHATSAPP'}
                    </span>
                  </div>
                  {receipt.codigoAssinatura && (
                    <span className="font-mono bg-emerald-500/20 text-emerald-200 px-1.5 py-0.2 rounded font-bold">
                      Token 2FA #{receipt.codigoAssinatura}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Resumo Rápido Mobile (Exclusivo para Smartphones) */}
      <div className="sm:hidden bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3 print:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-700">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Holerite Mensal</span>
              <h3 className="font-extrabold text-slate-900 text-sm">{receipt.mesAno}</h3>
            </div>
          </div>
          <div>
            {isSigned ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-300">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Assinado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-800 px-2.5 py-1 rounded-full border border-amber-300">
                <Lock className="w-3.5 h-3.5 text-amber-600" /> Não Assinado
              </span>
            )}
          </div>
        </div>

        {/* Totais do Mês */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            <span className="text-[10px] text-slate-500 block uppercase font-medium">Total Proventos</span>
            <span className="font-bold text-slate-900 font-mono text-xs">R$ {formatBRL(receipt.totalVencimentos)}</span>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            <span className="text-[10px] text-slate-500 block uppercase font-medium">Total Descontos</span>
            <span className="font-bold text-rose-700 font-mono text-xs">R$ {formatBRL(receipt.totalDescontos)}</span>
          </div>
        </div>

        {/* Líquido a Receber */}
        <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-3.5 rounded-xl flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] text-blue-200 uppercase font-semibold block">Valor Líquido a Receber</span>
            <span className="text-xl font-black text-white font-mono tracking-tight">R$ {formatBRL(receipt.valorLiquido)}</span>
          </div>
          <span className="text-[10px] bg-white/20 text-blue-100 font-semibold px-2 py-0.5 rounded-full">
            {receipt.tipoFolha}
          </span>
        </div>

        {/* Ação Primária Touch (Min height 44px) */}
        {!isSigned && allowSign ? (
          <button
            onClick={handleSign}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-colors min-h-[44px]"
          >
            <ShieldCheck className="w-4 h-4" /> Assinar Recibo (Liberar PDF)
          </button>
        ) : (isSigned || isAdmin) ? (
          <button
            onClick={() => downloadPayReceiptPDF(employee, receipt, activeCert)}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-colors min-h-[44px]"
          >
            <Download className="w-4 h-4" /> Baixar PDF
          </button>
        ) : (
          <div className="w-full py-2.5 px-3 bg-slate-100 text-slate-600 font-semibold text-[11px] rounded-xl text-center border border-slate-200">
            Assinatura exclusiva pelo titular no Portal do Colaborador
          </div>
        )}
      </div>

      {/* Action Header (Desktop & Tablet) */}
      <div className="hidden sm:flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-blue-50 text-blue-700">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              Recibo de Pagamento - {receipt.mesAno}
              {isSigned ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                  <CheckCircle className="w-3.5 h-3.5" /> Assinado Digitalmente
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                  Pendente de Assinatura
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500">
              Colaborador: <span className="font-semibold text-slate-700">{employee.nome}</span> (Cód: {employee.codigo}) • {employee.cargo}
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Sign Button - Somente para o próprio colaborador no Portal do Colaborador */}
          {!isSigned && allowSign && (
            <button
              onClick={handleSign}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-sm transition-colors cursor-pointer"
              title="Assinar com certificado de ciência e carimbo de tempo"
            >
              <ShieldCheck className="w-4 h-4" />
              Assinar Recibo
            </button>
          )}

          {!isSigned && !allowSign && (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 border border-slate-200 font-semibold text-[11px]"
              title="Apenas o colaborador titular pode assinar seu próprio holerite pelo Portal do Colaborador"
            >
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              Assinatura exclusiva pelo Colaborador
            </span>
          )}

          {/* Download PDF - Somente liberado após assinatura do colaborador */}
          {isSigned || isAdmin ? (
            <button
              onClick={() => downloadPayReceiptPDF(employee, receipt, activeCert)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-sm transition-colors cursor-pointer"
              title="Baixar PDF"
            >
              <Download className="w-4 h-4" />
              Baixar PDF
            </button>
          ) : allowSign ? (
            <button
              onClick={() => {
                setDownloadBlockedNotice('O download do holerite oficial em PDF com termo de quitação CLT (Art. 464) só é liberado após você assinar o recibo.');
                handleSign();
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs shadow-xs transition-colors cursor-pointer"
              title="Download bloqueado. Assine o recibo digitalmente para liberar o download do holerite em PDF."
            >
              <Lock className="w-4 h-4 text-amber-600" />
              <span>Assinar para Liberar Download PDF</span>
            </button>
          ) : null}

          {/* Email dispatch (Apenas Gestão RH) */}
          {isAdmin && onOpenEmailModal && (
            <button
              onClick={() => onOpenEmailModal(employee, receipt)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-medium text-xs transition-colors cursor-pointer"
              title="Enviar comprovante por E-mail"
            >
              <Mail className="w-4 h-4" />
              E-mail
            </button>
          )}
        </div>
      </div>

      {/* Blocked Download Notice Banner for Collaborator when Unsigned */}
      {!isSigned && allowSign && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950 shadow-sm print:hidden animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-sm text-amber-950 block">
                Download do PDF do Holerite Bloqueado
              </span>
              <span className="text-xs text-amber-800 leading-tight block mt-0.5">
                Conforme as normas do Art. 464 da CLT, a emissão do PDF oficial com termo de quitação só é liberada imediatamente após a confirmação da sua assinatura digital.
              </span>
            </div>
          </div>
          <button
            onClick={handleSign}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shrink-0 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-all min-h-[44px]"
          >
            <ShieldCheck className="w-4 h-4" /> Assinar Recibo Agora
          </button>
        </div>
      )}

      {downloadBlockedNotice && (
        <div className="bg-rose-50 border border-rose-200 text-rose-900 p-3 rounded-xl text-xs flex items-center gap-2 print:hidden animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{downloadBlockedNotice}</span>
        </div>
      )}

      {/* Digital Certificate & Signature Banner */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-md print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/20 border border-blue-400/30 text-blue-300 shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold flex items-center gap-2 flex-wrap">
              <span>Certificado Digital A1 Vinculado</span>
              <span className="text-[10px] bg-emerald-500/30 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-400/40">
                Padrão ICP-Brasil Ativo
              </span>
            </div>
            <p className="text-[11px] text-blue-200 mt-0.5">
              Assinante: <strong>{activeCert.titular}</strong> (Validade: {activeCert.validadeFim}) • Os PDFs baixados já saem com assinatura digital jurídica.
            </p>
          </div>
        </div>
      </div>

      {/* Mobile Horizontal Scroll Hint */}
      <div className="sm:hidden flex items-center justify-between bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-xl text-[10.5px] font-semibold print:hidden">
        <span>👈 Deslize para os lados para ver a folha inteira 👉</span>
        <span className="text-blue-700 font-bold">Via Oficial</span>
      </div>

      {/* Slip 1 (Via Única na tela) */}
      <div className="w-full overflow-x-auto -mx-2 sm:mx-0 px-2 sm:px-0 pt-4 pb-2">
        <div className="min-w-[580px] md:min-w-full">
          {renderSingleSlip('EMPREGADOR')}
        </div>
      </div>
    </div>
  );
};
