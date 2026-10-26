import React, { useState, useMemo } from 'react';
import { SystemLog, SystemLogEventType, SystemLogCategory, Employee, UserAccount } from '../types';
import * as XLSX from 'xlsx';
import {
  X,
  History,
  Search,
  Filter,
  Calendar,
  Download,
  Smartphone,
  Mail,
  Lock,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Stethoscope,
  ChevronRight,
  ChevronDown,
  Info,
  Clock,
  Shield,
  User,
  Radio,
  Trash2,
  RefreshCw
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface SystemLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: SystemLog[];
  employees: Employee[];
  users: UserAccount[];
  onClearLogs?: () => void;
}

export const SystemLogsModal: React.FC<SystemLogsModalProps> = ({
  isOpen,
  onClose,
  logs,
  employees,
  users,
  onClearLogs
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('TODOS');
  const [selectedUserKey, setSelectedUserKey] = useState<string>('TODOS');
  const [selectedStatus, setSelectedStatus] = useState<'TODOS' | 'SUCESSO' | 'FALHA'>('TODOS');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Atalhos de data
  const handleQuickDate = (type: 'HOJE' | '7DIAS' | '30DIAS' | 'ESTE_MES' | 'LIMPAR') => {
    const today = new Date();
    const toISODate = (d: Date) => d.toISOString().slice(0, 10);

    if (type === 'LIMPAR') {
      setStartDate('');
      setEndDate('');
      return;
    }

    if (type === 'HOJE') {
      const todayStr = toISODate(today);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (type === '7DIAS') {
      const past = new Date(today.getTime() - 7 * 24 * 3600 * 1000);
      setStartDate(toISODate(past));
      setEndDate(toISODate(today));
    } else if (type === '30DIAS') {
      const past = new Date(today.getTime() - 30 * 24 * 3600 * 1000);
      setStartDate(toISODate(past));
      setEndDate(toISODate(today));
    } else if (type === 'ESTE_MES') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(toISODate(firstDay));
      setEndDate(toISODate(today));
    }
  };

  // Filtragem dos logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // 1. Busca textual
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matchName = (log.usuarioNome || '').toLowerCase().includes(term);
        const matchEmail = (log.usuarioEmail || '').toLowerCase().includes(term);
        const matchMatricula = (log.usuarioMatricula || '').toLowerCase().includes(term);
        const matchDesc = (log.descricao || '').toLowerCase().includes(term);
        const matchTipo = (log.tipoEvento || '').toLowerCase().includes(term);
        if (!matchName && !matchEmail && !matchMatricula && !matchDesc && !matchTipo) {
          return false;
        }
      }

      // 2. Categoria / Evento
      if (selectedCategory !== 'TODOS') {
        if (selectedCategory === 'WHATSAPP') {
          if (log.canal !== 'WHATSAPP' && !log.tipoEvento.includes('WHATSAPP')) return false;
        } else if (selectedCategory === 'EMAIL') {
          if (log.canal !== 'EMAIL' && !log.tipoEvento.includes('EMAIL')) return false;
        } else if (selectedCategory === 'LOGIN') {
          if (log.categoria !== 'LOGIN') return false;
        } else if (selectedCategory === 'ASSINATURA') {
          if (log.categoria !== 'ASSINATURA') return false;
        } else if (selectedCategory === 'IRPF') {
          if (log.tipoEvento !== 'ENVIO_COMPROVANTE_IRPF' && log.categoria !== 'DOCUMENTO') return false;
        } else if (selectedCategory === 'SISTEMA') {
          if (log.categoria !== 'SISTEMA') return false;
        }
      }

      // 3. Usuário
      if (selectedUserKey !== 'TODOS') {
        const userMatch =
          log.usuarioMatricula === selectedUserKey ||
          (log.usuarioEmail && log.usuarioEmail.toLowerCase() === selectedUserKey.toLowerCase());
        if (!userMatch) return false;
      }

      // 4. Status
      if (selectedStatus === 'SUCESSO' && !log.sucesso) return false;
      if (selectedStatus === 'FALHA' && log.sucesso) return false;

      // 5. Data
      if (startDate) {
        const logDateStr = log.timestamp.slice(0, 10);
        if (logDateStr < startDate) return false;
      }
      if (endDate) {
        const logDateStr = log.timestamp.slice(0, 10);
        if (logDateStr > endDate) return false;
      }

      return true;
    });
  }, [logs, searchTerm, selectedCategory, selectedUserKey, selectedStatus, startDate, endDate]);

  // Contadores para os KPIs
  const stats = useMemo(() => {
    let whatsapp = 0;
    let email = 0;
    let logins = 0;
    let assinaturas = 0;

    logs.forEach(l => {
      if (l.canal === 'WHATSAPP' || l.tipoEvento.includes('WHATSAPP')) whatsapp++;
      if (l.canal === 'EMAIL' || l.tipoEvento.includes('EMAIL')) email++;
      if (l.categoria === 'LOGIN') logins++;
      if (l.categoria === 'ASSINATURA') assinaturas++;
    });

    return { total: logs.length, whatsapp, email, logins, assinaturas };
  }, [logs]);

  if (!isOpen) return null;

  // Exportar histórico para Excel (.xlsx)
  const handleExportXLS = () => {
    const rows = filteredLogs.map(l => ({
      'Data e Hora': l.formattedDate || l.timestamp,
      'Categoria': l.categoria,
      'Evento': l.tipoEvento,
      'Canal': l.canal || 'PORTAL',
      'Usuário / Colaborador': l.usuarioNome,
      'Matrícula': l.usuarioMatricula || '',
      'E-mail': l.usuarioEmail || '',
      'Perfil': l.usuarioRole,
      'Descrição do Evento': l.descricao,
      'Status': l.sucesso ? 'SUCESSO' : 'FALHA',
      'Mensagem de Erro': l.mensagemErro || ''
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 22 }, // Data e Hora
      { wch: 16 }, // Categoria
      { wch: 22 }, // Evento
      { wch: 12 }, // Canal
      { wch: 30 }, // Usuário
      { wch: 12 }, // Matrícula
      { wch: 28 }, // E-mail
      { wch: 14 }, // Perfil
      { wch: 55 }, // Descrição
      { wch: 12 }, // Status
      { wch: 30 }  // Erro
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Historico_Auditoria');
    XLSX.writeFile(wb, `Historico_Comunicacoes_Logins_${new Date().toISOString().slice(0, 10)}.xlsx`);
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
  };

  // Renderizador do ícone de evento
  const renderEventIcon = (log: SystemLog) => {
    if (log.canal === 'WHATSAPP' || log.tipoEvento.includes('WHATSAPP')) {
      return (
        <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
          <Smartphone className="w-4 h-4" />
        </div>
      );
    }
    if (log.canal === 'EMAIL' || log.tipoEvento.includes('EMAIL')) {
      return (
        <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
          <Mail className="w-4 h-4" />
        </div>
      );
    }
    if (log.categoria === 'ASSINATURA') {
      return (
        <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center shrink-0">
          <FileCheck className="w-4 h-4" />
        </div>
      );
    }
    if (log.categoria === 'LOGIN') {
      return (
        <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
          <Lock className="w-4 h-4" />
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
        <Info className="w-4 h-4" />
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="p-5 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-600/30 text-blue-400 border border-blue-500/30 shadow-inner">
              <History className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg text-white">
                  Histórico de Comunicações, Logins & Auditoria
                </h3>
                <span className="px-2.5 py-0.5 bg-blue-500/20 text-blue-300 text-[10px] font-bold rounded-full border border-blue-500/30">
                  CLT Art. 464 • LGPD
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Rastreamento completo e auditável de disparos de WhatsApp, e-mails, autenticações e assinaturas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* KPI Banner */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3.5 grid grid-cols-2 sm:grid-cols-5 gap-3 shrink-0">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold uppercase text-slate-500 block">Total de Eventos</span>
            <span className="text-lg font-black text-slate-900">{stats.total}</span>
          </div>

          <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-emerald-800">WhatsApp</span>
              <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <span className="text-lg font-black text-emerald-900">{stats.whatsapp}</span>
          </div>

          <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-blue-800">E-mails</span>
              <Mail className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <span className="text-lg font-black text-blue-900">{stats.email}</span>
          </div>

          <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-indigo-800">Logins & 2FA</span>
              <Lock className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <span className="text-lg font-black text-indigo-900">{stats.logins}</span>
          </div>

          <div className="bg-teal-50/60 p-3 rounded-xl border border-teal-200 shadow-xs col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-teal-800">Assinaturas</span>
              <FileCheck className="w-3.5 h-3.5 text-teal-600" />
            </div>
            <span className="text-lg font-black text-teal-900">{stats.assinaturas}</span>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="p-5 border-b border-slate-200 bg-white space-y-3 shrink-0 text-xs">
          {/* Row 1: Search + Category + User Filter */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar colaborador, matrícula, e-mail..."
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Filter */}
            <div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="TODOS">Todos os Tipos de Eventos</option>
                <option value="WHATSAPP">💬 Apenas WhatsApp (Disparos e Lembretes)</option>
                <option value="EMAIL">✉️ Apenas E-mails</option>
                <option value="LOGIN">🔐 Acessos / Logins & 2FA</option>
                <option value="ASSINATURA">✍️ Assinaturas de Holerite (CLT 464)</option>
                <option value="IRPF">📄 Comprovantes de Rendimentos (IRPF)</option>
                <option value="SISTEMA">⚙️ Operações do Sistema & Planilhas XLS</option>
              </select>
            </div>

            {/* User Filter */}
            <div>
              <select
                value={selectedUserKey}
                onChange={(e) => setSelectedUserKey(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="TODOS">Todos os Colaboradores & Gestores</option>
                <optgroup label="Gestores">
                  {users
                    .filter(u => u.role === 'GESTOR')
                    .map(u => (
                      <option key={u.uid} value={u.employeeCodigo || u.email}>
                        ⭐ {u.nome} ({u.email})
                      </option>
                    ))}
                </optgroup>
                <optgroup label="Colaboradores">
                  {employees.map(emp => (
                    <option key={emp.codigo} value={emp.codigo}>
                      👤 {emp.nome} (Matrícula: {emp.codigo})
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          </div>

          {/* Row 2: Date Filters + Quick Pills + Export */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            {/* Date range pickers */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500" /> Período:
              </span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                title="Data Inicial"
              />
              <span className="text-slate-400">até</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                title="Data Final"
              />

              {/* Quick Date Pills */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleQuickDate('HOJE')}
                  className="px-2 py-1 text-[10.5px] rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDate('7DIAS')}
                  className="px-2 py-1 text-[10.5px] rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  7 dias
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDate('30DIAS')}
                  className="px-2 py-1 text-[10.5px] rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  30 dias
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDate('ESTE_MES')}
                  className="px-2 py-1 text-[10.5px] rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  Este Mês
                </button>
                {(startDate || endDate) && (
                  <button
                    type="button"
                    onClick={() => handleQuickDate('LIMPAR')}
                    className="px-2 py-1 text-[10.5px] rounded-md bg-rose-50 text-rose-700 hover:bg-rose-100 font-semibold cursor-pointer"
                  >
                    Limpar Datas
                  </button>
                )}
              </div>
            </div>

            {/* Export and Status buttons */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as any)}
                className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
              >
                <option value="TODOS">Todos os Status</option>
                <option value="SUCESSO">Apenas Sucesso</option>
                <option value="FALHA">Apenas Falhas</option>
              </select>

              <button
                type="button"
                onClick={handleExportXLS}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap"
                title="Exportar registros filtrados para planilha Excel"
              >
                <Download className="w-3.5 h-3.5" /> Exportar XLS
              </button>
            </div>
          </div>
        </div>

        {/* Logs Table / List */}
        <div className="p-5 overflow-y-auto flex-1 divide-y divide-slate-100">
          {filteredLogs.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Search className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-slate-800 text-sm">Nenhum evento localizado</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Não foram encontrados registros para os filtros selecionados. Tente ajustar os parâmetros de data, usuário ou tipo de evento.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredLogs.map((log) => {
                const isExpanded = expandedLogId === log.id;

                return (
                  <div
                    key={log.id}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      isExpanded
                        ? 'border-blue-300 bg-blue-50/20 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      {/* Left side: Icon + description */}
                      <div className="flex items-start gap-3 min-w-0">
                        {renderEventIcon(log)}

                        <div className="min-w-0">
                          {/* Tags row */}
                          <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                            {/* Canal / Evento Badge */}
                            <span
                              className={`px-2 py-0.5 rounded-md font-bold uppercase ${
                                log.tipoEvento?.startsWith('EXCLUSAO_')
                                  ? 'bg-rose-100 text-rose-800'
                                  : log.tipoEvento?.includes('BLOQUEIO')
                                  ? 'bg-amber-100 text-amber-800'
                                  : log.canal === 'WHATSAPP' || log.tipoEvento.includes('WHATSAPP')
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : log.canal === 'EMAIL' || log.tipoEvento.includes('EMAIL')
                                  ? 'bg-blue-100 text-blue-800'
                                  : log.categoria === 'ASSINATURA'
                                  ? 'bg-teal-100 text-teal-800'
                                  : log.categoria === 'LOGIN'
                                  ? 'bg-indigo-100 text-indigo-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {log.tipoEvento.replace(/_/g, ' ')}
                            </span>

                            {/* User Role */}
                            <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-semibold">
                              {log.usuarioRole}
                            </span>

                            {/* Date time */}
                            <span className="text-slate-400 flex items-center gap-1 font-mono">
                              <Clock className="w-3 h-3" />
                              {log.formattedDate || log.timestamp}
                            </span>
                          </div>

                          {/* Event Title / Description */}
                          <p className="font-bold text-slate-900 text-xs mt-1.5 leading-snug">
                            {log.descricao}
                          </p>

                          {/* User involved */}
                          <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
                            <span className="font-semibold text-slate-700 flex items-center gap-1">
                              <User className="w-3 h-3 text-slate-400" /> {log.usuarioNome}
                            </span>
                            {log.usuarioMatricula && (
                              <span className="font-mono text-slate-400">
                                Matrícula: {log.usuarioMatricula}
                              </span>
                            )}
                            {log.usuarioEmail && (
                              <span className="hidden sm:inline text-slate-400">
                                {log.usuarioEmail}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right side: Status and Expand button */}
                      <div className="shrink-0 flex items-center gap-2">
                        {log.sucesso ? (
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Sucesso
                          </span>
                        ) : (
                          <span className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 text-rose-600" /> Falha
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                          className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                          title="Ver detalhes do registro"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Expanded Details Pane */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-slate-200/80 text-[11px] space-y-2 bg-slate-50 p-3 rounded-xl font-mono">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <span className="text-slate-500 font-sans block text-[10px] uppercase font-bold">Identificador:</span>
                            <span className="text-slate-800">{log.id}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 font-sans block text-[10px] uppercase font-bold">Timestamp ISO:</span>
                            <span className="text-slate-800">{log.timestamp}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 font-sans block text-[10px] uppercase font-bold">Canal:</span>
                            <span className="text-slate-800">{log.canal || 'PORTAL'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 font-sans block text-[10px] uppercase font-bold">Categoria:</span>
                            <span className="text-slate-800">{log.categoria}</span>
                          </div>
                        </div>

                        {log.detalhes && Object.keys(log.detalhes).length > 0 && (
                          <div className="pt-2 border-t border-slate-200">
                            <span className="text-slate-500 font-sans block text-[10px] uppercase font-bold mb-1">
                              Metadados & Payload Técnico:
                            </span>
                            <pre className="p-2 bg-slate-900 text-emerald-400 rounded-lg overflow-x-auto text-[10.5px]">
                              {JSON.stringify(log.detalhes, null, 2)}
                            </pre>
                          </div>
                        )}

                        {log.mensagemErro && (
                          <div className="p-2 rounded bg-rose-50 text-rose-700 border border-rose-200 font-sans">
                            <strong>Detalhe do Erro:</strong> {log.mensagemErro}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs shrink-0">
          <span className="text-[11px] text-slate-500">
            Exibindo <strong>{filteredLogs.length}</strong> de <strong>{logs.length}</strong> registros registrados no banco de dados.
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-colors cursor-pointer text-xs"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
