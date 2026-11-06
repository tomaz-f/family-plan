import React from 'react';
import { AlertCircle, ChevronDown, Clock, Tag } from 'lucide-react';
import { AppLanguage, Category, CreditCard, Transaction } from '../../types';
import { getCategoryDisplayName } from '../../utils/i18n';
import { CategoryIcon } from '../CategoryIcon';
import { BankIcon } from '../icons';

interface CardAndCategorySectionProps {
  isOled: boolean;
  creditCards: CreditCard[];
  selectedCard: CreditCard | null;
  onSelectCard: (cardId: string) => void;
  cardCycleInfo: {
    invoiceMonth: string;
    rolledToNext: boolean;
    formattedMonth: string;
  } | null;
  isInstallment: boolean;
  currency: string;
  editingTransaction?: Transaction | null;
  amount: string;
  onChangeAmount: (value: string) => void;
  language: AppLanguage;
  selectedCategory: Category | null;
  onOpenCategoryPicker: () => void;
  onManageCategories?: () => void;
  description: string;
  onChangeDescription: (value: string) => void;
  date: string;
  onChangeDate: (value: string) => void;
}

export const CardAndCategorySection: React.FC<CardAndCategorySectionProps> = ({
  isOled,
  creditCards,
  selectedCard,
  onSelectCard,
  cardCycleInfo,
  isInstallment,
  currency,
  editingTransaction,
  amount,
  onChangeAmount,
  language,
  selectedCategory,
  onOpenCategoryPicker,
  onManageCategories,
  description,
  onChangeDescription,
  date,
  onChangeDate,
}) => {
  return (
    <>
      {/* 1. Credit Card Selector */}
      <div>
        <label
          className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${
            isOled ? 'text-[#94A3B8]' : 'text-slate-600'
          }`}
        >
          Cartão
        </label>

        {creditCards.length === 0 ? (
          <div
            className={`p-3 rounded-xl border flex items-center gap-2 text-xs ${
              isOled
                ? 'bg-[#161B22] border-[#21262D] text-amber-400'
                : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}
          >
            <AlertCircle size={15} />
            <span>Nenhum cartão cadastrado. Cadastre um cartão na aba Cartões.</span>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Cards Pill Row */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              {creditCards.map((card) => {
                const isSelected = card.id === selectedCard?.id;
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => onSelectCard(card.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border shrink-0 transition-all active:scale-95 ${
                      isSelected
                        ? isOled
                          ? 'bg-[#161B22] border-[#6E5440] text-[#F8FAFC] ring-1 ring-[#6E5440]'
                          : 'bg-[#6E5440]/10 border-[#6E5440] text-[#6E5440] ring-1 ring-[#6E5440]'
                        : isOled
                        ? 'bg-[#0D1117] border-[#21262D] text-[#94A3B8] hover:border-[#30363D]'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <BankIcon card={card} size={15} />
                    <span className="truncate max-w-[120px]">{card.name}</span>
                    {card.lastDigits && (
                      <span
                        className={`text-[10px] font-mono px-1 py-0.5 rounded ${
                          isOled ? 'bg-[#0D1117] text-[#94A3B8]' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        •••• {card.lastDigits}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Calculated Invoice Cycle Info Badge */}
            {selectedCard && cardCycleInfo && (
              <div
                className={`flex items-center justify-between p-2.5 rounded-xl border text-xs ${
                  isOled
                    ? 'bg-[#161B22]/70 border-[#21262D] text-[#D0B595]'
                    : 'bg-amber-500/10 border-amber-500/20 text-[#6E5440]'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0 truncate">
                  <Clock size={13} className="shrink-0" />
                  <span className="truncate">
                    Fatura: <strong>{cardCycleInfo.formattedMonth}</strong> • Vence dia{' '}
                    <strong>{selectedCard.dueDay}</strong>
                  </span>
                </div>
                {cardCycleInfo.rolledToNext && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 border ${
                      isOled
                        ? 'bg-[#0D1117] border-[#21262D] text-amber-300'
                        : 'bg-white border-amber-200 text-amber-700'
                    }`}
                  >
                    Após Fechamento
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Valor Total da Compra */}
      <div>
        <label
          className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${
            isOled ? 'text-[#94A3B8]' : 'text-slate-600'
          }`}
        >
          {isInstallment ? 'Valor Total da Compra' : 'Valor da Compra'}
        </label>

        <div
          className={`flex items-center px-4 py-2.5 rounded-2xl border transition-all ${
            isOled
              ? 'bg-[#161B22] border-[#21262D] focus-within:border-[#6E5440]'
              : 'bg-[#F1F5F9] border-slate-200 focus-within:border-[#6E5440]'
          }`}
        >
          <span className="text-xl font-black text-[#EF4444] shrink-0 mr-2 select-none">
            {currency}
          </span>
          <input
            type="text"
            inputMode="decimal"
            required
            autoFocus={!editingTransaction}
            placeholder="0,00"
            value={amount}
            onChange={(e) => onChangeAmount(e.target.value)}
            className={`w-full bg-transparent text-2xl sm:text-3xl font-black focus:outline-none tracking-tight ${
              isOled ? 'text-[#F8FAFC]' : 'text-slate-900'
            }`}
          />
        </div>
      </div>

      {/* 3. Category Picker (BottomSheet / Compact Popover Picker) */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label
            className={`block text-xs font-semibold uppercase tracking-wider ${
              isOled ? 'text-[#94A3B8]' : 'text-slate-600'
            }`}
          >
            {language === 'pt-BR' ? 'Categoria' : 'Category'}
          </label>
          <button
            type="button"
            onClick={onManageCategories}
            className="text-xs font-semibold text-[#6E5440] hover:text-[#7E624B] active:scale-95 transition-colors py-1 px-1.5 min-h-[36px] flex items-center gap-1"
          >
            <Tag size={13} />
            <span>{language === 'pt-BR' ? 'Gerenciar' : 'Manage'}</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onOpenCategoryPicker}
          className={`w-full h-11 px-3.5 rounded-xl border flex items-center justify-between transition-colors active:scale-[0.99] ${
            isOled
              ? 'bg-[#161B22] border-[#21262D] text-[#F8FAFC] hover:bg-[#21262D]/50'
              : 'bg-[#F1F5F9] border-slate-200 text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <CategoryIcon
              icon={selectedCategory?.icon || 'Tag'}
              color={selectedCategory?.color || '#94A3B8'}
              size={18}
              badgeSize="sm"
            />
            <span className="text-sm font-semibold truncate">
              {getCategoryDisplayName(selectedCategory, language) || 'Selecione uma categoria'}
            </span>
          </div>
          <ChevronDown
            size={16}
            className={`shrink-0 ${isOled ? 'text-[#94A3B8]' : 'text-slate-400'}`}
          />
        </button>
      </div>

      {/* 4. Descrição & Data (Balanced Side-by-Side Inputs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label
            className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${
              isOled ? 'text-[#94A3B8]' : 'text-slate-600'
            }`}
          >
            Descrição
          </label>
          <input
            type="text"
            placeholder="Ex: Mercado, Uber, Restaurante..."
            value={description}
            onChange={(e) => onChangeDescription(e.target.value)}
            className={`w-full h-11 px-3.5 rounded-xl border text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[#6E5440] ${
              isOled
                ? 'bg-[#161B22] border-[#21262D] text-[#F8FAFC]'
                : 'bg-[#F1F5F9] border-slate-200 text-slate-900'
            }`}
          />
        </div>

        <div>
          <label
            className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${
              isOled ? 'text-[#94A3B8]' : 'text-slate-600'
            }`}
          >
            Data da Compra
          </label>
          <div className="relative">
            <input
              type="date"
              required
              value={date}
              onChange={(e) => onChangeDate(e.target.value)}
              className={`w-full h-11 px-3 rounded-xl border text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[#6E5440] ${
                isOled
                  ? 'bg-[#161B22] border-[#21262D] text-[#F8FAFC]'
                  : 'bg-[#F1F5F9] border-slate-200 text-slate-900'
              }`}
            />
          </div>
        </div>
      </div>
    </>
  );
};
