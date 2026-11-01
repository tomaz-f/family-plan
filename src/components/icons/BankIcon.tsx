import React from 'react';
import { CreditCard, CreditCardBrand } from '../../types';
import { AppIcon } from './AppIcon';
import { EdusitesIconName } from './edusitesSvgs';

export interface BankMetadata {
  id: string;
  name: string;
  iconName: EdusitesIconName;
  primaryColor: string;
  keywords: string[];
}

export const KNOWN_BANKS: BankMetadata[] = [
  {
    id: 'nubank',
    name: 'Nubank',
    iconName: 'nubank',
    primaryColor: '#820AD1',
    keywords: ['nu', 'nubank', 'nu bank', 'roxinho', 'nuconta'],
  },
  {
    id: 'inter',
    name: 'Banco Inter',
    iconName: 'inter',
    primaryColor: '#FF7A00',
    keywords: ['inter', 'banco inter', 'orange'],
  },
  {
    id: 'itau',
    name: 'Itaú',
    iconName: 'itau',
    primaryColor: '#EC7000',
    keywords: ['itau', 'itaú', 'itaucard', 'iti'],
  },
  {
    id: 'bradesco',
    name: 'Bradesco',
    iconName: 'bradesco',
    primaryColor: '#CC092F',
    keywords: ['bradesco', 'next'],
  },
  {
    id: 'santander',
    name: 'Santander',
    iconName: 'santander',
    primaryColor: '#EC0000',
    keywords: ['santander', 'sx'],
  },
  {
    id: 'c6',
    name: 'C6 Bank',
    iconName: 'c6',
    primaryColor: '#242424',
    keywords: ['c6', 'c6bank', 'c6 bank'],
  },
  {
    id: 'caixa',
    name: 'Caixa',
    iconName: 'caixa',
    primaryColor: '#00579E',
    keywords: ['caixa', 'cef', 'economica federal', 'econômica federal'],
  },
  {
    id: 'bancodobrasil',
    name: 'Banco do Brasil',
    iconName: 'bancodobrasil',
    primaryColor: '#003882',
    keywords: ['banco do brasil', 'bb', 'ourocard'],
  },
  {
    id: 'shopee',
    name: 'Shopee',
    iconName: 'shopee',
    primaryColor: '#EE4D2D',
    keywords: ['shopee', 'spay', 'shopeepay'],
  },
  {
    id: 'mercadopago',
    name: 'Mercado Pago',
    iconName: 'mercadopago',
    primaryColor: '#009EE3',
    keywords: ['mercado pago', 'mercadopago', 'mercado livre', 'meli'],
  },
  {
    id: 'picpay',
    name: 'PicPay',
    iconName: 'picpay',
    primaryColor: '#11C76F',
    keywords: ['picpay', 'pic pay'],
  },
  {
    id: 'pagbank',
    name: 'PagBank',
    iconName: 'pagbank',
    primaryColor: '#00A868',
    keywords: ['pagbank', 'pagseguro', 'pag bank'],
  },
  {
    id: 'neon',
    name: 'Neon',
    iconName: 'neon',
    primaryColor: '#00E5FF',
    keywords: ['neon', 'banco neon'],
  },
  {
    id: 'btg',
    name: 'BTG Pactual',
    iconName: 'btg',
    primaryColor: '#001E62',
    keywords: ['btg', 'btg pactual'],
  },
  {
    id: 'original',
    name: 'Banco Original',
    iconName: 'original',
    primaryColor: '#00A859',
    keywords: ['original', 'banco original'],
  },
  {
    id: 'safra',
    name: 'Safra',
    iconName: 'safra',
    primaryColor: '#B8860B',
    keywords: ['safra', 'banco safra'],
  },
  {
    id: 'sicoob',
    name: 'Sicoob',
    iconName: 'sicoob',
    primaryColor: '#003641',
    keywords: ['sicoob'],
  },
  {
    id: 'sicredi',
    name: 'Sicredi',
    iconName: 'sicredi',
    primaryColor: '#00953B',
    keywords: ['sicredi'],
  },
  {
    id: 'stone',
    name: 'Stone',
    iconName: 'stone',
    primaryColor: '#00A868',
    keywords: ['stone', 'ton'],
  },
  {
    id: 'agibank',
    name: 'Agibank',
    iconName: 'agibank',
    primaryColor: '#005CA9',
    keywords: ['agibank', 'agi'],
  },
  {
    id: 'bmg',
    name: 'BMG',
    iconName: 'bmg',
    primaryColor: '#FF5000',
    keywords: ['bmg', 'banco bmg'],
  },
  {
    id: 'pan',
    name: 'Banco PAN',
    iconName: 'pan',
    primaryColor: '#009EE3',
    keywords: ['pan', 'banco pan'],
  },
  {
    id: 'cora',
    name: 'Cora',
    iconName: 'cora',
    primaryColor: '#FF4B55',
    keywords: ['cora', 'banco cora'],
  },
  {
    id: 'digio',
    name: 'Digio',
    iconName: 'digio',
    primaryColor: '#003B70',
    keywords: ['digio'],
  },
  {
    id: 'efibank',
    name: 'Efi Bank',
    iconName: 'efibank',
    primaryColor: '#F37021',
    keywords: ['efi', 'efibank', 'gerencianet'],
  },
  {
    id: 'nomad',
    name: 'Nomad',
    iconName: 'nomad',
    primaryColor: '#E5A823',
    keywords: ['nomad'],
  },
  {
    id: 'wise',
    name: 'Wise',
    iconName: 'wise',
    primaryColor: '#9FE870',
    keywords: ['wise', 'transferwise'],
  },
  {
    id: 'paypal',
    name: 'PayPal',
    iconName: 'paypal',
    primaryColor: '#003087',
    keywords: ['paypal', 'pay pal'],
  },
  {
    id: 'xp',
    name: 'XP Investimentos',
    iconName: 'xp',
    primaryColor: '#000000',
    keywords: ['xp', 'xp investimentos'],
  },
  {
    id: 'rico',
    name: 'Rico',
    iconName: 'rico',
    primaryColor: '#FF4500',
    keywords: ['rico', 'rico investimentos'],
  },
  // Card payment networks
  {
    id: 'mastercard',
    name: 'Mastercard',
    iconName: 'mastercard',
    primaryColor: '#EB001B',
    keywords: ['mastercard', 'master card', 'master'],
  },
  {
    id: 'visa',
    name: 'Visa',
    iconName: 'visa',
    primaryColor: '#1A1F71',
    keywords: ['visa'],
  },
  {
    id: 'elo',
    name: 'Elo',
    iconName: 'elo',
    primaryColor: '#000000',
    keywords: ['elo'],
  },
  {
    id: 'amex',
    name: 'American Express',
    iconName: 'amex',
    primaryColor: '#006FCF',
    keywords: ['amex', 'american express'],
  },
];

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
