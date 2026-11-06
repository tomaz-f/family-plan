import { AppLanguage, Category, FuelLog, Transaction } from '../../types';

export type ExportPeriodMode = 'monthly' | 'annual' | 'all';
export type ExportTypeFilter = 'all' | 'income' | 'expense';

export interface ExportFilterOptions {
  periodMode: ExportPeriodMode;
  year: string; // e.g. '2026'
  month: string; // e.g. '10' (01..12)
  typeFilter: ExportTypeFilter;
  familyName: string;
  currency: string;
  language: AppLanguage;
  initialBalance: number;
  categories: Category[];
  transactions: Transaction[];
  fuelLogs?: FuelLog[];
}

export interface ComputedExportData {
  periodTitle: string;
  filenameSlug: string;
  openingBalance: number;
  closingBalance: number;
  projectedBalance: number;
  totalIncome: number; // Realized income (paid)
  pendingIncome: number; // A receber (unpaid)
  incomeCount: number;
  pendingIncomeCount: number;
  totalExpense: number; // Realized expenses (paid)
  pendingExpense: number; // A pagar (unpaid)
  expenseCount: number;
  pendingExpenseCount: number;
  totalCategoryExpenses: number; // Sum of all expense obligations in period
  totalCategoryIncome: number; // Sum of all income in period
  netCashFlow: number;
  savingsRate: number;
  avgDailyExpense: number;
  numDays: number;
  largestExpense: Transaction | null;
  filteredTransactionsAsc: Array<Transaction & { runningBalance: number }>;
  filteredTransactionsDesc: Array<Transaction & { runningBalance: number }>;
  expenseByCategory: Array<{
    id: string;
    name: string;
    color: string;
    count: number;
    amount: number;
    avg: number;
    share: number;
  }>;
  incomeByCategory: Array<{
    id: string;
    name: string;
    color: string;
    count: number;
    amount: number;
    share: number;
  }>;
  monthlySeries: Array<{
    month: string;
    shortLabel: string;
    fullLabel: string;
    income: number;
    expense: number;
    net: number;
    closingBalance: number;
    count: number;
  }>;
  dailySeries: Array<{
    day: string;
    label: string;
    income: number;
    expense: number;
    closingBalance: number;
  }>;
  paymentChannels: {
    card: { amount: number; count: number; share: number };
    bankOrCash: { amount: number; count: number; share: number };
  };
}
