import React, { useState } from 'react';
import { Employee, UserAccount, EmergencyContact, Address } from '../types';
import logoHolerite from '../Images/LogoHolerite.png';
import {
  ShieldCheck,
  Lock,
  KeyRound,
  Phone,
  PhoneCall,
  User,
  Users,
  MapPin,
  Building,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  LogOut,
  Save,
  Plus,
  Trash2,
  Sparkles,
  AlertTriangle,
  Search
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface MandatoryRegistrationModalProps {
  isOpen: boolean;
  employee: Employee;
  currentUser: UserAccount;
  onComplete: (updatedEmployee: Employee, updatedUser: UserAccount) => Promise<void> | void;
  onLogout: () => void;
}

export const MandatoryRegistrationModal: React.FC<MandatoryRegistrationModalProps> = ({
  isOpen,
  employee,
  currentUser,
  onComplete,
  onLogout
}) => {
  // Password fields
  const [currentPassword, setCurrentPassword] = useState(currentUser.senha || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Personal contacts
  const [telefone, setTelefone] = useState(employee.telefone || '');
  const [email, setEmail] = useState(employee.email || currentUser.email || '');
  const [cpf, setCpf] = useState(employee.cpf || '');
  const [dataNascimento, setDataNascimento] = useState(employee.dataNascimento || '');

  // Address
  const [endereco, setEndereco] = useState<Address>({
    cep: employee.endereco?.cep || '',
    logradouro: employee.endereco?.logradouro || '',
    numero: employee.endereco?.numero || '',
    complemento: employee.endereco?.complemento || '',
    bairro: employee.endereco?.bairro || '',
    cidade: employee.endereco?.cidade || 'Uberaba',
    uf: employee.endereco?.uf || 'MG'
  });
  const [isSearchingCep, setIsSearchingCep] = useState(false);

  // Emergency Contacts (At least 1 required!)
  const initialContacts: EmergencyContact[] =
    Array.isArray(employee.contatosFamiliares) && employee.contatosFamiliares.length > 0
      ? employee.contatosFamiliares
      : [
          {
            id: `cf-${Date.now()}`,
            nome: '',
            parentesco: 'Cônjuge',
            telefone: '',
            observacao: ''
          }
        ];

  const [contatos, setContatos] = useState<EmergencyContact[]>(initialContacts);

  // Validation feedback
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  // CEP lookup via ViaCEP
  const handleCepBlur = async () => {
    const cleanCep = endereco.cep.replace(/\D/g, '');
    if (cleanCep.length === 8) {
      setIsSearchingCep(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setEndereco(prev => ({
            ...prev,
            logradouro: data.logradouro || prev.logradouro,
            bairro: data.bairro || prev.bairro,
            cidade: data.localidade || prev.cidade,
            uf: data.uf || prev.uf
          }));
        }
      } catch (e) {
        console.warn('ViaCEP lookup error:', e);
      } finally {
        setIsSearchingCep(false);
      }
    }
  };

  const handleAddContact = () => {
    setContatos(prev => [
      ...prev,
      {
        id: `cf-${Date.now()}-${Math.random()}`,
        nome: '',
        parentesco: 'Familiar',
        telefone: '',
        observacao: ''
      }
    ]);
  };

  const handleUpdateContact = (index: number, field: keyof EmergencyContact, value: string) => {
    setContatos(prev => {
      const copy = [...prev];
      if (copy[index]) {
        copy[index] = { ...copy[index], [field]: value };
      }
      return copy;
    });
  };

  const handleRemoveContact = (index: number) => {
    if (contatos.length <= 1) {
      setErrorMsg('É obrigatório manter pelo menos um contato de emergência cadastrado.');
      return;
    }
    setContatos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // 1. Password check (if required)
    const requiresPasswordChange = currentUser.precisaTrocarSenha === true;
    if (requiresPasswordChange) {
      if (!newPassword || newPassword.trim().length < 4) {
        setErrorMsg('Por favor, defina sua nova senha pessoal com no mínimo 4 caracteres.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrorMsg('A confirmação da nova senha não confere com a nova senha digitada.');
        return;
      }
    }

    // 2. Personal contact check
    if (!telefone.trim() || telefone.trim().replace(/\D/g, '').length < 8) {
      setErrorMsg('Informe seu telefone celular ou WhatsApp pessoal com DDD para contato.');
      return;
    }

    // 3. Emergency contact check (STRICT REQUIREMENT)
    const validEmergencyContacts = contatos.filter(
      c => c.nome.trim().length > 1 && c.telefone.trim().replace(/\D/g, '').length >= 8
    );

    if (validEmergencyContacts.length === 0) {
      setErrorMsg(
        'Atenção: É obrigatório cadastrar pelo menos um Telefone de Emergência com Nome e Número válidos antes de visualizar seu holerite.'
      );
      return;
    }

    // 4. Address check
    if (!endereco.logradouro.trim() || !endereco.numero.trim() || !endereco.cidade.trim()) {
      setErrorMsg('Por favor, informe seu endereço residencial completo (Logradouro, Número e Cidade).');
      return;
    }

    setIsSubmitting(true);

    try {
      const updatedEmployee: Employee = {
        ...employee,
        cpf: cpf.trim() || employee.cpf,
        email: email.trim() || employee.email,
        telefone: telefone.trim(),
        dataNascimento: dataNascimento || employee.dataNascimento,
        endereco: {
          ...endereco,
          cep: endereco.cep.trim(),
          logradouro: endereco.logradouro.trim(),
          numero: endereco.numero.trim(),
          bairro: endereco.bairro.trim(),
          cidade: endereco.cidade.trim(),
          uf: endereco.uf.trim().toUpperCase()
        },
        contatosFamiliares: validEmergencyContacts,
        dadosBancarios: employee.dadosBancarios,
        cadastroCompleto: true
      };

      const updatedUser: UserAccount = {
        ...currentUser,
        email: email.trim() || currentUser.email,
        senha: newPassword.trim() ? newPassword.trim() : currentUser.senha,
        precisaTrocarSenha: false,
        primeiroAcessoConcluido: true,
        exigirCompletarCadastro: false
      };

      await onComplete(updatedEmployee, updatedUser);
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    } catch (err: any) {
      console.error('Erro ao salvar cadastro do colaborador:', err);
      setErrorMsg(`Erro ao salvar cadastro: ${err?.message || 'Tente novamente.'}`);
      setIsSubmitting(false);
    }
  };

  const hasAtLeastOneEmergency = contatos.some(
    c => c.nome.trim().length > 1 && c.telefone.trim().replace(/\D/g, '').length >= 8
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-5 sm:p-6 border-b border-slate-800 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white p-1 border border-white/20 flex items-center justify-center shrink-0 shadow-md">
              <img src={logoHolerite} alt="Holerite" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-extrabold uppercase tracking-wider bg-blue-500/20 text-blue-300 px-2.5 py-0.5 rounded-full border border-blue-400/30">
                  Primeiro Acesso Obrigatório • CLT Art. 464
                </span>
                <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-400/30">
                  Matrícula #{employee.codigo}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white mt-1">
                Conclusão Cadastral & Definição de Senha
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Olá, <strong>{employee.nome}</strong>! Complete seus dados cadastrais e cadastre ao menos um telefone de emergência antes de visualizar seu holerite.
              </p>
            </div>
          </div>

          <button
            onClick={onLogout}
            title="Sair do sistema e preencher em outro momento"
            className="text-slate-400 hover:text-rose-300 hover:bg-slate-800/80 p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>

        {/* Requirements Checklist Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex flex-wrap items-center gap-2 text-[11px]">
          <span className="font-bold text-slate-700 mr-2 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            Obrigatoriedades:
          </span>
          <span
            className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 ${
              currentUser.precisaTrocarSenha && !newPassword
                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
            }`}
          >
            <Lock className="w-3 h-3" />
            {currentUser.precisaTrocarSenha && !newPassword ? '1. Nova Senha Pendente' : '1. Senha Pronta'}
          </span>

          <span
            className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 ${
              !hasAtLeastOneEmergency
                ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
            }`}
          >
            <PhoneCall className="w-3 h-3" />
            {!hasAtLeastOneEmergency ? '2. Telefone Emergência (Obrigatório)' : '2. Emergência Cadastrado'}
          </span>

          <span
            className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 ${
              !endereco.logradouro || !endereco.numero
                ? 'bg-slate-200 text-slate-700'
                : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
            }`}
          >
            <MapPin className="w-3 h-3" />
            3. Endereço Completo
          </span>

        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 text-xs">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-2xl text-rose-800 flex items-start gap-2.5 text-xs shadow-xs">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="font-semibold leading-relaxed">{errorMsg}</div>
            </div>
          )}

          {/* 1. SEÇÃO: Troca Obrigatória de Senha */}
          {currentUser.precisaTrocarSenha && (
            <div className="bg-amber-50/60 border border-amber-200/90 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-xs">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-amber-950">
                    1. Alteração Obrigatória da Senha de Acesso
                  </h3>
                  <p className="text-[11px] text-amber-800">
                    A senha cadastrada pelo Gestor é temporária. Crie uma nova senha pessoal confidencial.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                <div className="space-y-1">
                  <label className="font-bold text-slate-800 flex items-center justify-between">
                    <span>Nova Senha Pessoal *</span>
                    <span className="text-[10px] text-slate-500 font-normal">Mínimo 4 caracteres</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Crie sua nova senha"
                      className="w-full px-3.5 py-2.5 pr-10 border border-slate-300 rounded-xl bg-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-800">Confirmar Nova Senha *</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repita a nova senha"
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl bg-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/* 2. SEÇÃO: CONTATO DE EMERGÊNCIA (OBRIGATÓRIO) */}
          <div className="bg-emerald-50/60 border-2 border-emerald-400/80 rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                  <PhoneCall className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-sm text-emerald-950">
                      2. Telefone de Emergência & Contatos Familiares *
                    </h3>
                    <span className="text-[10px] bg-emerald-200 text-emerald-900 font-extrabold px-2 py-0.5 rounded-full">
                      Exigido pelo RH
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-800">
                    Obrigatório cadastrar pelo menos uma pessoa de confiança para urgências corporativas.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddContact}
                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Adicionar Outro Contato</span>
              </button>
            </div>

            <div className="space-y-3">
              {contatos.map((contato, idx) => (
                <div
                  key={contato.id || idx}
                  className="bg-white border border-emerald-200 rounded-xl p-3.5 shadow-xs space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-emerald-600" />
                      Contato #{idx + 1} {idx === 0 ? '(Principal / Emergência)' : ''}
                    </span>
                    {contatos.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveContact(idx)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded-lg transition-colors cursor-pointer"
                        title="Remover este contato"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1 sm:col-span-1">
                      <label className="font-bold text-slate-700">Nome do Contato *</label>
                      <input
                        type="text"
                        value={contato.nome}
                        onChange={e => handleUpdateContact(idx, 'nome', e.target.value)}
                        placeholder="Ex: Maria da Silva"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Grau de Parentesco *</label>
                      <select
                        value={contato.parentesco}
                        onChange={e => handleUpdateContact(idx, 'parentesco', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        required
                      >
                        <option value="Cônjuge">Cônjuge / Esposo(a)</option>
                        <option value="Mãe">Mãe</option>
                        <option value="Pai">Pai</option>
                        <option value="Filho(a)">Filho(a)</option>
                        <option value="Irmão/Irmã">Irmão/Irmã</option>
                        <option value="Tio(a)">Tio(a)</option>
                        <option value="Outro Familiar">Outro Familiar</option>
                        <option value="Amigo(a)">Amigo(a) / Vizinho</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Telefone com DDD *</label>
                      <input
                        type="tel"
                        value={contato.telefone}
                        onChange={e => handleUpdateContact(idx, 'telefone', e.target.value)}
                        placeholder="(34) 99999-9999"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-500">
                      Observação / Horário de Contato (Opcional)
                    </label>
                    <input
                      type="text"
                      value={contato.observacao || ''}
                      onChange={e => handleUpdateContact(idx, 'observacao', e.target.value)}
                      placeholder="Ex: Contato comercial ou recado com vizinho"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. SEÇÃO: Contatos do Próprio Colaborador */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-xs">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center font-bold text-sm shadow-xs">
                <User className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">
                  3. Seus Dados Pessoais de Contato
                </h3>
                <p className="text-[11px] text-slate-500">
                  Mantenha seu telefone celular atualizado para notificações e autenticação em duas etapas (2FA).
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Seu Celular / WhatsApp *</label>
                <input
                  type="tel"
                  value={telefone}
                  onChange={e => setTelefone(e.target.value)}
                  placeholder="(34) 99999-9999"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Seu E-mail *</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu.email@exemplo.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">CPF do Colaborador</label>
                <input
                  type="text"
                  value={cpf}
                  onChange={e => setCpf(e.target.value)}
                  placeholder="000.000.000-00"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* 4. SEÇÃO: Endereço Residencial Completo */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-xs">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center font-bold text-sm shadow-xs">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">
                  4. Endereço Residencial Completo
                </h3>
                <p className="text-[11px] text-slate-500">
                  Digite seu CEP para preenchimento automático das informações de endereço.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 flex items-center justify-between">
                  <span>CEP *</span>
                  {isSearchingCep && <span className="text-[10px] text-blue-600 animate-pulse font-normal">Buscando...</span>}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={endereco.cep}
                    onChange={e => setEndereco({ ...endereco, cep: e.target.value })}
                    onBlur={handleCepBlur}
                    placeholder="38000-000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="font-bold text-slate-700">Logradouro (Rua, Av.) *</label>
                <input
                  type="text"
                  value={endereco.logradouro}
                  onChange={e => setEndereco({ ...endereco, logradouro: e.target.value })}
                  placeholder="Ex: Rua São Benedito"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Número *</label>
                <input
                  type="text"
                  value={endereco.numero}
                  onChange={e => setEndereco({ ...endereco, numero: e.target.value })}
                  placeholder="Ex: 123"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Complemento</label>
                <input
                  type="text"
                  value={endereco.complemento || ''}
                  onChange={e => setEndereco({ ...endereco, complemento: e.target.value })}
                  placeholder="Apto 101, Bloco B"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Bairro *</label>
                <input
                  type="text"
                  value={endereco.bairro}
                  onChange={e => setEndereco({ ...endereco, bairro: e.target.value })}
                  placeholder="Centro"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Cidade *</label>
                <input
                  type="text"
                  value={endereco.cidade}
                  onChange={e => setEndereco({ ...endereco, cidade: e.target.value })}
                  placeholder="Uberaba"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">UF *</label>
                <input
                  type="text"
                  value={endereco.uf}
                  maxLength={2}
                  onChange={e => setEndereco({ ...endereco, uf: e.target.value.toUpperCase() })}
                  placeholder="MG"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium text-center focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>
            </div>
          </div>

          {/* Bottom Confirmation Action */}
          <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-[11px] text-slate-500">
              Ao confirmar, seus dados serão registrados no servidor seguro do RH com certificado digital.
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onLogout}
                className="px-4 py-2.5 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl font-bold transition-colors cursor-pointer text-xs"
              >
                Sair / Preencher Depois
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold text-xs shadow-lg flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                <span>
                  {isSubmitting ? 'Salvando e liberando...' : 'Salvar Cadastro e Liberar Holerite'}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
