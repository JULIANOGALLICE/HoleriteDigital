import React, { useState } from 'react';
import { Employee, MedicalCertificate } from '../types';
import {
  X,
  Stethoscope,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Archive,
  Download,
  Eye,
  Calendar,
  User,
  Building,
  FileText,
  AlertCircle,
  FileCheck
} from 'lucide-react';

interface MedicalCertificatesAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  certificates: MedicalCertificate[];
  employees: Employee[];
  onViewCertificate: (cert: MedicalCertificate) => void;
  onQuickApprove?: (id: string) => Promise<void>;
}

export const MedicalCertificatesAdminModal: React.FC<MedicalCertificatesAdminModalProps> = ({
  isOpen,
  onClose,
  certificates,
  employees,
  onViewCertificate,
  onQuickApprove
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'TODOS' | 'PENDENTE' | 'APROVADO' | 'REJEITADO' | 'ARQUIVADO'>('TODOS');
  const [employeeFilter, setEmployeeFilter] = useState<string>('TODOS');

  if (!isOpen) return null;

  // Filter logic
  const filtered = certificates.filter(cert => {
    const matchesSearch =
      cert.employeeNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cert.employeeCodigo.includes(searchTerm) ||
      cert.protocolo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (cert.cid && cert.cid.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (cert.nomeMedico && cert.nomeMedico.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'TODOS' || cert.status === statusFilter;
    const matchesEmployee = employeeFilter === 'TODOS' || cert.employeeCodigo === employeeFilter;

    return matchesSearch && matchesStatus && matchesEmployee;
  });

  const totalCount = certificates.length;
  const pendingCount = certificates.filter(c => c.status === 'PENDENTE').length;
  const approvedCount = certificates.filter(c => c.status === 'APROVADO').length;
  const totalDays = certificates
    .filter(c => c.status === 'APROVADO')
    .reduce((acc, c) => acc + (c.diasAfastamento || 0), 0);

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

  const getStatusBadge = (status: MedicalCertificate['status']) => {
    switch (status) {
      case 'APROVADO':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Homologado
          </span>
        );
      case 'REJEITADO':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <XCircle className="w-3 h-3 text-rose-600" />
            Rejeitado
          </span>
        );
      case 'ARQUIVADO':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
            <Archive className="w-3 h-3 text-blue-600" />
            Arquivado
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <Clock className="w-3 h-3 text-amber-600" />
            Pendente
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full border border-slate-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center text-blue-300">
              <Stethoscope className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Gestão de Atestados Médicos & Afastamentos</h3>
              <p className="text-xs text-blue-200">
                Arquivo centralizado e homologação de atestados de colaboradores no banco de dados
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

        {/* Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 border-b border-slate-200 shrink-0">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[10px] text-slate-500 block uppercase font-semibold">Total de Atestados</span>
            <span className="text-lg font-bold text-slate-900">{totalCount}</span>
          </div>

          <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200 shadow-sm">
            <span className="text-[10px] text-amber-700 block uppercase font-semibold">Pendentes de Homologação</span>
            <span className="text-lg font-bold text-amber-800">{pendingCount}</span>
          </div>

          <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200 shadow-sm">
            <span className="text-[10px] text-emerald-700 block uppercase font-semibold">Homologados / Aprovados</span>
            <span className="text-lg font-bold text-emerald-800">{approvedCount}</span>
          </div>

          <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-200 shadow-sm">
            <span className="text-[10px] text-blue-700 block uppercase font-semibold">Dias Abonados (Total)</span>
            <span className="text-lg font-bold text-blue-900">{totalDays} dias</span>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="p-4 bg-white border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por colaborador, matrícula, CID ou protocolo..."
              className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="text-xs border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 font-medium focus:ring-2 focus:ring-blue-600 outline-none"
            >
              <option value="TODOS">Todos os Status</option>
              <option value="PENDENTE">Pendentes ({pendingCount})</option>
              <option value="APROVADO">Homologados</option>
              <option value="REJEITADO">Rejeitados</option>
              <option value="ARQUIVADO">Arquivados</option>
            </select>

            <select
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className="text-xs border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 font-medium focus:ring-2 focus:ring-blue-600 outline-none max-w-[180px] truncate"
            >
              <option value="TODOS">Todos Colaboradores</option>
              {employees.map(emp => (
                <option key={emp.codigo} value={emp.codigo}>
                  {emp.codigo} - {emp.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table / List */}
        <div className="flex-1 overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <div className="text-center py-12 bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
              <Stethoscope className="w-12 h-12 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-slate-700">Nenhum atestado médico encontrado</p>
              <p className="text-xs text-slate-400 mt-1">
                {searchTerm || statusFilter !== 'TODOS'
                  ? 'Tente ajustar os filtros ou o termo de busca.'
                  : 'Os atestados enviados pelos colaboradores aparecerão aqui arquivados.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-3.5">Protocolo</th>
                    <th className="py-3 px-3.5">Colaborador</th>
                    <th className="py-3 px-3.5">Afastamento</th>
                    <th className="py-3 px-3.5">Retorno</th>
                    <th className="py-3 px-3.5">CID / Médico</th>
                    <th className="py-3 px-3.5">Status</th>
                    <th className="py-3 px-3.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filtered.map(cert => (
                    <tr key={cert.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3.5 font-mono font-bold text-slate-900">
                        {cert.protocolo}
                        <span className="block text-[10px] text-slate-400 font-sans font-normal">
                          {new Date(cert.criadoEm).toLocaleDateString('pt-BR')}
                        </span>
                      </td>

                      <td className="py-3 px-3.5">
                        <span className="font-bold text-slate-900 block">{cert.employeeNome}</span>
                        <span className="text-[10px] text-slate-500">
                          Matrícula: {cert.employeeCodigo} • {cert.employeeDepartamento || 'Geral'}
                        </span>
                      </td>

                      <td className="py-3 px-3.5">
                        <span className="font-semibold text-blue-900 block">
                          {cert.diasAfastamento} {cert.diasAfastamento === 1 ? 'dia' : 'dias'}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          A partir de {formatDateDisplay(cert.dataInicioAfastamento)}
                        </span>
                      </td>

                      <td className="py-3 px-3.5">
                        <span className="font-semibold text-emerald-800">
                          {cert.dataRetorno || '-'}
                        </span>
                      </td>

                      <td className="py-3 px-3.5">
                        {cert.cid ? (
                          <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 text-[10px]">
                            {cert.cid}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                        {cert.crmMedico && (
                          <span className="block text-[10px] text-slate-500 mt-0.5">
                            {cert.crmMedico}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3.5">
                        {getStatusBadge(cert.status)}
                      </td>

                      <td className="py-3 px-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onViewCertificate(cert)}
                            className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                            title="Ver detalhes e arquivo do atestado"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Ver
                          </button>

                          {cert.status === 'PENDENTE' && onQuickApprove && (
                            <button
                              onClick={() => onQuickApprove(cert.id)}
                              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                              title="Homologar rapidamente"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Homologar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
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
