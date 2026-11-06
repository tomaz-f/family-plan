import {
  AppLanguage,
  AppTheme,
  Category,
  CreditCard,
  RecurringTemplate,
  Transaction,
} from '../../types';

export interface ReportsViewProps {
  selectedMonth: string;
  familyName: string;
  currency: string;
  language: AppLanguage;
  theme?: AppTheme;
  initialBalance: number;
  categories: Category[];
  creditCards?: CreditCard[];
  transactions: Transaction[];
  recurringTemplates?: RecurringTemplate[];
  onSelectMonth?: (month: string) => void;
}

export interface CategorySliceItem {
  id: string;
  name: string;
  color: string;
  icon: string;
  amount: number;
  count: number;
  share: number;
}

export interface ComputedDonutArc extends CategorySliceItem {
  strokeDasharray: string;
  strokeDashoffset: number;
  dashOffset: number;
  startOffset: number;
  animDelay: number;
  animDuration: number;
}

export interface NonCardInstallmentPlan {
  key: string;
  description: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  monthlyAmount: number;
  totalInstallments: number;
  paidInstallments: number;
  remainingInstallments: number;
  currentInstallmentDisplay: number;
  totalAmount: number;
  totalPaidAmount: number;
  remainingDebtAmount: number;
  progressPct: number;
  paymentMethod: string;
  isDueInSelectedMonth: boolean;
  selectedMonthAmount: number;
  installmentSchedule: number[];
}

export interface AmortizationTimelinePoint {
  index: number;
  month: string;
  shortMonthLabel: string;
  yearLabel: string;
  fullMonthLabel: string;
  monthlyCommitment: number;
  remainingBalance: number;
  activeCount: number;
}

export interface InstallmentExpenseTrackerProps {
  transactions: Transaction[];
  categories: Category[];
  currency: string;
  language: AppLanguage;
  selectedMonth?: string;
  theme?: AppTheme;
}

export interface MonthCommitmentProjection {
  month: string;
  shortMonthLabel: string;
  yearLabel: string;
  invoicesAmount: number;
  installmentsAmount: number;
  recurringAmount: number;
  totalCommitment: number;
  invoicesCount: number;
  installmentsCount: number;
  recurringCount: number;
}

export interface FutureCommitmentsForecastProps {
  selectedMonth: string;
  currency: string;
  language: AppLanguage;
  theme?: AppTheme;
  creditCards?: CreditCard[];
  transactions: Transaction[];
  recurringTemplates?: RecurringTemplate[];
}

export const FALLBACK_SLICE_COLORS = [
  '#EF4444',
  '#F59E0B',
  '#10B981',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
  '#F97316',
  '#D0B595',
  '#6366F1',
];

export const INVOICE_SLICE_ID = 'credit-card-invoices';

// 4 logical cards wrapped with adjacent virtual buffers [Card 3, Card 0, Card 1, Card 2, Card 3, Card 0]
// for seamless infinite circular wrap-around in both directions
export const VIRTUAL_SLIDE_MAP = [3, 0, 1, 2, 3, 0] as const;

export const REPORT_SLIDES = [
  { index: 0, labelPt: 'Geral', labelEn: 'General' },
  { index: 1, labelPt: 'Cartões', labelEn: 'Cards' },
  { index: 2, labelPt: 'Futuro', labelEn: 'Future' },
  { index: 3, labelPt: 'Parcelas', labelEn: 'Installments' },
] as const;

export const DONUT_SVG_SIZE = 240;
export const DONUT_CENTER = DONUT_SVG_SIZE / 2;
export const DONUT_RADIUS = 84;
export const DONUT_STROKE_WIDTH = 28;
export const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;
export const DONUT_ANIM_TOTAL = 650;
