import { jsPDF } from 'jspdf';
import { exportFilteredHistoryToCSV } from './export/csvReportExporter';
import { cleanPdfText } from './export/exportFormatHelpers';
import {
  ComputedExportData,
  ExportFilterOptions,
  ExportPeriodMode,
  ExportTypeFilter,
} from './export/exportTypes';
import {
  generateCashFlowSvg,
  generateCategoryDonutSvg,
  generateCommitmentsComparisonSvg,
  generatePaymentChannelsSvg,
  generatePrumoLogoSvg,
} from './export/htmlReportCharts';
import { generateReportHtml } from './export/htmlReportTemplate';
import { renderPdfPageOne } from './export/pdfPageOneBuilder';
import { renderPdfRemainingSectionsAndFooters } from './export/pdfPageTwoAndLedger';
import { computeExportData } from './export/reportDataAggregator';

export type {
  ComputedExportData,
  ExportFilterOptions,
  ExportPeriodMode,
  ExportTypeFilter,
};

export {
  cleanPdfText,
  computeExportData,
  exportFilteredHistoryToCSV,
  generateCashFlowSvg,
  generateCategoryDonutSvg,
  generateCommitmentsComparisonSvg,
  generatePaymentChannelsSvg,
  generatePrumoLogoSvg,
  generateReportHtml,
};

/**
 * Generates and downloads a detailed multi-page PDF Financial Report with charts,
 * category breakdowns, commitments comparison, and full transaction ledger silently
 * in memory using direct jsPDF and offscreen canvas drawing.
 */
export function exportFilteredHistoryToPDF(opts: ExportFilterOptions): Promise<void> {
  const data = computeExportData(opts);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const yAfterPageOne = renderPdfPageOne(doc, opts, data);
  renderPdfRemainingSectionsAndFooters(doc, opts, data, yAfterPageOne);

  doc.save(`prumo-relatorio-${data.filenameSlug}.pdf`);
  return Promise.resolve();
}
