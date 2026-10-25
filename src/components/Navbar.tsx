import React from 'react';
import { Employee, UserAccount } from '../types';
import logoHolerite from '../Images/LogoHolerite.png';
import {
  User,
  Shield,
  Sparkles,
  LogOut,
  Mail,
  KeyRound
} from 'lucide-react';

interface NavbarProps {
  currentView: 'EMPLOYEE' | 'ADMIN';
  onSwitchView: (view: 'EMPLOYEE' | 'ADMIN') => void;
  employees: Employee[];
  selectedEmployeeId: string;
  onSelectEmployee: (codigo: string) => void;
  onOpenProcessor: () => void;
  currentUser: UserAccount | null;
  onOpenLoginModal: () => void;
  onLogout: () => void;
  isFirebaseConnected?: boolean;
  onOpenEmailSettings?: () => void;
  onOpenUserManagement?: () => void;
  onOpenVerificationModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onSwitchView,
  onOpenProcessor,
  currentUser,
  onLogout,
  onOpenEmailSettings,
  onOpenUserManagement
}) => {
  // Só exibe a barra superior após o login
  if (!currentUser) return null;

  const isGestor = currentUser.role === 'GESTOR';
  const isColaborador = currentUser.role === 'COLABORADOR';

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <img
            src={logoHolerite}
            alt="Holerite - Portal do Colaborador"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-contain shadow-xs border border-slate-200/90 bg-white p-0.5 shrink-0"
          />
          <div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1 className="font-extrabold text-sm sm:text-base tracking-tight text-slate-900">
                Holerite<span className="text-blue-600">Digital</span>
              </h1>
            </div>
            <p className="hidden md:block text-[11px] text-slate-500 font-medium">
              Cartório Francisco José Barbosa Nobre
            </p>
          </div>
        </div>

        {/* View Switcher Tabs */}
        {isColaborador ? (
          /* Colaborador: Exibe exclusivamente a guia referente a ele */
          <div className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl bg-blue-50 text-blue-800 border border-blue-200 text-[11px] sm:text-xs font-bold shadow-xs">
            <User className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="hidden xs:inline sm:inline">Portal do Colaborador</span>
            <span className="xs:hidden">Colaborador</span>
          </div>
        ) : (
          /* Gestor / Admin: Pode alternar entre Portal do Colaborador e Gestão RH */
          <div className="flex items-center bg-slate-100 p-0.5 sm:p-1 rounded-xl text-[11px] sm:text-xs font-semibold">
            <button
              onClick={() => onSwitchView('EMPLOYEE')}
              className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3.5 py-1 sm:py-1.5 rounded-lg transition-all cursor-pointer ${
                currentView === 'EMPLOYEE'
                  ? 'bg-white text-blue-700 shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Portal do Colaborador</span>
              <span className="sm:hidden">Colab</span>
            </button>

            <button
              onClick={() => onSwitchView('ADMIN')}
              className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3.5 py-1 sm:py-1.5 rounded-lg transition-all cursor-pointer ${
                currentView === 'ADMIN'
                  ? 'bg-white text-blue-700 shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Gestão RH / Admin</span>
              <span className="sm:hidden">Gestão</span>
            </button>
          </div>
        )}

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {/* Funções administrativas exibidas apenas para Gestores na aba Gestão RH / Admin */}
          {isGestor && currentView === 'ADMIN' && (
            <>
              <button
                onClick={onOpenProcessor}
                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                title="Importar arquivos PDF da folha de pagamento"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Importar PDF</span>
              </button>

              {onOpenEmailSettings && (
                <button
                  onClick={onOpenEmailSettings}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  title="Abrir configurações de Servidor de E-mail (SMTP)"
                >
                  <Mail className="w-3.5 h-3.5 text-blue-600" />
                  <span className="hidden md:inline">Configurar E-mail</span>
                </button>
              )}

              {onOpenUserManagement && (
                <button
                  onClick={onOpenUserManagement}
                  className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  title="Gerenciar usuários, criar acessos e alterar senhas"
                >
                  <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                  <span className="hidden lg:inline">Usuários & Senhas</span>
                </button>
              )}
            </>
          )}

          {/* User Account / Profile & Logout */}
          <div className="flex items-center gap-2 pl-1 border-l border-slate-200">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-bold text-slate-900 truncate max-w-[140px]">
                {currentUser.nome.split(' ')[0]}
              </span>
              <span className={`text-[10px] font-semibold ${isGestor ? 'text-blue-700' : 'text-emerald-700'}`}>
                {isGestor ? 'Gestor DP' : `Matrícula #${currentUser.employeeCodigo || ''}`}
              </span>
            </div>
            <button
              onClick={onLogout}
              className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold"
              title="Sair do sistema"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
