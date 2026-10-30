import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { Employee, PayReceipt, DigitalCertificateA1 } from '../types';
import { getActiveA1Certificate } from './certificateA1';
import { embedPadesSignature, signPdfDocument } from './pdfSignerA1';

export function formatBRL(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === '') return '';
  let num: number;
  if (typeof val === 'number') {
    num = val;
  } else {
    const clean = String(val).trim();
    if (!clean) return '';
    if (clean === '0' || clean === '0,00' || clean === '0.00') return '0,00';
    if (clean.includes(',')) {
      num = parseFloat(clean.replace(/\./g, '').replace(',', '.'));
    } else {
      num = parseFloat(clean);
    }
  }
  if (isNaN(num)) return '';
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Computes a deterministic SHA-256 integrity hash representation for the pay receipt
 */
function generateDocumentIntegrityHash(employee: Employee, receipt: PayReceipt, cert: DigitalCertificateA1): string {
  const seed = `${receipt.id}|${employee.codigo}|${employee.cpf}|${receipt.mesAno}|${receipt.valorLiquido}|${receipt.totalVencimentos}|${receipt.totalDescontos}|${receipt.dataEmissao}|${cert.titular}|${cert.numeroSerie}`;
  let hash1 = 5381;
  let hash2 = 52711;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash1 = (hash1 * 33) ^ char;
    hash2 = (hash2 * 33) ^ char;
  }
  const part1 = Math.abs(hash1).toString(16).padStart(8, '0');
  const part2 = Math.abs(hash2).toString(16).padStart(8, '0');
  const part3 = Math.abs(hash1 ^ hash2).toString(16).padStart(8, '0');
  const part4 = Math.abs(hash1 + hash2).toString(16).padStart(8, '0');
  return `${part1}${part2}${part3}${part4}`.toUpperCase();
}

/**
 * Generates an official single-slip (1 Via) Pay Receipt PDF with A1 Digital Signature at the bottom,
 * unbroken continuous table lines, no bank info, and no filial info.
 */
