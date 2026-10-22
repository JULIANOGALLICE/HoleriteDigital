import { Employee, PayReceipt } from '../types';
import { formatBRL } from './pdfGenerator';

export function createWhatsAppMessage(employee: Employee, receipt: PayReceipt): string {
  const primeiroNome = employee.nome.split(' ')[0];
  const urlApp = typeof window !== 'undefined' ? window.location.origin : '';

  const msg = 
`📄 *COMUNICADO DE PAGAMENTO - CARTÓRIO / EMPRESA*
Olá, *${primeiroNome}*!

Seu recibo de pagamento referente a *${receipt.mesAno}* já está disponível para consulta e download no portal.

💰 *Resumo da Folha:*
• Salário Base: R$ ${formatBRL(receipt.salarioBase)}
• Total Vencimentos: R$ ${formatBRL(receipt.totalVencimentos)}
• Total Descontos: R$ ${formatBRL(receipt.totalDescontos)}
• *Valor Líquido: R$ ${formatBRL(receipt.valorLiquido)}*

🔑 *Seu Código de Acesso:* ${employee.codigo}
🌐 *Acesse pelo link:* ${urlApp}

Por favor, acesse o portal para conferir e assinar o seu comprovante em PDF. Em caso de dúvidas, procure o Departamento Pessoal.`;

  return msg;
}

export function openWhatsAppDirect(employee: Employee, receipt: PayReceipt): void {
  const rawPhone = (employee.telefone || '').replace(/\D/g, '');
  const fullPhone = rawPhone.startsWith('55') ? rawPhone : `55${rawPhone}`;
  const text = createWhatsAppMessage(employee, receipt);
  const waUrl = `https://wa.me/${fullPhone}?text=${encodeURIComponent(text)}`;
  window.open(waUrl, '_blank');
}

export function createSignatureReminderWhatsAppMessage(employee: Employee, receipt: PayReceipt): string {
  const primeiroNome = employee.nome.split(' ')[0];
  const urlApp = typeof window !== 'undefined' ? window.location.origin : '';

  return `🔔 *LEMBRETE: ASSINATURA PENDENTE DO SEU HOLERITE*
Olá, *${primeiroNome}*!

Constatamos no sistema de Recursos Humanos que o seu recibo de pagamento referente a *${receipt.mesAno}* (Valor Líquido: *R$ ${formatBRL(receipt.valorLiquido)}*) ainda *não foi assinado digitalmente*.

⚠️ *IMPORTANTE:*
De acordo com o Art. 464 da CLT e as normas internas, o *download do comprovante oficial em PDF* só é liberado imediatamente após você confirmar sua ciência e registrar sua assinatura digital no portal.

🔑 *Sua Matrícula:* ${employee.codigo}
🌐 *Acesse agora para assinar e liberar o download:*
${urlApp}

Por favor, acesse o portal o quanto antes para validar seu documento. Em caso de dúvidas, procure o Departamento Pessoal.`;
}

export function openWhatsAppReminderDirect(employee: Employee, receipt: PayReceipt): void {
  const rawPhone = (employee.telefone || '').replace(/\D/g, '');
  const fullPhone = rawPhone.startsWith('55') ? rawPhone : `55${rawPhone}`;
  const text = createSignatureReminderWhatsAppMessage(employee, receipt);
  const waUrl = `https://wa.me/${fullPhone}?text=${encodeURIComponent(text)}`;
  window.open(waUrl, '_blank');
}

export function createEmailTemplate(employee: Employee, receipt: PayReceipt) {
  const primeiroNome = employee.nome.split(' ')[0];
  const urlApp = typeof window !== 'undefined' ? window.location.origin : '';
  return {
    assunto: `[Holerite Digital] Recibo de Pagamento - ${receipt.mesAno} - ${employee.nome}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #0f172a; padding: 20px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; font-size: 20px; font-weight: bold;">${receipt.empregador.razaoSocial}</h2>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #94a3b8;">Portal do Colaborador - Holerite Digital</p>
        </div>
        
        <div style="padding: 24px; color: #334155; line-height: 1.6;">
          <p>Olá, <strong>${primeiroNome}</strong>,</p>
          <p>Informamos que o seu recibo de pagamento referente ao mês de <strong>${receipt.mesAno}</strong> foi processado e disponibilizado para consulta.</p>
          
          <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 16px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Matrícula / Código:</td>
                <td style="padding: 6px 0; font-weight: bold; text-align: right;">${employee.codigo}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Função / Cargo:</td>
                <td style="padding: 6px 0; font-weight: bold; text-align: right;">${employee.cargo}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Competência:</td>
                <td style="padding: 6px 0; font-weight: bold; text-align: right;">${receipt.mesAno}</td>
              </tr>
              <tr style="border-top: 1px dashed #cbd5e1;">
                <td style="padding: 8px 0; color: #64748b;">Total de Vencimentos:</td>
                <td style="padding: 8px 0; font-weight: bold; color: #166534; text-align: right;">R$ ${formatBRL(receipt.totalVencimentos)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Total de Descontos:</td>
                <td style="padding: 6px 0; font-weight: bold; color: #991b1b; text-align: right;">- R$ ${formatBRL(receipt.totalDescontos)}</td>
              </tr>
              <tr style="border-top: 2px solid #0f172a;">
                <td style="padding: 10px 0; font-size: 16px; font-weight: bold; color: #0f172a;">Valor Líquido:</td>
                <td style="padding: 10px 0; font-size: 18px; font-weight: bold; color: #0f172a; text-align: right;">R$ ${formatBRL(receipt.valorLiquido)}</td>
              </tr>
            </table>
          </div>

          <p style="font-size: 13px; color: #64748b;">O documento oficial em formato PDF com as 2 vias e termo de quitação está disponível no portal para download logo após sua assinatura digital.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${urlApp}" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; display: inline-block;">
              Acessar Portal do Colaborador
            </a>
          </div>
        </div>

        <div style="background-color: #f1f5f9; padding: 12px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0;">
          Este é um e-mail automático gerado pelo sistema de Recursos Humanos e Departamento Pessoal.
        </div>
      </div>
    `
  };
}

