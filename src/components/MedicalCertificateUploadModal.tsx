import React, { useState, useRef } from 'react';
import { Employee, MedicalCertificate } from '../types';
import {
  FileText,
  Upload,
  Calendar,
  User,
  ShieldCheck,
  AlertCircle,
  X,
  FileCheck,
  Clock,
  CheckCircle2,
  Stethoscope,
  Info,
  Eye,
  File
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface MedicalCertificateUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee;
  onSubmit: (certificate: MedicalCertificate) => Promise<void>;
}

export const MedicalCertificateUploadModal: React.FC<MedicalCertificateUploadModalProps> = ({
  isOpen,
  onClose,
  employee,
  onSubmit
}) => {
  const [tipoAtestado, setTipoAtestado] = useState<MedicalCertificate['tipoAtestado']>('MEDICO');
  const [dataEmissao, setDataEmissao] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [dataInicio, setDataInicio] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [diasAfastamento, setDiasAfastamento] = useState<number>(1);
  const [cid, setCid] = useState('');
  const [nomeMedico, setNomeMedico] = useState('');
  const [crmMedico, setCrmMedico] = useState('');
  const [motivoObservacao, setMotivoObservacao] = useState('');

  // File Upload State
  const [arquivoNome, setArquivoNome] = useState('');
  const [arquivoBase64, setArquivoBase64] = useState('');
  const [arquivoTipo, setArquivoTipo] = useState('');
  const [arquivoTamanhoBytes, setArquivoTamanhoBytes] = useState<number>(0);
  const [dragActive, setDragActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Calculate return date automatically
  const calculateReturnDate = (startStr: string, days: number): string => {
    try {
      const parts = startStr.split('-');
      if (parts.length !== 3) return '';
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      d.setDate(d.getDate() + (Number(days) || 1));
      return d.toLocaleDateString('pt-BR');
    } catch {
      return '';
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const processSelectedFile = (file: File) => {
    setErrorMsg(null);
    // Limit to 5MB
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('O arquivo do atestado não pode exceder 5 MB.');
      return;
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      setErrorMsg('Formato inválido. Por favor, envie uma foto (JPG, PNG) ou documento PDF.');
      return;
    }

    setArquivoNome(file.name);
    setArquivoTipo(file.type);
    setArquivoTamanhoBytes(file.size);

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setArquivoBase64(result);
    };
    reader.onerror = () => {
      setErrorMsg('Falha ao processar o arquivo. Tente novamente.');
    };
    reader.readAsDataURL(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!arquivoBase64) {
      setErrorMsg('É obrigatório anexar a foto ou PDF legível do atestado médico.');
      return;
    }

    if (diasAfastamento < 1) {
      setErrorMsg('A quantidade de dias de afastamento deve ser no mínimo 1.');
      return;
    }

    setIsSubmitting(true);

    try {
      const year = new Date().getFullYear();
      const randomSeq = Math.floor(1000 + Math.random() * 9000);
      const protocolo = `#AT-${year}-${randomSeq}`;
      const dataRetorno = calculateReturnDate(dataInicio, diasAfastamento);

      const certificate: MedicalCertificate = {
        id: `cert-${Date.now()}`,
        protocolo,
        employeeCodigo: employee.codigo,
        employeeNome: employee.nome,
        employeeCpf: employee.cpf || '',
        employeeDepartamento: employee.departamento || '',
        dataEmissaoAtestado: dataEmissao,
        dataInicioAfastamento: dataInicio,
        diasAfastamento: Number(diasAfastamento),
        dataRetorno,
        tipoAtestado,
        arquivoNome,
        arquivoBase64,
        arquivoTipo,
        arquivoTamanhoBytes: arquivoTamanhoBytes || 0,
        status: 'PENDENTE',
        criadoEm: new Date().toISOString(),
        ...(cid.trim() ? { cid: cid.trim().toUpperCase() } : {}),
        ...(nomeMedico.trim() ? { nomeMedico: nomeMedico.trim() } : {}),
        ...(crmMedico.trim() ? { crmMedico: crmMedico.trim() } : {}),
        ...(motivoObservacao.trim() ? { motivoObservacao: motivoObservacao.trim() } : {})
      };

      await onSubmit(certificate);

      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 }
      });

      onClose();
    } catch (err) {
      console.error('Erro ao enviar atestado:', err);
      setErrorMsg('Ocorreu um erro ao salvar o atestado no banco de dados. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-900 via-slate-900 to-indigo-950 text-white p-5 flex items-center justify-between border-b border-blue-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/40 border border-blue-400/30 flex items-center justify-center text-blue-300">
              <Stethoscope className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Enviar Atestado Médico</h3>
              <p className="text-xs text-blue-200">
                Colaborador: <strong className="text-white">{employee.nome}</strong> (Matrícula: {employee.codigo})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Info Banner */}
          <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-blue-900">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              O atestado médico será arquivado permanentemente no banco de dados e encaminhado ao Departamento Pessoal (DP) para homologação e abono dos dias de ausência conforme o Art. 473 da CLT.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Tipo de Atestado */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                Tipo de Atestado / Declaração *
              </label>
              <select
                value={tipoAtestado}
                onChange={(e) => setTipoAtestado(e.target.value as any)}
                className="w-full text-xs font-medium border border-slate-300 rounded-xl p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all"
              >
                <option value="MEDICO">Atestado Médico (Doença / Afastamento)</option>
                <option value="ODONTOLOGICO">Atestado Odontológico</option>
                <option value="COMPARECIMENTO">Declaração de Comparecimento (Consulta/Exames)</option>
                <option value="ACOMPANHAMENTO">Atestado de Acompanhamento Familiar</option>
                <option value="DECLARACAO_HORAS">Declaração de Horas (Parcial)</option>
              </select>
            </div>

            {/* Data de Emissão do Atestado */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                Data do Atendimento / Emissão *
              </label>
              <input
                type="date"
                required
                value={dataEmissao}
                onChange={(e) => setDataEmissao(e.target.value)}
                className="w-full text-xs font-medium border border-slate-300 rounded-xl p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all"
              >
              </input>
            </div>

            {/* Data de Início do Afastamento */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                Data de Início do Afastamento *
              </label>
              <input
                type="date"
                required
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full text-xs font-medium border border-slate-300 rounded-xl p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all"
              >
              </input>
            </div>

            {/* Quantidade de Dias de Afastamento */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide flex justify-between">
                <span>Dias de Afastamento *</span>
                <span className="text-blue-700 font-bold lowercase">
                  retorno: {calculateReturnDate(dataInicio, diasAfastamento)}
                </span>
              </label>
              <input
                type="number"
                min="1"
                max="90"
                required
                value={diasAfastamento}
                onChange={(e) => setDiasAfastamento(parseInt(e.target.value) || 1)}
                className="w-full text-xs font-medium border border-slate-300 rounded-xl p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all"
                placeholder="Ex: 1, 2, 5"
              />
            </div>

            {/* Médico Emitente */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                Médico / Dentista Emitente
              </label>
              <input
                type="text"
                value={nomeMedico}
                onChange={(e) => setNomeMedico(e.target.value)}
                placeholder="Dr(a). Nome do Profissional"
                className="w-full text-xs font-medium border border-slate-300 rounded-xl p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all"
              />
            </div>

            {/* CRM / CRO */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                CRM / CRO e UF
              </label>
              <input
                type="text"
                value={crmMedico}
                onChange={(e) => setCrmMedico(e.target.value)}
                placeholder="Ex: CRM/SP 123456"
                className="w-full text-xs font-medium border border-slate-300 rounded-xl p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all"
              />
            </div>

            {/* CID-10 (Facultativo) */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide flex items-center justify-between">
                <span>Código CID-10 (Facultativo)</span>
                <span className="text-[10px] text-slate-500 font-normal">
                  Res. CFM nº 1.658/2002 (sigilo médico garantido)
                </span>
              </label>
              <input
                type="text"
                value={cid}
                onChange={(e) => setCid(e.target.value)}
                placeholder="Ex: J06.9, M54.5, Z76.3 (opcional)"
                className="w-full text-xs font-medium border border-slate-300 rounded-xl p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all"
              />
            </div>

            {/* Observações adicionais */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                Observações ou Detalhes para o RH
              </label>
              <textarea
                rows={2}
                value={motivoObservacao}
                onChange={(e) => setMotivoObservacao(e.target.value)}
                placeholder="Observações complementares, horário do atendimento ou setor..."
                className="w-full text-xs font-medium border border-slate-300 rounded-xl p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all resize-none"
              />
            </div>
          </div>

          {/* File Upload Zone */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
              Anexo do Atestado (Foto ou Documento PDF) *
            </label>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*,application/pdf"
              className="hidden"
            />

            {!arquivoBase64 ? (
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                  dragActive
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-300 hover:border-blue-400 bg-slate-50/70 hover:bg-slate-50'
                }`}
              >
                <div className="w-12 h-12 mx-auto rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mb-3">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-slate-800">
                  Clique para selecionar ou arraste o atestado aqui
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Formatos aceitos: JPG, PNG, WEBP ou PDF (Tamanho máximo: 5 MB)
                </p>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {arquivoTipo.startsWith('image/') ? (
                    <div className="w-12 h-12 rounded-lg bg-slate-200 overflow-hidden border border-slate-300 shrink-0">
                      <img src={arquivoBase64} alt="Prévia" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center border border-rose-200 shrink-0 font-bold text-xs">
                      PDF
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-bold text-slate-800 truncate max-w-xs">{arquivoNome}</p>
                    <p className="text-[11px] text-slate-500">
                      {(arquivoTamanhoBytes / 1024).toFixed(1)} KB • {arquivoTipo}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 text-xs text-blue-700 hover:bg-blue-50 font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    Trocar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setArquivoBase64('');
                      setArquivoNome('');
                      setArquivoTipo('');
                      setArquivoTamanhoBytes(0);
                    }}
                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="Remover anexo"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Modal Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !arquivoBase64}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  Salvando no Banco de Dados...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  Enviar Atestado para o RH
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
