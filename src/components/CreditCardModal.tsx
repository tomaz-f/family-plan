import React, { useState, useEffect, useRef } from 'react';
import { CreditCard as CreditCardIcon, X } from 'lucide-react';
import { AppLanguage, AppTheme, CreditCard, CreditCardBrand } from '../types';
import { TRANSLATIONS } from '../utils/i18n';

export const BRAND_OPTIONS: { id: CreditCardBrand; name: string }[] = [
  { id: 'mastercard', name: 'Mastercard' },
  { id: 'visa', name: 'Visa' },
  { id: 'elo', name: 'Elo' },
  { id: 'amex', name: 'Amex' },
  { id: 'nubank', name: 'Nubank' },
  { id: 'inter', name: 'Inter' },
  { id: 'itau', name: 'Itaú' },
  { id: 'bradesco', name: 'Bradesco' },
  { id: 'santander', name: 'Santander' },
  { id: 'c6', name: 'C6 Bank' },
  { id: 'other', name: 'Outro' },
];

export const PRESET_COLORS = [
  '#6E5440', // Brand rustic oxidized iron
  '#8A2BE2', // Nubank purple
  '#FF6F00', // Inter orange
  '#EC7000', // Itaú orange
  '#CC092F', // Bradesco red
  '#E60000', // Santander red
  '#161616', // C6 black
  '#00579E', // Caixa blue
  '#0A2F64', // BB blue
  '#0D9488', // Teal
];

export interface CreditCardModalProps {
  isOpen: boolean;
  editingCard?: CreditCard | null;
  existingCardsCount?: number;
  currency: string;
  language: AppLanguage;
  theme: AppTheme;
  onClose: () => void;
  onSaveCard: (card: Partial<CreditCard> & { name: string; totalLimit: number; closingDay: number; dueDay: number }) => Promise<void>;
}

