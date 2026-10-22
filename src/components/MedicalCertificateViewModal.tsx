import React, { useState } from 'react';
import { MedicalCertificate } from '../types';
import {
  X,
  Stethoscope,
  Calendar,
  User,
  Clock,
  ShieldCheck,
  Download,
  CheckCircle2,
  XCircle,
  FileText,
  Building,
  AlertTriangle,
  Archive,
  Eye,
  Trash2
} from 'lucide-react';

interface MedicalCertificateViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  certificate: MedicalCertificate | null;
  isManager?: boolean;
  onUpdateStatus?: (
    id: string,
    status: MedicalCertificate['status'],
    parecerRH?: string,
    analisadoPor?: string
  ) => Promise<void>;
  onDeleteCertificate?: (id: string) => Promise<void>;
}

export const MedicalCertificateViewModal: React.FC<MedicalCertificateViewModalProps> = ({
  isOpen,
  onClose,
  certificate,
  isManager = false,
  onUpdateStatus,
  onDeleteCertificate
}) => {
  const [parecerRHInput, setParecerRHInput] = useState(certificate?.parecerRH || '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  React.useEffect(() => {
    if (certificate) {
      setParecerRHInput(certificate.parecerRH || '');
      setConfirmDelete(false);
    }
  }, [certificate]);

  if (!isOpen || !certificate) return null;

  const handleAction = async (status: MedicalCertificate['status']) => {
    if (!onUpdateStatus) return;
    setIsProcessing(true);
    try {
      await onUpdateStatus(
        certificate.id,
        status,
        parecerRHInput.trim() || undefined,
        'Gestão de RH / DP'
      );
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!onDeleteCertificate) return;
    setIsProcessing(true);
    try {
      await onDeleteCertificate(certificate.id);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status: MedicalCertificate['status']) => {
    switch (status) {
      case 'APROVADO':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Homologado / Aprovado
          </span>
        );
      case 'REJEITADO':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            Rejeitado / Inconclusivo
          </span>
        );
      case 'ARQUIVADO':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
            <Archive className="w-3.5 h-3.5 text-blue-600" />
            Arquivado no DP
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            Pendente de Análise RH
          </span>
        );
    }
  };

  const formatDateDisplay = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center text-blue-400">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="font-bold text-base text-white">Atestado Médico Arquivado</h3>
                <span className="font-mono text-xs bg-slate-800 text-blue-300 px-2 py-0.5 rounded border border-slate-700">
                  {certificate.protocolo}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {certificate.employeeNome} • Matrícula: {certificate.employeeCodigo} • {certificate.employeeDepartamento || 'Geral'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {getStatusBadge(certificate.status)}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white flex items-center justify-center transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body: Two columns layout on desktop (Details left, File right) */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Details Column (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Summary Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                Dados do Afastamento
              </h4>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Início Afastamento</span>
                  <span className="font-bold text-slate-900">{formatDateDisplay(certificate.dataInicioAfastamento)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Dias Abonados</span>
                  <span className="font-bold text-blue-900 text-sm">{certificate.diasAfastamento} {certificate.diasAfastamento === 1 ? 'dia' : 'dias'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Data Prevista Retorno</span>
                  <span className="font-semibold text-emerald-700">{certificate.dataRetorno || '-'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Data do Atendimento</span>
                  <span className="font-semibold text-slate-700">{formatDateDisplay(certificate.dataEmissaoAtestado)}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 text-xs space-y-1.5">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Tipo do Documento</span>
                  <span className="font-semibold text-slate-800">
                    {certificate.tipoAtestado === 'MEDICO' && 'Atestado Médico (Doença)'}
                    {certificate.tipoAtestado === 'ODONTOLOGICO' && 'Atestado Odontológico'}
                    {certificate.tipoAtestado === 'COMPARECIMENTO' && 'Declaração de Comparecimento'}
                    {certificate.tipoAtestado === 'ACOMPANHAMENTO' && 'Acompanhamento Familiar'}
                    {certificate.tipoAtestado === 'DECLARACAO_HORAS' && 'Declaração de Horas'}
                  </span>
                </div>

                {certificate.cid && (
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase">CID-10 Registrado</span>
                    <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 inline-block">
                      {certificate.cid}
                    </span>
                  </div>
                )}

                {(certificate.nomeMedico || certificate.crmMedico) && (
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase">Profissional / CRM</span>
                    <span className="font-medium text-slate-800">
                      {certificate.nomeMedico || 'Não informado'} {certificate.crmMedico ? `(${certificate.crmMedico})` : ''}
                    </span>
                  </div>
                )}

                {certificate.motivoObservacao && (
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase">Observação do Colaborador</span>
                    <p className="text-slate-700 italic bg-white p-2 rounded-lg border border-slate-200 text-[11px]">
                      "{certificate.motivoObservacao}"
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Parecer do RH */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Parecer do RH / Homologação
              </h4>

              {isManager ? (
                <div className="space-y-2">
                  <textarea
                    rows={2}
                    value={parecerRHInput}
                    onChange={(e) => setParecerRHInput(e.target.value)}
                    placeholder="Adicionar parecer ou despacho do DP (ex: Homologado para folha de Outubro/2026)..."
                    className="w-full text-xs border border-slate-300 rounded-xl p-2.5 bg-white focus:ring-2 focus:ring-blue-600 outline-none resize-none"
                  />
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleAction('APROVADO')}
                      className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Homologar / Abonar
                    </button>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleAction('REJEITADO')}
                      className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Rejeitar
                    </button>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleAction('ARQUIVADO')}
                      className="px-3 py-2 bg-slate-700 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      Arquivar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-xs space-y-1">
                  {certificate.parecerRH ? (
                    <p className="p-2.5 bg-white rounded-lg border border-slate-200 text-slate-800 font-medium">
                      {certificate.parecerRH}
                    </p>
                  ) : (
                    <p className="text-slate-500 italic text-[11px]">
                      Aguardando análise e parecer da equipe de Recursos Humanos.
                    </p>
                  )}
                  {certificate.analisadoEm && (
                    <p className="text-[10px] text-slate-400">
                      Analisado em: {new Date(certificate.analisadoEm).toLocaleString('pt-BR')} por {certificate.analisadoPor || 'RH'}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Protocol and Audit Trail */}
            <div className="text-[10px] text-slate-400 space-y-0.5 px-1">
              <p>Envio em: {new Date(certificate.criadoEm).toLocaleString('pt-BR')}</p>
              <p>Protocolo Único: <span className="font-mono">{certificate.protocolo}</span></p>
              <p>Armazenamento: Servidor Corporativo Seguro (Registro Permanente)</p>
            </div>

            {/* Delete button for manager */}
            {isManager && onDeleteCertificate && (
              <div className="pt-2">
                {!confirmDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="text-xs text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Excluir atestado médico
                  </button>
                ) : (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between gap-2">
                    <span className="text-xs text-rose-800 font-medium">Confirmar exclusão permanente?</span>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={handleDelete}
                        className="px-2.5 py-1 bg-rose-600 text-white rounded text-xs font-bold hover:bg-rose-700 cursor-pointer"
                      >
                        Sim
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                        className="px-2.5 py-1 bg-slate-200 text-slate-700 rounded text-xs font-semibold hover:bg-slate-300 cursor-pointer"
                      >
                        Não
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Attachment Preview Column (7 cols) */}
          <div className="lg:col-span-7 flex flex-col bg-slate-900 rounded-2xl overflow-hidden border border-slate-800">
            <div className="p-3 bg-slate-950 text-white flex items-center justify-between border-b border-slate-800 text-xs">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                <span className="font-semibold truncate max-w-xs">{certificate.arquivoNome}</span>
              </div>

              <a
                href={certificate.arquivoBase64}
                download={certificate.arquivoNome || `Atestado_${certificate.protocolo}.pdf`}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Baixar Arquivo
              </a>
            </div>

            {/* Viewer */}
            <div className="flex-1 min-h-[380px] bg-slate-950 flex items-center justify-center p-3 overflow-auto">
              {certificate.arquivoTipo.startsWith('image/') ? (
                <img
                  src={certificate.arquivoBase64}
                  alt="Atestado Médico"
                  className="max-h-[550px] w-auto max-w-full rounded-lg shadow-2xl object-contain"
                />
              ) : (
                <div className="w-full h-[550px]">
                  <iframe
                    src={certificate.arquivoBase64}
                    title="Atestado PDF"
                    className="w-full h-full rounded-lg border-0 bg-white"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
