import { AppLanguage, Category } from '../../types';

export const DEFAULT_CATEGORY_TRANSLATIONS: Record<string, { en: string; 'pt-BR': string }> = {
  // Core Categories (Strict Single-Word Names)
  'exp-housing': { en: 'Housing', 'pt-BR': 'Moradia' },
  'exp-groceries': { en: 'Groceries', 'pt-BR': 'Mercado' },
  'exp-transport': { en: 'Transport', 'pt-BR': 'Transporte' },
  'exp-health': { en: 'Health', 'pt-BR': 'Saúde' },
  'exp-leisure': { en: 'Leisure', 'pt-BR': 'Lazer' },
  'exp-education': { en: 'Education', 'pt-BR': 'Educação' },
  'exp-subscriptions': { en: 'Subscriptions', 'pt-BR': 'Assinaturas' },
  'exp-bills': { en: 'Bills', 'pt-BR': 'Contas' },
  'exp-other': { en: 'Other', 'pt-BR': 'Outros' },
  'inc-salary': { en: 'Salary', 'pt-BR': 'Salário' },
  'inc-extra': { en: 'Extra', 'pt-BR': 'Extra' },
  'inc-investments': { en: 'Investments', 'pt-BR': 'Investimentos' },

  // Legacy Category Mappings
  'inc-deposit': { en: 'Deposit', 'pt-BR': 'Depósito' },
  'inc-freelance': { en: 'Extra', 'pt-BR': 'Extra' },
  'inc-refund': { en: 'Refund', 'pt-BR': 'Reembolso' },
  'inc-other': { en: 'Other', 'pt-BR': 'Outras' },
  'exp-utilities': { en: 'Bills', 'pt-BR': 'Contas' },
  'exp-dining': { en: 'Dining', 'pt-BR': 'Restaurante' },
  'exp-shopping': { en: 'Shopping', 'pt-BR': 'Compras' },
};

export function getCategoryDisplayName(cat?: Category | null, lang: AppLanguage = 'en'): string {
  if (!cat) return lang === 'pt-BR' ? 'Sem categoria' : 'Uncategorized';
  const entry = DEFAULT_CATEGORY_TRANSLATIONS[cat.id];
  if (entry) {
    if (
      cat.name === entry.en ||
      cat.name === entry['pt-BR'] ||
      cat.name === 'Moradia e Aluguel' ||
      cat.name === 'Supermercado e Feira' ||
      cat.name === 'Transporte e Combustível' ||
      cat.name === 'Saúde e Farmácia' ||
      cat.name === 'Lazer e Assinaturas' ||
      cat.name === 'Filhos e Educação' ||
      cat.name === 'Outras Despesas' ||
      cat.name === 'Housing & Rent' ||
      cat.name === 'Groceries & Market' ||
      cat.name === 'Transport & Fuel' ||
      cat.name === 'Health & Pharmacy' ||
      cat.name === 'Leisure & Subscriptions' ||
      cat.name === 'Kids & Education' ||
      cat.name === 'Other Expenses'
    ) {
      return entry[lang];
    }
  }
  return cat.name;
}
