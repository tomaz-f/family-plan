import { DEFAULT_CATEGORY_TRANSLATIONS, getCategoryDisplayName } from './i18n/categoryTranslations';
import { EN_CORE_TRANSLATIONS } from './i18n/enCore';
import { EN_EXTENDED_TRANSLATIONS } from './i18n/enExtended';
import { PT_CORE_TRANSLATIONS } from './i18n/ptCore';
import { PT_EXTENDED_TRANSLATIONS } from './i18n/ptExtended';

export { DEFAULT_CATEGORY_TRANSLATIONS, getCategoryDisplayName };

export const TRANSLATIONS = {
  en: {
    ...EN_CORE_TRANSLATIONS,
    ...EN_EXTENDED_TRANSLATIONS,
  },
  'pt-BR': {
    ...PT_CORE_TRANSLATIONS,
    ...PT_EXTENDED_TRANSLATIONS,
  },
} as const;