export function createSignatureReminderEmailTemplate(employee: Employee, receipt: PayReceipt) {
  const primeiroNome = employee.nome.split(' ')[0];
  const urlApp = typeof window !== 'undefined' ? window.location.origin : '';

  return {
    assunto: `🔔 [Lembrete Urgente] Assinatura Pendente do Holerite ${receipt.mesAno} - ${employee.nome}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #fed7aa; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        <div style="background-color: #7c2d12; padding: 22px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; font-size: 19px; font-weight: bold;">${receipt.empregador.razaoSocial}</h2>
          <p style="margin: 6px 0 0 0; font-size: 13px; color: #ffedd5; font-weight: 600;">
            🔔 Departamento Pessoal • Lembrete de Assinatura Digital Pendente
          </p>
        </div>
        
        <div style="padding: 26px; color: #334155; line-height: 1.6; background-color: #ffffff;">
          <p style="font-size: 14px; margin-top: 0;">Olá, <strong>${primeiroNome}</strong>,</p>
          <p style="font-size: 13px; color: #475569;">
            Identificamos em nossos registros que o seu recibo de pagamento referente à competência <strong>${receipt.mesAno}</strong> ainda <strong>aguarda a sua assinatura digital</strong>.
          </p>
          
          <div style="background-color: #fff7ed; border-left: 4px solid #ea580c; border-radius: 6px; padding: 14px 18px; margin: 20px 0;">
            <p style="margin: 0; font-size: 13px; color: #9a3412; font-weight: bold;">
              ⚠️ Liberação Obrigatória do Download do PDF:
            </p>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #c2410c; line-height: 1.5;">
              De acordo com a CLT (Art. 464), o comprovante oficial em PDF para arquivamento ou comprovação de renda <strong>somente é liberado para download após a confirmação da sua assinatura digital</strong>.
            </p>
          </div>

          <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Colaborador(a):</td>
                <td style="padding: 6px 0; font-weight: bold; text-align: right;">${employee.nome}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Matrícula / Código:</td>
                <td style="padding: 6px 0; font-weight: bold; text-align: right;">${employee.codigo}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Competência:</td>
                <td style="padding: 6px 0; font-weight: bold; text-align: right;">${receipt.mesAno}</td>
              </tr>
              <tr style="border-top: 1px dashed #cbd5e1;">
                <td style="padding: 8px 0; color: #64748b;">Valor Líquido:</td>
                <td style="padding: 8px 0; font-size: 15px; font-weight: bold; color: #0f172a; text-align: right;">R$ ${formatBRL(receipt.valorLiquido)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Status no Portal:</td>
                <td style="padding: 6px 0; font-weight: bold; color: #c2410c; text-align: right;">Aguardando Assinatura 2FA</td>
              </tr>
            </table>
          </div>

          <div style="text-align: center; margin: 28px 0;">
            <a href="${urlApp}" style="background-color: #ea580c; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: bold; font-size: 13px; display: inline-block; box-shadow: 0 4px 12px rgba(234, 88, 12, 0.3);">
              Assinar Holerite no Portal & Liberar Download em PDF
            </a>
          </div>

          <p style="font-size: 12px; color: #64748b; text-align: center; margin-bottom: 0;">
            A validação leva menos de 1 minuto através de código seguro 2FA. Em caso de dúvidas, procure o Departamento Pessoal.
          </p>
        </div>

        <div style="background-color: #f1f5f9; padding: 12px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0;">
          Lembrete automático expedido pelo Departamento Pessoal e Recursos Humanos.
        </div>
      </div>
    `
  };
}
