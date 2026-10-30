import React, { useState } from 'react';
import { UserAccount, Employee, SystemConfig } from '../types';
import {
  X,
  UserPlus,
  KeyRound,
  Shield,
  User,
  Search,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  Trash2,
  Edit2,
  UserCheck,
  Building,
  RefreshCw,
  Lock,
  Mail,
  Fingerprint,
  ShieldCheck,
  Check,
  PhoneCall,
  AlertTriangle
} from 'lucide-react';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: UserAccount[];
  employees: Employee[];
  currentUser: UserAccount | null;
  systemConfig?: SystemConfig;
  onUpdateSystemConfig?: (config: SystemConfig) => void;
  onSaveUser: (user: UserAccount) => Promise<void> | void;
  onDeleteUser: (uid: string) => Promise<void> | void;
  showToast: (msg: string) => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  isOpen,
  onClose,
  users,
  employees,
  currentUser,
  systemConfig,
  onUpdateSystemConfig,
  onSaveUser,
  onDeleteUser,
  showToast
}) => {
  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'TODOS' | 'GESTOR' | 'COLABORADOR'>('TODOS');

  // Sub-modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [changingPasswordUser, setChangingPasswordUser] = useState<UserAccount | null>(null);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserAccount | null>(null);
  const [confirmDeleteUid, setConfirmDeleteUid] = useState<string | null>(null);
  const [modalBanner, setModalBanner] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Create user form state
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'GESTOR' | 'COLABORADOR'>('COLABORADOR');
  const [newEmployeeCodigo, setNewEmployeeCodigo] = useState('');
  const [newInitialPassword, setNewInitialPassword] = useState('');
  const [showInitialPassword, setShowInitialPassword] = useState(false);
  const [newExigirCompletarCadastro, setNewExigirCompletarCadastro] = useState(true);
  const [newPrecisaTrocarSenha, setNewPrecisaTrocarSenha] = useState(true);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit user form state
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<'GESTOR' | 'COLABORADOR'>('COLABORADOR');
  const [editEmployeeCodigo, setEditEmployeeCodigo] = useState('');
  const [editInitialPassword, setEditInitialPassword] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editExigirCompletarCadastro, setEditExigirCompletarCadastro] = useState(true);
  const [editPrecisaTrocarSenha, setEditPrecisaTrocarSenha] = useState(true);
  const [editError, setEditError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Helper to generate secure random password
  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$';
    let res = '';
    for (let i = 0; i < 8; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  };

  // Open password modal
  const handleOpenPasswordModal = (user: UserAccount) => {
    setChangingPasswordUser(user);
    const suggested = generateRandomPassword();
    setNewPassword(suggested);
    setConfirmPassword(suggested);
    setShowNewPassword(true);
    setPasswordError(null);
  };

  // Save new password
  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changingPasswordUser) return;

    if (!newPassword || newPassword.trim().length < 4) {
      setPasswordError('A senha deve ter no mínimo 4 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('As senhas digitadas não coincidem.');
      return;
    }

    const updated: UserAccount = {
      ...changingPasswordUser,
      senha: newPassword.trim()
    };

    await onSaveUser(updated);
    showToast(`Senha de ${changingPasswordUser.nome} alterada com sucesso!`);
    setChangingPasswordUser(null);
    setNewPassword('');
    setConfirmPassword('');
  };

  // Open create user modal
  const handleOpenCreateModal = () => {
    setNewName('');
    setNewEmail('');
    setNewRole('COLABORADOR');
    setNewEmployeeCodigo(employees[0]?.codigo || '');
    setNewInitialPassword(generateRandomPassword());
    setShowInitialPassword(true);
    setNewExigirCompletarCadastro(true);
    setNewPrecisaTrocarSenha(true);
    setCreateError(null);
    setIsCreateOpen(true);
  };

  // Submit create user
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    const cleanEmail = newEmail.trim().toLowerCase();
    const cleanName = newName.trim();
    const cleanPassword = newInitialPassword.trim();

    if (!cleanName) {
      setCreateError('Informe o nome completo do usuário.');
      return;
    }

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setCreateError('Informe um endereço de e-mail válido.');
      return;
    }

    if (users.some(u => u.email.toLowerCase() === cleanEmail)) {
      setCreateError('Já existe um usuário cadastrado com este e-mail.');
      return;
    }

    if (!cleanPassword || cleanPassword.length < 4) {
      setCreateError('A senha inicial deve conter pelo menos 4 caracteres.');
      return;
    }

    const newUser: UserAccount = {
      uid: `user-${Date.now()}`,
      email: cleanEmail,
      nome: cleanName,
      role: newRole,
      employeeCodigo: newRole === 'COLABORADOR' ? newEmployeeCodigo : (newEmployeeCodigo || undefined),
      senha: cleanPassword,
      precisaTrocarSenha: newPrecisaTrocarSenha,
      exigirCompletarCadastro: newRole === 'COLABORADOR' ? newExigirCompletarCadastro : false,
      primeiroAcessoConcluido: false,
      criadoEm: new Date().toISOString()
    };

    await onSaveUser(newUser);
    showToast(`Novo usuário ${cleanName} criado com sucesso como ${newRole === 'GESTOR' ? 'Gestor' : 'Colaborador'}!`);
    setIsCreateOpen(false);
  };

  // Open edit modal
  const handleOpenEditModal = (user: UserAccount) => {
    setEditingUser(user);
    setEditName(user.nome);
    setEditEmail(user.email || '');
    setEditRole(user.role);
    setEditEmployeeCodigo(user.employeeCodigo || '');
    setEditInitialPassword(user.senha || '');
    setShowEditPassword(false);
    setEditExigirCompletarCadastro(user.exigirCompletarCadastro !== false);
    setEditPrecisaTrocarSenha(user.precisaTrocarSenha !== false);
    setEditError(null);
  };

  // Submit edit user
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    const cleanName = editName.trim();
    const cleanEmail = editEmail.trim().toLowerCase();
    const cleanPassword = editInitialPassword.trim();

    if (!cleanName) {
      setEditError('Informe o nome.');
      return;
    }

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setEditError('Informe um e-mail válido para o usuário.');
      return;
    }

    const duplicate = users.find(u => u.uid !== editingUser.uid && u.email && u.email.toLowerCase() === cleanEmail);
    if (duplicate) {
      setEditError('Já existe outro usuário cadastrado com este e-mail.');
      return;
    }

    if (!cleanPassword && !editingUser.senha) {
      setEditError('Defina a senha inicial de acesso deste usuário (mínimo 4 caracteres).');
      return;
    }

    const updated: UserAccount = {
      ...editingUser,
      nome: cleanName,
      email: cleanEmail,
      role: editRole,
      employeeCodigo: editRole === 'COLABORADOR' ? editEmployeeCodigo : (editEmployeeCodigo || undefined),
      senha: cleanPassword || editingUser.senha,
      exigirCompletarCadastro: editRole === 'COLABORADOR' ? editExigirCompletarCadastro : false,
      precisaTrocarSenha: editPrecisaTrocarSenha
    };

    await onSaveUser(updated);
    showToast(`Acesso de ${cleanName} salvo com sucesso! E-mail e senha inicial atualizados.`);
    setEditingUser(null);
  };

  // Delete user request (provides instant inline confirm and full confirmation modal)
  const handleDelete = (user: UserAccount) => {
    const isMaster = Boolean(user.email && user.email.toLowerCase() === 'julianogallice@gmail.com');
    if (isMaster) {
      setModalBanner({ type: 'error', text: 'O usuário Gestor Master não pode ser removido.' });
      showToast('O usuário Gestor Master não pode ser removido.');
      return;
    }
    if (currentUser && currentUser.uid === user.uid) {
      setModalBanner({ type: 'error', text: 'Você não pode remover seu próprio usuário logado.' });
      showToast('Você não pode remover seu próprio usuário logado.');
      return;
    }

    setConfirmDeleteUid(user.uid);
    setUserToDelete(user);
  };

  const handleConfirmDelete = async (targetUser?: UserAccount) => {
    const target = targetUser || userToDelete;
    if (!target) return;
    setUserToDelete(null);
    setConfirmDeleteUid(null);
    try {
      await onDeleteUser(target.uid);
      setModalBanner({ type: 'success', text: `Usuário "${target.nome}" excluído com sucesso!` });
      showToast(`Usuário ${target.nome} removido do sistema.`);
    } catch (e: any) {
      setModalBanner({ type: 'error', text: `Erro ao excluir: ${e?.message || 'Tente novamente'}` });
      showToast(`Erro ao excluir: ${e?.message || 'Tente novamente'}`);
    }
  };

  // Filter users
  const filteredUsers = users
    .filter(u => {
      const matchesSearch =
        u.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.employeeCodigo && u.employeeCodigo.includes(searchTerm));

      const matchesRole = roleFilter === 'TODOS' || u.role === roleFilter;

      return matchesSearch && matchesRole;
    })
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' }));

  const sortedEmployees = [...employees].sort((a, b) =>
    (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' })
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-white">
                  Gestão de Usuários & Senhas
                </h3>
                <span className="text-[10px] bg-blue-500/20 text-blue-300 font-mono px-2 py-0.5 rounded-full border border-blue-400/30">
                  {users.length} cadastrados
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Crie novos acessos, redefina senhas e defina o perfil (Gestor ou Colaborador)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenCreateModal}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Novo Usuário</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* In-Modal Feedback Banner */}
        {modalBanner && (
          <div className={`mx-6 mt-3 p-3 rounded-xl border flex items-center justify-between text-xs animate-in fade-in ${
            modalBanner.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}>
            <div className="flex items-center gap-2">
              {modalBanner.type === 'error' ? (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              )}
              <span className="font-semibold">{modalBanner.text}</span>
            </div>
            <button
              onClick={() => setModalBanner(null)}
              className="p-1 hover:opacity-75 cursor-pointer text-slate-500"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Toolbar: Search & Role Filters */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por nome, e-mail ou matrícula..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>

          <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-xl w-full sm:w-auto justify-center">
            <button
              onClick={() => setRoleFilter('TODOS')}
              className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                roleFilter === 'TODOS'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos ({users.length})
            </button>
            <button
              onClick={() => setRoleFilter('GESTOR')}
              className={`px-3 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1 cursor-pointer ${
                roleFilter === 'GESTOR'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Shield className="w-3 h-3" /> Gestores ({users.filter(u => u.role === 'GESTOR').length})
            </button>
            <button
              onClick={() => setRoleFilter('COLABORADOR')}
              className={`px-3 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1 cursor-pointer ${
                roleFilter === 'COLABORADOR'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-3 h-3" /> Colaboradores ({users.filter(u => u.role === 'COLABORADOR').length})
            </button>
          </div>
        </div>

        {/* Informative Security Banner */}
        <div className="bg-blue-50/70 border-b border-blue-100 px-6 py-2.5 flex items-center gap-3 text-xs text-blue-900">
          <Shield className="w-4 h-4 text-blue-600 shrink-0" />
          <span>
            <strong>Controle de Acessos:</strong> Gestores possuem acesso administrativo completo (importação de PDF, SMTP, usuários). Colaboradores têm acesso exclusivo ao seu próprio recibo, histórico de holerites e atualização dos próprios dados cadastrais.
          </span>
        </div>

        {/* Users Table / List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {filteredUsers.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-200">
              <User className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="font-bold text-slate-700 text-sm">Nenhum usuário encontrado</p>
              <p className="text-xs text-slate-400 mt-1">
                Tente ajustar os termos da busca ou clique em "+ Novo Usuário"
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredUsers.map((user) => {
                const linkedEmployee = employees.find(e => e.codigo === user.employeeCodigo);
                const isMaster = Boolean(user.email && user.email.toLowerCase() === 'julianogallice@gmail.com');
                const hasAccessConfigured = Boolean(user.email && user.senha);
                const hasEmergency = linkedEmployee && Array.isArray(linkedEmployee.contatosFamiliares) && linkedEmployee.contatosFamiliares.length > 0 && linkedEmployee.contatosFamiliares.some(c => c.nome?.trim() && c.telefone?.trim());

                return (
                  <div
                    key={user.uid}
                    className={`bg-white border rounded-xl p-4 shadow-xs transition-all flex flex-col gap-3 ${
                      !hasAccessConfigured
                        ? 'border-amber-300 bg-amber-50/20'
                        : 'border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* User Info */}
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-base shadow-xs shrink-0 ${
                            user.role === 'GESTOR'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {user.role === 'GESTOR' ? (
                            <Shield className="w-5 h-5 text-blue-600" />
                          ) : (
                            <User className="w-5 h-5 text-emerald-600" />
                          )}
                        </div>

                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-slate-900 truncate">
                              {user.nome}
                            </span>

                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                                user.role === 'GESTOR'
                                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              }`}
                            >
                              {user.role === 'GESTOR' ? 'GESTOR' : 'COLABORADOR'}
                            </span>

                            {!hasAccessConfigured && (
                              <span className="text-[10px] bg-amber-100 text-amber-900 font-extrabold px-2 py-0.5 rounded-full border border-amber-300 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                Acesso Pendente
                              </span>
                            )}

                            {user.role === 'COLABORADOR' && user.exigirCompletarCadastro !== false && (
                              <span className="text-[10px] bg-blue-50 text-blue-800 font-semibold px-2 py-0.5 rounded-full border border-blue-200">
                                Obriga Cadastro & Emergência
                              </span>
                            )}

                            {user.role === 'COLABORADOR' && user.precisaTrocarSenha && (
                              <span className="text-[10px] bg-purple-50 text-purple-800 font-semibold px-2 py-0.5 rounded-full border border-purple-200">
                                Obriga Trocar Senha
                              </span>
                            )}

                            {linkedEmployee && (
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                                  linkedEmployee.cadastroCompleto && hasEmergency
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                              >
                                {linkedEmployee.cadastroCompleto && hasEmergency
                                  ? 'Cadastro Completo'
                                  : 'Cadastro Incompleto'}
                              </span>
                            )}

                            {isMaster && (
                              <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-semibold border border-amber-200">
                                Master RH
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                            <span className="flex items-center gap-1 text-slate-600">
                              <Mail className="w-3 h-3 text-slate-400" />
                              {user.email || <em className="text-amber-700 font-medium">E-mail não cadastrado</em>}
                            </span>

                            {user.employeeCodigo && (
                              <span className="flex items-center gap-1 text-blue-700 font-medium">
                                <Building className="w-3 h-3 text-blue-400" /> Matrícula #{user.employeeCodigo}
                                {linkedEmployee ? ` (${linkedEmployee.cargo})` : ''}
                              </span>
                            )}

                            <span className="flex items-center gap-1 text-slate-500">
                              <Lock className="w-3 h-3" />
                              {user.senha ? (
                                <span className="text-emerald-700 font-mono font-bold">Senha cadastrada</span>
                              ) : (
                                <span className="text-amber-700 font-medium">Senha não definida</span>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0 border-t md:border-t-0 pt-2 md:pt-0">
                        {!hasAccessConfigured ? (
                          <button
                            onClick={() => handleOpenEditModal(user)}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>Cadastrar E-mail & Senha</span>
                          </button>
                        ) : (
                          <>
                            {/* Alterar Senha */}
                            <button
                              onClick={() => handleOpenPasswordModal(user)}
                              className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                              title="Alterar senha de acesso deste usuário"
                            >
                              <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                              <span>Mudar Senha</span>
                            </button>

                            {/* Editar Perfil / Função */}
                            <button
                              onClick={() => handleOpenEditModal(user)}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                              title="Editar nome, e-mail, senha ou regras"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                              <span>Editar</span>
                            </button>
                          </>
                        )}

                      {/* Excluir (Com confirmação inline imediata) */}
                      {!isMaster && (
                        confirmDeleteUid === user.uid ? (
                          <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-300 p-1 rounded-xl shadow-xs animate-in fade-in">
                            <span className="text-[11px] font-bold text-rose-700 px-1">Excluir?</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleConfirmDelete(user);
                              }}
                              className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer shadow-xs transition-colors"
                              title="Confirmar exclusão agora"
                            >
                              <Trash2 className="w-3 h-3" /> Sim, Excluir
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDeleteUid(null);
                                setUserToDelete(null);
                              }}
                              className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(user);
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Excluir usuário"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>
            Total de usuários: <strong>{users.length}</strong> (
            {users.filter(u => u.role === 'GESTOR').length} Gestores,{' '}
            {users.filter(u => u.role === 'COLABORADOR').length} Colaboradores)
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold cursor-pointer transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>

      {/* Sub-Modal: Alterar Senha do Usuário */}
      {changingPasswordUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-amber-500 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-white" />
                <h4 className="font-bold text-sm">Alterar Senha do Usuário</h4>
              </div>
              <button
                onClick={() => setChangingPasswordUser(null)}
                className="text-amber-100 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePassword} className="p-6 space-y-4 text-xs">
              <div>
                <p className="text-slate-500">Usuário selecionado:</p>
                <p className="font-bold text-slate-900 text-sm mt-0.5">{changingPasswordUser.nome}</p>
                <p className="text-slate-400 text-[11px]">{changingPasswordUser.email}</p>
              </div>

              {passwordError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700">Nova Senha de Acesso</label>
                  <button
                    type="button"
                    onClick={() => {
                      const gen = generateRandomPassword();
                      setNewPassword(gen);
                      setConfirmPassword(gen);
                      setShowNewPassword(true);
                    }}
                    className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" /> Gerar Aleatória
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 4 caracteres"
                    className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Confirmar Nova Senha</label>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                ℹ️ Esta nova senha entrará em vigor imediatamente. O usuário usará esta senha no login com seu e-mail ou matrícula.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setChangingPasswordUser(null)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Salvar Nova Senha
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sub-Modal: Criar Novo Usuário */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-blue-600 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                <h4 className="font-bold text-sm">Criar Novo Usuário no Sistema</h4>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-blue-100 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 text-xs">
              {createError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              {/* Nome */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Nome Completo</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: João da Silva Santos"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  required
                />
              </div>

              {/* E-mail */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">E-mail de Login</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="exemplo@cartorio.com.br"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  required
                />
              </div>

              {/* Perfil / Role */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Perfil / Função do Usuário</label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`p-3 border rounded-xl flex flex-col gap-1 cursor-pointer transition-all ${
                      newRole === 'COLABORADOR'
                        ? 'bg-emerald-50/80 border-emerald-400 text-emerald-950 ring-2 ring-emerald-400/20'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <input
                        type="radio"
                        name="newRole"
                        checked={newRole === 'COLABORADOR'}
                        onChange={() => setNewRole('COLABORADOR')}
                        className="text-emerald-600"
                      />
                      <User className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Colaborador</span>
                    </div>
                    <span className="text-[11px] text-slate-500 leading-tight">
                      Acessa apenas seu próprio recibo, histórico e edição de dados.
                    </span>
                  </label>

                  <label
                    className={`p-3 border rounded-xl flex flex-col gap-1 cursor-pointer transition-all ${
                      newRole === 'GESTOR'
                        ? 'bg-blue-50/80 border-blue-400 text-blue-950 ring-2 ring-blue-400/20'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <input
                        type="radio"
                        name="newRole"
                        checked={newRole === 'GESTOR'}
                        onChange={() => setNewRole('GESTOR')}
                        className="text-blue-600"
                      />
                      <Shield className="w-3.5 h-3.5 text-blue-600" />
                      <span>Gestor (DP)</span>
                    </div>
                    <span className="text-[11px] text-slate-500 leading-tight">
                      Acesso completo: importar PDF, configurar SMTP, senhas e usuários.
                    </span>
                  </label>
                </div>
              </div>

              {/* Colaborador Vinculado */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">
                  {newRole === 'COLABORADOR' ? 'Vincular à Matrícula do Colaborador *' : 'Vincular à Matrícula (Opcional)'}
                </label>
                <select
                  value={newEmployeeCodigo}
                  onChange={(e) => {
                    setNewEmployeeCodigo(e.target.value);
                    const selected = employees.find(emp => emp.codigo === e.target.value);
                    if (selected && !newName) setNewName(selected.nome);
                    if (selected && !newEmail) setNewEmail(selected.email);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium bg-white"
                >
                  <option value="">-- Selecione o colaborador correspondente --</option>
                  {sortedEmployees.map((emp) => (
                    <option key={emp.codigo} value={emp.codigo}>
                      {emp.nome} (#{emp.codigo} - {emp.cargo})
                    </option>
                  ))}
                </select>
              </div>

              {/* Senha Inicial */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700">Senha Inicial</label>
                  <button
                    type="button"
                    onClick={() => {
                      const gen = generateRandomPassword();
                      setNewInitialPassword(gen);
                      setShowInitialPassword(true);
                    }}
                    className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" /> Gerar Aleatória
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showInitialPassword ? 'text' : 'password'}
                    value={newInitialPassword}
                    onChange={(e) => setNewInitialPassword(e.target.value)}
                    placeholder="Mínimo 4 caracteres"
                    className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowInitialPassword(!showInitialPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showInitialPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Opções de Primeiro Acesso */}
              {newRole === 'COLABORADOR' && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <span className="font-bold text-slate-800 block text-xs">Regras de Primeiro Acesso do Colaborador:</span>
                  <label className="flex items-start gap-2 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={newExigirCompletarCadastro}
                      onChange={(e) => setNewExigirCompletarCadastro(e.target.checked)}
                      className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>
                      <strong>Exigir conclusão cadastral antes do holerite:</strong> O funcionário só poderá visualizar seu holerite após preencher endereço residencial e pelo menos um telefone de emergência.
                    </span>
                  </label>

                  <label className="flex items-start gap-2 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={newPrecisaTrocarSenha}
                      onChange={(e) => setNewPrecisaTrocarSenha(e.target.checked)}
                      className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>
                      <strong>Obrigatoriamente alterar a senha no primeiro acesso:</strong> O colaborador deverá criar uma nova senha pessoal confidencial.
                    </span>
                  </label>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  Cadastrar Usuário
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sub-Modal: Editar Perfil / Função */}
      {editingUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-400" />
                <h4 className="font-bold text-sm">Editar Usuário & Permissões</h4>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4 text-xs">
              {editError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Nome Completo</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">E-mail de Login</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  required
                />
              </div>

              {/* Perfil / Role */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Definir Perfil de Acesso</label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`p-3 border rounded-xl flex flex-col gap-1 cursor-pointer transition-all ${
                      editRole === 'COLABORADOR'
                        ? 'bg-emerald-50/80 border-emerald-400 text-emerald-950 ring-2 ring-emerald-400/20'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <input
                        type="radio"
                        name="editRole"
                        checked={editRole === 'COLABORADOR'}
                        onChange={() => setEditRole('COLABORADOR')}
                        className="text-emerald-600"
                      />
                      <User className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Colaborador</span>
                    </div>
                    <span className="text-[11px] text-slate-500 leading-tight">
                      Apenas recibo do mês, histórico e edição de dados. Sem aba de gestão.
                    </span>
                  </label>

                  <label
                    className={`p-3 border rounded-xl flex flex-col gap-1 cursor-pointer transition-all ${
                      editRole === 'GESTOR'
                        ? 'bg-blue-50/80 border-blue-400 text-blue-950 ring-2 ring-blue-400/20'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <input
                        type="radio"
                        name="editRole"
                        checked={editRole === 'GESTOR'}
                        onChange={() => setEditRole('GESTOR')}
                        className="text-blue-600"
                      />
                      <Shield className="w-3.5 h-3.5 text-blue-600" />
                      <span>Gestor (DP)</span>
                    </div>
                    <span className="text-[11px] text-slate-500 leading-tight">
                      Acesso total à gestão, importação de PDF, e-mail SMTP e senhas.
                    </span>
                  </label>
                </div>
              </div>

              {/* Colaborador Vinculado */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Vincular à Matrícula do Colaborador</label>
                <select
                  value={editEmployeeCodigo}
                  onChange={(e) => setEditEmployeeCodigo(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium bg-white"
                >
                  <option value="">-- Sem vínculo direto --</option>
                  {sortedEmployees.map((emp) => (
                    <option key={emp.codigo} value={emp.codigo}>
                      {emp.nome} (#{emp.codigo} - {emp.cargo})
                    </option>
                  ))}
                </select>
              </div>

              {/* Senha Inicial / Atual */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700">
                    {editingUser?.senha ? 'Senha de Acesso (Inicial ou Redefinição)' : 'Cadastrar Senha Inicial *'}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const gen = generateRandomPassword();
                      setEditInitialPassword(gen);
                      setShowEditPassword(true);
                    }}
                    className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer text-[11px]"
                  >
                    <Sparkles className="w-3 h-3" /> Gerar Aleatória
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showEditPassword ? 'text' : 'password'}
                    value={editInitialPassword}
                    onChange={(e) => setEditInitialPassword(e.target.value)}
                    placeholder={editingUser?.senha ? 'Digite para alterar a senha' : 'Defina a senha inicial (mín. 4 caracteres)'}
                    className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showEditPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Opções de Primeiro Acesso */}
              {editRole === 'COLABORADOR' && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <span className="font-bold text-slate-800 block text-xs">Regras de Acesso do Colaborador:</span>
                  <label className="flex items-start gap-2 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={editExigirCompletarCadastro}
                      onChange={(e) => setEditExigirCompletarCadastro(e.target.checked)}
                      className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>
                      <strong>Exigir conclusão cadastral antes do holerite:</strong> O funcionário só poderá visualizar seu holerite após preencher endereço residencial e pelo menos um telefone de emergência.
                    </span>
                  </label>

                  <label className="flex items-start gap-2 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={editPrecisaTrocarSenha}
                      onChange={(e) => setEditPrecisaTrocarSenha(e.target.checked)}
                      className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>
                      <strong>Obrigatoriamente alterar a senha no primeiro acesso:</strong> O colaborador deverá criar uma nova senha pessoal confidencial.
                    </span>
                  </label>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sub-Modal: Confirmação de Exclusão de Usuário */}
      {userToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95">
            <div className="bg-rose-600 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-100" />
                <h4 className="font-bold text-sm">Excluir Usuário do Sistema</h4>
              </div>
              <button
                onClick={() => setUserToDelete(null)}
                className="text-rose-100 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <p className="text-slate-700 leading-relaxed">
                Tem certeza de que deseja excluir o acesso do usuário <strong className="text-slate-900">{userToDelete.nome}</strong>
                {userToDelete.email ? ` (${userToDelete.email})` : ''}?
              </p>

              {userToDelete.employeeCodigo && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-start gap-2">
                  <Building className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span className="leading-tight">
                    Este usuário está vinculado à Matrícula <strong>#{userToDelete.employeeCodigo}</strong>. A exclusão removerá as credenciais de login, mantendo o histórico de holerites preservado no sistema.
                  </span>
                </div>
              )}

              <p className="text-slate-500 text-[11px]">
                Esta ação revogará imediatamente o login deste usuário.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setUserToDelete(null)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmDelete()}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  Confirmar Exclusão
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
