import React, { useState } from 'react';
import { Employee, EmergencyContact } from '../types';
import {
  X,
  Save,
  User,
  Phone,
  Mail,
  MapPin,
  Building,
  CreditCard,
  Plus,
  Trash2,
  Users
} from 'lucide-react';

interface EmployeeEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
  onSave: (updated: Employee) => void;
}

function buildEmployeeFormData(emp: Employee | null): Employee {
  return {
    codigo: emp?.codigo || '',
    nome: emp?.nome || '',
    cpf: emp?.cpf || '',
    cargo: emp?.cargo || '',
    departamento: emp?.departamento || '',
    filial: emp?.filial || 'Matriz',
    salarioBase: emp?.salarioBase || 0,
    status: emp?.status || 'ATIVO',
    cbo: emp?.cbo || '',
    dataAdmissao: emp?.dataAdmissao || '',
    email: emp?.email || '',
    telefone: emp?.telefone || '',
    pisPasep: emp?.pisPasep || '',
    dataNascimento: emp?.dataNascimento || '',
    observacoes: emp?.observacoes || '',
    role: emp?.role || 'COLABORADOR',
    authUid: emp?.authUid || '',
    contatosFamiliares: Array.isArray(emp?.contatosFamiliares) ? [...emp.contatosFamiliares] : [],
    endereco: {
      cep: emp?.endereco?.cep || '',
      logradouro: emp?.endereco?.logradouro || '',
      numero: emp?.endereco?.numero || '',
      bairro: emp?.endereco?.bairro || '',
      cidade: emp?.endereco?.cidade || '',
      uf: emp?.endereco?.uf || 'MG',
      complemento: emp?.endereco?.complemento || ''
    },
    dadosBancarios: {
      banco: emp?.dadosBancarios?.banco || '',
      agencia: emp?.dadosBancarios?.agencia || '',
      conta: emp?.dadosBancarios?.conta || '',
      tipoConta: emp?.dadosBancarios?.tipoConta || 'CORRENTE',
      chavePix: emp?.dadosBancarios?.chavePix || ''
    }
  };
}

