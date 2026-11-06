import React from 'react';
import { CreditCard, CreditCardBrand } from '../../types';
import { AppIcon } from './AppIcon';
import { EdusitesIconName } from './edusitesSvgs';
import { BankMetadata, KNOWN_BANKS } from './bank/bankSvgCatalog';

export { type BankMetadata, KNOWN_BANKS };

export interface ResolvedBank {
  id: string;
  name: string;
  iconName: EdusitesIconName;
  primaryColor: string;
}

export function resolveBankInfo(
  cardOrNameOrBrand?: CreditCard | string | null
): ResolvedBank {
  if (!cardOrNameOrBrand) {
    return {
      id: 'cartao',
      name: 'Cartão',
      iconName: 'cartao',
      primaryColor: '#6E5440',
    };
  }

  // If a CreditCard object was passed
  if (typeof cardOrNameOrBrand === 'object') {
    const card = cardOrNameOrBrand;

    // 1. Inspect the card's NAME first for an authentic bank match!
    // E.g. name = "Nu", "Nu Felipe", "Shopee", "Bradesco", etc.
    if (card.name) {
      const resolvedFromName = resolveBankInfo(card.name);
      if (resolvedFromName.id !== 'cartao') {
        return {
          ...resolvedFromName,
          primaryColor: card.color || resolvedFromName.primaryColor,
        };
      }
    }

    // 2. Next check if brand explicitly matches a known bank or network
    if (card.brand) {
      const matchByBrand = KNOWN_BANKS.find(
        (b) => b.id === card.brand || b.iconName === card.brand
      );
      if (matchByBrand) {
        return {
          id: matchByBrand.id,
          name: matchByBrand.name,
          iconName: matchByBrand.iconName,
          primaryColor: card.color || matchByBrand.primaryColor,
        };
      }
    }

    return {
      id: 'cartao',
      name: card.name || 'Cartão',
      iconName: 'cartao',
      primaryColor: card.color || '#6E5440',
    };
  }

  // String lookup (name, description, or brand string)
  const rawInput = String(cardOrNameOrBrand).trim();
  const input = rawInput.toLowerCase();

  // Strip prefixes like "fatura", "cartão", "cartao"
  const cleanInput = input
    .replace(/^fatura\s+(?:do\s+|de\s+)?/i, '')
    .replace(/^cart[aã]o\s+(?:de\s+cr[eé]dito\s+)?/i, '')
    .trim();

  // 1. Direct ID / iconName match
  const directMatch = KNOWN_BANKS.find(
    (b) => b.id === input || b.id === cleanInput || b.iconName === input || b.iconName === cleanInput
  );
  if (directMatch) {
    return {
      id: directMatch.id,
      name: directMatch.name,
      iconName: directMatch.iconName,
      primaryColor: directMatch.primaryColor,
    };
  }

  // 2. Keyword matching with word boundary regex
  for (const bank of KNOWN_BANKS) {
    for (const kw of bank.keywords) {
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');
      if (regex.test(input) || regex.test(cleanInput)) {
        return {
          id: bank.id,
          name: bank.name,
          iconName: bank.iconName,
          primaryColor: bank.primaryColor,
        };
      }
    }
  }

  // Fallback generic card
  return {
    id: 'cartao',
    name: rawInput || 'Cartão',
    iconName: 'cartao',
    primaryColor: '#6E5440',
  };
}

export interface BankIconProps {
  card?: CreditCard | null;
  name?: string;
  brand?: CreditCardBrand | string;
  size?: number;
  color?: string;
  className?: string;
  badgeSize?: 'sm' | 'md' | 'lg';
  withBadge?: boolean;
}

export const BankIcon: React.FC<BankIconProps> = ({
  card,
  name,
  brand,
  size = 18,
  color,
  className = '',
  badgeSize,
  withBadge = false,
}) => {
  const resolved = resolveBankInfo(card || name || brand);
  const activeColor = color || (card?.color ? card.color : resolved.primaryColor);

  if (!badgeSize && !withBadge) {
    return (
      <AppIcon
        name={resolved.iconName}
        size={size}
        color={color !== undefined ? color : className.includes('text-white') ? '#FFFFFF' : activeColor}
        className={className}
      />
    );
  }

  const sizeClasses =
    badgeSize === 'sm'
      ? 'w-8 h-8 rounded-lg'
      : badgeSize === 'lg'
      ? 'w-11 h-11 rounded-xl'
      : 'w-9 h-9 rounded-xl';

  return (
    <div
      className={`inline-flex items-center justify-center shrink-0 ${sizeClasses} ${className}`}
      style={{
        backgroundColor: `${activeColor}18`,
        color: activeColor,
      }}
    >
      <AppIcon name={resolved.iconName} size={size} color={activeColor} />
    </div>
  );
};

export default BankIcon;
