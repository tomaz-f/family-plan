import React from 'react';
import {
  AppLanguage,
  AppState,
  CreditCard,
  FuelType,
  Transaction,
  TransactionStatus,
} from '../types';
import { getTodayDateStr } from '../utils/format';
import {
  apiFetch,
  decryptFullState,
  encryptCreditCard,
  encryptFuelLog,
  encryptTransaction,
} from '../services/tursoService';
import { computeTxInvoiceMonth } from './cloudSyncHelpers';

interface UseCardFuelRecurringCrudParams {
  state: AppState;
  familyId: string | null;
  masterKey: string | null;
  language: AppLanguage;
  setIsOnlineWithServer: React.Dispatch<React.SetStateAction<boolean>>;
  saveStateToCache: (nextState: AppState) => void;
  handleDecryptionFailure: (err: unknown) => boolean;
}

export function useCardFuelRecurringCrud({
  state,
  familyId,
  masterKey,
  language,
  setIsOnlineWithServer,
  saveStateToCache,
  handleDecryptionFailure,
}: UseCardFuelRecurringCrudParams) {
  const handleSaveFuelLog = async (fuelData: {
    id?: string;
    date: string;
    odometer: number;
    pricePerLiter: number;
    totalCost: number;
    liters: number;
    fuelType: FuelType;
    stationName: string;
    isFullTank: boolean;
    notes?: string;
  }) => {
    const fuelId = fuelData.id || `fuel-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const txId = `tx-fuel-${fuelId}`;
    const fuelLabel =
      language === 'pt-BR'
        ? fuelData.fuelType === 'ethanol' ? 'Etanol' : 'Gasolina'
        : fuelData.fuelType === 'ethanol' ? 'Ethanol' : 'Gasoline';
    const baseDesc =
      language === 'pt-BR' ? `Abastecimento (${fuelLabel})` : `Refueling (${fuelLabel})`;
    const txDesc = `${baseDesc}${fuelData.stationName ? ` - ${fuelData.stationName}` : ''}${
      fuelData.liters ? ` [${Number(fuelData.liters).toFixed(2)}L]` : ''
    }`;

    const linkedTx: Transaction = {
      id: txId,
      type: 'expense',
      status: 'paid',
      amount: Number(fuelData.totalCost || 0),
      description: txDesc,
      categoryId: 'exp-transport',
      date: fuelData.date,
      notes: `${fuelData.odometer} km • ${fuelData.pricePerLiter}/L`,
      createdAt: new Date().toISOString(),
    };

    const fullFuelLog = {
      id: fuelId,
      ...fuelData,
      transactionId: txId,
      createdAt: new Date().toISOString(),
    };

    const prevFuel = state.fuelLogs || [];
    const nextFuel = fuelData.id
      ? prevFuel.map((f) => (f.id === fuelData.id ? fullFuelLog : f))
      : [fullFuelLog, ...prevFuel];
    const nextTx = state.transactions.some((tx) => tx.id === txId)
      ? state.transactions.map((tx) => (tx.id === txId ? linkedTx : tx))
      : [linkedTx, ...state.transactions];

    saveStateToCache({ ...state, fuelLogs: nextFuel, transactions: nextTx });

    try {
      let fuelPayload: Record<string, unknown>;
      if (masterKey && familyId) {
        const encFuel = await encryptFuelLog(fullFuelLog, masterKey, familyId);
        const encTx = await encryptTransaction(linkedTx, masterKey, familyId);
        fuelPayload = { ...encFuel, transactionId: txId, transaction: encTx };
      } else {
        fuelPayload = { ...fullFuelLog, transaction: linkedTx };
      }

      const url = fuelData.id ? `/api/fuel/${fuelData.id}` : '/api/fuel';
      const method = fuelData.id ? 'PUT' : 'POST';
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fuelPayload),
      });
      if (res.ok) {
        const rawData = await res.json();
        const data =
          masterKey && familyId ? await decryptFullState(rawData, masterKey, familyId) : rawData;
        saveStateToCache(data);
      }
      setIsOnlineWithServer(true);
    } catch {
      setIsOnlineWithServer(false);
    }
  };

  const handleDeleteFuelLog = async (id: string) => {
    const target = (state.fuelLogs || []).find((f) => f.id === id);
    const txId = target?.transactionId || `tx-fuel-${id}`;

    saveStateToCache({
      ...state,
      fuelLogs: (state.fuelLogs || []).filter((f) => f.id !== id),
      transactions: state.transactions.filter((tx) => tx.id !== txId && tx.id !== `tx-fuel-${id}`),
    });

    try {
      const res = await apiFetch(`/api/fuel/${id}`, { method: 'DELETE' });
      if (res.ok) {
        const rawData = await res.json();
        const data =
          masterKey && familyId ? await decryptFullState(rawData, masterKey, familyId) : rawData;
        saveStateToCache(data);
      }
      setIsOnlineWithServer(true);
    } catch (err: unknown) {
      if (handleDecryptionFailure(err)) return;
      setIsOnlineWithServer(false);
    }
  };

  const handleSaveCard = async (
    cardData: Partial<CreditCard> & {
      name: string;
      totalLimit: number;
      closingDay: number;
      dueDay: number;
    }
  ) => {
    try {
      const cardPayload =
        masterKey && familyId
          ? await encryptCreditCard(cardData as CreditCard, masterKey, familyId)
          : cardData;
      const url = cardData.id ? `/api/cards/${cardData.id}` : '/api/cards';
      const method = cardData.id ? 'PUT' : 'POST';
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cardPayload),
      });
      if (!res.ok) throw new Error('Failed');
      const rawData: AppState = await res.json();
      const data =
        masterKey && familyId ? await decryptFullState(rawData, masterKey, familyId) : rawData;
      saveStateToCache(data);
    } catch (err: unknown) {
      if (handleDecryptionFailure(err)) return;
      const prevCards = state.creditCards || [];
      const newCard: CreditCard = {
        id: cardData.id || `card-${Date.now()}`,
        name: cardData.name,
        totalLimit: cardData.totalLimit,
        closingDay: cardData.closingDay,
        dueDay: cardData.dueDay,
        brand: cardData.brand || 'mastercard',
        color: cardData.color || '#6366f1',
        lastDigits: cardData.lastDigits || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const nextCards = cardData.id
        ? prevCards.map((c) => (c.id === cardData.id ? newCard : c))
        : [...prevCards, newCard];
      saveStateToCache({ ...state, creditCards: nextCards });
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    try {
      const res = await apiFetch(`/api/cards/${cardId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      const rawData: AppState = await res.json();
      const data =
        masterKey && familyId ? await decryptFullState(rawData, masterKey, familyId) : rawData;
      saveStateToCache(data);
    } catch (err: unknown) {
      if (handleDecryptionFailure(err)) return;
      saveStateToCache({
        ...state,
        creditCards: (state.creditCards || []).filter((c) => c.id !== cardId),
      });
    }
  };

  const handlePayCardInvoice = async (cardId: string, invoiceMonth: string) => {
    const card = (state.creditCards || []).find((c) => c.id === cardId);
    if (!card) return;

    const cardTxs = state.transactions.filter(
      (tx) => tx.cardId === cardId && computeTxInvoiceMonth(tx, card) === invoiceMonth
    );

    const total = Number(cardTxs.reduce((sum, tx) => sum + Number(tx.amount || 0), 0).toFixed(2));
    if (total <= 0) return;

    const settlementKey = `${cardId}__${invoiceMonth}`;
    const todayStr = getTodayDateStr();
    const existingSettlementTx = state.transactions.find(
      (tx) => tx.settledInvoiceKey === settlementKey
    );

    const invoiceCategory =
      state.categories.find(
        (c) =>
          c.type === 'expense' &&
          (c.name.toLowerCase().includes('cartão') ||
            c.name.toLowerCase().includes('fatura') ||
            c.id === 'exp-bills' ||
            c.name.toLowerCase() === 'contas')
      ) ||
      state.categories.find((c) => c.id === 'exp-bills') ||
      state.categories.find((c) => c.id === 'exp-other');

    const settlementTx: Transaction = existingSettlementTx
      ? {
          ...existingSettlementTx,
          status: 'paid',
          amount: total,
          description: `Pagamento de Fatura - ${card.name}`,
          date: todayStr,
          notes: `Pagamento de fatura consolidada (${cardTxs.length} compras)`,
        }
      : {
          id: `tx-fatura-${cardId}-${invoiceMonth}`,
          type: 'expense',
          status: 'paid',
          amount: total,
          description: `Pagamento de Fatura - ${card.name}`,
          categoryId: invoiceCategory?.id || 'exp-bills',
          date: todayStr,
          notes: `Pagamento de fatura consolidada (${cardTxs.length} compras)`,
          dueDay: card.dueDay,
          cardId: null,
          settledInvoiceKey: settlementKey,
          createdAt: new Date().toISOString(),
        };

    const cardTxIds = new Set(cardTxs.map((t) => t.id));
    const optimisticTxs = [
      settlementTx,
      ...state.transactions
        .filter((tx) => tx.id !== settlementTx.id && tx.settledInvoiceKey !== settlementKey)
        .map((tx) => (cardTxIds.has(tx.id) ? { ...tx, status: 'paid' as TransactionStatus } : tx)),
    ];
    saveStateToCache({ ...state, transactions: optimisticTxs });

    try {
      const txPayload =
        masterKey && familyId
          ? await encryptTransaction(settlementTx, masterKey, familyId)
          : settlementTx;

      await apiFetch(
        existingSettlementTx ? `/api/transactions/${existingSettlementTx.id}` : '/api/transactions',
        {
          method: existingSettlementTx ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(txPayload),
        }
      );

      for (const cTx of cardTxs) {
        if (cTx.status !== 'paid') {
          await apiFetch(`/api/transactions/${cTx.id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'paid' }),
          });
        }
      }
      const res = await apiFetch('/api/state');
      if (res.ok) {
        const rawData: AppState = await res.json();
        const data =
          masterKey && familyId ? await decryptFullState(rawData, masterKey, familyId) : rawData;
        saveStateToCache(data);
      }
    } catch (err: unknown) {
      if (handleDecryptionFailure(err)) return;
    }
  };

  return {
    handleSaveFuelLog,
    handleDeleteFuelLog,
    handleSaveCard,
    handleDeleteCard,
    handlePayCardInvoice,
  };
}