export const EmployeeEditModal: React.FC<EmployeeEditModalProps> = ({
  isOpen,
  onClose,
  employee,
  onSave
}) => {
  const [prevEmployee, setPrevEmployee] = useState<Employee | null>(employee);
  const [formData, setFormData] = useState<Employee>(() => buildEmployeeFormData(employee));
  const [activeTab, setActiveTab] = useState<'DADOS' | 'CONTATOS' | 'ENDERECO' | 'BANCARIOS'>('DADOS');

  // Immediately synchronize during render if employee prop changed
  if (employee !== prevEmployee) {
    setPrevEmployee(employee);
    setFormData(buildEmployeeFormData(employee));
  }

  if (!isOpen || !employee) return null;

  const handleAddFamilyContact = () => {
    const newContact: EmergencyContact = {
      id: 'cf-' + Date.now(),
      nome: '',
      parentesco: 'Esposa(o)',
      telefone: '',
      observacao: ''
    };
    setFormData(prev => ({
      ...prev,
      contatosFamiliares: [...(prev.contatosFamiliares || []), newContact]
    }));
  };

  const handleUpdateFamilyContact = (index: number, field: keyof EmergencyContact, value: string) => {
    setFormData(prev => {
      const updated = [...(prev.contatosFamiliares || [])];
      if (updated[index]) {
        updated[index] = { ...updated[index], [field]: value };
      }
      return { ...prev, contatosFamiliares: updated };
    });
  };

  const handleRemoveFamilyContact = (index: number) => {
    setFormData(prev => ({
      ...prev,
      contatosFamiliares: (prev.contatosFamiliares || []).filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const hasEmergency = Array.isArray(formData.contatosFamiliares) && formData.contatosFamiliares.some(c => c.nome?.trim() && c.telefone?.trim());
    const isComplete = Boolean(formData.telefone?.trim() && formData.endereco?.logradouro?.trim() && hasEmergency);
    onSave({
      ...formData,
      cadastroCompleto: isComplete
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
              {employee.codigo}
            </div>
            <div>
              <h3 className="font-bold text-base text-white">{employee.nome}</h3>
              <p className="text-xs text-slate-400">
                Código: <span className="font-mono text-blue-300 font-semibold">{employee.codigo}</span> • {employee.cargo}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 text-xs font-semibold text-slate-600 gap-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('DADOS')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap ${
              activeTab === 'DADOS' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent hover:text-slate-900'
            }`}
          >
            <User className="w-4 h-4" /> Dados Gerais & Cargo
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('CONTATOS')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap ${
              activeTab === 'CONTATOS' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" /> Telefones de Familiares ({(formData.contatosFamiliares || []).length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ENDERECO')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap ${
              activeTab === 'ENDERECO' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent hover:text-slate-900'
            }`}
          >
            <MapPin className="w-4 h-4" /> Endereço
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('BANCARIOS')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap ${
              activeTab === 'BANCARIOS' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent hover:text-slate-900'
            }`}
          >
            <CreditCard className="w-4 h-4" /> Dados Bancários
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
          {activeTab === 'DADOS' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Nome Completo</label>
                  <input
                    type="text"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Cargo / Função</label>
                  <input
                    type="text"
                    value={formData.cargo}
                    onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Departamento / Setor</label>
                  <input
                    type="text"
                    value={formData.departamento}
                    onChange={(e) => setFormData({ ...formData, departamento: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">CBO (Classificação Brasileira)</label>
                  <input
                    type="text"
                    value={formData.cbo}
                    onChange={(e) => setFormData({ ...formData, cbo: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Data de Admissão</label>
                  <input
                    type="text"
                    value={formData.dataAdmissao}
                    onChange={(e) => setFormData({ ...formData, dataAdmissao: e.target.value })}
                    placeholder="DD/MM/AAAA"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Salário Base (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.salarioBase}
                    onChange={(e) => setFormData({ ...formData, salarioBase: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="border-t border-slate-200 pt-3">
                <h4 className="font-bold text-slate-800 mb-3 text-xs uppercase tracking-wider">Documentos Pessoais</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">CPF</label>
                    <input
                      type="text"
                      value={formData.cpf}
                      onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                      placeholder="000.000.000-00"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">RG</label>
                    <input
                      type="text"
                      value={formData.rg || ''}
                      onChange={(e) => setFormData({ ...formData, rg: e.target.value })}
                      placeholder="00.000.000-0"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">PIS / PASEP</label>
                    <input
                      type="text"
                      value={formData.pisPasep || ''}
                      onChange={(e) => setFormData({ ...formData, pisPasep: e.target.value })}
                      placeholder="000.00000.00-0"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-3">
                <h4 className="font-bold text-slate-800 mb-3 text-xs uppercase tracking-wider">Contatos Diretos</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 font-medium mb-1 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-blue-600" /> E-mail do Colaborador
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-emerald-600" /> Celular / WhatsApp
                    </label>
                    <input
                      type="text"
                      value={formData.telefone}
                      onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                      placeholder="(11) 90000-0000"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab: Contatos de Familiares */}
          {activeTab === 'CONTATOS' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-blue-50 p-3 rounded-xl border border-blue-200">
                <div>
                  <h4 className="font-bold text-blue-950 text-xs">Telefones e Contatos de Familiares & Emergência</h4>
                  <p className="text-[11px] text-blue-700">
                    Cadastre pais, cônjuges, irmãos ou responsáveis para contato rápido em caso de urgência.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddFamilyContact}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar Contato
                </button>
              </div>

              {(formData.contatosFamiliares || []).length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-xl text-slate-400">
                  <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="text-xs font-medium">Nenhum contato familiar cadastrado ainda.</p>
                  <button
                    type="button"
                    onClick={handleAddFamilyContact}
                    className="mt-3 text-blue-600 hover:text-blue-700 font-bold text-xs"
                  >
                    + Cadastrar primeiro contato familiar
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {(formData.contatosFamiliares || []).map((contact, idx) => (
                    <div key={contact.id || idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl relative group">
                      <button
                        type="button"
                        onClick={() => handleRemoveFamilyContact(idx)}
                        className="absolute top-3 right-3 text-slate-400 hover:text-rose-600 transition-colors"
                        title="Remover contato"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pr-8">
                        <div>
                          <label className="block text-slate-600 font-semibold mb-1">Nome do Familiar</label>
                          <input
                            type="text"
                            value={contact.nome}
                            onChange={(e) => handleUpdateFamilyContact(idx, 'nome', e.target.value)}
                            placeholder="Ex: Maria Aparecida"
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-slate-600 font-semibold mb-1">Parentesco</label>
                          <select
                            value={contact.parentesco}
                            onChange={(e) => handleUpdateFamilyContact(idx, 'parentesco', e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          >
                            <option value="Cônjuge / Esposa(o)">Cônjuge / Esposa(o)</option>
                            <option value="Mãe">Mãe</option>
                            <option value="Pai">Pai</option>
                            <option value="Filho(a)">Filho(a)</option>
                            <option value="Irmão / Irmã">Irmão / Irmã</option>
                            <option value="Outro Familiar">Outro Familiar</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-slate-600 font-semibold mb-1">Telefone / WhatsApp</label>
                          <input
                            type="text"
                            value={contact.telefone}
                            onChange={(e) => handleUpdateFamilyContact(idx, 'telefone', e.target.value)}
                            placeholder="(11) 90000-0000"
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            required
                          />
                        </div>
                      </div>

                      <div className="mt-2">
                        <label className="block text-slate-500 font-normal mb-1">Observações (ex: horários, emergência médica)</label>
                        <input
                          type="text"
                          value={contact.observacao || ''}
                          onChange={(e) => handleUpdateFamilyContact(idx, 'observacao', e.target.value)}
                          placeholder="Ex: Contatar preferencialmente à noite ou em emergência"
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab: Endereço */}
          {activeTab === 'ENDERECO' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-3">
                  <label className="block text-slate-700 font-semibold mb-1">Logradouro (Rua / Avenida)</label>
                  <input
                    type="text"
                    value={formData.endereco.logradouro}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        endereco: { ...formData.endereco, logradouro: e.target.value }
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Número</label>
                  <input
                    type="text"
                    value={formData.endereco.numero}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        endereco: { ...formData.endereco, numero: e.target.value }
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Complemento</label>
                  <input
                    type="text"
                    value={formData.endereco.complemento || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        endereco: { ...formData.endereco, complemento: e.target.value }
                      })
                    }
                    placeholder="Apto, Bloco..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Bairro</label>
                  <input
                    type="text"
                    value={formData.endereco.bairro}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        endereco: { ...formData.endereco, bairro: e.target.value }
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Cidade</label>
                  <input
                    type="text"
                    value={formData.endereco.cidade}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        endereco: { ...formData.endereco, cidade: e.target.value }
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">UF</label>
                    <input
                      type="text"
                      value={formData.endereco.uf}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          endereco: { ...formData.endereco, uf: e.target.value.toUpperCase() }
                        })
                      }
                      maxLength={2}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">CEP</label>
                    <input
                      type="text"
                      value={formData.endereco.cep}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          endereco: { ...formData.endereco, cep: e.target.value }
                        })
                      }
                      placeholder="00000-000"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab: Dados Bancários */}
          {activeTab === 'BANCARIOS' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Instituição Bancária</label>
                  <input
                    type="text"
                    value={formData.dadosBancarios.banco}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        dadosBancarios: { ...formData.dadosBancarios, banco: e.target.value }
                      })
                    }
                    placeholder="Ex: ITAÚ UNIBANCO S.A. (341)"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Tipo de Conta</label>
                  <select
                    value={formData.dadosBancarios.tipoConta}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        dadosBancarios: {
                          ...formData.dadosBancarios,
                          tipoConta: e.target.value as any
                        }
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="CORRENTE">Conta Corrente</option>
                    <option value="POUPANCA">Conta Poupança</option>
                    <option value="SALARIO">Conta Salário</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Agência</label>
                  <input
                    type="text"
                    value={formData.dadosBancarios.agencia}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        dadosBancarios: { ...formData.dadosBancarios, agencia: e.target.value }
                      })
                    }
                    placeholder="0000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Número da Conta</label>
                  <input
                    type="text"
                    value={formData.dadosBancarios.conta}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        dadosBancarios: { ...formData.dadosBancarios, conta: e.target.value }
                      })
                    }
                    placeholder="00000-0"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-700 font-semibold mb-1">Chave PIX</label>
                  <input
                    type="text"
                    value={formData.dadosBancarios.chavePix || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        dadosBancarios: { ...formData.dadosBancarios, chavePix: e.target.value }
                      })
                    }
                    placeholder="CPF, E-mail ou Celular"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 -mx-6 -mb-6 mt-6 flex justify-between items-center">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-slate-600 hover:text-slate-900 font-medium text-xs hover:bg-slate-200 transition-colors"
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              Salvar Alterações do Colaborador
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
