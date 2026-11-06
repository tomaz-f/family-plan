import React from 'react';
import { CreditCardBrand } from '../../types';
import { BankIcon } from '../icons';
import { BRAND_OPTIONS, PRESET_COLORS } from './cardModalPresets';

interface CardAppearanceFieldsProps {
  isOled: boolean;
  cardBrandLabel: string;
  cardLastDigitsLabel: string;
  cardColorLabel: string;
  cardFormBrand: CreditCardBrand;
  onChangeBrand: (brand: CreditCardBrand) => void;
  cardFormLastDigits: string;
  onChangeLastDigits: (digits: string) => void;
  cardFormColor: string;
  onChangeColor: (color: string) => void;
}

export const CardAppearanceFields: React.FC<CardAppearanceFieldsProps> = ({
  isOled,
  cardBrandLabel,
  cardLastDigitsLabel,
  cardColorLabel,
  cardFormBrand,
  onChangeBrand,
  cardFormLastDigits,
  onChangeLastDigits,
  cardFormColor,
  onChangeColor,
}) => {
  return (
    <>
      {/* Brand & Last Digits */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${
              isOled ? 'text-[#94A3B8]' : 'text-slate-600'
            }`}
          >
            {cardBrandLabel}
          </label>
          <div className="flex items-center gap-2">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                isOled ? 'bg-[#161B22] border-[#21262D]' : 'bg-slate-50 border-slate-200'
              }`}
              style={{
                backgroundColor: `${cardFormColor}18`,
                color: cardFormColor,
              }}
            >
              <BankIcon brand={cardFormBrand} size={18} color={cardFormColor} />
            </div>
            <select
              value={cardFormBrand}
              onChange={(e) => onChangeBrand(e.target.value as CreditCardBrand)}
              className={`flex-1 px-3 py-2.5 rounded-xl border text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#6E5440] ${
                isOled
                  ? 'bg-[#161B22] border-[#21262D] text-[#F8FAFC]'
                  : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white'
              }`}
            >
              {BRAND_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label
            className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${
              isOled ? 'text-[#94A3B8]' : 'text-slate-600'
            }`}
          >
            {cardLastDigitsLabel}
          </label>
          <input
            type="text"
            maxLength={4}
            placeholder="Ex: 1234"
            value={cardFormLastDigits}
            onChange={(e) => onChangeLastDigits(e.target.value.replace(/\D/g, '').slice(0, 4))}
            className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono text-center focus:outline-none focus:ring-1 focus:ring-[#6E5440] ${
              isOled
                ? 'bg-[#161B22] border-[#21262D] text-[#F8FAFC]'
                : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white'
            }`}
          />
        </div>
      </div>

      {/* Color Picker */}
      <div>
        <label
          className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${
            isOled ? 'text-[#94A3B8]' : 'text-slate-600'
          }`}
        >
          {cardColorLabel}
        </label>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChangeColor(c)}
              className={`w-7 h-7 rounded-full shrink-0 transition-transform active:scale-90 ${
                cardFormColor === c
                  ? 'ring-2 ring-offset-2 ring-[#6E5440] scale-110'
                  : 'opacity-80 hover:opacity-100'
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
    </>
  );
};