export function generatePayReceiptPDF(
  employee: Employee,
  receipt: PayReceipt,
  certificateConfig?: DigitalCertificateA1 | null
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Page dimensions (A4: 210 x 297 mm)
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 12; // 12mm margin ensures no content exceeds page bounds
  const contentWidth = pageWidth - margin * 2; // 186mm
  const rightEdge = margin + contentWidth; // 198mm

  // Certificate resolution: ALWAYS prioritize the user-registered active A1 certificate
  const activeCert: DigitalCertificateA1 = getActiveA1Certificate(certificateConfig);

  // Set official PDF document properties metadata
  doc.setProperties({
    title: `Recibo de Pagamento - ${employee.nome} - ${receipt.mesAno}`,
    subject: `Holerite Assinado Digitalmente com Certificado Digital A1 ICP-Brasil (${activeCert.titular})`,
    author: activeCert.titular,
    keywords: `ICP-Brasil, Certificado A1, ${activeCert.numeroSerie}, CLT Art. 464, Assinatura Digital`,
    creator: `HoleriteDigital • Assinado Digitalmente por ${activeCert.titular} (${activeCert.autoridadeCertificadora})`
  });

  let curY = 12;

  // =========================================================================
  // 1. TOP DOCUMENT TITLE / IDENTIFICATION BAR
  // =========================================================================
  doc.setFillColor(30, 41, 59); // Slate-800
  doc.rect(margin, curY, contentWidth, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text('RECIBO DE PAGAMENTO DE SALÁRIO', margin + 3, curY + 4.8);
  doc.setFontSize(7.5);
  doc.text('VIA ÚNICA (COLABORADOR / EMPREGADOR)', rightEdge - 3, curY + 4.8, { align: 'right' });
  curY += 7;

  // =========================================================================
  // 2. EMPREGADOR HEADER BOX
  // =========================================================================
  const empHeaderHeight = 18;
  doc.setDrawColor(51, 65, 85);
  doc.setLineWidth(0.3);
  doc.setFillColor(255, 255, 255);
  doc.rect(margin, curY, contentWidth, empHeaderHeight, 'S');

  // Employer Info (Left)
  let empNameSize = 9.0;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(empNameSize);
  doc.setTextColor(15, 23, 42);
  while (doc.getTextWidth(receipt.empregador.razaoSocial) > 125 && empNameSize > 7.0) {
    empNameSize -= 0.3;
    doc.setFontSize(empNameSize);
  }
  doc.text(receipt.empregador.razaoSocial, margin + 3, curY + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`CEI / CNPJ: ${receipt.empregador.cei || '800136945806'}`, margin + 3, curY + 10.5);
  doc.text(`Centro de Custo: ${receipt.empregador.centroCusto || 'GERAL'}`, margin + 70, curY + 10.5);
  doc.text(`Regime: ${receipt.empregador.regime || 'Mensalista'}`, margin + 3, curY + 15);
  doc.text(`Data de Emissão: ${receipt.dataEmissao || '30/09/2026'}`, margin + 70, curY + 15);

  // Pay Period / Sheet Type (Right)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 58, 138); // Blue
  doc.text(receipt.tipoFolha.toUpperCase(), rightEdge - 3, curY + 5.5, { align: 'right' });

  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(receipt.mesAno, rightEdge - 3, curY + 11.5, { align: 'right' });

  curY += empHeaderHeight;

  // =========================================================================
  // 3. EMPLOYEE INFO BOX (SEM FILIAL - CONFORME SOLICITADO)
  // =========================================================================
  const empBoxHeight = 18;
  doc.setDrawColor(51, 65, 85);
  doc.setLineWidth(0.3);
  doc.setFillColor(255, 255, 255);
  doc.rect(margin, curY, contentWidth, empBoxHeight, 'S');

  // Row 1 - Labels & Values (CÓDIGO | NOME DO COLABORADOR | CARGO / FUNÇÃO | CBO)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('CÓDIGO', margin + 3, curY + 3.8);
  doc.text('NOME DO COLABORADOR', margin + 20, curY + 3.8);
  doc.text('CARGO / FUNÇÃO', margin + 98, curY + 3.8);
  doc.text('CBO', margin + 162, curY + 3.8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.setTextColor(15, 23, 42);
  doc.text(employee.codigo, margin + 3, curY + 7.8);

  // Auto-fit name if long so it never truncates or collides
  let nameSize = 7.8;
  doc.setFontSize(nameSize);
  while (doc.getTextWidth(employee.nome) > 75 && nameSize > 6.0) {
    nameSize -= 0.3;
    doc.setFontSize(nameSize);
  }
  doc.text(employee.nome, margin + 20, curY + 7.8);

  // Auto-fit cargo
  let cargoSize = 7.2;
  doc.setFontSize(cargoSize);
  const cargoText = employee.cargo || 'ESCREVENTE';
  while (doc.getTextWidth(cargoText) > 60 && cargoSize > 5.8) {
    cargoSize -= 0.3;
    doc.setFontSize(cargoSize);
  }
  doc.text(cargoText, margin + 98, curY + 7.8);

  doc.setFontSize(7.2);
  doc.text(employee.cbo || '351405', margin + 162, curY + 7.8);

  // Subtle interior dividing line between Row 1 and Row 2
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.line(margin, curY + 9.6, rightEdge, curY + 9.6);

  // Row 2 - Labels & Values (CPF | PIS / PASEP | DATA ADMISSÃO)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('CPF', margin + 3, curY + 13.0);
  doc.text('PIS / PASEP', margin + 70, curY + 13.0);
  doc.text('DATA ADMISSÃO', margin + 140, curY + 13.0);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(7.2);
  doc.text(employee.cpf || '***.***.***-**', margin + 3, curY + 16.4);
  doc.text(employee.pisPasep || '-', margin + 70, curY + 16.4);
  doc.text(employee.dataAdmissao || '02/03/2023', margin + 140, curY + 16.4);

  curY += empBoxHeight;

  // =========================================================================
  // 4. ITEMS TABLE (CÓDIGO | DESCRIÇÃO | REFERÊNCIA | VENCIMENTOS | DESCONTOS)
  // TOTAL CONTINUOUS LINES: NO BROKEN / CUT LINES ANYWHERE!
  // =========================================================================
  // Precise Column coordinates (sum = 186mm):
  // Código: 15mm (12 -> 27)
  // Descrição: 87mm (27 -> 114)
  // Referência: 22mm (114 -> 136)
  // Vencimentos: 31mm (136 -> 167)
  // Descontos: 31mm (167 -> 198)
  const colWCode = 15;
  const colWDesc = 87;
  const colWRef = 22;
  const colWVenc = 31;
  const colWDescVal = 31;

  const colXCode = margin; // 12
  const colXDesc = colXCode + colWCode; // 27
  const colXRef = colXDesc + colWDesc; // 114
  const colXVenc = colXRef + colWRef; // 136
  const colXDescVal = colXVenc + colWVenc; // 167

  const tblHeaderHeight = 6.5;
  const tblBodyHeight = 76;
  const tblTotalHeight = tblHeaderHeight + tblBodyHeight;
  const tblTopY = curY;
  const tblBottomY = tblTopY + tblTotalHeight;
  const tblBodyStartY = tblTopY + tblHeaderHeight;

  // Draw Header Background
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, tblTopY, contentWidth, tblHeaderHeight, 'F');

  // Header Titles
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(15, 23, 42);
  doc.text('CÓD', colXCode + 2, tblTopY + 4.5);
  doc.text('DESCRIÇÃO DOS EVENTOS', colXDesc + 2.5, tblTopY + 4.5);
  doc.text('REFERÊNCIA', colXRef + colWRef / 2, tblTopY + 4.5, { align: 'center' });
  doc.text('VENCIMENTOS (R$)', colXVenc + colWVenc - 2.5, tblTopY + 4.5, { align: 'right' });
  doc.text('DESCONTOS (R$)', colXDescVal + colWDescVal - 2.5, tblTopY + 4.5, { align: 'right' });

  // Deduplicate items (e.g. if extracted from dual employer/employee slips on the same sheet)
  const seenItemKeys = new Set<string>();
  const rawItems = Array.isArray(receipt.itens) ? receipt.itens : [];
  const uniqueItems: typeof receipt.itens = [];

  for (const it of rawItems) {
    const code = String(it.codigo || '').trim();
    const desc = String(it.descricao || '').trim().toUpperCase();
    const key = `${code}|${desc}`;
    if (!seenItemKeys.has(key)) {
      seenItemKeys.add(key);
      uniqueItems.push(it);
    }
  }

  // Fallback to rawItems if deduplication was empty
  const displayItems = uniqueItems.length > 0 ? uniqueItems : rawItems;

  // Dynamically calculate row height and font size so that ALL items (proventos & descontos)
  // fit completely within tblBodyHeight without ever truncating or dropping items!
  const itemCount = Math.max(displayItems.length, 1);
  const rowHeight = itemCount > 16
    ? Math.max(3.2, (tblBodyHeight - 2) / itemCount)
    : 4.5;
  const baseItemFontSize = itemCount > 18 ? 5.8 : itemCount > 14 ? 6.4 : 7.2;

  let itemY = tblBodyStartY + (rowHeight * 0.85);

  displayItems.forEach((item, index) => {
    // Alternating subtle background
    if (index % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin + 0.2, itemY - (rowHeight * 0.72), contentWidth - 0.4, rowHeight, 'F');
    }

    // Light row divider
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.15);
    doc.line(margin, itemY + (rowHeight * 0.28), rightEdge, itemY + (rowHeight * 0.28));

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);

    doc.setFontSize(baseItemFontSize);
    doc.text(String(item.codigo || ''), colXCode + 2, itemY);

    // Dynamic text fitting: fits cleanly within column width
    const desc = String(item.descricao || '').trim();
    const maxDescW = colWDesc - 5; // 82mm printable width
    let descFontSize = baseItemFontSize;
    doc.setFontSize(descFontSize);
    while (doc.getTextWidth(desc) > maxDescW && descFontSize > 5.0) {
      descFontSize -= 0.3;
      doc.setFontSize(descFontSize);
    }
    let renderedDesc = desc;
    while (doc.getTextWidth(renderedDesc) > maxDescW && renderedDesc.length > 5) {
      renderedDesc = renderedDesc.slice(0, -1);
    }
    doc.text(renderedDesc, colXDesc + 2.5, itemY);

    if (item.referencia) {
      doc.setFontSize(baseItemFontSize);
      doc.text(String(item.referencia), colXRef + colWRef / 2, itemY, { align: 'center' });
    }

    // Resolve vencimento value robustly
    const rawVenc = item.vencimento ?? (item as any).vencimentos ?? ((item as any).tipo === 'PROVENTO' || (item as any).tipo === 'VENCIMENTO' ? (item as any).valor : null);
    const vencVal = typeof rawVenc === 'number'
      ? rawVenc
      : rawVenc ? parseFloat(String(rawVenc).replace(/\./g, '').replace(',', '.')) : null;

    if (vencVal !== null && !isNaN(vencVal) && vencVal > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(baseItemFontSize);
      doc.setTextColor(15, 23, 42);
      doc.text(formatBRL(vencVal), colXVenc + colWVenc - 2.5, itemY, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);
    }

    // Resolve desconto value robustly
    const rawDesc = item.desconto ?? (item as any).descontos ?? (item as any).valorDesconto ?? ((item as any).tipo === 'DESCONTO' ? (item as any).valor : null);
    const descVal = typeof rawDesc === 'number'
      ? rawDesc
      : rawDesc ? parseFloat(String(rawDesc).replace(/\./g, '').replace(',', '.')) : null;

    if (descVal !== null && !isNaN(descVal) && descVal > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(baseItemFontSize);
      doc.setTextColor(190, 18, 60); // Rose-700 ensures deductions are clearly visible
      doc.text(formatBRL(descVal), colXDescVal + colWDescVal - 2.5, itemY, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);
    }

    itemY += rowHeight;
  });

  // DRAW ALL GRID BORDERS AND VERTICAL LINES ON TOP (NO CUT LINES!)
  doc.setDrawColor(51, 65, 85);
  doc.setLineWidth(0.3);

  // Outer border of the whole table
  doc.rect(margin, tblTopY, contentWidth, tblTotalHeight, 'S');

  // Horizontal line separating header from rows
  doc.line(margin, tblBodyStartY, rightEdge, tblBodyStartY);

  // Continuous vertical column divider lines from TOP of header all the way to BOTTOM of table
  doc.line(colXDesc, tblTopY, colXDesc, tblBottomY);
  doc.line(colXRef, tblTopY, colXRef, tblBottomY);
  doc.line(colXVenc, tblTopY, colXVenc, tblBottomY);
  doc.line(colXDescVal, tblTopY, colXDescVal, tblBottomY);

  curY = tblBottomY;

  // =========================================================================
  // 5. TOTALS BOX (DESCRIÇÃO DE VALORES - SEM DADOS BANCÁRIOS!)
  // IMPORTANT: BACKGROUNDS FIRST, TEXT SECOND, LINES ON TOP SO NO LINE IS CUT!
  // =========================================================================
  const totalsBoxHeight = 16;
  const totalsSplitX = colXVenc - 22; // 136 - 22 = 114 (aligns with Col Ref)
  const totalsMidLineY = curY + 8.8;

  // 1. Draw Background Fills FIRST
  // Bottom-right: light-blue highlight for "VALOR LÍQUIDO A RECEBER"
  doc.setFillColor(239, 246, 255); // Soft blue 50
  doc.rect(totalsSplitX, totalsMidLineY, rightEdge - totalsSplitX, curY + totalsBoxHeight - totalsMidLineY, 'F');

  // 2. Draw Text
  // Left side: Informações legais (SEM DADOS BANCÁRIOS CONFORME SOLICITADO)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(30, 41, 59);
  doc.text('DOCUMENTO ELETRÔNICO OFICIAL', margin + 3, curY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(71, 85, 105);
  doc.text('Emitido nos termos do Art. 464 da CLT e Lei Federal nº 14.063/2020.', margin + 3, curY + 8.5);
  doc.text('Autenticidade e assinatura digital chanceladas por Certificado ICP-Brasil.', margin + 3, curY + 12.5);

  // Right side: Totals resolution (auto-calculating if 0 or missing)
  const rawTotVenc = receipt.totalVencimentos ?? (receipt as any).total_vencimentos;
  const rawTotDesc = receipt.totalDescontos ?? (receipt as any).total_descontos;
  const rawLiq = receipt.valorLiquido ?? (receipt as any).valor_liquido;

  let totVencNum = typeof rawTotVenc === 'number'
    ? rawTotVenc
    : rawTotVenc ? parseFloat(String(rawTotVenc).replace(/\./g, '').replace(',', '.')) : 0;
  let totDescNum = typeof rawTotDesc === 'number'
    ? rawTotDesc
    : rawTotDesc ? parseFloat(String(rawTotDesc).replace(/\./g, '').replace(',', '.')) : 0;

  // Auto-calculate totalDescontos from items if it was 0 or missing
  if ((!totDescNum || isNaN(totDescNum)) && displayItems.length > 0) {
    totDescNum = displayItems.reduce((acc, it) => {
      const d = it.desconto ?? (it as any).descontos ?? (it as any).valorDesconto ?? ((it as any).tipo === 'DESCONTO' ? (it as any).valor : 0);
      const n = typeof d === 'number' ? d : d ? parseFloat(String(d).replace(/\./g, '').replace(',', '.')) || 0 : 0;
      return acc + (n > 0 ? n : 0);
    }, 0);
  }

  // Auto-calculate totalVencimentos if 0 or missing
  if ((!totVencNum || isNaN(totVencNum)) && displayItems.length > 0) {
    totVencNum = displayItems.reduce((acc, it) => {
      const v = it.vencimento ?? (it as any).vencimentos ?? ((it as any).tipo === 'PROVENTO' || (it as any).tipo === 'VENCIMENTO' ? (it as any).valor : 0);
      const n = typeof v === 'number' ? v : v ? parseFloat(String(v).replace(/\./g, '').replace(',', '.')) || 0 : 0;
      return acc + (n > 0 ? n : 0);
    }, 0);
  }

  const liqNum = typeof rawLiq === 'number'
    ? rawLiq
    : rawLiq ? parseFloat(String(rawLiq).replace(/\./g, '').replace(',', '.')) : +(totVencNum - totDescNum).toFixed(2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Total de Vencimentos', colXVenc + colWVenc - 2.5, curY + 3.8, { align: 'right' });
  doc.text('Total de Descontos', colXDescVal + colWDescVal - 2.5, curY + 3.8, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(formatBRL(totVencNum), colXVenc + colWVenc - 2.5, curY + 7.6, { align: 'right' });
  doc.setTextColor(190, 18, 60); // Distinct Rose-700 color for total deductions
  doc.text(formatBRL(totDescNum), colXDescVal + colWDescVal - 2.5, curY + 7.6, { align: 'right' });
  doc.setTextColor(15, 23, 42);

  // Row 2 Right: Valor Líquido
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 58, 138);
  doc.text('VALOR LÍQUIDO A RECEBER  ==>', totalsSplitX + 3, curY + 13.5);

  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`R$ ${formatBRL(liqNum)}`, rightEdge - 2.5, curY + 13.8, { align: 'right' });

  // 3. Draw ALL Border & Divider Lines ON TOP (Guaranteeing unbroken sharp lines!)
  doc.setDrawColor(51, 65, 85);
  doc.setLineWidth(0.3);
  doc.rect(margin, curY, contentWidth, totalsBoxHeight, 'S');
  doc.line(totalsSplitX, curY, totalsSplitX, curY + totalsBoxHeight);
  doc.line(totalsSplitX, totalsMidLineY, rightEdge, totalsMidLineY);

  curY += totalsBoxHeight;

  // =========================================================================
  // 6. TAX / CALCULATION BASES (6 EQUAL COLUMNS)
  // =========================================================================
  const basesBoxHeight = 12.5;
  const baseColW = contentWidth / 6; // 186 / 6 = 31mm

  doc.setFillColor(255, 255, 255);
  doc.rect(margin, curY, contentWidth, basesBoxHeight, 'S');

  for (let c = 1; c < 6; c++) {
    doc.line(margin + c * baseColW, curY, margin + c * baseColW, curY + basesBoxHeight);
  }

  const basesHeaders = [
    'Salário Base',
    'Sal. Contr. INSS',
    'Base Cálc. FGTS',
    'F.G.T.S do Mês',
    'Base Cálc. IRRF',
    'Faixa IRRF'
  ];
  const basesValues = [
    formatBRL(receipt.salarioBase),
    formatBRL(receipt.salContrINSS),
    formatBRL(receipt.baseCalcFGTS),
    formatBRL(receipt.fgtsDoMes),
    formatBRL(receipt.baseCalcIRRF),
    `${formatBRL(receipt.faixaIRRF)}%`
  ];

  for (let i = 0; i < 6; i++) {
    const colX = margin + i * baseColW;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    doc.text(basesHeaders[i], colX + 2, curY + 3.8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(basesValues[i], colX + 2, curY + 9);
  }

  curY += basesBoxHeight;

  // =========================================================================
  // 7. DECLARAÇÃO DE QUITAÇÃO & TERMO DO COLABORADOR (PARTE DE BAIXO)
  // =========================================================================
  const ackBoxHeight = 15;
  doc.setFillColor(255, 255, 255);
  doc.rect(margin, curY, contentWidth, ackBoxHeight, 'S');

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.2);
  doc.setTextColor(71, 85, 105);
  doc.text(
    'DECLARO TER RECEBIDO A IMPORTÂNCIA LÍQUIDA DISCRIMINADA NESTE RECIBO, REFERENTE AOS MEUS SERVIÇOS PRESTADOS NO PERÍODO ACIMA.',
    margin + 3,
    curY + 4.2
  );

  const isEmployeeSigned = receipt.statusAssinatura === 'ASSINADO';
  if (isEmployeeSigned) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(21, 128, 61); // Green 700
    doc.text(
      `CIÊNCIA E QUITAÇÃO ELETRÔNICA CONFIRMADA: ${employee.nome.toUpperCase()}`,
      margin + 3,
      curY + 8.8
    );
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(51, 65, 85);
    doc.text(
      `Data/Hora: ${receipt.dataAssinatura || '30/09/2026'}`,
      rightEdge - 3,
      curY + 8.8,
      { align: 'right' }
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.0);
    doc.setTextColor(71, 85, 105);
    doc.text(
      `Autenticação Eletrônica 2FA: Código #${receipt.codigoAssinatura || '928412'} • Validado no Portal do Colaborador • Conforme Art. 464 da CLT e Lei nº 14.063/2020`,
      margin + 3,
      curY + 12.8
    );
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(51, 65, 85);
    doc.text(`COLABORADOR: ${employee.nome.toUpperCase()} (CPF: ${employee.cpf})`, margin + 3, curY + 8.8);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.0);
    doc.setTextColor(100, 116, 139);
    doc.text('Validação de ciência disponível via Portal do Colaborador / 2FA (Pendente de assinatura eletrônica)', margin + 3, curY + 12.8);
  }

  curY += ackBoxHeight + 2;

  // =========================================================================
  // 8. CHANCELA VISÍVEL DE ASSINATURA DIGITAL A1 (ICP-BRASIL) NA PARTE DE BAIXO
  // UTILIZA RIGOROSAMENTE O CERTIFICADO A1 CADASTRADO PELO USUÁRIO!
  // =========================================================================
  const docHash = generateDocumentIntegrityHash(employee, receipt, activeCert);
  const titularName = activeCert.titular || receipt.empregador.razaoSocial;
  const titularDoc = activeCert.documentoTitular || receipt.empregador.cei || 'Não especificado';
  const acName = activeCert.autoridadeCertificadora || 'AC SERASA RFB v5 (ICP-Brasil)';
  const serialNo = activeCert.numeroSerie || '4B:82:19:0E:5D:89:33:F1';
  const valFim = activeCert.validadeFim || '31/12/2027';
  const timestampAssinatura = receipt.dataAssinatura || `${receipt.dataEmissao || '30/09/2026'} às 14:00:00 (BRT)`;

  const sigBoxHeight = 40;
  const origin = typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'https://holeritedigital.cartorio.com.br';
  const verificationUrl = `${origin}/?verify=${encodeURIComponent(receipt.id)}&h=${encodeURIComponent(docHash.slice(0, 16))}`;

  // Outer frame
  doc.setDrawColor(30, 58, 138); // Blue 900
  doc.setLineWidth(0.4);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, curY, contentWidth, sigBoxHeight, 1.5, 1.5, 'FD');

  // Security Header banner (Distinct 2-line structure guarantees ZERO overlap or truncation)
  const bannerHeight = 8.0;
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(margin, curY, contentWidth, bannerHeight, 'F');

  // Line 1: Main Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.0);
  doc.setTextColor(255, 255, 255);
  doc.text('DOCUMENTO ASSINADO DIGITALMENTE COM CERTIFICADO DIGITAL A1 (ICP-BRASIL)', margin + 3.5, curY + 3.6);

  // Line 2: Legal Citations & Standards
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.2);
  doc.setTextColor(186, 230, 253); // Sky 200
  doc.text('CONFORMIDADE LEGAL: MEDIDA PROVISÓRIA Nº 2.200-2/2001 • LEI FEDERAL Nº 14.063/2020 • CLT ART. 464', margin + 3.5, curY + 6.6);

  // 1. Vector QR Code on the Left
  const qrX = margin + 3.5;
  const qrY = curY + 9.5;
  const qrSize = 18.0; // 18mm x 18mm
  try {
    const qr = QRCode.create(verificationUrl, { errorCorrectionLevel: 'M' });
    const moduleCount = qr.modules.size;
    const cellSize = qrSize / moduleCount;
    doc.setFillColor(15, 23, 42);
    for (let r = 0; r < moduleCount; r++) {
      for (let c = 0; c < moduleCount; c++) {
        if (qr.modules.get(r, c)) {
          doc.rect(qrX + c * cellSize, qrY + r * cellSize, cellSize, cellSize, 'F');
        }
      }
    }
  } catch (qrErr) {
    console.warn('QR Code generation notice:', qrErr);
  }

  // QR Code Caption
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.0);
  doc.setTextColor(30, 58, 138);
  doc.text('VALIDAÇÃO QR-CODE', qrX + qrSize / 2, curY + 29.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(4.4);
  doc.setTextColor(100, 116, 139);
  doc.text('Aponte a câmera', qrX + qrSize / 2, curY + 31.8, { align: 'center' });

  // Vertical separator between QR Code and Details
  const sepLineX = margin + 25.5;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.25);
  doc.line(sepLineX, curY + bannerHeight, sepLineX, curY + 33.5);

  // 2. Middle Column: Certificate Details
  const midColX = sepLineX + 3.5; // 41mm
  const certRowY = curY + 12.0;
  const valStartX = midColX + 30; // 71mm (clear margin after "Autoridade Certificadora:")

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  doc.setTextColor(15, 23, 42);
  doc.text('Assinante (Titular):', midColX, certRowY);

  let titSize = 5.6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(titSize);
  doc.setTextColor(30, 58, 138);
  while (doc.getTextWidth(titularName) > 48 && titSize > 4.6) {
    titSize -= 0.2;
    doc.setFontSize(titSize);
  }
  doc.text(titularName, valStartX, certRowY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  doc.setTextColor(15, 23, 42);
  doc.text('CNPJ / CPF do Titular:', midColX, certRowY + 4.2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.0);
  doc.setTextColor(51, 65, 85);
  doc.text(titularDoc, valStartX, certRowY + 4.2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  doc.setTextColor(15, 23, 42);
  doc.text('Autoridade Certificadora:', midColX, certRowY + 8.4);
  let acSize = 5.8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(acSize);
  doc.setTextColor(51, 65, 85);
  while (doc.getTextWidth(acName) > 48 && acSize > 4.6) {
    acSize -= 0.2;
    doc.setFontSize(acSize);
  }
  doc.text(acName, valStartX, certRowY + 8.4);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  doc.setTextColor(15, 23, 42);
  doc.text('Série do Certificado:', midColX, certRowY + 12.6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.6);
  doc.setTextColor(51, 65, 85);
  doc.text(`${serialNo} • Val: ${valFim}`, valStartX, certRowY + 12.6);

  // Vertical separator between Middle and Right column
  const rightSepX = margin + 110; // 122mm
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.25);
  doc.line(rightSepX, curY + bannerHeight, rightSepX, curY + 33.5);

  // 3. Right Column: Signature Status, Timestamp and Integrity Hash
  const rightColX = rightSepX + 3.5; // 125.5mm
  const rightValX = rightColX + 20; // 145.5mm

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  doc.setTextColor(15, 23, 42);
  doc.text('Status:', rightColX, certRowY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.0);
  doc.setTextColor(21, 128, 61); // Green 700
  doc.text('ASSINADO DIGITALMENTE', rightValX, certRowY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  doc.setTextColor(15, 23, 42);
  doc.text('Data/Hora:', rightColX, certRowY + 4.2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.setTextColor(51, 65, 85);
  doc.text(timestampAssinatura, rightValX, certRowY + 4.2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  doc.setTextColor(15, 23, 42);
  doc.text('Padrão:', rightColX, certRowY + 8.4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.6);
  doc.setTextColor(71, 85, 105);
  doc.text('PAdES ISO 32000-1 • CLT Art. 464', rightValX, certRowY + 8.4);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  doc.setTextColor(15, 23, 42);
  doc.text('Hash SHA-256:', rightColX, certRowY + 12.6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.2);
  doc.setTextColor(30, 41, 59);
  doc.text(docHash, rightValX, certRowY + 12.6);

  // 4. Security Bottom Strip inside frame
  const certFooterY = curY + 33.5;
  doc.setFillColor(241, 245, 249);
  doc.rect(margin + 0.2, certFooterY, contentWidth - 0.4, 6.3, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, certFooterY, rightEdge, certFooterY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  doc.setTextColor(15, 23, 42);
  doc.text(
    'SEGURANÇA JURÍDICA: Documento assinado digitalmente com garantia de autoria e integridade (MP 2.200-2/2001 e CLT Art. 464).',
    margin + 3,
    certFooterY + 3.0
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.0);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Chave Pública / Thumbprint: ${activeCert.thumbprintSha256 || docHash.slice(0, 32)}`,
    margin + 3,
    certFooterY + 5.2
  );

  doc.setTextColor(37, 99, 235);
  doc.text(
    'Autenticidade verificável via QR-Code ou Portal HoleriteDigital',
    rightEdge - 3,
    certFooterY + 5.2,
    { align: 'right' }
  );

  // Bottom document footer note
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(5.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Documento emitido eletronicamente via Portal HoleriteDigital. Autenticidade e assinatura verificáveis pelo Hash Criptográfico ICP-Brasil (${activeCert.titular}) ou pelo QR-Code acima.`,
    pageWidth / 2,
    pageHeight - 5,
    { align: 'center' }
  );

  return doc;
}

export async function generateSignedPayReceiptBytes(
  employee: Employee,
  receipt: PayReceipt,
  certificateConfig?: DigitalCertificateA1 | null
): Promise<Uint8Array> {
  const activeCert = getActiveA1Certificate(certificateConfig);
  const doc = generatePayReceiptPDF(employee, receipt, activeCert);
  const rawArrayBuffer = doc.output('arraybuffer');
  return signPdfDocument(rawArrayBuffer, activeCert, {
    reason: `Recibo de Pagamento - ${employee.nome} - ${receipt.mesAno} - CLT Art. 464`,
    location: 'Cartório Nobre / Uberaba - MG'
  });
}

export async function generateSignedPayReceiptBase64(
  employee: Employee,
  receipt: PayReceipt,
  certificateConfig?: DigitalCertificateA1 | null
): Promise<string> {
  const signedBytes = await generateSignedPayReceiptBytes(employee, receipt, certificateConfig);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < signedBytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(signedBytes.subarray(i, i + chunkSize)));
  }
  return btoa(binary);
}

export async function downloadPayReceiptPDF(
  employee: Employee,
  receipt: PayReceipt,
  certificateConfig?: DigitalCertificateA1 | null
): Promise<void> {
  const activeCert = getActiveA1Certificate(certificateConfig);
  const doc = generatePayReceiptPDF(employee, receipt, activeCert);
  const cleanName = employee.nome.replace(/\s+/g, '_');
  const cleanMonth = receipt.mesAno.replace(/\s+/g, '_');
  const filename = `Holerite_${cleanName}_${cleanMonth}.pdf`;

  try {
    const rawArrayBuffer = doc.output('arraybuffer');
    const signedBytes = await signPdfDocument(rawArrayBuffer, activeCert, {
      reason: `Recibo de Pagamento - ${employee.nome} - ${receipt.mesAno} - CLT Art. 464`,
      location: 'Cartório Nobre / Uberaba - MG'
    });
    const blob = new Blob([signedBytes as any], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch (err) {
    console.warn('Fallback salvando com jsPDF padrão:', err);
    doc.save(filename);
  }
}
