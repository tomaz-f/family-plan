import React from 'react';
import { Check, ChevronDown, Landmark, Sparkles } from 'lucide-react';
import { AppLanguage, CreditCard } from '../../types';
import { AppIcon, resolveBankInfo } from '../icons';
import { formatCurrency } from '../../utils/format';
import { TRANSLATIONS } from '../../utils/i18n';
import { CardCycleInfo } from './transactionModalMath';

export interface AccountCardDropdownProps {
  isOled: boolean;
  language: AppLanguage;
  currency: string;
  selectedCard: CreditCard | null;
  selectedCardId: string | null;
  creditCards: CreditCard[];
  cardAvailableLimits: Record<string, number>;
  cardCycleInfo: CardCycleInfo | null;
  isAccountDropdownOpen: boolean;
  setIsAccountDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onSelectCard: (cardId: string | null) => void;
  t: (typeof TRANSLATIONS)[AppLanguage];
}

export const AccountCardDropdown: React.FC<AccountCardDropdownProps> = ({
  isOled,
  language,
  currency,
  selectedCard,
  selectedCardId,
  creditCards,
  cardAvailableLimits,
  cardCycleInfo,
  isAccountDropdownOpen,
  setIsAccountDropdownOpen,
  onSelectCard,
  t,
}) => {
  return (
    <div
      className={`px-3.5 py-3 border-b space-y-2 ${
        isOled ? 'border-[#21262D]/60' : 'border-slate-200/60'
      }`}
    >
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {language === 'pt-BR' ? 'Conta / Cartão' : 'Account / Card'}
      </label>

      {/* Trigger Row */}
      <button
        type="button"
        onClick={() => setIsAccountDropdownOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between p-3 rounded-xl border transition-colors cursor-pointer text-left ${
          isOled
            ? 'border-[#21262D] bg-[#161B22]/50 hover:bg-[#21262D]'
            : 'border-slate-200/80 bg-slate-50/50 hover:bg-slate-100'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          {!selectedCard ? (
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-[#6E5440]/20 text-[#D0B595] border border-[#D0B595]/30">
              <Landmark size={18} />
            </div>
          ) : (
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-white shadow-xs"
              style={{
                backgroundColor:
                  selectedCard.color && selectedCard.color !== '#6E5440'
                    ? selectedCard.color
                    : resolveBankInfo(selectedCard).primaryColor ||
                      selectedCard.color ||
                      '#6E5440',
              }}
            >
              <AppIcon
                name={resolveBankInfo(selectedCard).iconName}
                size={18}
                color="#FFFFFF"
              />
            </div>
          )}

          <div className="min-w-0">
            <h4
              className={`text-xs sm:text-sm font-semibold truncate ${
                isOled ? 'text-slate-100' : 'text-slate-800'
              }`}
            >
              {!selectedCard
                ? language === 'pt-BR'
                  ? 'Conta Principal / Pix'
                  : 'Main Account / Cash'
                : selectedCard.name}
            </h4>
            <div className="flex items-center gap-2 mt-0.5">
              {!selectedCard ? (
                <span className="text-[11px] text-slate-400">
                  {language === 'pt-BR'
                    ? 'Saldo em conta corrente'
                    : 'Checking account balance'}
                </span>
              ) : (
                <>
                  <span className="text-[11px] font-mono text-slate-400">
                    •••• {selectedCard.lastDigits || '••••'}
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                    {formatCurrency(
                      cardAvailableLimits[selectedCard.id] ?? selectedCard.totalLimit,
                      currency
                    )}{' '}
                    disp.
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <ChevronDown
          size={16}
          className={`text-slate-400 transition-transform duration-200 shrink-0 ml-2 ${
            isAccountDropdownOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Options List */}
      {isAccountDropdownOpen && (
        <div
          className={`mt-1.5 rounded-xl border overflow-hidden divide-y animate-fadeIn ${
            isOled
              ? 'bg-[#0D1117] border-[#21262D] divide-[#21262D]/60'
              : 'bg-white border-slate-200 divide-slate-100'
          }`}
        >
          {/* Checking / Pix Option */}
          <button
            type="button"
            onClick={() => {
              onSelectCard(null);
              setIsAccountDropdownOpen(false);
            }}
            className={`w-full min-h-[48px] p-3 flex items-center justify-between transition-colors text-left ${
              !selectedCardId
                ? isOled
                  ? 'bg-[#161B22]/70'
                  : 'bg-slate-50'
                : isOled
                ? 'hover:bg-[#161B22]/40'
                : 'hover:bg-slate-50/70'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-[#6E5440]/20 text-[#D0B595] border border-[#D0B595]/30">
                <Landmark size={18} />
              </div>
              <div className="min-w-0">
                <h5
                  className={`text-xs sm:text-sm font-semibold truncate ${
                    isOled ? 'text-slate-100' : 'text-slate-800'
                  }`}
                >
                  {language === 'pt-BR' ? 'Conta Principal / Pix' : 'Main Account / Cash'}
                </h5>
                <span className="text-[11px] text-slate-400 block">
                  {language === 'pt-BR'
                    ? 'Saldo em conta corrente'
                    : 'Checking account balance'}
                </span>
              </div>
            </div>
            {!selectedCardId && (
              <Check size={16} className="text-[#10B981] shrink-0 ml-2" />
            )}
          </button>

          {/* Credit Card Options */}
          {creditCards.map((card) => {
            const isSelected = selectedCardId === card.id;
            const bankInfo = resolveBankInfo(card);
            const brandBgColor =
              card.color && card.color !== '#6E5440'
                ? card.color
                : bankInfo.primaryColor || card.color || '#6E5440';
            const cardAvail = cardAvailableLimits[card.id] ?? card.totalLimit;

            return (
              <button
                key={card.id}
                type="button"
                onClick={() => {
                  onSelectCard(card.id);
                  setIsAccountDropdownOpen(false);
                }}
                className={`w-full min-h-[48px] p-3 flex items-center justify-between transition-colors text-left ${
                  isSelected
                    ? isOled
                      ? 'bg-[#161B22]/70'
                      : 'bg-slate-50'
                    : isOled
                    ? 'hover:bg-[#161B22]/40'
                    : 'hover:bg-slate-50/70'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-white shadow-xs"
                    style={{ backgroundColor: brandBgColor }}
                  >
                    <AppIcon name={bankInfo.iconName} size={18} color="#FFFFFF" />
                  </div>
                  <div className="min-w-0">
                    <h5
                      className={`text-xs sm:text-sm font-semibold truncate ${
                        isOled ? 'text-slate-100' : 'text-slate-800'
                      }`}
                    >
                      {card.name}
                    </h5>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] font-mono text-slate-400">
                        •••• {card.lastDigits || '••••'}
                      </span>
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                        {formatCurrency(cardAvail, currency)} disp.
                      </span>
                    </div>
                  </div>
                </div>
                {isSelected && (
                  <Check size={16} className="text-[#10B981] shrink-0 ml-2" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Compact Smart Cycle Pill when Card is Selected */}
      {selectedCard && cardCycleInfo && (
        <div
          className={`px-2.5 py-1 rounded-lg border flex items-center justify-between gap-2 text-[10px] ${
            isOled ? 'bg-[#0D1117] border-[#21262D]' : 'bg-slate-100 border-slate-200'
          }`}
        >
          <span className="flex items-center gap-1 text-slate-400 font-medium truncate">
            <Sparkles size={11} className="text-[#D0B595] shrink-0" />
            <span>
              {t.invoiceCycleLabel}:{' '}
              <strong className={isOled ? 'text-white' : 'text-slate-900'}>
                {cardCycleInfo.formattedMonth}
              </strong>
            </span>
          </span>
          <span className="text-slate-400 font-semibold shrink-0">
            {t.dueDayShort}: {selectedCard.dueDay}
          </span>
        </div>
      )}
    </div>
  );
};
