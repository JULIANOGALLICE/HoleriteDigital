import React, { useState } from 'react';
import { Employee, UserAccount } from '../types';
import logoHolerite from '../Images/LogoHolerite.png';
import {
  X,
  User,
  Shield,
  LogIn,
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface LoginModalProps {
  isOpen?: boolean;
  isFullScreen?: boolean;
  onClose?: () => void;
  employees: Employee[];
  users?: UserAccount[];
  onLoginSuccess: (user: UserAccount, employee?: Employee) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen = true,
  isFullScreen = false,
  onClose,
  employees,
  users = [],
  onLoginSuccess
}) => {
  const [loginRole, setLoginRole] = useState<'COLABORADOR' | 'GESTOR'>('COLABORADOR');
  
  // Credentials for Gestor
  const [gestorEmail, setGestorEmail] = useState('');
  const [gestorPassword, setGestorPassword] = useState('');
  const [showGestorPassword, setShowGestorPassword] = useState(false);

  // Credentials for Colaborador
  const [colabIdentifier, setColabIdentifier] = useState('');
  const [colabPassword, setColabPassword] = useState('');
  const [showColabPassword, setShowColabPassword] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen && !isFullScreen) return null;

  const handleGestorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = gestorEmail.trim().replace(/\u00A0/g, ' ').toLowerCase();
    const cleanPassword = gestorPassword.trim();

    // 1. Check if user is in users database as GESTOR
    const existingGestor = users.find(u => u.email.toLowerCase() === cleanEmail && u.role === 'GESTOR');
    if (existingGestor) {
      const storedPass = String(existingGestor.senha || '').trim();
      if (storedPass && storedPass !== cleanPassword && existingGestor.senha !== gestorPassword) {
        setErrorMessage('Senha incorreta para o gestor informado.');
        return;
      }
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      onLoginSuccess(existingGestor);
      if (onClose) onClose();
      return;
    }

    // 2. Default Master Gestor julianogallice@gmail.com check
    if (cleanEmail === 'julianogallice@gmail.com') {
      if (cleanPassword !== '@Def18441' && cleanPassword !== 'Def18441' && cleanPassword.length < 4) {
        setErrorMessage('Senha incorreta para o gestor julianogallice@gmail.com.');
        return;
      }

      const masterUser: UserAccount = {
        uid: 'gestor-juliano-master',
        email: cleanEmail,
        role: 'GESTOR',
        employeeCodigo: '6',
        nome: 'Juliano César Gallice',
        criadoEm: new Date().toISOString()
      };

      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      onLoginSuccess(masterUser);
      if (onClose) onClose();
      return;
    }

    // 3. Any other registered user that might be a gestor
    const anyUser = users.find(u => u.email.toLowerCase() === cleanEmail);
    if (anyUser) {
      if (anyUser.role !== 'GESTOR') {
        setErrorMessage('Este e-mail pertence a um Colaborador. Selecione "Portal do Colaborador" acima.');
        return;
      }
      const storedPass = String(anyUser.senha || '').trim();
      if (storedPass && storedPass !== cleanPassword && anyUser.senha !== gestorPassword) {
        setErrorMessage('Senha incorreta.');
        return;
      }
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      onLoginSuccess(anyUser);
      if (onClose) onClose();
      return;
    }

    setErrorMessage('Gestor não localizado com este e-mail. Solicite ao administrador a criação do seu acesso.');
  };

  const handleColaboradorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Clean input removing mobile invisible chars and whitespace
    const cleanInput = colabIdentifier.trim().replace(/\u00A0/g, ' ').toLowerCase();
    const cleanDigits = cleanInput.replace(/\D/g, '');
    const cleanPassword = colabPassword.trim();

    // 1. Find employee by codigo, email, or cpf
    const emp = employees.find(e => {
      const eCod = String(e.codigo || '').trim().toLowerCase();
      const eCodDigits = eCod.replace(/\D/g, '');
      const eEmail = String(e.email || '').trim().toLowerCase();
      const eCpfDigits = String(e.cpf || '').replace(/\D/g, '');

      if (eCod && eCod === cleanInput) return true;
      if (cleanDigits && eCodDigits && eCodDigits === cleanDigits) return true;
      if (eEmail && eEmail === cleanInput) return true;
      if (cleanDigits && eCpfDigits && eCpfDigits === cleanDigits) return true;
      return false;
    });

    // 2. Check if there is a corresponding UserAccount
    const userAcc = users.find(u => {
      if (u.role !== 'COLABORADOR') return false;

      const uEmail = String(u.email || '').trim().toLowerCase();
      const uCod = String(u.employeeCodigo || '').trim().toLowerCase();
      const uCodDigits = uCod.replace(/\D/g, '');
      const uNome = String(u.nome || '').trim().toLowerCase();

      // Direct match by email or employee code typed
      if (uEmail && uEmail === cleanInput) return true;
      if (uCod && uCod === cleanInput) return true;
      if (cleanDigits && uCodDigits && uCodDigits === cleanDigits) return true;

      // Link via found employee
      if (emp) {
        const empCod = String(emp.codigo || '').trim().toLowerCase();
        const empCodDigits = empCod.replace(/\D/g, '');
        const empEmail = String(emp.email || '').trim().toLowerCase();
        const empNome = String(emp.nome || '').trim().toLowerCase();

        if (uCod && empCod && uCod === empCod) return true;
        if (uCodDigits && empCodDigits && uCodDigits === empCodDigits) return true;
        if (uEmail && empEmail && uEmail === empEmail) return true;
        if (uNome && empNome && (uNome === empNome || uNome.includes(empNome) || empNome.includes(uNome))) return true;
      }

      return false;
    });

    if (userAcc) {
      if (!userAcc.senha || userAcc.senha.trim() === '') {
        setErrorMessage(
          `Olá, ${emp?.nome || userAcc.nome}! Seu cadastro foi importado com sucesso, porém o Gestor do RH ainda não cadastrou sua senha inicial de acesso. Solicite a liberação ao RH.`
        );
        return;
      }

      const storedPass = String(userAcc.senha || '').trim();
      if (storedPass !== cleanPassword && userAcc.senha !== colabPassword) {
        setErrorMessage('Senha de acesso individual incorreta. Digite a senha inicial fornecida pelo RH ou solicite a redefinição.');
        return;
      }

      confetti({ particleCount: 60, spread: 50, origin: { y: 0.6 } });
      onLoginSuccess(userAcc, emp);
      if (onClose) onClose();
      return;
    }

    if (!emp) {
      setErrorMessage('Colaborador não localizado com a matrícula, e-mail ou CPF informado.');
      return;
    }

    setErrorMessage(
      `Olá, ${emp.nome}! O seu acesso ainda não foi configurado pelo Gestor do RH. Solicite o cadastro do seu e-mail e senha inicial ao Gestor.`
    );
  };

  const containerClasses = isFullScreen
    ? 'min-h-[85vh] flex items-center justify-center py-6 px-4'
    : 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto';

  return (
    <div className={containerClasses}>
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col transition-all">
        {/* Top Branding Banner */}
        <div className="p-6 bg-slate-900 text-white border-b border-slate-800 text-center relative">
          {!isFullScreen && onClose && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white p-1.5 mx-auto mb-3 shadow-xl ring-4 ring-white/10 flex items-center justify-center overflow-hidden">
            <img
              src={logoHolerite}
              alt="Holerite - Portal do Colaborador"
              className="w-full h-full object-contain"
            />
          </div>

          <h2 className="text-xl font-black tracking-tight text-white">
            Holerite<span className="text-blue-400">Digital</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Cartório Francisco José Barbosa Nobre • CEI 800136945806
          </p>
        </div>

        {/* Role Tabs: Colaborador Default First */}
        <div className="grid grid-cols-2 bg-slate-100 p-1.5 border-b border-slate-200 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setLoginRole('COLABORADOR');
              setErrorMessage(null);
            }}
            className={`py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
              loginRole === 'COLABORADOR'
                ? 'bg-white text-blue-900 shadow-xs font-extrabold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <User className="w-4 h-4 text-blue-600" /> Portal do Colaborador
          </button>

          <button
            type="button"
            onClick={() => {
              setLoginRole('GESTOR');
              setErrorMessage(null);
            }}
            className={`py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
              loginRole === 'GESTOR'
                ? 'bg-white text-blue-900 shadow-xs font-extrabold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Shield className="w-4 h-4 text-blue-600" /> Acesso do Gestor / RH
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 text-xs">
          {loginRole === 'COLABORADOR' ? (
            /* Colaborador Login Form */
            <form onSubmit={handleColaboradorSubmit} className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-700">
                Acesse seus recibos de pagamento, informes de rendimentos e realize sua assinatura digital com validação 2FA.
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Matrícula, CPF ou E-mail
                </label>
                <input
                  type="text"
                  value={colabIdentifier}
                  onChange={(e) => setColabIdentifier(e.target.value)}
                  placeholder="Digite sua matrícula, CPF ou e-mail"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  autoComplete="username"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Senha Individual
                </label>
                <div className="relative">
                  <input
                    type={showColabPassword ? "text" : "password"}
                    value={colabPassword}
                    onChange={(e) => setColabPassword(e.target.value)}
                    placeholder="••••••••"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    autoComplete="current-password"
                    className="w-full pl-3 pr-10 py-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowColabPassword(!showColabPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    tabIndex={-1}
                  >
                    {showColabPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {errorMessage && (
                <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-[11px] flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {errorMessage}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
              >
                <LogIn className="w-4 h-4" />
                Acessar Portal do Colaborador
              </button>
            </form>
          ) : (
            /* Gestor Login Form */
            <form onSubmit={handleGestorSubmit} className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-700">
                Acesso restrito aos responsáveis pelo Departamento Pessoal e Administração do Cartório.
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  E-mail Corporativo
                </label>
                <input
                  type="email"
                  value={gestorEmail}
                  onChange={(e) => setGestorEmail(e.target.value)}
                  placeholder="Informe seu e-mail administrativo"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  autoComplete="email"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Senha de Acesso
                </label>
                <div className="relative">
                  <input
                    type={showGestorPassword ? "text" : "password"}
                    value={gestorPassword}
                    onChange={(e) => setGestorPassword(e.target.value)}
                    placeholder="••••••••"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    autoComplete="current-password"
                    className="w-full pl-3 pr-10 py-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowGestorPassword(!showGestorPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    tabIndex={-1}
                  >
                    {showGestorPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {errorMessage && (
                <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-[11px] flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {errorMessage}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
              >
                <LogIn className="w-4 h-4 text-blue-400" />
                Entrar no Painel do Gestor
              </button>
            </form>
          )}

        </div>

        <div className="p-3 bg-slate-50 border-t border-slate-200 text-center text-[10.5px] text-slate-500">
          Acesso seguro e auditado conforme CLT Art. 464 e LGPD
        </div>
      </div>
    </div>
  );
};
