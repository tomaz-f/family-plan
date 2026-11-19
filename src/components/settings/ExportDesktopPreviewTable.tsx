import React, { useMemo, useState } from 'react';
import { AppLanguage, Category } from '../../types';
import { ComputedExportData } from '../../utils/exportReport';
import { formatCurrency } from '../../utils/format';
import { getCategoryDisplayName } from '../../utils/i18n';

interface ExportDesktopPreviewTableProps {
  language: AppLanguage;
  currency: string;
  categories: Category[];
  exportPreview: ComputedExportData;
}

type PreviewTableTab = 'categories' | 'transactions';

const formatDayMonth = (dateStr: string): string => {
  const parts = dateStr.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}` : dateStr;
};

export const ExportDesktopPreviewTable: React.FC<ExportDesktopPreviewTableProps> = ({
  language,
  currency,
  categories,
  exportPreview,
}) => {
  const [activeTab, setActiveTab] = useState<PreviewTableTab>('categories');
  const isPt = language === 'pt-BR';
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const topCategories = exportPreview.expenseByCategory.slice(0, 8);
  const latestTransactions = [...exportPreview.filteredTransactionsAsc].reverse().slice(0, 8);

  return (
    <div className="hidden lg:block rounded-2xl border border-slate-200/80 dark:border-[#21262D] bg-white dark:bg-[#0D1117] p-4 shadow-sm space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
          {isPt ? 'Prévia Detalhada' : 'Detailed Preview'}
        </h4>
        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-[#161B22] border border-slate-200/80 dark:border-[#21262D] shrink-0">
          {(
            [
              { id: 'categories', label: isPt ? 'Top Categorias' : 'Top Categories' },
              { id: 'transactions', label: isPt ? 'Últimos Lançamentos' : 'Latest Entries' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer select-none ${
                activeTab === tab.id
                  ? 'bg-[#6E5440] text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'categories' ? (
        topCategories.length === 0 ? (
          <p className="py-6 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
            {isPt ? 'Nenhuma despesa por categoria neste período.' : 'No category expenses in this period.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-[#21262D] text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="pb-2 pr-2">{isPt ? 'Categoria' : 'Category'}</th>
                  <th className="pb-2 px-2 text-right">{isPt ? 'Qtd.' : 'Count'}</th>
                  <th className="pb-2 px-2 text-right">{isPt ? 'Part.' : 'Share'}</th>
                  <th className="pb-2 pl-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#21262D]/70">
                {topCategories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-slate-50/70 dark:hover:bg-[#161B22]/50">
                    <td className="py-2 pr-2 font-semibold text-slate-800 dark:text-slate-100">
                      <span className="inline-flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                        <span className="truncate max-w-[180px]">{cat.name}</span>
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right text-slate-500 dark:text-slate-400 tabular-nums">{cat.count}</td>
                    <td className="py-2 px-2 text-right text-slate-500 dark:text-slate-400 tabular-nums">{cat.share.toFixed(1)}%</td>
                    <td className="py-2 pl-2 text-right font-bold text-[#EF4444] tabular-nums whitespace-nowrap">
                      -{formatCurrency(cat.amount, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : latestTransactions.length === 0 ? (
        <p className="py-6 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
          {isPt ? 'Nenhum lançamento encontrado neste período.' : 'No entries found in this period.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-[#21262D] text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="pb-2 pr-2">{isPt ? 'Data' : 'Date'}</th>
                <th className="pb-2 px-2">{isPt ? 'Descrição' : 'Description'}</th>
                <th className="pb-2 px-2">{isPt ? 'Categoria' : 'Category'}</th>
                <th className="pb-2 px-2">Status</th>
                <th className="pb-2 pl-2 text-right">{isPt ? 'Valor' : 'Amount'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#21262D]/70">
              {latestTransactions.map((tx) => {
                const isUnpaid = tx.status === 'unpaid';
                const catName = getCategoryDisplayName(catMap.get(tx.categoryId), language);
                return (
                  <tr key={tx.id} className="hover:bg-slate-50/70 dark:hover:bg-[#161B22]/50">
                    <td className="py-2 pr-2 text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">{formatDayMonth(tx.date)}</td>
                    <td className="py-2 px-2 font-semibold text-slate-800 dark:text-slate-100 max-w-[170px] truncate">{tx.description}</td>
                    <td className="py-2 px-2 text-slate-500 dark:text-slate-400 max-w-[110px] truncate">{catName}</td>
                    <td className="py-2 px-2 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isUnpaid
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                            : 'bg-emerald-500/10 text-[#10B981] border border-emerald-500/20'
                        }`}
                      >
                        {isUnpaid ? (isPt ? 'Pendente' : 'Pending') : isPt ? 'Pago' : 'Paid'}
                      </span>
                    </td>
                    <td className={`py-2 pl-2 text-right font-bold tabular-nums whitespace-nowrap ${tx.type === 'income' ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                      {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount, currency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
