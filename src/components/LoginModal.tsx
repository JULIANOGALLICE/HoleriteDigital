import React, { useState, useEffect } from 'react';
import { Employee, UserAccount, SystemConfig } from '../types';
import logoHolerite from '../Images/LogoHolerite.png';
import {
  X,
  User,
  Shield,
  LogIn,
  AlertCircle,
  Eye,
  EyeOff,
  Lock,
  Smartphone,
  Mail,
  RefreshCw,
  ArrowLeft,
  CheckCircle2,
  KeyRound
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { sendEvolutionWhatsAppMessage, formatWhatsAppPhone } from '../services/whatsappService';
import { recordLoginEvent } from '../services/loggerService';

interface LoginModalProps {
  isOpen?: boolean;
  isFullScreen?: boolean;
  onClose?: () => void;
  employees: Employee[];
  users?: UserAccount[];
  onLoginSuccess: (user: UserAccount, employee?: Employee) => void;
  systemConfig?: SystemConfig;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen = true,
  isFullScreen = false,
  onClose,
  employees,
  users = [],
  onLoginSuccess,
  systemConfig
}) => {
  const [step, setStep] = useState<'CREDENTIALS' | '2FA'>('CREDENTIALS');
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

  // 2FA State
  const [enteredCode, setEnteredCode] = useState('');
  const [expectedCode, setExpectedCode] = useState('');
  const [pendingUser, setPendingUser] = useState<UserAccount | null>(null);
  const [pendingEmployee, setPendingEmployee] = useState<Employee | null>(null);
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [targetDestination, setTargetDestination] = useState('');
  const [targetChannel, setTargetChannel] = useState<'WHATSAPP' | 'EMAIL' | 'AMBOS'>('WHATSAPP');
  const [resendCountdown, setResendCountdown] = useState(0);

  // Countdown timer for resend
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setInterval(() => {
      setResendCountdown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCountdown]);

  if (!isOpen && !isFullScreen) return null;

  /**
   * Dispara o código de dupla autenticação (2FA) para o usuário via WhatsApp ou E-mail
   */
  const trigger2FALogin = async (user: UserAccount, emp?: Employee) => {
    // Gerar código aleatório de 6 dígitos
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setExpectedCode(code);
    setPendingUser(user);
    setPendingEmployee(emp || null);
    setEnteredCode('');
    setTwoFactorError(null);
    setStep('2FA');
    setResendCountdown(30);

    const preferredChannel = systemConfig?.canal2FALogin || 'WHATSAPP';
    setTargetChannel(preferredChannel);

    // Identificar destino de telefone e email
    const rawPhone = emp?.telefone || (user.employeeCodigo ? employees.find(e => e.codigo === user.employeeCodigo)?.telefone : '');
    const cleanPhone = rawPhone ? formatWhatsAppPhone(rawPhone) : '';
    const emailDest = user.email || emp?.email || '';

    let destDesc = '';
    if (preferredChannel === 'WHATSAPP' && cleanPhone) {
      destDesc = `WhatsApp ${cleanPhone.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, '+$1 ($2) *****-$4')}`;
    } else if (preferredChannel === 'EMAIL' && emailDest) {
      destDesc = `E-mail ${emailDest.replace(/(.{2})(.*)(@.*)/, '$1***$3')}`;
    } else if (preferredChannel === 'AMBOS') {
      destDesc = 'WhatsApp e E-mail cadastrados';
    } else {
      destDesc = emailDest ? `E-mail ${emailDest}` : (cleanPhone ? `WhatsApp ${cleanPhone}` : 'seus canais cadastrados');
    }
    setTargetDestination(destDesc);

    // Despacho real do código 2FA
    setIsSendingCode(true);
    try {
      // 1. WhatsApp Evolution API
      if ((preferredChannel === 'WHATSAPP' || preferredChannel === 'AMBOS' || !emailDest) && cleanPhone && systemConfig) {
        if (systemConfig.evolutionApiUrl && systemConfig.evolutionApiKey && systemConfig.evolutionInstance) {
          sendEvolutionWhatsAppMessage({
            config: systemConfig,
            number: cleanPhone,
            text: `🔐 *CÓDIGO DE ACESSO 2FA - HOLERITEDIGITAL*\nOlá, *${(user.nome || '').split(' ')[0]}*!\n\nSeu código de autenticação para login no portal é:\n👉 *${code}*\n\nInsira este código na tela para concluir seu acesso com segurança.`
          }).catch(() => {});
        }
      }

      // 2. Email SMTP
      if ((preferredChannel === 'EMAIL' || preferredChannel === 'AMBOS' || !cleanPhone) && emailDest) {
        fetch('/api/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: emailDest,
            subject: `[HoleriteDigital] Seu código de acesso 2FA: ${code}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
                <h3 style="color: #0f172a; margin-top: 0; font-size: 18px;">HoleriteDigital • Validação em Duas Etapas</h3>
                <p style="color: #334155; font-size: 14px;">Olá, <strong>${user.nome}</strong>!</p>
                <p style="color: #475569; font-size: 13px;">Seu código de verificação para efetuar login no portal é:</p>
                <div style="background-color: #f1f5f9; padding: 18px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1d4ed8; border-radius: 8px; margin: 16px 0;">
                  ${code}
                </div>
                <p style="font-size: 12px; color: #64748b; margin-top: 16px; line-height: 1.5;">
                  Este código é de uso exclusivo e expira em 10 minutos. Se você não solicitou este acesso, entre em contato imediatamente com o RH.
                </p>
              </div>
            `,
            config: systemConfig
          })
        }).catch(() => {});
      }
    } finally {
      setIsSendingCode(false);
    }
  };

  /**
   * Validação do código 2FA informado pelo usuário
   */
  const handleVerify2FACode = (e: React.FormEvent) => {
    e.preventDefault();
    setTwoFactorError(null);

    const cleanEntered = enteredCode.trim();
    if (!cleanEntered) {
      setTwoFactorError('Digite o código de 6 dígitos recebido.');
      return;
    }

    if (cleanEntered !== expectedCode.trim()) {
      setTwoFactorError('Código 2FA incorreto ou expirado. Verifique os dígitos e tente novamente.');
      if (pendingUser) {
        recordLoginEvent(pendingUser, pendingEmployee || undefined, {
          is2FA: true,
          channel: targetChannel === 'WHATSAPP' ? 'WHATSAPP' : 'EMAIL',
          success: false,
          errorMsg: 'Código 2FA incorreto ou expirado'
        }).catch(() => {});
      }
      return;
    }

    if (pendingUser) {
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      onLoginSuccess(pendingUser, pendingEmployee || undefined);
      if (onClose) onClose();
    }
  };

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
        recordLoginEvent(existingGestor, undefined, {
          is2FA: false,
          success: false,
          errorMsg: 'Senha incorreta para gestor'
        }).catch(() => {});
        return;
      }

      if (systemConfig?.exigir2FALogin) {
        trigger2FALogin(existingGestor);
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

      const matchedMasterEmp = employees.find(
        emp =>
          (emp.email && emp.email.toLowerCase() === cleanEmail) ||
          emp.nome.toLowerCase().includes('juliano')
      );

      const masterUser: UserAccount = {
        uid: 'gestor-juliano-master',
        email: cleanEmail,
        role: 'GESTOR',
        employeeCodigo: matchedMasterEmp?.codigo,
        nome: 'Juliano César Gallice',
        criadoEm: new Date().toISOString()
      };

      if (systemConfig?.exigir2FALogin) {
        trigger2FALogin(masterUser);
        return;
      }

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

      if (systemConfig?.exigir2FALogin) {
        trigger2FALogin(anyUser);
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
        recordLoginEvent(userAcc, emp, {
          is2FA: false,
          success: false,
          errorMsg: 'Senha incorreta para colaborador'
        }).catch(() => {});
        return;
      }

      if (systemConfig?.exigir2FALogin) {
        trigger2FALogin(userAcc, emp);
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
            {systemConfig?.razaoSocial || 'FRANCISCO JOSE BARBOSA NOBRE'}
          </p>
        </div>

        {/* STEP 1: CREDENTIALS */}
        {step === 'CREDENTIALS' && (
          <>
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
                    Acesso restrito aos responsáveis pelo Departamento Pessoal e Administração.
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
          </>
        )}

        {/* STEP 2: DUPLA AUTENTICAÇÃO (2FA) */}
        {step === '2FA' && (
          <div className="p-6 space-y-4 text-xs">
            {/* Header 2FA */}
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 mx-auto flex items-center justify-center shadow-xs">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-base text-slate-900">
                Dupla Autenticação (2FA)
              </h3>
              <p className="text-[11.5px] text-slate-600 leading-relaxed max-w-sm mx-auto">
                Para sua segurança, enviamos um código de verificação de 6 dígitos para {targetDestination || 'seu canal cadastrado'}.
              </p>
            </div>

            {/* Form 2FA Code */}
            <form onSubmit={handleVerify2FACode} className="space-y-4">
              <div>
                <label className="block text-slate-700 font-bold mb-1.5 text-center text-xs">
                  Digite o código de 6 dígitos
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={enteredCode}
                  onChange={(e) => setEnteredCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  autoFocus
                  autoComplete="one-time-code"
                  className="w-full text-center tracking-[0.4em] font-mono text-2xl font-black py-3 border-2 border-blue-400 focus:border-blue-600 rounded-2xl bg-blue-50/30 text-blue-950 focus:outline-none shadow-inner"
                  required
                />
              </div>

              {twoFactorError && (
                <div className="p-2.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-[11px] flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {twoFactorError}
                </div>
              )}



              <button
                type="submit"
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
              >
                <CheckCircle2 className="w-4 h-4" />
                Confirmar Código e Acessar
              </button>

              {/* Action buttons: Resend and Back */}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setStep('CREDENTIALS');
                    setEnteredCode('');
                    setTwoFactorError(null);
                  }}
                  className="text-[11px] text-slate-500 hover:text-slate-800 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Voltar
                </button>

                <button
                  type="button"
                  disabled={resendCountdown > 0 || isSendingCode}
                  onClick={() => {
                    if (pendingUser) {
                      trigger2FALogin(pendingUser, pendingEmployee || undefined);
                    }
                  }}
                  className={`text-[11px] font-semibold flex items-center gap-1 transition-colors ${
                    resendCountdown > 0 || isSendingCode
                      ? 'text-slate-400 cursor-not-allowed'
                      : 'text-blue-600 hover:text-blue-800 cursor-pointer'
                  }`}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSendingCode ? 'animate-spin' : ''}`} />
                  {resendCountdown > 0 ? `Reenviar código (${resendCountdown}s)` : 'Reenviar código'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="p-3 bg-slate-50 border-t border-slate-200 text-center text-[10.5px] text-slate-500">
          Acesso seguro e auditado conforme CLT Art. 464 e LGPD
        </div>
      </div>
    </div>
  );
};
