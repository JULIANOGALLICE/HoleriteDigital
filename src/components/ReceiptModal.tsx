import React from 'react';
import { Employee, PayReceipt, DigitalCertificateA1 } from '../types';
import { ReceiptViewer } from './ReceiptViewer';
import { X } from 'lucide-react';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
  receipt: PayReceipt | null;
  onSignReceipt: (receiptId: string) => void;
  onTriggerDigitalSignature?: (receipt: PayReceipt) => void;
  onOpenEmailModal: (employee: Employee, receipt: PayReceipt) => void;
  certificateConfig?: DigitalCertificateA1 | null;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  employee,
  receipt,
  onSignReceipt,
  onTriggerDigitalSignature,
  onOpenEmailModal,
  certificateConfig
}) => {
  if (!isOpen || !employee || !receipt) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        <div className="p-4 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800">
          <div>
            <h3 className="font-bold text-sm text-white">Visualização Oficial do Recibo</h3>
            <p className="text-xs text-slate-400">
              {employee.nome} • {receipt.mesAno} ({receipt.tipoFolha})
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
          <ReceiptViewer
            employee={employee}
            receipt={receipt}
            onSignReceipt={onSignReceipt}
            onTriggerDigitalSignature={onTriggerDigitalSignature}
            onOpenEmailModal={onOpenEmailModal}
            isAdmin={true}
            certificateConfig={certificateConfig}
          />
        </div>
      </div>
    </div>
  );
};
