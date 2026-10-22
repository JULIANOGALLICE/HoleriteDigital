import { jsPDF } from 'jspdf';
import { IncomeReport } from '../types';

export function formatCurrencyBRL(val: number | undefined | null): string {
  if (val === undefined || val === null || isNaN(val)) return '0,00';
  return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function generateIncomeReportPdf(report: IncomeReport): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const margin = 10;
  const contentWidth = pageWidth - margin * 2; // 190mm
  let currentY = 10;

  // Helper de desenho de caixas de tabela
  const drawSectionHeader = (title: string, y: number, height = 5) => {
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, y, contentWidth, height, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(0, 0, 0);
    doc.text(title, margin + 2, y + 3.6);
    return y + height;
  };

  // 1. Cabeçalho Principal (Ministério da Economia / Receita Federal)
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(margin, currentY, contentWidth, 20);

  // Divisão vertical no cabeçalho
  doc.line(margin + 105, currentY, margin + 105, currentY + 20);

  // Lado Esquerdo
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.text('MINISTÉRIO DA ECONOMIA', margin + 15, currentY + 5);
  doc.text('SECRETARIA DA RECEITA FEDERAL DO BRASIL', margin + 15, currentY + 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('IMPOSTO SOBRE A RENDA DA PESSOA FÍSICA', margin + 15, currentY + 13);
  doc.setFont('helvetica', 'bold');
  doc.text(`EXERCÍCIO:        ${report.exercicio}`, margin + 15, currentY + 17.5);

  // Lado Direito
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('COMPROVANTE DE RENDIMENTOS PAGOS E DE', margin + 108, currentY + 5.5);
  doc.text('IMPOSTO SOBRE A RENDA RETIDO NA FONTE', margin + 108, currentY + 9.5);
  doc.text(`ANO-CALENDÁRIO:                     ${report.anoCalendario}`, margin + 108, currentY + 17.5);

  currentY += 21.5;

  // Texto Legal
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.text(
    'Verifique as condições e o prazo para a apresentação da Declaração do Imposto sobre a Renda da Pessoa Física para este ano - calendário no site',
    margin,
    currentY
  );
  currentY += 3;
  doc.text(
    'da Secretaria Especial da Receita Federal do Brasil na Internet, no endereço <https://www.gov.br/receitafederal/pt-br>',
    margin,
    currentY
  );
  currentY += 3;

  // 1. Fonte Pagadora
  currentY = drawSectionHeader('1. Fonte Pagadora Pessoa Jurídica ou Pessoa Física', currentY, 5);
  doc.rect(margin, currentY, contentWidth, 9);
  doc.line(margin + 55, currentY, margin + 55, currentY + 9);

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.text('CNPJ/CPF', margin + 2, currentY + 3);
  doc.text('Nome Empresarial / Nome Completo', margin + 57, currentY + 3);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text(report.fontePagadora.cnpjCpf, margin + 2, currentY + 7);
  doc.text(report.fontePagadora.nomeEmpresarial, margin + 57, currentY + 7);

  currentY += 10.5;

  // 2. Beneficiário
  currentY = drawSectionHeader('2. Pessoa Física Beneficiária dos Rendimentos', currentY, 5);
  doc.rect(margin, currentY, contentWidth, 14);
  doc.line(margin + 55, currentY, margin + 55, currentY + 7);
  doc.line(margin, currentY + 7, margin + contentWidth, currentY + 7);

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.text('CPF', margin + 2, currentY + 3);
  doc.text('Nome Completo', margin + 57, currentY + 3);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text(report.beneficiario.cpf, margin + 2, currentY + 6);
  const codTxt = report.beneficiario.employeeCodigo ? ` - ${report.beneficiario.employeeCodigo.padStart(6, '0')}` : '';
  doc.text(`${report.beneficiario.nomeCompleto}${codTxt}`, margin + 57, currentY + 6);

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Natureza do Rendimento', margin + 2, currentY + 9.5);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text(report.beneficiario.naturezaRendimento || 'RENDIMENTO DO TRABALHO ASSALARIADO NO PAÍS', margin + 2, currentY + 13);

  currentY += 15.5;

  // 3. Rendimentos Tributáveis, Deduções e IRRF
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, currentY, contentWidth, 5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('3. Rendimentos Tributáveis, Deduções e Imposto sobre a Renda Retido na Fonte', margin + 2, currentY + 3.6);
  doc.text('Valores em Reais', margin + contentWidth - 25, currentY + 3.6);
  currentY += 5;

  const rowsQ3 = [
    { num: '1.', desc: 'Total dos rendimentos (inclusive férias).', val: report.rendimentosTributaveis.totalRendimentos },
    { num: '2.', desc: 'Contribuição previdenciária oficial.', val: report.rendimentosTributaveis.contribuicaoPrevidenciaria },
    { num: '3.', desc: 'Contribuição a entidades de previdência complementar, pública ou privada, e a Fundo de Aposentadoria Programada Individual - (Fapi).', val: report.rendimentosTributaveis.previdenciaComplementar },
    { num: '4.', desc: 'Pensão alimentícia (preencher também o Quadro 7).', val: report.rendimentosTributaveis.pensaoAlimenticia },
    { num: '5.', desc: 'Imposto sobre a Renda Retido na Fonte (IRRF).', val: report.rendimentosTributaveis.impostoRetidoFonte }
  ];

  doc.rect(margin, currentY, contentWidth, rowsQ3.length * 5);
  doc.line(margin + contentWidth - 30, currentY, margin + contentWidth - 30, currentY + rowsQ3.length * 5);

  rowsQ3.forEach((row, i) => {
    const rowY = currentY + i * 5;
    if (i > 0) doc.line(margin, rowY, margin + contentWidth, rowY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.text(`${row.num} ${row.desc}`, margin + 2, rowY + 3.6);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrencyBRL(row.val), margin + contentWidth - 2, rowY + 3.6, { align: 'right' });
  });

  currentY += rowsQ3.length * 5 + 1.5;

  // 4. Rendimentos Isentos e Não Tributáveis
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, currentY, contentWidth, 5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('4. Rendimentos Isentos e Não Tributáveis', margin + 2, currentY + 3.6);
  doc.text('Valores em Reais', margin + contentWidth - 25, currentY + 3.6);
  currentY += 5;

  const outrosLabel = report.rendimentosIsentos.outrosEspecificar ? ` (${report.rendimentosIsentos.outrosEspecificar})` : '';

  const rowsQ4 = [
    { num: '1.', desc: 'Parcela isenta dos proventos de aposentadoria, reserva remunerada, reforma e pensão (65 anos ou mais), exceto 13º salário.', val: report.rendimentosIsentos.parcelaIsentaAposentadoria },
    { num: '2.', desc: 'Parcela isenta do 13º salário de aposentadoria, reserva remunerada, reforma e pensão (65 anos ou mais).', val: report.rendimentosIsentos.parcelaIsenta13Aposentadoria },
    { num: '3.', desc: 'Diárias e ajudas de custo.', val: report.rendimentosIsentos.diariasAjudaCusto },
    { num: '4.', desc: 'Pensão e proventos de aposentadoria ou reforma por moléstia grave; proventos por acidente em serviço.', val: report.rendimentosIsentos.pensaoMolestiaGrave },
    { num: '5.', desc: 'Lucros e dividendos, apurados a partir de 1996, pagos por pessoa jurídica (lucro real, presumido ou arbitrado).', val: report.rendimentosIsentos.lucrosDividendos },
    { num: '6.', desc: 'Valores pagos ao titular ou sócio de microempresa ou EPP, exceto pró-labore, aluguéis ou serviços prestados.', val: report.rendimentosIsentos.valoresPagosSocio },
    { num: '7.', desc: 'Indenizações por rescisão de contrato de trabalho, inclusive a título de PDV e por acidente de trabalho.', val: report.rendimentosIsentos.indenizacoesRescisao },
    { num: '8.', desc: 'Juros de mora recebidos, devidos pelo atraso no pagamento de remuneração por exercício de emprego, cargo ou função.', val: report.rendimentosIsentos.jurosMora },
    { num: '9.', desc: `Outros (especificar)${outrosLabel}.`, val: report.rendimentosIsentos.outrosValor }
  ];

  doc.rect(margin, currentY, contentWidth, rowsQ4.length * 4.6);
  doc.line(margin + contentWidth - 30, currentY, margin + contentWidth - 30, currentY + rowsQ4.length * 4.6);

  rowsQ4.forEach((row, i) => {
    const rowY = currentY + i * 4.6;
    if (i > 0) doc.line(margin, rowY, margin + contentWidth, rowY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.4);
    doc.text(`${row.num} ${row.desc}`, margin + 2, rowY + 3.3);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrencyBRL(row.val), margin + contentWidth - 2, rowY + 3.3, { align: 'right' });
  });

  currentY += rowsQ4.length * 4.6 + 1.5;

  // 5. Tributação Exclusiva
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, currentY, contentWidth, 5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('5. Rendimentos Sujeitos a Tributação Exclusiva (rendimento líquido)', margin + 2, currentY + 3.6);
  doc.text('Valores em Reais', margin + contentWidth - 25, currentY + 3.6);
  currentY += 5;

  const rowsQ5 = [
    { num: '1.', desc: '13º (décimo terceiro) salário.', val: report.tributacaoExclusiva.decimoTerceiroSalario },
    { num: '2.', desc: 'Imposto sobre a Renda Retido na Fonte sobre 13º (décimo terceiro) salário.', val: report.tributacaoExclusiva.irrfDecimoTerceiro },
    { num: '3.', desc: 'Outros.', val: report.tributacaoExclusiva.outros }
  ];

  doc.rect(margin, currentY, contentWidth, rowsQ5.length * 5);
  doc.line(margin + contentWidth - 30, currentY, margin + contentWidth - 30, currentY + rowsQ5.length * 5);

  rowsQ5.forEach((row, i) => {
    const rowY = currentY + i * 5;
    if (i > 0) doc.line(margin, rowY, margin + contentWidth, rowY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.text(`${row.num} ${row.desc}`, margin + 2, rowY + 3.6);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrencyBRL(row.val), margin + contentWidth - 2, rowY + 3.6, { align: 'right' });
  });

  currentY += rowsQ5.length * 5 + 1.5;

  // 6. RRA
  currentY = drawSectionHeader('6. Rendimentos Recebidos Acumuladamente - Art. 12-A da Lei nº 7.713, de 1988 (sujeitos a tributação exclusiva)', currentY, 5);
  doc.rect(margin, currentY, contentWidth, 6);
  currentY += 7.5;

  // 7. Informações Complementares
  currentY = drawSectionHeader('7. Informações Complementares', currentY, 5);
  doc.rect(margin, currentY, contentWidth, 8);
  if (report.informacoesComplementares) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text(report.informacoesComplementares, margin + 2, currentY + 4);
  }
  currentY += 9.5;

  // 8. Responsável pelas Informações
  currentY = drawSectionHeader('8. Responsável pelas Informações', currentY, 5);
  doc.rect(margin, currentY, contentWidth, 11);
  doc.line(margin + 105, currentY, margin + 105, currentY + 11);
  doc.line(margin + 140, currentY, margin + 140, currentY + 11);

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Nome', margin + 2, currentY + 3);
  doc.text('Data', margin + 107, currentY + 3);
  doc.text('Assinatura', margin + 142, currentY + 3);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text(report.responsavel.nome, margin + 2, currentY + 8);
  doc.text(report.responsavel.data, margin + 107, currentY + 8);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.text('Assinado Eletronicamente', margin + 142, currentY + 8);

  currentY += 13.5;

  // Rodapé Oficial
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(50, 50, 50);
  doc.text('Aprovado pela Instrução Normativa RFB nº 2.060, de 13 de dezembro de 2021.', margin, currentY);

  return doc;
}
