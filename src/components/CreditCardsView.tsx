import React, { useState, useMemo } from 'react';
import {
  CreditCard as CreditCardIcon,
  Plus,
  Calendar,
  CheckCircle2,
  Clock,
  TrendingUp,
  AlertCircle,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  DollarSign,
  PieChart as PieChartIcon,
  ArrowUpRight,
  ExternalLink,
  Info,
  X,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts';
import {
  AppLanguage,
  AppTheme,
  Category,
  CreditCard,
  CreditCardBrand,
  Transaction,
} from '../types';
import { CategoryIcon } from './CategoryIcon';
import {
  computeCardFirstInvoiceMonth,
  formatCurrency,
  formatMonthLabel,
  formatShortMonthLabel,
  getTodayDateStr,
  shiftMonth,
} from '../utils/format';
import { getCategoryDisplayName, TRANSLATIONS } from '../utils/i18n';

interface CreditCardsViewProps {
  creditCards: CreditCard[];
  transactions: Transaction[];
  categories: Category[];
  currency: string;
  language: AppLanguage;
  theme: AppTheme;
  onSaveCard: (card: Partial<CreditCard> & { name: string; totalLimit: number; closingDay: number; dueDay: number }) => Promise<void>;
  onDeleteCard: (cardId: string) => Promise<void>;
  onPayInvoice: (cardId: string, invoiceMonth: string) => Promise<void>;
  onOpenAddExpense: (cardId?: string) => void;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (tx: Transaction) => void;
}

const BRAND_OPTIONS: { id: CreditCardBrand; name: string }[] = [
  { id: 'mastercard', name: 'Mastercard' },
  { id: 'visa', name: 'Visa' },
  { id: 'elo', name: 'Elo' },
  { id: 'amex', name: 'American Express' },
  { id: 'default', name: 'Outro / Genérico' },
];

const PRESET_COLORS = [
  '#820ad1', // Nubank purple
  '#ff7a00', // Inter orange
  '#003399', // Itaú / Bradesco blue
  '#059669', // Emerald
  '#dc2626', // Santander red
  '#0284c7', // Sky blue
  '#4f46e5', // Indigo
  '#0f172a', // Midnight slate
  '#d97706', // Amber gold
  '#ec4899', // Pink
];

// Visual brand badge component
export const CardBrandBadge: React.FC<{ brand?: CreditCardBrand; className?: string }> = ({
  brand = 'default',
  className = '',
}) => {
  if (brand === 'mastercard') {
    return (
      <div className={`flex items-center -space-x-1.5 ${className}`}>
        <div className="w-5 h-5 rounded-full bg-red-600/90 shadow-sm" />
        <div className="w-5 h-5 rounded-full bg-amber-500/90 shadow-sm" />
      </div>
    );
  }
  if (brand === 'visa') {
    return (
      <span className={`font-black italic tracking-wider text-sm text-blue-200 ${className}`}>
        VISA
      </span>
    );
  }
  if (brand === 'elo') {
    return (
      <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-black/40 text-[10px] font-black tracking-tight ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block" />
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
        <span className="ml-0.5 text-white">elo</span>
      </div>
    );
  }
  if (brand === 'amex') {
    return (
      <span className={`px-1.5 py-0.5 rounded bg-sky-900 text-sky-200 text-[10px] font-black tracking-widest ${className}`}>
        AMEX
      </span>
    );
  }
  return <CreditCardIcon size={20} className={className} />;
};

export const CreditCardsView: React.FC<CreditCardsViewProps> = ({
  creditCards,
  transactions,
  categories,
  currency,
  language,
  theme,
  onSaveCard,
  onDeleteCard,
  onPayInvoice,
  onOpenAddExpense,
  onEditTransaction,
  onDeleteTransaction,
}) => {
  const t = TRANSLATIONS[language];
  const todayStr = getTodayDateStr();
  const currentMonthStr = todayStr.slice(0, 7);

  // Selected card for detail panel (defaults to first card if available)
  const [selectedCardId, setSelectedCardId] = useState<string | null>(
    creditCards[0]?.id || null
  );

  // Selected month for card statement view
  const [statementMonth, setStatementMonth] = useState<string>(currentMonthStr);

  // Card Add/Edit Modal state
  const [cardModalOpen, setCardModalOpen] = useState<boolean>(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [cardFormName, setCardFormName] = useState<string>('');
  const [cardFormLimit, setCardFormLimit] = useState<string>('');
  const [cardFormClosingDay, setCardFormClosingDay] = useState<string>('25');
  const [cardFormDueDay, setCardFormDueDay] = useState<string>('5');
  const [cardFormBrand, setCardFormBrand] = useState<CreditCardBrand>('mastercard');
  const [cardFormColor, setCardFormColor] = useState<string>(PRESET_COLORS[0]);
  const [cardFormLastDigits, setCardFormLastDigits] = useState<string>('');
  const [cardFormSubmitting, setCardFormSubmitting] = useState<boolean>(false);

  // Delete Card modal state
  const [deleteConfirmCardId, setDeleteConfirmCardId] = useState<string | null>(null);
  const [payingInvoiceCycle, setPayingInvoiceCycle] = useState<{ cardId: string; invoiceMonth: string } | null>(null);
  const [payingSubmitting, setPayingSubmitting] = useState<boolean>(false);

  // Keep selectedCardId valid when creditCards change
  const activeCard = useMemo(() => {
    return creditCards.find((c) => c.id === selectedCardId) || creditCards[0] || null;
  }, [creditCards, selectedCardId]);

  // Helper to determine the invoiceMonth of any card transaction
  const getTxInvoiceMonth = (tx: Transaction, card: CreditCard): string => {
    if (tx.invoiceMonth) return tx.invoiceMonth;
    return computeCardFirstInvoiceMonth(tx.purchaseDate || tx.date, card.closingDay).invoiceMonth;
  };

  // Compute card metrics for all cards
  const cardsMetrics = useMemo(() => {
    const cardMap = new Map<string, CreditCard>();
    creditCards.forEach((c) => cardMap.set(c.id, c));

    return creditCards.map((card) => {
      const cardTxs = transactions.filter((tx) => tx.cardId === card.id);

      // Used limit: sum of all unpaid purchases
      const usedLimit = cardTxs.reduce((sum, tx) => {
        if (tx.status === 'unpaid') {
          return sum + Number(tx.amount || 0);
        }
        return sum;
      }, 0);

      const availableLimit = Math.max(0, card.totalLimit - usedLimit);
      const usedPercentage =
        card.totalLimit > 0 ? Math.min(100, Math.round((usedLimit / card.totalLimit) * 100)) : 0;

      // Current month invoice
      const currentInvoiceTotal = cardTxs.reduce((sum, tx) => {
        const invMonth = getTxInvoiceMonth(tx, card);
        if (invMonth === currentMonthStr) {
          return sum + Number(tx.amount || 0);
        }
        return sum;
      }, 0);

      // Next month invoice
      const nextMonthStr = shiftMonth(currentMonthStr, 1);
      const nextInvoiceTotal = cardTxs.reduce((sum, tx) => {
        const invMonth = getTxInvoiceMonth(tx, card);
        if (invMonth === nextMonthStr) {
          return sum + Number(tx.amount || 0);
        }
        return sum;
      }, 0);

      // Check if current month invoice has a settlement transaction on main bank statement
      const currentSettledKey = `${card.id}__${currentMonthStr}`;
      const settlementTx = transactions.find((tx) => tx.settledInvoiceKey === currentSettledKey);
      const isCurrentInvoiceSettled = Boolean(settlementTx && settlementTx.status === 'paid');
      const isCurrentInvoicePending = Boolean(settlementTx && settlementTx.status === 'unpaid');

      return {
        card,
        usedLimit,
        availableLimit,
        usedPercentage,
        currentInvoiceTotal,
        nextInvoiceTotal,
        settlementTx,
        isCurrentInvoiceSettled,
        isCurrentInvoicePending,
      };
    });
  }, [creditCards, transactions, currentMonthStr]);

  // Consolidated Multi-Card Totals (Top Section)
  const consolidated = useMemo(() => {
    let totalLimit = 0;
    let totalUsed = 0;

    cardsMetrics.forEach((m) => {
      totalLimit += m.card.totalLimit;
      totalUsed += m.usedLimit;
    });

    const totalAvailable = Math.max(0, totalLimit - totalUsed);
    const combinedPercentage =
      totalLimit > 0 ? Math.min(100, Math.round((totalUsed / totalLimit) * 100)) : 0;

    // 6-Month Projection Commitment
    const projectionMonths: string[] = [];
    for (let i = 0; i < 6; i++) {
      projectionMonths.push(shiftMonth(currentMonthStr, i));
    }

    const projectionData = projectionMonths.map((ym) => {
      const row: Record<string, any> = {
        monthKey: ym,
        label: formatShortMonthLabel(ym, language),
        fullLabel: formatMonthLabel(ym, language),
        totalCommitment: 0,
      };

      creditCards.forEach((card) => {
        const cardTxs = transactions.filter((tx) => tx.cardId === card.id);
        const cardMonthTotal = cardTxs.reduce((sum, tx) => {
          const invMonth = getTxInvoiceMonth(tx, card);
          if (invMonth === ym) {
            return sum + Number(tx.amount || 0);
          }
          return sum;
        }, 0);

        row[card.id] = cardMonthTotal;
        row.totalCommitment += cardMonthTotal;
      });

      return row;
    });

    return {
      totalLimit,
      totalUsed,
      totalAvailable,
      combinedPercentage,
      projectionData,
      projectionMonths,
    };
  }, [cardsMetrics, creditCards, transactions, currentMonthStr, language]);

  // Statement transactions for the currently active card and selected month
  const statementData = useMemo(() => {
    if (!activeCard) {
      return {
        txs: [],
        total: 0,
        isSettled: false,
        isPendingPayment: false,
        settlementTx: null,
      };
    }

    const txs = transactions
      .filter((tx) => tx.cardId === activeCard.id && getTxInvoiceMonth(tx, activeCard) === statementMonth)
      .sort((a, b) => (b.purchaseDate || b.date).localeCompare(a.purchaseDate || a.date));

    const total = txs.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

    const settlementKey = `${activeCard.id}__${statementMonth}`;
    const settlementTx = transactions.find((tx) => tx.settledInvoiceKey === settlementKey) || null;
    const isSettled = Boolean(settlementTx && settlementTx.status === 'paid');
    const isPendingPayment = Boolean(settlementTx && settlementTx.status === 'unpaid');

    return {
      txs,
      total,
      isSettled,
      isPendingPayment,
      settlementTx,
    };
  }, [activeCard, transactions, statementMonth]);

  // Handlers for Add/Edit Card Modal
  const openAddCardModal = () => {
    setEditingCard(null);
    setCardFormName('');
    setCardFormLimit('5000');
    setCardFormClosingDay('25');
    setCardFormDueDay('5');
    setCardFormBrand('mastercard');
    setCardFormColor(PRESET_COLORS[creditCards.length % PRESET_COLORS.length]);
    setCardFormLastDigits('');
    setCardModalOpen(true);
  };

  const openEditCardModal = (card: CreditCard, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCard(card);
    setCardFormName(card.name);
    setCardFormLimit(String(card.totalLimit));
    setCardFormClosingDay(String(card.closingDay));
    setCardFormDueDay(String(card.dueDay));
    setCardFormBrand(card.brand || 'mastercard');
    setCardFormColor(card.color || PRESET_COLORS[0]);
    setCardFormLastDigits(card.lastDigits || '');
    setCardModalOpen(true);
  };

  const handleSaveCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedLimit = parseFloat(cardFormLimit.replace(',', '.'));
    const parsedClosing = Math.min(31, Math.max(1, parseInt(cardFormClosingDay, 10) || 1));
    const parsedDue = Math.min(31, Math.max(1, parseInt(cardFormDueDay, 10) || 1));

    if (!cardFormName.trim() || Number.isNaN(parsedLimit) || parsedLimit <= 0) return;

    setCardFormSubmitting(true);
    try {
      await onSaveCard({
        id: editingCard?.id,
        name: cardFormName.trim(),
        totalLimit: parsedLimit,
        closingDay: parsedClosing,
        dueDay: parsedDue,
        brand: cardFormBrand,
        color: cardFormColor,
        lastDigits: cardFormLastDigits.trim().slice(-4),
      });
      setCardModalOpen(false);
    } finally {
      setCardFormSubmitting(false);
    }
  };

  // Handlers for Pay Invoice
  const handleConfirmPayInvoice = async () => {
    if (!payingInvoiceCycle) return;
    setPayingSubmitting(true);
    try {
      await onPayInvoice(payingInvoiceCycle.cardId, payingInvoiceCycle.invoiceMonth);
      setPayingInvoiceCycle(null);
    } finally {
      setPayingSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2.5">
            <CreditCardIcon className="text-indigo-400" size={26} />
            <span>{t.creditCardsViewTitle}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            {t.creditCardsViewSubtitle}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openAddCardModal}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all hover:scale-[1.02]"
          >
            <Plus size={16} />
            <span>{t.addCardBtn}</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: Consolidated Multi-Card Forecast Summary */}
      <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                {t.consolidatedForecastTitle}
              </h2>
              <p className="text-xs text-slate-400">
                {t.consolidatedForecastSubtitle}
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 w-fit">
            {creditCards.length} {t.cardsRegisteredCount(creditCards.length)}
          </span>
        </div>

        {/* Combined Limit KPI Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Total Combined Limit */}
          <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between">
            <div>
              <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 block">
                {t.combinedTotalLimit}
              </span>
              <p className="text-xl font-black text-slate-100 mt-1">
                {formatCurrency(consolidated.totalLimit, currency)}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400">
              <ShieldCheck size={20} />
            </div>
          </div>

          {/* Combined Used Limit */}
          <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between">
            <div>
              <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 block">
                {t.combinedUsedLimit}
              </span>
              <p className="text-xl font-black text-rose-400 mt-1">
                {formatCurrency(consolidated.totalUsed, currency)}
              </p>
              <span className="text-[10px] text-slate-400 font-medium">
                {consolidated.combinedPercentage}% {t.limitUtilizedLabel}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400">
              <TrendingUp size={20} />
            </div>
          </div>

          {/* Combined Available Limit */}
          <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between">
            <div>
              <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 block">
                {t.combinedAvailableLimit}
              </span>
              <p className="text-xl font-black text-emerald-400 mt-1">
                {formatCurrency(consolidated.totalAvailable, currency)}
              </p>
              <span className="text-[10px] text-emerald-500 font-medium">
                {100 - consolidated.combinedPercentage}% {t.limitAvailableLabel}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
              <DollarSign size={20} />
            </div>
          </div>
        </div>

        {/* Combined Utilization Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
            <span>{t.globalLimitUsage}</span>
            <span className={consolidated.combinedPercentage > 85 ? 'text-rose-400 font-bold' : 'text-slate-300'}>
              {consolidated.combinedPercentage}%
            </span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden p-0.5 border border-slate-700/60">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                consolidated.combinedPercentage > 85
                  ? 'bg-rose-500'
                  : consolidated.combinedPercentage > 65
                  ? 'bg-amber-500'
                  : 'bg-indigo-500'
              }`}
              style={{ width: `${Math.min(100, consolidated.combinedPercentage)}%` }}
            />
          </div>
        </div>

        {/* 6-Month Stacked Commitment Chart */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase tracking-wider font-bold text-slate-400 flex items-center gap-1.5">
              <Layers size={14} className="text-indigo-400" />
              {t.sixMonthForecastChartTitle}
            </span>
            <span className="text-[11px] text-slate-400">
              {t.nextMonthsForecastWindow}
            </span>
          </div>

          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={consolidated.projectionData}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                  tickFormatter={(val) =>
                    val >= 1000 ? `${(val / 1000).toFixed(0)}k` : String(val)
                  }
                />
                <RechartsTooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const dataPoint = payload[0]?.payload;
                      return (
                        <div className="rounded-xl bg-slate-900 border border-slate-700 p-3 shadow-xl text-xs space-y-1.5 min-w-[180px]">
                          <p className="font-bold text-slate-200 border-b border-slate-800 pb-1">
                            {dataPoint?.fullLabel}
                          </p>
                          <p className="text-emerald-400 font-extrabold text-sm">
                            Total: {formatCurrency(dataPoint?.totalCommitment || 0, currency)}
                          </p>
                          <div className="space-y-1 pt-1">
                            {creditCards.map((card) => {
                              const amount = dataPoint ? dataPoint[card.id] || 0 : 0;
                              if (amount <= 0) return null;
                              return (
                                <div key={card.id} className="flex items-center justify-between gap-2 text-[11px]">
                                  <span className="flex items-center gap-1 text-slate-300">
                                    <span
                                      className="w-2 h-2 rounded-full inline-block"
                                      style={{ backgroundColor: card.color || '#6366f1' }}
                                    />
                                    {card.name}
                                  </span>
                                  <span className="font-semibold text-slate-200">
                                    {formatCurrency(amount, currency)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {creditCards.map((card) => (
                  <Bar
                    key={card.id}
                    dataKey={card.id}
                    name={card.name}
                    stackId="cards"
                    fill={card.color || '#6366f1'}
                    radius={[0, 0, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Quick Monthly Commitment Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-3">
            {consolidated.projectionData.map((row) => {
              const isCurrent = row.monthKey === currentMonthStr;
              return (
                <button
                  key={row.monthKey}
                  type="button"
                  onClick={() => setStatementMonth(row.monthKey)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    statementMonth === row.monthKey
                      ? 'bg-indigo-950/60 border-indigo-500/80 shadow-md ring-1 ring-indigo-500/40'
                      : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800/80'
                  }`}
                >
                  <span className="text-[10px] uppercase font-bold text-slate-400 block truncate">
                    {row.fullLabel} {isCurrent && `(${t.currentBadgeShort})`}
                  </span>
                  <p className="text-sm font-black text-slate-100 mt-0.5">
                    {formatCurrency(row.totalCommitment, currency)}
                  </p>
                  <div className="flex items-center gap-1 mt-1 overflow-hidden">
                    {creditCards.map((c) => {
                      const cardVal = row[c.id] || 0;
                      if (cardVal <= 0) return null;
                      return (
                        <span
                          key={c.id}
                          className="w-2 h-2 rounded-full shrink-0"
                          title={`${c.name}: ${formatCurrency(cardVal, currency)}`}
                          style={{ backgroundColor: c.color || '#6366f1' }}
                        />
                      );
                    })}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* SECTION 2: Registered Credit Cards Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <CreditCardIcon size={18} className="text-indigo-400" />
            <span>{t.registeredCardsSectionTitle}</span>
          </h2>
          <span className="text-xs text-slate-400">
            {t.selectCardStatementHint}
          </span>
        </div>

        {creditCards.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-900/60 border border-dashed border-slate-800 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 mx-auto flex items-center justify-center">
              <CreditCardIcon size={24} />
            </div>
            <p className="text-sm font-semibold text-slate-300">
              {t.noCardsRegisteredYet}
            </p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {t.noCardsRegisteredDesc}
            </p>
            <button
              type="button"
              onClick={openAddCardModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 transition-colors"
            >
              <Plus size={15} />
              <span>{t.registerFirstCardBtn}</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {cardsMetrics.map((metric) => {
              const card = metric.card;
              const isSelected = activeCard?.id === card.id;

              return (
                <div
                  key={card.id}
                  onClick={() => setSelectedCardId(card.id)}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                    isSelected
                      ? 'bg-slate-900/90 border-indigo-500 shadow-xl ring-2 ring-indigo-500/30'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 shadow-md'
                  }`}
                >
                  {/* Card Visual Header */}
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0"
                          style={{ backgroundColor: card.color || '#6366f1' }}
                        >
                          <CardBrandBadge brand={card.brand} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-slate-100 truncate">
                            {card.name}
                          </h3>
                          {card.lastDigits && (
                            <span className="text-[11px] text-slate-400 font-mono">
                              •••• {card.lastDigits}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Card Edit/Delete actions */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => openEditCardModal(card, e)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                          title={t.editCardBtn}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmCardId(card.id);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                          title={t.deleteCardBtn}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Closing & Due Day Badges */}
                    <div className="flex items-center gap-2 mt-3 text-xs">
                      <span className="px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700/60 text-slate-300 font-medium text-[11px]">
                        {t.closingDayShort}: <strong>{card.closingDay}</strong>
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700/60 text-slate-300 font-medium text-[11px]">
                        {t.dueDayShort}: <strong>{card.dueDay}</strong>
                      </span>
                    </div>

                    {/* Current & Next Invoices */}
                    <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-800/80">
                      <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/40">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block truncate">
                          {t.currentInvoiceTitle}
                        </span>
                        <p className="text-base font-black text-rose-400 mt-0.5">
                          {formatCurrency(metric.currentInvoiceTotal, currency)}
                        </p>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/40">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block truncate">
                          {t.nextInvoiceTitle}
                        </span>
                        <p className="text-base font-black text-amber-400 mt-0.5">
                          {formatCurrency(metric.nextInvoiceTotal, currency)}
                        </p>
                      </div>
                    </div>

                    {/* Limit Utilization Bar */}
                    <div className="space-y-1.5 mt-4">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>
                          {t.usedLimit}: <strong>{formatCurrency(metric.usedLimit, currency)}</strong>
                        </span>
                        <span>
                          {t.availLimit}: <strong>{formatCurrency(metric.availableLimit, currency)}</strong>
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${metric.usedPercentage}%`,
                            backgroundColor: card.color || '#6366f1',
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>{t.totalLimit}: {formatCurrency(card.totalLimit, currency)}</span>
                        <span>{metric.usedPercentage}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions footer */}
                  <div className="flex items-center gap-2 mt-5 pt-3 border-t border-slate-800/80">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenAddExpense(card.id);
                      }}
                      className="flex-1 py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-700 transition-colors"
                    >
                      <Plus size={13} />
                      <span>{t.addCardPurchaseBtn}</span>
                    </button>

                    <button
                      type="button"
                      disabled={metric.currentInvoiceTotal <= 0 || metric.isCurrentInvoiceSettled}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPayingInvoiceCycle({
                          cardId: card.id,
                          invoiceMonth: currentMonthStr,
                        });
                      }}
                      className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                        metric.isCurrentInvoiceSettled
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 cursor-default'
                          : metric.isCurrentInvoicePending
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          : metric.currentInvoiceTotal > 0
                          ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm'
                          : 'bg-slate-800/50 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      {metric.isCurrentInvoiceSettled ? (
                        <>
                          <CheckCircle2 size={13} />
                          <span>{t.invoicePaidBadge}</span>
                        </>
                      ) : metric.isCurrentInvoicePending ? (
                        <>
                          <Clock size={13} />
                          <span>{t.invoiceScheduledBadge}</span>
                        </>
                      ) : (
                        <>
                          <DollarSign size={13} />
                          <span>{t.payInvoiceBtn}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 3: Detailed Monthly Invoice Statement Panel */}
      {activeCard && (
        <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-5">
          {/* Statement Header with Month Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0"
                style={{ backgroundColor: activeCard.color || '#6366f1' }}
              >
                <CardBrandBadge brand={activeCard.brand} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <span>{t.statementForCardTitle(activeCard.name)}</span>
                  {activeCard.lastDigits && (
                    <span className="text-xs text-slate-400 font-mono">
                      (•••• {activeCard.lastDigits})
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-400">
                  {t.closingDueRuleSummary(activeCard.closingDay, activeCard.dueDay)}
                </p>
              </div>
            </div>

            {/* Month Switcher Controls */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <div className="flex items-center bg-slate-800/90 rounded-xl border border-slate-700/80 p-0.5">
                <button
                  type="button"
                  onClick={() => setStatementMonth((m) => shiftMonth(m, -1))}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
                  title={t.prevMonthBtn}
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-xs font-bold text-slate-200 px-3 min-w-[130px] text-center capitalize">
                  {formatMonthLabel(statementMonth, language)}
                </span>
                <button
                  type="button"
                  onClick={() => setStatementMonth((m) => shiftMonth(m, 1))}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
                  title={t.nextMonthBtn}
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              <button
                type="button"
                onClick={() => onOpenAddExpense(activeCard.id)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-bold border border-slate-700 transition-colors"
              >
                <Plus size={14} />
                <span>{t.addPurchaseBtn}</span>
              </button>
            </div>
          </div>

          {/* Statement Invoice Summary Banner */}
          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 block">
                {t.totalInvoiceForMonth(formatMonthLabel(statementMonth, language))}
              </span>
              <p className="text-2xl font-black text-slate-100 mt-1">
                {formatCurrency(statementData.total, currency)}
              </p>
              <span className="text-xs text-slate-400">
                {statementData.txs.length} {t.purchasesCountLabel(statementData.txs.length)}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {statementData.isSettled ? (
                <span className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-1.5">
                  <CheckCircle2 size={15} />
                  <span>{t.invoiceSettledBadge}</span>
                </span>
              ) : statementData.isPendingPayment ? (
                <span className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold flex items-center gap-1.5">
                  <Clock size={15} />
                  <span>{t.invoiceScheduledInBankBadge}</span>
                </span>
              ) : statementData.total > 0 ? (
                <button
                  type="button"
                  onClick={() =>
                    setPayingInvoiceCycle({
                      cardId: activeCard.id,
                      invoiceMonth: statementMonth,
                    })
                  }
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all hover:scale-[1.02]"
                >
                  <DollarSign size={15} />
                  <span>{t.payThisInvoiceBtn}</span>
                </button>
              ) : (
                <span className="text-xs text-slate-400 font-medium">
                  {t.noInvoiceAmountToPay}
                </span>
              )}
            </div>
          </div>

          {/* Statement Purchases List */}
          {statementData.txs.length === 0 ? (
            <div className="p-8 rounded-xl bg-slate-800/20 border border-slate-800 text-center space-y-2">
              <p className="text-sm font-semibold text-slate-400">
                {t.noPurchasesInInvoice}
              </p>
              <button
                type="button"
                onClick={() => onOpenAddExpense(activeCard.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-semibold border border-indigo-500/30 transition-colors"
              >
                <Plus size={13} />
                <span>{t.addPurchaseBtn}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {statementData.txs.map((tx) => {
                const cat = categories.find((c) => c.id === tx.categoryId);
                const hasInstallment =
                  tx.installmentTotal && tx.installmentTotal > 1;

                return (
                  <div
                    key={tx.id}
                    className="p-3.5 rounded-xl bg-slate-800/40 hover:bg-slate-800/70 border border-slate-700/40 transition-colors flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <CategoryIcon
                        icon={cat?.icon}
                        color={cat?.color || '#94a3b8'}
                        size={17}
                        badgeSize="md"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-slate-200 truncate">
                            {tx.description}
                          </p>
                          {hasInstallment && (
                            <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold">
                              {t.installmentTag(
                                tx.installmentCurrent || 1,
                                tx.installmentTotal || 1
                              )}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                          <span>{tx.purchaseDate || tx.date}</span>
                          {cat && (
                            <>
                              <span>•</span>
                              <span>{getCategoryDisplayName(cat, language)}</span>
                            </>
                          )}
                          {tx.notes && (
                            <>
                              <span>•</span>
                              <span className="italic truncate max-w-[180px]">{tx.notes}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <p className="text-sm font-extrabold text-rose-400">
                        -{formatCurrency(tx.amount, currency)}
                      </p>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onEditTransaction(tx)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
                          title={t.editEntryTitle}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteTransaction(tx)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-700 transition-colors"
                          title={t.deleteEntryTitle}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL: Register / Edit Credit Card */}
      {cardModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <CreditCardIcon size={18} className="text-indigo-400" />
                <span>{editingCard ? t.editCardModalTitle : t.addCardModalTitle}</span>
              </h3>
              <button
                type="button"
                onClick={() => setCardModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCardSubmit} className="p-5 space-y-4">
              {/* Card Name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  {t.cardNameLabel}
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Nubank Felipe, Inter Isabelle"
                  value={cardFormName}
                  onChange={(e) => setCardFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Total Limit */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  {t.totalLimitLabel} ({currency})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="5000.00"
                  value={cardFormLimit}
                  onChange={(e) => setCardFormLimit(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-sm font-bold text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Closing Day & Due Day */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    {t.closingDayLabel} (1-31)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={cardFormClosingDay}
                    onChange={(e) => setCardFormClosingDay(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-sm font-bold text-slate-100 text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    {t.closingDayHint}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    {t.dueDayLabel} (1-31)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={cardFormDueDay}
                    onChange={(e) => setCardFormDueDay(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-sm font-bold text-slate-100 text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    {t.dueDayHint}
                  </span>
                </div>
              </div>

              {/* Card Brand */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  {t.cardBrandLabel}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {BRAND_OPTIONS.map((brand) => (
                    <button
                      key={brand.id}
                      type="button"
                      onClick={() => setCardFormBrand(brand.id)}
                      className={`p-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                        cardFormBrand === brand.id
                          ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                          : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <CardBrandBadge brand={brand.id} />
                      <span className="truncate">{brand.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Color & Last 4 Digits */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    {t.cardColorLabel}
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {PRESET_COLORS.map((col) => (
                      <button
                        key={col}
                        type="button"
                        onClick={() => setCardFormColor(col)}
                        className={`w-6 h-6 rounded-full transition-transform ${
                          cardFormColor === col
                            ? 'ring-2 ring-white scale-110 shadow-sm'
                            : 'opacity-70 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: col }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    {t.cardLastDigitsLabel}
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    placeholder="1234"
                    value={cardFormLastDigits}
                    onChange={(e) => setCardFormLastDigits(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-sm font-mono text-slate-100 text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setCardModalOpen(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-700 text-slate-300 text-xs font-bold hover:bg-slate-800 transition-colors"
                >
                  {t.cancelBtn}
                </button>
                <button
                  type="submit"
                  disabled={cardFormSubmitting}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all"
                >
                  {cardFormSubmitting ? t.savingBtn : t.saveCardBtn}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Delete Card Confirmation */}
      {deleteConfirmCardId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400">
                <AlertCircle size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">
                  {t.deleteCardModalTitle}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {t.deleteCardModalDesc}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmCardId(null)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-700 text-slate-300 text-xs font-bold hover:bg-slate-800 transition-colors"
              >
                {t.cancelBtn}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = deleteConfirmCardId;
                  setDeleteConfirmCardId(null);
                  await onDeleteCard(id);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition-all"
              >
                {t.confirmDeleteCardBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Pay Invoice Confirmation */}
      {payingInvoiceCycle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-500/15 text-indigo-400">
                <DollarSign size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">
                  {t.payInvoiceConfirmTitle}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {t.payInvoiceConfirmDesc(
                    creditCards.find((c) => c.id === payingInvoiceCycle.cardId)?.name || '',
                    formatMonthLabel(payingInvoiceCycle.invoiceMonth, language)
                  )}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-500/20 text-xs text-indigo-300 space-y-1">
              <p className="font-semibold">{t.payInvoiceHowItWorksTitle}</p>
              <p className="text-[11px] text-indigo-200/80 leading-relaxed">
                {t.payInvoiceHowItWorksDesc}
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPayingInvoiceCycle(null)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-700 text-slate-300 text-xs font-bold hover:bg-slate-800 transition-colors"
              >
                {t.cancelBtn}
              </button>
              <button
                type="button"
                disabled={payingSubmitting}
                onClick={handleConfirmPayInvoice}
                className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all"
              >
                {payingSubmitting ? t.generatingInvoicePayment : t.confirmPayInvoiceBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
