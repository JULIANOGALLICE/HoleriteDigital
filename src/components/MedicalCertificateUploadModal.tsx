import React, { useState, useRef } from 'react';
import { Employee, MedicalCertificate } from '../types';
import {
  Upload,
  ShieldCheck,
  AlertCircle,
  X,
  Clock,
  Stethoscope,
  Info,
  Camera,
  FileUp,
  CheckCircle2
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface MedicalCertificateUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee;
  onSubmit: (certificate: MedicalCertificate) => Promise<void>;
}

/**
 * Compresses and resizes camera/gallery images so they fit comfortably
 * within Firestore's 1 MiB limit while keeping text, signatures, and CRM stamps sharp.
 */
async function compressImageFile(
  file: File
): Promise<{ base64: string; mimeType: string; sizeBytes: number; fileName: string; wasCompressed: boolean }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      try {
        const origW = img.naturalWidth || img.width;
        const origH = img.naturalHeight || img.height;

        if (!origW || !origH) {
          reject(new Error('Não foi possível identificar as dimensões da imagem capturada.'));
          return;
        }

        const attempts = [
          { maxDim: 1600, quality: 0.78 },
          { maxDim: 1280, quality: 0.68 },
          { maxDim: 1024, quality: 0.58 },
          { maxDim: 850, quality: 0.50 }
        ];

        let finalDataUrl = '';

        for (const attempt of attempts) {
          let targetW = origW;
          let targetH = origH;

          if (origW > attempt.maxDim || origH > attempt.maxDim) {
            if (origW > origH) {
              targetW = attempt.maxDim;
              targetH = Math.round((origH * attempt.maxDim) / origW);
            } else {
              targetH = attempt.maxDim;
              targetW = Math.round((origW * attempt.maxDim) / origH);
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Falha ao inicializar o processador de imagem no navegador.'));
            return;
          }

          // Fill white background in case of transparent PNG
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, targetW, targetH);
          ctx.drawImage(img, 0, 0, targetW, targetH);

          finalDataUrl = canvas.toDataURL('image/jpeg', attempt.quality);

          // 600,000 chars in Base64 is ~440 KB, safely below Firestore's 1 MiB limit
          if (finalDataUrl.length <= 600000) {
            break;
          }
        }

        const base64Length = finalDataUrl.split(',')[1]?.length || finalDataUrl.length;
        const approxBytes = Math.round((base64Length * 3) / 4);
        const cleanName = (file.name || `atestado_${Date.now()}.jpg`).replace(/\.[^/.]+$/, '') + '.jpg';

        resolve({
          base64: finalDataUrl,
          mimeType: 'image/jpeg',
          sizeBytes: approxBytes,
          fileName: cleanName,
          wasCompressed: approxBytes < file.size
        });
      } catch (err: any) {
        reject(new Error(`Erro ao otimizar a foto: ${err?.message || 'memória insuficiente no aparelho'}`));
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(
        new Error(
          `Não foi possível ler a imagem (${file.name || file.type || 'formato desconhecido'}). Se estiver no iPhone/Android, tente usar o botão "Tirar Foto com a Câmera" ou enviar em JPG/PNG/PDF.`
        )
      );
    };

    img.src = objectUrl;
  });
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () =>
      reject(new Error(`Falha ao ler o arquivo selecionado (${reader.error?.message || 'erro de leitura'}).`));
    reader.readAsDataURL(file);
  });
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
  const [motivoObservacao, setMotivoObservacao] = useState('');

  // File Upload State
  const [arquivoNome, setArquivoNome] = useState('');
  const [arquivoBase64, setArquivoBase64] = useState('');
  const [arquivoTipo, setArquivoTipo] = useState('');
  const [arquivoTamanhoBytes, setArquivoTamanhoBytes] = useState<number>(0);
  const [wasCompressed, setWasCompressed] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

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
    // Reset input value so picking the same file or retaking a photo triggers onChange again
    e.target.value = '';
  };

  const processSelectedFile = async (file: File) => {
    setErrorMsg(null);
    setWasCompressed(false);

    const fileNameLower = (file.name || '').toLowerCase();
    const mimeLower = (file.type || '').toLowerCase();

    const isPdf = mimeLower === 'application/pdf' || fileNameLower.endsWith('.pdf');
    const isImage =
      mimeLower.startsWith('image/') ||
      /\.(jpg|jpeg|png|webp|heic|heif|bmp)$/i.test(fileNameLower) ||
      (!mimeLower && !isPdf); // Some mobile camera intents return an empty MIME type

    if (!isPdf && !isImage) {
      setErrorMsg(
        `Formato de arquivo não suportado (${file.type || file.name}). Envie uma foto da câmera (JPG, PNG, HEIC) ou um documento PDF.`
      );
      return;
    }

    // For PDFs, limit to 4.5 MB (Firestore chunking supports up to ~5 MB)
    if (isPdf && file.size > 4.5 * 1024 * 1024) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      setErrorMsg(
        `O arquivo PDF selecionado possui ${sizeMb} MB, excedendo o limite máximo de 4,5 MB. Envie um PDF menor ou tire uma foto do atestado.`
      );
      return;
    }

    // For raw camera images, allow up to 25 MB before automatic compression
    if (isImage && file.size > 25 * 1024 * 1024) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      setErrorMsg(`A foto selecionada é muito pesada (${sizeMb} MB). O limite para fotos é de 25 MB.`);
      return;
    }

    setIsProcessingFile(true);

    try {
      if (isImage) {
        try {
          const compressed = await compressImageFile(file);
          setArquivoNome(compressed.fileName);
          setArquivoTipo(compressed.mimeType);
          setArquivoTamanhoBytes(compressed.sizeBytes);
          setArquivoBase64(compressed.base64);
          setWasCompressed(compressed.wasCompressed);
        } catch (compressErr: any) {
          // Fallback: if image is small enough (< 3 MB), read directly as DataURL
          if (file.size <= 3 * 1024 * 1024) {
            const rawDataUrl = await readFileAsDataURL(file);
            setArquivoNome(file.name || `foto_atestado_${Date.now()}.jpg`);
            setArquivoTipo(file.type || 'image/jpeg');
            setArquivoTamanhoBytes(file.size);
            setArquivoBase64(rawDataUrl);
          } else {
            throw compressErr;
          }
        }
      } else {
        // PDF file
        const pdfDataUrl = await readFileAsDataURL(file);
        setArquivoNome(file.name || `atestado_${Date.now()}.pdf`);
        setArquivoTipo('application/pdf');
        setArquivoTamanhoBytes(file.size);
        setArquivoBase64(pdfDataUrl);
      }
    } catch (err: any) {
      console.error('Erro ao processar arquivo do atestado:', err);
      setErrorMsg(err?.message || 'Não foi possível processar a foto ou arquivo selecionado.');
    } finally {
      setIsProcessingFile(false);
    }
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

    if (isProcessingFile) {
      setErrorMsg('Aguarde a conclusão do processamento da foto antes de enviar.');
      return;
    }

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
        arquivoNome: arquivoNome || `atestado_${Date.now()}.jpg`,
        arquivoBase64,
        arquivoTipo: arquivoTipo || 'image/jpeg',
        arquivoTamanhoBytes: arquivoTamanhoBytes || 0,
        status: 'PENDENTE',
        criadoEm: new Date().toISOString(),
        ...(motivoObservacao.trim() ? { motivoObservacao: motivoObservacao.trim() } : {})
      };

      await onSubmit(certificate);

      try {
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.6 }
        });
      } catch {}

      onClose();
    } catch (err: any) {
      console.error('Erro ao enviar atestado:', err);
      const detail = err?.message || String(err || 'Falha desconhecida');
      setErrorMsg(`Erro ao enviar atestado: ${detail}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[94vh] flex flex-col border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-900 via-slate-900 to-indigo-950 text-white p-4 sm:p-5 flex items-center justify-between border-b border-blue-800 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-600/40 border border-blue-400/30 flex items-center justify-center text-blue-300 shrink-0">
              <Stethoscope className="w-5 h-5 text-blue-300" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm sm:text-base text-white truncate">Enviar Atestado Médico</h3>
              <p className="text-[11px] sm:text-xs text-blue-200 truncate">
                Colaborador: <strong className="text-white">{employee.nome}</strong> (Mat: {employee.codigo})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white flex items-center justify-center transition-all cursor-pointer shrink-0 ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl flex items-start gap-2.5 text-xs text-rose-900 shadow-sm">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold text-rose-900 mb-0.5">Não foi possível concluir o envio:</p>
                <p className="leading-relaxed break-words">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Info Banner */}
          <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-blue-900">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              O atestado médico será arquivado no banco de dados e encaminhado ao Departamento Pessoal (DP) para homologação e abono dos dias de ausência conforme o Art. 473 da CLT.
            </p>
          </div>

          {/* File Upload Zone - Placed prominently for mobile users */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
              Anexo do Atestado (Foto da Câmera ou PDF) *
            </label>

            {/* Hidden Input for Mobile Camera Capture */}
            <input
              type="file"
              ref={cameraInputRef}
              onChange={handleFileChange}
              accept="image/*"
              capture="environment"
              className="hidden"
            />

            {/* Hidden Input for File / Gallery / PDF Picker */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*,application/pdf,.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif"
              className="hidden"
            />

            {isProcessingFile ? (
              <div className="border-2 border-blue-300 bg-blue-50/60 rounded-2xl p-6 text-center flex flex-col items-center justify-center gap-2">
                <Clock className="w-7 h-7 text-blue-600 animate-spin" />
                <p className="text-xs font-bold text-blue-900">
                  Otimizando foto para envio rápido...
                </p>
                <p className="text-[11px] text-blue-700">
                  Ajustando resolução e tamanho da imagem automaticamente
                </p>
              </div>
            ) : !arquivoBase64 ? (
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-4 sm:p-5 text-center transition-all ${
                  dragActive
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-300 bg-slate-50/70'
                }`}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
                  >
                    <Camera className="w-4 h-4 shrink-0" />
                    <span>Tirar Foto com a Câmera</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold text-xs shadow-sm transition-all cursor-pointer"
                  >
                    <FileUp className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>Escolher Foto ou PDF</span>
                  </button>
                </div>

                <p className="text-[11px] text-slate-500">
                  Fotos tiradas pelo celular são otimizadas automaticamente • Aceita JPG, PNG, HEIC ou PDF
                </p>
              </div>
            ) : (
              <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {arquivoTipo.startsWith('image/') ? (
                    <div className="w-14 h-14 rounded-xl bg-slate-200 overflow-hidden border border-slate-300 shrink-0">
                      <img src={arquivoBase64} alt="Prévia do Atestado" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center border border-rose-200 shrink-0 font-bold text-xs">
                      PDF
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <p className="text-xs font-bold text-slate-800 truncate">{arquivoNome}</p>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      {(arquivoTamanhoBytes / 1024).toFixed(0)} KB • {arquivoTipo === 'application/pdf' ? 'Documento PDF' : 'Imagem pronta para envio'}
                    </p>
                    {wasCompressed && (
                      <span className="inline-block mt-1 text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">
                        Foto otimizada automaticamente para o banco de dados
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-emerald-200/60">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Camera className="w-3.5 h-3.5 text-blue-600" />
                    Nova Foto
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 text-blue-700 hover:bg-blue-50 font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    Trocar Arquivo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setArquivoBase64('');
                      setArquivoNome('');
                      setArquivoTipo('');
                      setArquivoTamanhoBytes(0);
                      setWasCompressed(false);
                    }}
                    className="p-1.5 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                    title="Remover anexo"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
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
              />
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
              />
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
                inputMode="numeric"
                min="1"
                max="90"
                required
                value={diasAfastamento}
                onChange={(e) => setDiasAfastamento(parseInt(e.target.value) || 1)}
                className="w-full text-xs font-medium border border-slate-300 rounded-xl p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all"
                placeholder="Ex: 1, 2, 5"
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

          {/* Sticky-style Bottom Actions & Error visibility near Submit button */}
          <div className="pt-3 border-t border-slate-200 space-y-3">
            {errorMsg && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-800">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="font-medium">{errorMsg}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting || isProcessingFile}
                className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isProcessingFile || !arquivoBase64}
                className="flex-1 sm:flex-initial justify-center px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin" />
                    Enviando Atestado...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    Enviar Atestado para o RH
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

