import { CreditCardBrand } from '../../types';
import { KNOWN_BANKS } from '../icons';

export const BRAND_OPTIONS: { id: CreditCardBrand; name: string }[] = [
  ...KNOWN_BANKS.map((b) => ({ id: b.id as CreditCardBrand, name: b.name })),
  { id: 'other' as CreditCardBrand, name: 'Outro / Genérico' },
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
