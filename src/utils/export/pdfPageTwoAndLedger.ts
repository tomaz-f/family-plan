import { jsPDF } from 'jspdf';
import { formatCurrency, formatShortDate } from '../format';
import { getCategoryDisplayName } from '../i18n';
import { cleanPdfText, hexToRgb } from './exportFormatHelpers';
import { ComputedExportData, ExportFilterOptions } from './exportTypes';

/**
 * Renders Sections 2 (Income Breakdown), 3 (Monthly Breakdown), 4 (Full Transaction Ledger),
 * and adds page footers across all generated pages of the jsPDF document.
 */
export function renderPdfRemainingSectionsAndFooters(
  doc: jsPDF,
  opts: ExportFilterOptions,
  data: ComputedExportData,
  initialY: number
): void {
  const isPt = opts.language === 'pt-BR';
  const currency = opts.currency;
  const catMap = new Map(opts.categories.map((c) => [c.id, c]));

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 12;
  const contentWidth = pageWidth - margin * 2; // 186mm

  const fmtMoney = (v: number) => cleanPdfText(formatCurrency(v, currency));

  let y = initialY;

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > pageHeight - 16) {
      doc.addPage();
      y = 16;
    }
  };

  // =========================================================================
  // SECTION 2: INCOME BREAKDOWN BY SOURCE TABLE
  // =========================================================================
  if (data.incomeByCategory.length > 0) {
    ensureSpace(26);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(
      cleanPdfText(
        isPt
          ? '2. ENTRADAS DE DINHEIRO POR ORIGEM / CATEGORIA'
          : '2. INCOME BREAKDOWN BY SOURCE / CATEGORY'
      ),
      margin,
      y
    );
    y += 3;

    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(isPt ? 'Categoria de Entrada' : 'Income Source', margin + 3, y + 4.8);
    doc.text(isPt ? 'Qtd.' : 'Count', margin + 95, y + 4.8, { align: 'right' });
    doc.text(isPt ? 'Total Recebido' : 'Total Received', margin + 142, y + 4.8, {
      align: 'right',
    });
    doc.text(isPt ? 'Participação' : 'Share %', margin + contentWidth - 3, y + 4.8, {
      align: 'right',
    });
    y += 7;

    data.incomeByCategory.forEach((row, idx) => {
      ensureSpace(7.5);
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, contentWidth, 6.8, 'F');
      }

      const [r, g, b] = hexToRgb(row.color);
      doc.setFillColor(r, g, b);
      doc.circle(margin + 4.5, y + 3.4, 1.5, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      doc.text(cleanPdfText(row.name), margin + 8, y + 4.6);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(String(row.count), margin + 95, y + 4.6, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(5, 150, 105);
      doc.text(fmtMoney(row.amount), margin + 142, y + 4.6, { align: 'right' });

      doc.setTextColor(51, 65, 85);
      doc.text(`${row.share.toFixed(1)}%`, margin + contentWidth - 3, y + 4.6, {
        align: 'right',
      });

      y += 6.8;
    });

    y += 6;
  }

  // =========================================================================
  // SECTION 3: MONTHLY BREAKDOWN TABLE (For Annual / All-Time reports)
  // =========================================================================
  if (opts.periodMode !== 'monthly' && data.monthlySeries.length > 0) {
    ensureSpace(30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(
      cleanPdfText(
        isPt
          ? '3. RESUMO MENSAL E EVOLUÇÃO DO SALDO NO ANO'
          : '3. MONTH-BY-MONTH CASH FLOW & CLOSING BALANCE'
      ),
      margin,
      y
    );
    y += 3;

    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(isPt ? 'Mês' : 'Month', margin + 3, y + 4.8);
    doc.text(isPt ? 'Lanç.' : 'Items', margin + 52, y + 4.8, { align: 'right' });
    doc.text(isPt ? 'Entradas (+)' : 'Inputs (+)', margin + 88, y + 4.8, { align: 'right' });
    doc.text(isPt ? 'Despesas (-)' : 'Expenses (-)', margin + 124, y + 4.8, { align: 'right' });
    doc.text(isPt ? 'Resultado Mês' : 'Monthly Net', margin + 156, y + 4.8, { align: 'right' });
    doc.text(isPt ? 'Saldo Final' : 'Closing Bal.', margin + contentWidth - 3, y + 4.8, {
      align: 'right',
    });
    y += 7;

    data.monthlySeries.forEach((mRow, idx) => {
      ensureSpace(7);
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, contentWidth, 6.5, 'F');
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.8);
      doc.setTextColor(30, 41, 59);
      doc.text(cleanPdfText(mRow.fullLabel), margin + 3, y + 4.5);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(String(mRow.count), margin + 52, y + 4.5, { align: 'right' });
      doc.text(fmtMoney(mRow.income), margin + 88, y + 4.5, { align: 'right' });
      doc.text(fmtMoney(mRow.expense), margin + 124, y + 4.5, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(
        mRow.net >= 0 ? 5 : 225,
        mRow.net >= 0 ? 150 : 29,
        mRow.net >= 0 ? 105 : 72
      );
      doc.text(
        `${mRow.net >= 0 ? '+' : '-'} ${fmtMoney(Math.abs(mRow.net))}`,
        margin + 156,
        y + 4.5,
        { align: 'right' }
      );

      doc.setTextColor(15, 23, 42);
      doc.text(fmtMoney(mRow.closingBalance), margin + contentWidth - 3, y + 4.5, {
        align: 'right',
      });

      y += 6.5;
    });

    y += 6;
  }

  // =========================================================================
  // SECTION 4: COMPLETE TRANSACTION HISTORY LEDGER
  // =========================================================================
  ensureSpace(25);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  const ledgerSectionNum = opts.periodMode !== 'monthly' ? '4' : '3';
  doc.text(
    cleanPdfText(
      isPt
        ? `${ledgerSectionNum}. EXTRATO DETALHADO DE LANÇAMENTOS (${data.filteredTransactionsAsc.length} ITENS)`
        : `${ledgerSectionNum}. DETAILED TRANSACTION LEDGER (${data.filteredTransactionsAsc.length} ITEMS)`
    ),
    margin,
    y
  );
  y += 3;

  const drawLedgerHeader = () => {
    doc.setFillColor(15, 23, 42);
    doc.rect(margin, y, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(255, 255, 255);
    doc.text(isPt ? 'Data' : 'Date', margin + 2.5, y + 4.8);
    doc.text(isPt ? 'Descrição' : 'Description', margin + 24, y + 4.8);
    doc.text(isPt ? 'Categoria' : 'Category', margin + 96, y + 4.8);
    doc.text(isPt ? 'Info / Obs.' : 'Details', margin + 128, y + 4.8);
    doc.text(isPt ? 'Valor' : 'Amount', margin + 161, y + 4.8, { align: 'right' });
    doc.text(isPt ? 'Saldo' : 'Balance', margin + contentWidth - 2.5, y + 4.8, {
      align: 'right',
    });
    y += 7;
  };

  drawLedgerHeader();

  data.filteredTransactionsAsc.forEach((tx, idx) => {
    if (y + 6.5 > pageHeight - 15) {
      doc.addPage();
      y = 16;
      drawLedgerHeader();
    }

    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, contentWidth, 6.2, 'F');
    }

    const cat = catMap.get(tx.categoryId);
    const catName = getCategoryDisplayName(cat, opts.language) || tx.categoryId;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(71, 85, 105);
    doc.text(cleanPdfText(formatShortDate(tx.date, opts.language)), margin + 2.5, y + 4.3);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    const descStr = cleanPdfText(tx.description);
    doc.text(descStr.length > 38 ? descStr.slice(0, 37) + '...' : descStr, margin + 24, y + 4.3);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const cleanCat = cleanPdfText(catName);
    doc.text(cleanCat.length > 18 ? cleanCat.slice(0, 17) + '.' : cleanCat, margin + 96, y + 4.3);

    let extraInfo = tx.notes || '';
    if (tx.installmentTotal && tx.installmentTotal > 1) {
      extraInfo = `${tx.installmentCurrent || 1}/${tx.installmentTotal} ${extraInfo}`.trim();
    }
    const cleanExtra = cleanPdfText(extraInfo);
    doc.text(
      cleanExtra.length > 16 ? cleanExtra.slice(0, 15) + '.' : cleanExtra,
      margin + 128,
      y + 4.3
    );

    const isInc = tx.type === 'income';
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(isInc ? 5 : 225, isInc ? 150 : 29, isInc ? 105 : 72);
    doc.text(`${isInc ? '+' : '-'} ${fmtMoney(tx.amount)}`, margin + 161, y + 4.3, {
      align: 'right',
    });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(fmtMoney(tx.runningBalance), margin + contentWidth - 2.5, y + 4.3, {
      align: 'right',
    });

    y += 6.2;
  });

  // =========================================================================
  // PAGE NUMBERS & FOOTER ON ALL PAGES
  // =========================================================================
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      cleanPdfText(`Prumo — ${opts.familyName} • ${data.periodTitle}`),
      margin,
      pageHeight - 5.5
    );
    doc.text(
      cleanPdfText(isPt ? `Página ${p} de ${totalPages}` : `Page ${p} of ${totalPages}`),
      pageWidth - margin,
      pageHeight - 5.5,
      { align: 'right' }
    );
  }
}
