import React from 'react';
import { IncomeReport } from '../types';
import { formatCurrencyBRL, generateIncomeReportPdf } from '../utils/incomeReportPdfGenerator';
import {
  X,
  Download,
  Printer,
  FileText,
  Building2,
  User,
  DollarSign,
  ShieldCheck,
  CheckCircle2,
  Calendar
} from 'lucide-react';

interface IncomeReportModalProps {
  report: IncomeReport | null;
  onClose: () => void;
}

export const IncomeReportModal: React.FC<IncomeReportModalProps> = ({ report, onClose }) => {
  const hasOriginalPdf = Boolean(report?.arquivoPdfOriginal?.base64);
  const [viewMode, setViewMode] = React.useState<'ORIGINAL_PDF' | 'STRUCTURED'>(
    hasOriginalPdf ? 'ORIGINAL_PDF' : 'STRUCTURED'
  );

  React.useEffect(() => {
    if (report?.arquivoPdfOriginal?.base64) {
      setViewMode('ORIGINAL_PDF');
    } else {
      setViewMode('STRUCTURED');
    }
  }, [report]);

  if (!report) return null;

  const handleDownloadPdf = () => {
    if (report.arquivoPdfOriginal?.base64) {
      const link = document.createElement('a');
      link.href = report.arquivoPdfOriginal.base64;
      link.download = report.arquivoPdfOriginal.nomeArquivo || `Informe_Rendimentos_${report.beneficiario.nomeCompleto.replace(/\s+/g, '_')}_${report.anoCalendario}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const doc = generateIncomeReportPdf(report);
      doc.save(`Informe_Rendimentos_${report.beneficiario.nomeCompleto.replace(/\s+/g, '_')}_${report.anoCalendario}.pdf`);
    }
  };

  const handlePrint = () => {
    if (hasOriginalPdf) {
      const iframe = document.getElementById('pdf-original-frame') as HTMLIFrameElement;
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.print();
        return;
      }
    }
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-600/30 text-blue-400 border border-blue-500/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">Comprovante de Rendimentos Pagos e IRRF</h3>
                {hasOriginalPdf && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    PDF Original Dividido
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Beneficiário: <strong className="text-slate-200">{report.beneficiario.nomeCompleto}</strong> • Exercício {report.exercicio} (Ano-Calendário {report.anoCalendario})
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPdf}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Download className="w-4 h-4" />
              {hasOriginalPdf ? 'Baixar PDF Original' : 'Baixar PDF'}
            </button>
            <button
              onClick={handlePrint}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Imprimir"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* View Mode Toggle if Original PDF exists */}
        {hasOriginalPdf && (
          <div className="bg-slate-100 border-b border-slate-200 px-6 py-2 flex items-center justify-between shrink-0">
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('ORIGINAL_PDF')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'ORIGINAL_PDF'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                Visualizar PDF Original da Folha
              </button>
              <button
                onClick={() => setViewMode('STRUCTURED')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'STRUCTURED'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Quadro de Rendimentos Estruturado
              </button>
            </div>
            {report.arquivoPdfOriginal?.numeroPaginaOrigem && (
              <span className="text-[11px] text-slate-500 font-medium">
                Página {report.arquivoPdfOriginal.numeroPaginaOrigem} de {report.arquivoPdfOriginal.totalPaginasOrigem || 'original'}
              </span>
            )}
          </div>
        )}

        {/* Document Body */}
        {hasOriginalPdf && viewMode === 'ORIGINAL_PDF' ? (
          <div className="p-4 overflow-y-auto bg-slate-800/10 flex-1 flex flex-col items-center">
            <iframe
              id="pdf-original-frame"
              src={report.arquivoPdfOriginal!.base64}
              title={`Informe de ${report.beneficiario.nomeCompleto}`}
              className="w-full h-[680px] bg-white rounded-xl border border-slate-300 shadow-md"
            />
          </div>
        ) : (
        <div className="p-6 overflow-y-auto space-y-4 bg-slate-50/50 flex-1 text-slate-900 text-xs font-sans">
          {/* Header RFB */}
          <div className="border border-slate-300 rounded-lg p-4 bg-white grid grid-cols-1 md:grid-cols-2 gap-4 shadow-sm">
            <div className="space-y-0.5">
              <p className="font-bold text-slate-900 text-sm">MINISTÉRIO DA ECONOMIA</p>
              <p className="font-semibold text-slate-800 text-xs">SECRETARIA DA RECEITA FEDERAL DO BRASIL</p>
              <p className="text-slate-600 text-[11px]">IMPOSTO SOBRE A RENDA DA PESSOA FÍSICA</p>
              <p className="text-blue-900 font-bold text-xs pt-1">EXERCÍCIO: {report.exercicio}</p>
            </div>
            <div className="md:text-right space-y-0.5 md:border-l md:border-slate-200 md:pl-4">
              <p className="font-bold text-slate-900 text-xs">COMPROVANTE DE RENDIMENTOS PAGOS E DE</p>
              <p className="font-bold text-slate-900 text-xs">IMPOSTO SOBRE A RENDA RETIDO NA FONTE</p>
              <p className="text-blue-900 font-bold text-xs pt-1">ANO-CALENDÁRIO: {report.anoCalendario}</p>
            </div>
          </div>

          {/* 1. Fonte Pagadora */}
          <div className="border border-slate-300 rounded-lg overflow-hidden bg-white shadow-sm">
            <div className="bg-slate-100 px-3 py-1.5 font-bold text-slate-800 border-b border-slate-300 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-600" />
              1. Fonte Pagadora Pessoa Jurídica ou Pessoa Física
            </div>
            <div className="p-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-[10px] text-slate-500 uppercase block font-semibold">CNPJ / CPF</span>
                <span className="font-mono font-bold text-slate-900">{report.fontePagadora.cnpjCpf}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-[10px] text-slate-500 uppercase block font-semibold">Nome Empresarial / Nome Completo</span>
                <span className="font-bold text-slate-900">{report.fontePagadora.nomeEmpresarial}</span>
              </div>
            </div>
          </div>

          {/* 2. Beneficiário */}
          <div className="border border-slate-300 rounded-lg overflow-hidden bg-white shadow-sm">
            <div className="bg-slate-100 px-3 py-1.5 font-bold text-slate-800 border-b border-slate-300 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-600" />
              2. Pessoa Física Beneficiária dos Rendimentos
            </div>
            <div className="p-3 grid grid-cols-1 sm:grid-cols-3 gap-3 border-b border-slate-200">
              <div>
                <span className="text-[10px] text-slate-500 uppercase block font-semibold">CPF</span>
                <span className="font-mono font-bold text-slate-900">{report.beneficiario.cpf}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-[10px] text-slate-500 uppercase block font-semibold">Nome Completo</span>
                <span className="font-bold text-slate-900">
                  {report.beneficiario.nomeCompleto}
                  {report.beneficiario.employeeCodigo && (
                    <span className="text-slate-500 font-normal ml-2">
                      (Cód. {report.beneficiario.employeeCodigo})
                    </span>
                  )}
                </span>
              </div>
            </div>
            <div className="px-3 py-2 bg-slate-50">
              <span className="text-[10px] text-slate-500 uppercase block font-semibold">Natureza do Rendimento</span>
              <span className="text-slate-800 font-medium">
                {report.beneficiario.naturezaRendimento || 'RENDIMENTO DO TRABALHO ASSALARIADO NO PAÍS'}
              </span>
            </div>
          </div>

          {/* 3. Rendimentos Tributáveis, Deduções e IRRF */}
          <div className="border border-slate-300 rounded-lg overflow-hidden bg-white shadow-sm">
            <div className="bg-slate-100 px-3 py-1.5 font-bold text-slate-800 border-b border-slate-300 flex justify-between items-center">
              <span>3. Rendimentos Tributáveis, Deduções e Imposto sobre a Renda Retido na Fonte</span>
              <span className="text-[10px] text-slate-500 font-normal">Valores em Reais</span>
            </div>
            <div className="divide-y divide-slate-200">
              <div className="p-2.5 flex justify-between items-center hover:bg-slate-50">
                <span className="text-slate-700">1. Total dos rendimentos (inclusive férias)</span>
                <span className="font-mono font-bold text-slate-900">
                  R$ {formatCurrencyBRL(report.rendimentosTributaveis.totalRendimentos)}
                </span>
              </div>
              <div className="p-2.5 flex justify-between items-center hover:bg-slate-50">
                <span className="text-slate-700">2. Contribuição previdenciária oficial</span>
                <span className="font-mono font-bold text-slate-900">
                  R$ {formatCurrencyBRL(report.rendimentosTributaveis.contribuicaoPrevidenciaria)}
                </span>
              </div>
              <div className="p-2.5 flex justify-between items-center hover:bg-slate-50">
                <span className="text-slate-700">3. Contribuição a previdência complementar / Fapi</span>
                <span className="font-mono font-bold text-slate-900">
                  R$ {formatCurrencyBRL(report.rendimentosTributaveis.previdenciaComplementar)}
                </span>
              </div>
              <div className="p-2.5 flex justify-between items-center hover:bg-slate-50">
                <span className="text-slate-700">4. Pensão alimentícia</span>
                <span className="font-mono font-bold text-slate-900">
                  R$ {formatCurrencyBRL(report.rendimentosTributaveis.pensaoAlimenticia)}
                </span>
              </div>
              <div className="p-2.5 flex justify-between items-center bg-blue-50/50">
                <span className="text-blue-950 font-bold">5. Imposto sobre a Renda Retido na Fonte (IRRF)</span>
                <span className="font-mono font-bold text-blue-900 text-sm">
                  R$ {formatCurrencyBRL(report.rendimentosTributaveis.impostoRetidoFonte)}
                </span>
              </div>
            </div>
          </div>

          {/* 4. Rendimentos Isentos e Não Tributáveis */}
          <div className="border border-slate-300 rounded-lg overflow-hidden bg-white shadow-sm">
            <div className="bg-slate-100 px-3 py-1.5 font-bold text-slate-800 border-b border-slate-300 flex justify-between items-center">
              <span>4. Rendimentos Isentos e Não Tributáveis</span>
              <span className="text-[10px] text-slate-500 font-normal">Valores em Reais</span>
            </div>
            <div className="divide-y divide-slate-200">
              <div className="p-2 flex justify-between items-center hover:bg-slate-50 text-[11px]">
                <span className="text-slate-600">7. Indenizações por rescisão de contrato de trabalho (inclusive PDV / acidente)</span>
                <span className="font-mono font-semibold text-slate-900">
                  R$ {formatCurrencyBRL(report.rendimentosIsentos.indenizacoesRescisao)}
                </span>
              </div>
              <div className="p-2 flex justify-between items-center hover:bg-slate-50 text-[11px]">
                <span className="text-slate-600">
                  9. Outros {report.rendimentosIsentos.outrosEspecificar ? `(${report.rendimentosIsentos.outrosEspecificar})` : ''}
                </span>
                <span className="font-mono font-semibold text-slate-900">
                  R$ {formatCurrencyBRL(report.rendimentosIsentos.outrosValor)}
                </span>
              </div>
            </div>
          </div>

          {/* 5. Tributação Exclusiva */}
          <div className="border border-slate-300 rounded-lg overflow-hidden bg-white shadow-sm">
            <div className="bg-slate-100 px-3 py-1.5 font-bold text-slate-800 border-b border-slate-300 flex justify-between items-center">
              <span>5. Rendimentos Sujeitos a Tributação Exclusiva (rendimento líquido)</span>
              <span className="text-[10px] text-slate-500 font-normal">Valores em Reais</span>
            </div>
            <div className="divide-y divide-slate-200">
              <div className="p-2.5 flex justify-between items-center hover:bg-slate-50">
                <span className="text-slate-700">1. 13º (décimo terceiro) salário</span>
                <span className="font-mono font-bold text-slate-900">
                  R$ {formatCurrencyBRL(report.tributacaoExclusiva.decimoTerceiroSalario)}
                </span>
              </div>
              <div className="p-2.5 flex justify-between items-center hover:bg-slate-50">
                <span className="text-slate-700">2. Imposto sobre a Renda Retido na Fonte sobre 13º salário</span>
                <span className="font-mono font-bold text-slate-900">
                  R$ {formatCurrencyBRL(report.tributacaoExclusiva.irrfDecimoTerceiro)}
                </span>
              </div>
            </div>
          </div>

          {/* 8. Responsável pelas Informações */}
          <div className="border border-slate-300 rounded-lg overflow-hidden bg-white p-3 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <span className="text-[10px] text-slate-500 uppercase block font-semibold">Responsável pelas Informações</span>
              <span className="font-bold text-slate-900">{report.responsavel.nome}</span>
            </div>
            <div className="flex items-center gap-4">
              <div>
                <span className="text-[10px] text-slate-500 uppercase block font-semibold">Data</span>
                <span className="font-medium text-slate-800">{report.responsavel.data}</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 rounded-md border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-[11px] font-bold">Assinado Eletronicamente</span>
              </div>
            </div>
          </div>

          <p className="text-[10px] text-slate-500 italic text-center pt-2">
            Aprovado pela Instrução Normativa RFB nº 2.060, de 13 de dezembro de 2021.
          </p>
        </div>
        )}

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-slate-600 hover:text-slate-900 font-medium text-xs hover:bg-slate-200 transition-colors cursor-pointer"
          >
            Fechar
          </button>
          <button
            onClick={handleDownloadPdf}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Baixar Comprovante em PDF
          </button>
        </div>
      </div>
    </div>
  );
};