export const CreditCardModal: React.FC<CreditCardModalProps> = ({
  isOpen,
  editingCard,
  existingCardsCount = 0,
  currency,
  language,
  theme,
  onClose,
  onSaveCard,
}) => {
  const t = TRANSLATIONS[language];
  const isOled = theme === 'oled';

  const [cardFormName, setCardFormName] = useState<string>('');
  const [cardFormLimit, setCardFormLimit] = useState<string>('5000');
  const [cardFormClosingDay, setCardFormClosingDay] = useState<string>('25');
  const [cardFormDueDay, setCardFormDueDay] = useState<string>('5');
  const [cardFormBrand, setCardFormBrand] = useState<CreditCardBrand>('mastercard');
  const [cardFormColor, setCardFormColor] = useState<string>(PRESET_COLORS[0]);
  const [cardFormLastDigits, setCardFormLastDigits] = useState<string>('');
  const [cardFormSubmitting, setCardFormSubmitting] = useState<boolean>(false);

  const prevIsOpenRef = useRef<boolean>(false);
  const prevEditingIdRef = useRef<string | null | undefined>(undefined);
  const mouseDownTargetRef = useRef<EventTarget | null>(null);

  useEffect(() => {
    if (!isOpen) {
      prevIsOpenRef.current = false;
      return;
    }

    const currentEditingId = editingCard?.id || null;
    const isOpening = !prevIsOpenRef.current;
    const isTargetChanged = prevEditingIdRef.current !== currentEditingId;

    if (!isOpening && !isTargetChanged) {
      // Modal is already open and target hasn't changed; strictly preserve active user input
      return;
    }

    prevIsOpenRef.current = true;
    prevEditingIdRef.current = currentEditingId;

    if (editingCard) {
      setCardFormName(editingCard.name);
      setCardFormLimit(String(editingCard.totalLimit));
      setCardFormClosingDay(String(editingCard.closingDay));
      setCardFormDueDay(String(editingCard.dueDay));
      setCardFormBrand(editingCard.brand || 'mastercard');
      setCardFormColor(editingCard.color || PRESET_COLORS[0]);
      setCardFormLastDigits(editingCard.lastDigits || '');
    } else {
      setCardFormName('');
      setCardFormLimit('5000');
      setCardFormClosingDay('25');
      setCardFormDueDay('5');
      setCardFormBrand('mastercard');
      setCardFormColor(PRESET_COLORS[existingCardsCount % PRESET_COLORS.length]);
      setCardFormLastDigits('');
    }
  }, [isOpen, editingCard, existingCardsCount]);

  if (!isOpen) return null;

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
      onClose();
    } finally {
      setCardFormSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-fadeIn"
      onMouseDown={(e) => {
        mouseDownTargetRef.current = e.target;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && mouseDownTargetRef.current === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={`border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col ${
          isOled ? 'bg-[#0D1117] border-[#21262D] text-[#F8FAFC]' : 'bg-white border-slate-200 text-slate-900'
        }`}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between px-5 py-4 border-b ${
          isOled ? 'border-[#21262D]' : 'border-slate-200'
        }`}>
          <h3 className={`text-base font-bold flex items-center gap-2 ${
            isOled ? 'text-[#F8FAFC]' : 'text-slate-900'
          }`}>
            <CreditCardIcon size={18} className="text-[#D0B595]" />
            <span>{editingCard ? t.editCardModalTitle || 'Editar Cartão' : t.addCardModalTitle || 'Novo Cartão'}</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${
              isOled ? 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#161B22]' : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSaveCardSubmit} className="p-5 space-y-4">
          {/* Card Name */}
          <div>
            <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${
              isOled ? 'text-[#94A3B8]' : 'text-slate-600'
            }`}>
              {t.cardNameLabel || 'Nome do Cartão'}
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Nubank Felipe, Inter Isabelle"
              value={cardFormName}
              onChange={(e) => setCardFormName(e.target.value)}
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-1 focus:ring-[#6E5440] ${
                isOled ? 'bg-[#161B22] border-[#21262D] text-[#F8FAFC]' : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white'
              }`}
            />
          </div>

          {/* Total Limit */}
          <div>
            <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${
              isOled ? 'text-[#94A3B8]' : 'text-slate-600'
            }`}>
              {t.totalLimitLabel || 'Limite Total'} ({currency})
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="5000.00"
              value={cardFormLimit}
              onChange={(e) => setCardFormLimit(e.target.value)}
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-bold focus:outline-none focus:ring-1 focus:ring-[#6E5440] ${
                isOled ? 'bg-[#161B22] border-[#21262D] text-[#F8FAFC]' : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white'
              }`}
            />
          </div>

          {/* Closing Day & Due Day */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${
                isOled ? 'text-[#94A3B8]' : 'text-slate-600'
              }`}>
                {t.closingDayLabel || 'Dia Fechamento'} (1-31)
              </label>
              <input
                type="number"
                min="1"
                max="31"
                required
                value={cardFormClosingDay}
                onChange={(e) => setCardFormClosingDay(e.target.value)}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-bold text-center focus:outline-none focus:ring-1 focus:ring-[#6E5440] ${
                  isOled ? 'bg-[#161B22] border-[#21262D] text-[#F8FAFC]' : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white'
                }`}
              />
              <span className={`text-[10px] mt-1 block ${
                isOled ? 'text-[#94A3B8]' : 'text-slate-500'
              }`}>
                {t.closingDayHint || 'Compras a partir deste dia vão para o mês seguinte'}
              </span>
            </div>

            <div>
              <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${
                isOled ? 'text-[#94A3B8]' : 'text-slate-600'
              }`}>
                {t.dueDayLabel || 'Dia Vencimento'} (1-31)
              </label>
              <input
                type="number"
                min="1"
                max="31"
                required
                value={cardFormDueDay}
                onChange={(e) => setCardFormDueDay(e.target.value)}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-bold text-center focus:outline-none focus:ring-1 focus:ring-[#6E5440] ${
                  isOled ? 'bg-[#161B22] border-[#21262D] text-[#F8FAFC]' : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white'
                }`}
              />
              <span className={`text-[10px] mt-1 block ${
                isOled ? 'text-[#94A3B8]' : 'text-slate-500'
              }`}>
                {t.dueDayHint || 'Data do vencimento da fatura bancária'}
              </span>
            </div>
          </div>

          {/* Brand & Last Digits */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${
                isOled ? 'text-[#94A3B8]' : 'text-slate-600'
              }`}>
                {t.cardBrandLabel || 'Bandeira / Banco'}
              </label>
              <select
                value={cardFormBrand}
                onChange={(e) => setCardFormBrand(e.target.value as CreditCardBrand)}
                className={`w-full px-3 py-2.5 rounded-xl border text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#6E5440] ${
                  isOled ? 'bg-[#161B22] border-[#21262D] text-[#F8FAFC]' : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white'
                }`}
              >
                {BRAND_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${
                isOled ? 'text-[#94A3B8]' : 'text-slate-600'
              }`}>
                {t.cardLastDigitsLabel || 'Últimos 4 Dígitos'}
              </label>
              <input
                type="text"
                maxLength={4}
                placeholder="Ex: 1234"
                value={cardFormLastDigits}
                onChange={(e) => setCardFormLastDigits(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono text-center focus:outline-none focus:ring-1 focus:ring-[#6E5440] ${
                  isOled ? 'bg-[#161B22] border-[#21262D] text-[#F8FAFC]' : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white'
                }`}
              />
            </div>
          </div>

          {/* Color Picker */}
          <div>
            <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${
              isOled ? 'text-[#94A3B8]' : 'text-slate-600'
            }`}>
              {t.cardColorLabel || 'Cor do Cartão'}
            </label>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCardFormColor(c)}
                  className={`w-7 h-7 rounded-full shrink-0 transition-transform active:scale-90 ${
                    cardFormColor === c ? 'ring-2 ring-offset-2 ring-[#6E5440] scale-110' : 'opacity-80 hover:opacity-100'
                  }`}
                  style={{
                    backgroundColor: c,
                    outlineColor: isOled ? '#0D1117' : '#FFFFFF',
                  }}
                  title={c}
                />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                isOled
                  ? 'bg-[#161B22] hover:bg-[#21262D] text-[#94A3B8]'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {t.cancelBtn || 'Cancelar'}
            </button>
            <button
              type="submit"
              disabled={cardFormSubmitting || !cardFormName.trim()}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-[#6E5440] hover:bg-[#7E624B] text-white shadow-xs transition-all active:scale-95 disabled:opacity-50"
            >
              {cardFormSubmitting ? (t.savingBtn || 'Salvando...') : (t.saveCardBtn || 'Salvar Cartão')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
